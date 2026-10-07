import { Router } from "express";
import { requireAuth, requireRole } from "../middlewares/auth";
import { validate } from "../middlewares/validate";
import { uploadDocumentosVencimiento } from "../config/multer";
import { documentosVencimientoController } from "../controllers/documentosVencimiento.controller";
import {
  actualizarDocumentoSchema,
  crearDocumentoSchema,
} from "../schemas/documentosVencimiento.schema";
import { visibilidadEnteSchema } from "../schemas/planAccion.schema";

const router = Router();
const puedeEscribir = requireRole("preventor", "admin");

router.post(
  "/cron/avisos-vencimiento",
  documentosVencimientoController.cronAvisos,
);

router.use(requireAuth);

router.get("/proximos", documentosVencimientoController.proximos);
router.get("/tipos", documentosVencimientoController.listarTipos);
router.get("/", documentosVencimientoController.listar);
router.get("/:id", documentosVencimientoController.obtener);
router.post(
  "/",
  puedeEscribir,
  uploadDocumentosVencimiento.array("adjuntos", 10),
  (req, _res, next) => {
    // Multipart fields llegan como strings; normalizar body para zod
    if (typeof req.body.notas === "undefined") req.body.notas = null;
    next();
  },
  validate(crearDocumentoSchema),
  documentosVencimientoController.crear,
);
router.patch(
  "/:id/visibilidad-ente",
  puedeEscribir,
  validate(visibilidadEnteSchema),
  documentosVencimientoController.actualizarVisibilidadEnte,
);
router.patch(
  "/:id",
  puedeEscribir,
  validate(actualizarDocumentoSchema),
  documentosVencimientoController.actualizar,
);
router.delete(
  "/:id",
  puedeEscribir,
  documentosVencimientoController.eliminar,
);
router.post(
  "/:id/adjuntos",
  puedeEscribir,
  uploadDocumentosVencimiento.array("adjuntos", 10),
  documentosVencimientoController.subirAdjuntos,
);
router.delete(
  "/:id/adjuntos/:adjuntoId",
  puedeEscribir,
  documentosVencimientoController.eliminarAdjunto,
);

export default router;
