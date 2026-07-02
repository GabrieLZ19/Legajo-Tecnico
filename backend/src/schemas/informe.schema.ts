import { z } from 'zod';

export const crearInformeSchema = z.object({
  body: z.object({
    empresa_id: z.string().uuid('ID de empresa inválido'),
    actividad: z.string().optional(),
    fecha_hora_visita: z.string().datetime({ message: 'Fecha inválida. Debe ser ISO 8601' }),
    lugar_visita: z.string().optional(),
    contacto_visita: z.string().optional(),
    declaracion_legal: z.string().optional(),
    observaciones: z.string().optional(),
    peligros: z.array(
      z.object({
        descripcion: z.string().min(1, 'La descripción del peligro es requerida'),
        medida_control: z.string().optional(),
      })
    ).optional(),
    puntos_mejora: z.array(
      z.object({
        detalle: z.string().min(1, 'El detalle del punto de mejora es requerido'),
        acciones: z.array(
          z.object({
            descripcion: z.string().min(1, 'La descripción de la acción es requerida'),
          })
        ).optional(),
      })
    ).optional(),
  }),
});

export const editarInformeSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
  }),
  body: z.object({
    actividad: z.string().optional(),
    fecha_hora_visita: z.string().optional(),
    lugar_visita: z.string().optional(),
    contacto_visita: z.string().optional(),
    declaracion_legal: z.string().optional(),
    observaciones: z.string().optional(),
    puntos_mejora: z.array(
      z.object({
        id: z.string().uuid().optional(),
        detalle: z.string().min(1, 'El detalle del punto de mejora es requerido'),
        evidencia_url: z.string().optional(),
        acciones: z.array(
          z.object({
            id: z.string().uuid().optional(),
            descripcion: z.string().min(1, 'La descripción de la acción es requerida'),
          })
        ).optional(),
      })
    ).optional(),
  }),
});

export const subirEvidenciaSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
  }),
  // El body se maneja con multer, pero validamos que se envíe el punto_mejora_id
  body: z.object({
    punto_mejora_id: z.string().uuid('ID de punto de mejora inválido').optional(),
  }),
});

export const firmaSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
  }),
  body: z.object({
    firma_base64: z.string().min(1, 'La firma es requerida'),
  }),
});
