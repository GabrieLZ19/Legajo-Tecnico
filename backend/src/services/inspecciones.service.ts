import { supabaseAdmin } from "../config/supabase";
import {
  calcularResultadoInspeccion,
  type CalificacionItem,
  type CriticidadItem,
} from "../utils/inspeccionResultado";

export type ItemInspeccionInput = {
  texto: string;
  criticidad: CriticidadItem;
  calificacion: CalificacionItem;
  orden?: number;
};

export type AccionInspeccionInput = {
  descripcion: string;
  responsable?: string | null;
  fecha_vencimiento?: string | null;
};

export const inspeccionesService = {
  async listar(params: {
    empresaId: string;
    equipoId?: string;
    limit?: number;
    offset?: number;
  }) {
    const limit = Math.min(Math.max(params.limit ?? 50, 1), 200);
    const offset = Math.max(params.offset ?? 0, 0);

    let query = supabaseAdmin
      .from("inspecciones")
      .select(
        `
        *,
        equipos(id, nombre, tipo_equipo, codigo_interno),
        inspeccion_acciones(id, estado)
      `,
        { count: "exact" },
      )
      .eq("empresa_id", params.empresaId)
      .order("fecha", { ascending: false })
      .range(offset, offset + limit - 1);

    if (params.equipoId) {
      query = query.eq("equipo_id", params.equipoId);
    }

    const { data, error, count } = await query;
    if (error) throw error;

    return {
      inspecciones: (data || []).map((row) => ({
        ...row,
        total_acciones: (row.inspeccion_acciones || []).length,
        acciones_pendientes: (row.inspeccion_acciones || []).filter(
          (a: { estado: string }) => a.estado !== "cumplida",
        ).length,
      })),
      total: count ?? 0,
      limit,
      offset,
    };
  },

  async historialEquipo(equipoId: string) {
    const { data, error } = await supabaseAdmin
      .from("inspecciones")
      .select(
        `
        *,
        inspeccion_items(id, texto, criticidad, calificacion, orden),
        inspeccion_acciones(*)
      `,
      )
      .eq("equipo_id", equipoId)
      .order("fecha", { ascending: false });

    if (error) throw error;
    return data || [];
  },

  async obtenerPorId(id: string) {
    const { data, error } = await supabaseAdmin
      .from("inspecciones")
      .select(
        `
        *,
        equipos(*),
        inspeccion_items(*),
        inspeccion_acciones(*)
      `,
      )
      .eq("id", id)
      .single();

    if (error) {
      if (error.code === "PGRST116") return null;
      throw error;
    }

    const items = ((data.inspeccion_items as Array<{ orden: number }>) || [])
      .slice()
      .sort((a, b) => a.orden - b.orden);

    return {
      ...data,
      items,
      inspeccion_items: items,
      acciones: data.inspeccion_acciones || [],
    };
  },

  async obtenerPorIdempotencyKey(key: string) {
    const { data, error } = await supabaseAdmin
      .from("inspecciones")
      .select("id")
      .eq("idempotency_key", key)
      .maybeSingle();

    if (error) throw error;
    if (!data) return null;
    return this.obtenerPorId(data.id);
  },

  async crear(params: {
    empresa_id: string;
    equipo_id: string;
    plantilla_id?: string | null;
    plantilla_titulo: string;
    inspector_id?: string | null;
    inspector_nombre?: string | null;
    observaciones?: string | null;
    items: ItemInspeccionInput[];
    acciones?: AccionInspeccionInput[];
    /** Evita duplicados por reintentos (QR / red inestable). */
    idempotency_key?: string | null;
  }) {
    if (params.idempotency_key) {
      const existing = await this.obtenerPorIdempotencyKey(
        params.idempotency_key,
      );
      if (existing) return existing;
    }

    const resultado = calcularResultadoInspeccion(params.items);

    const { data: insp, error } = await supabaseAdmin
      .from("inspecciones")
      .insert({
        empresa_id: params.empresa_id,
        equipo_id: params.equipo_id,
        plantilla_id: params.plantilla_id ?? null,
        plantilla_titulo: params.plantilla_titulo,
        inspector_id: params.inspector_id ?? null,
        inspector_nombre: params.inspector_nombre ?? null,
        observaciones: params.observaciones ?? null,
        resultado,
        estado: "cerrada",
        idempotency_key: params.idempotency_key ?? null,
      })
      .select()
      .single();

    if (error) {
      // Carrera: otro request con la misma clave ganó el insert.
      if (
        error.code === "23505" &&
        params.idempotency_key &&
        String(error.message || "").includes("idempotency")
      ) {
        const existing = await this.obtenerPorIdempotencyKey(
          params.idempotency_key,
        );
        if (existing) return existing;
      }
      // Fallback genérico unique violation
      if (error.code === "23505" && params.idempotency_key) {
        const existing = await this.obtenerPorIdempotencyKey(
          params.idempotency_key,
        );
        if (existing) return existing;
      }
      throw error;
    }

    try {
      const { error: itemsError } = await supabaseAdmin
        .from("inspeccion_items")
        .insert(
          params.items.map((item, idx) => ({
            inspeccion_id: insp.id,
            texto: item.texto,
            criticidad: item.criticidad,
            calificacion: item.calificacion,
            orden: item.orden ?? idx + 1,
          })),
        );

      if (itemsError) throw itemsError;

      if (params.acciones?.length) {
        const { error: accionesError } = await supabaseAdmin
          .from("inspeccion_acciones")
          .insert(
            params.acciones.map((a) => ({
              inspeccion_id: insp.id,
              empresa_id: params.empresa_id,
              descripcion: a.descripcion,
              responsable: a.responsable ?? null,
              fecha_vencimiento: a.fecha_vencimiento ?? null,
            })),
          );
        if (accionesError) throw accionesError;
      }
    } catch (err) {
      await supabaseAdmin.from("inspecciones").delete().eq("id", insp.id);
      throw err;
    }

    return this.obtenerPorId(insp.id);
  },

  async actualizarAccion(
    accionId: string,
    estado: "pendiente" | "en_curso" | "cumplida",
  ) {
    const { data, error } = await supabaseAdmin
      .from("inspeccion_acciones")
      .update({ estado, updated_at: new Date().toISOString() })
      .eq("id", accionId)
      .select()
      .single();

    if (error) throw error;
    return data;
  },
};
