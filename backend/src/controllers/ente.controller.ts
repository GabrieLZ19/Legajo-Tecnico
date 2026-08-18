import { Request, Response, NextFunction } from "express";
import { enteService } from "../services/ente.service";
import { archivoService } from "../services/archivo.service";
import { HttpError } from "../utils/httpError";
import type { TipoDocumentoArchivo } from "../services/archivo.service";

export const enteController = {
  async dashboard(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) throw new HttpError(401, "No autenticado");
      const data = await enteService.obtenerDashboard(req.user.id);
      res.json(data);
    } catch (error) {
      next(error);
    }
  },

  async archivo(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) throw new HttpError(401, "No autenticado");
      const data = await enteService.obtenerArchivo(req.user.id);
      res.json(data);
    } catch (error) {
      next(error);
    }
  },

  async empresas(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) throw new HttpError(401, "No autenticado");
      const data = await enteService.listarEmpresasAsignadas(req.user.id);
      res.json({ asignaciones: data });
    } catch (error) {
      next(error);
    }
  },
};

export const archivoController = {
  async listar(req: Request, res: Response, next: NextFunction) {
    try {
      const empresaId = req.query.empresa_id ? String(req.query.empresa_id) : req.user?.empresa_id;
      if (!empresaId) throw new HttpError(400, "empresa_id es requerido");
      const tipo = req.query.tipo ? String(req.query.tipo) : undefined;
      const incluir: TipoDocumentoArchivo[] =
        tipo === "informe" || tipo === "capacitacion" || tipo === "epp"
          ? [tipo]
          : ["informe", "capacitacion", "epp"];
      const result = await archivoService.listar({
        empresaIds: [empresaId],
        incluir,
      });
      res.json(result);
    } catch (error) {
      next(error);
    }
  },
};
