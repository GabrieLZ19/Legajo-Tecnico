import { Router } from "express";
import { requireAuth, requireRole } from "../middlewares/auth";
import { eppController } from "../controllers/epp.controller";
import { upload } from "../config/multer";
import { publicActionLimiter } from "../middlewares/rateLimit";

const router = Router();

router.get("/tipos", requireAuth, eppController.listarTipos);
router.post(
  "/tipos",
  requireAuth,
  requireRole("preventor", "admin"),
  upload.single("foto"),
  eppController.crearTipo,
);
router.patch(
  "/tipos/:id",
  requireAuth,
  requireRole("preventor", "admin"),
  upload.single("foto"),
  eppController.actualizarTipo,
);

router.get("/empleados", requireAuth, eppController.listarEmpleados);
router.post(
  "/empleados",
  requireAuth,
  requireRole("preventor", "admin"),
  eppController.crearEmpleado,
);
router.patch(
  "/empleados/:id",
  requireAuth,
  requireRole("preventor", "admin"),
  eppController.actualizarEmpleado,
);
router.get(
  "/empleados/qr/:token",
  requireAuth,
  requireRole("preventor", "admin"),
  eppController.buscarEmpleadoPorQr,
);
router.get(
  "/empleados/:id/qr",
  requireAuth,
  requireRole("preventor", "admin"),
  eppController.generarQrEmpleado,
);

router.get("/entregas", requireAuth, eppController.listarEntregas);
router.post(
  "/entregas",
  requireAuth,
  requireRole("preventor", "admin"),
  eppController.registrarEntrega,
);
router.post(
  "/entregas/:id/pdf",
  requireAuth,
  requireRole("preventor", "admin"),
  eppController.regenerarPdf,
);
router.get("/entregas/:id/pdf", requireAuth, eppController.descargarPdf);

router.get("/proveedores", requireAuth, eppController.listarProveedores);
router.post(
  "/proveedores",
  requireAuth,
  requireRole("preventor", "admin"),
  eppController.crearProveedor,
);
router.patch(
  "/proveedores/:id",
  requireAuth,
  requireRole("preventor", "admin"),
  eppController.actualizarProveedor,
);

router.get("/licitaciones", requireAuth, eppController.listarLicitaciones);
router.post(
  "/licitaciones",
  requireAuth,
  requireRole("preventor", "admin"),
  eppController.crearLicitacion,
);

router.get("/cotizar/:token", publicActionLimiter, eppController.obtenerCotizacionPublica);
router.post("/cotizar/:token", publicActionLimiter, eppController.cargarCotizacionPublica);

export default router;
