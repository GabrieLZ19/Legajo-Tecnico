import { Router } from 'express';
import { requireAuth, requireRole } from '../middlewares/auth';
import { upload } from '../config/multer';
import { empresasController } from '../controllers/empresas.controller';

const router = Router();

router.use(requireAuth);

router.get('/:id', empresasController.obtenerEmpresa);
router.post('/:id/logo', requireRole('dueno', 'admin'), upload.single('logo'), empresasController.subirLogo);

export default router;
