import { Request, Response, NextFunction } from "express";
import {
  documentosVencimientoService,
  type CategoriaDocumento,
} from "../services/documentosVencimiento.service";
import {
  assertDocumentoVencimientoAccess,
  assertEmpresaAccess,
} from "../middlewares/empresaAccess";
import { actualizarVisibilidadEnte } from "../services/visibilidadEnte.service";
import { env } from "../config/env";
import { supabaseAdmin } from "../config/supabase";

async function assertDocAccess(
  req: Request,
  documentoId: string,
  categoriaEsperada?: CategoriaDocumento,
) {
  const doc = await documentosVencimientoService.obtenerPorId(documentoId);
  if (!doc) {
    const err = new Error("Documento no encontrado") as Error & {
      statusCode: number;
    };
    err.statusCode = 404;
    throw err;
  }
  if (
    categoriaEsperada &&
    doc.categoria !== categoriaEsperada
  ) {
    const err = new Error("Documento no encontrado") as Error & {
      statusCode: number;
    };
    err.statusCode = 404;
    throw err;
  }
  await assertDocumentoVencimientoAccess(req.user!, documentoId);
  return doc;
}

export const documentosVencimientoController = {
  async listar(req: Request, res: Response, next: NextFunction) {
    try {
      const { empresaId, categoria, tipo, q, limit, offset } = req.query;
      if (!empresaId || !categoria) {
        return res
          .status(400)
          .json({ error: "empresaId y categoria son requeridos" });
      }
      if (categoria !== "medicion" && categoria !== "art") {
        return res.status(400).json({ error: "categoria inválida" });
      }
      await assertEmpresaAccess(req.user!, empresaId as string);
      const soloVisibleEnte =
        req.user!.rol === "ente_regulador" && categoria === "medicion";
      const result = await documentosVencimientoService.listar({
        empresaId: empresaId as string,
        categoria: categoria as CategoriaDocumento,
        tipo: tipo ? String(tipo) : undefined,
        q: q ? String(q) : undefined,
        limit: limit ? Number(limit) : undefined,
        offset: offset ? Number(offset) : undefined,
        soloVisibleEnte,
      });
      res.json(result);
    } catch (error) {
      next(error);
    }
  },

  async listarTipos(req: Request, res: Response, next: NextFunction) {
    try {
      const { empresaId, categoria } = req.query;
      if (!empresaId || !categoria) {
        return res
          .status(400)
          .json({ error: "empresaId y categoria son requeridos" });
      }
      if (categoria !== "medicion" && categoria !== "art") {
        return res.status(400).json({ error: "categoria inválida" });
      }
      await assertEmpresaAccess(req.user!, empresaId as string);
      const tipos = await documentosVencimientoService.listarTipos(
        empresaId as string,
        categoria as CategoriaDocumento,
      );
      res.json({ tipos });
    } catch (error) {
      next(error);
    }
  },

  async proximos(req: Request, res: Response, next: NextFunction) {
    try {
      const { empresaId, dias, limit } = req.query;
      if (!empresaId) {
        return res.status(400).json({ error: "empresaId es requerido" });
      }
      await assertEmpresaAccess(req.user!, empresaId as string);
      const items = await documentosVencimientoService.listarProximos({
        empresaId: empresaId as string,
        dias: dias ? Number(dias) : 60,
        limit: limit ? Number(limit) : 6,
      });
      res.json({ items });
    } catch (error) {
      next(error);
    }
  },

  async obtener(req: Request, res: Response, next: NextFunction) {
    try {
      const id = String(req.params.id);
      const categoria = req.query.categoria as CategoriaDocumento | undefined;
      const doc = await assertDocAccess(
        req,
        id,
        categoria === "medicion" || categoria === "art" ? categoria : undefined,
      );
      res.json(doc);
    } catch (error) {
      next(error);
    }
  },

  async crear(req: Request, res: Response, next: NextFunction) {
    try {
      const {
        empresa_id,
        categoria,
        titulo,
        tipo,
        fecha_vencimiento,
        sin_vencimiento,
        notas,
      } = req.body;
      await assertEmpresaAccess(req.user!, empresa_id as string);
      const files = (req.files as Express.Multer.File[] | undefined) || [];
      const doc = await documentosVencimientoService.crear({
        empresa_id,
        categoria,
        titulo,
        tipo,
        fecha_vencimiento,
        sin_vencimiento: Boolean(sin_vencimiento),
        notas,
        creado_por: req.user!.id,
        files,
      });
      res.status(201).json(doc);
    } catch (error) {
      next(error);
    }
  },

  async actualizar(req: Request, res: Response, next: NextFunction) {
    try {
      const id = String(req.params.id);
      await assertDocAccess(req, id);
      const doc = await documentosVencimientoService.actualizar(id, req.body);
      res.json(doc);
    } catch (error) {
      next(error);
    }
  },

  async actualizarVisibilidadEnte(
    req: Request,
    res: Response,
    next: NextFunction,
  ) {
    try {
      const id = String(req.params.id);
      const { visible_ente_regulador } = req.body;
      if (typeof visible_ente_regulador !== "boolean") {
        return res
          .status(400)
          .json({ error: "visible_ente_regulador debe ser boolean" });
      }
      await assertDocumentoVencimientoAccess(req.user!, id);
      const { data: doc, error } = await supabaseAdmin
        .from("documentos_vencimiento")
        .select("categoria")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      if (!doc) {
        return res.status(404).json({ error: "Documento no encontrado" });
      }
      if (doc.categoria !== "medicion") {
        return res.status(400).json({
          error: "La visibilidad ante el ente solo aplica a mediciones",
        });
      }
      const data = await actualizarVisibilidadEnte(
        "documentos_vencimiento",
        id,
        visible_ente_regulador,
      );
      res.json(data);
    } catch (error) {
      next(error);
    }
  },

  async eliminar(req: Request, res: Response, next: NextFunction) {
    try {
      const id = String(req.params.id);
      await assertDocAccess(req, id);
      await documentosVencimientoService.eliminar(id);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  },

  async subirAdjuntos(req: Request, res: Response, next: NextFunction) {
    try {
      const id = String(req.params.id);
      await assertDocAccess(req, id);
      const files = (req.files as Express.Multer.File[] | undefined) || [];
      if (files.length === 0) {
        return res.status(400).json({ error: "No se enviaron archivos" });
      }
      const adjuntos = await documentosVencimientoService.subirAdjuntos(
        id,
        files,
      );
      res.status(201).json({ adjuntos });
    } catch (error) {
      next(error);
    }
  },

  async eliminarAdjunto(req: Request, res: Response, next: NextFunction) {
    try {
      const adjuntoId = String(req.params.adjuntoId);
      const { data: adj, error } = await supabaseAdmin
        .from("documento_vencimiento_adjuntos")
        .select("id, documento_id")
        .eq("id", adjuntoId)
        .single();

      if (error || !adj) {
        return res.status(404).json({ error: "Adjunto no encontrado" });
      }
      await assertDocAccess(req, adj.documento_id as string);
      await documentosVencimientoService.eliminarAdjunto(adj.id);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  },

  async cronAvisos(req: Request, res: Response, next: NextFunction) {
    try {
      const secret = req.header("x-cron-secret");
      if (!env.CRON_SECRET || secret !== env.CRON_SECRET) {
        return res.status(401).json({ error: "No autorizado" });
      }
      const result =
        await documentosVencimientoService.procesarAvisosVencimiento();
      res.json(result);
    } catch (error) {
      next(error);
    }
  },
};
