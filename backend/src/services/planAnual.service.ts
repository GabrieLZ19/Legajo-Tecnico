import * as XLSX from "xlsx";
import ExcelJS from "exceljs";
import { supabaseAdmin } from "../config/supabase";
import { storageService } from "./storage.service";

const BUCKET = "capacitacion_planes";

export type PlanAnualFila = {
  n?: string | number;
  peligro?: string;
  tema?: string;
  propuesta?: string;
  real?: string;
};

export type TipoPlanAnual = "pdf" | "excel";

function currentYear(): number {
  return new Date().getFullYear();
}

export function tipoPlanAnual(
  nombre?: string | null,
  mime?: string | null,
): TipoPlanAnual {
  const n = (nombre || "").toLowerCase();
  const m = (mime || "").toLowerCase();
  if (n.endsWith(".pdf") || m.includes("pdf")) return "pdf";
  return "excel";
}

function mimeDesdeArchivo(file: Express.Multer.File): string {
  const tipo = tipoPlanAnual(file.originalname, file.mimetype);
  if (tipo === "pdf") return "application/pdf";
  const name = (file.originalname || "").toLowerCase();
  if (name.endsWith(".xlsx")) {
    return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  }
  if (file.mimetype && file.mimetype !== "application/octet-stream") {
    return file.mimetype;
  }
  return "application/vnd.ms-excel";
}

function parsePlanExcel(buffer: Buffer): {
  titulo?: string;
  filas: PlanAnualFila[];
} {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) return { filas: [] };

  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<(string | number | null)[]>(sheet, {
    header: 1,
    defval: "",
    raw: false,
  }) as Array<Array<string | number>>;

  let titulo: string | undefined;
  let headerIdx = -1;

  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i].map((c) => String(c ?? "").trim());
    const joined = row.join(" ").toLowerCase();
    if (!titulo && joined.includes("plan anual")) {
      titulo = row.find((c) => String(c).trim())?.toString();
    }
    const hasN = row.some((c) => /^n[°ºo.]?$/i.test(String(c).trim()));
    const hasTema = row.some((c) => /^tema$/i.test(String(c).trim()));
    if (hasN && hasTema) {
      headerIdx = i;
      break;
    }
  }

  if (headerIdx < 0) {
    // fallback: buscar columnas por posición típica del modelo
    return {
      titulo,
      filas: rows
        .slice(2)
        .map((r) => ({
          n: r[1],
          peligro: String(r[2] ?? "").trim(),
          tema: String(r[3] ?? "").trim(),
          propuesta: String(r[4] ?? "").trim(),
          real: String(r[5] ?? "").trim(),
        }))
        .filter((f) => f.tema || f.peligro || f.n),
    };
  }

  const header = rows[headerIdx].map((c) =>
    String(c ?? "")
      .trim()
      .toLowerCase(),
  );
  const idx = {
    n: header.findIndex((h) => /^n[°ºo.]?$/.test(h)),
    peligro: header.findIndex((h) => h.includes("peligro")),
    tema: header.findIndex((h) => h === "tema"),
    propuesta: header.findIndex((h) => h.includes("propuesta")),
    real: header.findIndex((h) => h === "real"),
  };

  const filas: PlanAnualFila[] = [];
  for (let i = headerIdx + 1; i < rows.length; i += 1) {
    const r = rows[i];
    const get = (pos: number) =>
      pos >= 0 ? String(r[pos] ?? "").trim() : "";
    const fila: PlanAnualFila = {
      n: idx.n >= 0 ? get(idx.n) || undefined : undefined,
      peligro: get(idx.peligro) || undefined,
      tema: get(idx.tema) || undefined,
      propuesta: get(idx.propuesta) || undefined,
      real: get(idx.real) || undefined,
    };
    if (fila.tema || fila.peligro || fila.n || fila.propuesta) {
      filas.push(fila);
    }
  }

  return { titulo, filas };
}

