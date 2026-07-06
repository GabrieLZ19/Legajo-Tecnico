import { Request, Response, NextFunction } from 'express';
import { plantillasService } from '../services/plantillas.service';

export const plantillasController = {
  async listarPlantillas(req: Request, res: Response, next: NextFunction) {
    try {
      const consultoraId = req.user!.consultora_id;
      if (!consultoraId) {
        res.status(400).json({ error: 'Usuario sin consultora asociada' });
        return;
      }
      const plantillas = await plantillasService.listarPorConsultora(consultoraId);
      res.json(plantillas);
    } catch (error) {
      next(error);
    }
  },

  async crearPlantilla(req: Request, res: Response, next: NextFunction) {
    try {
      const { nombre, contenido } = req.body;
      if (!nombre?.trim() || !contenido?.trim()) {
        res.status(400).json({ error: 'Nombre y contenido son obligatorios' });
        return;
      }

      const consultoraId = req.user!.consultora_id;
      if (!consultoraId) {
        res.status(400).json({ error: 'Usuario sin consultora asociada' });
        return;
      }

      const plantilla = await plantillasService.crearPlantilla({
        nombre: nombre.trim(),
        contenido: contenido.trim(),
        creado_por: req.user!.id,
        consultora_id: consultoraId,
      });

      res.status(201).json(plantilla);
    } catch (error) {
      next(error);
    }
  },

  async eliminarPlantilla(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const consultoraId = req.user!.consultora_id;

      const plantilla = await plantillasService.obtenerPorId(id);
      if (!plantilla) {
        res.status(404).json({ error: 'Plantilla no encontrada' });
        return;
      }

      if (plantilla.consultora_id !== consultoraId) {
        res.status(403).json({ error: 'No tienes permiso para eliminar esta plantilla' });
        return;
      }

      await plantillasService.eliminarPlantilla(id);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  },

  async actualizarPlantilla(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const { nombre, contenido } = req.body;
      const consultoraId = req.user!.consultora_id;

      const plantilla = await plantillasService.obtenerPorId(id);
      if (!plantilla) {
        res.status(404).json({ error: 'Plantilla no encontrada' });
        return;
      }

      if (plantilla.consultora_id !== consultoraId) {
        res.status(403).json({ error: 'No tienes permiso para editar esta plantilla' });
        return;
      }

      const actualizada = await plantillasService.actualizarPlantilla(id, {
        nombre: nombre?.trim(),
        contenido: contenido?.trim(),
      });

      res.json(actualizada);
    } catch (error) {
      next(error);
    }
  }
};
