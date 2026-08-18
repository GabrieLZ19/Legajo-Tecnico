import { Router } from 'express';
import { validate } from '../middlewares/validate';
import { loginSchema, loginAdminSchema } from '../schemas/auth.schema';
import { authController } from '../controllers/auth.controller';
import { requireAuth } from '../middlewares/auth';
import { authLimiter } from '../middlewares/rateLimit';

const router = Router();

router.post('/login', authLimiter, validate(loginSchema), authController.login);
router.post('/login-admin', authLimiter, validate(loginAdminSchema), authController.loginAdmin);
router.get('/me', requireAuth, authController.me);
router.post('/logout', authController.logout);
router.get('/mis-empresas', requireAuth, authController.misEmpresas);

export default router;
