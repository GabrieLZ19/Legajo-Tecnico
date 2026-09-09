import { Router } from "express";
import { requireAuth, requireRole } from "../middlewares/auth";
import { eppProveedoresSugeridosController } from "../controllers/eppProveedoresSugeridos.controller";

const router = Router();

const puedeEscribir = requireRole("preventor", "admin", "dueno");
const soloAdmin = requireRole("admin");

router.get("/", requireAuth, eppProveedoresSugeridosController.listar);
router.get("/:id", requireAuth, eppProveedoresSugeridosController.obtener);
router.post("/", requireAuth, puedeEscribir, eppProveedoresSugeridosController.crear);
router.patch(
  "/:id",
  requireAuth,
  soloAdmin,
  eppProveedoresSugeridosController.actualizar,
);
router.patch(
  "/:id/publicacion",
  requireAuth,
  soloAdmin,
  eppProveedoresSugeridosController.publicacion,
);
router.delete(
  "/:id",
  requireAuth,
  soloAdmin,
  eppProveedoresSugeridosController.eliminar,
);
router.post(
  "/:id/adoptar",
  requireAuth,
  puedeEscribir,
  eppProveedoresSugeridosController.adoptar,
);

export default router;
