import { Request, Response, NextFunction } from 'express';
import { supabaseAdmin } from '../config/supabase';
import { storageService } from '../services/storage.service';

export const adminController = {
  async listarUsuarios(req: Request, res: Response, next: NextFunction) {
    try {
      const { data, error } = await supabaseAdmin
        .from('perfiles')
        .select('*');

      if (error) throw error;
      res.json(data);
    } catch (error) {
      next(error);
    }
  },

  async listarEmpresas(req: Request, res: Response, next: NextFunction) {
    try {
      const { data, error } = await supabaseAdmin
        .from('empresas')
        .select('*');

      if (error) throw error;
      res.json(data);
    } catch (error) {
      next(error);
    }
  },

  async subirLogoConsultora(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const file = req.file;

      if (!file) {
        return res.status(400).json({ error: 'No se subió ningún archivo' });
      }

      const ext = file.originalname.split('.').pop();
      const path = `${id}/logo_${Date.now()}.${ext}`;

      await storageService.subirArchivo('logos_consultora', path, file);
      const logoUrl = storageService.obtenerUrlPublica('logos_consultora', path);

      const { error: dbError } = await supabaseAdmin
        .from('consultoras')
        .update({ logo_url: logoUrl })
        .eq('id', id);

      if (dbError) {
        await storageService.eliminarArchivo('logos_consultora', path);
        throw dbError;
      }

      res.json({ success: true, logo_url: logoUrl });
    } catch (error) {
      next(error);
    }
  }
};
