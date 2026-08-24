import { supabaseAdmin } from '../config/supabase';

export type NotificacionRow = {
  id: string;
  consultora_id: string;
  usuario_id: string | null;
  titulo: string;
  mensaje: string;
  tipo: string;
  es_global: boolean;
  created_at: string;
  leida?: boolean;
};

export const notificacionService = {
  async enviarGlobal({
    titulo,
    mensaje,
    tipo = 'info',
    consultora_id,
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
        es_global: true,
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
      .limit(30);

    if (error) throw error;

    const rows = (data || []) as NotificacionRow[];
    if (rows.length === 0) return [];

    const { data: leidas, error: leidasError } = await supabaseAdmin
      .from('notificaciones_leidas')
      .select('notificacion_id')
      .eq('usuario_id', usuarioId)
      .in(
        'notificacion_id',
        rows.map((n) => n.id),
      );

    if (leidasError) throw leidasError;

    const leidasSet = new Set(
      (leidas || []).map((row: { notificacion_id: string }) => row.notificacion_id),
    );

    return rows.map((n) => ({
      ...n,
      leida: leidasSet.has(n.id),
    }));
  },

  async marcarComoLeida(notificacionId: string, usuarioId: string) {
    const { error } = await supabaseAdmin
      .from('notificaciones_leidas')
      .upsert(
        { notificacion_id: notificacionId, usuario_id: usuarioId },
        { onConflict: 'notificacion_id,usuario_id' },
      );

    if (error) throw error;
  },

  async marcarTodasLeidas(usuarioId: string, consultoraId: string) {
    const notificaciones = await this.listarPorUsuario(usuarioId, consultoraId);
    const pendientes = notificaciones.filter((n) => !n.leida);

    if (pendientes.length === 0) {
      return { marked: 0 };
    }

    const { error } = await supabaseAdmin.from('notificaciones_leidas').upsert(
      pendientes.map((n) => ({
        notificacion_id: n.id,
        usuario_id: usuarioId,
      })),
      { onConflict: 'notificacion_id,usuario_id' },
    );

    if (error) throw error;
    return { marked: pendientes.length };
  },
};
