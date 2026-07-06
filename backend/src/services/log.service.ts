import { supabaseAdmin } from '../config/supabase';

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

  async listarPorConsultora(consultoraId: string, limit = 100) {
    const { data, error } = await supabaseAdmin
      .from('logs_actividad')
      .select('*, perfiles(nombre_completo, username)')
      .eq('consultora_id', consultoraId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data;
  }
};
