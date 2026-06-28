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
});

const _env = envSchema.safeParse(process.env);

if (!_env.success) {
  console.error('❌ Error en variables de entorno:', _env.error.format());
  process.exit(1);
}

export const env = _env.data;
