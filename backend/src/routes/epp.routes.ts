import { Router } from "express";
import { requireAuth, requireRole } from "../middlewares/auth";
import { eppController } from "../controllers/epp.controller";
import { upload } from "../config/multer";
import { publicActionLimiter } from "../middlewares/rateLimit";

const router = Router();

// Escritura operativa de empresa: alineado con canWriteAppModule("epp") del front
const puedeEscribirEpp = requireRole("preventor", "admin", "dueno");

router.get("/tipos", requireAuth, eppController.listarTipos);
router.post(
  "/tipos",
  requireAuth,
  puedeEscribirEpp,
  upload.single("foto"),
  eppController.crearTipo,
);
router.patch(
  "/tipos/:id",
  requireAuth,
  puedeEscribirEpp,
  upload.single("foto"),
  eppController.actualizarTipo,
);

router.get("/empleados", requireAuth, eppController.listarEmpleados);
router.post(
  "/empleados",
  requireAuth,
  puedeEscribirEpp,
  eppController.crearEmpleado,
);
router.patch(
  "/empleados/:id",
  requireAuth,
  puedeEscribirEpp,
  eppController.actualizarEmpleado,
);
router.get(
  "/empleados/qr/:token",
  requireAuth,
  puedeEscribirEpp,
  eppController.buscarEmpleadoPorQr,
);
router.get(
  "/empleados/:id/qr",
  requireAuth,
  puedeEscribirEpp,
  eppController.generarQrEmpleado,
);

router.get("/entregas", requireAuth, eppController.listarEntregas);
router.post(
  "/entregas",
  requireAuth,
  puedeEscribirEpp,
  eppController.registrarEntrega,
);
router.post(
  "/entregas/:id/pdf",
  requireAuth,
  puedeEscribirEpp,
  eppController.regenerarPdf,
);
router.get("/entregas/:id/pdf", requireAuth, eppController.descargarPdf);

router.get("/proveedores", requireAuth, eppController.listarProveedores);
router.post(
  "/proveedores",
  requireAuth,
  puedeEscribirEpp,
  eppController.crearProveedor,
);
router.patch(
  "/proveedores/:id",
  requireAuth,
  puedeEscribirEpp,
  eppController.actualizarProveedor,
);

router.get("/licitaciones", requireAuth, eppController.listarLicitaciones);
router.post(
  "/licitaciones",
  requireAuth,
  puedeEscribirEpp,
  eppController.crearLicitacion,
);

router.get("/cotizar/:token", publicActionLimiter, eppController.obtenerCotizacionPublica);
router.post("/cotizar/:token", publicActionLimiter, eppController.cargarCotizacionPublica);

export default router;
