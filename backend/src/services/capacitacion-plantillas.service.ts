import { supabaseAdmin } from "../config/supabase";
import {
  CapacitacionDiapositiva,
  ensureDiapositivas,
  resolveDiapositivasAndTemario,
} from "../utils/cap-diapositivas";

export type AmbitoPlantilla = "empresa" | "global";
export type EstadoPublicacionPlantilla =
  | "pendiente"
  | "aprobada"
  | "rechazada";

export interface PreguntaPlantillaInput {
  pregunta?: string;
  enunciado?: string;
  opciones: string[] | unknown;
  respuesta_correcta: string | number | number[];
}

function mapPreguntasInsert(
  plantillaId: string,
  preguntas: PreguntaPlantillaInput[],
) {
  return preguntas.map((p, idx) => ({
    plantilla_id: plantillaId,
    enunciado: p.pregunta || p.enunciado || "",
    opciones: p.opciones,
    respuesta_correcta:
      typeof p.respuesta_correcta === "string"
        ? p.respuesta_correcta
        : JSON.stringify(p.respuesta_correcta),
    orden: idx + 1,
  }));
}

function mapPlantillaListRow(p: any) {
  return {
    id: p.id,
    ambito: p.ambito,
    empresa_id: p.empresa_id,
    titulo: p.titulo,
    temario: p.temario,
    diapositivas: ensureDiapositivas(p.diapositivas, p.temario),
    created_by: p.created_by,
    created_at: p.created_at,
    updated_at: p.updated_at,
    estado_publicacion: p.estado_publicacion ?? null,
    aprobado_por: p.aprobado_por ?? null,
    aprobado_at: p.aprobado_at ?? null,
    rechazo_motivo: p.rechazo_motivo ?? null,
    total_preguntas: p.capacitacion_plantilla_preguntas?.length || 0,
    autor_nombre:
      p.autor?.nombre_completo || p.autor?.username || null,
  };
}

