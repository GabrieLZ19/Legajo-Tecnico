import { supabaseAdmin } from '../config/supabase';

export const plantillasService = {
  async listarPorConsultora(consultoraId: string) {
    const { data, error } = await supabaseAdmin
      .from('plantillas_declaracion')
      .select('*')
      .eq('consultora_id', consultoraId)
      .order('created_at', { ascending: true });

    if (error) throw error;
    return data;
  },

  async crearPlantilla(data: {
    nombre: string;
    contenido: string;
    creado_por: string;
    consultora_id: string;
  }) {
    const { data: inserted, error } = await supabaseAdmin
      .from('plantillas_declaracion')
      .insert(data)
      .select()
      .single();

    if (error) throw error;
    return inserted;
  },

  async obtenerPorId(id: string) {
    const { data, error } = await supabaseAdmin
      .from('plantillas_declaracion')
      .select('*')
      .eq('id', id)
      .single();

    if (error) return null;
    return data;
  },

  async eliminarPlantilla(id: string) {
    const { error } = await supabaseAdmin
      .from('plantillas_declaracion')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },

  async actualizarPlantilla(id: string, data: {
    nombre?: string;
    contenido?: string;
  }) {
    const { data: updated, error } = await supabaseAdmin
      .from('plantillas_declaracion')
      .update(data)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return updated;
  }
};
