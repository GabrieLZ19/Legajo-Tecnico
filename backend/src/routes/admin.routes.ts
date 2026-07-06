import { Router } from 'express';
import { requireAuth, requireRole } from '../middlewares/auth';
import { upload } from '../config/multer';
import { adminController } from '../controllers/admin.controller';

const router = Router();

// Rutas accesibles por cualquier usuario autenticado (sin importar rol)
// Requerida para que la campana de notificaciones del Header funcione para todos los usuarios.
router.get('/notificaciones/mias', requireAuth, adminController.listarMisNotificaciones);

// Solo los admins acceden a las siguientes rutas de administración
router.use(requireAuth, requireRole('admin'));

router.get('/usuarios', adminController.listarUsuarios);
router.post('/usuarios', adminController.crearUsuario);
router.put('/usuarios/:id', adminController.editarUsuario);

router.get('/empresas', adminController.listarEmpresas);
router.post('/empresas', adminController.crearEmpresa);
router.put('/empresas/:id', adminController.editarEmpresa);

router.get('/dashboard', adminController.obtenerDashboardGlobal);
router.get('/auditoria', adminController.listarLogs);
router.post('/notificaciones', adminController.enviarNotificacion);

router.get('/consultora', adminController.obtenerConsultora);
router.put('/consultora', adminController.actualizarConsultora);

router.post('/preventores/asignar', adminController.asignarEmpresaAPreventor);
router.post('/preventores/desasignar', adminController.desasignarEmpresaAPreventor);

router.post('/consultoras/:id/logo', upload.single('logo'), adminController.subirLogoConsultora);
router.post('/empresas/:id/logo', upload.single('logo'), adminController.subirLogoEmpresa);
router.get('/empresas/buscar-cuit/:cuit', adminController.buscarCuit);

export default router;
