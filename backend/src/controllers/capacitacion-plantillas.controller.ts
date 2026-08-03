import { Request, Response, NextFunction } from "express";
import { capacitacionPlantillasService } from "../services/capacitacion-plantillas.service";

function canWriteEmpresa(user: Express.Request["user"], empresaId: string) {
  if (!user) return false;
  if (user.rol === "admin") return true;
  if (user.rol === "preventor") return true;
  return user.empresa_id === empresaId;
}

export const capacitacionPlantillasController = {
  async listar(req: Request, res: Response, next: NextFunction) {
    try {
      const ambito = req.query.ambito as string;
      if (ambito !== "empresa" && ambito !== "global") {
        res.status(400).json({
          error: "ambito es requerido y debe ser 'empresa' o 'global'",
        });
        return;
      }

      const empresaId = req.query.empresa_id as string | undefined;
      if (ambito === "empresa" && !empresaId) {
        res
          .status(400)
          .json({ error: "empresa_id es requerido para ambito=empresa" });
        return;
      }

      const plantillas = await capacitacionPlantillasService.listar({
        ambito,
        empresa_id: empresaId,
      });
      res.json({ plantillas });
    } catch (error) {
      next(error);
    }
  },

  async detalle(req: Request, res: Response, next: NextFunction) {
    try {
      const id = String(req.params.id);
      const plantilla = await capacitacionPlantillasService.obtenerPorId(id);
      if (!plantilla) {
        res.status(404).json({ error: "Plantilla no encontrada" });
        return;
      }
      res.json(plantilla);
    } catch (error) {
      next(error);
    }
  },

  async crear(req: Request, res: Response, next: NextFunction) {
    try {
      const { ambito, empresa_id, titulo, temario, preguntas } = req.body;
      const user = req.user!;

      if (ambito !== "empresa" && ambito !== "global") {
        res.status(400).json({ error: "ambito inválido" });
        return;
      }
      if (!titulo?.trim()) {
        res.status(400).json({ error: "El título es obligatorio" });
        return;
      }

      if (ambito === "global") {
        if (user.rol !== "admin") {
          res.status(403).json({
            error: "Solo administradores pueden crear plantillas globales",
          });
          return;
        }
      } else {
        if (!empresa_id) {
          res
            .status(400)
            .json({ error: "empresa_id es requerido para plantillas de empresa" });
          return;
        }
        if (!canWriteEmpresa(user, empresa_id)) {
          res.status(403).json({ error: "Sin permiso para esta empresa" });
          return;
        }
        if (user.rol !== "admin" && user.rol !== "preventor") {
          res.status(403).json({ error: "Rol insuficiente" });
          return;
        }
      }

      const plantilla = await capacitacionPlantillasService.crear({
        ambito,
        empresa_id: ambito === "empresa" ? empresa_id : null,
        titulo: titulo.trim(),
        temario,
        created_by: user.id,
        preguntas,
      });

      res.status(201).json(plantilla);
    } catch (error: any) {
      if (error?.message || error?.code) {
        res.status(400).json({
          error: error.message || "Error al crear la plantilla",
          code: error.code,
          details: error.details,
        });
        return;
      }
      next(error);
    }
  },

  async actualizar(req: Request, res: Response, next: NextFunction) {
    try {
      const id = String(req.params.id);
      const user = req.user!;
      const { titulo, temario, preguntas } = req.body;

      const existente = await capacitacionPlantillasService.obtenerPorId(id);
      if (!existente) {
        res.status(404).json({ error: "Plantilla no encontrada" });
        return;
      }

      if (existente.ambito === "global") {
        if (user.rol !== "admin") {
          res.status(403).json({
            error: "Solo administradores pueden editar plantillas globales",
          });
          return;
        }
      } else {
        if (!canWriteEmpresa(user, existente.empresa_id)) {
          res.status(403).json({ error: "Sin permiso para esta plantilla" });
          return;
        }
        if (user.rol !== "admin" && user.rol !== "preventor") {
          res.status(403).json({ error: "Rol insuficiente" });
          return;
        }
      }

      const actualizada = await capacitacionPlantillasService.actualizar(id, {
        titulo: titulo?.trim(),
        temario,
        preguntas,
      });
      res.json(actualizada);
    } catch (error) {
      next(error);
    }
  },

  async eliminar(req: Request, res: Response, next: NextFunction) {
    try {
      const id = String(req.params.id);
      const user = req.user!;

      const existente = await capacitacionPlantillasService.obtenerPorId(id);
      if (!existente) {
        res.status(404).json({ error: "Plantilla no encontrada" });
        return;
      }

      if (existente.ambito === "global") {
        if (user.rol !== "admin") {
          res.status(403).json({
            error: "Solo administradores pueden eliminar plantillas globales",
          });
          return;
        }
      } else {
        if (!canWriteEmpresa(user, existente.empresa_id)) {
          res.status(403).json({ error: "Sin permiso para esta plantilla" });
          return;
        }
        if (user.rol !== "admin" && user.rol !== "preventor") {
          res.status(403).json({ error: "Rol insuficiente" });
          return;
        }
      }

      await capacitacionPlantillasService.eliminar(id);
      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  },
};
