import { supabaseAdmin } from "../config/supabase";
import {
  CapacitacionDiapositiva,
  ensureDiapositivas,
  resolveDiapositivasAndTemario,
} from "../utils/cap-diapositivas";

export type AmbitoPlantilla = "empresa" | "global";

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

export const capacitacionPlantillasService = {
  async listar(params: { ambito: AmbitoPlantilla; empresa_id?: string }) {
    let query = supabaseAdmin
      .from("capacitacion_plantillas")
      .select(
        `
        id, ambito, empresa_id, titulo, temario, diapositivas, created_by, created_at, updated_at,
        capacitacion_plantilla_preguntas(id)
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
    }

    const { data, error } = await query;
    if (error) throw error;

    return (data || []).map((p: any) => ({
      id: p.id,
      ambito: p.ambito,
      empresa_id: p.empresa_id,
      titulo: p.titulo,
      temario: p.temario,
      diapositivas: ensureDiapositivas(p.diapositivas, p.temario),
      created_by: p.created_by,
      created_at: p.created_at,
      updated_at: p.updated_at,
      total_preguntas: p.capacitacion_plantilla_preguntas?.length || 0,
    }));
  },

  async obtenerPorId(id: string) {
    const { data, error } = await supabaseAdmin
      .from("capacitacion_plantillas")
      .select(
        `
        *,
        capacitacion_plantilla_preguntas(
          id, enunciado, opciones, respuesta_correcta, orden
        )
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

    const { data: plantilla, error } = await supabaseAdmin
      .from("capacitacion_plantillas")
      .insert({
        ambito: params.ambito,
        empresa_id: params.ambito === "empresa" ? params.empresa_id : null,
        titulo: params.titulo,
        temario,
        diapositivas,
        created_by: params.created_by,
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

  async eliminar(id: string) {
    const { error } = await supabaseAdmin
      .from("capacitacion_plantillas")
      .delete()
      .eq("id", id);
    if (error) throw error;
  },
};
