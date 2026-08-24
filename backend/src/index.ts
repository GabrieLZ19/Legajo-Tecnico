import express from "express";
import cors from "cors";
import compression from "compression";
import helmet from "helmet";
import { env } from "./config/env";
import { errorHandler } from "./middlewares/errorHandler";
import { requireCsrfHeader } from "./middlewares/csrf";

// Importar rutas (Stubs)
import authRoutes from "./routes/auth.routes";
import empresasRoutes from "./routes/empresas.routes";
import informesRoutes from "./routes/informes.routes";
import planAccionRoutes from "./routes/planAccion.routes";
import capacitacionesRoutes from "./routes/capacitaciones.routes";
import eppRoutes from "./routes/epp.routes";
import adminRoutes from "./routes/admin.routes";
import dashboardRoutes from "./routes/dashboard.routes";
import plantillasRoutes from "./routes/plantillas.routes";
import capacitacionPlantillasRoutes from "./routes/capacitacion-plantillas.routes";
import enteRoutes from "./routes/ente.routes";
import archivoRoutes from "./routes/archivo.routes";

const app = express();
app.set("trust proxy", 1);

// Middlewares globales — CORS primero para que errores de body/parse no pierdan headers
function corsOriginsFor(frontendUrl: string): string[] {
  try {
    const u = new URL(frontendUrl);
    const origins = new Set<string>([u.origin]);
    // Aceptar www ↔ apex (Safari es estricto con Origin exacto)
    if (u.hostname.startsWith("www.")) {
      origins.add(`${u.protocol}//${u.hostname.slice(4)}`);
    } else if (u.hostname !== "localhost" && u.hostname !== "127.0.0.1") {
      origins.add(`${u.protocol}//www.${u.hostname}`);
    }
    return [...origins];
  } catch {
    return [frontendUrl];
  }
}

app.use(
  cors({
    origin: corsOriginsFor(env.FRONTEND_URL),
    credentials: true,
  }),
);
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" },
  }),
);
app.use(compression());
app.use(requireCsrfHeader);
// Límite alto: diapositivas con imágenes embebidas (base64) pueden superar 100kb
app.use(express.json({ limit: "15mb" }));
app.use(express.urlencoded({ extended: true, limit: "15mb" }));

// Endpoints de salud
app.get("/api/health", (req, res) => {
  res.status(200).json({ status: "ok", timestamp: new Date().toISOString() });
});

// Registrar rutas
app.use("/api/auth", authRoutes);
app.use("/api/empresas", empresasRoutes);
app.use("/api/informes", informesRoutes);
app.use("/api/plan-accion", planAccionRoutes);
app.use("/api/capacitaciones", capacitacionesRoutes);
app.use("/api/epp", eppRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/plantillas-declaracion", plantillasRoutes);
app.use("/api/capacitacion-plantillas", capacitacionPlantillasRoutes);
app.use("/api/ente", enteRoutes);
app.use("/api/archivo", archivoRoutes);

// Middleware de manejo de errores
app.use(errorHandler);

const PORT = parseInt(env.PORT, 10);

app.listen(PORT, () => {
  console.log(`🚀 Servidor backend escuchando en http://localhost:${PORT}`);
});
