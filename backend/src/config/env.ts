import { z } from 'zod';
import dotenv from 'dotenv';

// Carga las variables desde el archivo .env si existe
dotenv.config();

const envSchema = z.object({
  PORT: z.string().default('4000'),
  SUPABASE_URL: z.string().url(),
  SUPABASE_PUBLISHABLE_KEY: z.string(),
  SUPABASE_SECRET_KEY: z.string(),
  SUPABASE_JWKS_URL: z.string().url(),
  FRONTEND_URL: z.string().url().default('http://localhost:3000'),
  /** Secret para job diario de avisos de vencimiento (header x-cron-secret). */
  CRON_SECRET: z.string().optional(),
  /** API key Resend para emails de vencimiento (opcional). */
  RESEND_API_KEY: z.string().optional(),
  /** Remitente verificado en Resend. */
  EMAIL_FROM: z.string().email().optional(),
});

const _env = envSchema.safeParse(process.env);

if (!_env.success) {
  console.error('❌ Error en variables de entorno:', _env.error.format());
  process.exit(1);
}

export const env = _env.data;
