import { Router } from "express";
import { requireAuth, requireRole } from "../middlewares/auth";
import { capacitacionPlantillasController } from "../controllers/capacitacion-plantillas.controller";

const router = Router();

router.get("/", requireAuth, capacitacionPlantillasController.listar);
router.get("/:id", requireAuth, capacitacionPlantillasController.detalle);
router.post(
  "/",
  requireAuth,
  requireRole("preventor", "admin"),
  capacitacionPlantillasController.crear,
);
router.put(
  "/:id",
  requireAuth,
  requireRole("preventor", "admin"),
  capacitacionPlantillasController.actualizar,
);
router.delete(
  "/:id",
  requireAuth,
  requireRole("preventor", "admin"),
  capacitacionPlantillasController.eliminar,
);

export default router;
