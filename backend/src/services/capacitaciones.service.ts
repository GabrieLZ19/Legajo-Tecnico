import { supabaseAdmin } from "../config/supabase";
import QRCode from "qrcode";
import { randomUUID } from "crypto";
import ExcelJS from "exceljs";
import {
  CapacitacionDiapositiva,
  ensureDiapositivas,
  resolveDiapositivasAndTemario,
} from "../utils/cap-diapositivas";
import {
  buildRegistroExcel,
  buildRegistroPdf,
  fetchImageBuffer,
} from "./capacitacionRegistroExport.service";
import sharp from "sharp";
import { storageService } from "./storage.service";
import { safeExtensionFromUpload } from "../config/multer";
import { HttpError } from "../utils/httpError";
import {
  clampInt,
  parseDateFilter,
  parseHistoricoResultado,
  sanitizeSearchTerm,
  type HistoricoResultadoFiltro,
} from "../utils/searchSanitize";

const HISTORICO_PAGE_DEFAULT = 25;
const HISTORICO_PAGE_MAX = 100;
const HISTORICO_EXPORT_MAX = 10_000;
const HISTORICO_EXPORT_BATCH = 500;
const MAX_PARTICIPANTES_MANUAL = 200;

export type ParticipanteManualInput = {
  nombre_empleado: string;
  dni_empleado: string;
  calificacion?: number;
  sector?: string;
};

export function parseParticipantesManuales(raw: unknown): ParticipanteManualInput[] {
  if (raw === undefined || raw === null || raw === "") return [];

  let parsed: unknown;
  if (typeof raw === "string") {
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new HttpError(400, "El formato de participantes no es válido");
    }
  } else if (Array.isArray(raw)) {
    parsed = raw;
  } else {
    throw new HttpError(400, "El formato de participantes no es válido");
  }

  if (!Array.isArray(parsed)) {
    throw new HttpError(400, "El formato de participantes no es válido");
  }

  if (parsed.length > MAX_PARTICIPANTES_MANUAL) {
    throw new HttpError(
      400,
      `Podés cargar hasta ${MAX_PARTICIPANTES_MANUAL} participantes por registro`,
    );
  }

  const seenDni = new Set<string>();
  const result: ParticipanteManualInput[] = [];

  for (const item of parsed) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const nombre = String(row.nombre_empleado ?? row.nombre ?? "")
      .trim()
      .slice(0, 120);
    const dni = String(row.dni_empleado ?? row.dni ?? "").replace(/\D/g, "");

    if (!nombre && !dni) continue;
    if (!nombre) {
      throw new HttpError(400, "Cada participante debe tener nombre");
    }
    if (!/^\d{7,8}$/.test(dni)) {
      throw new HttpError(
        400,
        `DNI inválido para «${nombre}». Debe tener 7 u 8 dígitos.`,
      );
    }
    if (seenDni.has(dni)) {
      throw new HttpError(400, `El DNI ${dni} está repetido en la lista`);
    }
    seenDni.add(dni);

    let calificacion: number | undefined;
    const rawCalif = row.calificacion;
    if (rawCalif !== undefined && rawCalif !== null && rawCalif !== "") {
      calificacion = Math.round(Number(rawCalif));
      if (Number.isNaN(calificacion) || calificacion < 0 || calificacion > 100) {
        throw new HttpError(
          400,
          `Calificación inválida para «${nombre}». Usá un valor entre 0 y 100.`,
        );
      }
    }

    const sector = String(row.sector ?? "").trim().slice(0, 80) || undefined;
    result.push({
      nombre_empleado: nombre,
      dni_empleado: dni,
      calificacion,
      sector,
    });
  }

  return result;
}

async function insertarAsistenciasManuales(
  capacitacionId: string,
  firmadoAt: string,
  participantes: ParticipanteManualInput[],
) {
  if (participantes.length === 0) return;

  const rows = participantes.map((p) => ({
    capacitacion_id: capacitacionId,
    nombre_empleado: p.nombre_empleado,
    documento: p.dni_empleado,
    sector: p.sector ?? null,
    puntaje: p.calificacion != null ? p.calificacion : 100,
    firma_url: null,
    firmado_at: firmadoAt,
  }));

  const { error } = await supabaseAdmin
    .from("capacitacion_asistencias")
    .insert(rows);

  if (error) throw error;
}

function historicoCalificacionMeta(
  cap: { con_evaluacion?: boolean; origen?: string } | null,
  puntajeRaw: unknown,
) {
  const puntaje = Number(puntajeRaw ?? 100);
  const esManual = cap?.origen === "manual";
  const conEvaluacion = cap?.con_evaluacion !== false;
  const tieneCalifManual = esManual && puntaje !== 100;
  const mostrarCalif = conEvaluacion || tieneCalifManual;

  return {
    calificacion: mostrarCalif ? puntaje : null,
    aprobado: mostrarCalif ? puntaje >= 60 : true,
    con_evaluacion: mostrarCalif,
  };
}

export type HistoricoFiltros = {
  participante?: string;
  tema?: string;
  fecha_desde?: string;
  fecha_hasta?: string;
  resultado?: HistoricoResultadoFiltro;
  limit?: number;
  offset?: number;
};

