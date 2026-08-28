import { supabaseAdmin } from '../config/supabase';
import { EstadoAccion } from '../types/database';
import { recalcularCumplimientoEmpresa } from '../utils/compliance';

export type PlanAccionListOpts = {
  limit?: number;
  offset?: number;
};

export type PlanAccionResumen = {
  total: number;
  cumplidas: number;
  pendientes: number;
  atendidas: number;
};

export const planAccionService = {
  async obtenerResumen(empresaId: string): Promise<PlanAccionResumen> {
    const { data, error } = await supabaseAdmin
      .from('acciones_mejora')
      .select('estado')
      .eq('empresa_id', empresaId);

    if (error) throw error;

    const rows = data || [];
    const cumplidas = rows.filter((r) => r.estado === 'cumplida').length;
    const atendidas = rows.filter((r) => r.estado === 'atendida').length;
    const pendientes = rows.filter((r) => r.estado === 'pendiente').length;

    return {
      total: rows.length,
      cumplidas,
      atendidas,
      pendientes,
    };
  },

  async listarResponsables(empresaId: string): Promise<string[]> {
    const { data, error } = await supabaseAdmin
      .from('acciones_mejora')
      .select('responsable')
      .eq('empresa_id', empresaId);

    if (error) throw error;

    const unicos = new Set<string>();
    for (const row of data || []) {
      const nombre = row.responsable?.trim();
      if (nombre) unicos.add(nombre);
    }

    return Array.from(unicos).sort((a, b) =>
      a.localeCompare(b, 'es', { sensitivity: 'base' }),
    );
  },

  async listarAcciones(
    empresaId: string,
    estado?: EstadoAccion,
    opts?: PlanAccionListOpts,
    responsable?: string,
  ) {
    const limit = Math.min(Math.max(opts?.limit ?? 50, 1), 200);
    const offset = Math.max(opts?.offset ?? 0, 0);

    let query = supabaseAdmin
      .from('acciones_mejora')
      .select(
        '*, informes_visita(numero_informe, fecha_hora_visita, lugar_visita)',
        { count: 'exact' },
      )
      .eq('empresa_id', empresaId);

    if (estado) {
      query = query.eq('estado', estado);
    }

    if (responsable) {
      if (responsable === '__sin_asignar__') {
        query = query.or('responsable.is.null,responsable.eq.');
      } else {
        query = query.eq('responsable', responsable);
      }
    }

    const { data, error, count } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;

    const resumen = await this.obtenerResumen(empresaId);

    return {
      items: data || [],
      total: count ?? (data || []).length,
      limit,
      offset,
      resumen,
    };
  },

  /** Listado completo para export (sin paginar) */
  async listarTodas(
    empresaId: string,
    estado?: EstadoAccion,
    responsable?: string,
  ) {
    let query = supabaseAdmin
      .from('acciones_mejora')
      .select('*, informes_visita(numero_informe, fecha_hora_visita, lugar_visita)')
      .eq('empresa_id', empresaId);

    if (estado) {
      query = query.eq('estado', estado);
    }

    if (responsable) {
      if (responsable === '__sin_asignar__') {
        query = query.or('responsable.is.null,responsable.eq.');
      } else {
        query = query.eq('responsable', responsable);
      }
    }

    const { data, error } = await query.order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
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

    if (data?.empresa_id) {
      await recalcularCumplimientoEmpresa(data.empresa_id);
    }

    return data;
  }
};
