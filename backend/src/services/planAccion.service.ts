import { supabaseAdmin } from '../config/supabase';
import { EstadoAccion } from '../types/database';

export const planAccionService = {
  async listarAcciones(empresaId: string, estado?: EstadoAccion) {
    let query = supabaseAdmin
      .from('acciones_mejora')
      .select('*, informes_visita(numero_informe, fecha_hora_visita, lugar_visita)')
      .eq('empresa_id', empresaId);

    if (estado) {
      query = query.eq('estado', estado);
    }

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  },

  async actualizarEstado(accionId: string, estado: EstadoAccion) {
    const updateData: any = { estado };
    
    if (estado === 'cumplida' || estado === 'atendida') {
      updateData.fecha_cumplimiento = new Date().toISOString();
    } else {
      updateData.fecha_cumplimiento = null;
    }

    const { data, error } = await supabaseAdmin
      .from('acciones_mejora')
      .update(updateData)
      .eq('id', accionId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }
};
