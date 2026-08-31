import { Router } from 'express';
import { validate } from '../middlewares/validate';
import { requireAuth, requireRole } from '../middlewares/auth';
import { crearInformeSchema, editarInformeSchema, firmaSchema, subirEvidenciaSchema } from '../schemas/informe.schema';
import { visibilidadEnteSchema } from '../schemas/planAccion.schema';
import { informesController } from '../controllers/informes.controller';
import { upload } from '../config/multer';

const router = Router();

// Todas las rutas de informes requieren autenticación
router.use(requireAuth);

const puedeEscribirInforme = requireRole('preventor', 'admin', 'dueno');

router.post('/', puedeEscribirInforme, validate(crearInformeSchema), informesController.crearInforme);
router.get('/', informesController.listarInformes);
router.get('/:id', informesController.obtenerInforme);
router.patch('/:id', puedeEscribirInforme, validate(editarInformeSchema), informesController.editarInforme);
router.patch(
  '/:id/visibilidad-ente',
  puedeEscribirInforme,
  validate(visibilidadEnteSchema),
  informesController.actualizarVisibilidadEnte,
);
router.delete('/:id', puedeEscribirInforme, informesController.eliminarInforme);

// Subida de archivos (acepta hasta 10 imágenes)
router.post(
  '/:id/evidencia',
  puedeEscribirInforme,
  upload.array('evidencia', 10),
  validate(subirEvidenciaSchema),
  informesController.subirEvidencia,
);

// Firmas: el rol debe coincidir con el tipo de firma (admin puede asistir)
router.post(
  '/:id/firma-preventor',
  requireRole('preventor', 'admin'),
  validate(firmaSchema),
  informesController.firmarPreventor,
);
router.post(
  '/:id/firma-dueno',
  requireRole('dueno', 'admin'),
  validate(firmaSchema),
  informesController.firmarDueno,
);

// PDF
router.get('/:id/pdf', informesController.descargarPdf);

export default router;
