import { Router } from "express";
import { requireAuth, requireRole } from "../middlewares/auth";
import { enteController } from "../controllers/ente.controller";

const router = Router();

router.use(requireAuth, requireRole("ente_regulador"));
router.get("/dashboard", enteController.dashboard);
router.get("/archivo", enteController.archivo);
router.get("/empresas", enteController.empresas);

export default router;
