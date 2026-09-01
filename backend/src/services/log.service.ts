import { supabaseAdmin } from '../config/supabase';
import { sanitizeSearchTerm } from '../utils/searchSanitize';

export const logService = {
  async registrar({
    usuario_id,
    accion,
    entidad,
    entidad_id,
    detalles = {},
    consultora_id
  }: {
    usuario_id: string;
    accion: string;
    entidad: string;
    entidad_id?: string;
    detalles?: any;
    consultora_id: string;
  }) {
    try {
      const { error } = await supabaseAdmin
        .from('logs_actividad')
        .insert({
          usuario_id,
          accion,
          entidad,
          entidad_id,
          detalles,
          consultora_id
        });

      if (error) {
        console.error('Error al registrar log:', error);
      }
    } catch (err) {
      console.error('Error fatal al registrar log:', err);
    }
  },

  async listarPorConsultora(
    consultoraId: string,
    opts?: { limit?: number; offset?: number; q?: string },
  ) {
    const limit = opts?.limit ?? 25;
    const offset = opts?.offset ?? 0;
    const q = sanitizeSearchTerm(opts?.q);

    let query = supabaseAdmin
      .from('logs_actividad')
      .select('*, perfiles(nombre_completo, username)', { count: 'exact' })
      .eq('consultora_id', consultoraId)
      .order('created_at', { ascending: false });

    if (q) {
      const { data: perfiles, error: perfilesError } = await supabaseAdmin
        .from('perfiles')
        .select('id')
        .eq('consultora_id', consultoraId)
        .or(`nombre_completo.ilike.%${q}%,username.ilike.%${q}%`);

      if (perfilesError) throw perfilesError;

      const usuarioIds = (perfiles ?? []).map((perfil) => perfil.id);
      const orFilters = [`accion.ilike.%${q}%`, `entidad.ilike.%${q}%`];
      if (usuarioIds.length > 0) {
        orFilters.push(`usuario_id.in.(${usuarioIds.join(',')})`);
      }
      query = query.or(orFilters.join(','));
    }

    const { data, error, count } = await query.range(offset, offset + limit - 1);

    if (error) throw error;

    return {
      items: data ?? [],
      total: count ?? 0,
      limit,
      offset,
    };
  }
};
