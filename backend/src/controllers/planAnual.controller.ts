import { Request, Response, NextFunction } from "express";
import { planAnualService } from "../services/planAnual.service";

export const planAnualController = {
  async plantilla(req: Request, res: Response, next: NextFunction) {
    try {
      const anioRaw = req.query.anio ? Number(req.query.anio) : undefined;
      const anio =
        anioRaw && Number.isFinite(anioRaw) ? anioRaw : undefined;
      const file = await planAnualService.generarPlantilla(anio);
      res.setHeader("Content-Type", file.mime);
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${file.filename}"`,
      );
      res.send(file.buffer);
    } catch (error) {
      next(error);
    }
  },

  async listarAnios(req: Request, res: Response, next: NextFunction) {
    try {
      const empresaId = String(req.query.empresa_id || "");
      if (!empresaId) {
        return res.status(400).json({ error: "empresa_id es requerido" });
      }
      const anios = await planAnualService.listarAnios(empresaId);
      res.json({ anios });
    } catch (error) {
      next(error);
    }
  },

  async obtener(req: Request, res: Response, next: NextFunction) {
    try {
      const empresaId = String(req.query.empresa_id || "");
      if (!empresaId) {
        return res.status(400).json({ error: "empresa_id es requerido" });
      }
      const anioRaw = req.query.anio ? Number(req.query.anio) : undefined;
      const anio =
        anioRaw && Number.isFinite(anioRaw) ? anioRaw : undefined;

      const data = await planAnualService.obtener(empresaId, anio);
      res.json(data);
    } catch (error) {
      next(error);
    }
  },

  async subir(req: Request, res: Response, next: NextFunction) {
    try {
      const empresaId = String(req.body.empresa_id || "");
      const anio = Number(req.body.anio);
      const file = req.file;

      if (!empresaId) {
        return res.status(400).json({ error: "empresa_id es requerido" });
      }
      if (!file) {
        return res
          .status(400)
          .json({ error: "Debés adjuntar un archivo Excel (.xls o .xlsx) o PDF" });
      }

      const result = await planAnualService.subir({
        empresaId,
        anio,
        subidoPor: req.user!.id,
        file,
      });

      res.status(201).json(result);
    } catch (error: any) {
      res.status(400).json({
        error: error.message || "No se pudo subir el plan anual",
      });
    }
  },
};
