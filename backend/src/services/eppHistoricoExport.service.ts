import ExcelJS from "exceljs";

export type EppHistoricoExportEmpresa = {
  razon_social: string;
  cuit: string;
  domicilio?: string | null;
  localidad?: string | null;
  codigo_postal?: string | null;
  provincia?: string | null;
};

export type EppHistoricoExportRow = {
  trabajador: string;
  dni: string;
  producto: string;
  modelo: string;
  marca: string;
  certificacion: string;
  cantidad: number;
  fecha: string;
  firma?: Buffer | null;
};

const THIN = {
  style: "thin" as const,
  color: { argb: "FF000000" },
};

function boxBorder() {
  return { top: THIN, left: THIN, bottom: THIN, right: THIN };
}

function formatFechaCell(dateInput: string): string {
  if (!dateInput) return "";
  const datePart = dateInput.split("T")[0];
  const parts = datePart.split("-");
  if (parts.length === 3) {
    const [year, month, day] = parts;
    return `${parseInt(day, 10)}/${parseInt(month, 10)}/${year}`;
  }
  return new Date(dateInput).toLocaleDateString("es-AR");
}

function formatCertificacion(value?: string | null): string {
  if (!value?.trim()) return "";
  const v = value.trim().toUpperCase();
  if (v === "NO" || v === "N" || v === "0" || v === "FALSE") return "NO";
  // Si es un texto libre (nro de cert.), conservarlo; SI/YES → SI
  if (v === "SI" || v === "S" || v === "1" || v === "TRUE" || v === "YES") {
    return "SI";
  }
  return value.trim();
}

/**
 * Excel (.xlsx) estilizado tipo Anexo I Res. 299/11 — lista completa de entregas.
 */
