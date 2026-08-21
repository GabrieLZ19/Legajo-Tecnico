import { Router } from 'express';
import { requireAuth, requireRole } from '../middlewares/auth';
import { plantillasController } from '../controllers/plantillas.controller';

const router = Router();

router.use(requireAuth);

router.get('/', plantillasController.listarPlantillas);
router.post(
  '/',
  requireRole('preventor', 'admin', 'dueno'),
  plantillasController.crearPlantilla,
);
router.put(
  '/:id',
  requireRole('preventor', 'admin', 'dueno'),
  plantillasController.actualizarPlantilla,
);
router.delete(
  '/:id',
  requireRole('preventor', 'admin', 'dueno'),
  plantillasController.eliminarPlantilla,
);

export default router;
