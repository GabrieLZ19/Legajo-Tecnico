import { supabaseAdmin } from '../config/supabase';

export const notificacionService = {
  async enviarGlobal({
    titulo,
    mensaje,
    tipo = 'info',
    consultora_id
  }: {
    titulo: string;
    mensaje: string;
    tipo?: string;
    consultora_id: string;
  }) {
    const { data, error } = await supabaseAdmin
      .from('notificaciones')
      .insert({
        titulo,
        mensaje,
        tipo,
        consultora_id,
        es_global: true
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async listarPorUsuario(usuarioId: string, consultoraId: string) {
    const { data, error } = await supabaseAdmin
      .from('notificaciones')
      .select('*')
      .or(`usuario_id.eq.${usuarioId},es_global.eq.true`)
      .eq('consultora_id', consultoraId)
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) throw error;
    return data;
  },

  async marcarComoLeida(notificacionId: string, usuarioId: string) {
    // Para notificaciones globales, podríamos necesitar una tabla de leídas por usuario
    // Por ahora, lo simplificamos a usuario_id específico
    const { error } = await supabaseAdmin
      .from('notificaciones_leidas')
      .upsert({ notificacion_id: notificacionId, usuario_id: usuarioId });

    if (error) throw error;
  }
};
