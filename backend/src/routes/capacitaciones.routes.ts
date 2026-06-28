import { Router } from 'express';
const router = Router();

router.post('/', (req, res) => { res.status(501).json({ error: 'Not implemented' }); });
router.get('/:id/qr', (req, res) => { res.status(501).json({ error: 'Not implemented' }); });
router.post('/:id/asistencia', (req, res) => { res.status(501).json({ error: 'Not implemented' }); });

export default router;
