import { Router } from 'express';
import { validate } from '../middlewares/validate';
import { requireAuth } from '../middlewares/auth';
import { crearInformeSchema, editarInformeSchema, firmaSchema, subirEvidenciaSchema } from '../schemas/informe.schema';
import { informesController } from '../controllers/informes.controller';
import { upload } from '../config/multer';

const router = Router();

// Todas las rutas de informes requieren autenticación
router.use(requireAuth);

router.post('/', validate(crearInformeSchema), informesController.crearInforme);
router.get('/', informesController.listarInformes);
router.get('/:id', informesController.obtenerInforme);
router.patch('/:id', validate(editarInformeSchema), informesController.editarInforme);

// Subida de archivos (acepta hasta 10 imágenes)
router.post('/:id/evidencia', upload.array('evidencia', 10), validate(subirEvidenciaSchema), informesController.subirEvidencia);

// Firmas
router.post('/:id/firma-preventor', validate(firmaSchema), informesController.firmarPreventor);
router.post('/:id/firma-dueno', validate(firmaSchema), informesController.firmarDueno);

// PDF
router.get('/:id/pdf', informesController.descargarPdf);

export default router;
