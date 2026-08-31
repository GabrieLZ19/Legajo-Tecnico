import rateLimit from "express-rate-limit";

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "Demasiados intentos. Probá de nuevo en unos minutos." },
});

/** Cotizaciones EPP y acciones públicas puntuales (bajo volumen). */
export const publicActionLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 15,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "Demasiadas solicitudes. Probá de nuevo en unos minutos." },
});

/**
 * Lectura pública de capacitación (QR). Muchos usuarios comparten la misma IP
 * en planta (WiFi corporativo / datos móviles del operador).
 */
export const capacitacionPublicReadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: {
    error:
      "Hay muchas personas accediendo a la capacitación desde esta red. Esperá unos segundos y volvé a intentar.",
  },
});

/**
 * Envío de evaluación + firma. Debe soportar charlas presenciales (30–100+ personas).
 */
export const capacitacionPublicSubmitLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 200,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: {
    error:
      "No pudimos registrar tu firma porque hay muchas solicitudes simultáneas. Esperá 30 segundos y tocá «Confirmar Firma» de nuevo sin recargar la página.",
  },
});

/** Exportaciones CSV de base histórica (evita abuso de CPU/memoria). */
export const exportHistoricoLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: {
    error: "Demasiadas exportaciones seguidas. Esperá unos minutos e intentá de nuevo.",
  },
});
