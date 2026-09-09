import { Request, Response, NextFunction } from "express";
import { eppProveedoresSugeridosService } from "../services/eppProveedoresSugeridos.service";
import {
  adoptarProveedorSugeridoSchema,
  actualizarProveedorSugeridoSchema,
  crearProveedorSugeridoSchema,
  idParamSchema,
  listarProveedoresSugeridosSchema,
  publicacionProveedorSugeridoSchema,
} from "../schemas/epp.schema";
import { HttpError } from "../utils/httpError";

function param(value: string | string[] | undefined): string {
  return Array.isArray(value) ? String(value[0] ?? "") : String(value ?? "");
}

function requireUser(req: Request) {
  if (!req.user) throw new HttpError(401, "No autenticado");
  return req.user;
}

export const eppProveedoresSugeridosController = {
  async listar(req: Request, res: Response, next: NextFunction) {
    try {
      const parsed = listarProveedoresSugeridosSchema.parse({ query: req.query });
      const data = await eppProveedoresSugeridosService.listar(requireUser(req), {
        estado_publicacion: parsed.query.estado_publicacion,
      });
      res.json(data);
    } catch (error) {
      next(error);
    }
  },

  async obtener(req: Request, res: Response, next: NextFunction) {
    try {
      const parsed = idParamSchema.parse({ params: { id: param(req.params.id) } });
      const data = await eppProveedoresSugeridosService.obtener(
        requireUser(req),
        parsed.params.id,
      );
      res.json({ proveedor: data });
    } catch (error) {
      next(error);
    }
  },

  async crear(req: Request, res: Response, next: NextFunction) {
    try {
      const parsed = crearProveedorSugeridoSchema.parse({ body: req.body });
      const data = await eppProveedoresSugeridosService.crear(
        requireUser(req),
        parsed.body,
      );
      res.status(201).json({ proveedor: data });
    } catch (error) {
      next(error);
    }
  },

  async actualizar(req: Request, res: Response, next: NextFunction) {
    try {
      const parsed = actualizarProveedorSugeridoSchema.parse({
        params: { id: param(req.params.id) },
        body: req.body,
      });
      const data = await eppProveedoresSugeridosService.actualizar(
        requireUser(req),
        parsed.params.id,
        parsed.body,
      );
      res.json({ proveedor: data });
    } catch (error) {
      next(error);
    }
  },

  async publicacion(req: Request, res: Response, next: NextFunction) {
    try {
      const parsed = publicacionProveedorSugeridoSchema.parse({
        params: { id: param(req.params.id) },
        body: req.body,
      });
      const data = await eppProveedoresSugeridosService.cambiarPublicacion(
        requireUser(req),
        parsed.params.id,
        parsed.body,
      );
      res.json({ proveedor: data });
    } catch (error) {
      next(error);
    }
  },

  async eliminar(req: Request, res: Response, next: NextFunction) {
    try {
      const parsed = idParamSchema.parse({ params: { id: param(req.params.id) } });
      const data = await eppProveedoresSugeridosService.eliminar(
        requireUser(req),
        parsed.params.id,
      );
      res.json(data);
    } catch (error) {
      next(error);
    }
  },

  async adoptar(req: Request, res: Response, next: NextFunction) {
    try {
      const parsed = adoptarProveedorSugeridoSchema.parse({
        params: { id: param(req.params.id) },
      });
      const data = await eppProveedoresSugeridosService.adoptar(
        requireUser(req),
        parsed.params.id,
      );
      res.status(data.creado ? 201 : 200).json(data);
    } catch (error) {
      next(error);
    }
  },
};
