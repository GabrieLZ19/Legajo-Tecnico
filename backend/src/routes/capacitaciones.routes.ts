import { Router } from 'express';
import { requireAuth, requireRole } from '../middlewares/auth';
import { capacitacionesController } from '../controllers/capacitaciones.controller';

const router = Router();

// Rutas protegidas (requieren autenticación)
router.get('/', requireAuth, capacitacionesController.listar);
router.post('/', requireAuth, requireRole('preventor', 'admin'), capacitacionesController.crear);
router.get('/:id', requireAuth, capacitacionesController.detalle);
router.patch('/:id', requireAuth, requireRole('preventor', 'admin'), capacitacionesController.actualizarEstado);
router.get('/:id/qr', requireAuth, capacitacionesController.generarQR);
router.get('/:id/exportar', requireAuth, capacitacionesController.exportarAsistencias);
router.put('/:id', requireAuth, requireRole('preventor', 'admin'), capacitacionesController.actualizar);
router.delete('/:id', requireAuth, requireRole('preventor', 'admin'), capacitacionesController.eliminar);

// Ruta PÚBLICA: evaluación del empleado (sin autenticación - accedida desde el QR)
router.post('/:id/evaluar', capacitacionesController.evaluar);

export default router;
