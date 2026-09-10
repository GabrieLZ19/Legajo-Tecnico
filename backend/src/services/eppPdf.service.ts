import PDFDocument from "pdfkit";
import { storageService } from "./storage.service";

export interface EppPdfItem {
  epp_tipos?: { nombre: string; descripcion?: string | null } | null;
  cantidad: number;
  marca?: string | null;
  modelo?: string | null;
  certificacion?: string | null;
  fecha_entrega: string;
  firmaUrl?: string | null;
  firmaBuffer?: Buffer | null;
}

export interface EppPdfData {
  empresa: {
    razon_social: string;
    cuit: string;
    domicilio?: string | null;
    localidad?: string | null;
    codigo_postal?: string | null;
    provincia?: string | null;
    actividad?: string | null;
    logo_url?: string | null;
  };
  empleado: {
    nombre: string;
    dni: string;
    puesto?: string | null;
    epp_necesarios?: string | null;
  };
  items: EppPdfItem[];
  informacion_adicional?: string | null;
}

/** Fila de listado histórico consolidado (todas las entregas juntas). */
export interface EppHistoricoListaItem {
  trabajador: string;
  dni: string;
  producto: string;
  modelo?: string | null;
  marca?: string | null;
  certificacion?: string | null;
  cantidad: number;
  fecha_entrega: string;
  firmaUrl?: string | null;
  firmaBuffer?: Buffer | null;
}

export interface EppHistoricoListaData {
  empresa: EppPdfData["empresa"];
  items: EppHistoricoListaItem[];
  informacion_adicional?: string | null;
}

const ROWS_PER_PAGE = 18;
const PAGE_LEFT = 36;
const PAGE_WIDTH = 595.28 - PAGE_LEFT * 2;

const formatLocalDate = (dateInput: string): string => {
  if (!dateInput) return "";
  const datePart = dateInput.split("T")[0];
  const parts = datePart.split("-");
  if (parts.length === 3) {
    const [year, month, day] = parts;
    return `${parseInt(day, 10)}/${parseInt(month, 10)}/${year}`;
  }
  return new Date(dateInput).toLocaleDateString("es-AR");
};

const formatCertificacion = (value?: string | null): string => {
  if (!value?.trim()) return "";
  const v = value.trim().toUpperCase();
  if (v === "NO" || v === "N" || v === "0" || v === "FALSE") return "NO";
  return "SI";
};

async function loadSignatureBuffer(
  item: EppPdfItem,
): Promise<Buffer | null> {
  if (item.firmaBuffer) return item.firmaBuffer;
  if (!item.firmaUrl) return null;
  return storageService.downloadBuffer(item.firmaUrl);
}

function drawCellBorder(
  doc: InstanceType<typeof PDFDocument>,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  doc.rect(x, y, w, h).stroke("#000000");
}

function drawCellText(
  doc: InstanceType<typeof PDFDocument>,
  x: number,
  y: number,
  w: number,
  h: number,
  text: string,
  opts?: {
    bold?: boolean;
    align?: "left" | "center" | "right";
    fontSize?: number;
    valign?: "top" | "middle";
  },
) {
  const fontSize = opts?.fontSize ?? 7;
  const padding = 3;
  const textH = fontSize + 2;
  const textY =
    opts?.valign === "middle" ? y + (h - textH) / 2 : y + padding;

  doc
    .font(opts?.bold ? "Helvetica-Bold" : "Helvetica")
    .fontSize(fontSize)
    .fillColor("#000000")
    .text(text, x + padding, textY, {
      width: w - padding * 2,
      align: opts?.align ?? "left",
      lineBreak: true,
    });
}

function drawSignatureInCell(
  doc: InstanceType<typeof PDFDocument>,
  sigBuf: Buffer,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  doc.save();
  doc.rect(x, y, w, h).clip();
  try {
    doc.image(sigBuf, x + 3, y + 3, {
      fit: [w - 6, h - 6],
      align: "center",
      valign: "center",
    });
  } catch (err) {
    console.error("No se pudo incrustar firma en planilla EPP:", err);
  }
  doc.restore();
}

