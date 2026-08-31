import { Router } from 'express';
import { requireAuth } from '../middlewares/auth';
import { requireRole } from '../middlewares/auth';
import { validate } from '../middlewares/validate';
import { planAccionController } from '../controllers/planAccion.controller';
import {
  actualizarAccionSchema,
  crearAccionManualSchema,
} from '../schemas/planAccion.schema';

const router = Router();
const puedeEscribirPlan = requireRole('preventor', 'admin', 'dueno');

router.use(requireAuth);

router.get('/responsables', planAccionController.listarResponsables);
router.get('/export', planAccionController.exportar);
router.get('/', planAccionController.listar);
router.post(
  '/',
  puedeEscribirPlan,
  validate(crearAccionManualSchema),
  planAccionController.crearManual,
);
router.patch(
  '/:id',
  validate(actualizarAccionSchema),
  planAccionController.actualizar,
);

export default router;
