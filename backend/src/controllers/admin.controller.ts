import { Request, Response, NextFunction } from "express";
import { adminService } from "../services/admin.service";

export const adminController = {
  async listarUsuarios(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await adminService.listarUsuarios();
      res.json(data);
    } catch (error) {
      next(error);
    }
  },

  async crearUsuario(req: Request, res: Response, next: NextFunction) {
    try {
      const usuarioCreadorId = req.user!.id;
      const consultoraIdToken = req.user?.consultora_id;
      const userData = req.body;

      const data = await adminService.crearUsuario(usuarioCreadorId, consultoraIdToken, userData);
      res.status(201).json(data);
    } catch (error) {
      next(error);
    }
  },

  async editarUsuario(req: Request, res: Response, next: NextFunction) {
    try {
      const usuarioEditorId = req.user!.id;
      const consultoraId = req.user!.consultora_id || "d3b07384-d113-4ec2-a9b6-419dc4040835";
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const userData = req.body;

      const data = await adminService.editarUsuario(usuarioEditorId, consultoraId, id, userData);
      res.json(data);
    } catch (error) {
      next(error);
    }
  },

  async listarEmpresas(req: Request, res: Response, next: NextFunction) {
    try {
      const consultoraId = req.user?.consultora_id || "d3b07384-d113-4ec2-a9b6-419dc4040835";
      const data = await adminService.listarEmpresas(consultoraId);
      res.json(data);
    } catch (error) {
      next(error);
    }
  },

  async crearEmpresa(req: Request, res: Response, next: NextFunction) {
    try {
      const usuarioCreadorId = req.user!.id;
      const consultoraIdToken = req.user?.consultora_id;
      const empresaData = req.body;

      const data = await adminService.crearEmpresa(usuarioCreadorId, consultoraIdToken, empresaData);
      res.status(201).json(data);
    } catch (error) {
      next(error);
    }
  },

  async editarEmpresa(req: Request, res: Response, next: NextFunction) {
    try {
      const usuarioEditorId = req.user!.id;
      const consultoraId = req.user!.consultora_id || "d3b07384-d113-4ec2-a9b6-419dc4040835";
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const empresaData = req.body;

      const data = await adminService.editarEmpresa(usuarioEditorId, consultoraId, id, empresaData);
      res.json(data);
    } catch (error) {
      next(error);
    }
  },

  async obtenerDashboardGlobal(req: Request, res: Response, next: NextFunction) {
    try {
      const consultoraId = req.user?.consultora_id || "d3b07384-d113-4ec2-a9b6-419dc4040835";
      const { empresaId, fechaDesde, fechaHasta } = req.query;

      const data = await adminService.obtenerDashboardGlobal(consultoraId, {
        empresaId: empresaId ? String(empresaId) : undefined,
        fechaDesde: fechaDesde ? String(fechaDesde) : undefined,
        fechaHasta: fechaHasta ? String(fechaHasta) : undefined,
      });

      res.json(data);
    } catch (error) {
      next(error);
    }
  },

  async asignarEmpresaAPreventor(req: Request, res: Response, next: NextFunction) {
    try {
      const { preventor_id, empresa_id } = req.body;
      await adminService.asignarEmpresaAPreventor(preventor_id, empresa_id);
      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  },

  async desasignarEmpresaAPreventor(req: Request, res: Response, next: NextFunction) {
    try {
      const { preventor_id, empresa_id } = req.body;
      await adminService.desasignarEmpresaAPreventor(preventor_id, empresa_id);
      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  },

  async obtenerConsultora(req: Request, res: Response, next: NextFunction) {
    try {
      const consultoraId = req.user!.consultora_id || "d3b07384-d113-4ec2-a9b6-419dc4040835";
      const data = await adminService.obtenerConsultora(consultoraId);
      res.json(data);
    } catch (error) {
      next(error);
    }
  },

  async actualizarConsultora(req: Request, res: Response, next: NextFunction) {
    try {
      const usuarioId = req.user!.id;
      const consultoraId = req.user!.consultora_id || "d3b07384-d113-4ec2-a9b6-419dc4040835";
      const { nombre, cuit } = req.body;

      const data = await adminService.actualizarConsultora(usuarioId, consultoraId, nombre, cuit);
      res.json(data);
    } catch (error) {
      next(error);
    }
  },

  async listarLogs(req: Request, res: Response, next: NextFunction) {
    try {
      const consultoraId = req.user!.consultora_id || "d3b07384-d113-4ec2-a9b6-419dc4040835";
      const logs = await adminService.listarLogs(consultoraId);
      res.json(logs);
    } catch (error) {
      next(error);
    }
  },

  async enviarNotificacion(req: Request, res: Response, next: NextFunction) {
    try {
      const { titulo, mensaje, tipo } = req.body;
      const usuarioId = req.user!.id;
      const consultoraId = req.user!.consultora_id || "d3b07384-d113-4ec2-a9b6-419dc4040835";

      const notificacion = await adminService.enviarNotificacion(usuarioId, consultoraId, titulo, mensaje, tipo);
      res.status(201).json(notificacion);
    } catch (error) {
      next(error);
    }
  },

  async listarMisNotificaciones(req: Request, res: Response, next: NextFunction) {
    try {
      const usuarioId = req.user!.id;
      const consultoraId = req.user!.consultora_id || "d3b07384-d113-4ec2-a9b6-419dc4040835";

      const notifications = await adminService.listarMisNotificaciones(usuarioId, consultoraId);
      res.json(notifications);
    } catch (error) {
      next(error);
    }
  },

  async subirLogoConsultora(req: Request, res: Response, next: NextFunction) {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const file = req.file;

      if (!file) {
        return res.status(400).json({ error: "No se subió ningún archivo" });
      }

      const logoUrl = await adminService.subirLogoConsultora(id, file);
      res.json({ success: true, logo_url: logoUrl });
    } catch (error) {
      next(error);
    }
  },

  async subirLogoEmpresa(req: Request, res: Response, next: NextFunction) {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const consultoraId = req.user?.consultora_id || "d3b07384-d113-4ec2-a9b6-419dc4040835";
      const file = req.file;

      if (!file) {
        return res.status(400).json({ error: "No se subió ningún archivo" });
      }

      const logoUrl = await adminService.subirLogoEmpresa(consultoraId, id, file);
      res.json({ success: true, logo_url: logoUrl });
    } catch (error) {
      next(error);
    }
  },

  async buscarCuit(req: Request, res: Response, next: NextFunction) {
    try {
      const cuit = Array.isArray(req.params.cuit) ? req.params.cuit[0] : req.params.cuit;
      const data = await adminService.buscarCuit(cuit);
      res.json(data);
    } catch (error) {
      next(error);
    }
  },
};
