import { Router } from "express";
import { requireAuth, requireRole } from "../middlewares/auth";
import { eppController } from "../controllers/epp.controller";
import { upload, uploadRegistroManual } from "../config/multer";
import {
  publicActionLimiter,
  eppEntregaPublicReadLimiter,
  eppEntregaPublicSubmitLimiter,
} from "../middlewares/rateLimit";

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

router.get("/historico", requireAuth, eppController.historico);
router.get("/historico/exportar", requireAuth, eppController.exportarHistorico);
router.get(
  "/historico/exportar-pdf",
  requireAuth,
  eppController.exportarHistoricoPdf,
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
  "/empleados/:id/planilla-historica",
  requireAuth,
  eppController.planillaHistoricaEmpleado,
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
router.patch(
  "/entregas/:id/visibilidad-ente",
  requireAuth,
  puedeEscribirEpp,
  eppController.actualizarVisibilidadEnteEntrega,
);

router.get(
  "/entrega-qr",
  requireAuth,
  puedeEscribirEpp,
  eppController.generarQrEntrega,
);

router.get(
  "/entrega-publica/:token",
  eppEntregaPublicReadLimiter,
  eppController.obtenerEntregaPublica,
);
router.get(
  "/entrega-publica/:token/empleado",
  eppEntregaPublicReadLimiter,
  eppController.buscarEmpleadoEntregaPublica,
);
router.post(
  "/entrega-publica/:token",
  eppEntregaPublicSubmitLimiter,
  upload.single("foto"),
  eppController.registrarEntregaPublica,
);

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
router.delete(
  "/proveedores/:id",
  requireAuth,
  puedeEscribirEpp,
  eppController.eliminarProveedor,
);

router.get("/licitaciones", requireAuth, eppController.listarLicitaciones);
router.post(
  "/licitaciones",
  requireAuth,
  puedeEscribirEpp,
  eppController.crearLicitacion,
);
router.get("/licitaciones/:id", requireAuth, eppController.obtenerLicitacion);
router.post(
  "/licitaciones/:id/proveedores",
  requireAuth,
  puedeEscribirEpp,
  eppController.agregarProveedorALicitacion,
);
router.patch(
  "/licitaciones/:id/estado",
  requireAuth,
  puedeEscribirEpp,
  eppController.actualizarEstadoLicitacion,
);

router.get("/cotizar/:token", publicActionLimiter, eppController.obtenerCotizacionPublica);
router.post(
  "/cotizar/:token",
  publicActionLimiter,
  uploadRegistroManual.single("presupuesto"),
  eppController.cargarCotizacionPublica,
);
router.get(
  "/adjudicacion/:token",
  publicActionLimiter,
  eppController.obtenerAdjudicacionPublica,
);

export default router;
