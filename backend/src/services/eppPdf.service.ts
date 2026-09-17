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

const ROWS_PER_PAGE = 12;
/** Anexo I oficial: hoja apaisada A4 */
const PAGE_LEFT = 28;
const PAGE_TOP = 20;
const PAGE_BOTTOM = 595.28 - 16;
const PAGE_WIDTH = 841.89 - PAGE_LEFT * 2;

const TITLE_H = 16;
const HEADER_FIELD_H = 20;
const PUESTO_BOX_H = 46;
const TABLE_HEADER_H = 26;
const ROW_H = 24;
const INFO_BOX_H = 32;
const INFO_GAP = 4;

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

  // lineBreak:false evita que PDFKit cree páginas extras al desbordar celdas
  doc
    .font(opts?.bold ? "Helvetica-Bold" : "Helvetica")
    .fontSize(fontSize)
    .fillColor("#000000")
    .text(text, x + padding, textY, {
      width: w - padding * 2,
      height: h - padding,
      align: opts?.align ?? "left",
      lineBreak: false,
      ellipsis: true,
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
  while (paddedItems.length === 0 || paddedItems.length % ROWS_PER_PAGE !== 0) {
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

function drawBorderedLabelValue(
  doc: InstanceType<typeof PDFDocument>,
  x: number,
  y: number,
  w: number,
  h: number,
  label: string,
  value: string,
  opts?: { labelSize?: number; valueSize?: number },
) {
  drawCellBorder(doc, x, y, w, h);
  const labelSize = opts?.labelSize ?? 7;
  const valueSize = opts?.valueSize ?? 8;
  doc
    .font("Helvetica-Bold")
    .fontSize(labelSize)
    .fillColor("#000000")
    .text(label, x + 4, y + 3, { width: w - 8, lineBreak: false });
  const labelW = Math.min(doc.widthOfString(label) + 4, w * 0.55);
  doc
    .font("Helvetica")
    .fontSize(valueSize)
    .text(value || "", x + 4 + labelW, y + 3, {
      width: Math.max(24, w - labelW - 10),
      lineBreak: false,
      ellipsis: true,
    });
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
    118,
    100,
    78,
    88,
    48,
    72,
    PAGE_WIDTH - (22 + 118 + 100 + 78 + 88 + 48 + 72),
  ];

  let y = PAGE_TOP;

  doc.rect(PAGE_LEFT, y, PAGE_WIDTH, TITLE_H).fill("#000000");
  doc
    .fillColor("#ffffff")
    .font("Helvetica-Bold")
    .fontSize(9.5)
    .text(
      "ENTREGA DE ROPA DE TRABAJO Y ELEMENTOS DE PROTECCIÓN PERSONAL",
      PAGE_LEFT,
      y + 3.5,
      { width: PAGE_WIDTH, align: "center", lineBreak: false },
    );
  doc.fillColor("#000000");
  y += TITLE_H;

  const razonW = PAGE_WIDTH * 0.72;
  const cuitW = PAGE_WIDTH - razonW;
  drawBorderedLabelValue(
    doc,
    PAGE_LEFT,
    y,
    razonW,
    HEADER_FIELD_H,
    "Razón Social: ",
    data.empresa.razon_social,
  );
  drawBorderedLabelValue(
    doc,
    PAGE_LEFT + razonW,
    y,
    cuitW,
    HEADER_FIELD_H,
    "C.U.I.T.: ",
    data.empresa.cuit,
  );
  y += HEADER_FIELD_H;

  const dirW = PAGE_WIDTH * 0.4;
  const locW = PAGE_WIDTH * 0.25;
  const cpW = PAGE_WIDTH * 0.12;
  const provW = PAGE_WIDTH - dirW - locW - cpW;
  drawBorderedLabelValue(
    doc,
    PAGE_LEFT,
    y,
    dirW,
    HEADER_FIELD_H,
    "Dirección: ",
    data.empresa.domicilio || "",
  );
  drawBorderedLabelValue(
    doc,
    PAGE_LEFT + dirW,
    y,
    locW,
    HEADER_FIELD_H,
    "Localidad: ",
    data.empresa.localidad || "",
  );
  drawBorderedLabelValue(
    doc,
    PAGE_LEFT + dirW + locW,
    y,
    cpW,
    HEADER_FIELD_H,
    "C.P.: ",
    data.empresa.codigo_postal || "",
  );
  drawBorderedLabelValue(
    doc,
    PAGE_LEFT + dirW + locW + cpW,
    y,
    provW,
    HEADER_FIELD_H,
    "Provincia: ",
    data.empresa.provincia || "",
  );
  y += HEADER_FIELD_H;

  const nombreW = PAGE_WIDTH * 0.78;
  const dniW = PAGE_WIDTH - nombreW;
  drawBorderedLabelValue(
    doc,
    PAGE_LEFT,
    y,
    nombreW,
    HEADER_FIELD_H,
    "Nombre y Apellido del Trabajador: ",
    data.empleado.nombre,
  );
  drawBorderedLabelValue(
    doc,
    PAGE_LEFT + nombreW,
    y,
    dniW,
    HEADER_FIELD_H,
    "D.N.I.: ",
    data.empleado.dni,
  );
  y += HEADER_FIELD_H;

  const halfW = PAGE_WIDTH / 2;
  drawCellBorder(doc, PAGE_LEFT, y, halfW, PUESTO_BOX_H);
  drawCellBorder(doc, PAGE_LEFT + halfW, y, halfW, PUESTO_BOX_H);

  // clip: el texto largo no debe empujar a PDFKit a crear páginas
  doc.save();
  doc.rect(PAGE_LEFT, y, halfW, PUESTO_BOX_H).clip();
  doc.font("Helvetica-Bold").fontSize(6).fillColor("#000000");
  doc.text(
    "Descripción breve del puesto/s de trabajo en el/los cuales se desempeña el trabajador:",
    PAGE_LEFT + 4,
    y + 2,
    { width: halfW - 8, height: 14 },
  );
  doc.font("Helvetica").fontSize(7.5);
  doc.text(data.empleado.puesto || "", PAGE_LEFT + 4, y + 18, {
    width: halfW - 8,
    height: PUESTO_BOX_H - 22,
  });
  doc.restore();

  doc.save();
  doc.rect(PAGE_LEFT + halfW, y, halfW, PUESTO_BOX_H).clip();
  doc.font("Helvetica-Bold").fontSize(6).fillColor("#000000");
  doc.text(
    "Elementos de protección personal, necesarios para el trabajador, según el puesto de trabajo:",
    PAGE_LEFT + halfW + 4,
    y + 2,
    { width: halfW - 8, height: 14 },
  );
  doc.font("Helvetica").fontSize(7.5);
  doc.text(data.empleado.epp_necesarios || "", PAGE_LEFT + halfW + 4, y + 18, {
    width: halfW - 8,
    height: PUESTO_BOX_H - 22,
  });
  doc.restore();
  y += PUESTO_BOX_H;

  const tableTop = y;
  doc.rect(PAGE_LEFT, tableTop, PAGE_WIDTH, TABLE_HEADER_H).fill("#d1d5db");
  doc.fillColor("#000000");

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
    drawCellBorder(doc, x, tableTop, colWidths[i], TABLE_HEADER_H);
    drawCellText(doc, x, tableTop, colWidths[i], TABLE_HEADER_H, header, {
      bold: true,
      align: "center",
      fontSize: 6.5,
      valign: "middle",
    });
    x += colWidths[i];
  });

  // Caber filas + caja de info sin desbordar (PDFKit no debe auto-paginar)
  const rowsBudget = Math.max(
    1,
    Math.floor(
      (PAGE_BOTTOM - (tableTop + TABLE_HEADER_H) - INFO_GAP - INFO_BOX_H) / ROW_H,
    ),
  );
  const rowsToDraw = pageItems.slice(0, Math.min(pageItems.length, rowsBudget));

  let rowY = tableTop + TABLE_HEADER_H;
  rowsToDraw.forEach((item, idx) => {
    const globalIdx = pageIndex * ROWS_PER_PAGE + idx;
    x = PAGE_LEFT;

    const cells = [
      String(globalIdx + 1),
      item.epp_tipos?.nombre || "",
      item.modelo || "",
      item.marca || "",
      item.cantidad > 0 || item.epp_tipos?.nombre
        ? formatCertificacion(item.certificacion)
        : "",
      item.cantidad > 0 ? String(item.cantidad) : "",
      item.fecha_entrega ? formatLocalDate(item.fecha_entrega) : "",
    ];

    cells.forEach((cell, i) => {
      drawCellBorder(doc, x, rowY, colWidths[i], ROW_H);
      drawCellText(doc, x, rowY, colWidths[i], ROW_H, cell, {
        align: i === 0 || i === 5 ? "center" : "left",
        fontSize: 7,
        valign: "middle",
      });
      x += colWidths[i];
    });

    const firmaColX = x;
    drawCellBorder(doc, firmaColX, rowY, colWidths[7], ROW_H);

    const sigBuf =
      globalIdx < signatureBuffers.length ? signatureBuffers[globalIdx] : null;
    if (sigBuf && (item.epp_tipos?.nombre || item.cantidad > 0)) {
      drawSignatureInCell(doc, sigBuf, firmaColX, rowY, colWidths[7], ROW_H);
    }

    rowY += ROW_H;
  });

  const infoY = rowY + INFO_GAP;
  if (infoY + INFO_BOX_H <= PAGE_BOTTOM) {
    drawCellBorder(doc, PAGE_LEFT, infoY, PAGE_WIDTH, INFO_BOX_H);
    doc.save();
    doc.rect(PAGE_LEFT, infoY, PAGE_WIDTH, INFO_BOX_H).clip();
    doc.font("Helvetica-Bold").fontSize(8).fillColor("#000000");
    doc.text("Información adicional:", PAGE_LEFT + 4, infoY + 3, {
      lineBreak: false,
    });
    doc.font("Helvetica").fontSize(7.5).text(
      data.informacion_adicional || "",
      PAGE_LEFT + 4,
      infoY + 14,
      {
        width: PAGE_WIDTH - 8,
        height: INFO_BOX_H - 18,
      },
    );
    doc.restore();
  }

  // Evitar que el cursor interno de PDFKit quede bajo el margen y dispare otra página
  doc.x = PAGE_LEFT;
  doc.y = PAGE_TOP;
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
        // margins 0: PDFKit no auto-pagina por bottom margin mientras dibujamos celdas
        const doc = new PDFDocument({
          size: "A4",
          layout: "landscape",
          margins: { top: 0, bottom: 0, left: 0, right: 0 },
          autoFirstPage: true,
        });

        // Bloquear saltos automáticos de PDFKit (texto/firma que rozan el borde)
        let allowPageBreak = true;
        const nativeAddPage = doc.addPage.bind(doc);
        doc.addPage = ((...args: Parameters<typeof doc.addPage>) => {
          if (!allowPageBreak) return doc;
          return nativeAddPage(...args);
        }) as typeof doc.addPage;

        const chunks: Buffer[] = [];
        doc.on("data", (chunk: Buffer) => chunks.push(chunk));
        doc.on("end", () => resolve(Buffer.concat(chunks)));

        let isFirstPage = true;
        for (const planilla of prepared) {
          for (let pageIndex = 0; pageIndex < planilla.pages.length; pageIndex++) {
            if (!isFirstPage) {
              allowPageBreak = true;
              doc.addPage();
            }
            isFirstPage = false;
            allowPageBreak = false;
            drawPlanillaPage(
              doc,
              planilla,
              planilla.pages[pageIndex],
              pageIndex,
            );
          }
        }

        allowPageBreak = true;
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

  /** @deprecated Usar generarPlanillaAnexoI o generarConstanciaInterna */
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
    // Constancia interna: sin firma de responsable/empleador.
    return this.generarConstanciaInterna({
      empresa: data.empresa,
      consultora: data.consultora,
      empleado: {
        nombre: data.empleado.nombre,
        dni: data.empleado.dni,
        sector: null,
      },
      items,
      fecha: data.fecha,
      firmaUrl: data.firmaUrl,
    });
  },

  /**
   * Constancia interna de la empresa (descarga desde Entregas).
   * No incluye firma del responsable/empleador — el registro oficial Anexo I
   * se obtiene desde Base histórica.
   */
  async generarConstanciaInterna(data: {
    empresa: {
      razon_social: string;
      cuit: string;
      actividad?: string | null;
      logo_url?: string | null;
    };
    consultora?: {
      nombre?: string | null;
      logo_url?: string | null;
    } | null;
    empleado: {
      nombre: string;
      dni: string;
      sector?: string | null;
    };
    items: EppPdfItem[];
    fecha: string;
    firmaUrl?: string | null;
    firmaBuffer?: Buffer | null;
  }): Promise<Buffer> {
    const [signatureBuffer, logoEmpresa, logoConsultora] = await Promise.all([
      data.firmaBuffer
        ? Promise.resolve(data.firmaBuffer)
        : data.firmaUrl
          ? storageService.downloadBuffer(data.firmaUrl)
          : Promise.resolve(null),
      data.empresa.logo_url
        ? storageService.downloadBuffer(data.empresa.logo_url)
        : Promise.resolve(null),
      data.consultora?.logo_url
        ? storageService.downloadBuffer(data.consultora.logo_url)
        : Promise.resolve(null),
    ]);

    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({
          size: "A4",
          margins: { top: 40, bottom: 40, left: 50, right: 50 },
        });

        const chunks: Buffer[] = [];
        doc.on("data", (chunk: Buffer) => chunks.push(chunk));
        doc.on("end", () => resolve(Buffer.concat(chunks)));

        const pageWidth = 595.28 - 100;

        if (logoConsultora) {
          try {
            doc.image(logoConsultora, 50, 28, { fit: [80, 40] });
          } catch {
            // ignore invalid image
          }
        }
        if (logoEmpresa) {
          try {
            doc.image(logoEmpresa, 465, 28, { fit: [80, 40], align: "right" });
          } catch {
            // ignore invalid image
          }
        }

        doc
          .fontSize(12)
          .font("Helvetica-Bold")
          .fillColor("#1e3a8a")
          .text(
            "CONSTANCIA DE ENTREGA DE ELEMENTOS DE PROTECCIÓN PERSONAL",
            50,
            78,
            { width: pageWidth, align: "left" },
          );

        doc
          .fontSize(9)
          .font("Helvetica-Oblique")
          .fillColor("#475569")
          .text("Resolución SRT N° 299/11 - Anexo I", 50, doc.y + 2);

        if (data.consultora?.nombre) {
          doc
            .fontSize(8)
            .font("Helvetica")
            .fillColor("#64748b")
            .text(data.consultora.nombre, 50, doc.y + 2);
        }

        doc.moveDown(1.2);
        const sectionLineY = doc.y;
        doc
          .moveTo(50, sectionLineY)
          .lineTo(50 + pageWidth, sectionLineY)
          .lineWidth(1)
          .stroke("#cbd5e1");
        doc.moveDown(1);

        const labelWidth = 120;
        const valueX = 50 + labelWidth;

        doc
          .fontSize(10)
          .font("Helvetica-Bold")
          .fillColor("#0f172a")
          .text("DATOS DEL EMPLEADOR");
        doc.moveDown(0.3);

        const writeRow = (label: string, value: string) => {
          doc
            .font("Helvetica-Bold")
            .fontSize(9)
            .fillColor("#334155")
            .text(label, 50, doc.y, { width: labelWidth });
          doc
            .font("Helvetica")
            .fillColor("#0f172a")
            .text(value, valueX, doc.y - doc.currentLineHeight(), {
              width: pageWidth - labelWidth,
            });
          doc.moveDown(0.2);
        };

        writeRow("Razón Social:", data.empresa.razon_social);
        writeRow("C.U.I.T.:", data.empresa.cuit);
        writeRow("Actividad:", data.empresa.actividad || "N/A");

        doc.moveDown(1);
        doc
          .fontSize(10)
          .font("Helvetica-Bold")
          .fillColor("#0f172a")
          .text("DATOS DEL TRABAJADOR");
        doc.moveDown(0.3);
        writeRow("Nombre y Apellido:", data.empleado.nombre);
        writeRow("D.N.I.:", data.empleado.dni);
        if (data.empleado.sector) {
          writeRow("Sector:", data.empleado.sector);
        }

        doc.moveDown(1.2);
        doc
          .fontSize(10)
          .font("Helvetica-Bold")
          .fillColor("#0f172a")
          .text("ELEMENTOS DE PROTECCIÓN PERSONAL ENTREGADOS");
        doc.moveDown(0.5);

        const tableTop = doc.y;
        const colWidths = [28, 150, 36, 90, 90, 101];
        const colHeaders = [
          "N°",
          "Elemento",
          "Cant.",
          "Marca / Modelo",
          "Certificación",
          "Fecha",
        ];

        doc.rect(50, tableTop - 3, 495, 18).fill("#1e3a8a");

        let xPos = 50;
        doc.fontSize(7.5).font("Helvetica-Bold");
        colHeaders.forEach((header, i) => {
          doc.fillColor("#ffffff").text(header, xPos + 2, tableTop, {
            width: colWidths[i] - 4,
            align: i === 0 || i === 2 ? "center" : "left",
          });
          xPos += colWidths[i];
        });

        let rowY = tableTop + 18;
        data.items.forEach((item, idx) => {
          const rowBg = idx % 2 === 0 ? "#f8fafc" : "#ffffff";
          doc.rect(50, rowY - 2, 495, 18).fill(rowBg);
          doc.fillColor("#0f172a").fontSize(7.5).font("Helvetica");
          xPos = 50;
          const marcaModelo = [item.marca, item.modelo]
            .filter(Boolean)
            .join(" / ");
          const rowData = [
            String(idx + 1),
            item.epp_tipos?.nombre || "N/A",
            String(item.cantidad),
            marcaModelo || "N/A",
            item.certificacion || "N/A",
            formatLocalDate(item.fecha_entrega),
          ];
          rowData.forEach((cell, i) => {
            doc.text(cell, xPos + 2, rowY, {
              width: colWidths[i] - 4,
              align: i === 0 || i === 2 ? "center" : "left",
            });
            xPos += colWidths[i];
          });
          rowY += 18;
        });

        doc
          .rect(50, tableTop - 3, 495, rowY - tableTop + 3)
          .lineWidth(0.7)
          .stroke("#cbd5e1");

        doc.y = rowY + 15;
        doc
          .fontSize(7.5)
          .font("Helvetica-Oblique")
          .fillColor("#475569")
          .text(
            "Se deja constancia que los elementos de protección personal arriba mencionados fueron entregados al trabajador, " +
              "quien se compromete a utilizarlos durante el desarrollo de las tareas asignadas, conforme a las indicaciones recibidas " +
              "en relación a su correcto uso, mantenimiento y conservación (Resolución SRT N° 299/2011).",
            50,
            doc.y,
            { width: pageWidth, align: "justify", lineGap: 2 },
          );

        doc.moveDown(2);
        const firmaY = Math.max(doc.y, 620);
        const firmaWidth = pageWidth;

        if (signatureBuffer) {
          try {
            doc.image(
              signatureBuffer,
              50 + (firmaWidth - 140) / 2,
              firmaY - 15,
              { width: 140, height: 50 },
            );
          } catch {
            // ignore
          }
        }

        doc.fillColor("#0f172a").font("Helvetica").fontSize(9);
        doc.text("________________________", 50, firmaY + 35, {
          width: firmaWidth,
          align: "center",
        });
        doc.text("Firma del Trabajador", 50, firmaY + 50, {
          width: firmaWidth,
          align: "center",
        });
        doc.font("Helvetica-Bold").text(data.empleado.nombre, 50, firmaY + 63, {
          width: firmaWidth,
          align: "center",
        });
        doc
          .font("Helvetica")
          .text(`DNI: ${data.empleado.dni}`, 50, firmaY + 75, {
            width: firmaWidth,
            align: "center",
          });

        doc.y = firmaY + 100;
        doc
          .fontSize(8)
          .font("Helvetica")
          .fillColor("#64748b")
          .text(`Fecha de emisión: ${formatLocalDate(data.fecha)}`, 50, doc.y, {
            align: "right",
            width: pageWidth,
          });

        doc.end();
      } catch (err) {
        reject(err);
      }
    });
  },
};