function drawLabeledValue(
  doc: InstanceType<typeof PDFDocument>,
  label: string,
  value: string,
  x: number,
  y: number,
  width: number,
) {
  doc.font("Helvetica-Bold").fontSize(8).fillColor("#000000");
  const labelW = doc.widthOfString(label);
  doc.text(label, x, y, { lineBreak: false });
  doc
    .font("Helvetica")
    .text(value || "", x + labelW + 2, y, {
      width: Math.max(20, width - labelW - 4),
      lineBreak: false,
      ellipsis: true,
    });
}

type PreparedPlanilla = {
  data: EppPdfData;
  signatureBuffers: Array<Buffer | null>;
  pages: EppPdfItem[][];
};

async function preparePlanilla(data: EppPdfData): Promise<PreparedPlanilla> {
  const signatureBuffers = await Promise.all(
    data.items.map((item) => loadSignatureBuffer(item)),
  );

  const paddedItems: EppPdfItem[] = [...data.items];
  while (
    paddedItems.length % ROWS_PER_PAGE !== 0 &&
    paddedItems.length < ROWS_PER_PAGE
  ) {
    paddedItems.push({
      epp_tipos: null,
      cantidad: 0,
      marca: null,
      modelo: null,
      certificacion: null,
      fecha_entrega: "",
    });
  }

  const pages: EppPdfItem[][] = [];
  for (let i = 0; i < paddedItems.length; i += ROWS_PER_PAGE) {
    pages.push(paddedItems.slice(i, i + ROWS_PER_PAGE));
  }

  return { data, signatureBuffers, pages };
}

