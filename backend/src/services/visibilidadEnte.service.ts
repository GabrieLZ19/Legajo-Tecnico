import { supabaseAdmin } from '../config/supabase';

export type TablaVisibilidadEnte =
  | 'informes_visita'
  | 'acciones_mejora'
  | 'capacitaciones'
  | 'epp_entregas';

export async function actualizarVisibilidadEnte(
  tabla: TablaVisibilidadEnte,
  id: string,
  visible: boolean,
) {
  const { data, error } = await supabaseAdmin
    .from(tabla)
    .update({ visible_ente_regulador: visible })
    .eq('id', id)
    .select('id, visible_ente_regulador, empresa_id')
    .single();

  if (error) throw error;
  return data;
}
