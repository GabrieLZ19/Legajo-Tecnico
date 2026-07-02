import express from 'express';
import cors from 'cors';
import { env } from './config/env';
import { errorHandler } from './middlewares/errorHandler';

// Importar rutas (Stubs)
import authRoutes from './routes/auth.routes';
import empresasRoutes from './routes/empresas.routes';
import informesRoutes from './routes/informes.routes';
import planAccionRoutes from './routes/planAccion.routes';
import capacitacionesRoutes from './routes/capacitaciones.routes';
import eppRoutes from './routes/epp.routes';
import adminRoutes from './routes/admin.routes';
import dashboardRoutes from './routes/dashboard.routes';
import plantillasRoutes from './routes/plantillas.routes';

const app = express();

// Middlewares globales
app.use(express.json());
app.use(cors({
  origin: env.FRONTEND_URL,
  credentials: true,
}));

// Endpoints de salud
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Registrar rutas
app.use('/api/auth', authRoutes);
app.use('/api/empresas', empresasRoutes);
app.use('/api/informes', informesRoutes);
app.use('/api/plan-accion', planAccionRoutes);
app.use('/api/capacitaciones', capacitacionesRoutes);
app.use('/api/epp', eppRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/plantillas-declaracion', plantillasRoutes);

// Middleware de manejo de errores
app.use(errorHandler);

const PORT = parseInt(env.PORT, 10);

app.listen(PORT, () => {
  console.log(`🚀 Servidor backend escuchando en http://localhost:${PORT}`);
});