export const capacitacionPlantillasService = {
  async listar(params: {
    ambito: AmbitoPlantilla;
    empresa_id?: string;
    /** Solo admin: filtrar globales por estado. Default: todas. */
    estado_publicacion?: EstadoPublicacionPlantilla | "todas";
    /** Si false, solo plantillas globales aprobadas (clientes). */
    incluirNoPublicadas?: boolean;
  }) {
    let query = supabaseAdmin
      .from("capacitacion_plantillas")
      .select(
        `
        id, ambito, empresa_id, titulo, temario, diapositivas, created_by, created_at, updated_at,
        estado_publicacion, aprobado_por, aprobado_at, rechazo_motivo,
        capacitacion_plantilla_preguntas(id),
        autor:perfiles!capacitacion_plantillas_created_by_fkey(nombre_completo, username)
      `,
      )
      .eq("ambito", params.ambito)
      .order("updated_at", { ascending: false });

    if (params.ambito === "empresa") {
      if (!params.empresa_id) {
        throw new Error("empresa_id es requerido para ambito=empresa");
      }
      query = query.eq("empresa_id", params.empresa_id);
    } else {
      query = query.is("empresa_id", null);
      if (!params.incluirNoPublicadas) {
        query = query.eq("estado_publicacion", "aprobada");
      } else if (
        params.estado_publicacion &&
        params.estado_publicacion !== "todas"
      ) {
        query = query.eq("estado_publicacion", params.estado_publicacion);
      }
    }

    const { data, error } = await query;
    if (error) throw error;

    return (data || []).map(mapPlantillaListRow);
  },

  async obtenerPorId(id: string) {
    const { data, error } = await supabaseAdmin
      .from("capacitacion_plantillas")
      .select(
        `
        *,
        capacitacion_plantilla_preguntas(
          id, enunciado, opciones, respuesta_correcta, orden
        ),
        autor:perfiles!capacitacion_plantillas_created_by_fkey(nombre_completo, username)
      `,
      )
      .eq("id", id)
      .single();

    if (error) {
      if (error.code === "PGRST116") return null;
      throw error;
    }

    const preguntas = (data.capacitacion_plantilla_preguntas || [])
      .slice()
      .sort((a: any, b: any) => a.orden - b.orden)
      .map((p: any) => ({
        id: p.id,
        plantilla_id: id,
        enunciado: p.enunciado,
        pregunta: p.enunciado,
        opciones: p.opciones,
        respuesta_correcta: p.respuesta_correcta,
        orden: p.orden,
      }));

    return {
      ...data,
      diapositivas: ensureDiapositivas(data.diapositivas, data.temario),
      capacitacion_plantilla_preguntas: preguntas,
      total_preguntas: preguntas.length,
      autor_nombre:
        data.autor?.nombre_completo || data.autor?.username || null,
    };
  },

  async crear(params: {
    ambito: AmbitoPlantilla;
    empresa_id?: string | null;
    titulo: string;
    temario?: string;
    diapositivas?: CapacitacionDiapositiva[];
    created_by: string;
    preguntas?: PreguntaPlantillaInput[];
    /** Admin crea ya publicada; preventor envía a revisión. */
    publicarDirecto?: boolean;
  }) {
    if (params.ambito === "global" && params.empresa_id) {
      throw new Error("Las plantillas globales no pueden tener empresa_id");
    }
    if (params.ambito === "empresa" && !params.empresa_id) {
      throw new Error("empresa_id es requerido para plantillas de empresa");
    }

    const { diapositivas, temario } = resolveDiapositivasAndTemario({
      diapositivas: params.diapositivas,
      temario: params.temario,
    });

    const estadoPublicacion =
      params.ambito === "global"
        ? params.publicarDirecto
          ? "aprobada"
          : "pendiente"
        : null;

    const { data: plantilla, error } = await supabaseAdmin
      .from("capacitacion_plantillas")
      .insert({
        ambito: params.ambito,
        empresa_id: params.ambito === "empresa" ? params.empresa_id : null,
        titulo: params.titulo,
        temario,
        diapositivas,
        created_by: params.created_by,
        estado_publicacion: estadoPublicacion,
        aprobado_por: estadoPublicacion === "aprobada" ? params.created_by : null,
        aprobado_at:
          estadoPublicacion === "aprobada" ? new Date().toISOString() : null,
      })
      .select()
      .single();

    if (error) throw error;

    const preguntas = params.preguntas || [];
    if (preguntas.length > 0) {
      const { error: pregError } = await supabaseAdmin
        .from("capacitacion_plantilla_preguntas")
        .insert(mapPreguntasInsert(plantilla.id, preguntas));
      if (pregError) throw pregError;
    }

    return this.obtenerPorId(plantilla.id);
  },

  async actualizar(
    id: string,
    params: {
      titulo?: string;
      temario?: string;
      diapositivas?: CapacitacionDiapositiva[];
      preguntas?: PreguntaPlantillaInput[];
    },
  ) {
    const updatePayload: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if (params.titulo !== undefined) updatePayload.titulo = params.titulo;
    if (params.diapositivas !== undefined || params.temario !== undefined) {
      const resolved = resolveDiapositivasAndTemario({
        diapositivas: params.diapositivas,
        temario: params.temario,
      });
      updatePayload.temario = resolved.temario;
      updatePayload.diapositivas = resolved.diapositivas;
    }

    const { error } = await supabaseAdmin
      .from("capacitacion_plantillas")
      .update(updatePayload)
      .eq("id", id);

    if (error) throw error;

    if (params.preguntas !== undefined) {
      const { error: delError } = await supabaseAdmin
        .from("capacitacion_plantilla_preguntas")
        .delete()
        .eq("plantilla_id", id);
      if (delError) throw delError;

      if (params.preguntas.length > 0) {
        const { error: pregError } = await supabaseAdmin
          .from("capacitacion_plantilla_preguntas")
          .insert(mapPreguntasInsert(id, params.preguntas));
        if (pregError) throw pregError;
      }
    }

    return this.obtenerPorId(id);
  },

  async cambiarEstadoPublicacion(
    id: string,
    params: {
      estado: "aprobada" | "rechazada";
      adminId: string;
      rechazo_motivo?: string | null;
    },
  ) {
    const existente = await this.obtenerPorId(id);
    if (!existente) {
      return { error: "Plantilla no encontrada", code: 404 as const };
    }
    if (existente.ambito !== "global") {
      return {
        error: "Solo las plantillas de la biblioteca LT requieren aprobación",
        code: 400 as const,
      };
    }

    const updatePayload: Record<string, unknown> = {
      estado_publicacion: params.estado,
      aprobado_por: params.adminId,
      aprobado_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      rechazo_motivo:
        params.estado === "rechazada"
          ? (params.rechazo_motivo || "").trim() || null
          : null,
    };

    const { error } = await supabaseAdmin
      .from("capacitacion_plantillas")
      .update(updatePayload)
      .eq("id", id);

    if (error) throw error;
    return { data: await this.obtenerPorId(id) };
  },

  async eliminar(id: string) {
    const { error } = await supabaseAdmin
      .from("capacitacion_plantillas")
      .delete()
      .eq("id", id);
    if (error) throw error;
  },
};
