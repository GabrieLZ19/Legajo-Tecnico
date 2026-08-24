import { Request, Response, NextFunction } from "express";
import { adminService } from "../services/admin.service";
import { archivoService } from "../services/archivo.service";
import { enteService } from "../services/ente.service";
import type { TipoDocumentoArchivo } from "../services/archivo.service";
import { assertEmpresaAccess, assertPerfilDeConsultora, requireConsultoraId } from "../middlewares/empresaAccess";
import { HttpError } from "../utils/httpError";

export const adminController = {
  async listarUsuarios(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await adminService.listarUsuarios(requireConsultoraId(req.user!));
      res.json(data);
    } catch (error) {
      next(error);
    }
  },

  async crearUsuario(req: Request, res: Response, next: NextFunction) {
    try {
      const usuarioCreadorId = req.user!.id;
      const consultoraIdToken = requireConsultoraId(req.user!);
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
      const consultoraId = requireConsultoraId(req.user!);
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const userData = req.body;

      const data = await adminService.editarUsuario(usuarioEditorId, consultoraId, id, userData);
      res.json(data);
    } catch (error) {
      next(error);
    }
  },

  async verificarPasswordUsuario(req: Request, res: Response, next: NextFunction) {
    try {
      const consultoraId = requireConsultoraId(req.user!);
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const currentPassword = String(req.body?.currentPassword || "");

      await adminService.assertPasswordActualUsuario(
        consultoraId,
        id,
        currentPassword,
      );
      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  },

  async resetPasswordUsuario(req: Request, res: Response, next: NextFunction) {
    try {
      const usuarioEditorId = req.user!.id;
      const consultoraId = requireConsultoraId(req.user!);
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const password = String(req.body?.password || "");
      const currentPassword = String(req.body?.currentPassword || "");

      const data = await adminService.resetPasswordUsuario(
        usuarioEditorId,
        consultoraId,
        id,
        password,
        currentPassword,
      );
      res.json(data);
    } catch (error) {
      next(error);
    }
  },

  async listarEmpresas(req: Request, res: Response, next: NextFunction) {
    try {
      const consultoraId = requireConsultoraId(req.user!);
      const data = await adminService.listarEmpresas(consultoraId);
      res.json(data);
    } catch (error) {
      next(error);
    }
  },

  async crearEmpresa(req: Request, res: Response, next: NextFunction) {
    try {
      const usuarioCreadorId = req.user!.id;
      const consultoraIdToken = requireConsultoraId(req.user!);
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
      const consultoraId = requireConsultoraId(req.user!);
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const empresaData = req.body;

      const data = await adminService.editarEmpresa(usuarioEditorId, consultoraId, id, empresaData);
      res.json(data);
    } catch (error) {
      next(error);
    }
  },

  async cambiarEstadoEmpresa(req: Request, res: Response, next: NextFunction) {
    try {
      const usuarioId = req.user!.id;
      const consultoraId = requireConsultoraId(req.user!);
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const estado = String(req.body?.estado || "") as
        | "activa"
        | "aviso_deuda"
        | "pausada"
        | "eliminada";

      if (!["activa", "aviso_deuda", "pausada", "eliminada"].includes(estado)) {
        return res.status(400).json({
          error:
            "Estado inválido. Usá: activa, aviso_deuda, pausada o eliminada.",
        });
      }

      const data = await adminService.cambiarEstadoEmpresa(
        usuarioId,
        consultoraId,
        id,
        estado,
      );
      res.json(data);
    } catch (error) {
      next(error);
    }
  },

  async obtenerDashboardGlobal(req: Request, res: Response, next: NextFunction) {
    try {
      const consultoraId = requireConsultoraId(req.user!);
      const { empresaId, fechaDesde, fechaHasta } = req.query;
      if (empresaId) {
        await assertEmpresaAccess(req.user!, String(empresaId));
      }

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
      await assertEmpresaAccess(req.user!, empresa_id);
      await assertPerfilDeConsultora(
        preventor_id,
        requireConsultoraId(req.user!),
        "preventor",
      );
      await adminService.asignarEmpresaAPreventor(preventor_id, empresa_id);
      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  },

  async desasignarEmpresaAPreventor(req: Request, res: Response, next: NextFunction) {
    try {
      const { preventor_id, empresa_id } = req.body;
      await assertEmpresaAccess(req.user!, empresa_id);
      await assertPerfilDeConsultora(
        preventor_id,
        requireConsultoraId(req.user!),
        "preventor",
      );
      await adminService.desasignarEmpresaAPreventor(preventor_id, empresa_id);
      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  },

  async obtenerConsultora(req: Request, res: Response, next: NextFunction) {
    try {
      const consultoraId = requireConsultoraId(req.user!);
      const data = await adminService.obtenerConsultora(consultoraId);
      res.json(data);
    } catch (error) {
      next(error);
    }
  },

  async actualizarConsultora(req: Request, res: Response, next: NextFunction) {
    try {
      const usuarioId = req.user!.id;
      const consultoraId = requireConsultoraId(req.user!);
      const { nombre, cuit, comision_epp_porcentaje } = req.body;

      const data = await adminService.actualizarConsultora(usuarioId, consultoraId, {
        nombre,
        cuit,
        comision_epp_porcentaje:
          comision_epp_porcentaje === undefined || comision_epp_porcentaje === ""
            ? undefined
            : Number(comision_epp_porcentaje),
      });
      res.json(data);
    } catch (error) {
      next(error);
    }
  },

  async listarLogs(req: Request, res: Response, next: NextFunction) {
    try {
      const consultoraId = requireConsultoraId(req.user!);
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
      const consultoraId = requireConsultoraId(req.user!);

      const notificacion = await adminService.enviarNotificacion(usuarioId, consultoraId, titulo, mensaje, tipo);
      res.status(201).json(notificacion);
    } catch (error) {
      next(error);
    }
  },

  async listarMisNotificaciones(req: Request, res: Response, next: NextFunction) {
    try {
      const usuarioId = req.user!.id;
      const consultoraId = req.user?.consultora_id;
      if (!consultoraId) {
        res.json([]);
        return;
      }

      const notifications = await adminService.listarMisNotificaciones(usuarioId, consultoraId);
      res.json(notifications);
    } catch (error) {
      next(error);
    }
  },

  async marcarNotificacionLeida(req: Request, res: Response, next: NextFunction) {
    try {
      const usuarioId = req.user!.id;
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const result = await adminService.marcarNotificacionLeida(id, usuarioId);
      res.json(result);
    } catch (error) {
      next(error);
    }
  },

  async marcarTodasNotificacionesLeidas(req: Request, res: Response, next: NextFunction) {
    try {
      const usuarioId = req.user!.id;
      const consultoraId = req.user?.consultora_id;
      if (!consultoraId) {
        res.json({ marked: 0 });
        return;
      }
      const result = await adminService.marcarTodasNotificacionesLeidas(
        usuarioId,
        consultoraId,
      );
      res.json(result);
    } catch (error) {
      next(error);
    }
  },

  async subirLogoConsultora(req: Request, res: Response, next: NextFunction) {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const consultoraId = requireConsultoraId(req.user!);
      if (id !== consultoraId) {
        throw new HttpError(403, "No tenés acceso a esta consultora");
      }
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
      const consultoraId = requireConsultoraId(req.user!);
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

  async obtenerArchivo(req: Request, res: Response, next: NextFunction) {
    try {
      const consultoraId = requireConsultoraId(req.user!);
      const empresaId = req.query.empresaId ? String(req.query.empresaId) : undefined;
      const tipo = req.query.tipo ? String(req.query.tipo) : undefined;

      let empresaIds: string[] = [];
      if (empresaId) {
        await assertEmpresaAccess(req.user!, empresaId);
        empresaIds = [empresaId];
      } else {
        const empresas = await adminService.listarEmpresas(consultoraId);
        empresaIds = (empresas ?? []).map((e: { id: string }) => e.id);
      }

      const incluir: TipoDocumentoArchivo[] =
        tipo === "informe" || tipo === "capacitacion" || tipo === "epp"
          ? [tipo]
          : ["informe", "capacitacion", "epp"];

      const result = await archivoService.listar({
        empresaIds,
        incluir,
      });
      res.json(result);
    } catch (error) {
      next(error);
    }
  },

  async listarAsignacionesEnte(req: Request, res: Response, next: NextFunction) {
    try {
      const enteId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      await assertPerfilDeConsultora(
        enteId,
        requireConsultoraId(req.user!),
        "ente_regulador",
      );
      const data = await enteService.listarEmpresasAsignadas(enteId);
      res.json({ asignaciones: data });
    } catch (error) {
      next(error);
    }
  },

  async guardarAsignacionesEnte(req: Request, res: Response, next: NextFunction) {
    try {
      const enteId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const asignaciones = Array.isArray(req.body.asignaciones) ? req.body.asignaciones : [];
      await assertPerfilDeConsultora(
        enteId,
        requireConsultoraId(req.user!),
        "ente_regulador",
      );
      for (const asignacion of asignaciones) {
        if (asignacion?.empresa_id) {
          await assertEmpresaAccess(req.user!, asignacion.empresa_id);
        }
      }
      const data = await enteService.guardarAsignaciones(enteId, asignaciones);
      res.json({ asignaciones: data });
    } catch (error) {
      next(error);
    }
  },
};
