import ExcelJS from "exceljs";
import PDFDocument from "pdfkit";
import { storageService } from "./storage.service";

export type RegistroAsistente = {
  nombre_empleado?: string | null;
  documento?: string | null;
  firma_url?: string | null;
};

export type RegistroCapacitacionData = {
  titulo: string;
  fecha?: string | null;
  instructor?: string | null;
  fechas_horario?: string | null;
  cantidad_horas?: string | null;
  firma_capacitador_url?: string | null;
  aclaracion_capacitador?: string | null;
  firma_empresa_url?: string | null;
  aclaracion_empresa?: string | null;
  empresa?: {
    razon_social?: string | null;
    logo_url?: string | null;
  } | null;
  asistencias: RegistroAsistente[];
};

function splitFecha(fecha?: string | null): { dia: string; mes: string; anio: string } {
  if (!fecha) return { dia: "", mes: "", anio: "" };
  const d = new Date(fecha);
  if (Number.isNaN(d.getTime())) {
    const parts = fecha.split("T")[0]?.split("-") || [];
    return {
      anio: parts[0]?.slice(2) || parts[0] || "",
      mes: parts[1] || "",
      dia: parts[2] || "",
    };
  }
  return {
    dia: String(d.getDate()).padStart(2, "0"),
    mes: String(d.getMonth() + 1).padStart(2, "0"),
    anio: String(d.getFullYear()).slice(2),
  };
}

function detectImageExtension(
  buffer: Buffer,
  url?: string | null,
): "png" | "jpeg" {
  // PNG magic: 89 50 4E 47
  if (
    buffer.length >= 4 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47
  ) {
    return "png";
  }
  // JPEG magic: FF D8 FF
  if (
    buffer.length >= 3 &&
    buffer[0] === 0xff &&
    buffer[1] === 0xd8 &&
    buffer[2] === 0xff
  ) {
    return "jpeg";
  }
  const lower = (url || "").toLowerCase();
  if (lower.includes(".jpg") || lower.includes(".jpeg")) return "jpeg";
  return "png";
}

/**
 * Descarga imagen vía Storage admin (soporta buckets privados como firmas_digitales).
 */
async function fetchImageBuffer(
  url?: string | null,
): Promise<{ buffer: Buffer; extension: "png" | "jpeg" } | null> {
  if (!url) return null;
  try {
    const buffer = await storageService.downloadBuffer(url);
    if (!buffer || buffer.length === 0) return null;
    return { buffer, extension: detectImageExtension(buffer, url) };
  } catch {
    return null;
  }
}

const THIN = {
  style: "thin" as const,
  color: { argb: "FF000000" },
};

function boxBorder() {
  return { top: THIN, left: THIN, bottom: THIN, right: THIN };
}

/**
 * Genera un Excel (.xlsx) con formato "REGISTRO DE CAPACITACIÓN".
 */
