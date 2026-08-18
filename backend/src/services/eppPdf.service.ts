import PDFDocument from "pdfkit";

export interface EppPdfItem {
  epp_tipos?: { nombre: string; descripcion?: string | null } | null;
  cantidad: number;
  marca?: string | null;
  modelo?: string | null;
  certificacion?: string | null;
  fecha_entrega: string;
}

export interface EppPdfData {
  empresa: {
    razon_social: string;
    cuit: string;
    actividad: string | null;
    logo_url?: string | null;
  };
  consultora?: {
    nombre?: string | null;
    logo_url?: string | null;
  } | null;
  empleado: { nombre: string; dni: string; sector?: string | null };
  items: EppPdfItem[];
  fecha: string;
  firmaUrl: string | null;
  firmaEmpleadorUrl?: string | null;
  preventorNombre?: string | null;
}

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

async function fetchBuffer(url: string | null | undefined): Promise<Buffer | null> {
  if (!url) return null;
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    return Buffer.from(await response.arrayBuffer());
  } catch {
    return null;
  }
}

export const eppPdfService = {
  async generarConstanciaSRT299(data: EppPdfData): Promise<Buffer> {
    const [signatureBuffer, employerSigBuffer, logoEmpresa, logoConsultora] =
      await Promise.all([
        fetchBuffer(data.firmaUrl),
        fetchBuffer(data.firmaEmpleadorUrl ?? null),
        fetchBuffer(data.empresa.logo_url),
        fetchBuffer(data.consultora?.logo_url),
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
          .text("CONSTANCIA DE ENTREGA DE ELEMENTOS DE PROTECCIÓN PERSONAL", 50, 78, {
            width: pageWidth,
            align: "left",
          });

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

        doc.fontSize(10).font("Helvetica-Bold").fillColor("#0f172a").text("DATOS DEL EMPLEADOR");
        doc.moveDown(0.3);

        const writeRow = (label: string, value: string) => {
          doc.font("Helvetica-Bold").fontSize(9).fillColor("#334155").text(label, 50, doc.y, {
            width: labelWidth,
          });
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
        doc.fontSize(10).font("Helvetica-Bold").fillColor("#0f172a").text("DATOS DEL TRABAJADOR");
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
        const colWidths = [28, 130, 36, 80, 80, 70, 71];
        const colHeaders = [
          "N°",
          "Elemento",
          "Cant.",
          "Marca",
          "Modelo",
          "Certificación",
          "Fecha",
        ];

        doc.rect(50, tableTop - 3, 495, 18).fill("#1e3a8a");

        let xPos = 50;
        doc.fontSize(7.5).font("Helvetica-Bold");
        colHeaders.forEach((header, i) => {
          doc
            .fillColor("#ffffff")
            .text(header, xPos + 2, tableTop, {
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
          const rowData = [
            String(idx + 1),
            item.epp_tipos?.nombre || "N/A",
            String(item.cantidad),
            item.marca || "N/A",
            item.modelo || "N/A",
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
        const firmaWidth = pageWidth / 2 - 20;

        if (signatureBuffer) {
          try {
            doc.image(signatureBuffer, 50 + (firmaWidth - 110) / 2, firmaY - 15, {
              width: 110,
              height: 45,
            });
          } catch {
            // ignore
          }
        }

        doc.fillColor("#0f172a").font("Helvetica").fontSize(9);
        doc.text("________________________", 50, firmaY + 30, {
          width: firmaWidth,
          align: "center",
        });
        doc.text("Firma del Trabajador", 50, firmaY + 45, {
          width: firmaWidth,
          align: "center",
        });
        doc.font("Helvetica-Bold").text(data.empleado.nombre, 50, firmaY + 58, {
          width: firmaWidth,
          align: "center",
        });
        doc.font("Helvetica").text(`DNI: ${data.empleado.dni}`, 50, firmaY + 70, {
          width: firmaWidth,
          align: "center",
        });

        const rightX = 50 + firmaWidth + 40;
        if (employerSigBuffer) {
          try {
            doc.image(employerSigBuffer, rightX + (firmaWidth - 110) / 2, firmaY - 15, {
              width: 110,
              height: 45,
            });
          } catch {
            // ignore
          }
        }
        doc.text("________________________", rightX, firmaY + 30, {
          width: firmaWidth,
          align: "center",
        });
        doc.text("Firma del Responsable / Empleador", rightX, firmaY + 45, {
          width: firmaWidth,
          align: "center",
        });
        if (data.preventorNombre) {
          doc.font("Helvetica-Bold").text(data.preventorNombre, rightX, firmaY + 58, {
            width: firmaWidth,
            align: "center",
          });
        }

        doc.y = firmaY + 95;
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
