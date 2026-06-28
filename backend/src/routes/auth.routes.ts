import { Router } from 'express';
import { validate } from '../middlewares/validate';
import { loginSchema, loginAdminSchema } from '../schemas/auth.schema';
import { authController } from '../controllers/auth.controller';
import { requireAuth } from '../middlewares/auth';

const router = Router();

router.post('/login', validate(loginSchema), authController.login);
router.post('/login-admin', validate(loginAdminSchema), authController.loginAdmin);
router.get('/me', requireAuth, authController.me);
// router.post('/logout', requireAuth, authController.logout); // Implementar luego

export default router;
