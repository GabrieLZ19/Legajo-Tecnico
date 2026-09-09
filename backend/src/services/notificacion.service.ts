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

  /**
   * Notifica a todos los admins activos de una consultora (una fila por admin).
   */
  async enviarAAdmins({
    consultora_id,
    titulo,
    mensaje,
    tipo = 'info',
  }: {
    consultora_id: string;
    titulo: string;
    mensaje: string;
    tipo?: string;
  }) {
    const { data: admins, error: adminsError } = await supabaseAdmin
      .from('perfiles')
      .select('id')
      .eq('consultora_id', consultora_id)
      .eq('rol', 'admin')
      .eq('activo', true);

    if (adminsError) throw adminsError;
    if (!admins || admins.length === 0) return [];

    const rows = admins.map((admin) => ({
      consultora_id,
      usuario_id: admin.id,
      titulo,
      mensaje,
      tipo,
      es_global: false,
    }));

    const { data, error } = await supabaseAdmin
      .from('notificaciones')
      .insert(rows)
      .select();

    if (error) throw error;
    return data || [];
  },

  /**
   * Notifica a admins de la consultora, preventores asignados a la empresa
   * y dueños de esa empresa (sin duplicados).
   */
  async enviarAEquipoEmpresa({
    consultora_id,
    empresa_id,
    titulo,
    mensaje,
    tipo = 'info',
  }: {
    consultora_id: string;
    empresa_id: string;
    titulo: string;
    mensaje: string;
    tipo?: string;
  }) {
    const [{ data: admins, error: adminsError }, { data: links, error: linksError }, { data: duenos, error: duenosError }] =
      await Promise.all([
        supabaseAdmin
          .from('perfiles')
          .select('id')
          .eq('consultora_id', consultora_id)
          .eq('rol', 'admin')
          .eq('activo', true),
        supabaseAdmin
          .from('preventor_empresas')
          .select('preventor_id')
          .eq('empresa_id', empresa_id),
        supabaseAdmin
          .from('perfiles')
          .select('id')
          .eq('empresa_id', empresa_id)
          .eq('rol', 'dueno')
          .eq('activo', true),
      ]);

    if (adminsError) throw adminsError;
    if (linksError) throw linksError;
    if (duenosError) throw duenosError;

    const preventorIds = (links || [])
      .map((l: { preventor_id: string }) => l.preventor_id)
      .filter(Boolean);

    let preventoresActivos: Array<{ id: string }> = [];
    if (preventorIds.length > 0) {
      const { data, error } = await supabaseAdmin
        .from('perfiles')
        .select('id')
        .in('id', preventorIds)
        .eq('activo', true);
      if (error) throw error;
      preventoresActivos = data || [];
    }

    const usuarioIds = Array.from(
      new Set([
        ...(admins || []).map((a: { id: string }) => a.id),
        ...preventoresActivos.map((p) => p.id),
        ...(duenos || []).map((d: { id: string }) => d.id),
      ]),
    );

    if (usuarioIds.length === 0) return [];

    const rows = usuarioIds.map((usuario_id) => ({
      consultora_id,
      usuario_id,
      titulo,
      mensaje,
      tipo,
      es_global: false,
    }));

    const { data, error } = await supabaseAdmin
      .from('notificaciones')
      .insert(rows)
      .select();

    if (error) throw error;
    return data || [];
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
