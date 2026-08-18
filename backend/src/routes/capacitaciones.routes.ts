import { Router } from "express";
import { requireAuth, requireRole } from "../middlewares/auth";
import { capacitacionesController } from "../controllers/capacitaciones.controller";
import { planAnualController } from "../controllers/planAnual.controller";
import { uploadExcel } from "../config/multerExcel";

const router = Router();

// Rutas protegidas (requieren autenticación)
router.get("/", requireAuth, capacitacionesController.listar);
router.post(
  "/",
  requireAuth,
  requireRole("preventor", "admin"),
  capacitacionesController.crear,
);

// Plan anual (ANTES de /:id para no capturar "plan-anual" como id)
router.get("/plan-anual/plantilla", requireAuth, planAnualController.plantilla);
router.get("/plan-anual/anios", requireAuth, planAnualController.listarAnios);
router.get("/plan-anual", requireAuth, planAnualController.obtener);
router.post(
  "/plan-anual",
  requireAuth,
  requireRole("preventor", "admin"),
  (req, res, next) => {
    uploadExcel.single("archivo")(req, res, (err) => {
      if (err) {
        return res.status(400).json({
          error: err.message || "Debés adjuntar un archivo Excel (.xls o .xlsx) o PDF",
        });
      }
      next();
    });
  },
  planAnualController.subir,
);

router.get("/:id", requireAuth, capacitacionesController.detalle);
router.patch(
  "/:id",
  requireAuth,
  requireRole("preventor", "admin"),
  capacitacionesController.actualizarEstado,
);
router.get("/:id/qr", requireAuth, capacitacionesController.generarQR);
router.get(
  "/:id/exportar",
  requireAuth,
  capacitacionesController.exportarAsistencias,
);
router.put(
  "/:id",
  requireAuth,
  requireRole("preventor", "admin"),
  capacitacionesController.actualizar,
);
router.patch(
  "/:id/registro",
  requireAuth,
  requireRole("preventor", "admin", "dueno"),
  capacitacionesController.actualizarRegistro,
);
router.delete(
  "/:id",
  requireAuth,
  requireRole("preventor", "admin"),
  capacitacionesController.eliminar,
);

// Ruta PÚBLICA: evaluación del empleado (sin autenticación - accedida desde el QR)
router.get("/:id/publica", capacitacionesController.detallePublico);
router.post("/:id/evaluar", capacitacionesController.evaluar);

export default router;