export async function buildRegistroExcel(
  data: RegistroCapacitacionData,
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Legajo Técnico";
  const ws = wb.addWorksheet("REGISTRO", {
    pageSetup: {
      paperSize: 9,
      orientation: "portrait",
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      margins: {
        left: 0.4,
        right: 0.4,
        top: 0.4,
        bottom: 0.4,
        header: 0.2,
        footer: 0.2,
      },
    },
  });

  ws.columns = [
    { width: 28 },
    { width: 18 },
    { width: 14 },
    { width: 10 },
    { width: 8 },
    { width: 8 },
    { width: 8 },
  ];

  const { dia, mes, anio } = splitFecha(data.fecha);
  const minRows = Math.max(data.asistencias.length, 20);

  // Fila 1: Logo | Título | Día Mes Año
  ws.mergeCells("A1:A2");
  ws.mergeCells("B1:D2");
  ws.getCell("A1").border = boxBorder();
  ws.getCell("B1").value = "REGISTRO DE CAPACITACIÓN";
  ws.getCell("B1").font = { bold: true, size: 16, name: "Arial" };
  ws.getCell("B1").alignment = {
    horizontal: "center",
    vertical: "middle",
    wrapText: true,
  };
  ws.getCell("B1").border = boxBorder();

  ws.getCell("E1").value = "Día";
  ws.getCell("F1").value = "Mes";
  ws.getCell("G1").value = "Año";
  ["E1", "F1", "G1"].forEach((addr) => {
    const c = ws.getCell(addr);
    c.font = { bold: true, size: 9, name: "Arial" };
    c.alignment = { horizontal: "center", vertical: "middle" };
    c.border = boxBorder();
  });
  ws.getCell("E2").value = dia;
  ws.getCell("F2").value = mes;
  ws.getCell("G2").value = anio;
  ["E2", "F2", "G2"].forEach((addr) => {
    const c = ws.getCell(addr);
    c.font = { bold: true, size: 12, name: "Arial" };
    c.alignment = { horizontal: "center", vertical: "middle" };
    c.border = boxBorder();
  });
  ws.getRow(1).height = 18;
  ws.getRow(2).height = 22;

  const logo = await fetchImageBuffer(data.empresa?.logo_url);
  if (logo) {
    const imgId = wb.addImage({
      buffer: logo.buffer as any,
      extension: logo.extension,
    });
    ws.addImage(imgId, {
      tl: { col: 0.15, row: 0.15 },
      ext: { width: 70, height: 45 },
      editAs: "oneCell",
    });
  } else {
    ws.getCell("A1").value = "LOGO";
    ws.getCell("A1").alignment = { horizontal: "center", vertical: "middle" };
    ws.getCell("A1").font = { bold: true, size: 10, name: "Arial" };
  }

  // Filas de cabecera de datos
  const headerRows: Array<{ label: string; value: string; merge?: string }> = [
    {
      label: "ESTABLECIMIENTO:",
      value: data.empresa?.razon_social || "",
    },
    { label: "CAPACITACIÓN:", value: data.titulo || "" },
    { label: "INSTRUCTOR:", value: data.instructor || "" },
  ];

  let row = 3;
  for (const item of headerRows) {
    ws.mergeCells(`A${row}:B${row}`);
    ws.mergeCells(`C${row}:G${row}`);
    ws.getCell(`A${row}`).value = item.label;
    ws.getCell(`A${row}`).font = { bold: true, size: 10, name: "Arial" };
    ws.getCell(`A${row}`).border = boxBorder();
    ws.getCell(`C${row}`).value = item.value;
    ws.getCell(`C${row}`).font = { size: 10, name: "Arial" };
    ws.getCell(`C${row}`).border = boxBorder();
    ws.getRow(row).height = 20;
    row += 1;
  }

  // Fechas y horario | Cantidad de horas
  ws.mergeCells(`A${row}:B${row}`);
  ws.mergeCells(`C${row}:D${row}`);
  ws.mergeCells(`E${row}:F${row}`);
  ws.getCell(`A${row}`).value = "FECHAS Y HORARIO:";
  ws.getCell(`A${row}`).font = { bold: true, size: 10, name: "Arial" };
  ws.getCell(`A${row}`).border = boxBorder();
  ws.getCell(`C${row}`).value = data.fechas_horario || "";
  ws.getCell(`C${row}`).border = boxBorder();
  ws.getCell(`E${row}`).value = "CANTIDAD DE HORAS:";
  ws.getCell(`E${row}`).font = { bold: true, size: 9, name: "Arial" };
  ws.getCell(`E${row}`).border = boxBorder();
  ws.getCell(`G${row}`).value = data.cantidad_horas || "";
  ws.getCell(`G${row}`).border = boxBorder();
  ws.getCell(`G${row}`).alignment = { horizontal: "center", vertical: "middle" };
  ws.getRow(row).height = 20;
  row += 1;

  // Encabezados tabla
  const tableHeaderRow = row;
  ws.mergeCells(`A${row}:C${row}`);
  ws.mergeCells(`D${row}:E${row}`);
  ws.mergeCells(`F${row}:G${row}`);
  ws.getCell(`A${row}`).value = "APELLIDO Y NOMBRES";
  ws.getCell(`D${row}`).value = "LEGAJO o DNI";
  ws.getCell(`F${row}`).value = "FIRMA";
  ["A", "D", "F"].forEach((col) => {
    const c = ws.getCell(`${col}${row}`);
    c.font = { bold: true, size: 10, name: "Arial" };
    c.alignment = { horizontal: "center", vertical: "middle" };
    c.border = boxBorder();
    c.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFE5E7EB" },
    };
  });
  // borders on merged slaves
  ["B", "C", "E", "G"].forEach((col) => {
    ws.getCell(`${col}${row}`).border = boxBorder();
  });
  ws.getRow(row).height = 22;
  row += 1;

  const signatureImageIds: Array<{
    row: number;
    buffer: Buffer;
    extension: "png" | "jpeg";
  }> = [];

  for (let i = 0; i < minRows; i += 1) {
    const a = data.asistencias[i];
    ws.mergeCells(`A${row}:C${row}`);
    ws.mergeCells(`D${row}:E${row}`);
    ws.mergeCells(`F${row}:G${row}`);
    ws.getCell(`A${row}`).value = a?.nombre_empleado || "";
    ws.getCell(`D${row}`).value = a?.documento || "";
    ws.getCell(`F${row}`).value = a?.firma_url ? "" : "";
    ["A", "B", "C", "D", "E", "F", "G"].forEach((col) => {
      ws.getCell(`${col}${row}`).border = boxBorder();
    });
    ws.getCell(`A${row}`).font = { size: 10, name: "Arial" };
    ws.getCell(`D${row}`).font = { size: 10, name: "Arial" };
    ws.getCell(`D${row}`).alignment = {
      horizontal: "center",
      vertical: "middle",
    };
    ws.getRow(row).height = 28;

    if (a?.firma_url) {
      const img = await fetchImageBuffer(a.firma_url);
      if (img) signatureImageIds.push({ row, ...img });
    }
    row += 1;
  }

  for (const sig of signatureImageIds) {
    const imgId = wb.addImage({
      buffer: sig.buffer as any,
      extension: sig.extension,
    });
    ws.addImage(imgId, {
      tl: { col: 5.1, row: sig.row - 1 + 0.15 },
      ext: { width: 90, height: 22 },
      editAs: "oneCell",
    });
  }

  // Firmas finales (caja firma + título + aclaración)
  row += 1;
  const firmasBoxRow = row;
  ws.mergeCells(`A${firmasBoxRow}:C${firmasBoxRow + 1}`);
  ws.mergeCells(`D${firmasBoxRow}:G${firmasBoxRow + 1}`);
  ws.getRow(firmasBoxRow).height = 40;
  ws.getRow(firmasBoxRow + 1).height = 22;

  for (const col of ["A", "B", "C"]) {
    ws.getCell(`${col}${firmasBoxRow}`).border = {
      top: THIN,
      left: THIN,
      right: THIN,
    };
    ws.getCell(`${col}${firmasBoxRow + 1}`).border = {
      left: THIN,
      right: THIN,
      bottom: THIN,
    };
  }
  for (const col of ["D", "E", "F", "G"]) {
    ws.getCell(`${col}${firmasBoxRow}`).border = {
      top: THIN,
      left: THIN,
      right: THIN,
    };
    ws.getCell(`${col}${firmasBoxRow + 1}`).border = {
      left: THIN,
      right: THIN,
      bottom: THIN,
    };
  }

  const tituloFirmasRow = firmasBoxRow + 2;
  ws.mergeCells(`A${tituloFirmasRow}:C${tituloFirmasRow}`);
  ws.mergeCells(`D${tituloFirmasRow}:G${tituloFirmasRow}`);
  ws.getRow(tituloFirmasRow).height = 18;

  ws.getCell(`A${tituloFirmasRow}`).value = "Firma del responsable de HYS";
  ws.getCell(`A${tituloFirmasRow}`).font = {
    bold: true,
    size: 9,
    name: "Arial",
  };
  ws.getCell(`A${tituloFirmasRow}`).alignment = {
    horizontal: "center",
    vertical: "middle",
  };

  ws.getCell(`D${tituloFirmasRow}`).value = "Responsable por la empresa";
  ws.getCell(`D${tituloFirmasRow}`).font = {
    bold: true,
    size: 9,
    name: "Arial",
  };
  ws.getCell(`D${tituloFirmasRow}`).alignment = {
    horizontal: "center",
    vertical: "middle",
  };

  const aclaracionRow = tituloFirmasRow + 1;
  ws.mergeCells(`A${aclaracionRow}:C${aclaracionRow}`);
  ws.mergeCells(`D${aclaracionRow}:G${aclaracionRow}`);
  ws.getRow(aclaracionRow).height = 18;

  const aclaracionCap = (data.aclaracion_capacitador || "").trim();
  const aclaracionEmp = (data.aclaracion_empresa || "").trim();

  ws.getCell(`A${aclaracionRow}`).value = {
    richText: [
      {
        font: { bold: true, size: 9, name: "Arial", color: { argb: "FF334155" } },
        text: "Aclaración: ",
      },
      {
        font: { size: 9, name: "Arial", color: { argb: "FF0F172A" } },
        text: aclaracionCap || "________________",
      },
    ],
  };
  ws.getCell(`A${aclaracionRow}`).alignment = {
    horizontal: "left",
    vertical: "middle",
    indent: 1,
  };

  ws.getCell(`D${aclaracionRow}`).value = {
    richText: [
      {
        font: { bold: true, size: 9, name: "Arial", color: { argb: "FF334155" } },
        text: "Aclaración: ",
      },
      {
        font: { size: 9, name: "Arial", color: { argb: "FF0F172A" } },
        text: aclaracionEmp || "________________",
      },
    ],
  };
  ws.getCell(`D${aclaracionRow}`).alignment = {
    horizontal: "left",
    vertical: "middle",
    indent: 1,
  };

  if (data.firma_capacitador_url) {
    const img = await fetchImageBuffer(data.firma_capacitador_url);
    if (img) {
      const imgId = wb.addImage({
        buffer: img.buffer as any,
        extension: img.extension,
      });
      ws.addImage(imgId, {
        tl: { col: 0.35, row: firmasBoxRow - 1 + 0.2 },
        ext: { width: 150, height: 48 },
        editAs: "oneCell",
      });
    }
  }
  if (data.firma_empresa_url) {
    const img = await fetchImageBuffer(data.firma_empresa_url);
    if (img) {
      const imgId = wb.addImage({
        buffer: img.buffer as any,
        extension: img.extension,
      });
      ws.addImage(imgId, {
        tl: { col: 3.4, row: firmasBoxRow - 1 + 0.2 },
        ext: { width: 150, height: 48 },
        editAs: "oneCell",
      });
    }
  }

  // Avoid unused var lint
  void tableHeaderRow;

  const arrayBuffer = await wb.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}

