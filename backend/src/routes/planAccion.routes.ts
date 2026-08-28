import { Router } from 'express';
import { requireAuth } from '../middlewares/auth';
import { planAccionController } from '../controllers/planAccion.controller';

const router = Router();

router.use(requireAuth);

router.get('/responsables', planAccionController.listarResponsables);
router.get('/export', planAccionController.exportar);
router.get('/', planAccionController.listar);
router.patch('/:id', planAccionController.actualizar);

export default router;
