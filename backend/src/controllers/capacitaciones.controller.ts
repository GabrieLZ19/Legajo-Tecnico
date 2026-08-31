import { Request, Response, NextFunction } from "express";
import {
  capacitacionesService,
  parseParticipantesManuales,
} from "../services/capacitaciones.service";
import { assertCapacitacionAccess, assertEmpresaAccess } from "../middlewares/empresaAccess";
import { actualizarVisibilidadEnte } from "../services/visibilidadEnte.service";
import { HttpError } from "../utils/httpError";
import { clampInt, parseDateFilter, parseHistoricoResultado } from "../utils/searchSanitize";
import type { HistoricoFiltros } from "../services/capacitaciones.service";

function parseHistoricoQuery(req: Request): HistoricoFiltros {
  return {
    participante: req.query.participante
      ? String(req.query.participante)
      : undefined,
    tema: req.query.tema ? String(req.query.tema) : undefined,
    fecha_desde: parseDateFilter(req.query.fecha_desde),
    fecha_hasta: parseDateFilter(req.query.fecha_hasta),
    resultado: parseHistoricoResultado(req.query.resultado),
    limit: clampInt(req.query.limit, 25, 1, 100),
    offset: clampInt(req.query.offset, 0, 0, 500_000),
  };
}

const MAX_FIRMA_CHARS = 400_000;

