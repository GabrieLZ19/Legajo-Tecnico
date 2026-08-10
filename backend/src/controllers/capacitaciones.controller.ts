import { Request, Response, NextFunction } from "express";
import { capacitacionesService } from "../services/capacitaciones.service";

export const capacitacionesController = {
  async listar(req: Request, res: Response, next: NextFunction) {
    try {
      const empresaId = req.query.empresa_id as string;
      if (!empresaId)
        return res.status(400).json({ error: "empresa_id es requerido" });

      const capacitaciones = await capacitacionesService.listar(empresaId);
      res.json({ capacitaciones });
    } catch (error) {
      next(error);
    }
  },

  async crear(req: Request, res: Response, next: NextFunction) {
    try {
      const preventorId = req.user!.id;
      const cap = await capacitacionesService.crear({
        ...req.body,
        preventor_id: preventorId,
      });
      res.status(201).json(cap);
    } catch (error) {
      next(error);
    }
  },

  async detalle(req: Request, res: Response, next: NextFunction) {
    try {
      const id = String(req.params.id);
      const data = await capacitacionesService.obtenerPorId(id);
      if (!data)
        return res.status(404).json({ error: "Capacitación no encontrada" });
      res.json(data);
    } catch (error) {
      next(error);
    }
  },

  async detallePublico(req: Request, res: Response, next: NextFunction) {
    try {
      const id = String(req.params.id);
      const result = await capacitacionesService.obtenerDetallePublico(id);
      if (result.error)
        return res.status(result.code!).json({ error: result.error });
      res.json(result.data);
    } catch (error) {
      next(error);
    }
  },

  async actualizarEstado(req: Request, res: Response, next: NextFunction) {
    try {
      const id = String(req.params.id);
      const { estado } = req.body;
      if (!["borrador", "activa", "cerrada"].includes(estado)) {
        return res.status(400).json({ error: "Estado inválido" });
      }
      const data = await capacitacionesService.cambiarEstado(id, estado);
      res.json(data);
    } catch (error) {
      next(error);
    }
  },

  async generarQR(req: Request, res: Response, next: NextFunction) {
    try {
      const id = String(req.params.id);
      const result = await capacitacionesService.generarQR(id);
      if (!result)
        return res.status(404).json({ error: "Capacitación no encontrada" });
      res.json(result);
    } catch (error) {
      next(error);
    }
  },

  async evaluar(req: Request, res: Response, next: NextFunction) {
    try {
      const id = String(req.params.id);
      const result = await capacitacionesService.evaluarEmpleado(id, req.body);
      res.status(201).json(result);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  },

  async actualizar(req: Request, res: Response, next: NextFunction) {
    try {
      const id = String(req.params.id);
      const result = await capacitacionesService.actualizar(id, req.body);
      if (result.error)
        return res.status(result.code!).json({ error: result.error });
      res.json(result);
    } catch (error) {
      next(error);
    }
  },

  async eliminar(req: Request, res: Response, next: NextFunction) {
    try {
      const id = String(req.params.id);
      await capacitacionesService.eliminar(id);
      res.json({ success: true, message: "Capacitación eliminada con éxito" });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Exportar asistencias (PDF / Excel)
   */
  async exportarAsistencias(req: Request, res: Response, next: NextFunction) {
    try {
      const id = String(req.params.id);
      const { format, search, sector, estado } = req.query;

      const result = await capacitacionesService.exportarAsistencias(
        id,
        String(format),
        search ? String(search) : undefined,
        sector ? String(sector) : undefined,
        estado ? String(estado) : undefined,
      );

      if (result.error)
        return res.status(result.code!).json({ error: result.error });

      if (result.type === "xlsx" && result.buffer) {
        res.setHeader(
          "Content-Type",
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        );
        res.setHeader(
          "Content-Disposition",
          `attachment; filename=registro_capacitacion_${id}.xlsx`,
        );
        return res.send(result.buffer);
      }

      if (result.type === "pdf" && result.doc) {
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader(
          "Content-Disposition",
          `attachment; filename=registro_capacitacion_${id}.pdf`,
        );
        result.doc.pipe(res);
        result.doc.end();
        return;
      }

      res.status(400).json({ error: "Formato no soportado" });
    } catch (error) {
      next(error);
    }
  },

  async actualizarRegistro(req: Request, res: Response, next: NextFunction) {
    try {
      const id = String(req.params.id);
      const result = await capacitacionesService.actualizarRegistro(
        id,
        req.body,
      );
      if (result.error)
        return res.status(result.code!).json({ error: result.error });
      res.json(result.data);
    } catch (error: any) {
      res.status(400).json({ error: error.message || "Error al guardar registro" });
    }
  },
};
