import { z } from 'zod';

export const loginSchema = z.object({
  body: z.object({
    cuit: z.string().min(1, 'CUIT es requerido'),
    username: z.string().min(1, 'Usuario es requerido'),
    password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres'),
  }),
});

export const loginAdminSchema = z.object({
  body: z.object({
    email: z.string().email('Email inválido'),
    password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres'),
  }),
});
