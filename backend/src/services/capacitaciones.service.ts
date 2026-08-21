import { supabaseAdmin } from "../config/supabase";
import QRCode from "qrcode";
import { randomUUID } from "crypto";
import {
  CapacitacionDiapositiva,
  ensureDiapositivas,
  resolveDiapositivasAndTemario,
} from "../utils/cap-diapositivas";
import {
  buildRegistroExcel,
  buildRegistroPdf,
} from "./capacitacionRegistroExport.service";

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

export const capacitacionesService = {
  /**
   * Listar capacitaciones de la empresa
   */
  async listar(empresaId: string) {
    const { data, error } = await supabaseAdmin
      .from("capacitaciones")
      .select(
        `
        *,
        capacitacion_preguntas(id),
        capacitacion_asistencias(id)
      `,
      )
      .eq("empresa_id", empresaId)
      .order("created_at", { ascending: false });

    if (error) throw error;

    return (data || []).map((cap: any) => ({
      ...cap,
      total_preguntas: cap.capacitacion_preguntas?.length || 0,
      total_asistencias: cap.capacitacion_asistencias?.length || 0,
      capacitacion_preguntas: undefined,
      capacitacion_asistencias: undefined,
    }));
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

    return data;
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
      throw new Error("Nombre y DNI son obligatorios");
    }
    const dniLimpio = String(dni_empleado).replace(/\D/g, "");
    if (!/^\d{7,8}$/.test(dniLimpio)) {
      throw new Error("DNI inválido. Debe tener 7 u 8 dígitos.");
    }
    if (!firma || typeof firma !== "string" || !firma.startsWith("data:image/")) {
      throw new Error("La firma es obligatoria");
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

    if (capError || !cap) throw new Error("Capacitación no encontrada");
    if (cap.estado !== "activa")
      throw new Error("La capacitación no está activa");

    const conEvaluacion = (cap as any).con_evaluacion !== false;
    const preguntas = conEvaluacion
      ? (cap as any).capacitacion_preguntas || []
      : [];
    let correctas = 0;
    const totalPreguntas = preguntas.length;

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
      throw new Error(
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
    return { data };
  },
};
