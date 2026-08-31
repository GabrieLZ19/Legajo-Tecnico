import { z } from 'zod';

export const crearAccionManualSchema = z.object({
  body: z.object({
    empresa_id: z.string().uuid('ID de empresa inválido'),
    descripcion: z.string().min(1, 'La descripción es requerida'),
    responsable: z.string().optional(),
    sector: z.string().optional(),
    visible_ente_regulador: z.boolean().optional(),
  }),
});

export const actualizarAccionSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
  }),
  body: z.object({
    estado: z.enum(['pendiente', 'cumplida', 'atendida']).optional(),
    visible_ente_regulador: z.boolean().optional(),
  }).refine(
    (data) => data.estado !== undefined || data.visible_ente_regulador !== undefined,
    { message: 'Debe enviar estado o visible_ente_regulador' },
  ),
});

export const visibilidadEnteSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
  }),
  body: z.object({
    visible_ente_regulador: z.boolean(),
  }),
});