export const planAnualService = {
  async generarPlantilla(anio?: number) {
    const year = anio && Number.isFinite(anio) ? anio : currentYear();
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "Legajo Técnico";
    const sheet = workbook.addWorksheet("Plan anual");

    sheet.mergeCells("B1:F1");
    sheet.getCell("B1").value = `PLAN ANUAL DE CAPACITACIÓN ${year}`;
    sheet.getCell("B1").font = { bold: true, size: 14 };
    sheet.getCell("B1").alignment = { horizontal: "center" };

    sheet.getCell("B2").value =
      "Completá las filas. No renombres las columnas del encabezado.";
    sheet.getCell("B2").font = { italic: true, size: 10, color: { argb: "FF64748B" } };

    const headerRow = sheet.getRow(4);
    headerRow.values = [null, "N°", "Peligro", "TEMA", "PROPUESTA", "REAL"];
    headerRow.font = { bold: true };
    headerRow.eachCell((cell) => {
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFE2E8F0" },
      };
      cell.border = {
        top: { style: "thin", color: { argb: "FFCBD5E1" } },
        left: { style: "thin", color: { argb: "FFCBD5E1" } },
        bottom: { style: "thin", color: { argb: "FFCBD5E1" } },
        right: { style: "thin", color: { argb: "FFCBD5E1" } },
      };
    });

    const ejemplos = [
      [1, "Incendio", "Uso de matafuegos", "Marzo", ""],
      [2, "Caídas", "Trabajo en altura", "Abril", ""],
      [3, "Riesgo eléctrico", "Electricidad básica", "Mayo", ""],
    ];
    ejemplos.forEach((vals, i) => {
      const row = sheet.getRow(5 + i);
      row.getCell(2).value = vals[0];
      row.getCell(3).value = vals[1];
      row.getCell(4).value = vals[2];
      row.getCell(5).value = vals[3];
      row.getCell(6).value = vals[4];
    });

    sheet.getColumn(2).width = 8;
    sheet.getColumn(3).width = 22;
    sheet.getColumn(4).width = 36;
    sheet.getColumn(5).width = 18;
    sheet.getColumn(6).width = 18;

    const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
    return {
      buffer,
      filename: `plantilla-plan-anual-capacitacion-${year}.xlsx`,
      mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    };
  },

  async listarAnios(empresaId: string) {
    const { data, error } = await supabaseAdmin
      .from("capacitacion_planes_anuales")
      .select("anio, id, archivo_nombre, updated_at, created_at")
      .eq("empresa_id", empresaId)
      .order("anio", { ascending: false });

    if (error) throw error;
    return data || [];
  },

  async obtener(empresaId: string, anio?: number) {
    const year = anio || currentYear();
    const { data, error } = await supabaseAdmin
      .from("capacitacion_planes_anuales")
      .select("*")
      .eq("empresa_id", empresaId)
      .eq("anio", year)
      .maybeSingle();

    if (error) throw error;
    if (!data) {
      return {
        anio: year,
        plan: null,
        preview: null,
        downloadUrl: null,
        tipo: null as TipoPlanAnual | null,
      };
    }

    const tipo = tipoPlanAnual(data.archivo_nombre, data.archivo_mime);

    const { data: signed, error: signError } = await supabaseAdmin.storage
      .from(BUCKET)
      .createSignedUrl(data.archivo_path, 60 * 30); // 30 min

    if (signError) {
      console.error("Error firmando URL plan anual:", signError.message);
    }

    // Preview: descargar y parsear solo Excel
    let preview: { titulo?: string; filas: PlanAnualFila[] } | null = null;
    if (tipo === "excel") {
      try {
        const { data: fileData, error: dlError } = await supabaseAdmin.storage
          .from(BUCKET)
          .download(data.archivo_path);
        if (!dlError && fileData) {
          const buffer = Buffer.from(await fileData.arrayBuffer());
          preview = parsePlanExcel(buffer);
        }
      } catch (e) {
        console.error("Error parseando plan anual:", e);
      }
    }

    return {
      anio: year,
      plan: data,
      preview,
      downloadUrl: signed?.signedUrl || null,
      tipo,
    };
  },

  async subir(params: {
    empresaId: string;
    anio: number;
    subidoPor: string;
    file: Express.Multer.File;
  }) {
    const { empresaId, anio, subidoPor, file } = params;

    if (!anio || anio < 2000 || anio > 2100) {
      throw new Error("Año inválido");
    }
    if (!file?.buffer?.length) {
      throw new Error("Debés adjuntar un archivo Excel (.xls o .xlsx) o PDF");
    }

    const tipo = tipoPlanAnual(file.originalname, file.mimetype);
    file.mimetype = mimeDesdeArchivo(file);

    const safeName = file.originalname.replace(/[^\w.\-()\sÁÉÍÓÚáéíóúñÑ]/g, "_");
    const archivoPath = `${empresaId}/${anio}/${Date.now()}_${safeName}`;

    // Si ya existe plan del año, reemplazar archivo anterior
    const { data: existing } = await supabaseAdmin
      .from("capacitacion_planes_anuales")
      .select("id, archivo_path")
      .eq("empresa_id", empresaId)
      .eq("anio", anio)
      .maybeSingle();

    await storageService.subirArchivo(BUCKET, archivoPath, file);

    const payload = {
      empresa_id: empresaId,
      anio,
      archivo_path: archivoPath,
      archivo_nombre: file.originalname,
      archivo_mime: file.mimetype,
      archivo_size: file.size,
      subido_por: subidoPor,
      updated_at: new Date().toISOString(),
    };

    let plan;
    if (existing?.id) {
      const { data, error } = await supabaseAdmin
        .from("capacitacion_planes_anuales")
        .update(payload)
        .eq("id", existing.id)
        .select()
        .single();
      if (error) throw error;
      plan = data;

      if (existing.archivo_path && existing.archivo_path !== archivoPath) {
        try {
          await storageService.eliminarArchivo(BUCKET, existing.archivo_path);
        } catch {
          // no bloquear si falla el borrado del archivo viejo
        }
      }
    } else {
      const { data, error } = await supabaseAdmin
        .from("capacitacion_planes_anuales")
        .insert(payload)
        .select()
        .single();
      if (error) throw error;
      plan = data;
    }

    let preview: { titulo?: string; filas: PlanAnualFila[] } | null = null;
    if (tipo === "excel") {
      try {
        preview = parsePlanExcel(file.buffer);
      } catch (e) {
        console.error("Error parseando plan anual subido:", e);
      }
    }
    return { plan, preview, anio, tipo };
  },
};