export const capacitacionesController = {
  async listar(req: Request, res: Response, next: NextFunction) {
    try {
      const empresaId = req.query.empresa_id as string;
      if (!empresaId)
        return res.status(400).json({ error: "empresa_id es requerido" });

      await assertEmpresaAccess(req.user!, empresaId);
      const capacitaciones = await capacitacionesService.listar(empresaId);
      res.json({ capacitaciones });
    } catch (error) {
      next(error);
    }
  },

  async crear(req: Request, res: Response, next: NextFunction) {
    try {
      const preventorId = req.user!.id;
      if (!req.body.empresa_id) {
        return res.status(400).json({ error: "empresa_id es requerido" });
      }
      await assertEmpresaAccess(req.user!, req.body.empresa_id);
      const cap = await capacitacionesService.crear({
        ...req.body,
        preventor_id: preventorId,
      });
      res.status(201).json(cap);
    } catch (error) {
      next(error);
    }
  },

  async crearRegistroManual(req: Request, res: Response, next: NextFunction) {
    try {
      const empresaId = String(req.body.empresa_id || "");
      const fecha = String(req.body.fecha || "");
      const file = req.file;

      if (!empresaId) {
        return res.status(400).json({ error: "empresa_id es requerido" });
      }
      if (!fecha) {
        return res
          .status(400)
          .json({ error: "La fecha y hora del registro son obligatorias" });
      }
      await assertEmpresaAccess(req.user!, empresaId);
      const participantes = parseParticipantesManuales(req.body.participantes);

      if (!file && participantes.length === 0) {
        return res.status(400).json({
          error:
            "Adjuntá el escaneo del registro (Paso 2) o cargá al menos un participante (Paso 3).",
        });
      }

      const cap = await capacitacionesService.crearRegistroManual({
        empresa_id: empresaId,
        preventor_id: req.user!.id,
        titulo: req.body.titulo,
        fecha,
        instructor: req.body.instructor,
        fechas_horario: req.body.fechas_horario,
        cantidad_horas: req.body.cantidad_horas,
        file: file ?? undefined,
        participantes,
      });
      res.status(201).json(cap);
    } catch (error) {
      if (error instanceof HttpError) {
        return res.status(error.statusCode).json({ error: error.message });
      }
      next(error);
    }
  },

  async adjuntarRegistroManual(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const file = req.file;

      if (!file) {
        return res.status(400).json({
          error: "Debés adjuntar el registro escaneado (imagen o PDF)",
        });
      }

      await assertCapacitacionAccess(req.user!, id as string);
      const cap = await capacitacionesService.adjuntarRegistroManual(
        id as string,
        file,
      );
      res.json(cap);
    } catch (error) {
      next(error);
    }
  },

  async plantillaRegistroManual(
    req: Request,
    res: Response,
    next: NextFunction,
  ) {
    try {
      const empresaId = String(req.query.empresa_id || "");
      if (!empresaId) {
        return res.status(400).json({ error: "empresa_id es requerido" });
      }
      await assertEmpresaAccess(req.user!, empresaId);

      const result = await capacitacionesService.generarPlantillaRegistroManual({
        empresa_id: empresaId,
        titulo: req.query.titulo ? String(req.query.titulo) : undefined,
        fecha: req.query.fecha ? String(req.query.fecha) : undefined,
        instructor: req.query.instructor
          ? String(req.query.instructor)
          : undefined,
        fechas_horario: req.query.fechas_horario
          ? String(req.query.fechas_horario)
          : undefined,
        cantidad_horas: req.query.cantidad_horas
          ? String(req.query.cantidad_horas)
          : undefined,
      });

      if (result.error) {
        return res.status(result.code!).json({ error: result.error });
      }

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        'attachment; filename="plantilla_registro_capacitacion.pdf"',
      );
      result.doc!.pipe(res);
      result.doc!.end();
    } catch (error) {
      next(error);
    }
  },

  async plantillaRegistroCapacitacion(
    req: Request,
    res: Response,
    next: NextFunction,
  ) {
    try {
      const { id } = req.params;
      await assertCapacitacionAccess(req.user!, id as string);

      const result =
        await capacitacionesService.generarPlantillaRegistroPorCapacitacion(
          id as string,
        );

      if (result.error) {
        return res.status(result.code!).json({ error: result.error });
      }

      const safeName = (result.titulo || "capacitacion")
        .replace(/[^\w.\-]+/g, "_")
        .slice(0, 60);

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="plantilla_registro_${safeName}.pdf"`,
      );
      result.doc!.pipe(res);
      result.doc!.end();
    } catch (error) {
      next(error);
    }
  },

  async detalle(req: Request, res: Response, next: NextFunction) {
    try {
      const id = String(req.params.id);
      await assertCapacitacionAccess(req.user!, id);
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
      await assertCapacitacionAccess(req.user!, id);
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
      await assertCapacitacionAccess(req.user!, id);
      const result = await capacitacionesService.generarQR(id);
      if (!result)
        return res.status(404).json({ error: "Capacitación no encontrada" });
      res.json(result);
    } catch (error) {
      next(error);
    }
  },

  async consultarIntento(req: Request, res: Response, next: NextFunction) {
    try {
      const id = String(req.params.id);
      const dni = String(req.query.dni || "");
      const result = await capacitacionesService.consultarIntentoPublico(
        id,
        dni,
      );
      res.json(result);
    } catch (error) {
      if (error instanceof HttpError) {
        next(error);
        return;
      }
      next(error);
    }
  },

  async evaluar(req: Request, res: Response, next: NextFunction) {
    try {
      const id = String(req.params.id);
      const firma = req.body?.firma;
      if (typeof firma === "string" && firma.length > MAX_FIRMA_CHARS) {
        throw new HttpError(400, "La firma es demasiado grande");
      }
      const result = await capacitacionesService.evaluarEmpleado(id, req.body);
      res.status(201).json(result);
    } catch (error) {
      if (error instanceof HttpError) {
        next(error);
        return;
      }
      res.status(400).json({
        error: error instanceof Error ? error.message : "No se pudo evaluar",
      });
    }
  },

  async actualizar(req: Request, res: Response, next: NextFunction) {
    try {
      const id = String(req.params.id);
      await assertCapacitacionAccess(req.user!, id);
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
      await assertCapacitacionAccess(req.user!, id);
      await capacitacionesService.eliminar(id);
      res.json({ success: true, message: "Capacitación eliminada con éxito" });
    } catch (error) {
      next(error);
    }
  },

  async eliminarAsistencia(req: Request, res: Response, next: NextFunction) {
    try {
      const id = String(req.params.id);
      const asistenciaId = String(req.params.asistenciaId);
      await assertCapacitacionAccess(req.user!, id);
      const result = await capacitacionesService.eliminarAsistencia(
        id,
        asistenciaId,
      );
      if (result.error)
        return res.status(result.code!).json({ error: result.error });
      res.json({ success: true, message: "Participante eliminado del registro" });
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
      await assertCapacitacionAccess(req.user!, id);
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
      await assertCapacitacionAccess(req.user!, id);
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

  async actualizarVisibilidadEnte(req: Request, res: Response, next: NextFunction) {
    try {
      const id = String(req.params.id);
      const { visible_ente_regulador } = req.body;
      if (typeof visible_ente_regulador !== "boolean") {
        return res.status(400).json({ error: "visible_ente_regulador debe ser boolean" });
      }
      await assertCapacitacionAccess(req.user!, id);
      const data = await actualizarVisibilidadEnte(
        "capacitaciones",
        id,
        visible_ente_regulador,
      );
      res.json(data);
    } catch (error) {
      next(error);
    }
  },

  async historico(req: Request, res: Response, next: NextFunction) {
    try {
      const empresaId = String(req.query.empresa_id || "");
      if (!empresaId) {
        return res.status(400).json({ error: "empresa_id es requerido" });
      }
      await assertEmpresaAccess(req.user!, empresaId);
      const result = await capacitacionesService.listarHistorico(
        empresaId,
        parseHistoricoQuery(req),
      );
      res.json(result);
    } catch (error) {
      next(error);
    }
  },

  async exportarHistorico(req: Request, res: Response, next: NextFunction) {
    try {
      const empresaId = String(req.query.empresa_id || "");
      if (!empresaId) {
        return res.status(400).json({ error: "empresa_id es requerido" });
      }
      await assertEmpresaAccess(req.user!, empresaId);
      const filtros = parseHistoricoQuery(req);
      const buffer = await capacitacionesService.exportarHistorico(
        empresaId,
        {
          participante: filtros.participante,
          tema: filtros.tema,
          fecha_desde: filtros.fecha_desde,
          fecha_hasta: filtros.fecha_hasta,
          resultado: filtros.resultado,
        },
      );
      res.setHeader("Content-Type", "text/csv;charset=utf-8");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename=base_historica_capacitaciones_${empresaId.slice(0, 8)}.csv`,
      );
      res.send(buffer);
    } catch (error) {
      if (error instanceof HttpError) {
        return res.status(error.statusCode).json({ error: error.message });
      }
      next(error);
    }
  },
};
