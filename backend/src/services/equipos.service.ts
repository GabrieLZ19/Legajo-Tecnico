import { supabaseAdmin } from "../config/supabase";
import { env } from "../config/env";

export const equiposService = {
  async listar(empresaId: string, opts?: { soloActivos?: boolean }) {
    let query = supabaseAdmin
      .from("equipos")
      .select("*")
      .eq("empresa_id", empresaId)
      .order("nombre", { ascending: true });

    if (opts?.soloActivos !== false) {
      query = query.eq("activo", true);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  },

  async obtenerPorId(id: string) {
    const { data, error } = await supabaseAdmin
      .from("equipos")
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      if (error.code === "PGRST116") return null;
      throw error;
    }
    return data;
  },

  async obtenerPorQrToken(token: string) {
    const { data, error } = await supabaseAdmin
      .from("equipos")
      .select(
        `
        *,
        empresas(id, razon_social)
      `,
      )
      .eq("qr_token", token)
      .eq("activo", true)
      .single();

    if (error) {
      if (error.code === "PGRST116") return null;
      throw error;
    }
    return data;
  },

  async crear(params: {
    empresa_id: string;
    nombre: string;
    tipo_equipo: string;
    codigo_interno?: string | null;
    ubicacion?: string | null;
    notas?: string | null;
    created_by: string;
  }) {
    const { data, error } = await supabaseAdmin
      .from("equipos")
      .insert({
        empresa_id: params.empresa_id,
        nombre: params.nombre,
        tipo_equipo: params.tipo_equipo,
        codigo_interno: params.codigo_interno ?? null,
        ubicacion: params.ubicacion ?? null,
        notas: params.notas ?? null,
        created_by: params.created_by,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async actualizar(
    id: string,
    patch: {
      nombre?: string;
      tipo_equipo?: string;
      codigo_interno?: string | null;
      ubicacion?: string | null;
      notas?: string | null;
      activo?: boolean;
    },
  ) {
    const { data, error } = await supabaseAdmin
      .from("equipos")
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  qrUrl(token: string) {
    const base = env.FRONTEND_URL.replace(/\/$/, "");
    return `${base}/inspeccion/qr/${token}`;
  },
};
