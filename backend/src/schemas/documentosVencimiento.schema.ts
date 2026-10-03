import { z } from "zod";

export const categoriaDocumentoSchema = z.enum(["medicion", "art"]);

export const crearDocumentoSchema = z.object({
  body: z.object({
    empresa_id: z.string().uuid(),
    categoria: categoriaDocumentoSchema,
    titulo: z.string().trim().min(1).max(300),
    tipo: z
      .preprocess(
        (v) => (v === "" || v === undefined ? null : v),
        z.string().trim().min(1).max(120).nullable().optional(),
      )
      .optional(),
    fecha_vencimiento: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "fecha_vencimiento debe ser YYYY-MM-DD"),
    notas: z
      .preprocess(
        (v) => (v === "" || v === undefined ? null : v),
        z.string().trim().max(2000).nullable().optional(),
      )
      .optional(),
  }),
});

export const actualizarDocumentoSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
  }),
  body: z.object({
    titulo: z.string().trim().min(1).max(300).optional(),
    tipo: z.string().trim().min(1).max(120).optional().nullable(),
    fecha_vencimiento: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "fecha_vencimiento debe ser YYYY-MM-DD")
      .optional(),
    notas: z.string().trim().max(2000).optional().nullable(),
  }),
});
