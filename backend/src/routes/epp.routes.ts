import { Router } from 'express';
import { requireAuth, requireRole } from '../middlewares/auth';
import { eppController } from '../controllers/epp.controller';

const router = Router();

// Catálogo de tipos de EPP
router.get('/tipos', requireAuth, eppController.listarTipos);
router.post('/tipos', requireAuth, requireRole('preventor', 'admin'), eppController.crearTipo);

// Entregas de EPP
router.get('/entregas', requireAuth, eppController.listarEntregas);
router.post('/entregas', requireAuth, requireRole('preventor', 'admin'), eppController.registrarEntrega);
router.get('/entregas/:id/pdf', requireAuth, eppController.descargarPdf);

// Licitaciones de EPP (stubs)
router.get('/licitaciones', requireAuth, eppController.listarLicitaciones);
router.post('/licitaciones', requireAuth, requireRole('preventor', 'admin'), eppController.crearLicitacion);

export default router;
