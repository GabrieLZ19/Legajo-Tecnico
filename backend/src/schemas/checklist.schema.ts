import { z } from "zod";

export const criticidadSchema = z.enum(["alta", "media", "baja"]);
export const calificacionSchema = z.enum(["bien", "regular", "mal"]);
export const ambitoPlantillaSchema = z.enum(["empresa", "global"]);

export const itemPlantillaSchema = z.object({
  texto: z.string().trim().min(1).max(500),
  criticidad: criticidadSchema,
  orden: z.number().int().positive().optional(),
});

export const crearPlantillaSchema = z.object({
  body: z.object({
    titulo: z.string().trim().min(1).max(300),
    tipo_equipo: z.string().trim().min(1).max(200),
    ambito: ambitoPlantillaSchema,
    empresa_id: z.string().uuid().optional().nullable(),
    publicar_directo: z.boolean().optional(),
    items: z.array(itemPlantillaSchema).min(1),
  }),
});

export const actualizarPlantillaSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({
    titulo: z.string().trim().min(1).max(300).optional(),
    tipo_equipo: z.string().trim().min(1).max(200).optional(),
    items: z.array(itemPlantillaSchema).min(1).optional(),
  }),
});

export const publicacionPlantillaSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({
    estado: z.enum(["aprobada", "rechazada"]),
    rechazo_motivo: z.string().trim().max(1000).optional().nullable(),
  }),
});

export const crearEquipoSchema = z.object({
  body: z.object({
    empresa_id: z.string().uuid(),
    nombre: z.string().trim().min(1).max(300),
    tipo_equipo: z.string().trim().min(1).max(200),
    codigo_interno: z.string().trim().max(100).optional().nullable(),
    ubicacion: z.string().trim().max(300).optional().nullable(),
    notas: z.string().trim().max(2000).optional().nullable(),
  }),
});

export const actualizarEquipoSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({
    nombre: z.string().trim().min(1).max(300).optional(),
    tipo_equipo: z.string().trim().min(1).max(200).optional(),
    codigo_interno: z.string().trim().max(100).optional().nullable(),
    ubicacion: z.string().trim().max(300).optional().nullable(),
    notas: z.string().trim().max(2000).optional().nullable(),
    activo: z.boolean().optional(),
  }),
});

export const itemInspeccionSchema = z.object({
  texto: z.string().trim().min(1).max(500),
  criticidad: criticidadSchema,
  calificacion: calificacionSchema,
  orden: z.number().int().positive().optional(),
});

export const accionInspeccionSchema = z.object({
  descripcion: z.string().trim().min(1).max(1000),
  responsable: z.string().trim().max(200).optional().nullable(),
  fecha_vencimiento: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .nullable(),
});

export const crearInspeccionSchema = z.object({
  body: z.object({
    empresa_id: z.string().uuid(),
    equipo_id: z.string().uuid(),
    plantilla_id: z.string().uuid().optional().nullable(),
    plantilla_titulo: z.string().trim().min(1).max(300),
    observaciones: z.string().trim().max(2000).optional().nullable(),
    inspector_nombre: z.string().trim().max(200).optional().nullable(),
    items: z.array(itemInspeccionSchema).min(1),
    acciones: z.array(accionInspeccionSchema).optional(),
  }),
});

export const crearInspeccionPublicaSchema = z.object({
  body: z.object({
    plantilla_id: z.string().uuid().optional().nullable(),
    plantilla_titulo: z.string().trim().min(1).max(300),
    observaciones: z.string().trim().max(2000).optional().nullable(),
    inspector_nombre: z.string().trim().min(1).max(200),
    items: z.array(itemInspeccionSchema).min(1),
    acciones: z.array(accionInspeccionSchema).optional(),
    /** UUID generado en el cliente; reintentos con la misma clave no duplican. */
    idempotency_key: z.string().uuid(),
  }),
});

export const actualizarAccionInspeccionSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({
    estado: z.enum(["pendiente", "en_curso", "cumplida"]),
  }),
});
