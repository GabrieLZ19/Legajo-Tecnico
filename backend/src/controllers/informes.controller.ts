import { Request, Response, NextFunction } from 'express';
import { informeService } from '../services/informe.service';
import { firmaService } from '../services/firma.service';
import { supabaseAdmin } from '../config/supabase';
import { storageService } from '../services/storage.service';
import { pdfService } from '../services/pdf.service';
import { assertEmpresaAccess, assertInformeAccess, requireConsultoraId } from '../middlewares/empresaAccess';
import { safeExtensionFromUpload } from '../config/multer';
import { randomUUID } from 'crypto';

export const informesController = {
  async crearInforme(req: Request, res: Response, next: NextFunction) {
    try {
      const preventorId = req.user!.id;
      const data = req.body;
      await assertEmpresaAccess(req.user!, data.empresa_id);

      const informe = await informeService.crearInforme(preventorId, data);
      res.status(201).json(informe);
    } catch (error) {
      next(error);
    }
  },

  async listarInformes(req: Request, res: Response, next: NextFunction) {
    try {
      const { empresaId } = req.query;
      const user = req.user;

      if (empresaId) {
        await assertEmpresaAccess(req.user!, empresaId as string);
        const informes = await informeService.listarPorEmpresa(empresaId as string);
        return res.json(informes);
      }

      if (user?.rol === 'admin') {
        const consultoraId = requireConsultoraId(user);
        const { data: empresas } = await supabaseAdmin
          .from('empresas')
          .select('id')
          .eq('consultora_id', consultoraId);
        
        const empresaIds = empresas?.map(e => e.id) || [];
        if (empresaIds.length === 0) {
          return res.json([]);
        }
        const informes = await informeService.listarPorEmpresas(empresaIds);
        return res.json(informes);
      }

      // Si es otro rol y tiene empresa_id asignado
      if (user?.empresa_id) {
        const informes = await informeService.listarPorEmpresa(user.empresa_id);
        return res.json(informes);
      }

      return res.status(400).json({ error: 'empresaId es requerido en query' });
    } catch (error) {
      next(error);
    }
  },

  async obtenerInforme(req: Request, res: Response, next: NextFunction) {
    try {
      const informe = await informeService.obtenerPorId(req.params.id as string);
      if (!informe) {
        return res.status(404).json({ error: 'Informe no encontrado' });
      }
      await assertEmpresaAccess(req.user!, informe.empresa_id);
      res.json(informe);
    } catch (error) {
      next(error);
    }
  },

  async editarInforme(req: Request, res: Response, next: NextFunction) {
    try {
      await assertInformeAccess(req.user!, req.params.id as string);
      const updateData = req.body;
      const informe = await informeService.editarBorrador(req.params.id as string, updateData);
      res.json(informe);
    } catch (error) {
      next(error);
    }
  },

  async eliminarInforme(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      await assertInformeAccess(req.user!, id);

      await informeService.eliminar(id);
      res.json({ success: true, message: "Informe eliminado con éxito" });
    } catch (error) {
      next(error);
    }
  },

  async firmarPreventor(req: Request, res: Response, next: NextFunction) {
    try {
      await assertInformeAccess(req.user!, req.params.id as string);
      const { firma_base64 } = req.body;
      const firmanteId = req.user!.id;
      const ip = req.ip;

      const resultado = await firmaService.firmarInforme(req.params.id as string, firmanteId, 'preventor', firma_base64, ip);
      res.json(resultado);
    } catch (error) {
      next(error);
    }
  },

  async firmarDueno(req: Request, res: Response, next: NextFunction) {
    try {
      await assertInformeAccess(req.user!, req.params.id as string);
      const { firma_base64 } = req.body;
      const firmanteId = req.user!.id;
      const ip = req.ip;

      const resultado = await firmaService.firmarInforme(req.params.id as string, firmanteId, 'dueno', firma_base64, ip);
      res.json(resultado);
    } catch (error) {
      next(error);
    }
  },

  async subirEvidencia(req: Request, res: Response, next: NextFunction) {
    try {
      const { id: informeId } = req.params;
      await assertInformeAccess(req.user!, informeId as string);
      const { punto_mejora_id } = req.body;

      // Obtener archivos de Multer (pueden venir como array o single)
      const files = req.files as Express.Multer.File[];
      const uploadFiles = Array.isArray(files) 
        ? files 
        : req.file 
          ? [req.file] 
          : [];

      if (uploadFiles.length === 0) {
        return res.status(400).json({ error: 'No se subió ningún archivo de evidencia' });
      }

      // Si viene punto_mejora_id, validamos que exista
      if (punto_mejora_id) {
        const { data: punto, error: errPunto } = await supabaseAdmin
          .from('puntos_mejora')
          .select('*')
          .eq('id', punto_mejora_id)
          .eq('informe_id', informeId)
          .single();

        if (errPunto || !punto) {
          return res.status(404).json({ error: 'Punto de mejora no encontrado en este informe' });
        }
      }

      const uploaded = await Promise.all(
        uploadFiles.map(async (file) => {
          const ext = safeExtensionFromUpload(file);
          const path = punto_mejora_id
            ? `${informeId}/${punto_mejora_id}_${Date.now()}_${randomUUID().slice(0, 8)}.${ext}`
            : `${informeId}/general_${Date.now()}_${randomUUID().slice(0, 8)}.${ext}`;

          await storageService.subirArchivo('evidencia_visitas', path, file);
          return storageService.obtenerUrlPublica('evidencia_visitas', path);
        }),
      );
      const urls = uploaded;

      let dbError;
      if (punto_mejora_id) {
        // Asociar a un desvío / punto de mejora (usamos la primera imagen)
        const { error } = await supabaseAdmin
          .from('puntos_mejora')
          .update({ evidencia_url: urls[0] })
          .eq('id', punto_mejora_id);
        dbError = error;
      } else {
        // Guardar como evidencias generales del informe de visita
        const { error } = await supabaseAdmin
          .from('informes_visita')
          .update({ evidencias_urls: urls })
          .eq('id', informeId);
        dbError = error;
      }

      if (dbError) {
        for (const url of urls) {
          try {
            const path = url.split('/storage/v1/object/public/evidencia_visitas/').pop();
            if (path) {
              await storageService.eliminarArchivo('evidencia_visitas', path);
            }
          } catch (err) {
            console.error('Error al limpiar archivo tras fallo de DB:', err);
          }
        }
        throw dbError;
      }

      res.json({ success: true, evidencias_urls: urls });
    } catch (error) {
      next(error);
    }
  },

  async descargarPdf(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      await assertInformeAccess(req.user!, id);
      const { buffer, filename } = await pdfService.obtenerPdfParaDescarga(id);
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${filename}"`,
      );
      res.send(buffer);
    } catch (error) {
      next(error);
    }
  }
};
