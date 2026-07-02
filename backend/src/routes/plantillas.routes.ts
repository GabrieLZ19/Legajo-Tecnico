import { Router } from 'express';
import { requireAuth } from '../middlewares/auth';
import { plantillasController } from '../controllers/plantillas.controller';

const router = Router();

// Requerir autenticación
router.use(requireAuth);

router.get('/', plantillasController.listarPlantillas);
router.post('/', plantillasController.crearPlantilla);
router.delete('/:id', plantillasController.eliminarPlantilla);

export default router;
