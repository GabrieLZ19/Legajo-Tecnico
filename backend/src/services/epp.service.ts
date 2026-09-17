import { randomUUID } from "crypto";
import QRCode from "qrcode";
import { supabaseAdmin } from "../config/supabase";
import { env } from "../config/env";
import { storageService } from "./storage.service";
import { safeExtensionFromUpload } from "../config/multer";
import { eppPdfService } from "./eppPdf.service";
import { buildHistoricoEppExcel } from "./eppHistoricoExport.service";
import { HttpError } from "../utils/httpError";
import {
  normalizarEmpresaParaPlanilla,
} from "../utils/empresaPdf";
import {
  clampInt,
  parseDateFilter,
  sanitizeSearchTerm,
} from "../utils/searchSanitize";
import type { RolUsuario } from "../types/database";
import { notificacionService } from "./notificacion.service";

const HISTORICO_PAGE_DEFAULT = 25;
const HISTORICO_PAGE_MAX = 100;
const HISTORICO_EXPORT_BATCH = 200;
const HISTORICO_EXPORT_MAX = 10_000;
const HISTORICO_PDF_MAX_ENTREGAS = 1_500;

type EppHistoricoFiltros = {
  trabajador?: string;
  producto?: string;
  fecha_desde?: string;
  fecha_hasta?: string;
  limit?: number;
  offset?: number;
  soloVisibleEnte?: boolean;
};

export type EppHistoricoRow = {
  id: string;
  empleado_id: string | null;
  trabajador: string;
  dni: string;
  producto: string;
  cantidad: number;
  marca: string | null;
  modelo: string | null;
  certificacion: string | null;
  fecha: string;
  pdf_disponible: boolean;
};

