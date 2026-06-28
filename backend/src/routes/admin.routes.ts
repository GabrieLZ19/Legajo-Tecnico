import { Router } from 'express';
import { requireAuth, requireRole } from '../middlewares/auth';
import { upload } from '../config/multer';
import { adminController } from '../controllers/admin.controller';

const router = Router();

// Solo los admins acceden a estas rutas
router.use(requireAuth, requireRole('admin'));

router.get('/usuarios', adminController.listarUsuarios);
router.get('/empresas', adminController.listarEmpresas);
router.post('/consultoras/:id/logo', upload.single('logo'), adminController.subirLogoConsultora);

export default router;