export async function buildHistoricoEppExcel(params: {
  empresa: EppHistoricoExportEmpresa;
  rows: EppHistoricoExportRow[];
  filtrosResumen?: string | null;
}): Promise<Buffer> {
  const { empresa, rows, filtrosResumen } = params;
  const wb = new ExcelJS.Workbook();
  wb.creator = "Legajo Técnico";
  wb.created = new Date();

  const ws = wb.addWorksheet("Base histórica EPP", {
    pageSetup: {
      paperSize: 9,
      orientation: "landscape",
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      margins: {
        left: 0.35,
        right: 0.35,
        top: 0.4,
        bottom: 0.4,
        header: 0.2,
        footer: 0.2,
      },
    },
    views: [{ state: "frozen", ySplit: 8 }],
  });

  // A..J → 10 columnas de la planilla lista
  ws.columns = [
    { key: "n", width: 5 },
    { key: "trabajador", width: 22 },
    { key: "dni", width: 12 },
    { key: "producto", width: 28 },
    { key: "modelo", width: 14 },
    { key: "marca", width: 12 },
    { key: "cert", width: 14 },
    { key: "cant", width: 10 },
    { key: "fecha", width: 14 },
    { key: "firma", width: 16 },
  ];

  // Título legal
  ws.mergeCells("A1:J1");
  const titleLegal = ws.getCell("A1");
  titleLegal.value = "Resolución 299/11, Anexo I";
  titleLegal.font = { bold: true, size: 10, name: "Arial" };
  titleLegal.alignment = { vertical: "middle" };

  ws.mergeCells("A2:J2");
  const titleMain = ws.getCell("A2");
  titleMain.value =
    "ENTREGA DE ROPA DE TRABAJO Y ELEMENTOS DE PROTECCIÓN PERSONAL";
  titleMain.font = { bold: true, size: 13, name: "Arial" };
  titleMain.alignment = { horizontal: "center", vertical: "middle" };
  ws.getRow(2).height = 22;

  ws.mergeCells("A3:J3");
  const subtitle = ws.getCell("A3");
  subtitle.value = "Base histórica consolidada — listado completo de entregas";
  subtitle.font = { italic: true, size: 9, name: "Arial", color: { argb: "FF475569" } };
  subtitle.alignment = { horizontal: "center" };

  // Datos empresa
  ws.mergeCells("A4:F4");
  ws.getCell("A4").value = `Razón Social: ${empresa.razon_social || ""}`;
  ws.getCell("A4").font = { bold: true, size: 10, name: "Arial" };
  ws.mergeCells("G4:J4");
  ws.getCell("G4").value = `C.U.I.T.: ${empresa.cuit || ""}`;
  ws.getCell("G4").font = { bold: true, size: 10, name: "Arial" };

  ws.mergeCells("A5:D5");
  ws.getCell("A5").value = `Dirección: ${empresa.domicilio || ""}`;
  ws.getCell("A5").font = { size: 9, name: "Arial" };
  ws.mergeCells("E5:F5");
  ws.getCell("E5").value = `Localidad: ${empresa.localidad || ""}`;
  ws.getCell("E5").font = { size: 9, name: "Arial" };
  ws.mergeCells("G5:H5");
  ws.getCell("G5").value = `C.P.: ${empresa.codigo_postal || ""}`;
  ws.getCell("G5").font = { size: 9, name: "Arial" };
  ws.mergeCells("I5:J5");
  ws.getCell("I5").value = `Provincia: ${empresa.provincia || ""}`;
  ws.getCell("I5").font = { size: 9, name: "Arial" };

  ws.mergeCells("A6:J6");
  ws.getCell("A6").value = filtrosResumen
    ? `Filtros aplicados: ${filtrosResumen}`
    : `Generado: ${new Date().toLocaleString("es-AR")} · ${rows.length} entrega(s)`;
  ws.getCell("A6").font = { size: 8, name: "Arial", color: { argb: "FF64748B" } };

  // Fila vacía separadora
  ws.getRow(7).height = 6;

  // Encabezados de tabla (fila 8)
  const headers = [
    "#",
    "Trabajador",
    "D.N.I.",
    "Producto",
    "Tipo // Modelo",
    "Marca",
    "Posee certificación SI // NO",
    "Cantidad",
    "Fecha de entrega",
    "Firma del trabajador",
  ];
  const headerRow = ws.getRow(8);
  headers.forEach((h, i) => {
    const cell = headerRow.getCell(i + 1);
    cell.value = h;
    cell.font = { bold: true, size: 8, name: "Arial", color: { argb: "FFFFFFFF" } };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF1E3A8A" },
    };
    cell.alignment = {
      horizontal: "center",
      vertical: "middle",
      wrapText: true,
    };
    cell.border = boxBorder();
  });
  headerRow.height = 32;

  // Filas de datos
  rows.forEach((row, idx) => {
    const r = ws.getRow(9 + idx);
    const values = [
      idx + 1,
      row.trabajador,
      row.dni,
      row.producto,
      row.modelo,
      row.marca,
      formatCertificacion(row.certificacion),
      row.cantidad || "",
      formatFechaCell(row.fecha),
      row.firma ? "✓ Firmado" : "",
    ];

    values.forEach((val, i) => {
      const cell = r.getCell(i + 1);
      cell.value = val;
      cell.font = { size: 9, name: "Arial" };
      cell.border = boxBorder();
      cell.alignment = {
        vertical: "middle",
        horizontal: i === 0 || i === 7 || i === 8 || i === 9 ? "center" : "left",
        wrapText: true,
      };
      if (idx % 2 === 1) {
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFF1F5F9" },
        };
      }
    });
    r.height = 18;
  });

  // Pie
  const footerRow = 9 + rows.length + 1;
  ws.mergeCells(`A${footerRow}:J${footerRow}`);
  ws.getCell(`A${footerRow}`).value =
    "Documento generado por Legajo Técnico Digital · Formato orientado a Resolución SRT 299/11, Anexo I";
  ws.getCell(`A${footerRow}`).font = {
    size: 8,
    name: "Arial",
    color: { argb: "FF64748B" },
  };

  const arrayBuffer = await wb.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}
