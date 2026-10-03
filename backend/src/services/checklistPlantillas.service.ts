import { supabaseAdmin } from "../config/supabase";
import { notificacionService } from "./notificacion.service";

export type AmbitoPlantilla = "empresa" | "global";
export type EstadoPublicacion = "pendiente" | "aprobada" | "rechazada";

export type ItemPlantillaInput = {
  texto: string;
  criticidad: "alta" | "media" | "baja";
  orden?: number;
};

function mapListRow(p: Record<string, unknown>) {
  const items = (p.checklist_plantilla_items as unknown[]) || [];
  const autor = p.autor as
    | { nombre_completo?: string; username?: string }
    | null
    | undefined;
  return {
    id: p.id,
    titulo: p.titulo,
    tipo_equipo: p.tipo_equipo,
    ambito: p.ambito,
    empresa_id: p.empresa_id,
    estado_publicacion: p.estado_publicacion ?? null,
    aprobado_por: p.aprobado_por ?? null,
    aprobado_at: p.aprobado_at ?? null,
    rechazo_motivo: p.rechazo_motivo ?? null,
    created_by: p.created_by,
    created_at: p.created_at,
    updated_at: p.updated_at,
    total_items: items.length,
    autor_nombre: autor?.nombre_completo || autor?.username || null,
  };
}

export const checklistPlantillasService = {
  async listar(params: {
    ambito: AmbitoPlantilla;
    empresa_id?: string;
    estado_publicacion?: EstadoPublicacion | "todas";
    incluirNoPublicadas?: boolean;
    tipo_equipo?: string;
  }) {
    let query = supabaseAdmin
      .from("checklist_plantillas")
      .select(
        `
        id, titulo, tipo_equipo, ambito, empresa_id, created_by, created_at, updated_at,
        estado_publicacion, aprobado_por, aprobado_at, rechazo_motivo,
        checklist_plantilla_items(id),
        autor:perfiles!checklist_plantillas_created_by_fkey(nombre_completo, username)
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

    if (params.tipo_equipo) {
      query = query.eq("tipo_equipo", params.tipo_equipo);
    }

    const { data, error } = await query;
    if (error) throw error;
    return (data || []).map((row) => mapListRow(row as Record<string, unknown>));
  },

  async obtenerPorId(id: string) {
    const { data, error } = await supabaseAdmin
      .from("checklist_plantillas")
      .select(
        `
        *,
        checklist_plantilla_items(id, texto, orden, criticidad),
        autor:perfiles!checklist_plantillas_created_by_fkey(nombre_completo, username)
      `,
      )
      .eq("id", id)
      .single();

    if (error) {
      if (error.code === "PGRST116") return null;
      throw error;
    }

    const items = ((data.checklist_plantilla_items as Array<{
      id: string;
      texto: string;
      orden: number;
      criticidad: string;
    }>) || [])
      .slice()
      .sort((a, b) => a.orden - b.orden);

    return {
      ...data,
      items,
      checklist_plantilla_items: items,
      total_items: items.length,
      autor_nombre:
        data.autor?.nombre_completo || data.autor?.username || null,
    };
  },

  async crear(params: {
    titulo: string;
    tipo_equipo: string;
    ambito: AmbitoPlantilla;
    empresa_id?: string | null;
    created_by: string;
    publicar_directo?: boolean;
    items: ItemPlantillaInput[];
    consultora_id?: string;
  }) {
    let estado_publicacion: EstadoPublicacion | null = null;
    if (params.ambito === "global") {
      estado_publicacion = params.publicar_directo ? "aprobada" : "pendiente";
    }

    const { data: plantilla, error } = await supabaseAdmin
      .from("checklist_plantillas")
      .insert({
        titulo: params.titulo,
        tipo_equipo: params.tipo_equipo,
        ambito: params.ambito,
        empresa_id: params.ambito === "empresa" ? params.empresa_id : null,
        estado_publicacion,
        aprobado_por:
          estado_publicacion === "aprobada" ? params.created_by : null,
        aprobado_at:
          estado_publicacion === "aprobada"
            ? new Date().toISOString()
            : null,
        created_by: params.created_by,
      })
      .select()
      .single();

    if (error) throw error;

    const itemsInsert = params.items.map((item, idx) => ({
      plantilla_id: plantilla.id,
      texto: item.texto,
      criticidad: item.criticidad,
      orden: item.orden ?? idx + 1,
    }));

    const { error: itemsError } = await supabaseAdmin
      .from("checklist_plantilla_items")
      .insert(itemsInsert);

    if (itemsError) throw itemsError;

    if (
      params.ambito === "global" &&
      estado_publicacion === "pendiente" &&
      params.consultora_id
    ) {
      await notificacionService.enviarAAdmins({
        consultora_id: params.consultora_id,
        titulo: "Checklist pendiente de aprobación",
        mensaje: `La plantilla "${params.titulo}" espera revisión en la biblioteca LT.`,
        tipo: "info",
      });
    }

    return this.obtenerPorId(plantilla.id);
  },

  async actualizar(
    id: string,
    patch: {
      titulo?: string;
      tipo_equipo?: string;
      items?: ItemPlantillaInput[];
    },
  ) {
    // Transacción atómica vía RPC: update + replace items
    // (evita plantilla vacía si falla el insert tras el delete).
    const { error } = await supabaseAdmin.rpc(
      "replace_checklist_plantilla_items",
      {
        p_plantilla_id: id,
        p_titulo: patch.titulo ?? null,
        p_tipo_equipo: patch.tipo_equipo ?? null,
        p_items: patch.items
          ? patch.items.map((item, idx) => ({
              texto: item.texto,
              criticidad: item.criticidad,
              orden: item.orden ?? idx + 1,
            }))
          : null,
      },
    );

    if (error) throw error;
    return this.obtenerPorId(id);
  },

  async actualizarPublicacion(
    id: string,
    params: {
      estado: "aprobada" | "rechazada";
      rechazo_motivo?: string | null;
      aprobado_por: string;
    },
  ) {
    const { error } = await supabaseAdmin
      .from("checklist_plantillas")
      .update({
        estado_publicacion: params.estado,
        aprobado_por: params.aprobado_por,
        aprobado_at: new Date().toISOString(),
        rechazo_motivo:
          params.estado === "rechazada" ? params.rechazo_motivo || null : null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("ambito", "global");

    if (error) throw error;
    return this.obtenerPorId(id);
  },

  async eliminar(id: string) {
    const { error } = await supabaseAdmin
      .from("checklist_plantillas")
      .delete()
      .eq("id", id);
    if (error) throw error;
    return true;
  },
};
