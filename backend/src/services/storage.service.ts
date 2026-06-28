import { supabaseAdmin } from '../config/supabase';

export const storageService = {
  /**
   * Sube un archivo de Multer a un bucket de Supabase Storage
   * @param bucket Nombre del bucket
   * @param path Ruta dentro del bucket
   * @param file Objeto Express.Multer.File
   * @returns URL pública o path del archivo subido
   */
  async subirArchivo(bucket: string, path: string, file: Express.Multer.File): Promise<string> {
    const { error } = await supabaseAdmin.storage
      .from(bucket)
      .upload(path, file.buffer, {
        contentType: file.mimetype,
        upsert: true, // Si ya existe, lo sobrescribe
      });

    if (error) {
      throw new Error(`Error al subir archivo a Storage (${bucket}): ${error.message}`);
    }

    return path;
  },

  /**
   * Obtiene la URL pública de un archivo
   */
  obtenerUrlPublica(bucket: string, path: string): string {
    const { data } = supabaseAdmin.storage.from(bucket).getPublicUrl(path);
    return data.publicUrl;
  },

  /**
   * Elimina un archivo del bucket
   */
  async eliminarArchivo(bucket: string, path: string): Promise<void> {
    const { error } = await supabaseAdmin.storage.from(bucket).remove([path]);
    if (error) {
      throw new Error(`Error al eliminar archivo de Storage (${bucket}): ${error.message}`);
    }
  }
};