function applyEppHistoricoFilters(query: any, opts: EppHistoricoFiltros) {
  const qTrabajador = sanitizeSearchTerm(opts.trabajador);
  if (qTrabajador) {
    const digits = qTrabajador.replace(/\D/g, "");
    const safe = qTrabajador.replace(/'/g, "''");
    if (digits.length >= 3) {
      query = query.or(
        `empleado_nombre.ilike.%${safe}%,empleado_documento.ilike.%${digits}%`,
      );
    } else {
      query = query.or(
        `empleado_nombre.ilike.%${safe}%,empleado_documento.ilike.%${safe}%`,
      );
    }
  }

  const qProducto = sanitizeSearchTerm(opts.producto);
  if (qProducto) {
    const safeProducto = qProducto.replace(/'/g, "''");
    query = query.ilike("epp_tipos.nombre", `%${safeProducto}%`);
  }

  const desde = parseDateFilter(opts.fecha_desde);
  if (desde) {
    query = query.gte("entregado_at", `${desde}T00:00:00`);
  }

  const hasta = parseDateFilter(opts.fecha_hasta);
  if (hasta) {
    query = query.lte("entregado_at", `${hasta}T23:59:59.999`);
  }

  if (opts.soloVisibleEnte) {
    query = query.eq("visible_ente_regulador", true);
  }

  return query;
}

function mapEppHistoricoRows(rows: any[]): EppHistoricoRow[] {
  return rows.map((row) => {
    const tipo = firstRelation(row.epp_tipos);
    return {
      id: row.id,
      empleado_id: row.empleado_id ?? null,
      trabajador: row.empleado_nombre ?? "",
      dni: row.empleado_documento ?? "",
      producto: tipo?.nombre ?? "—",
      cantidad: row.cantidad ?? 1,
      marca: row.marca ?? null,
      modelo: row.modelo ?? null,
      certificacion: row.certificacion ?? null,
      fecha: row.entregado_at ?? "",
      pdf_disponible: !!row.url_registro_oficial,
    };
  });
}

type AuthUser = {
  id: string;
  rol: RolUsuario;
  empresa_id?: string;
  consultora_id?: string;
};

type EntregaItemInput = {
  epp_tipo_id: string;
  cantidad: number;
  marca?: string | null;
  modelo?: string | null;
  certificacion?: string | null;
};

type EntregaRow = {
  id: string;
  empresa_id: string;
  preventor_id: string | null;
  epp_tipo_id: string;
  empleado_id: string | null;
  empleado_nombre: string;
  empleado_documento: string;
  cantidad: number;
  marca: string | null;
  modelo: string | null;
  certificacion: string | null;
  entregado_at: string;
  firma_empleado_url: string | null;
  firma_empleador_url: string | null;
  foto_evidencia_url?: string | null;
  origen?: string | null;
  estado: string;
  url_registro_oficial: string | null;
  visible_ente_regulador?: boolean | null;
  epp_tipos?: { id: string; nombre: string; descripcion: string | null; foto_url: string | null } | null;
};

type ConsultoraConfig = {
  cuit?: string;
  comision_epp_porcentaje?: number;
};

function firstRelation<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

type LicitacionEstado = "abierta" | "adjudicacion" | "cerrada";

type CotizacionResumen = {
  id: string;
  estado?: string | null;
  proveedor_nombre?: string | null;
  proveedor_email?: string | null;
  monto?: number | null;
};

function buildMensajeAdjudicacion(opts: {
  titulo: string;
  empresaNombre: string;
  compradorNombre?: string | null;
  ganadorNombre?: string | null;
  numero?: number | null;
}): string {
  const comprador = opts.compradorNombre?.trim() || "el comprador";
  const licRef =
    opts.numero != null
      ? `lic ${formatLicNumero(opts.numero)} "${opts.titulo}"`
      : `lic "${opts.titulo}"`;
  return `Ud fue adjudicado con la ${licRef} de ${opts.empresaNombre}, por favor ponerse en contacto con ${comprador} para coordinar la O/C y la entrega.`;
}

function formatLicNumero(numero: number): string {
  return `LIC-${String(numero).padStart(4, "0")}`;
}

async function firmarPresupuestosCotizaciones<
  T extends { presupuesto_pdf_url?: string | null },
>(cotizaciones: T[]): Promise<T[]> {
  return Promise.all(
    cotizaciones.map(async (cot) => ({
      ...cot,
      presupuesto_pdf_url: await storageService.signUrl(cot.presupuesto_pdf_url),
    })),
  );
}

/** La comisión es interna LT ↔ proveedor adjudicado; no se expone al cliente ni en cotizar. */
function ocultarComisionLicitacion<T extends Record<string, unknown>>(lic: T): T {
  const { comision_porcentaje: _pct, ...rest } = lic as T & {
    comision_porcentaje?: unknown;
  };
  const cotizaciones = Array.isArray(rest.epp_licitacion_cotizaciones)
    ? (rest.epp_licitacion_cotizaciones as Record<string, unknown>[]).map((cot) => {
        const { comision_calculada: _calc, ...cotRest } = cot;
        return cotRest;
      })
    : rest.epp_licitacion_cotizaciones;
  return { ...rest, epp_licitacion_cotizaciones: cotizaciones } as unknown as T;
}

function requireConsultoraId(user: AuthUser): string {
  if (!user.consultora_id) {
    throw new HttpError(400, "El usuario no tiene consultora asignada");
  }
  return user.consultora_id;
}

function mapEntrega(e: EntregaRow) {
  return {
    id: e.id,
    empresa_id: e.empresa_id,
    preventor_id: e.preventor_id,
    epp_tipo_id: e.epp_tipo_id,
    empleado_id: e.empleado_id,
    nombre_empleado: e.empleado_nombre,
    dni_empleado: e.empleado_documento,
    cantidad: e.cantidad,
    marca: e.marca,
    modelo: e.modelo,
    certificacion: e.certificacion,
    fecha_entrega: e.entregado_at,
    firma_url: e.firma_empleado_url,
    firma_empleador_url: e.firma_empleador_url,
    foto_evidencia_url: e.foto_evidencia_url ?? null,
    origen: e.origen ?? "panel",
    estado: e.estado,
    pdf_url: e.url_registro_oficial,
    visible_ente_regulador: Boolean(e.visible_ente_regulador),
    epp_tipos: e.epp_tipos,
  };
}

function normalizeEntregadoAt(fechaEntrega?: string): string {
  const now = new Date();
  if (!fechaEntrega) return now.toISOString();
  if (fechaEntrega.includes("T")) return fechaEntrega;
  const timePart = now.toISOString().slice(11);
  return `${fechaEntrega}T${timePart}`;
}

async function uploadBase64Png(bucket: string, path: string, dataUrl: string): Promise<string> {
  const base64Data = dataUrl.replace(/^data:image\/\w+;base64,/, "");
  const buffer = Buffer.from(base64Data, "base64");
  const { error } = await supabaseAdmin.storage.from(bucket).upload(path, buffer, {
    contentType: "image/png",
    upsert: true,
  });
  if (error) {
    throw new HttpError(500, `No se pudo subir el archivo: ${error.message}`);
  }
  return supabaseAdmin.storage.from(bucket).getPublicUrl(path).data.publicUrl;
}

async function signedEppFoto(fotoUrl: string | null | undefined): Promise<string | null> {
  if (!fotoUrl) return null;
  const path = fotoUrl.includes("epp_fotos/")
    ? fotoUrl.split("epp_fotos/")[1]?.split("?")[0]
    : fotoUrl.replace(/^https?:\/\/[^/]+\//, "");
  if (!path) return fotoUrl;
  const { data } = await supabaseAdmin.storage.from("epp_fotos").createSignedUrl(path, 60 * 60 * 24);
  return data?.signedUrl ?? fotoUrl;
}

async function getComisionPorcentaje(consultoraId: string): Promise<number> {
  const { data, error } = await supabaseAdmin
    .from("consultoras")
    .select("config")
    .eq("id", consultoraId)
    .single();
  if (error) throw error;
  const config = (data?.config ?? {}) as ConsultoraConfig;
  const value = Number(config.comision_epp_porcentaje);
  return Number.isFinite(value) ? value : 0;
}

function normalizeEppNombre(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function escapeIlikeExact(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}

/**
 * Copia epp_necesarios a todos los empleados activos de la empresa con el mismo puesto
 * (comparación case-insensitive, sin wildcards).
 */
async function aplicarEppNecesariosPorPuesto(
  empresaId: string,
  puesto: string,
  eppNecesarios: string | null,
): Promise<number> {
  const puestoNorm = puesto.trim();
  if (!puestoNorm) return 0;

  const { data, error } = await supabaseAdmin
    .from("empleados")
    .update({ epp_necesarios: eppNecesarios?.trim() || null })
    .eq("empresa_id", empresaId)
    .eq("activo", true)
    .ilike("puesto", escapeIlikeExact(puestoNorm))
    .select("id");

  if (error) throw error;
  return data?.length ?? 0;
}

function mapEppNecesariosToTipos(
  eppNecesarios: string | null | undefined,
  tipos: Array<{ id: string; nombre: string }>,
): Array<{ id: string; nombre: string }> {
  if (!eppNecesarios?.trim()) return [];
  const parts = eppNecesarios
    .split(",")
    .map((part) => normalizeEppNombre(part))
    .filter(Boolean);
  if (parts.length === 0) return [];
  return tipos
    .filter((tipo) => parts.includes(normalizeEppNombre(tipo.nombre)))
    .map((tipo) => ({ id: tipo.id, nombre: tipo.nombre }));
}

export const eppService = {
  async listarTipos(consultoraId: string, incluirInactivos = false) {
    let query = supabaseAdmin
      .from("epp_tipos")
      .select("*")
      .eq("consultora_id", consultoraId)
      .order("nombre");

    if (!incluirInactivos) {
      query = query.eq("activo", true);
    }

    const { data, error } = await query;
    if (error) throw error;
    const tipos = await Promise.all(
      (data ?? []).map(async (tipo) => ({
        ...tipo,
        foto_url: await signedEppFoto(tipo.foto_url),
      })),
    );
    return { tipos };
  },

  async crearTipo(
    user: AuthUser,
    payload: { nombre: string; descripcion?: string | null },
    file?: Express.Multer.File,
  ) {
    const consultoraId = requireConsultoraId(user);
    let fotoUrl: string | null = null;

    if (file) {
      const ext = safeExtensionFromUpload(file);
      const path = `${consultoraId}/${randomUUID()}.${ext}`;
      await storageService.subirArchivo("epp_fotos", path, file);
      fotoUrl = storageService.obtenerUrlPublica("epp_fotos", path);
    }

    const { data, error } = await supabaseAdmin
      .from("epp_tipos")
      .insert({
        consultora_id: consultoraId,
        nombre: payload.nombre.trim(),
        descripcion: payload.descripcion?.trim() || null,
        foto_url: fotoUrl,
        activo: true,
      })
      .select()
      .single();

    if (error) throw error;
    return { ...data, foto_url: await signedEppFoto(data.foto_url) };
  },

  async actualizarTipo(
    user: AuthUser,
    id: string,
    payload: { nombre?: string; descripcion?: string | null; activo?: boolean },
    file?: Express.Multer.File,
  ) {
    const consultoraId = requireConsultoraId(user);
    const updates: Record<string, unknown> = {};
    if (payload.nombre !== undefined) updates.nombre = payload.nombre.trim();
    if (payload.descripcion !== undefined) updates.descripcion = payload.descripcion;
    if (payload.activo !== undefined) updates.activo = payload.activo;

    if (file) {
      const ext = safeExtensionFromUpload(file);
      const path = `${consultoraId}/${id}.${ext}`;
      await storageService.subirArchivo("epp_fotos", path, file);
      updates.foto_url = storageService.obtenerUrlPublica("epp_fotos", path);
    }

    const { data, error } = await supabaseAdmin
      .from("epp_tipos")
      .update(updates)
      .eq("id", id)
      .eq("consultora_id", consultoraId)
      .select()
      .single();

    if (error) throw error;
    if (!data) throw new HttpError(404, "Tipo de EPP no encontrado");
    return { ...data, foto_url: await signedEppFoto(data.foto_url) };
  },

  async listarEmpleados(
    empresaId: string,
    opts?: { limit?: number; offset?: number; q?: string },
  ) {
    const limit = clampInt(opts?.limit, 10, 1, 200);
    const offset = clampInt(opts?.offset, 0, 0, 500_000);
    const q = sanitizeSearchTerm(opts?.q);

    let query = supabaseAdmin
      .from("empleados")
      .select("*", { count: "exact" })
      .eq("empresa_id", empresaId);

    if (q) {
      const digits = q.replace(/\D/g, "");
      if (digits.length > 0) {
        query = query.or(
          `nombre.ilike.%${q}%,documento.ilike.%${digits}%,sector.ilike.%${q}%,puesto.ilike.%${q}%`,
        );
      } else {
        query = query.or(
          `nombre.ilike.%${q}%,sector.ilike.%${q}%,puesto.ilike.%${q}%`,
        );
      }
    }

    const { data, error, count } = await query
      .order("nombre")
      .range(offset, offset + limit - 1);

    if (error) throw error;
    return {
      empleados: data ?? [],
      total: count ?? 0,
      limit,
      offset,
    };
  },

  async crearEmpleado(payload: {
    empresa_id: string;
    nombre: string;
    documento: string;
    sector?: string | null;
    puesto?: string | null;
    epp_necesarios?: string | null;
    aplicar_epp_por_puesto?: boolean;
  }) {
    const puesto = payload.puesto?.trim() || null;
    const eppNecesarios = payload.epp_necesarios?.trim() || null;

    const { data, error } = await supabaseAdmin
      .from("empleados")
      .insert({
        empresa_id: payload.empresa_id,
        nombre: payload.nombre.trim(),
        documento: payload.documento,
        sector: payload.sector?.trim() || null,
        puesto,
        epp_necesarios: eppNecesarios,
        activo: true,
      })
      .select()
      .single();

    if (error) {
      if (error.code === "23505") {
        throw new HttpError(409, "Ya existe un trabajador con ese DNI en la empresa");
      }
      throw error;
    }

    let eppAplicadosA = 1;
    if (payload.aplicar_epp_por_puesto && puesto) {
      eppAplicadosA = await aplicarEppNecesariosPorPuesto(
        payload.empresa_id,
        puesto,
        eppNecesarios,
      );
    }

    return { ...data, epp_aplicados_a: eppAplicadosA };
  },

  async actualizarEmpleado(
    id: string,
    payload: {
      nombre?: string;
      documento?: string;
      sector?: string | null;
      puesto?: string | null;
      epp_necesarios?: string | null;
      activo?: boolean;
      aplicar_epp_por_puesto?: boolean;
    },
  ) {
    const updates: Record<string, unknown> = {};
    if (payload.nombre !== undefined) updates.nombre = payload.nombre.trim();
    if (payload.documento !== undefined) updates.documento = payload.documento;
    if (payload.sector !== undefined) updates.sector = payload.sector?.trim() || null;
    if (payload.puesto !== undefined) updates.puesto = payload.puesto?.trim() || null;
    if (payload.epp_necesarios !== undefined) {
      updates.epp_necesarios = payload.epp_necesarios?.trim() || null;
    }
    if (payload.activo !== undefined) updates.activo = payload.activo;

    const { data, error } = await supabaseAdmin
      .from("empleados")
      .update(updates)
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    if (!data) throw new HttpError(404, "Empleado no encontrado");

    let eppAplicadosA = 1;
    const puestoFinal = (data.puesto as string | null)?.trim() || null;
    if (payload.aplicar_epp_por_puesto && puestoFinal) {
      const eppFinal =
        payload.epp_necesarios !== undefined
          ? payload.epp_necesarios?.trim() || null
          : (data.epp_necesarios as string | null)?.trim() || null;
      eppAplicadosA = await aplicarEppNecesariosPorPuesto(
        data.empresa_id as string,
        puestoFinal,
        eppFinal,
      );
    }

    return { ...data, epp_aplicados_a: eppAplicadosA };
  },

  async buscarEmpleadoPorQr(rawToken: string) {
    const token = rawToken.trim().replace(/^LT-EMP:/i, "");
    const { data, error } = await supabaseAdmin
      .from("empleados")
      .select("*")
      .eq("qr_token", token)
      .eq("activo", true)
      .maybeSingle();

    if (error) throw error;
    if (!data) throw new HttpError(404, "QR de trabajador no reconocido");
    return data;
  },

  async generarQrEmpleado(id: string) {
    const { data, error } = await supabaseAdmin
      .from("empleados")
      .select("*")
      .eq("id", id)
      .single();
    if (error || !data) throw new HttpError(404, "Empleado no encontrado");

    const payload = `LT-EMP:${data.qr_token}`;
    const qr = await QRCode.toDataURL(payload, {
      width: 400,
      margin: 2,
      color: { dark: "#1e3a8a", light: "#ffffff" },
    });
    return { qr, payload, empleado: data };
  },

  async listarEntregas(
    empresaId: string,
    opts?: {
      soloVisibleEnte?: boolean;
      limit?: number;
      offset?: number;
      q?: string;
    },
  ) {
    const limit = clampInt(opts?.limit, 10, 1, 100);
    const offset = clampInt(opts?.offset, 0, 0, 500_000);
    const q = sanitizeSearchTerm(opts?.q);

    let query = supabaseAdmin
      .from("epp_entregas")
      .select(`*, epp_tipos(id, nombre, descripcion, foto_url)`, {
        count: "exact",
      })
      .eq("empresa_id", empresaId);

    if (opts?.soloVisibleEnte) {
      query = query.eq("visible_ente_regulador", true);
    }

    if (q) {
      const digits = q.replace(/\D/g, "");
      const parts = [
        `empleado_nombre.ilike.%${q}%`,
        `marca.ilike.%${q}%`,
        `modelo.ilike.%${q}%`,
        `certificacion.ilike.%${q}%`,
      ];
      if (digits.length > 0) {
        parts.push(`empleado_documento.ilike.%${digits}%`);
      }
      query = query.or(parts.join(","));
    }

    const { data, error, count } = await query
      .order("entregado_at", { ascending: false, nullsFirst: false })
      .order("id", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;

    const entregas = await Promise.all(
      ((data ?? []) as EntregaRow[]).map(async (row) => {
        const mapped = mapEntrega(row);
        if (mapped.epp_tipos?.foto_url) {
          mapped.epp_tipos = {
            ...mapped.epp_tipos,
            foto_url: await signedEppFoto(mapped.epp_tipos.foto_url),
          };
        }
        if (mapped.foto_evidencia_url) {
          mapped.foto_evidencia_url = await signedEppFoto(
            mapped.foto_evidencia_url,
          );
        }
        return mapped;
      }),
    );

    return {
      entregas,
      total: count ?? 0,
      limit,
      offset,
    };
  },

  async registrarEntrega(
    user: AuthUser,
    payload: {
      empresa_id: string;
      empleado_id: string;
      nombre_empleado?: string;
      dni_empleado?: string;
      items: EntregaItemInput[];
      fecha_entrega?: string;
      firma: string;
      firma_empleador?: string | null;
    },
  ) {
    const { data: empleado, error: empleadoError } = await supabaseAdmin
      .from("empleados")
      .select("id, nombre, documento, activo")
      .eq("id", payload.empleado_id)
      .eq("empresa_id", payload.empresa_id)
      .single();

    if (empleadoError || !empleado) {
      throw new HttpError(400, "El trabajador debe estar en el padrón de la empresa");
    }
    if (!empleado.activo) {
      throw new HttpError(400, "El trabajador no está activo en el padrón");
    }

    const nombreEmpleado = empleado.nombre;
    const dniEmpleado = empleado.documento;

    const { data: empresaRaw } = await supabaseAdmin
      .from("empresas")
      .select(
        "razon_social, cuit, domicilio, localidad, codigo_postal, provincia, actividad, logo_url",
      )
      .eq("id", payload.empresa_id)
      .single();
    const empresaNorm = normalizarEmpresaParaPlanilla(empresaRaw);

    const firmaUrl = await uploadBase64Png(
      "firmas_digitales",
      `epp/${payload.empresa_id}/${dniEmpleado}_${Date.now()}.png`,
      payload.firma,
    );

    let firmaEmpleadorUrl: string | null = null;
    if (payload.firma_empleador) {
      firmaEmpleadorUrl = await uploadBase64Png(
        "firmas_digitales",
        `epp/${payload.empresa_id}/empleador_${Date.now()}.png`,
        payload.firma_empleador,
      );
    }

    const entregadoAt = normalizeEntregadoAt(payload.fecha_entrega);
    const entregasData = payload.items.map((item) => ({
      empresa_id: payload.empresa_id,
      preventor_id: user.id,
      epp_tipo_id: item.epp_tipo_id,
      empleado_id: empleado.id,
      empleado_nombre: nombreEmpleado,
      empleado_documento: dniEmpleado,
      cantidad: item.cantidad || 1,
      marca: item.marca || null,
      modelo: item.modelo || null,
      certificacion: item.certificacion || null,
      entregado_at: entregadoAt,
      firma_empleado_url: firmaUrl,
      firma_empleador_url: firmaEmpleadorUrl,
      estado: "firmada",
      origen: "panel",
    }));

    const { data: entregas, error: entregaError } = await supabaseAdmin
      .from("epp_entregas")
      .insert(entregasData)
      .select(`*, epp_tipos(id, nombre, descripcion, foto_url)`);

    if (entregaError) throw entregaError;
    const rows = (entregas ?? []) as EntregaRow[];
    if (rows.length === 0) {
      throw new HttpError(500, "No se pudieron registrar las entregas");
    }

    // Un PDF oficial por cada entrega (1 ítem = 1 línea en planilla Anexo I)
    for (const row of rows) {
      void this.generarYGuardarPdf(user, row).catch((err) => {
        console.error(`Error generando PDF de entrega EPP ${row.id}:`, err);
      });
    }

    const mapped = rows.map((e) => mapEntrega(e));

    return {
      success: true,
      entregas: mapped,
      pdf_url: null,
      pdf_generando: true,
      advertencia_empresa: empresaNorm.datos_incompletos
        ? "La empresa tiene datos incompletos (provincia, domicilio, etc.). En el PDF aparecerá «Sin especificar». Completá los datos en Administración > Empresas."
        : null,
    };
  },

  async generarYGuardarPdf(_user: AuthUser, entrega: EntregaRow): Promise<string> {
    const { data: empresaRaw, error: empresaError } = await supabaseAdmin
      .from("empresas")
      .select(
        "razon_social, cuit, actividad, logo_url, domicilio, localidad, codigo_postal, provincia, consultora_id",
      )
      .eq("id", entrega.empresa_id)
      .single();
    if (empresaError) throw empresaError;
    const empresa = normalizarEmpresaParaPlanilla(empresaRaw);

    const firmaBuffer = await storageService.downloadBuffer(
      entrega.firma_empleado_url,
    );

    let consultora: { nombre?: string | null; logo_url?: string | null } | null =
      null;
    if (empresaRaw?.consultora_id) {
      const { data: cons } = await supabaseAdmin
        .from("consultoras")
        .select("nombre, logo_url")
        .eq("id", empresaRaw.consultora_id)
        .maybeSingle();
      consultora = cons;
    }

    let empleadoSector: string | null = null;
    if (entrega.empleado_id) {
      const { data: empleado } = await supabaseAdmin
        .from("empleados")
        .select("sector")
        .eq("id", entrega.empleado_id)
        .maybeSingle();
      empleadoSector = empleado?.sector?.trim() || null;
    }

    const pdfBuffer = await eppPdfService.generarConstanciaInterna({
      empresa: {
        razon_social: empresa.razon_social,
        cuit: empresa.cuit,
        actividad: empresa.actividad,
        logo_url: empresa.logo_url,
      },
      consultora,
      empleado: {
        nombre: entrega.empleado_nombre,
        dni: entrega.empleado_documento,
        sector: empleadoSector,
      },
      items: [
        {
          epp_tipos: firstRelation(entrega.epp_tipos) ?? entrega.epp_tipos,
          cantidad: entrega.cantidad,
          marca: entrega.marca,
          modelo: entrega.modelo,
          certificacion: entrega.certificacion,
          fecha_entrega: entrega.entregado_at,
          firmaUrl: entrega.firma_empleado_url,
          firmaBuffer,
        },
      ],
      fecha: entrega.entregado_at,
      firmaUrl: entrega.firma_empleado_url,
      firmaBuffer,
    });

    const pdfPath = `epp/pdf/${entrega.empresa_id}/${entrega.empleado_documento}_${entrega.id}.pdf`;
    const { error: pdfUploadError } = await supabaseAdmin.storage
      .from("informes_pdf")
      .upload(pdfPath, pdfBuffer, {
        contentType: "application/pdf",
        upsert: true,
      });

    if (pdfUploadError) {
      throw new HttpError(
        500,
        `La entrega se registró pero falló el PDF: ${pdfUploadError.message}`,
      );
    }

    const pdfUrl = supabaseAdmin.storage
      .from("informes_pdf")
      .getPublicUrl(pdfPath).data.publicUrl;

    await supabaseAdmin
      .from("epp_entregas")
      .update({ url_registro_oficial: pdfUrl })
      .eq("id", entrega.id);

    return pdfUrl;
  },

  /**
   * Una planilla Anexo I con varios renglones; misma URL en todas las filas del lote.
   */
  async generarYGuardarPdfLote(entregas: EntregaRow[]): Promise<string> {
    if (entregas.length === 0) {
      throw new HttpError(400, "No hay entregas para generar el PDF");
    }
    const primera = entregas[0];

    const { data: empresaRaw, error: empresaError } = await supabaseAdmin
      .from("empresas")
      .select(
        "razon_social, cuit, actividad, logo_url, domicilio, localidad, codigo_postal, provincia, consultora_id",
      )
      .eq("id", primera.empresa_id)
      .single();
    if (empresaError) throw empresaError;
    const empresa = normalizarEmpresaParaPlanilla(empresaRaw);

    let empleadoPuesto: string | null = null;
    let empleadoEppNecesarios: string | null = null;
    if (primera.empleado_id) {
      const { data: empleado } = await supabaseAdmin
        .from("empleados")
        .select("puesto, epp_necesarios, sector")
        .eq("id", primera.empleado_id)
        .maybeSingle();
      empleadoPuesto = empleado?.puesto?.trim() || empleado?.sector?.trim() || null;
      empleadoEppNecesarios = empleado?.epp_necesarios?.trim() || null;
    }

    const firmaBuffer = primera.firma_empleado_url
      ? await storageService.downloadBuffer(primera.firma_empleado_url)
      : null;

    const pdfBuffer = await eppPdfService.generarPlanillaAnexoI({
      empresa: {
        razon_social: empresa.razon_social,
        cuit: empresa.cuit,
        domicilio: empresa.domicilio,
        localidad: empresa.localidad,
        codigo_postal: empresa.codigo_postal,
        provincia: empresa.provincia,
        actividad: empresa.actividad,
        logo_url: empresa.logo_url,
      },
      empleado: {
        nombre: primera.empleado_nombre,
        dni: primera.empleado_documento,
        puesto: empleadoPuesto,
        epp_necesarios: empleadoEppNecesarios,
      },
      items: entregas.map((entrega) => ({
        epp_tipos: firstRelation(entrega.epp_tipos) ?? entrega.epp_tipos ?? null,
        cantidad: entrega.cantidad,
        marca: entrega.marca,
        modelo: entrega.modelo,
        certificacion: entrega.certificacion,
        fecha_entrega: entrega.entregado_at,
        firmaUrl: entrega.firma_empleado_url,
        firmaBuffer,
      })),
    });

    const loteId = entregas.map((e) => e.id).sort().join("_").slice(0, 80);
    const pdfPath = `epp/pdf/${primera.empresa_id}/${primera.empleado_documento}_lote_${loteId}.pdf`;
    const { error: pdfUploadError } = await supabaseAdmin.storage
      .from("informes_pdf")
      .upload(pdfPath, pdfBuffer, {
        contentType: "application/pdf",
        upsert: true,
      });

    if (pdfUploadError) {
      throw new HttpError(
        500,
        `La entrega se registró pero falló el PDF: ${pdfUploadError.message}`,
      );
    }

    const pdfUrl = supabaseAdmin.storage
      .from("informes_pdf")
      .getPublicUrl(pdfPath).data.publicUrl;

    const ids = entregas.map((e) => e.id);
    await supabaseAdmin
      .from("epp_entregas")
      .update({ url_registro_oficial: pdfUrl })
      .in("id", ids);

    return pdfUrl;
  },

  async regenerarPdf(user: AuthUser, entregaId: string) {
    const { data: entrega, error } = await supabaseAdmin
      .from("epp_entregas")
      .select(`*, epp_tipos(id, nombre, descripcion, foto_url)`)
      .eq("id", entregaId)
      .single();
    if (error || !entrega) throw new HttpError(404, "Entrega de EPP no encontrada");

    const pdfUrl = await this.generarYGuardarPdf(
      user,
      entrega as EntregaRow,
    );
    return { success: true, pdf_url: pdfUrl };
  },

  async descargarPdf(entregaId: string): Promise<{ buffer: Buffer; filename: string }> {
    const { data: entrega, error } = await supabaseAdmin
      .from("epp_entregas")
      .select(
        `id, empresa_id, preventor_id, empleado_id, empleado_nombre, empleado_documento, cantidad, marca, modelo, certificacion, entregado_at, firma_empleado_url, firma_empleador_url, estado, url_registro_oficial, epp_tipo_id, epp_tipos(id, nombre, descripcion, foto_url)`,
      )
      .eq("id", entregaId)
      .single();

    if (error || !entrega) throw new HttpError(404, "Entrega de EPP no encontrada");

    const entregaRow: EntregaRow = {
      ...(entrega as Omit<EntregaRow, "epp_tipos">),
      epp_tipos: firstRelation(
        (entrega as { epp_tipos?: EntregaRow["epp_tipos"] | EntregaRow["epp_tipos"][] })
          .epp_tipos,
      ),
    };

    // Siempre regenerar: evita servir constancias cacheadas con firma de empleador.
    const pdfUrl = await this.generarYGuardarPdf(
      { id: "sistema", rol: "preventor" },
      entregaRow,
    );

    const bucketName = "informes_pdf";
    const parts = pdfUrl.split(`/public/${bucketName}/`);
    if (parts.length < 2) {
      throw new HttpError(400, "Ruta del archivo PDF inválida");
    }

    const { data: fileData, error: downloadError } = await supabaseAdmin.storage
      .from(bucketName)
      .download(parts[1]);
    if (downloadError || !fileData) {
      throw new HttpError(500, "No se pudo obtener el archivo del storage");
    }

    const buffer = Buffer.from(await fileData.arrayBuffer());
    return {
      buffer,
      filename: `Constancia_EPP_${entregaRow.empleado_documento}.pdf`,
    };
  },

  async listarProveedores(consultoraId: string) {
    const { data, error } = await supabaseAdmin
      .from("epp_proveedores")
      .select("*")
      .eq("consultora_id", consultoraId)
      .order("nombre");
    if (error) throw error;
    return { proveedores: data ?? [] };
  },

  async crearProveedor(
    consultoraId: string,
    payload: {
      nombre: string;
      email: string;
      direccion?: string | null;
      telefono?: string | null;
    },
  ) {
    const { data, error } = await supabaseAdmin
      .from("epp_proveedores")
      .insert({
        consultora_id: consultoraId,
        nombre: payload.nombre.trim(),
        email: payload.email.trim().toLowerCase(),
        direccion: payload.direccion?.trim() || null,
        telefono: payload.telefono?.trim() || null,
        activo: true,
      })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async actualizarProveedor(
    consultoraId: string,
    id: string,
    payload: {
      nombre?: string;
      email?: string;
      direccion?: string | null;
      telefono?: string | null;
      activo?: boolean;
    },
  ) {
    const updates: Record<string, unknown> = {};
    if (payload.nombre !== undefined) updates.nombre = payload.nombre.trim();
    if (payload.email !== undefined) updates.email = payload.email.trim().toLowerCase();
    if (payload.direccion !== undefined) {
      updates.direccion = payload.direccion?.trim() || null;
    }
    if (payload.telefono !== undefined) {
      updates.telefono = payload.telefono?.trim() || null;
    }
    if (payload.activo !== undefined) updates.activo = payload.activo;

    const { data, error } = await supabaseAdmin
      .from("epp_proveedores")
      .update(updates)
      .eq("id", id)
      .eq("consultora_id", consultoraId)
      .select()
      .single();
    if (error) throw error;
    if (!data) throw new HttpError(404, "Proveedor no encontrado");
    return data;
  },

  async eliminarProveedor(consultoraId: string, id: string) {
    const { data, error } = await supabaseAdmin
      .from("epp_proveedores")
      .update({ activo: false })
      .eq("id", id)
      .eq("consultora_id", consultoraId)
      .eq("activo", true)
      .select("id, nombre")
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new HttpError(404, "Proveedor no encontrado");
    return { success: true, id: data.id };
  },

  async listarLicitaciones(
    empresaId: string,
    opts?: { limit?: number; offset?: number; q?: string },
  ) {
    const limit = clampInt(opts?.limit, 10, 1, 100);
    const offset = clampInt(opts?.offset, 0, 0, 500_000);
    const q = sanitizeSearchTerm(opts?.q);

    let query = supabaseAdmin
      .from("epp_licitaciones")
      .select(
        `
        *,
        epp_licitacion_items(*, epp_tipos(id, nombre, descripcion, foto_url)),
        epp_licitacion_cotizaciones!epp_licitacion_cotizaciones_licitacion_id_fkey(*)
      `,
        { count: "exact" },
      )
      .eq("empresa_id", empresaId);

    if (q) {
      query = query.or(
        `titulo.ilike.%${q}%,comprador_nombre.ilike.%${q}%,descripcion.ilike.%${q}%`,
      );
    }

    const { data, error, count } = await query
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;

    const licitaciones = await Promise.all(
      (data ?? []).map(async (lic) => {
        const cotizaciones = Array.isArray(lic.epp_licitacion_cotizaciones)
          ? lic.epp_licitacion_cotizaciones
          : [];
        return ocultarComisionLicitacion({
          ...lic,
          epp_licitacion_cotizaciones:
            await firmarPresupuestosCotizaciones(cotizaciones),
        });
      }),
    );

    const { data: estadoRows, error: estadoError } = await supabaseAdmin
      .from("epp_licitaciones")
      .select("estado")
      .eq("empresa_id", empresaId);
    if (estadoError) throw estadoError;

    const stats = { abiertas: 0, adjudicacion: 0, cerradas: 0 };
    for (const row of estadoRows ?? []) {
      if (row.estado === "abierta") stats.abiertas += 1;
      else if (row.estado === "adjudicacion") stats.adjudicacion += 1;
      else if (row.estado === "cerrada") stats.cerradas += 1;
    }

    return {
      licitaciones,
      total: count ?? 0,
      limit,
      offset,
      stats,
    };
  },

  async crearLicitacion(
    user: AuthUser,
    payload: {
      empresa_id: string;
      titulo: string;
      descripcion?: string | null;
      fecha_cierre?: string | null;
      comprador_nombre: string;
      comprador_email: string;
      comprador_telefono: string;
      proveedor_ids: string[];
      items: Array<{
        epp_tipo_id?: string | null;
        nombre_manual?: string | null;
        cantidad: number;
      }>;
    },
  ) {
    const consultoraId = requireConsultoraId(user);
    const comision = await getComisionPorcentaje(consultoraId);

    const { data: maxRow, error: maxError } = await supabaseAdmin
      .from("epp_licitaciones")
      .select("numero")
      .eq("consultora_id", consultoraId)
      .order("numero", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (maxError) throw maxError;
    const siguienteNumero = Number(maxRow?.numero ?? 0) + 1;

    const { data: licitacion, error: licError } = await supabaseAdmin
      .from("epp_licitaciones")
      .insert({
        empresa_id: payload.empresa_id,
        consultora_id: consultoraId,
        titulo: payload.titulo.trim(),
        descripcion: payload.descripcion?.trim() || null,
        fecha_cierre: payload.fecha_cierre || null,
        comprador_nombre: payload.comprador_nombre.trim(),
        comprador_email: payload.comprador_email.trim().toLowerCase(),
        comprador_telefono: payload.comprador_telefono.trim(),
        estado: "abierta",
        comision_porcentaje: comision,
        numero: siguienteNumero,
      })
      .select()
      .single();
    if (licError) throw licError;

    const { error: itemsError } = await supabaseAdmin.from("epp_licitacion_items").insert(
      payload.items.map((item) => {
        const nombreManual = item.nombre_manual?.trim() || null;
        return {
          licitacion_id: licitacion.id,
          epp_tipo_id: nombreManual ? null : item.epp_tipo_id || null,
          nombre_manual: nombreManual,
          cantidad: item.cantidad,
        };
      }),
    );
    if (itemsError) throw itemsError;

    const { data: proveedores, error: provError } = await supabaseAdmin
      .from("epp_proveedores")
      .select("*")
      .in("id", payload.proveedor_ids)
      .eq("consultora_id", consultoraId);
    if (provError) throw provError;
    if (!proveedores || proveedores.length === 0) {
      throw new HttpError(400, "No se encontraron proveedores válidos");
    }

    const cotizacionesPayload = proveedores.map((prov) => {
      const token = randomUUID();
      return {
        licitacion_id: licitacion.id,
        proveedor_id: prov.id,
        proveedor_nombre: prov.nombre,
        proveedor_email: prov.email,
        token_publico: token,
        url_carga: `${env.FRONTEND_URL}/cotizar/${token}`,
        estado: "pendiente",
      };
    });

    const { data: cotizaciones, error: cotError } = await supabaseAdmin
      .from("epp_licitacion_cotizaciones")
      .insert(cotizacionesPayload)
      .select();
    if (cotError) throw cotError;

    return {
      licitacion,
      cotizaciones: cotizaciones ?? [],
    };
  },

  async obtenerLicitacion(licitacionId: string) {
    const { data, error } = await supabaseAdmin
      .from("epp_licitaciones")
      .select(
        `
        *,
        empresas(id, razon_social),
        epp_licitacion_items(*, epp_tipos(id, nombre, descripcion, foto_url)),
        epp_licitacion_cotizaciones!epp_licitacion_cotizaciones_licitacion_id_fkey(*)
      `,
      )
      .eq("id", licitacionId)
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new HttpError(404, "Licitación no encontrada");

    const empresas = firstRelation(data.empresas);
    const cotizacionesRaw = (
      Array.isArray(data.epp_licitacion_cotizaciones)
        ? data.epp_licitacion_cotizaciones
        : []
    ) as Array<CotizacionResumen & { presupuesto_pdf_url?: string | null }>;
    const cotizaciones = await firmarPresupuestosCotizaciones(cotizacionesRaw);
    const ganador = cotizaciones.find((c) => c.id === data.ganador_cotizacion_id) ?? null;

    return ocultarComisionLicitacion({
      ...data,
      empresas,
      epp_licitacion_cotizaciones: cotizaciones,
      mensaje_adjudicacion: buildMensajeAdjudicacion({
        titulo: data.titulo,
        empresaNombre: empresas?.razon_social ?? "la empresa",
        compradorNombre: data.comprador_nombre,
        ganadorNombre: ganador?.proveedor_nombre ?? null,
        numero: data.numero,
      }),
    });
  },

  async agregarProveedorALicitacion(
    user: AuthUser,
    licitacionId: string,
    proveedorId: string,
  ) {
    const consultoraId = requireConsultoraId(user);
    const { data: licitacion, error: licError } = await supabaseAdmin
      .from("epp_licitaciones")
      .select("id, estado, consultora_id, titulo")
      .eq("id", licitacionId)
      .maybeSingle();
    if (licError) throw licError;
    if (!licitacion) throw new HttpError(404, "Licitación no encontrada");
    if (licitacion.consultora_id !== consultoraId) {
      throw new HttpError(403, "No tenés acceso a esta licitación");
    }
    if (licitacion.estado !== "abierta") {
      throw new HttpError(
        400,
        "Solo se pueden agregar proveedores mientras la licitación está abierta",
      );
    }

    const { data: proveedor, error: provError } = await supabaseAdmin
      .from("epp_proveedores")
      .select("*")
      .eq("id", proveedorId)
      .eq("consultora_id", consultoraId)
      .eq("activo", true)
      .maybeSingle();
    if (provError) throw provError;
    if (!proveedor) throw new HttpError(404, "Proveedor no encontrado");

    const { data: existente, error: existError } = await supabaseAdmin
      .from("epp_licitacion_cotizaciones")
      .select("id")
      .eq("licitacion_id", licitacionId)
      .eq("proveedor_id", proveedorId)
      .maybeSingle();
    if (existError) throw existError;
    if (existente) {
      throw new HttpError(409, "Ese proveedor ya está invitado a esta licitación");
    }

    const token = randomUUID();
    const { data: cotizacion, error: cotError } = await supabaseAdmin
      .from("epp_licitacion_cotizaciones")
      .insert({
        licitacion_id: licitacionId,
        proveedor_id: proveedor.id,
        proveedor_nombre: proveedor.nombre,
        proveedor_email: proveedor.email,
        token_publico: token,
        url_carga: `${env.FRONTEND_URL}/cotizar/${token}`,
        estado: "pendiente",
      })
      .select()
      .single();
    if (cotError) throw cotError;

    return { cotizacion };
  },

  async actualizarEstadoLicitacion(
    user: AuthUser,
    licitacionId: string,
    payload: {
      estado: "abierta" | "adjudicacion" | "cerrada";
      ganador_cotizacion_id?: string | null;
    },
  ) {
    const consultoraId = requireConsultoraId(user);
    const { data: licitacion, error: licError } = await supabaseAdmin
      .from("epp_licitaciones")
      .select(
        `
        *,
        empresas(id, razon_social),
        epp_licitacion_cotizaciones!epp_licitacion_cotizaciones_licitacion_id_fkey(
          id, estado, proveedor_nombre, proveedor_email
        )
      `,
      )
      .eq("id", licitacionId)
      .maybeSingle();
    if (licError) throw licError;
    if (!licitacion) throw new HttpError(404, "Licitación no encontrada");
    if (licitacion.consultora_id !== consultoraId) {
      throw new HttpError(403, "No tenés acceso a esta licitación");
    }

    const estadoActual = licitacion.estado as LicitacionEstado;
    const estadoNuevo = payload.estado;
    if (estadoActual === "cerrada" && estadoNuevo !== "cerrada") {
      throw new HttpError(400, "Una licitación cerrada no se puede reabrir");
    }

    const allowed: Record<LicitacionEstado, LicitacionEstado[]> = {
      abierta: ["abierta", "adjudicacion", "cerrada"],
      adjudicacion: ["adjudicacion", "abierta", "cerrada"],
      cerrada: ["cerrada"],
    };
    if (!allowed[estadoActual]?.includes(estadoNuevo)) {
      throw new HttpError(400, `No se puede pasar de ${estadoActual} a ${estadoNuevo}`);
    }

    const cotizaciones = (
      Array.isArray(licitacion.epp_licitacion_cotizaciones)
        ? licitacion.epp_licitacion_cotizaciones
        : []
    ) as CotizacionResumen[];
    const cargadas = cotizaciones.filter((c) => c.estado === "cargada");

    let ganadorId =
      payload.ganador_cotizacion_id === undefined
        ? licitacion.ganador_cotizacion_id
        : payload.ganador_cotizacion_id;

    if (estadoNuevo === "cerrada" && cargadas.length > 0 && !ganadorId) {
      throw new HttpError(
        400,
        "Para cerrar la licitación debés indicar qué cotización ganó",
      );
    }

    if (ganadorId) {
      const ganador = cotizaciones.find((c) => c.id === ganadorId);
      if (!ganador) {
        throw new HttpError(400, "La cotización ganadora no pertenece a esta licitación");
      }
      if (ganador.estado !== "cargada") {
        throw new HttpError(
          400,
          "Solo se puede adjudicar una cotización que ya fue cargada",
        );
      }
    }

    if (estadoNuevo === "abierta") {
      ganadorId = null;
    }

    const updatePayload: Record<string, unknown> = {
      estado: estadoNuevo,
      ganador_cotizacion_id: ganadorId,
    };

    const necesitaAdjudicacion =
      Boolean(ganadorId) &&
      (estadoNuevo === "adjudicacion" || estadoNuevo === "cerrada");

    if (necesitaAdjudicacion) {
      const token = licitacion.token_adjudicacion || randomUUID();
      updatePayload.token_adjudicacion = token;
      updatePayload.url_adjudicacion = `${env.FRONTEND_URL}/adjudicacion-epp/${token}`;
      if (!licitacion.adjudicado_at || ganadorId !== licitacion.ganador_cotizacion_id) {
        updatePayload.adjudicado_at = new Date().toISOString();
      }
    }

    if (estadoNuevo === "abierta") {
      updatePayload.token_adjudicacion = null;
      updatePayload.url_adjudicacion = null;
      updatePayload.adjudicado_at = null;
    }

    const { error: updateError } = await supabaseAdmin
      .from("epp_licitaciones")
      .update(updatePayload)
      .eq("id", licitacionId);
    if (updateError) throw updateError;

    return this.obtenerLicitacion(licitacionId);
  },

  async obtenerAdjudicacionPublica(token: string) {
    const { data, error } = await supabaseAdmin
      .from("epp_licitaciones")
      .select(
        `
        id, titulo, estado, comprador_nombre, comprador_email, comprador_telefono,
        ganador_cotizacion_id, adjudicado_at, url_adjudicacion, numero,
        empresas(razon_social),
        epp_licitacion_cotizaciones!epp_licitacion_cotizaciones_licitacion_id_fkey(
          id, proveedor_nombre, proveedor_email, monto, estado
        )
      `,
      )
      .eq("token_adjudicacion", token)
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new HttpError(404, "Enlace de adjudicación inválido");
    if (!data.ganador_cotizacion_id) {
      throw new HttpError(404, "Esta licitación aún no tiene ganador adjudicado");
    }

    const empresas = firstRelation(data.empresas);
    const cotizaciones = (
      Array.isArray(data.epp_licitacion_cotizaciones)
        ? data.epp_licitacion_cotizaciones
        : []
    ) as CotizacionResumen[];
    const ganador = cotizaciones.find((c) => c.id === data.ganador_cotizacion_id);
    if (!ganador) {
      throw new HttpError(404, "No se encontró la cotización ganadora");
    }

    const empresaNombre = empresas?.razon_social ?? "la empresa";
    const mensaje = buildMensajeAdjudicacion({
      titulo: data.titulo,
      empresaNombre,
      compradorNombre: data.comprador_nombre,
      ganadorNombre: ganador.proveedor_nombre,
      numero: data.numero,
    });

    return {
      titulo: data.titulo,
      numero: data.numero ?? null,
      codigo: data.numero != null ? formatLicNumero(data.numero) : null,
      estado: data.estado,
      empresa: empresaNombre,
      comprador_nombre: data.comprador_nombre,
      comprador_email: data.comprador_email,
      comprador_telefono: data.comprador_telefono,
      ganador_nombre: ganador.proveedor_nombre,
      adjudicado_at: data.adjudicado_at,
      mensaje,
    };
  },

  async obtenerCotizacionPublica(token: string) {
    const { data: cotizacion, error } = await supabaseAdmin
      .from("epp_licitacion_cotizaciones")
      .select(
        `
        id, proveedor_nombre, proveedor_email, monto, estado, items_ofertados,
        epp_licitaciones!epp_licitacion_cotizaciones_licitacion_id_fkey(
          id, titulo, descripcion, estado, fecha_cierre,
          comprador_nombre, comprador_email, comprador_telefono,
          empresas(razon_social),
          epp_licitacion_items(cantidad, nombre_manual, epp_tipos(id, nombre, descripcion, foto_url))
        )
      `,
      )
      .eq("token_publico", token)
      .maybeSingle();

    if (error) throw error;
    if (!cotizacion) throw new HttpError(404, "Enlace de cotización inválido");

    const licitacion = firstRelation(cotizacion.epp_licitaciones);
    if (licitacion && licitacion.estado !== "abierta") {
      throw new HttpError(410, "Esta licitación ya no acepta cotizaciones");
    }
    if (
      licitacion?.fecha_cierre &&
      new Date(licitacion.fecha_cierre).getTime() < Date.now()
    ) {
      throw new HttpError(410, "El plazo de cotización expiró");
    }

    return {
      ...cotizacion,
      epp_licitaciones: licitacion
        ? {
            ...licitacion,
            empresas: firstRelation(licitacion.empresas),
          }
        : null,
    };
  },

  async cargarCotizacionPublica(
    token: string,
    payload: {
      proveedor_nombre?: string;
      monto: number;
      items_ofertados: Array<{
        epp_tipo_id?: string | null;
        nombre?: string | null;
        cantidad: number;
        precio_unitario: number;
      }>;
    },
    presupuestoFile?: Express.Multer.File,
  ) {
    if (!presupuestoFile) {
      throw new HttpError(400, "Debés adjuntar el presupuesto formal en PDF");
    }
    const mime = (presupuestoFile.mimetype || "").toLowerCase();
    const name = (presupuestoFile.originalname || "").toLowerCase();
    if (mime !== "application/pdf" && !name.endsWith(".pdf")) {
      throw new HttpError(400, "El presupuesto debe ser un archivo PDF");
    }

    const { data: cotizacion, error } = await supabaseAdmin
      .from("epp_licitacion_cotizaciones")
      .select(
        `
        id, licitacion_id, estado, proveedor_nombre,
        epp_licitaciones!epp_licitacion_cotizaciones_licitacion_id_fkey(
          id, titulo, numero, estado, fecha_cierre, comision_porcentaje,
          empresa_id, consultora_id,
          empresas(razon_social)
        )
      `,
      )
      .eq("token_publico", token)
      .maybeSingle();

    if (error) throw error;
    if (!cotizacion) throw new HttpError(404, "Enlace de cotización inválido");

    const licitacion = firstRelation(cotizacion.epp_licitaciones);

    if (!licitacion || licitacion.estado !== "abierta") {
      throw new HttpError(410, "Esta licitación ya no acepta cotizaciones");
    }
    if (
      licitacion.fecha_cierre &&
      new Date(licitacion.fecha_cierre).getTime() < Date.now()
    ) {
      throw new HttpError(410, "El plazo de cotización expiró");
    }

    if (cotizacion.estado === "cargada") {
      throw new HttpError(409, "Esta cotización ya fue enviada");
    }

    const pdfPath = `epp/cotizaciones/${cotizacion.licitacion_id}/${cotizacion.id}_${Date.now()}.pdf`;
    await storageService.subirArchivo("informes_pdf", pdfPath, presupuestoFile);
    const presupuestoPdfUrl = storageService.obtenerUrlPublica("informes_pdf", pdfPath);

    const comisionPct = Number(licitacion.comision_porcentaje ?? 0);
    const comisionCalculada = Number(((payload.monto * comisionPct) / 100).toFixed(2));
    const proveedorNombre =
      payload.proveedor_nombre?.trim() || cotizacion.proveedor_nombre || "Un proveedor";

    const { data, error: updateError } = await supabaseAdmin
      .from("epp_licitacion_cotizaciones")
      .update({
        monto: payload.monto,
        items_ofertados: payload.items_ofertados,
        comision_calculada: comisionCalculada,
        presupuesto_pdf_url: presupuestoPdfUrl,
        estado: "cargada",
        ...(payload.proveedor_nombre ? { proveedor_nombre: payload.proveedor_nombre } : {}),
      })
      .eq("id", cotizacion.id)
      .select()
      .single();

    if (updateError) throw updateError;

    const empresa = firstRelation(
      (licitacion as { empresas?: { razon_social?: string } | { razon_social?: string }[] })
        .empresas,
    );
    const montoFmt = new Intl.NumberFormat("es-AR", {
      style: "currency",
      currency: "ARS",
      maximumFractionDigits: 0,
    }).format(Number(payload.monto));

    void notificacionService
      .enviarAEquipoEmpresa({
        consultora_id: licitacion.consultora_id,
        empresa_id: licitacion.empresa_id,
        tipo: "success",
        titulo: "Nueva cotización EPP",
        mensaje: `${proveedorNombre} respondió la licitación ${
          licitacion.numero != null ? `${formatLicNumero(licitacion.numero)} ` : ""
        }“${licitacion.titulo}”${
          empresa?.razon_social ? ` (${empresa.razon_social})` : ""
        } por ${montoFmt}. Revisala en EPP → Licitación.`,
      })
      .catch((err) => {
        console.error(
          "No se pudo notificar cotización EPP:",
          cotizacion.id,
          err,
        );
      });

    return data;
  },

  async listarHistorico(empresaId: string, opts: EppHistoricoFiltros = {}) {
    const limit = clampInt(opts.limit, HISTORICO_PAGE_DEFAULT, 1, HISTORICO_PAGE_MAX);
    const offset = clampInt(opts.offset, 0, 0, 500_000);

    let query = supabaseAdmin
      .from("epp_entregas")
      .select(
        `
        id,
        empleado_id,
        empleado_nombre,
        empleado_documento,
        cantidad,
        marca,
        modelo,
        certificacion,
        entregado_at,
        url_registro_oficial,
        epp_tipos(id, nombre)
      `,
        { count: "exact" },
      )
      .eq("empresa_id", empresaId)
      .neq("estado", "anulada");

    query = applyEppHistoricoFilters(query, opts);

    const { data, error, count } = await query
      .order("entregado_at", { ascending: false, nullsFirst: false })
      .order("id", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;

    return {
      registros: mapEppHistoricoRows(data ?? []),
      total: count ?? 0,
      limit,
      offset,
    };
  },

  async exportarHistorico(empresaId: string, opts: EppHistoricoFiltros = {}) {
    const fetched = await this.cargarEntregasHistoricoExport(
      empresaId,
      opts,
      HISTORICO_EXPORT_MAX,
    );
    const { empresa, entregas, total } = fetched;

    if (total > HISTORICO_EXPORT_MAX) {
      throw new HttpError(
        400,
        `Hay más de ${HISTORICO_EXPORT_MAX} registros. Acotá los filtros antes de exportar.`,
      );
    }

    const filtrosResumen = [
      opts.trabajador ? `trabajador="${opts.trabajador}"` : null,
      opts.producto ? `producto="${opts.producto}"` : null,
      opts.fecha_desde ? `desde=${opts.fecha_desde}` : null,
      opts.fecha_hasta ? `hasta=${opts.fecha_hasta}` : null,
    ]
      .filter(Boolean)
      .join(" · ");

    const rows = entregas.map((e) => {
      const tipo = firstRelation(e.epp_tipos);
      return {
        trabajador: e.empleado_nombre || "Sin nombre",
        dni: e.empleado_documento || "",
        producto: tipo?.nombre || "—",
        modelo: e.modelo || "",
        marca: e.marca || "",
        certificacion: e.certificacion || "",
        cantidad: e.cantidad || 1,
        fecha: e.entregado_at || "",
        firma: null as Buffer | null,
      };
    });

    const buffer = await buildHistoricoEppExcel({
      empresa: {
        razon_social: empresa.razon_social,
        cuit: empresa.cuit,
        domicilio: empresa.domicilio,
        localidad: empresa.localidad,
        codigo_postal: empresa.codigo_postal,
        provincia: empresa.provincia,
      },
      rows,
      filtrosResumen: filtrosResumen || null,
    });

    return {
      buffer,
      filename: `Planilla_EPP_historico_${empresa.cuit || empresaId.slice(0, 8)}.xlsx`,
      entregas: rows.length,
    };
  },

  /**
   * PDF histórico oficial Anexo I: una planilla por trabajador
   * (empresa + padrón puesto/EPP + actos de entrega).
   */
  async exportarHistoricoPdf(empresaId: string, opts: EppHistoricoFiltros = {}) {
    const fetched = await this.cargarEntregasHistoricoExport(
      empresaId,
      opts,
      HISTORICO_PDF_MAX_ENTREGAS,
    );
    const { empresa, entregas, total } = fetched;

    if (total > HISTORICO_PDF_MAX_ENTREGAS) {
      throw new HttpError(
        400,
        `Hay más de ${HISTORICO_PDF_MAX_ENTREGAS} entregas. Acotá los filtros (fechas / trabajador) antes de exportar el PDF.`,
      );
    }

    const filtrosResumen = [
      opts.trabajador ? `trabajador="${opts.trabajador}"` : null,
      opts.producto ? `producto="${opts.producto}"` : null,
      opts.fecha_desde ? `desde=${opts.fecha_desde}` : null,
      opts.fecha_hasta ? `hasta=${opts.fecha_hasta}` : null,
    ]
      .filter(Boolean)
      .join(" · ");

    type GroupKey = string;
    const groups = new Map<
      GroupKey,
      {
        empleadoId: string | null;
        nombre: string;
        dni: string;
        entregas: typeof entregas;
      }
    >();

    for (const entrega of entregas) {
      const dni = (entrega.empleado_documento || "").trim();
      const key: GroupKey = entrega.empleado_id
        ? `id:${entrega.empleado_id}`
        : `dni:${dni || entrega.id}`;
      const existing = groups.get(key);
      if (existing) {
        existing.entregas.push(entrega);
      } else {
        groups.set(key, {
          empleadoId: entrega.empleado_id,
          nombre: entrega.empleado_nombre || "Sin nombre",
          dni,
          entregas: [entrega],
        });
      }
    }

    const empleadoIds = [
      ...new Set(
        [...groups.values()]
          .map((g) => g.empleadoId)
          .filter((id): id is string => Boolean(id)),
      ),
    ];

    const padronById = new Map<
      string,
      { puesto: string | null; epp_necesarios: string | null; sector: string | null }
    >();
    if (empleadoIds.length > 0) {
      const { data: empleadosRows, error: empError } = await supabaseAdmin
        .from("empleados")
        .select("id, puesto, epp_necesarios, sector")
        .in("id", empleadoIds);
      if (empError) throw empError;
      for (const row of empleadosRows ?? []) {
        padronById.set(row.id, {
          puesto: row.puesto?.trim() || null,
          epp_necesarios: row.epp_necesarios?.trim() || null,
          sector: row.sector?.trim() || null,
        });
      }
    }

    // Fallback por DNI si no hay empleado_id
    const dnisSinId = [
      ...new Set(
        [...groups.values()]
          .filter((g) => !g.empleadoId && g.dni)
          .map((g) => g.dni),
      ),
    ];
    const padronByDni = new Map<
      string,
      { puesto: string | null; epp_necesarios: string | null; sector: string | null }
    >();
    if (dnisSinId.length > 0) {
      const { data: byDni, error: dniError } = await supabaseAdmin
        .from("empleados")
        .select("documento, puesto, epp_necesarios, sector")
        .eq("empresa_id", empresaId)
        .in("documento", dnisSinId);
      if (dniError) throw dniError;
      for (const row of byDni ?? []) {
        padronByDni.set(row.documento, {
          puesto: row.puesto?.trim() || null,
          epp_necesarios: row.epp_necesarios?.trim() || null,
          sector: row.sector?.trim() || null,
        });
      }
    }

    const planillas = await Promise.all(
      [...groups.values()].map(async (group) => {
        const padron =
          (group.empleadoId ? padronById.get(group.empleadoId) : null) ||
          (group.dni ? padronByDni.get(group.dni) : null) ||
          null;

        const items = await Promise.all(
          group.entregas.map(async (entrega) => {
            const tipo = firstRelation(entrega.epp_tipos);
            const firmaBuffer = entrega.firma_empleado_url
              ? await storageService.downloadBuffer(entrega.firma_empleado_url)
              : null;
            return {
              epp_tipos: tipo,
              cantidad: entrega.cantidad || 1,
              marca: entrega.marca,
              modelo: entrega.modelo,
              certificacion: entrega.certificacion,
              fecha_entrega: entrega.entregado_at || "",
              firmaUrl: entrega.firma_empleado_url,
              firmaBuffer,
            };
          }),
        );

        return {
          empresa: {
            razon_social: empresa.razon_social,
            cuit: empresa.cuit,
            domicilio: empresa.domicilio,
            localidad: empresa.localidad,
            codigo_postal: empresa.codigo_postal,
            provincia: empresa.provincia,
            actividad: empresa.actividad,
            logo_url: empresa.logo_url,
          },
          empleado: {
            nombre: group.nombre,
            dni: group.dni,
            puesto: padron?.puesto || padron?.sector || null,
            epp_necesarios: padron?.epp_necesarios || null,
          },
          items,
          informacion_adicional: [
            `Registro histórico — ${items.length} entrega(s)`,
            filtrosResumen ? `Filtros: ${filtrosResumen}` : null,
          ]
            .filter(Boolean)
            .join(" · "),
        };
      }),
    );

    // Orden alfabético por trabajador
    planillas.sort((a, b) =>
      a.empleado.nombre.localeCompare(b.empleado.nombre, "es", {
        sensitivity: "base",
      }),
    );

    const buffer = await eppPdfService.generarPlanillasAnexoI(planillas);

    return {
      buffer,
      filename: `Anexo_I_EPP_historico_${empresa.cuit || empresaId.slice(0, 8)}.pdf`,
      trabajadores: planillas.length,
      entregas: entregas.length,
    };
  },

  async cargarEntregasHistoricoExport(
    empresaId: string,
    opts: EppHistoricoFiltros,
    maxEntregas: number,
  ) {
    type EntregaExportRow = {
      id: string;
      empleado_id: string | null;
      empleado_nombre: string | null;
      empleado_documento: string | null;
      cantidad: number;
      marca: string | null;
      modelo: string | null;
      certificacion: string | null;
      entregado_at: string;
      firma_empleado_url: string | null;
      epp_tipos:
        | { id: string; nombre: string; descripcion: string | null }
        | { id: string; nombre: string; descripcion: string | null }[]
        | null;
    };

    const entregas: EntregaExportRow[] = [];
    let offset = 0;
    let total = 0;

    do {
      let query = supabaseAdmin
        .from("epp_entregas")
        .select(
          `
          id,
          empleado_id,
          empleado_nombre,
          empleado_documento,
          cantidad,
          marca,
          modelo,
          certificacion,
          entregado_at,
          firma_empleado_url,
          epp_tipos(id, nombre, descripcion)
        `,
          { count: "exact" },
        )
        .eq("empresa_id", empresaId)
        .neq("estado", "anulada");

      query = applyEppHistoricoFilters(query, opts);

      const { data, error, count } = await query
        .order("entregado_at", { ascending: true, nullsFirst: false })
        .order("id", { ascending: true })
        .range(offset, offset + HISTORICO_EXPORT_BATCH - 1);

      if (error) throw error;
      total = count ?? 0;
      entregas.push(...((data ?? []) as unknown as EntregaExportRow[]));
      offset += HISTORICO_EXPORT_BATCH;
      if (entregas.length >= maxEntregas) break;
    } while (offset < total);

    if (total === 0 || entregas.length === 0) {
      throw new HttpError(404, "No hay entregas para exportar con esos filtros");
    }

    const { data: empresaRaw, error: empresaError } = await supabaseAdmin
      .from("empresas")
      .select(
        "razon_social, cuit, actividad, logo_url, domicilio, localidad, codigo_postal, provincia",
      )
      .eq("id", empresaId)
      .single();
    if (empresaError) throw empresaError;

    return {
      empresa: normalizarEmpresaParaPlanilla(empresaRaw),
      entregas,
      total,
    };
  },

  async generarPlanillaHistoricaEmpleado(empleadoId: string) {
    const { data: empleado, error: empleadoError } = await supabaseAdmin
      .from("empleados")
      .select("id, empresa_id, nombre, documento, sector, puesto, epp_necesarios")
      .eq("id", empleadoId)
      .single();

    if (empleadoError || !empleado) {
      throw new HttpError(404, "Trabajador no encontrado");
    }

    const { data: entregas, error: entregasError } = await supabaseAdmin
      .from("epp_entregas")
      .select(`*, epp_tipos(id, nombre, descripcion, foto_url)`)
      .eq("empresa_id", empleado.empresa_id)
      .neq("estado", "anulada")
      .or(
        `empleado_id.eq.${empleadoId},and(empleado_id.is.null,empleado_documento.eq.${empleado.documento})`,
      )
      .order("entregado_at", { ascending: true });

    if (entregasError) throw entregasError;
    if (!entregas?.length) {
      throw new HttpError(404, "No hay entregas registradas para este trabajador");
    }

    const entregasUnicas = Array.from(
      new Map((entregas as EntregaRow[]).map((e) => [e.id, e])).values(),
    );

    const { data: empresaRaw, error: empresaError } = await supabaseAdmin
      .from("empresas")
      .select(
        "razon_social, cuit, actividad, logo_url, domicilio, localidad, codigo_postal, provincia",
      )
      .eq("id", empleado.empresa_id)
      .single();
    if (empresaError) throw empresaError;

    const empresa = normalizarEmpresaParaPlanilla(empresaRaw);
    const items = await Promise.all(
      entregasUnicas.map(async (entrega) => {
        const firmaBuffer = entrega.firma_empleado_url
          ? await storageService.downloadBuffer(entrega.firma_empleado_url)
          : null;

        return {
          epp_tipos: entrega.epp_tipos,
          cantidad: entrega.cantidad,
          marca: entrega.marca,
          modelo: entrega.modelo,
          certificacion: entrega.certificacion,
          fecha_entrega: entrega.entregado_at,
          firmaUrl: entrega.firma_empleado_url,
          firmaBuffer,
        };
      }),
    );

    const pdfBuffer = await eppPdfService.generarPlanillaAnexoI({
      empresa: {
        razon_social: empresa.razon_social,
        cuit: empresa.cuit,
        domicilio: empresa.domicilio,
        localidad: empresa.localidad,
        codigo_postal: empresa.codigo_postal,
        provincia: empresa.provincia,
        actividad: empresa.actividad,
        logo_url: empresa.logo_url,
      },
      empleado: {
        nombre: empleado.nombre,
        dni: empleado.documento,
        puesto: empleado.puesto?.trim() || empleado.sector?.trim() || null,
        epp_necesarios: empleado.epp_necesarios?.trim() || null,
      },
      items,
      informacion_adicional: `Registro histórico consolidado — ${entregasUnicas.length} entrega(s)`,
    });

    return {
      buffer: pdfBuffer,
      filename: `Planilla_EPP_historica_${empleado.documento}.pdf`,
    };
  },

  /**
   * QR imprimible para puntos de entrega (auto-registro del trabajador).
   */
  async generarQrEntrega(empresaId: string) {
    const { data: empresa, error } = await supabaseAdmin
      .from("empresas")
      .select("id, razon_social, token_entrega_epp, estado")
      .eq("id", empresaId)
      .single();

    if (error || !empresa) throw new HttpError(404, "Empresa no encontrada");
    if (empresa.estado && empresa.estado !== "activa") {
      throw new HttpError(400, "La empresa no está activa");
    }

    let token = empresa.token_entrega_epp as string | null;
    if (!token) {
      token = randomUUID();
      const { error: updError } = await supabaseAdmin
        .from("empresas")
        .update({ token_entrega_epp: token })
        .eq("id", empresaId);
      if (updError) throw updError;
    }

    const frontendUrl = env.FRONTEND_URL || "http://localhost:3000";
    const url = `${frontendUrl.replace(/\/$/, "")}/entrega-epp/${token}`;
    const qr = await QRCode.toDataURL(url, {
      width: 480,
      margin: 2,
      color: { dark: "#1e3a8a", light: "#ffffff" },
    });

    return {
      qr,
      url,
      token,
      empresa: { id: empresa.id, razon_social: empresa.razon_social },
    };
  },

  async obtenerEntregaPublica(token: string) {
    const { data: empresa, error } = await supabaseAdmin
      .from("empresas")
      .select("id, razon_social, consultora_id, estado, logo_url")
      .eq("token_entrega_epp", token)
      .maybeSingle();

    if (error) throw error;
    if (!empresa) throw new HttpError(404, "QR de entrega inválido o vencido");
    if (empresa.estado && empresa.estado !== "activa") {
      throw new HttpError(400, "La empresa no acepta entregas en este momento");
    }

    const { data: tipos, error: tiposError } = await supabaseAdmin
      .from("epp_tipos")
      .select("id, nombre, descripcion, foto_url, activo")
      .eq("consultora_id", empresa.consultora_id)
      .eq("activo", true)
      .order("nombre");

    if (tiposError) throw tiposError;

    const tiposConFoto = await Promise.all(
      (tipos ?? []).map(async (tipo) => ({
        ...tipo,
        foto_url: await signedEppFoto(tipo.foto_url),
      })),
    );

    return {
      empresa: {
        id: empresa.id,
        razon_social: empresa.razon_social,
        logo_url: empresa.logo_url,
      },
      tipos: tiposConFoto,
    };
  },

  async buscarEmpleadoEntregaPublica(token: string, dniRaw: string) {
    const dni = dniRaw.replace(/\D/g, "");
    if (!/^\d{7,8}$/.test(dni)) {
      throw new HttpError(400, "El DNI debe tener 7 u 8 números");
    }

    const { data: empresa, error } = await supabaseAdmin
      .from("empresas")
      .select("id, consultora_id, estado")
      .eq("token_entrega_epp", token)
      .maybeSingle();

    if (error) throw error;
    if (!empresa) throw new HttpError(404, "QR de entrega inválido o vencido");
    if (empresa.estado && empresa.estado !== "activa") {
      throw new HttpError(400, "La empresa no acepta entregas en este momento");
    }

    const { data: empleado, error: empError } = await supabaseAdmin
      .from("empleados")
      .select("id, nombre, documento, sector, puesto, epp_necesarios, activo")
      .eq("empresa_id", empresa.id)
      .eq("documento", dni)
      .maybeSingle();

    if (empError) throw empError;
    if (!empleado || !empleado.activo) {
      return { found: false as const };
    }

    const { data: tipos, error: tiposError } = await supabaseAdmin
      .from("epp_tipos")
      .select("id, nombre")
      .eq("consultora_id", empresa.consultora_id)
      .eq("activo", true);

    if (tiposError) throw tiposError;

    const eppTipos = mapEppNecesariosToTipos(
      empleado.epp_necesarios,
      tipos ?? [],
    );

    return {
      found: true as const,
      nombre: empleado.nombre,
      documento: empleado.documento,
      sector: empleado.sector ?? null,
      puesto: empleado.puesto?.trim() || empleado.sector?.trim() || null,
      epp_necesarios: empleado.epp_necesarios?.trim() || null,
      epp_tipos: eppTipos,
    };
  },

  async registrarEntregaPublica(
    token: string,
    payload: {
      nombre_empleado: string;
      dni_empleado: string;
      puesto: string;
      sector?: string | null;
      items: Array<{
        epp_tipo_id: string;
        cantidad: number;
        marca?: string | null;
        modelo?: string | null;
        certificacion?: string | null;
      }>;
      firma: string;
    },
    foto?: Express.Multer.File,
  ) {
    if (!payload.firma.startsWith("data:image/")) {
      throw new HttpError(400, "La firma es inválida");
    }
    if (!payload.items?.length) {
      throw new HttpError(400, "Seleccioná al menos un EPP");
    }

    const puesto = payload.puesto?.trim() || "";
    if (puesto.length < 2) {
      throw new HttpError(400, "El puesto de trabajo es obligatorio (Anexo I)");
    }

    const { data: empresa, error: empresaError } = await supabaseAdmin
      .from("empresas")
      .select(
        "id, razon_social, cuit, domicilio, localidad, codigo_postal, provincia, actividad, logo_url, consultora_id, estado",
      )
      .eq("token_entrega_epp", token)
      .maybeSingle();

    if (empresaError) throw empresaError;
    if (!empresa) throw new HttpError(404, "QR de entrega inválido o vencido");
    if (empresa.estado && empresa.estado !== "activa") {
      throw new HttpError(400, "La empresa no acepta entregas en este momento");
    }

    const tipoIds = [...new Set(payload.items.map((item) => item.epp_tipo_id))];
    const { data: tiposRows, error: tiposError } = await supabaseAdmin
      .from("epp_tipos")
      .select("id, nombre, activo, consultora_id, foto_url")
      .in("id", tipoIds);

    if (tiposError) throw tiposError;
    const tiposById = new Map((tiposRows ?? []).map((t) => [t.id, t]));
    for (const tipoId of tipoIds) {
      const tipo = tiposById.get(tipoId);
      if (!tipo || !tipo.activo || tipo.consultora_id !== empresa.consultora_id) {
        throw new HttpError(400, "El tipo de EPP no es válido para esta empresa");
      }
    }

    const dni = payload.dni_empleado.replace(/\D/g, "");
    const nombre = payload.nombre_empleado.trim();
    const sector = payload.sector?.trim() || null;

    let { data: empleado, error: empLookupError } = await supabaseAdmin
      .from("empleados")
      .select("id, nombre, documento, activo, sector, puesto, epp_necesarios")
      .eq("empresa_id", empresa.id)
      .eq("documento", dni)
      .maybeSingle();

    if (empLookupError) throw empLookupError;

    if (empleado && !empleado.activo) {
      throw new HttpError(400, "El trabajador no está activo en el padrón");
    }

    if (!empleado) {
      const { data: creado, error: createError } = await supabaseAdmin
        .from("empleados")
        .insert({
          empresa_id: empresa.id,
          nombre,
          documento: dni,
          sector,
          puesto,
          activo: true,
        })
        .select("id, nombre, documento, activo, sector, puesto, epp_necesarios")
        .single();

      if (createError) {
        if (createError.code === "23505") {
          const { data: retry } = await supabaseAdmin
            .from("empleados")
            .select("id, nombre, documento, activo, sector, puesto, epp_necesarios")
            .eq("empresa_id", empresa.id)
            .eq("documento", dni)
            .maybeSingle();
          if (!retry || !retry.activo) {
            throw new HttpError(409, "No se pudo registrar al trabajador. Reintentá.");
          }
          empleado = retry;
        } else {
          throw createError;
        }
      } else {
        empleado = creado;
      }
    }

    if (!empleado) {
      throw new HttpError(500, "No se pudo resolver el trabajador");
    }

    // Siempre sincronizar datos del formulario al padrón (Anexo I: puesto obligatorio).
    const empleadoUpdates: {
      nombre: string;
      puesto: string;
      sector: string | null;
    } = {
      nombre: nombre.length >= 3 ? nombre : empleado.nombre,
      puesto,
      sector: sector ?? empleado.sector ?? null,
    };
    const { error: syncError } = await supabaseAdmin
      .from("empleados")
      .update(empleadoUpdates)
      .eq("id", empleado.id);
    if (syncError) throw syncError;
    empleado = { ...empleado, ...empleadoUpdates };

    let fotoUploadUrl: string | null = null;
    if (foto) {
      const ext = safeExtensionFromUpload(foto);
      const fotoPath = `evidencias/${empresa.id}/${dni}_${Date.now()}.${ext}`;
      await storageService.subirArchivo("epp_fotos", fotoPath, foto);
      fotoUploadUrl = storageService.obtenerUrlPublica("epp_fotos", fotoPath);
    }

    const firmaUrl = await uploadBase64Png(
      "firmas_digitales",
      `epp/${empresa.id}/${dni}_qr_${Date.now()}.png`,
      payload.firma,
    );

    const entregadoAt = new Date().toISOString();
    const entregasData = payload.items.map((item, index) => {
      const tipo = tiposById.get(item.epp_tipo_id)!;
      return {
        empresa_id: empresa.id,
        preventor_id: null,
        epp_tipo_id: item.epp_tipo_id,
        empleado_id: empleado!.id,
        empleado_nombre: nombre || empleado!.nombre,
        empleado_documento: dni || empleado!.documento,
        cantidad: item.cantidad || 1,
        marca: item.marca || null,
        modelo: item.modelo || null,
        certificacion: item.certificacion || null,
        entregado_at: entregadoAt,
        firma_empleado_url: firmaUrl,
        firma_empleador_url: null,
        foto_evidencia_url:
          index === 0 && fotoUploadUrl
            ? fotoUploadUrl
            : tipo.foto_url || null,
        estado: "firmada",
        origen: "qr_publico",
      };
    });

    const { data: entregas, error: entregaError } = await supabaseAdmin
      .from("epp_entregas")
      .insert(entregasData)
      .select(`*, epp_tipos(id, nombre, descripcion, foto_url)`);

    if (entregaError) throw entregaError;
    const rows = (entregas ?? []) as EntregaRow[];
    if (rows.length === 0) {
      throw new HttpError(500, "No se pudieron registrar las entregas");
    }

    void this.generarYGuardarPdfLote(rows).catch((err) => {
      console.error(
        `Error generando PDF de entrega pública EPP lote ${rows.map((r) => r.id).join(",")}:`,
        err,
      );
    });

    return {
      success: true,
      entregas: rows.map((row) => mapEntrega(row)),
      entrega: mapEntrega(rows[0]),
      pdf_generando: true,
      mensaje:
        "Entrega registrada. El registro oficial SRT 299/11 se está generando.",
    };
  },
};
