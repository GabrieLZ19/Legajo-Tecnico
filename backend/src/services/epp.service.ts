import { randomUUID } from "crypto";
import QRCode from "qrcode";
import { supabaseAdmin } from "../config/supabase";
import { env } from "../config/env";
import { storageService } from "./storage.service";
import { eppPdfService } from "./eppPdf.service";
import { HttpError } from "../utils/httpError";
import type { RolUsuario } from "../types/database";

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
  preventor_id: string;
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
  estado: string;
  url_registro_oficial: string | null;
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
    estado: e.estado,
    pdf_url: e.url_registro_oficial,
    epp_tipos: e.epp_tipos,
  };
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
      const ext = file.originalname.split(".").pop() || "jpg";
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
      const ext = file.originalname.split(".").pop() || "jpg";
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

  async listarEmpleados(empresaId: string) {
    const { data, error } = await supabaseAdmin
      .from("empleados")
      .select("*")
      .eq("empresa_id", empresaId)
      .order("nombre");
    if (error) throw error;
    return { empleados: data ?? [] };
  },

  async crearEmpleado(payload: {
    empresa_id: string;
    nombre: string;
    documento: string;
    sector?: string | null;
  }) {
    const { data, error } = await supabaseAdmin
      .from("empleados")
      .insert({
        empresa_id: payload.empresa_id,
        nombre: payload.nombre.trim(),
        documento: payload.documento,
        sector: payload.sector?.trim() || null,
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
    return data;
  },

  async actualizarEmpleado(
    id: string,
    payload: {
      nombre?: string;
      documento?: string;
      sector?: string | null;
      activo?: boolean;
    },
  ) {
    const { data, error } = await supabaseAdmin
      .from("empleados")
      .update(payload)
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    if (!data) throw new HttpError(404, "Empleado no encontrado");
    return data;
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

  async listarEntregas(empresaId: string) {
    const { data, error } = await supabaseAdmin
      .from("epp_entregas")
      .select(`*, epp_tipos(id, nombre, descripcion, foto_url)`)
      .eq("empresa_id", empresaId)
      .order("entregado_at", { ascending: false });
    if (error) throw error;
    return { entregas: ((data ?? []) as EntregaRow[]).map(mapEntrega) };
  },

  async registrarEntrega(
    user: AuthUser,
    payload: {
      empresa_id: string;
      empleado_id?: string | null;
      nombre_empleado: string;
      dni_empleado: string;
      items: EntregaItemInput[];
      fecha_entrega?: string;
      firma: string;
      firma_empleador?: string | null;
    },
  ) {
    const firmaUrl = await uploadBase64Png(
      "firmas_digitales",
      `epp/${payload.empresa_id}/${payload.dni_empleado}_${Date.now()}.png`,
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

    const entregadoAt = payload.fecha_entrega || new Date().toISOString();
    const entregasData = payload.items.map((item) => ({
      empresa_id: payload.empresa_id,
      preventor_id: user.id,
      epp_tipo_id: item.epp_tipo_id,
      empleado_id: payload.empleado_id || null,
      empleado_nombre: payload.nombre_empleado,
      empleado_documento: payload.dni_empleado,
      cantidad: item.cantidad || 1,
      marca: item.marca || null,
      modelo: item.modelo || null,
      certificacion: item.certificacion || null,
      entregado_at: entregadoAt,
      firma_empleado_url: firmaUrl,
      firma_empleador_url: firmaEmpleadorUrl,
      estado: "firmada",
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

    // PDF en background: la entrega queda registrada aunque el PDF tarde
    void this.generarYGuardarPdf(user, rows).catch((err) => {
      console.error("Error generando PDF de entrega EPP:", err);
    });

    const mapped = rows.map((e) => mapEntrega(e));

    return {
      success: true,
      entregas: mapped,
      pdf_url: null,
      pdf_generando: true,
    };
  },

  async generarYGuardarPdf(_user: AuthUser, entregas: EntregaRow[]): Promise<string> {
    const first = entregas[0];
    const { data: empresa, error: empresaError } = await supabaseAdmin
      .from("empresas")
      .select("razon_social, cuit, actividad, logo_url, consultora_id")
      .eq("id", first.empresa_id)
      .single();
    if (empresaError) throw empresaError;

    let consultora: { nombre: string; logo_url: string | null } | null = null;
    if (empresa?.consultora_id) {
      const { data } = await supabaseAdmin
        .from("consultoras")
        .select("nombre, logo_url")
        .eq("id", empresa.consultora_id)
        .single();
      consultora = data;
    }

    const { data: preventor } = await supabaseAdmin
      .from("perfiles")
      .select("nombre_completo")
      .eq("id", first.preventor_id)
      .maybeSingle();

    const pdfBuffer = await eppPdfService.generarConstanciaSRT299({
      empresa: empresa ?? { razon_social: "", cuit: "", actividad: null },
      consultora,
      empleado: { nombre: first.empleado_nombre, dni: first.empleado_documento },
      items: entregas.map((e) => ({
        epp_tipos: e.epp_tipos,
        cantidad: e.cantidad,
        marca: e.marca,
        modelo: e.modelo,
        certificacion: e.certificacion,
        fecha_entrega: e.entregado_at,
      })),
      fecha: first.entregado_at,
      firmaUrl: first.firma_empleado_url,
      firmaEmpleadorUrl: first.firma_empleador_url,
      preventorNombre: preventor?.nombre_completo ?? null,
    });

    const pdfPath = `epp/pdf/${first.empresa_id}/${first.empleado_documento}_${Date.now()}.pdf`;
    const { error: pdfUploadError } = await supabaseAdmin.storage
      .from("informes_pdf")
      .upload(pdfPath, pdfBuffer, {
        contentType: "application/pdf",
        upsert: true,
      });

    if (pdfUploadError) {
      throw new HttpError(500, `La entrega se registró pero falló el PDF: ${pdfUploadError.message}`);
    }

    const pdfUrl = supabaseAdmin.storage.from("informes_pdf").getPublicUrl(pdfPath).data.publicUrl;
    const ids = entregas.map((e) => e.id);
    await supabaseAdmin.from("epp_entregas").update({ url_registro_oficial: pdfUrl }).in("id", ids);
    return pdfUrl;
  },

  async regenerarPdf(user: AuthUser, entregaId: string) {
    const { data: entrega, error } = await supabaseAdmin
      .from("epp_entregas")
      .select(`*, epp_tipos(id, nombre, descripcion, foto_url)`)
      .eq("id", entregaId)
      .single();
    if (error || !entrega) throw new HttpError(404, "Entrega de EPP no encontrada");

    const { data: hermanas } = await supabaseAdmin
      .from("epp_entregas")
      .select(`*, epp_tipos(id, nombre, descripcion, foto_url)`)
      .eq("empresa_id", entrega.empresa_id)
      .eq("empleado_documento", entrega.empleado_documento)
      .eq("entregado_at", entrega.entregado_at);

    const rows = (hermanas && hermanas.length > 0 ? hermanas : [entrega]) as EntregaRow[];
    const pdfUrl = await this.generarYGuardarPdf(user, rows);
    return { success: true, pdf_url: pdfUrl };
  },

  async descargarPdf(entregaId: string): Promise<{ buffer: Buffer; filename: string }> {
    const { data: entrega, error } = await supabaseAdmin
      .from("epp_entregas")
      .select("empleado_documento, url_registro_oficial")
      .eq("id", entregaId)
      .single();

    if (error || !entrega) throw new HttpError(404, "Entrega de EPP no encontrada");
    if (!entrega.url_registro_oficial) {
      throw new HttpError(404, "El PDF de esta entrega aún no ha sido generado");
    }

    const bucketName = "informes_pdf";
    const parts = entrega.url_registro_oficial.split(`/public/${bucketName}/`);
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
      filename: `Constancia_SRT_299_${entrega.empleado_documento}.pdf`,
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

  async crearProveedor(consultoraId: string, payload: { nombre: string; email: string }) {
    const { data, error } = await supabaseAdmin
      .from("epp_proveedores")
      .insert({
        consultora_id: consultoraId,
        nombre: payload.nombre.trim(),
        email: payload.email.trim().toLowerCase(),
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
    payload: { nombre?: string; email?: string; activo?: boolean },
  ) {
    const { data, error } = await supabaseAdmin
      .from("epp_proveedores")
      .update(payload)
      .eq("id", id)
      .eq("consultora_id", consultoraId)
      .select()
      .single();
    if (error) throw error;
    if (!data) throw new HttpError(404, "Proveedor no encontrado");
    return data;
  },

  async listarLicitaciones(empresaId: string) {
    const { data, error } = await supabaseAdmin
      .from("epp_licitaciones")
      .select(
        `
        *,
        epp_licitacion_items(*, epp_tipos(id, nombre, descripcion, foto_url)),
        epp_licitacion_cotizaciones(*)
      `,
      )
      .eq("empresa_id", empresaId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return { licitaciones: data ?? [] };
  },

  async crearLicitacion(
    user: AuthUser,
    payload: {
      empresa_id: string;
      titulo: string;
      descripcion?: string | null;
      fecha_cierre?: string | null;
      proveedor_ids: string[];
      items: Array<{ epp_tipo_id: string; cantidad: number }>;
    },
  ) {
    const consultoraId = requireConsultoraId(user);
    const comision = await getComisionPorcentaje(consultoraId);

    const { data: licitacion, error: licError } = await supabaseAdmin
      .from("epp_licitaciones")
      .insert({
        empresa_id: payload.empresa_id,
        consultora_id: consultoraId,
        titulo: payload.titulo.trim(),
        descripcion: payload.descripcion?.trim() || null,
        fecha_cierre: payload.fecha_cierre || null,
        estado: "abierta",
        comision_porcentaje: comision,
      })
      .select()
      .single();
    if (licError) throw licError;

    const { error: itemsError } = await supabaseAdmin.from("epp_licitacion_items").insert(
      payload.items.map((item) => ({
        licitacion_id: licitacion.id,
        epp_tipo_id: item.epp_tipo_id,
        cantidad: item.cantidad,
      })),
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

  async obtenerCotizacionPublica(token: string) {
    const { data: cotizacion, error } = await supabaseAdmin
      .from("epp_licitacion_cotizaciones")
      .select(
        `
        id, proveedor_nombre, proveedor_email, monto, estado, items_ofertados,
        epp_licitaciones(
          id, titulo, descripcion, estado, fecha_cierre,
          empresas(razon_social),
          epp_licitacion_items(cantidad, epp_tipos(id, nombre, descripcion, foto_url))
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
        epp_tipo_id: string;
        cantidad: number;
        precio_unitario: number;
      }>;
    },
  ) {
    const { data: cotizacion, error } = await supabaseAdmin
      .from("epp_licitacion_cotizaciones")
      .select(
        "id, licitacion_id, estado, epp_licitaciones(comision_porcentaje, estado, fecha_cierre)",
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

    const comisionPct = Number(licitacion.comision_porcentaje ?? 0);
    const comisionCalculada = Number(((payload.monto * comisionPct) / 100).toFixed(2));

    const { data, error: updateError } = await supabaseAdmin
      .from("epp_licitacion_cotizaciones")
      .update({
        monto: payload.monto,
        items_ofertados: payload.items_ofertados,
        comision_calculada: comisionCalculada,
        estado: "cargada",
        ...(payload.proveedor_nombre ? { proveedor_nombre: payload.proveedor_nombre } : {}),
      })
      .eq("id", cotizacion.id)
      .select()
      .single();

    if (updateError) throw updateError;
    return data;
  },
};
