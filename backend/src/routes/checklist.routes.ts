import { Router } from "express";
import { requireAuth, requireRole } from "../middlewares/auth";
import { validate } from "../middlewares/validate";
import {
  capacitacionPublicReadLimiter,
  capacitacionPublicSubmitLimiter,
} from "../middlewares/rateLimit";
import { checklistController } from "../controllers/checklist.controller";
import {
  actualizarAccionInspeccionSchema,
  actualizarEquipoSchema,
  actualizarPlantillaSchema,
  crearEquipoSchema,
  crearInspeccionPublicaSchema,
  crearInspeccionSchema,
  crearPlantillaSchema,
  publicacionPlantillaSchema,
} from "../schemas/checklist.schema";

const router = Router();
const puedeEscribir = requireRole("preventor", "admin");

// Público — inspección por QR (rate limit alto: misma IP en planta)
router.get(
  "/qr/:token",
  capacitacionPublicReadLimiter,
  checklistController.equipoPorQr,
);
router.post(
  "/qr/:token/inspecciones",
  capacitacionPublicSubmitLimiter,
  validate(crearInspeccionPublicaSchema),
  checklistController.crearInspeccionPublica,
);

router.use(requireAuth);

// Plantillas
router.get("/plantillas", checklistController.listarPlantillas);
router.get("/plantillas/:id", checklistController.obtenerPlantilla);
router.post(
  "/plantillas",
  puedeEscribir,
  validate(crearPlantillaSchema),
  checklistController.crearPlantilla,
);
router.patch(
  "/plantillas/:id",
  puedeEscribir,
  validate(actualizarPlantillaSchema),
  checklistController.actualizarPlantilla,
);
router.patch(
  "/plantillas/:id/publicacion",
  requireRole("admin"),
  validate(publicacionPlantillaSchema),
  checklistController.publicacionPlantilla,
);
router.delete(
  "/plantillas/:id",
  puedeEscribir,
  checklistController.eliminarPlantilla,
);

// Equipos
router.get("/equipos", checklistController.listarEquipos);
router.get("/equipos/:id", checklistController.obtenerEquipo);
router.post(
  "/equipos",
  puedeEscribir,
  validate(crearEquipoSchema),
  checklistController.crearEquipo,
);
router.patch(
  "/equipos/:id",
  puedeEscribir,
  validate(actualizarEquipoSchema),
  checklistController.actualizarEquipo,
);

// Inspecciones
router.get("/inspecciones", checklistController.listarInspecciones);
router.get("/inspecciones/:id", checklistController.obtenerInspeccion);
router.post(
  "/inspecciones",
  puedeEscribir,
  validate(crearInspeccionSchema),
  checklistController.crearInspeccion,
);
router.patch(
  "/acciones/:id",
  puedeEscribir,
  validate(actualizarAccionInspeccionSchema),
  checklistController.actualizarAccion,
);

export default router;
