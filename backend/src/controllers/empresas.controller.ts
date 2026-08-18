import { Request, Response, NextFunction } from 'express';
import { supabaseAdmin } from '../config/supabase';
import { storageService } from '../services/storage.service';
import { assertEmpresaAccess } from '../middlewares/empresaAccess';

export const empresasController = {
  async obtenerEmpresa(req: Request, res: Response, next: NextFunction) {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      if (!id) {
        return res.status(400).json({ error: 'ID de empresa inválido' });
      }
      await assertEmpresaAccess(req.user!, id);

      const { data, error } = await supabaseAdmin
        .from('empresas')
        .select('*')
        .eq('id', id)
        .single();

      if (error || !data) {
        return res.status(404).json({ error: 'Empresa no encontrada' });
      }

      res.json(data);
    } catch (error) {
      next(error);
    }
  },

  async subirLogo(req: Request, res: Response, next: NextFunction) {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      if (!id) {
        return res.status(400).json({ error: 'ID de empresa inválido' });
      }
      await assertEmpresaAccess(req.user!, id);
      const file = req.file;

      if (!file) {
        return res.status(400).json({ error: 'No se subió ningún archivo' });
      }

      // Obtener extensión
      const ext = file.originalname.split('.').pop();
      const path = `${id}/logo_${Date.now()}.${ext}`;

      // Subir a Storage
      await storageService.subirArchivo('logos_empresa', path, file);

      // Guardar URL pública o ruta en base de datos
      const logoUrl = storageService.obtenerUrlPublica('logos_empresa', path);

      const { error: dbError } = await supabaseAdmin
        .from('empresas')
        .update({ logo_url: logoUrl })
        .eq('id', id);

      if (dbError) {
        // Compensación: borrar archivo de storage si la base de datos falla
        await storageService.eliminarArchivo('logos_empresa', path);
        throw dbError;
      }

      res.json({ success: true, logo_url: logoUrl });
    } catch (error) {
      next(error);
    }
  }
};