function drawPlanillaPage(
  doc: InstanceType<typeof PDFDocument>,
  prepared: PreparedPlanilla,
  pageItems: EppPdfItem[],
  pageIndex: number,
) {
  const { data, signatureBuffers } = prepared;
  const colWidths = [
    22,
    90,
    76,
    58,
    88,
    42,
    62,
    PAGE_WIDTH - (22 + 90 + 76 + 58 + 88 + 42 + 62),
  ];
  const rowH = 34;
  const headerRowH = 36;

  let y = 28;

  doc
    .fontSize(8)
    .font("Helvetica-Bold")
    .text("Resolución 299/11, Anexo I", PAGE_LEFT, y);
  y += 14;

  doc
    .fontSize(9.5)
    .font("Helvetica-Bold")
    .text(
      "ENTREGA DE ROPA DE TRABAJO Y ELEMENTOS DE PROTECCIÓN PERSONAL",
      PAGE_LEFT,
      y,
      { width: PAGE_WIDTH, align: "center" },
    );
  y += 20;

  drawLabeledValue(
    doc,
    "Razón Social: ",
    data.empresa.razon_social,
    PAGE_LEFT,
    y,
    PAGE_WIDTH * 0.62,
  );
  drawLabeledValue(
    doc,
    "C.U.I.T.: ",
    data.empresa.cuit,
    PAGE_LEFT + PAGE_WIDTH * 0.62,
    y,
    PAGE_WIDTH * 0.38,
  );
  y += 14;

  drawLabeledValue(
    doc,
    "Dirección: ",
    data.empresa.domicilio || "",
    PAGE_LEFT,
    y,
    PAGE_WIDTH * 0.36,
  );
  drawLabeledValue(
    doc,
    "Localidad: ",
    data.empresa.localidad || "",
    PAGE_LEFT + PAGE_WIDTH * 0.36,
    y,
    PAGE_WIDTH * 0.24,
  );
  drawLabeledValue(
    doc,
    "C.P.: ",
    data.empresa.codigo_postal || "",
    PAGE_LEFT + PAGE_WIDTH * 0.6,
    y,
    PAGE_WIDTH * 0.12,
  );
  drawLabeledValue(
    doc,
    "Provincia: ",
    data.empresa.provincia || "",
    PAGE_LEFT + PAGE_WIDTH * 0.72,
    y,
    PAGE_WIDTH * 0.28,
  );
  y += 14;

  drawLabeledValue(
    doc,
    "Nombre y Apellido del Trabajador: ",
    data.empleado.nombre,
    PAGE_LEFT,
    y,
    PAGE_WIDTH * 0.68,
  );
  drawLabeledValue(
    doc,
    "D.N.I.: ",
    data.empleado.dni,
    PAGE_LEFT + PAGE_WIDTH * 0.68,
    y,
    PAGE_WIDTH * 0.32,
  );
  y += 16;

  const boxH = 34;
  const halfW = PAGE_WIDTH / 2 - 4;
  doc.rect(PAGE_LEFT, y, halfW, boxH).stroke("#000000");
  doc.rect(PAGE_LEFT + halfW + 8, y, halfW, boxH).stroke("#000000");

  doc.font("Helvetica-Bold").fontSize(6.5);
  doc.text(
    "Descripción breve del puesto/s de trabajo en el/los cuales se desempeña el trabajador:",
    PAGE_LEFT + 4,
    y + 4,
    { width: halfW - 8 },
  );
  doc.text(
    "Elementos de protección personal, necesarios para el trabajador, según el puesto de trabajo:",
    PAGE_LEFT + halfW + 12,
    y + 4,
    { width: halfW - 8 },
  );
  doc.font("Helvetica").fontSize(7);
  doc.text(data.empleado.puesto || "", PAGE_LEFT + 4, y + 20, {
    width: halfW - 8,
    height: 12,
  });
  doc.text(
    data.empleado.epp_necesarios || "",
    PAGE_LEFT + halfW + 12,
    y + 20,
    { width: halfW - 8, height: 12 },
  );
  y += boxH + 8;

  const tableTop = y;
  let x = PAGE_LEFT;
  const headers = [
    "",
    "Producto",
    "Tipo // Modelo",
    "Marca",
    "Posee certificación SI // NO",
    "Cantidad",
    "Fecha de entrega",
    "Firma del trabajador",
  ];

  headers.forEach((header, i) => {
    drawCellBorder(doc, x, tableTop, colWidths[i], headerRowH);
    drawCellText(doc, x, tableTop, colWidths[i], headerRowH, header, {
      bold: true,
      align: "center",
      fontSize: 6.5,
      valign: "middle",
    });
    x += colWidths[i];
  });

  let rowY = tableTop + headerRowH;
  pageItems.forEach((item, idx) => {
    const globalIdx = pageIndex * ROWS_PER_PAGE + idx;
    x = PAGE_LEFT;

    const cells = [
      String(globalIdx + 1),
      item.epp_tipos?.nombre || "",
      item.modelo || "",
      item.marca || "",
      formatCertificacion(item.certificacion),
      item.cantidad > 0 ? String(item.cantidad) : "",
      item.fecha_entrega ? formatLocalDate(item.fecha_entrega) : "",
    ];

    cells.forEach((cell, i) => {
      drawCellBorder(doc, x, rowY, colWidths[i], rowH);
      drawCellText(doc, x, rowY, colWidths[i], rowH, cell, {
        align: i === 0 || i === 5 ? "center" : "left",
        fontSize: 7,
        valign: "middle",
      });
      x += colWidths[i];
    });

    const firmaColX = x;
    drawCellBorder(doc, firmaColX, rowY, colWidths[7], rowH);

    const sigBuf =
      globalIdx < signatureBuffers.length ? signatureBuffers[globalIdx] : null;
    if (sigBuf) {
      drawSignatureInCell(doc, sigBuf, firmaColX, rowY, colWidths[7], rowH);
    }

    rowY += rowH;
  });

  y = rowY + 8;
  doc.font("Helvetica-Bold").fontSize(8);
  doc.text("Información adicional:", PAGE_LEFT, y);
  y += 12;
  doc
    .font("Helvetica")
    .fontSize(7.5)
    .text(data.informacion_adicional || "", PAGE_LEFT + 4, y, {
      width: PAGE_WIDTH - 8,
      height: 28,
    });
}