/**
 * Genera un PDF con formato "REGISTRO DE CAPACITACIÓN".
 */
export async function buildRegistroPdf(
  data: RegistroCapacitacionData,
): Promise<InstanceType<typeof PDFDocument>> {
  const doc = new PDFDocument({
    size: "A4",
    margin: 36,
    bufferPages: true,
    autoFirstPage: true,
  });

  const pageWidth = doc.page.width;
  const left = 36;
  const right = pageWidth - 36;
  const width = right - left;
  const { dia, mes, anio } = splitFecha(data.fecha);

  const drawCell = (
    x: number,
    y: number,
    w: number,
    h: number,
    text?: string,
    opts?: {
      bold?: boolean;
      size?: number;
      align?: "left" | "center" | "right";
      fill?: string;
    },
  ) => {
    if (opts?.fill) {
      doc.rect(x, y, w, h).fillAndStroke(opts.fill, "#000");
    } else {
      doc.rect(x, y, w, h).stroke("#000");
    }
    if (text) {
      doc
        .fillColor("#000")
        .font(opts?.bold ? "Helvetica-Bold" : "Helvetica")
        .fontSize(opts?.size || 9)
        .text(text, x + 4, y + (h - (opts?.size || 9)) / 2 - 1, {
          width: w - 8,
          align: opts?.align || "left",
          lineBreak: false,
          ellipsis: true,
        });
    }
  };

  let y = 36;
  const headerH = 52;
  const logoW = 70;
  const dateW = 34;
  const titleW = width - logoW - dateW * 3;

  drawCell(left, y, logoW, headerH);
  const logo = await fetchImageBuffer(data.empresa?.logo_url);
  if (logo) {
    try {
      doc.image(logo.buffer, left + 8, y + 6, {
        fit: [logoW - 16, headerH - 12],
        align: "center",
        valign: "center",
      });
    } catch {
      doc
        .font("Helvetica-Bold")
        .fontSize(10)
        .fillColor("#000")
        .text("LOGO", left, y + 20, { width: logoW, align: "center" });
    }
  } else {
    doc
      .font("Helvetica-Bold")
      .fontSize(10)
      .fillColor("#000")
      .text("LOGO", left, y + 20, { width: logoW, align: "center" });
  }

  drawCell(left + logoW, y, titleW, headerH, "REGISTRO DE CAPACITACIÓN", {
    bold: true,
    size: 14,
    align: "center",
  });

  drawCell(left + logoW + titleW, y, dateW, 18, "Día", {
    bold: true,
    size: 8,
    align: "center",
  });
  drawCell(left + logoW + titleW + dateW, y, dateW, 18, "Mes", {
    bold: true,
    size: 8,
    align: "center",
  });
  drawCell(left + logoW + titleW + dateW * 2, y, dateW, 18, "Año", {
    bold: true,
    size: 8,
    align: "center",
  });
  drawCell(left + logoW + titleW, y + 18, dateW, headerH - 18, dia, {
    bold: true,
    size: 12,
    align: "center",
  });
  drawCell(
    left + logoW + titleW + dateW,
    y + 18,
    dateW,
    headerH - 18,
    mes,
    { bold: true, size: 12, align: "center" },
  );
  drawCell(
    left + logoW + titleW + dateW * 2,
    y + 18,
    dateW,
    headerH - 18,
    anio,
    { bold: true, size: 12, align: "center" },
  );

  y += headerH;

  const metaRows: Array<[string, string]> = [
    ["ESTABLECIMIENTO:", data.empresa?.razon_social || ""],
    ["CAPACITACIÓN:", data.titulo || ""],
    ["INSTRUCTOR:", data.instructor || ""],
  ];

  for (const [label, value] of metaRows) {
    const labelW = 120;
    drawCell(left, y, labelW, 22, label, { bold: true, size: 9 });
    drawCell(left + labelW, y, width - labelW, 22, value, { size: 9 });
    y += 22;
  }

  const half = width / 2;
  drawCell(left, y, 120, 22, "FECHAS Y HORARIO:", { bold: true, size: 8 });
  drawCell(left + 120, y, half - 120, 22, data.fechas_horario || "", {
    size: 9,
  });
  drawCell(left + half, y, 120, 22, "CANTIDAD DE HORAS:", {
    bold: true,
    size: 8,
  });
  drawCell(left + half + 120, y, half - 120, 22, data.cantidad_horas || "", {
    size: 9,
    align: "center",
  });
  y += 22;

  const colNombre = width * 0.5;
  const colDni = width * 0.22;
  const colFirma = width - colNombre - colDni;
  const rowH = 26;

  drawCell(left, y, colNombre, 20, "APELLIDO Y NOMBRES", {
    bold: true,
    size: 9,
    align: "center",
    fill: "#E5E7EB",
  });
  drawCell(left + colNombre, y, colDni, 20, "LEGAJO o DNI", {
    bold: true,
    size: 9,
    align: "center",
    fill: "#E5E7EB",
  });
  drawCell(left + colNombre + colDni, y, colFirma, 20, "FIRMA", {
    bold: true,
    size: 9,
    align: "center",
    fill: "#E5E7EB",
  });
  y += 20;

  const minRows = Math.max(data.asistencias.length, 18);
  for (let i = 0; i < minRows; i += 1) {
    if (y + rowH > doc.page.height - 120) {
      doc.addPage();
      y = 36;
      drawCell(left, y, colNombre, 20, "APELLIDO Y NOMBRES", {
        bold: true,
        size: 9,
        align: "center",
        fill: "#E5E7EB",
      });
      drawCell(left + colNombre, y, colDni, 20, "LEGAJO o DNI", {
        bold: true,
        size: 9,
        align: "center",
        fill: "#E5E7EB",
      });
      drawCell(left + colNombre + colDni, y, colFirma, 20, "FIRMA", {
        bold: true,
        size: 9,
        align: "center",
        fill: "#E5E7EB",
      });
      y += 20;
    }

    const a = data.asistencias[i];
    drawCell(left, y, colNombre, rowH, a?.nombre_empleado || "", { size: 9 });
    drawCell(left + colNombre, y, colDni, rowH, a?.documento || "", {
      size: 9,
      align: "center",
    });
    drawCell(left + colNombre + colDni, y, colFirma, rowH);

    if (a?.firma_url) {
      const img = await fetchImageBuffer(a.firma_url);
      if (img) {
        try {
          doc.image(img.buffer, left + colNombre + colDni + 6, y + 3, {
            fit: [colFirma - 12, rowH - 6],
            align: "center",
            valign: "center",
          });
        } catch {
          // ignore bad image
        }
      }
    }
    y += rowH;
  }

  // Espacio firmas finales
  if (y + 120 > doc.page.height - 36) {
    doc.addPage();
    y = 36;
  }

  y += 16;
  const firmaBoxH = 58;
  const firmaW = width / 2;
  const gap = 0;

  doc.rect(left, y, firmaW, firmaBoxH).stroke("#000");
  doc.rect(left + firmaW + gap, y, firmaW, firmaBoxH).stroke("#000");

  if (data.firma_capacitador_url) {
    const img = await fetchImageBuffer(data.firma_capacitador_url);
    if (img) {
      try {
        doc.image(img.buffer, left + 16, y + 6, {
          fit: [firmaW - 32, firmaBoxH - 12],
          align: "center",
          valign: "center",
        });
      } catch {
        // ignore
      }
    }
  }
  if (data.firma_empresa_url) {
    const img = await fetchImageBuffer(data.firma_empresa_url);
    if (img) {
      try {
        doc.image(img.buffer, left + firmaW + gap + 16, y + 6, {
          fit: [firmaW - 32, firmaBoxH - 12],
          align: "center",
          valign: "center",
        });
      } catch {
        // ignore
      }
    }
  }

  const titleY = y + firmaBoxH + 8;
  doc
    .fillColor("#000")
    .font("Helvetica-Bold")
    .fontSize(9)
    .text("Firma del responsable de HYS", left, titleY, {
      width: firmaW,
      align: "center",
      lineBreak: false,
    });
  doc.text("Responsable por la empresa", left + firmaW + gap, titleY, {
    width: firmaW,
    align: "center",
    lineBreak: false,
  });

  const aclaracionY = titleY + 14;
  const aclaracionCap = (data.aclaracion_capacitador || "").trim();
  const aclaracionEmp = (data.aclaracion_empresa || "").trim();
  const label = "Aclaración: ";

  const drawAclaracion = (x: number, nombre: string) => {
    doc.font("Helvetica-Bold").fontSize(9).fillColor("#334155");
    const labelWidth = doc.widthOfString(label);
    doc.text(label, x, aclaracionY, { lineBreak: false });
    doc
      .font("Helvetica")
      .fillColor("#0F172A")
      .text(nombre || "________________", x + labelWidth, aclaracionY, {
        width: firmaW - 12 - labelWidth,
        lineBreak: false,
        ellipsis: true,
      });
  };

  drawAclaracion(left + 6, aclaracionCap);
  drawAclaracion(left + firmaW + gap + 6, aclaracionEmp);

  return doc;
}
