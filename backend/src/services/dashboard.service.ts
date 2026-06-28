import { supabaseAdmin } from '../config/supabase';

export const dashboardService = {
  async obtenerMetricas(empresaId: string) {
    const { data, error } = await supabaseAdmin
      .from('v_dashboard_empresa')
      .select('*')
      .eq('empresa_id', empresaId)
      .single();

    // Si la empresa no tiene informes ni acciones creadas, la vista puede devolver nulo
    // o no encontrar la fila. Retornamos métricas en 0 por defecto.
    if (error || !data) {
      return {
        empresa_id: empresaId,
        informes_mes: 0,
        observaciones_abiertas: 0,
        porcentaje_cumplimiento: 0
      };
    }

    return data;
  }
};
