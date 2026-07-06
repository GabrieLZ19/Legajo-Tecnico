import PDFDocument from "pdfkit";

interface EppPdfData {
  empresa: { razon_social: string; cuit: string; actividad: string; logo_url?: string | null };
  empleado: { nombre: string; dni: string };
  items: Array<{
    epp_tipos?: { nombre: string; descripcion?: string } | null;
    cantidad: number;
    marca?: string;
    modelo?: string;
    certificacion?: string;
    fecha_entrega: string;
  }>;
  fecha: string;
  firmaUrl: string | null;
}

const formatLocalDate = (dateInput: any): string => {
  if (!dateInput) return "";
  const dateStr = typeof dateInput === "string" ? dateInput : new Date(dateInput).toISOString();
  const datePart = dateStr.split("T")[0];
  const parts = datePart.split("-");
  if (parts.length === 3) {
    const [year, month, day] = parts;
    return `${parseInt(day)}/${parseInt(month)}/${year}`;
  }
  return new Date(dateInput).toLocaleDateString("es-AR");
};

export const eppPdfService = {
  /**
   * Genera el PDF de Constancia de Entrega de EPP según Res. SRT 299/11
   */
  async generarConstanciaSRT299(data: EppPdfData): Promise<Buffer> {
    // 1. Descargar recursos (firma y logo de empresa si existen) de manera asíncrona antes de iniciar el PDFDocument
    let signatureBuffer: Buffer | null = null;
    if (data.firmaUrl) {
      try {
        const response = await fetch(data.firmaUrl);
        if (response.ok) {
          const arrayBuffer = await response.arrayBuffer();
          signatureBuffer = Buffer.from(arrayBuffer);
        }
      } catch (err) {
        console.error("Error al descargar firma para PDF:", err);
      }
    }

    let logoBuffer: Buffer | null = null;
    if (data.empresa.logo_url) {
      try {
        const response = await fetch(data.empresa.logo_url);
        if (response.ok) {
          const arrayBuffer = await response.arrayBuffer();
          logoBuffer = Buffer.from(arrayBuffer);
        }
      } catch (err) {
        console.error("Error al descargar logo para PDF:", err);
      }
    }

    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({
          size: "A4",
          margins: { top: 40, bottom: 40, left: 50, right: 50 },
        });

        const chunks: Buffer[] = [];
        doc.on("data", (chunk: Buffer) => chunks.push(chunk));
        doc.on("end", () => resolve(Buffer.concat(chunks)));

        const pageWidth = 595.28 - 100; // Ancho A4 (595.28) menos márgenes izq y der (100)

        // ── Logo (si existe) y Encabezado Oficial ──
        if (logoBuffer) {
          try {
            doc.image(logoBuffer, 465, 30, { fit: [80, 40], align: "right" });
          } catch (err) {
            console.error("Error al incrustar logo en PDF:", err);
          }
        }

        // Título del formulario
        doc
          .fontSize(12)
          .font("Helvetica-Bold")
          .fillColor("#1e3a8a")
          .text("CONSTANCIA DE ENTREGA DE ELEMENTOS DE PROTECCIÓN PERSONAL", 50, 40, {
            width: pageWidth - 90,
            align: "left",
          });
        
        doc
          .fontSize(9)
          .font("Helvetica-Oblique")
          .fillColor("#475569")
          .text("Resolución SRT N° 299/11 - Anexo I", 50, doc.y + 2);

        doc.moveDown(1.5);
        
        const sectionLineY = doc.y;
        doc.moveTo(50, sectionLineY).lineTo(50 + pageWidth, sectionLineY).lineWidth(1).stroke("#cbd5e1");
        doc.moveDown(1);

        const labelWidth = 120;
        const valueX = 50 + labelWidth;

        // ── Datos del empleador ──
        doc
          .fontSize(10)
          .font("Helvetica-Bold")
          .fillColor("#0f172a")
          .text("DATOS DEL EMPLEADOR");
        doc.moveDown(0.3);

        // Razón Social
        doc.font("Helvetica-Bold").fontSize(9).fillColor("#334155").text("Razón Social:", 50, doc.y, { width: labelWidth });
        doc.font("Helvetica").fillColor("#0f172a").text(data.empresa.razon_social, valueX, doc.y - doc.currentLineHeight(), { width: pageWidth - labelWidth });
        doc.moveDown(0.2);

        // CUIT
        doc.font("Helvetica-Bold").fillColor("#334155").text("C.U.I.T.:", 50, doc.y, { width: labelWidth });
        doc.font("Helvetica").fillColor("#0f172a").text(data.empresa.cuit, valueX, doc.y - doc.currentLineHeight(), { width: pageWidth - labelWidth });
        doc.moveDown(0.2);

        // Actividad
        doc.font("Helvetica-Bold").fillColor("#334155").text("Actividad:", 50, doc.y, { width: labelWidth });
        doc.font("Helvetica").fillColor("#0f172a").text(data.empresa.actividad || "N/A", valueX, doc.y - doc.currentLineHeight(), { width: pageWidth - labelWidth });

        doc.moveDown(1.2);

        // ── Datos del trabajador ──
        doc
          .fontSize(10)
          .font("Helvetica-Bold")
          .fillColor("#0f172a")
          .text("DATOS DEL TRABAJADOR");
        doc.moveDown(0.3);

        // Nombre y Apellido
        doc.font("Helvetica-Bold").fontSize(9).fillColor("#334155").text("Nombre y Apellido:", 50, doc.y, { width: labelWidth });
        doc.font("Helvetica").fillColor("#0f172a").text(data.empleado.nombre, valueX, doc.y - doc.currentLineHeight(), { width: pageWidth - labelWidth });
        doc.moveDown(0.2);

        // DNI
        doc.font("Helvetica-Bold").fillColor("#334155").text("D.N.I.:", 50, doc.y, { width: labelWidth });
        doc.font("Helvetica").fillColor("#0f172a").text(data.empleado.dni, valueX, doc.y - doc.currentLineHeight(), { width: pageWidth - labelWidth });

        doc.moveDown(1.5);

        // ── Tabla de EPP entregados ──
        doc
          .fontSize(10)
          .font("Helvetica-Bold")
          .fillColor("#0f172a")
          .text("ELEMENTOS DE PROTECCIÓN PERSONAL ENTREGADOS");
        doc.moveDown(0.5);

        // Encabezados de la tabla
        const tableTop = doc.y;
        const colWidths = [30, 165, 40, 90, 90, 80]; // N°, EPP, Cant, Marca/Modelo, Certif, Fecha = 495 total width
        const colHeaders = ["N°", "Elemento de Protección Personal", "Cant.", "Marca / Modelo", "Certificación", "Fecha"];

        // Dibujar fondo de encabezado
        doc
          .rect(50, tableTop - 3, 495, 18)
          .fill("#1e3a8a");

        // Texto de encabezados
        let xPos = 50;
        doc.fontSize(8).font("Helvetica-Bold");
        colHeaders.forEach((header, i) => {
          doc
            .fillColor("#ffffff")
            .text(header, xPos + 3, tableTop, { width: colWidths[i] - 6, align: i === 0 || i === 2 ? "center" : "left" });
          xPos += colWidths[i];
        });

        doc.fillColor("#000000");
        let rowY = tableTop + 18;

        // Filas de datos
        data.items.forEach((item, idx) => {
          const rowBg = idx % 2 === 0 ? "#f8fafc" : "#ffffff";
          doc.rect(50, rowY - 2, 495, 18).fill(rowBg);

          doc.fillColor("#0f172a").fontSize(8).font("Helvetica");
          xPos = 50;

          const rowData = [
            String(idx + 1),
            item.epp_tipos?.nombre || "N/A",
            String(item.cantidad),
            [item.marca, item.modelo].filter(Boolean).join(" / ") || "N/A",
            item.certificacion || "N/A",
            formatLocalDate(item.fecha_entrega),
          ];

          rowData.forEach((cell, i) => {
            doc.text(cell, xPos + 3, rowY, {
              width: colWidths[i] - 6,
              align: i === 0 || i === 2 ? "center" : "left",
            });
            xPos += colWidths[i];
          });

          rowY += 18;
        });

        // Borde exterior de la tabla
        doc
          .rect(50, tableTop - 3, 495, rowY - tableTop + 3)
          .lineWidth(0.7)
          .stroke("#cbd5e1");

        doc.y = rowY + 15;

        // ── Nota legal obligatoria SRT 299/11 ──
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
            { width: pageWidth, align: "justify", lineGap: 2 }
          );

        doc.moveDown(2);

        // ── Bloque de firmas ──
        const firmaY = doc.y;
        const firmaWidth = pageWidth / 2 - 20;

        // Dibujar firma del trabajador (imagen) si existe
        if (signatureBuffer) {
          try {
            // Posicionarla exactamente arriba de la línea del trabajador
            doc.image(signatureBuffer, 50 + (firmaWidth - 110) / 2, firmaY - 15, {
              width: 110,
              height: 45,
            });
          } catch (imgErr) {
            console.error("Error al insertar imagen de firma en PDF:", imgErr);
          }
        }

        // Firma del trabajador (texto y línea)
        doc.fillColor("#0f172a").font("Helvetica").fontSize(9);
        doc.text("________________________", 50, firmaY + 30, { width: firmaWidth, align: "center" });
        doc.text("Firma del Trabajador", 50, firmaY + 45, { width: firmaWidth, align: "center" });
        doc.font("Helvetica-Bold").text(data.empleado.nombre, 50, firmaY + 58, { width: firmaWidth, align: "center" });
        doc.font("Helvetica").text(`DNI: ${data.empleado.dni}`, 50, firmaY + 70, { width: firmaWidth, align: "center" });

        // Firma del empleador (derecha)
        const rightX = 50 + firmaWidth + 40;
        doc.text("________________________", rightX, firmaY + 30, { width: firmaWidth, align: "center" });
        doc.text("Firma del Responsable / Empleador", rightX, firmaY + 45, { width: firmaWidth, align: "center" });

        // Fecha de emisión al pie de página
        doc.y = firmaY + 95;
        doc
          .fontSize(8)
          .font("Helvetica")
          .fillColor("#64748b")
          .text(
            `Fecha de emisión: ${formatLocalDate(data.fecha)}`,
            50,
            doc.y,
            { align: "right", width: pageWidth }
          );

        doc.end();
      } catch (err) {
        reject(err);
      }
    });
  },
};