export const eppPdfService = {
  async generarPlanillaAnexoI(data: EppPdfData): Promise<Buffer> {
    return this.generarPlanillasAnexoI([data]);
  },

  /**
   * Una o más planillas Anexo I (Res. 299/11) en un mismo PDF.
   * Cada trabajador empieza en página nueva.
   */
  async generarPlanillasAnexoI(planillas: EppPdfData[]): Promise<Buffer> {
    if (!planillas.length) {
      throw new Error("No hay planillas para generar");
    }

    const prepared = await Promise.all(planillas.map((p) => preparePlanilla(p)));

    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({
          size: "A4",
          margins: { top: 28, bottom: 28, left: PAGE_LEFT, right: PAGE_LEFT },
        });

        const chunks: Buffer[] = [];
        doc.on("data", (chunk: Buffer) => chunks.push(chunk));
        doc.on("end", () => resolve(Buffer.concat(chunks)));

        let isFirstPage = true;
        for (const planilla of prepared) {
          for (let pageIndex = 0; pageIndex < planilla.pages.length; pageIndex++) {
            if (!isFirstPage) doc.addPage();
            isFirstPage = false;
            drawPlanillaPage(
              doc,
              planilla,
              planilla.pages[pageIndex],
              pageIndex,
            );
          }
        }

        doc.end();
      } catch (err) {
        reject(err);
      }
    });
  },

  /**
   * Listado histórico completo (Res. 299/11) en una sola tabla continua.
   * Incluye trabajador/DNI en cada fila — no genera una planilla por persona.
   */
  async generarListaHistorico(data: EppHistoricoListaData): Promise<Buffer> {
    if (!data.items.length) {
      throw new Error("No hay entregas para generar");
    }

    const signatureBuffers = await Promise.all(
      data.items.map(async (item) => {
        if (item.firmaBuffer) return item.firmaBuffer;
        if (!item.firmaUrl) return null;
        return storageService.downloadBuffer(item.firmaUrl);
      }),
    );

    // Landscape A4 para acomodar columnas de lista
    const pageW = 841.89;
    const pageH = 595.28;
    const left = 28;
    const usableW = pageW - left * 2;
    const colWidths = [
      18, // #
      88, // Trabajador
      52, // DNI
      110, // Producto
      70, // Modelo
      54, // Marca
      58, // Cert
      36, // Cant
      58, // Fecha
      usableW - (18 + 88 + 52 + 110 + 70 + 54 + 58 + 36 + 58), // Firma
    ];
    const rowH = 28;
    const headerRowH = 30;
    const bottomMargin = 36;

    const headers = [
      "#",
      "Trabajador",
      "D.N.I.",
      "Producto",
      "Tipo // Modelo",
      "Marca",
      "Certif.",
      "Cant.",
      "Fecha",
      "Firma",
    ];

    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({
          size: "A4",
          layout: "landscape",
          margins: { top: 24, bottom: 24, left, right: left },
        });

        const chunks: Buffer[] = [];
        doc.on("data", (chunk: Buffer) => chunks.push(chunk));
        doc.on("end", () => resolve(Buffer.concat(chunks)));

        const drawHeaderBlock = (): number => {
          let y = 22;
          doc
            .fontSize(8)
            .font("Helvetica-Bold")
            .text("Resolución 299/11, Anexo I", left, y);
          y += 12;
          doc
            .fontSize(11)
            .font("Helvetica-Bold")
            .text(
              "ENTREGA DE ROPA DE TRABAJO Y ELEMENTOS DE PROTECCIÓN PERSONAL",
              left,
              y,
              { width: usableW, align: "center" },
            );
          y += 16;
          doc
            .fontSize(8)
            .font("Helvetica-Oblique")
            .fillColor("#334155")
            .text("Base histórica consolidada — listado completo", left, y, {
              width: usableW,
              align: "center",
            });
          doc.fillColor("#000000");
          y += 14;

          drawLabeledValue(
            doc,
            "Razón Social: ",
            data.empresa.razon_social,
            left,
            y,
            usableW * 0.62,
          );
          drawLabeledValue(
            doc,
            "C.U.I.T.: ",
            data.empresa.cuit,
            left + usableW * 0.62,
            y,
            usableW * 0.38,
          );
          y += 12;
          drawLabeledValue(
            doc,
            "Dirección: ",
            data.empresa.domicilio || "",
            left,
            y,
            usableW * 0.36,
          );
          drawLabeledValue(
            doc,
            "Localidad: ",
            data.empresa.localidad || "",
            left + usableW * 0.36,
            y,
            usableW * 0.24,
          );
          drawLabeledValue(
            doc,
            "C.P.: ",
            data.empresa.codigo_postal || "",
            left + usableW * 0.6,
            y,
            usableW * 0.12,
          );
          drawLabeledValue(
            doc,
            "Provincia: ",
            data.empresa.provincia || "",
            left + usableW * 0.72,
            y,
            usableW * 0.28,
          );
          y += 14;
          return y;
        };

        const drawTableHeader = (y: number): number => {
          let x = left;
          headers.forEach((header, i) => {
            drawCellBorder(doc, x, y, colWidths[i], headerRowH);
            drawCellText(doc, x, y, colWidths[i], headerRowH, header, {
              bold: true,
              align: "center",
              fontSize: 6.5,
              valign: "middle",
            });
            x += colWidths[i];
          });
          return y + headerRowH;
        };

        let y = drawHeaderBlock();
        y = drawTableHeader(y);
        let rowIndex = 0;

        for (const item of data.items) {
          if (y + rowH > pageH - bottomMargin) {
            doc.addPage();
            y = drawHeaderBlock();
            y = drawTableHeader(y);
          }

          let x = left;
          const cells = [
            String(rowIndex + 1),
            item.trabajador || "",
            item.dni || "",
            item.producto || "",
            item.modelo || "",
            item.marca || "",
            formatCertificacion(item.certificacion),
            item.cantidad > 0 ? String(item.cantidad) : "",
            item.fecha_entrega ? formatLocalDate(item.fecha_entrega) : "",
          ];

          cells.forEach((cell, i) => {
            drawCellBorder(doc, x, y, colWidths[i], rowH);
            drawCellText(doc, x, y, colWidths[i], rowH, cell, {
              align: i === 0 || i === 7 || i === 8 ? "center" : "left",
              fontSize: 6.5,
              valign: "middle",
            });
            x += colWidths[i];
          });

          drawCellBorder(doc, x, y, colWidths[9], rowH);
          const sigBuf = signatureBuffers[rowIndex];
          if (sigBuf) {
            drawSignatureInCell(doc, sigBuf, x, y, colWidths[9], rowH);
          }

          y += rowH;
          rowIndex += 1;
        }

        y += 10;
        if (y + 20 > pageH - bottomMargin) {
          doc.addPage();
          y = 28;
        }
        doc.font("Helvetica-Bold").fontSize(8).fillColor("#000000");
        doc.text("Información adicional:", left, y);
        y += 11;
        doc
          .font("Helvetica")
          .fontSize(7.5)
          .text(
            data.informacion_adicional ||
              `Listado consolidado — ${data.items.length} entrega(s)`,
            left + 2,
            y,
            { width: usableW - 4 },
          );

        doc.end();
      } catch (err) {
        reject(err);
      }
    });
  },

  /** @deprecated Usar generarPlanillaAnexoI */
  async generarConstanciaSRT299(
    data: EppPdfData & {
      fecha: string;
      firmaUrl: string | null;
      firmaEmpleadorUrl?: string | null;
      preventorNombre?: string | null;
      consultora?: { nombre?: string | null; logo_url?: string | null } | null;
    },
  ): Promise<Buffer> {
    const items =
      data.items.length > 0
        ? data.items
        : [
            {
              epp_tipos: { nombre: "N/A" },
              cantidad: 1,
              marca: null,
              modelo: null,
              certificacion: null,
              fecha_entrega: data.fecha,
              firmaUrl: data.firmaUrl,
            },
          ];
    return this.generarPlanillaAnexoI({
      empresa: data.empresa,
      empleado: data.empleado,
      items,
    });
  },
};
