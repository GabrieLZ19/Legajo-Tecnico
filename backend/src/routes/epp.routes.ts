import { Router } from 'express';
const router = Router();

router.post('/entregas', (req, res) => { res.status(501).json({ error: 'Not implemented' }); });
router.post('/licitaciones', (req, res) => { res.status(501).json({ error: 'Not implemented' }); });

export default router;
