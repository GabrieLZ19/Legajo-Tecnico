import { Request, Response, NextFunction } from "express";
import { checklistPlantillasService } from "../services/checklistPlantillas.service";
import { equiposService } from "../services/equipos.service";
import { inspeccionesService } from "../services/inspecciones.service";
import { assertEmpresaAccess } from "../middlewares/empresaAccess";
import { supabaseAdmin } from "../config/supabase";

function paramStr(value: string | string[]): string {
  return Array.isArray(value) ? value[0] : value;
}

export const checklistController = {
  // ——— Plantillas ———
  async listarPlantillas(req: Request, res: Response, next: NextFunction) {
    try {
      const { ambito, empresaId, estado, tipo_equipo } = req.query;
      if (ambito !== "empresa" && ambito !== "global") {
        return res.status(400).json({ error: "ambito inválido" });
      }

      const isAdmin = req.user?.rol === "admin";
      if (ambito === "empresa") {
        if (!empresaId) {
          return res.status(400).json({ error: "empresaId es requerido" });
        }
        await assertEmpresaAccess(req.user!, empresaId as string);
      }

      const plantillas = await checklistPlantillasService.listar({
        ambito,
        empresa_id: empresaId as string | undefined,
        estado_publicacion:
          (estado as "pendiente" | "aprobada" | "rechazada" | "todas") ||
          "todas",
        incluirNoPublicadas: ambito === "global" && isAdmin,
        tipo_equipo: tipo_equipo as string | undefined,
      });
      res.json(plantillas);
    } catch (error) {
      next(error);
    }
  },

  async obtenerPlantilla(req: Request, res: Response, next: NextFunction) {
    try {
      const plantilla = await checklistPlantillasService.obtenerPorId(
        paramStr(req.params.id),
      );
      if (!plantilla) {
        return res.status(404).json({ error: "Plantilla no encontrada" });
      }
      if (plantilla.ambito === "empresa" && plantilla.empresa_id) {
        await assertEmpresaAccess(req.user!, plantilla.empresa_id);
      } else if (
        plantilla.ambito === "global" &&
        plantilla.estado_publicacion !== "aprobada" &&
        req.user?.rol !== "admin"
      ) {
        return res.status(403).json({ error: "Plantilla no disponible" });
      }
      res.json(plantilla);
    } catch (error) {
      next(error);
    }
  },

  async crearPlantilla(req: Request, res: Response, next: NextFunction) {
    try {
      const {
        titulo,
        tipo_equipo,
        ambito,
        empresa_id,
        publicar_directo,
        items,
      } = req.body;

      if (ambito === "empresa") {
        if (!empresa_id) {
          return res
            .status(400)
            .json({ error: "empresa_id es requerido para ambito empresa" });
        }
        await assertEmpresaAccess(req.user!, empresa_id);
      } else if (req.user?.rol !== "admin" && req.user?.rol !== "preventor") {
        return res
          .status(403)
          .json({ error: "No podés publicar en la biblioteca LT" });
      }

      if (publicar_directo && req.user?.rol !== "admin") {
        return res
          .status(403)
          .json({ error: "Solo admin puede publicar directo" });
      }

      const plantilla = await checklistPlantillasService.crear({
        titulo,
        tipo_equipo,
        ambito,
        empresa_id,
        created_by: req.user!.id,
        publicar_directo: Boolean(publicar_directo),
        items,
        consultora_id: req.user!.consultora_id,
      });
      res.status(201).json(plantilla);
    } catch (error) {
      next(error);
    }
  },

  async actualizarPlantilla(req: Request, res: Response, next: NextFunction) {
    try {
      const existing = await checklistPlantillasService.obtenerPorId(
        paramStr(req.params.id),
      );
      if (!existing) {
        return res.status(404).json({ error: "Plantilla no encontrada" });
      }
      if (existing.ambito === "empresa" && existing.empresa_id) {
        await assertEmpresaAccess(req.user!, existing.empresa_id);
      } else if (req.user?.rol !== "admin") {
        return res.status(403).json({ error: "Solo admin puede editar globales" });
      }
      const plantilla = await checklistPlantillasService.actualizar(
        paramStr(req.params.id),
        req.body,
      );
      res.json(plantilla);
    } catch (error) {
      next(error);
    }
  },

  async publicacionPlantilla(req: Request, res: Response, next: NextFunction) {
    try {
      if (req.user?.rol !== "admin") {
        return res.status(403).json({ error: "Solo admin" });
      }
      const plantilla = await checklistPlantillasService.actualizarPublicacion(
        paramStr(req.params.id),
        {
          estado: req.body.estado,
          rechazo_motivo: req.body.rechazo_motivo,
          aprobado_por: req.user.id,
        },
      );
      res.json(plantilla);
    } catch (error) {
      next(error);
    }
  },

  async eliminarPlantilla(req: Request, res: Response, next: NextFunction) {
    try {
      const existing = await checklistPlantillasService.obtenerPorId(
        paramStr(req.params.id),
      );
      if (!existing) {
        return res.status(404).json({ error: "Plantilla no encontrada" });
      }
      if (existing.ambito === "empresa" && existing.empresa_id) {
        await assertEmpresaAccess(req.user!, existing.empresa_id);
      } else if (req.user?.rol !== "admin") {
        return res.status(403).json({ error: "Solo admin" });
      }
      await checklistPlantillasService.eliminar(paramStr(req.params.id));
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  },

  // ——— Equipos ———
  async listarEquipos(req: Request, res: Response, next: NextFunction) {
    try {
      const { empresaId, todos } = req.query;
      if (!empresaId) {
        return res.status(400).json({ error: "empresaId es requerido" });
      }
      await assertEmpresaAccess(req.user!, empresaId as string);
      const equipos = await equiposService.listar(empresaId as string, {
        soloActivos: todos !== "1",
      });
      res.json(
        equipos.map((e) => ({
          ...e,
          qr_url: equiposService.qrUrl(e.qr_token),
        })),
      );
    } catch (error) {
      next(error);
    }
  },

  async obtenerEquipo(req: Request, res: Response, next: NextFunction) {
    try {
      const equipo = await equiposService.obtenerPorId(paramStr(req.params.id));
      if (!equipo) {
        return res.status(404).json({ error: "Equipo no encontrado" });
      }
      await assertEmpresaAccess(req.user!, equipo.empresa_id);
      const historial = await inspeccionesService.historialEquipo(equipo.id);
      res.json({
        ...equipo,
        qr_url: equiposService.qrUrl(equipo.qr_token),
        historial,
      });
    } catch (error) {
      next(error);
    }
  },

  async crearEquipo(req: Request, res: Response, next: NextFunction) {
    try {
      await assertEmpresaAccess(req.user!, req.body.empresa_id);
      const equipo = await equiposService.crear({
        ...req.body,
        created_by: req.user!.id,
      });
      res.status(201).json({
        ...equipo,
        qr_url: equiposService.qrUrl(equipo.qr_token),
      });
    } catch (error) {
      next(error);
    }
  },

  async actualizarEquipo(req: Request, res: Response, next: NextFunction) {
    try {
      const existing = await equiposService.obtenerPorId(paramStr(req.params.id));
      if (!existing) {
        return res.status(404).json({ error: "Equipo no encontrado" });
      }
      await assertEmpresaAccess(req.user!, existing.empresa_id);
      const equipo = await equiposService.actualizar(paramStr(req.params.id), req.body);
      res.json({
        ...equipo,
        qr_url: equiposService.qrUrl(equipo.qr_token),
      });
    } catch (error) {
      next(error);
    }
  },

  // ——— Inspecciones ———
  async listarInspecciones(req: Request, res: Response, next: NextFunction) {
    try {
      const { empresaId, equipoId, limit, offset } = req.query;
      if (!empresaId) {
        return res.status(400).json({ error: "empresaId es requerido" });
      }
      await assertEmpresaAccess(req.user!, empresaId as string);
      const result = await inspeccionesService.listar({
        empresaId: empresaId as string,
        equipoId: equipoId as string | undefined,
        limit: limit ? Number(limit) : undefined,
        offset: offset ? Number(offset) : undefined,
      });
      res.json(result);
    } catch (error) {
      next(error);
    }
  },

  async obtenerInspeccion(req: Request, res: Response, next: NextFunction) {
    try {
      const insp = await inspeccionesService.obtenerPorId(paramStr(req.params.id));
      if (!insp) {
        return res.status(404).json({ error: "Inspección no encontrada" });
      }
      await assertEmpresaAccess(req.user!, insp.empresa_id);
      res.json(insp);
    } catch (error) {
      next(error);
    }
  },

  async crearInspeccion(req: Request, res: Response, next: NextFunction) {
    try {
      await assertEmpresaAccess(req.user!, req.body.empresa_id);

      const equipo = await equiposService.obtenerPorId(req.body.equipo_id);
      if (!equipo || !equipo.activo) {
        return res.status(404).json({ error: "Equipo no encontrado o inactivo" });
      }
      if (equipo.empresa_id !== req.body.empresa_id) {
        return res
          .status(400)
          .json({ error: "El equipo no pertenece a la empresa indicada" });
      }

      if (req.body.plantilla_id) {
        const plantilla = await checklistPlantillasService.obtenerPorId(
          req.body.plantilla_id,
        );
        if (!plantilla) {
          return res.status(404).json({ error: "Plantilla no encontrada" });
        }
        const okEmpresa =
          plantilla.ambito === "empresa" &&
          plantilla.empresa_id === req.body.empresa_id;
        const okGlobal =
          plantilla.ambito === "global" &&
          plantilla.estado_publicacion === "aprobada";
        if (!okEmpresa && !okGlobal) {
          return res.status(403).json({ error: "Plantilla no disponible" });
        }
        if (plantilla.tipo_equipo !== equipo.tipo_equipo) {
          return res.status(400).json({
            error: "La plantilla no corresponde al tipo de equipo",
          });
        }
      }

      const insp = await inspeccionesService.crear({
        ...req.body,
        inspector_id: req.user!.id,
        inspector_nombre:
          req.body.inspector_nombre || undefined,
      });
      res.status(201).json(insp);
    } catch (error) {
      next(error);
    }
  },

  async actualizarAccion(req: Request, res: Response, next: NextFunction) {
    try {
      const { data: accion, error } = await supabaseAdmin
        .from("inspeccion_acciones")
        .select("id, empresa_id")
        .eq("id", paramStr(req.params.id))
        .single();

      if (error || !accion) {
        return res.status(404).json({ error: "Acción no encontrada" });
      }
      await assertEmpresaAccess(req.user!, accion.empresa_id);
      const updated = await inspeccionesService.actualizarAccion(
        paramStr(req.params.id),
        req.body.estado,
      );
      res.json(updated);
    } catch (error) {
      next(error);
    }
  },

  // ——— Público QR ———
  async equipoPorQr(req: Request, res: Response, next: NextFunction) {
    try {
      const equipo = await equiposService.obtenerPorQrToken(paramStr(req.params.token));
      if (!equipo) {
        return res.status(404).json({ error: "Equipo no encontrado o inactivo" });
      }

      const plantillasEmpresa = await checklistPlantillasService.listar({
        ambito: "empresa",
        empresa_id: equipo.empresa_id,
        tipo_equipo: equipo.tipo_equipo,
      });
      const plantillasLt = await checklistPlantillasService.listar({
        ambito: "global",
        incluirNoPublicadas: false,
        tipo_equipo: equipo.tipo_equipo,
      });

      const plantillasDetalle = await Promise.all(
        [...plantillasEmpresa, ...plantillasLt].map(async (p) => {
          const plantillaId = String(p.id);
          const full =
            await checklistPlantillasService.obtenerPorId(plantillaId);
          return {
            id: plantillaId,
            titulo: p.titulo,
            tipo_equipo: p.tipo_equipo,
            ambito: p.ambito,
            total_items: p.total_items,
            items: full?.items || [],
          };
        }),
      );

      res.json({
        equipo: {
          id: equipo.id,
          nombre: equipo.nombre,
          tipo_equipo: equipo.tipo_equipo,
          codigo_interno: equipo.codigo_interno,
          ubicacion: equipo.ubicacion,
          empresa_id: equipo.empresa_id,
          empresa_nombre:
            (equipo.empresas as { razon_social?: string } | null)
              ?.razon_social || null,
        },
        plantillas: plantillasDetalle,
      });
    } catch (error) {
      next(error);
    }
  },

  async crearInspeccionPublica(req: Request, res: Response, next: NextFunction) {
    try {
      const equipo = await equiposService.obtenerPorQrToken(paramStr(req.params.token));
      if (!equipo) {
        return res.status(404).json({ error: "Equipo no encontrado o inactivo" });
      }

      const plantillaId = req.body.plantilla_id as string | null | undefined;
      if (!plantillaId) {
        return res.status(400).json({ error: "plantilla_id es requerido" });
      }

      const plantilla =
        await checklistPlantillasService.obtenerPorId(plantillaId);
      if (!plantilla) {
        return res.status(404).json({ error: "Plantilla no encontrada" });
      }

      const okEmpresa =
        plantilla.ambito === "empresa" &&
        plantilla.empresa_id === equipo.empresa_id;
      const okGlobal =
        plantilla.ambito === "global" &&
        plantilla.estado_publicacion === "aprobada";
      if (!okEmpresa && !okGlobal) {
        return res.status(403).json({ error: "Plantilla no disponible" });
      }
      if (plantilla.tipo_equipo !== equipo.tipo_equipo) {
        return res.status(400).json({
          error: "La plantilla no corresponde al tipo de equipo",
        });
      }

      const plantillaItems = plantilla.items || [];
      if (plantillaItems.length === 0) {
        return res.status(400).json({ error: "La plantilla no tiene ítems" });
      }

      const calificaciones = new Map(
        (req.body.items as Array<{ texto: string; calificacion: string }>).map(
          (i) => [i.texto.trim(), i.calificacion],
        ),
      );

      const itemsSeguros = plantillaItems.map(
        (
          item: { texto: string; criticidad: string; orden?: number },
          idx: number,
        ) => {
          const cal = calificaciones.get(item.texto.trim());
          if (cal !== "bien" && cal !== "regular" && cal !== "mal") {
            throw Object.assign(
              new Error(`Falta calificación para: ${item.texto}`),
              { statusCode: 400 },
            );
          }
          return {
            texto: item.texto,
            criticidad: item.criticidad as "alta" | "media" | "baja",
            calificacion: cal as "bien" | "regular" | "mal",
            orden: item.orden ?? idx + 1,
          };
        },
      );

      const insp = await inspeccionesService.crear({
        empresa_id: equipo.empresa_id,
        equipo_id: equipo.id,
        plantilla_id: plantilla.id,
        plantilla_titulo: plantilla.titulo,
        inspector_nombre: req.body.inspector_nombre,
        observaciones: req.body.observaciones,
        items: itemsSeguros,
        acciones: req.body.acciones,
        idempotency_key: req.body.idempotency_key,
      });
      res.status(201).json({
        id: insp?.id,
        resultado: insp?.resultado,
        mensaje: "Inspección registrada correctamente",
        idempotent: Boolean(req.body.idempotency_key),
      });
    } catch (error) {
      next(error);
    }
  },
};
