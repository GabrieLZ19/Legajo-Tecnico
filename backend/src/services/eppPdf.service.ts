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

export const eppPdfService = {
  async generarPlanillaAnexoI(data: EppPdfData): Promise<Buffer> {
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

    const colWidths = [24, 98, 80, 64, 72, 40, 64, PAGE_WIDTH - (24 + 98 + 80 + 64 + 72 + 40 + 64)];
    const rowH = 34;
    const headerRowH = 36;

    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({
          size: "A4",
          margins: { top: 28, bottom: 28, left: PAGE_LEFT, right: PAGE_LEFT },
        });

        const chunks: Buffer[] = [];
        doc.on("data", (chunk: Buffer) => chunks.push(chunk));
        doc.on("end", () => resolve(Buffer.concat(chunks)));

        pages.forEach((pageItems, pageIndex) => {
          if (pageIndex > 0) doc.addPage();

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
            PAGE_WIDTH * 0.42,
          );
          drawLabeledValue(
            doc,
            "Localidad: ",
            data.empresa.localidad || "",
            PAGE_LEFT + PAGE_WIDTH * 0.42,
            y,
            PAGE_WIDTH * 0.28,
          );
          drawLabeledValue(
            doc,
            "C.P.: ",
            data.empresa.codigo_postal || "",
            PAGE_LEFT + PAGE_WIDTH * 0.7,
            y,
            PAGE_WIDTH * 0.14,
          );
          y += 14;

          drawLabeledValue(
            doc,
            "Provincia: ",
            data.empresa.provincia || "",
            PAGE_LEFT,
            y,
            PAGE_WIDTH * 0.45,
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
            "Elementos de protección personal necesarios según el puesto de trabajo:",
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
            "Certificación SI // NO",
            "Cant.",
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
              globalIdx < signatureBuffers.length
                ? signatureBuffers[globalIdx]
                : null;
            if (sigBuf) {
              drawSignatureInCell(
                doc,
                sigBuf,
                firmaColX,
                rowY,
                colWidths[7],
                rowH,
              );
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
        });

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