function applyHistoricoFilters(query: any, opts: HistoricoFiltros) {
  const qParticipante = sanitizeSearchTerm(opts.participante);
  if (qParticipante) {
    const digits = qParticipante.replace(/\D/g, "");
    const safe = qParticipante.replace(/'/g, "''");
    if (digits.length >= 3) {
      query = query.or(
        `nombre_empleado.ilike.%${safe}%,documento.ilike.%${digits}%`,
      );
    } else {
      query = query.or(
        `nombre_empleado.ilike.%${safe}%,documento.ilike.%${safe}%`,
      );
    }
  }

  const qTema = sanitizeSearchTerm(opts.tema);
  if (qTema) {
    const safeTema = qTema.replace(/'/g, "''");
    query = query.ilike("capacitaciones.titulo", `%${safeTema}%`);
  }

  const desde = parseDateFilter(opts.fecha_desde);
  if (desde) {
    query = query.gte("capacitaciones.fecha", `${desde}T00:00:00`);
  }

  const hasta = parseDateFilter(opts.fecha_hasta);
  if (hasta) {
    query = query.lte("capacitaciones.fecha", `${hasta}T23:59:59.999`);
  }

  const resultado = opts.resultado ?? "todos";
  if (resultado === "aprobado") {
    query = query
      .eq("capacitaciones.con_evaluacion", true)
      .gte("puntaje", 60);
  } else if (resultado === "desaprobado") {
    query = query
      .eq("capacitaciones.con_evaluacion", true)
      .lt("puntaje", 60);
  } else if (resultado === "sin_evaluacion") {
    query = query.eq("capacitaciones.con_evaluacion", false);
  }

  return query;
}

function esRespuestaMultiple(raw: unknown): boolean {
  if (Array.isArray(raw)) return true;
  if (typeof raw !== "string") return false;
  const s = raw.trim();
  if (s.startsWith("[")) return true;
  try {
    return Array.isArray(JSON.parse(s));
  } catch {
    return false;
  }
}

/** Firma URLs de Storage privadas antes de exponerlas al frontend. */
async function firmarUrlsCapacitacion<T extends Record<string, any>>(
  cap: T,
): Promise<T> {
  const asistencias = await Promise.all(
    (cap.capacitacion_asistencias || []).map(async (a: any) => ({
      ...a,
      firma_url: await storageService.signUrl(a.firma_url),
    })),
  );

  return {
    ...cap,
    capacitacion_asistencias: asistencias,
    firma_capacitador_url: await storageService.signUrl(
      cap.firma_capacitador_url,
    ),
    firma_empresa_url: await storageService.signUrl(cap.firma_empresa_url),
    registro_manual_url: await storageService.signUrl(
      cap.registro_manual_url,
    ),
  };
}

export const capacitacionesService = {
  /**
   * Listar capacitaciones de la empresa
   */
  async listar(empresaId: string, opts?: { soloVisibleEnte?: boolean }) {
    let query = supabaseAdmin
      .from("capacitaciones")
      .select(
        `
        *,
        capacitacion_preguntas(id),
        capacitacion_asistencias(id)
      `,
      )
      .eq("empresa_id", empresaId);

    if (opts?.soloVisibleEnte) {
      query = query.eq("visible_ente_regulador", true);
    }

    const { data, error } = await query
      .order("fecha", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false });

    if (error) throw error;

    const mapped = (data || []).map((cap: any) => ({
      ...cap,
      total_preguntas: cap.capacitacion_preguntas?.length || 0,
      total_asistencias: cap.capacitacion_asistencias?.length || 0,
      capacitacion_preguntas: undefined,
      capacitacion_asistencias: undefined,
    }));

    return Promise.all(
      mapped.map(async (cap) => ({
        ...cap,
        registro_manual_url: await storageService.signUrl(cap.registro_manual_url),
      })),
    );
  },

  /**
   * Crear nueva capacitación o clonar desde biblioteca
   */
  async crear(params: {
    empresa_id: string;
    preventor_id: string;
    titulo: string;
    temario?: string;
    diapositivas?: CapacitacionDiapositiva[];
    fecha?: string;
    instructor?: string;
    fechas_horario?: string;
    cantidad_horas?: string;
    con_evaluacion?: boolean;
    preguntas?: any[];
    copiar_de_id?: string; // Clonar desde sesión previa (compat)
    copiar_de_plantilla_id?: string; // Clonar desde biblioteca de plantillas
  }) {
    const conEvaluacion = params.con_evaluacion !== false;
    // Si el cliente envía preguntas explícitamente (aunque sea []), no clonamos desde plantilla
    let preguntasAInsertar: any[] | null = Array.isArray(params.preguntas)
      ? params.preguntas
      : null;
    let diapositivasClonadas: CapacitacionDiapositiva[] | undefined;

    // Clonar desde plantilla (biblioteca empresa o LT)
    if (params.copiar_de_plantilla_id) {
      const { data: plantillaOrigen } = await supabaseAdmin
        .from("capacitacion_plantillas")
        .select(
          `
          titulo, temario, diapositivas, ambito, empresa_id,
          capacitacion_plantilla_preguntas(enunciado, opciones, respuesta_correcta, orden)
        `,
        )
        .eq("id", params.copiar_de_plantilla_id)
        .single();

      if (plantillaOrigen) {
        if (
          plantillaOrigen.ambito === "empresa" &&
          plantillaOrigen.empresa_id !== params.empresa_id
        ) {
          throw new Error(
            "No se puede usar una plantilla de otra empresa",
          );
        }
        if (!params.titulo) params.titulo = plantillaOrigen.titulo;
        if (!params.temario) params.temario = plantillaOrigen.temario || undefined;
        if (
          (!params.diapositivas || params.diapositivas.length === 0) &&
          plantillaOrigen.diapositivas
        ) {
          diapositivasClonadas = plantillaOrigen.diapositivas;
        }
        if (
          conEvaluacion &&
          preguntasAInsertar === null &&
          plantillaOrigen.capacitacion_plantilla_preguntas
        ) {
          const sorted = [
            ...plantillaOrigen.capacitacion_plantilla_preguntas,
          ].sort((a: any, b: any) => a.orden - b.orden);
          preguntasAInsertar = sorted.map((p: any) => ({
            pregunta: p.enunciado,
            opciones: p.opciones,
            respuesta_correcta: p.respuesta_correcta,
          }));
        }
      }
    }

    // Si viene desde una capacitación existente (compatibilidad), traemos sus preguntas
    if (params.copiar_de_id && !params.copiar_de_plantilla_id) {
      const { data: capOrigen } = await supabaseAdmin
        .from("capacitaciones")
        .select(
          `
          titulo, temario, diapositivas,
          capacitacion_preguntas(enunciado, opciones, respuesta_correcta, orden)
        `,
        )
        .eq("id", params.copiar_de_id)
        .single();

      if (capOrigen) {
        if (!params.titulo) params.titulo = capOrigen.titulo;
        if (!params.temario) params.temario = capOrigen.temario;
        if (
          (!params.diapositivas || params.diapositivas.length === 0) &&
          capOrigen.diapositivas
        ) {
          diapositivasClonadas = capOrigen.diapositivas;
        }
        if (
          conEvaluacion &&
          preguntasAInsertar === null &&
          capOrigen.capacitacion_preguntas
        ) {
          preguntasAInsertar = capOrigen.capacitacion_preguntas.map(
            (p: any) => ({
              pregunta: p.enunciado,
              opciones: p.opciones,
              respuesta_correcta: p.respuesta_correcta,
            }),
          );
        }
      }
    }

    const preguntasFinales = !conEvaluacion
      ? []
      : preguntasAInsertar || [];

    const { diapositivas, temario } = resolveDiapositivasAndTemario({
      diapositivas: params.diapositivas?.length
        ? params.diapositivas
        : diapositivasClonadas,
      temario: params.temario,
    });

    // Insertar en la tabla 'capacitaciones' sin columnas inexistentes
    const { data: cap, error: capError } = await supabaseAdmin
      .from("capacitaciones")
      .insert({
        empresa_id: params.empresa_id,
        preventor_id: params.preventor_id,
        titulo: params.titulo,
        temario,
        diapositivas,
        fecha: params.fecha || new Date().toISOString(),
        instructor: params.instructor || null,
        fechas_horario: params.fechas_horario || null,
        cantidad_horas: params.cantidad_horas || null,
        con_evaluacion: conEvaluacion,
        estado: "borrador",
      })
      .select()
      .single();

    if (capError) throw capError;

    if (preguntasFinales.length > 0) {
      const preguntasData = preguntasFinales.map((p: any, idx: number) => ({
        capacitacion_id: cap.id,
        enunciado: p.pregunta || p.enunciado,
        opciones: p.opciones,
        respuesta_correcta: p.respuesta_correcta,
        orden: idx + 1,
      }));

      const { error: pregError } = await supabaseAdmin
        .from("capacitacion_preguntas")
        .insert(preguntasData);

      if (pregError) throw pregError;
    }

    return cap;
  },

  /**
   * Alta de registro en papel (escaneo imagen/PDF) para mantener el historial correlativo.
   */
  async crearRegistroManual(params: {
    empresa_id: string;
    preventor_id: string;
    titulo?: string;
    fecha: string;
    instructor?: string;
    fechas_horario?: string;
    cantidad_horas?: string;
    file?: Express.Multer.File;
    participantes?: ParticipanteManualInput[];
  }) {
    const fecha = new Date(params.fecha);
    if (Number.isNaN(fecha.getTime())) {
      throw new HttpError(400, "La fecha y hora del registro no son válidas");
    }

    const participantes = params.participantes ?? [];
    if (!params.file && participantes.length === 0) {
      throw new HttpError(
        400,
        "Adjuntá el escaneo del registro o cargá al menos un participante.",
      );
    }

    const titulo =
      (params.titulo || "").trim() ||
      "Registro de capacitación (manual)";

    let registroUrl: string | null = null;
    let registroNombre: string | null = null;

    if (params.file) {
      const ext = safeExtensionFromUpload(params.file);
      const safeName = (params.file.originalname || `registro.${ext}`)
        .replace(/[^\w.\-]+/g, "_")
        .slice(0, 120);
      const storagePath = `${params.empresa_id}/${Date.now()}_${randomUUID().slice(0, 8)}_${safeName}`;

      await storageService.subirArchivo(
        "capacitacion_registros",
        storagePath,
        params.file,
      );
      registroUrl = storageService.obtenerUrlPublica(
        "capacitacion_registros",
        storagePath,
      );
      registroNombre = params.file.originalname || safeName;
    }

    const { data: cap, error } = await supabaseAdmin
      .from("capacitaciones")
      .insert({
        empresa_id: params.empresa_id,
        preventor_id: params.preventor_id,
        titulo,
        temario: null,
        diapositivas: [],
        fecha: fecha.toISOString(),
        instructor: params.instructor?.trim() || null,
        fechas_horario: params.fechas_horario?.trim() || null,
        cantidad_horas: params.cantidad_horas?.trim() || null,
        con_evaluacion: false,
        estado: "cerrada",
        origen: "manual",
        registro_manual_url: registroUrl,
        registro_manual_nombre: registroNombre,
      })
      .select()
      .single();

    if (error) throw error;

    if (participantes.length > 0) {
      await insertarAsistenciasManuales(
        cap.id,
        fecha.toISOString(),
        participantes,
      );
    }

    return firmarUrlsCapacitacion(cap);
  },

  /**
   * Adjuntar registro en papel a una capacitación digital existente.
   */
  async adjuntarRegistroManual(id: string, file: Express.Multer.File) {
    const { data: existing, error: existingError } = await supabaseAdmin
      .from("capacitaciones")
      .select("id, empresa_id")
      .eq("id", id)
      .single();

    if (existingError || !existing) {
      throw new HttpError(404, "Capacitación no encontrada");
    }

    const ext = safeExtensionFromUpload(file);
    const safeName = (file.originalname || `registro.${ext}`)
      .replace(/[^\w.\-]+/g, "_")
      .slice(0, 120);
    const storagePath = `${existing.empresa_id}/${id}/${Date.now()}_${randomUUID().slice(0, 8)}_${safeName}`;

    await storageService.subirArchivo(
      "capacitacion_registros",
      storagePath,
      file,
    );
    const registroUrl = storageService.obtenerUrlPublica(
      "capacitacion_registros",
      storagePath,
    );

    const { data: cap, error } = await supabaseAdmin
      .from("capacitaciones")
      .update({
        registro_manual_url: registroUrl,
        registro_manual_nombre: file.originalname || safeName,
      })
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
    return firmarUrlsCapacitacion(cap);
  },

  /**
   * Obtener detalle completo de una capacitación
   */
  async obtenerPorId(id: string) {
    const { data, error } = await supabaseAdmin
      .from("capacitaciones")
      .select(
        `
        *,
        capacitacion_preguntas(id, enunciado, opciones, respuesta_correcta, orden),
        capacitacion_asistencias(id, nombre_empleado, documento, sector, puntaje, firma_url, firmado_at)
      `,
      )
      .eq("id", id)
      .single();

    if (error || !data) return null;

    if (data.capacitacion_preguntas) {
      data.capacitacion_preguntas = data.capacitacion_preguntas.map(
        (p: any) => ({
          ...p,
          pregunta: p.enunciado,
        }),
      );
    }

    if (data.capacitacion_asistencias) {
      data.capacitacion_asistencias = data.capacitacion_asistencias.map(
        (a: any) => ({
          ...a,
          dni_empleado: a.documento,
          created_at: a.firmado_at,
          aprobado: a.puntaje >= 60,
        }),
      );
    }

    data.diapositivas = ensureDiapositivas(data.diapositivas, data.temario);

    return firmarUrlsCapacitacion(data);
  },

  /**
   * Obtener detalle público para evaluación
   */
  async obtenerDetallePublico(id: string) {
    const { data, error } = await supabaseAdmin
      .from("capacitaciones")
      .select(
        `
        id, titulo, temario, estado, fecha, con_evaluacion,
        capacitacion_preguntas(id, enunciado, opciones, respuesta_correcta, orden)
      `,
      )
      .eq("id", id)
      .single();

    if (error || !data)
      return { error: "Capacitación no encontrada", code: 404 };
    if (data.estado !== "activa")
      return { error: "La capacitación no está activa", code: 400 };

    const preguntas = !data.con_evaluacion
      ? []
      : (data.capacitacion_preguntas || []).map((p) => ({
          id: p.id,
          enunciado: p.enunciado,
          opciones: p.opciones,
          orden: p.orden,
          pregunta: p.enunciado,
          es_multiple: esRespuestaMultiple(p.respuesta_correcta),
        }));

    return {
      data: {
        id: data.id,
        titulo: data.titulo,
        temario: data.temario,
        estado: data.estado,
        fecha: data.fecha,
        con_evaluacion: data.con_evaluacion,
        capacitacion_preguntas: preguntas,
      },
    };
  },

  /**
   * Cambiar estado
   */
  async cambiarEstado(id: string, estado: string) {
    const { data, error } = await supabaseAdmin
      .from("capacitaciones")
      .update({ estado })
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * Generar QR
   */
  async generarQR(id: string) {
    const { data: cap, error } = await supabaseAdmin
      .from("capacitaciones")
      .select("id, titulo, estado, con_evaluacion")
      .eq("id", id)
      .single();

    if (error || !cap) return null;

    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
    const evaluacionUrl = `${frontendUrl}/evaluacion/${id}`;

    const qrBase64 = await QRCode.toDataURL(evaluacionUrl, {
      width: 400,
      margin: 2,
      color: { dark: "#1e3a8a", light: "#ffffff" },
    });

    return { qr: qrBase64, url: evaluacionUrl, capacitacion: cap };
  },

  /**
   * Evaluar empleado y registrar asistencia con devolución de revisión
   */
  async evaluarEmpleado(id: string, body: any) {
    const { nombre_empleado, dni_empleado, sector, respuestas, firma } = body;

    if (!nombre_empleado?.trim() || !dni_empleado?.trim()) {
      throw new HttpError(400, "Nombre y DNI son obligatorios");
    }
    const dniLimpio = String(dni_empleado).replace(/\D/g, "");
    if (!/^\d{7,8}$/.test(dniLimpio)) {
      throw new HttpError(400, "DNI inválido. Debe tener 7 u 8 dígitos.");
    }
    if (!firma || typeof firma !== "string" || !firma.startsWith("data:image/")) {
      throw new HttpError(400, "La firma es obligatoria");
    }

    const { data: cap, error: capError } = await supabaseAdmin
      .from("capacitaciones")
      .select(
        `
        id, titulo, estado, con_evaluacion,
        capacitacion_preguntas(id, enunciado, opciones, respuesta_correcta, orden)
      `,
      )
      .eq("id", id)
      .single();

    if (capError || !cap) throw new HttpError(404, "Capacitación no encontrada");
    if (cap.estado !== "activa") {
      throw new HttpError(400, "La capacitación no está activa");
    }

    const conEvaluacion = (cap as any).con_evaluacion !== false;
    const preguntas = conEvaluacion
      ? (cap as any).capacitacion_preguntas || []
      : [];
    const totalPreguntas = preguntas.length;

    if (conEvaluacion && totalPreguntas > 0) {
      if (!respuestas || !Array.isArray(respuestas)) {
        throw new HttpError(
          400,
          "Debés responder todas las preguntas antes de firmar.",
        );
      }
      for (const pregunta of preguntas) {
        const respuesta = respuestas.find(
          (r: any) => r.pregunta_id === pregunta.id,
        );
        const seleccion = respuesta?.seleccion;
        if (
          seleccion === undefined ||
          seleccion === null ||
          (Array.isArray(seleccion) && seleccion.length === 0)
        ) {
          throw new HttpError(
            400,
            "Debés responder todas las preguntas antes de firmar.",
          );
        }
      }
    }

    const { data: intentoPrevio } = await supabaseAdmin
      .from("capacitacion_asistencias")
      .select("id, puntaje, firma_url")
      .eq("capacitacion_id", id)
      .eq("documento", dniLimpio)
      .maybeSingle();

    if (intentoPrevio && intentoPrevio.puntaje >= 60) {
      throw new HttpError(
        409,
        "Este DNI ya aprobó la evaluación. No podés volver a rendirla.",
      );
    }

    if (intentoPrevio) {
      if (intentoPrevio.firma_url) {
        const parsed = storageService.parseStorageUrl(intentoPrevio.firma_url);
        if (parsed) {
          try {
            await storageService.eliminarArchivo(parsed.bucket, parsed.path);
          } catch (err) {
            console.error("No se pudo borrar firma anterior:", err);
          }
        }
      }
      const { error: deleteError } = await supabaseAdmin
        .from("capacitacion_asistencias")
        .delete()
        .eq("id", intentoPrevio.id);
      if (deleteError) {
        throw new HttpError(
          500,
          "No se pudo preparar un nuevo intento de evaluación.",
        );
      }
    }

    let correctas = 0;

    // Arreglo para la revisión del alumno tipo Google Forms
    const revision: Array<{
      pregunta_id: string;
      enunciado: string;
      opciones: string[];
      seleccion: number | number[];
      respuesta_correcta: number | number[];
      es_correcta: boolean;
    }> = [];

    if (totalPreguntas > 0 && respuestas && Array.isArray(respuestas)) {
      for (const pregunta of preguntas) {
        const respuesta = respuestas.find(
          (r: any) => r.pregunta_id === pregunta.id,
        );
        const correctStr = pregunta.respuesta_correcta;
        const userSelection = respuesta ? respuesta.seleccion : null;

        let esCorrecta = false;
        let correctParsed: number | number[] = 0;

        if (correctStr && correctStr.startsWith("[")) {
          try {
            correctParsed = JSON.parse(correctStr) as number[];
            const userIndices = Array.isArray(userSelection)
              ? userSelection
              : [userSelection];

            esCorrecta =
              correctParsed.length === userIndices.length &&
              correctParsed.every((idx) => userIndices.includes(idx));
          } catch (e) {
            correctParsed = Number(correctStr) || 0;
            esCorrecta = String(userSelection) === correctStr;
          }
        } else {
          correctParsed = Number(correctStr) || 0;
          esCorrecta = String(userSelection) === correctStr;
        }

        if (esCorrecta) correctas++;

        revision.push({
          pregunta_id: pregunta.id,
          enunciado: pregunta.enunciado,
          opciones: pregunta.opciones,
          seleccion: userSelection,
          respuesta_correcta: correctParsed,
          es_correcta: esCorrecta,
        });
      }
    }

    const puntaje =
      totalPreguntas > 0 ? Math.round((correctas / totalPreguntas) * 100) : 100;
    const aprobado = puntaje >= 60;

    let firmaUrl: string | null = null;
    if (firma) {
      const base64Data = firma.replace(/^data:image\/\w+;base64,/, "");
      const buffer = Buffer.from(base64Data, "base64");
      const firmaPath = `capacitaciones/${id}/${dniLimpio}_${Date.now()}_${randomUUID().slice(0, 8)}.png`;

      const { error: storageError } = await supabaseAdmin.storage
        .from("firmas_digitales")
        .upload(firmaPath, buffer, { contentType: "image/png", upsert: true });

      if (storageError) {
        console.error(
          "Error al subir firma de capacitación:",
          storageError.message,
        );
      } else {
        const { data: urlData } = supabaseAdmin.storage
          .from("firmas_digitales")
          .getPublicUrl(firmaPath);
        firmaUrl = urlData.publicUrl;
      }
    }

    const { data: asistencia, error: asistError } = await supabaseAdmin
      .from("capacitacion_asistencias")
      .insert({
        capacitacion_id: id,
        nombre_empleado,
        documento: dniLimpio,
        sector: sector || null,
        puntaje,
        firma_url: firmaUrl,
        firmado_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (asistError) {
      throw new HttpError(
        500,
        asistError.message || "No se pudo registrar la asistencia",
      );
    }

    return {
      success: true,
      puntaje,
      aprobado,
      asistencia,
      revision, // Retornamos la revisión detallada
    };
  },

  /**
   * Consultar si un DNI ya registró intento en una capacitación activa (QR público).
   */
  async consultarIntentoPublico(id: string, dniRaw: string) {
    const dniLimpio = String(dniRaw || "").replace(/\D/g, "");
    if (!/^\d{7,8}$/.test(dniLimpio)) {
      throw new HttpError(400, "DNI inválido. Debe tener 7 u 8 dígitos.");
    }

    const { data: cap, error: capError } = await supabaseAdmin
      .from("capacitaciones")
      .select("id, estado, con_evaluacion")
      .eq("id", id)
      .single();

    if (capError || !cap) throw new HttpError(404, "Capacitación no encontrada");
    if (cap.estado !== "activa") {
      throw new HttpError(400, "La capacitación no está activa");
    }

    const { data: intento } = await supabaseAdmin
      .from("capacitacion_asistencias")
      .select("id, puntaje, nombre_empleado, firmado_at")
      .eq("capacitacion_id", id)
      .eq("documento", dniLimpio)
      .maybeSingle();

    if (!intento) {
      return { registrado: false as const };
    }

    return {
      registrado: true as const,
      puntaje: intento.puntaje,
      aprobado: intento.puntaje >= 60,
      nombre_empleado: intento.nombre_empleado,
      firmado_at: intento.firmado_at,
    };
  },

  /**
   * Actualizar capacitación
   */
  async actualizar(id: string, body: any) {
    const {
      titulo,
      temario,
      diapositivas,
      fecha,
      preguntas,
      instructor,
      fechas_horario,
      cantidad_horas,
      con_evaluacion,
    } = body;

    const { data: cap, error: capError } = await supabaseAdmin
      .from("capacitaciones")
      .select("estado")
      .eq("id", id)
      .single();

    if (capError || !cap)
      return { error: "Capacitación no encontrada", code: 404 };
    if (cap.estado !== "borrador")
      return {
        error: "Solo se pueden editar capacitaciones en estado borrador.",
        code: 400,
      };

    const conEvaluacion =
      con_evaluacion === undefined ? undefined : con_evaluacion !== false;

    const updatePayload: Record<string, unknown> = {
      titulo: titulo || undefined,
      fecha: fecha || undefined,
      instructor: instructor !== undefined ? instructor : undefined,
      fechas_horario: fechas_horario !== undefined ? fechas_horario : undefined,
      cantidad_horas: cantidad_horas !== undefined ? cantidad_horas : undefined,
    };

    if (conEvaluacion !== undefined) {
      updatePayload.con_evaluacion = conEvaluacion;
    }

    if (diapositivas !== undefined || temario !== undefined) {
      const resolved = resolveDiapositivasAndTemario({
        diapositivas,
        temario,
      });
      updatePayload.temario = resolved.temario;
      updatePayload.diapositivas = resolved.diapositivas;
    }

    const { error: updateError } = await supabaseAdmin
      .from("capacitaciones")
      .update(updatePayload)
      .eq("id", id);

    if (updateError) throw updateError;

    const shouldClearPreguntas = conEvaluacion === false;
    if (shouldClearPreguntas || (preguntas && Array.isArray(preguntas))) {
      await supabaseAdmin
        .from("capacitacion_preguntas")
        .delete()
        .eq("capacitacion_id", id);

      const preguntasAGuardar =
        shouldClearPreguntas || !Array.isArray(preguntas) ? [] : preguntas;

      if (preguntasAGuardar.length > 0) {
        const preguntasData = preguntasAGuardar.map((p: any, idx: number) => ({
          capacitacion_id: id,
          enunciado: p.pregunta,
          opciones: p.opciones,
          respuesta_correcta: p.respuesta_correcta,
          orden: idx + 1,
        }));

        await supabaseAdmin
          .from("capacitacion_preguntas")
          .insert(preguntasData);
      }
    }

    return { success: true };
  },

  /**
   * Eliminar capacitación
   */
  async eliminar(id: string) {
    await supabaseAdmin
      .from("capacitacion_asistencias")
      .delete()
      .eq("capacitacion_id", id);
    await supabaseAdmin
      .from("capacitacion_preguntas")
      .delete()
      .eq("capacitacion_id", id);
    const { error } = await supabaseAdmin
      .from("capacitaciones")
      .delete()
      .eq("id", id);
    if (error) throw error;
    return true;
  },

  /**
   * Eliminar un participante del registro de asistencias
   */
  async eliminarAsistencia(capacitacionId: string, asistenciaId: string) {
    const { data: asistencia, error: findError } = await supabaseAdmin
      .from("capacitacion_asistencias")
      .select("id, firma_url")
      .eq("id", asistenciaId)
      .eq("capacitacion_id", capacitacionId)
      .maybeSingle();

    if (findError) throw findError;
    if (!asistencia) {
      return { error: "Asistencia no encontrada", code: 404 as const };
    }

    const { error } = await supabaseAdmin
      .from("capacitacion_asistencias")
      .delete()
      .eq("id", asistenciaId)
      .eq("capacitacion_id", capacitacionId);

    if (error) throw error;

    // Best-effort: limpiar firma en Storage si era de este bucket
    if (asistencia.firma_url) {
      const parsed = storageService.parseStorageUrl(asistencia.firma_url);
      if (parsed?.bucket === "firmas_digitales") {
        try {
          await storageService.eliminarArchivo(parsed.bucket, parsed.path);
        } catch (err) {
          console.error("No se pudo borrar firma de asistencia:", err);
        }
      }
    }

    return { success: true as const };
  },

  /**
   * Generar contenido para exportar asistencias (Excel XLSX o PDF)
   */
  async exportarAsistencias(
    id: string,
    format: string,
    search?: string,
    sector?: string,
    estado?: string,
  ) {
    const { data: cap, error: capError } = await supabaseAdmin
      .from("capacitaciones")
      .select(
        `
        *,
        empresas(razon_social, cuit, logo_url),
        preventor:perfiles!capacitaciones_preventor_id_fkey(nombre_completo),
        capacitacion_asistencias(id, nombre_empleado, documento, sector, puntaje, firma_url, firmado_at)
      `,
      )
      .eq("id", id)
      .single();

    if (capError || !cap)
      return { error: "Capacitación no encontrada", code: 404 };

    let asistencias = cap.capacitacion_asistencias || [];

    if (search) {
      const q = search.toLowerCase();
      asistencias = asistencias.filter(
        (a: any) =>
          a.nombre_empleado?.toLowerCase().includes(q) ||
          a.documento?.includes(q),
      );
    }

    if (sector) {
      const sec = sector.toLowerCase();
      asistencias = asistencias.filter(
        (a: any) => a.sector?.toLowerCase() === sec,
      );
    }

    if (estado) {
      if (estado === "aprobado")
        asistencias = asistencias.filter((a: any) => a.puntaje >= 60);
      else if (estado === "desaprobado")
        asistencias = asistencias.filter((a: any) => a.puntaje < 60);
    }

    const registroData = {
      titulo: cap.titulo || "",
      fecha: cap.fecha,
      instructor:
        cap.instructor ||
        (cap.preventor as any)?.nombre_completo ||
        null,
      fechas_horario: cap.fechas_horario,
      cantidad_horas: cap.cantidad_horas,
      firma_capacitador_url: cap.firma_capacitador_url,
      aclaracion_capacitador: cap.aclaracion_capacitador,
      firma_empresa_url: cap.firma_empresa_url,
      aclaracion_empresa: cap.aclaracion_empresa,
      empresa: cap.empresas,
      asistencias,
    };

    if (format === "xlsx" || format === "excel" || format === "csv") {
      const buffer = await buildRegistroExcel(registroData);
      return { type: "xlsx" as const, buffer };
    }

    if (format === "pdf") {
      const doc = await buildRegistroPdf(registroData);
      return { type: "pdf" as const, doc };
    }

    return { error: "Formato no soportado", code: 400 };
  },

  /**
   * Plantilla en blanco del REGISTRO DE CAPACITACIÓN (PDF) para imprimir y firmar en papel.
   */
  async generarPlantillaRegistroManual(params: {
    empresa_id: string;
    titulo?: string;
    fecha?: string;
    instructor?: string;
    fechas_horario?: string;
    cantidad_horas?: string;
  }) {
    const { data: empresa, error } = await supabaseAdmin
      .from("empresas")
      .select("razon_social, logo_url")
      .eq("id", params.empresa_id)
      .single();

    if (error || !empresa) {
      return { error: "Empresa no encontrada", code: 404 as const };
    }

    const doc = await buildRegistroPdf({
      titulo: (params.titulo || "").trim() || "________________",
      fecha: params.fecha || null,
      instructor: (params.instructor || "").trim() || null,
      fechas_horario: (params.fechas_horario || "").trim() || null,
      cantidad_horas: (params.cantidad_horas || "").trim() || null,
      firma_capacitador_url: null,
      aclaracion_capacitador: null,
      firma_empresa_url: null,
      aclaracion_empresa: null,
      empresa,
      asistencias: [],
    });

    return { type: "pdf" as const, doc };
  },

  /**
   * Plantilla del registro usando los datos de una capacitación existente.
   */
  async generarPlantillaRegistroPorCapacitacion(id: string) {
    const { data: cap, error } = await supabaseAdmin
      .from("capacitaciones")
      .select(
        `
        id,
        titulo,
        fecha,
        instructor,
        fechas_horario,
        cantidad_horas,
        empresas(razon_social, logo_url)
      `,
      )
      .eq("id", id)
      .single();

    if (error || !cap) {
      return { error: "Capacitación no encontrada", code: 404 as const };
    }

    const doc = await buildRegistroPdf({
      titulo: (cap.titulo || "").trim() || "________________",
      fecha: cap.fecha || null,
      instructor: (cap.instructor || "").trim() || null,
      fechas_horario: (cap.fechas_horario || "").trim() || null,
      cantidad_horas: (cap.cantidad_horas || "").trim() || null,
      firma_capacitador_url: null,
      aclaracion_capacitador: null,
      firma_empresa_url: null,
      aclaracion_empresa: null,
      empresa: (cap as { empresas?: { razon_social?: string; logo_url?: string } })
        .empresas,
      asistencias: [],
    });

    return { type: "pdf" as const, doc, titulo: cap.titulo };
  },

  /**
   * Actualizar datos del registro (instructor/horas/firmas) sin tocar el contenido
   */
  async actualizarRegistro(id: string, body: any) {
    const allowed: Record<string, unknown> = {};
    const fields = [
      "instructor",
      "fecha",
      "fechas_horario",
      "cantidad_horas",
      "aclaracion_capacitador",
      "aclaracion_empresa",
    ] as const;

    for (const field of fields) {
      if (body[field] !== undefined) allowed[field] = body[field];
    }

    const uploadFirma = async (
      firma: string | undefined,
      pathPrefix: string,
    ) => {
      if (!firma || typeof firma !== "string" || !firma.startsWith("data:image/"))
        return null;
      const base64Data = firma.replace(/^data:image\/\w+;base64,/, "");
      const buffer = Buffer.from(base64Data, "base64");
      const firmaPath = `capacitaciones/${id}/${pathPrefix}_${Date.now()}.png`;
      const { error: storageError } = await supabaseAdmin.storage
        .from("firmas_digitales")
        .upload(firmaPath, buffer, { contentType: "image/png", upsert: true });
      if (storageError) throw new Error(storageError.message);
      const { data: urlData } = supabaseAdmin.storage
        .from("firmas_digitales")
        .getPublicUrl(firmaPath);
      return urlData.publicUrl;
    };

    if (body.firma_capacitador) {
      allowed.firma_capacitador_url = await uploadFirma(
        body.firma_capacitador,
        "firma_capacitador",
      );
    }
    if (body.firma_empresa) {
      allowed.firma_empresa_url = await uploadFirma(
        body.firma_empresa,
        "firma_empresa",
      );
    }

    if (Object.keys(allowed).length === 0) {
      return { error: "No hay datos para actualizar", code: 400 };
    }

    const { data, error } = await supabaseAdmin
      .from("capacitaciones")
      .update(allowed)
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
    return { data: await firmarUrlsCapacitacion(data) };
  },

  /**
   * Base histórica paginada: asistencias de la empresa con tema y calificación.
   */
  async listarHistorico(empresaId: string, opts: HistoricoFiltros = {}) {
    const limit = clampInt(opts.limit, HISTORICO_PAGE_DEFAULT, 1, HISTORICO_PAGE_MAX);
    const offset = clampInt(opts.offset, 0, 0, 500_000);

    let query = supabaseAdmin
      .from("capacitacion_asistencias")
      .select(
        `
        id,
        capacitacion_id,
        nombre_empleado,
        documento,
        puntaje,
        firmado_at,
        capacitaciones!inner (
          titulo,
          fecha,
          con_evaluacion,
          origen,
          empresa_id
        )
      `,
        { count: "exact" },
      )
      .eq("capacitaciones.empresa_id", empresaId);

    query = applyHistoricoFilters(query, opts);

    const { data, error, count } = await query
      .order("firmado_at", { ascending: false, nullsFirst: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;

    const registros = mapHistoricoRows(data ?? []);

    return {
      registros,
      total: count ?? 0,
      limit,
      offset,
    };
  },

  async exportarHistorico(empresaId: string, opts: HistoricoFiltros = {}) {
    const allRows: CapacitacionHistoricoRow[] = [];
    let offset = 0;
    let total = 0;

    do {
      const page = await this.listarHistorico(empresaId, {
        ...opts,
        limit: HISTORICO_EXPORT_BATCH,
        offset,
      });
      total = page.total;
      allRows.push(...page.registros);
      offset += HISTORICO_EXPORT_BATCH;
      if (allRows.length >= HISTORICO_EXPORT_MAX) break;
    } while (offset < total);

    if (total > HISTORICO_EXPORT_MAX) {
      throw new HttpError(
        400,
        `Hay más de ${HISTORICO_EXPORT_MAX} registros. Acotá los filtros antes de exportar.`,
      );
    }

    const { data: empresa } = await supabaseAdmin
      .from("empresas")
      .select(`
        id,
        razon_social,
        cuit,
        logo_url,
        consultora_id,
        consultoras (
          id,
          nombre,
          logo_url
        )
      `)
      .eq("id", empresaId)
      .maybeSingle();

    const consultoraRaw = (empresa as any)?.consultoras;
    const consultora = Array.isArray(consultoraRaw)
      ? consultoraRaw[0]
      : consultoraRaw;

    let consultoraLogoUrl = consultora?.logo_url;
    let consultoraNombre = consultora?.nombre;
    if (!consultoraNombre && empresa?.consultora_id) {
      const { data: c } = await supabaseAdmin
        .from("consultoras")
        .select("nombre, logo_url")
        .eq("id", empresa.consultora_id)
        .maybeSingle();
      if (c) {
        consultoraLogoUrl = c.logo_url;
        consultoraNombre = c.nombre;
      }
    }

    const [logoEmpresa, logoConsultora] = await Promise.all([
      getScaledLogo(empresa?.logo_url, 130, 50),
      getScaledLogo(consultoraLogoUrl, 130, 50),
    ]);

    const wb = new ExcelJS.Workbook();
    wb.creator = "Legajo Técnico Digital";
    wb.created = new Date();

    const ws = wb.addWorksheet("Capacitaciones", {
      views: [{ showGridLines: true, state: "frozen", ySplit: 5 }],
      pageSetup: {
        orientation: "landscape",
        fitToPage: true,
        fitToWidth: 1,
        fitToHeight: 0,
      },
    });

    // Ancho de columnas optimizado
    ws.columns = [
      { width: 7 },   // A: N°
      { width: 34 },  // B: Participante
      { width: 16 },  // C: DNI
      { width: 40 },  // D: Tema de Capacitación
      { width: 22 },  // E: Fecha y Hora
      { width: 16 },  // F: Calificación
      { width: 18 },  // G: Estado
    ];

    // Fila 1: Header con Logos y Título
    ws.getRow(1).height = 62;

    // Col A y B: Logo Consultora
    ws.mergeCells("A1:B1");
    const cellCons = ws.getCell("A1");
    cellCons.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFFFFF" } };
    cellCons.border = {
      top: { style: "thin", color: { argb: "FFE2E8F0" } },
      bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
      left: { style: "thin", color: { argb: "FFE2E8F0" } },
      right: { style: "thin", color: { argb: "FFE2E8F0" } },
    };

    if (logoConsultora) {
      const imgIdCons = wb.addImage({
        buffer: logoConsultora.buffer as any,
        extension: logoConsultora.extension,
      });
      // Centrado en A1:B1 (ancho cols A+B ~300px)
      const colOffsetCons = Math.max(0.12, (2 - (logoConsultora.width / 140)) / 2);
      const rowOffsetCons = Math.max(0.08, (62 - logoConsultora.height) / (2 * 62));
      ws.addImage(imgIdCons, {
        tl: { col: colOffsetCons, row: rowOffsetCons },
        ext: { width: logoConsultora.width, height: logoConsultora.height },
      });
    } else {
      cellCons.value = consultoraNombre || "CONSULTORA";
      cellCons.font = { name: "Calibri", size: 11, bold: true, color: { argb: "FF1E3A8A" } };
      cellCons.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    }

    // Col C, D y E: Título Central
    ws.mergeCells("C1:E1");
    const cellTitle = ws.getCell("C1");
    cellTitle.value = "BASE DE DATOS HISTÓRICA DE CAPACITACIONES";
    cellTitle.font = { name: "Calibri", size: 13, bold: true, color: { argb: "FFFFFFFF" } };
    cellTitle.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E3A8A" } }; // Navy Blue
    cellTitle.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    cellTitle.border = {
      top: { style: "thin", color: { argb: "FF1E3A8A" } },
      bottom: { style: "thin", color: { argb: "FF1E3A8A" } },
      left: { style: "thin", color: { argb: "FF1E3A8A" } },
      right: { style: "thin", color: { argb: "FF1E3A8A" } },
    };

    // Col F y G: Logo Empresa
    ws.mergeCells("F1:G1");
    const cellEmp = ws.getCell("F1");
    cellEmp.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFFFFF" } };
    cellEmp.border = {
      top: { style: "thin", color: { argb: "FFE2E8F0" } },
      bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
      left: { style: "thin", color: { argb: "FFE2E8F0" } },
      right: { style: "thin", color: { argb: "FFE2E8F0" } },
    };

    if (logoEmpresa) {
      const imgIdEmp = wb.addImage({
        buffer: logoEmpresa.buffer as any,
        extension: logoEmpresa.extension,
      });
      // Centrado en F1:G1 (col F es index 5)
      const colOffsetEmp = 5 + Math.max(0.12, (2 - (logoEmpresa.width / 120)) / 2);
      const rowOffsetEmp = Math.max(0.08, (62 - logoEmpresa.height) / (2 * 62));
      ws.addImage(imgIdEmp, {
        tl: { col: colOffsetEmp, row: rowOffsetEmp },
        ext: { width: logoEmpresa.width, height: logoEmpresa.height },
      });
    } else {
      cellEmp.value = empresa?.razon_social || "EMPRESA";
      cellEmp.font = { name: "Calibri", size: 10, bold: true, color: { argb: "FF1E293B" } };
      cellEmp.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    }

    // Fila 2: Subtítulo con metadata
    ws.mergeCells("A2:G2");
    const cellSub = ws.getCell("A2");
    const fechaEmision = new Date().toLocaleString("es-AR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
    cellSub.value = `Empresa: ${empresa?.razon_social || "N/A"}   |   CUIT: ${empresa?.cuit || "N/A"}   |   Fecha de emisión: ${fechaEmision}`;
    cellSub.font = { name: "Calibri", size: 10, bold: false, color: { argb: "FF334155" } };
    cellSub.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF1F5F9" } };
    cellSub.alignment = { vertical: "middle", horizontal: "center" };
    cellSub.border = {
      bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
    };
    ws.getRow(2).height = 22;

    // Fila 3: Resumen de filtros
    ws.mergeCells("A3:G3");
    const cellFiltros = ws.getCell("A3");
    const partesFiltro: string[] = [`Total de registros exportados: ${allRows.length}`];
    if (opts.tema) partesFiltro.push(`Tema: "${opts.tema}"`);
    if (opts.participante) partesFiltro.push(`Participante: "${opts.participante}"`);
    if (opts.fecha_desde || opts.fecha_hasta) {
      partesFiltro.push(`Período: ${opts.fecha_desde || "Inicio"} al ${opts.fecha_hasta || "Hoy"}`);
    }
    if (opts.resultado && opts.resultado !== "todos") {
      partesFiltro.push(`Resultado: ${opts.resultado.toUpperCase()}`);
    }
    cellFiltros.value = partesFiltro.join("   •   ");
    cellFiltros.font = { name: "Calibri", size: 9.5, italic: true, color: { argb: "FF64748B" } };
    cellFiltros.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF8FAFC" } };
    cellFiltros.alignment = { vertical: "middle", horizontal: "center" };
    cellFiltros.border = {
      bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
    };
    ws.getRow(3).height = 20;

    // Fila 4: Separador
    ws.getRow(4).height = 8;

    // Fila 5: Encabezados de la Tabla
    const headers = [
      "N°",
      "Participante",
      "DNI",
      "Tema de Capacitación",
      "Fecha de Visita",
      "Calificación",
      "Estado",
    ];
    const headerRow = ws.getRow(5);
    headerRow.values = headers;
    headerRow.height = 26;
    headerRow.eachCell({ includeEmpty: false }, (cell, colNumber) => {
      cell.font = { name: "Calibri", size: 11, bold: true, color: { argb: "FFFFFFFF" } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF2563EB" } }; // Royal Blue
      cell.alignment = {
        vertical: "middle",
        horizontal: colNumber === 2 || colNumber === 4 ? "left" : "center",
        wrapText: true,
      };
      cell.border = {
        top: { style: "thin", color: { argb: "FF1D4ED8" } },
        bottom: { style: "medium", color: { argb: "FF1D4ED8" } },
        left: { style: "thin", color: { argb: "FF1D4ED8" } },
        right: { style: "thin", color: { argb: "FF1D4ED8" } },
      };
    });

    ws.autoFilter = { from: "A5", to: "G5" };

    // Filas de Datos (a partir de la fila 6)
    allRows.forEach((r, idx) => {
      const rowNumber = idx + 6;
      const row = ws.getRow(rowNumber);
      row.height = 22;

      const fechaStr = r.fecha
        ? new Date(r.fecha).toLocaleString("es-AR", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })
        : "—";

      const califStr = r.con_evaluacion
        ? `${r.calificacion ?? 0}%`
        : "Sin examen";

      let estadoStr = "ASISTIÓ";
      let estadoFg = "FF1E40AF"; // Blue
      let estadoBg = "FFEFF6FF";

      if (r.con_evaluacion) {
        const puntaje = r.calificacion ?? 0;
        if (puntaje >= 70 || r.aprobado) {
          estadoStr = "APROBADO";
          estadoFg = "FF166534"; // Dark Green
          estadoBg = "FFDCFCE7"; // Light Green
        } else {
          estadoStr = "DESAPROBADO";
          estadoFg = "FF991B1B"; // Dark Red
          estadoBg = "FFFEE2E2"; // Light Red
        }
      }

      row.values = [
        idx + 1,
        r.participante || "—",
        r.dni || "—",
        r.tema || "—",
        fechaStr,
        califStr,
        estadoStr,
      ];

      const isEven = idx % 2 === 0;
      const zebraBg = isEven ? "FFFFFFFF" : "FFF8FAFC";

      row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        if (colNumber === 7) {
          cell.font = { name: "Calibri", size: 10, bold: true, color: { argb: estadoFg } };
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: estadoBg } };
          cell.alignment = { vertical: "middle", horizontal: "center" };
        } else {
          cell.font = {
            name: "Calibri",
            size: 10,
            bold: colNumber === 2,
            color: { argb: "FF1E293B" },
          };
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: zebraBg } };
          cell.alignment = {
            vertical: "middle",
            horizontal: colNumber === 2 || colNumber === 4 ? "left" : "center",
          };
        }

        cell.border = {
          top: { style: "thin", color: { argb: "FFE2E8F0" } },
          bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
          left: { style: "thin", color: { argb: "FFE2E8F0" } },
          right: { style: "thin", color: { argb: "FFE2E8F0" } },
        };
      });
    });

    const arrayBuffer = await wb.xlsx.writeBuffer();
    return Buffer.from(arrayBuffer);
  },
};

function mapHistoricoRows(rows: any[]): CapacitacionHistoricoRow[] {
  return rows.map((row) => {
    const cap = row.capacitaciones as {
      titulo?: string;
      fecha?: string;
      con_evaluacion?: boolean;
      origen?: string;
    } | null;
    const califMeta = historicoCalificacionMeta(cap, row.puntaje);
    return {
      id: row.id,
      capacitacion_id: row.capacitacion_id,
      participante: row.nombre_empleado ?? "",
      dni: row.documento ?? "",
      tema: cap?.titulo ?? "—",
      fecha: cap?.fecha || row.firmado_at || "",
      calificacion: califMeta.calificacion,
      aprobado: califMeta.aprobado,
      con_evaluacion: califMeta.con_evaluacion,
    };
  });
}

export type CapacitacionHistoricoRow = {
  id: string;
  capacitacion_id: string;
  participante: string;
  dni: string;
  tema: string;
  fecha: string;
  calificacion: number | null;
  aprobado: boolean;
  con_evaluacion: boolean;
};

async function getScaledLogo(
  url?: string | null,
  maxWidth = 130,
  maxHeight = 50,
): Promise<{ buffer: Buffer; extension: "png" | "jpeg"; width: number; height: number } | null> {
  if (!url) return null;
  const img = await fetchImageBuffer(url);
  if (!img) return null;
  try {
    const meta = await sharp(img.buffer).metadata();
    const origW = meta.width || maxWidth;
    const origH = meta.height || maxHeight;
    const scale = Math.min(maxWidth / origW, maxHeight / origH, 1);
    const width = Math.max(24, Math.round(origW * scale));
    const height = Math.max(24, Math.round(origH * scale));
    return {
      buffer: img.buffer,
      extension: img.extension,
      width,
      height,
    };
  } catch {
    return {
      buffer: img.buffer,
      extension: img.extension,
      width: maxWidth,
      height: maxHeight,
    };
  }
}
