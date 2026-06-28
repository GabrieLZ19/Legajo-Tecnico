import { createClient } from '@supabase/supabase-js';
import { env } from './env';

// Cliente de Supabase con Service Role (bypass RLS)
// Se usa para operaciones backend seguras (insertar usuarios, etc)
export const supabaseAdmin = createClient(
  env.SUPABASE_URL,
  env.SUPABASE_SECRET_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);
