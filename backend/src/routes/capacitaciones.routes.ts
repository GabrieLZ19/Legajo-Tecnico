import { Router } from "express";
import { requireAuth, requireRole } from "../middlewares/auth";
import { capacitacionesController } from "../controllers/capacitaciones.controller";
import { planAnualController } from "../controllers/planAnual.controller";
import { uploadExcel } from "../config/multerExcel";
import { uploadRegistroManual } from "../config/multer";
import { publicActionLimiter } from "../middlewares/rateLimit";

const router = Router();

// Escritura operativa de empresa: preventor/admin + dueño con acceso al módulo
const puedeEscribirCapacitacion = requireRole("preventor", "admin", "dueno");

// Rutas protegidas (requieren autenticación)
router.get("/", requireAuth, capacitacionesController.listar);
router.post(
  "/",
  requireAuth,
  puedeEscribirCapacitacion,
  capacitacionesController.crear,
);

// Plan anual (ANTES de /:id para no capturar "plan-anual" como id)
router.get("/plan-anual/plantilla", requireAuth, planAnualController.plantilla);
router.get("/plan-anual/anios", requireAuth, planAnualController.listarAnios);
router.get("/plan-anual", requireAuth, planAnualController.obtener);
router.post(
  "/plan-anual",
  requireAuth,
  puedeEscribirCapacitacion,
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

// Registro manual (papel escaneado) — antes de /:id
router.get(
  "/registro-manual/plantilla",
  requireAuth,
  capacitacionesController.plantillaRegistroManual,
);
router.post(
  "/registro-manual",
  requireAuth,
  puedeEscribirCapacitacion,
  (req, res, next) => {
    uploadRegistroManual.single("archivo")(req, res, (err) => {
      if (err) {
        return res.status(400).json({
          error:
            err.message ||
            "Debés adjuntar el registro escaneado (JPG, PNG, WEBP o PDF)",
        });
      }
      next();
    });
  },
  capacitacionesController.crearRegistroManual,
);

router.get("/:id", requireAuth, capacitacionesController.detalle);
router.patch(
  "/:id",
  requireAuth,
  puedeEscribirCapacitacion,
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
  puedeEscribirCapacitacion,
  capacitacionesController.actualizar,
);
router.patch(
  "/:id/registro",
  requireAuth,
  puedeEscribirCapacitacion,
  capacitacionesController.actualizarRegistro,
);
router.delete(
  "/:id/asistencias/:asistenciaId",
  requireAuth,
  puedeEscribirCapacitacion,
  capacitacionesController.eliminarAsistencia,
);
router.delete(
  "/:id",
  requireAuth,
  puedeEscribirCapacitacion,
  capacitacionesController.eliminar,
);

// Ruta PÚBLICA: evaluación del empleado (sin autenticación - accedida desde el QR)
router.get("/:id/publica", publicActionLimiter, capacitacionesController.detallePublico);
router.post("/:id/evaluar", publicActionLimiter, capacitacionesController.evaluar);

export default router;
