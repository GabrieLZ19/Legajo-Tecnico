import { Router } from "express";
import { requireAuth, requireRole } from "../middlewares/auth";
import { capacitacionPlantillasController } from "../controllers/capacitacion-plantillas.controller";

const router = Router();

const puedeEscribirPlantilla = requireRole("preventor", "admin", "dueno");

router.get("/", requireAuth, capacitacionPlantillasController.listar);
router.get("/:id", requireAuth, capacitacionPlantillasController.detalle);
router.post(
  "/",
  requireAuth,
  puedeEscribirPlantilla,
  capacitacionPlantillasController.crear,
);
router.put(
  "/:id",
  requireAuth,
  puedeEscribirPlantilla,
  capacitacionPlantillasController.actualizar,
);
router.patch(
  "/:id/publicacion",
  requireAuth,
  requireRole("admin"),
  capacitacionPlantillasController.cambiarEstadoPublicacion,
);
router.delete(
  "/:id",
  requireAuth,
  puedeEscribirPlantilla,
  capacitacionPlantillasController.eliminar,
);

export default router;
