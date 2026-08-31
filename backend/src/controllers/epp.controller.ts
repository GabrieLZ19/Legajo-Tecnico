import { Request, Response, NextFunction } from "express";
import { eppService } from "../services/epp.service";
import {
  actualizarEmpleadoSchema,
  actualizarProveedorSchema,
  actualizarTipoSchema,
  cotizarPublicoSchema,
  crearEmpleadoSchema,
  crearLicitacionSchema,
  crearProveedorSchema,
  crearTipoBodySchema,
  idParamSchema,
  registrarEntregaSchema,
  tokenParamSchema,
} from "../schemas/epp.schema";
import { HttpError } from "../utils/httpError";
import {
  assertEmpresaAccess,
  assertEmpleadoAccess,
  assertEntregaAccess,
} from "../middlewares/empresaAccess";
import { actualizarVisibilidadEnte } from "../services/visibilidadEnte.service";

function param(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0];
  return value ?? "";
}

function requireUser(req: Request) {
  if (!req.user) {
    throw new HttpError(401, "No autenticado");
  }
  return req.user;
}

export const eppController = {
  async listarTipos(req: Request, res: Response, next: NextFunction) {
    try {
      const user = requireUser(req);
      const incluirInactivos = req.query.incluir_inactivos === "true";
      const consultoraId = user.consultora_id;
      if (!consultoraId) {
        throw new HttpError(400, "El usuario no tiene consultora asignada");
      }
      const data = await eppService.listarTipos(consultoraId, incluirInactivos);
      res.json(data);
    } catch (error) {
      next(error);
    }
  },

  async crearTipo(req: Request, res: Response, next: NextFunction) {
    try {
      const parsed = crearTipoBodySchema.parse({ body: req.body });
      const data = await eppService.crearTipo(requireUser(req), parsed.body, req.file);
      res.status(201).json(data);
    } catch (error) {
      next(error);
    }
  },

  async actualizarTipo(req: Request, res: Response, next: NextFunction) {
    try {
      const parsed = actualizarTipoSchema.parse({
        params: { id: param(req.params.id) },
        body: req.body,
      });
      const data = await eppService.actualizarTipo(
        requireUser(req),
        parsed.params.id,
        parsed.body,
        req.file,
      );
      res.json(data);
    } catch (error) {
      next(error);
    }
  },

  async listarEmpleados(req: Request, res: Response, next: NextFunction) {
    try {
      const empresaId = String(req.query.empresa_id || "");
      if (!empresaId) throw new HttpError(400, "empresa_id es requerido");
      await assertEmpresaAccess(requireUser(req), empresaId);
      const data = await eppService.listarEmpleados(empresaId);
      res.json(data);
    } catch (error) {
      next(error);
    }
  },

  async crearEmpleado(req: Request, res: Response, next: NextFunction) {
    try {
      const parsed = crearEmpleadoSchema.parse({ body: req.body });
      await assertEmpresaAccess(requireUser(req), parsed.body.empresa_id);
      const data = await eppService.crearEmpleado(parsed.body);
      res.status(201).json(data);
    } catch (error) {
      next(error);
    }
  },

  async actualizarEmpleado(req: Request, res: Response, next: NextFunction) {
    try {
      const parsed = actualizarEmpleadoSchema.parse({
        params: { id: param(req.params.id) },
        body: req.body,
      });
      await assertEmpleadoAccess(requireUser(req), parsed.params.id);
      const data = await eppService.actualizarEmpleado(parsed.params.id, parsed.body);
      res.json(data);
    } catch (error) {
      next(error);
    }
  },

  async buscarEmpleadoPorQr(req: Request, res: Response, next: NextFunction) {
    try {
      const parsed = tokenParamSchema.parse({ params: { token: param(req.params.token) } });
      const data = await eppService.buscarEmpleadoPorQr(parsed.params.token);
      await assertEmpresaAccess(requireUser(req), data.empresa_id);
      res.json({ empleado: data });
    } catch (error) {
      next(error);
    }
  },

  async generarQrEmpleado(req: Request, res: Response, next: NextFunction) {
    try {
      const parsed = idParamSchema.parse({ params: { id: param(req.params.id) } });
      await assertEmpleadoAccess(requireUser(req), parsed.params.id);
      const data = await eppService.generarQrEmpleado(parsed.params.id);
      res.json(data);
    } catch (error) {
      next(error);
    }
  },

  async listarEntregas(req: Request, res: Response, next: NextFunction) {
    try {
      const empresaId = String(req.query.empresa_id || "");
      if (!empresaId) throw new HttpError(400, "empresa_id es requerido");
      await assertEmpresaAccess(requireUser(req), empresaId);
      const data = await eppService.listarEntregas(empresaId);
      res.json(data);
    } catch (error) {
      next(error);
    }
  },

  async registrarEntrega(req: Request, res: Response, next: NextFunction) {
    try {
      const parsed = registrarEntregaSchema.parse({ body: req.body });
      const user = requireUser(req);
      await assertEmpresaAccess(user, parsed.body.empresa_id);
      const data = await eppService.registrarEntrega(user, parsed.body);
      res.status(201).json(data);
    } catch (error) {
      next(error);
    }
  },

  async regenerarPdf(req: Request, res: Response, next: NextFunction) {
    try {
      const parsed = idParamSchema.parse({ params: { id: param(req.params.id) } });
      const user = requireUser(req);
      await assertEntregaAccess(user, parsed.params.id);
      const data = await eppService.regenerarPdf(user, parsed.params.id);
      res.json(data);
    } catch (error) {
      next(error);
    }
  },

  async descargarPdf(req: Request, res: Response, next: NextFunction) {
    try {
      const parsed = idParamSchema.parse({ params: { id: param(req.params.id) } });
      await assertEntregaAccess(requireUser(req), parsed.params.id);
      const file = await eppService.descargarPdf(parsed.params.id);
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="${file.filename}"`);
      res.send(file.buffer);
    } catch (error) {
      next(error);
    }
  },

  async listarProveedores(req: Request, res: Response, next: NextFunction) {
    try {
      const consultoraId = requireUser(req).consultora_id;
      if (!consultoraId) throw new HttpError(400, "El usuario no tiene consultora asignada");
      const data = await eppService.listarProveedores(consultoraId);
      res.json(data);
    } catch (error) {
      next(error);
    }
  },

  async crearProveedor(req: Request, res: Response, next: NextFunction) {
    try {
      const parsed = crearProveedorSchema.parse({ body: req.body });
      const consultoraId = requireUser(req).consultora_id;
      if (!consultoraId) throw new HttpError(400, "El usuario no tiene consultora asignada");
      const data = await eppService.crearProveedor(consultoraId, parsed.body);
      res.status(201).json(data);
    } catch (error) {
      next(error);
    }
  },

  async actualizarProveedor(req: Request, res: Response, next: NextFunction) {
    try {
      const parsed = actualizarProveedorSchema.parse({
        params: { id: param(req.params.id) },
        body: req.body,
      });
      const consultoraId = requireUser(req).consultora_id;
      if (!consultoraId) throw new HttpError(400, "El usuario no tiene consultora asignada");
      const data = await eppService.actualizarProveedor(
        consultoraId,
        parsed.params.id,
        parsed.body,
      );
      res.json(data);
    } catch (error) {
      next(error);
    }
  },

  async listarLicitaciones(req: Request, res: Response, next: NextFunction) {
    try {
      const empresaId = String(req.query.empresa_id || "");
      if (!empresaId) throw new HttpError(400, "empresa_id es requerido");
      await assertEmpresaAccess(requireUser(req), empresaId);
      const data = await eppService.listarLicitaciones(empresaId);
      res.json(data);
    } catch (error) {
      next(error);
    }
  },

  async crearLicitacion(req: Request, res: Response, next: NextFunction) {
    try {
      const parsed = crearLicitacionSchema.parse({ body: req.body });
      const user = requireUser(req);
      await assertEmpresaAccess(user, parsed.body.empresa_id);
      const data = await eppService.crearLicitacion(user, parsed.body);
      res.status(201).json(data);
    } catch (error) {
      next(error);
    }
  },

  async obtenerCotizacionPublica(req: Request, res: Response, next: NextFunction) {
    try {
      const token = param(req.params.token);
      const data = await eppService.obtenerCotizacionPublica(token);
      res.json({ cotizacion: data });
    } catch (error) {
      next(error);
    }
  },

  async cargarCotizacionPublica(req: Request, res: Response, next: NextFunction) {
    try {
      const parsed = cotizarPublicoSchema.parse({
        params: { token: param(req.params.token) },
        body: req.body,
      });
      const data = await eppService.cargarCotizacionPublica(parsed.params.token, parsed.body);
      res.json({ success: true, cotizacion: data });
    } catch (error) {
      next(error);
    }
  },

  async actualizarVisibilidadEnteEntrega(req: Request, res: Response, next: NextFunction) {
    try {
      const parsed = idParamSchema.parse({ params: { id: param(req.params.id) } });
      const { visible_ente_regulador } = req.body;
      if (typeof visible_ente_regulador !== "boolean") {
        return res.status(400).json({ error: "visible_ente_regulador debe ser boolean" });
      }
      await assertEntregaAccess(requireUser(req), parsed.params.id);
      const data = await actualizarVisibilidadEnte(
        "epp_entregas",
        parsed.params.id,
        visible_ente_regulador,
      );
      res.json(data);
    } catch (error) {
      next(error);
    }
  },
};
