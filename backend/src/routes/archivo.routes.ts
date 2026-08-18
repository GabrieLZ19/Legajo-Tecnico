import { Router } from "express";
import { requireAuth } from "../middlewares/auth";
import { archivoController } from "../controllers/ente.controller";

const router = Router();

router.get("/", requireAuth, archivoController.listar);

export default router;
