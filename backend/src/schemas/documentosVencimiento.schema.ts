import { z } from "zod";

export const categoriaDocumentoSchema = z.enum(["medicion", "art"]);

const fechaYmd = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "fecha_vencimiento debe ser YYYY-MM-DD");

function coerceBoolean(v: unknown): boolean {
  if (typeof v === "boolean") return v;
  if (typeof v === "string") {
    const s = v.trim().toLowerCase();
    if (s === "true" || s === "1" || s === "on") return true;
    if (s === "false" || s === "0" || s === "") return false;
  }
  return false;
}

export const crearDocumentoSchema = z.object({
  body: z
    .object({
      empresa_id: z.string().uuid(),
      categoria: categoriaDocumentoSchema,
      titulo: z.string().trim().min(1).max(300),
      tipo: z
        .preprocess(
          (v) => (v === "" || v === undefined ? null : v),
          z.string().trim().min(1).max(120).nullable().optional(),
        )
        .optional(),
      sin_vencimiento: z.preprocess(coerceBoolean, z.boolean()).optional(),
      fecha_vencimiento: z.preprocess(
        (v) => (v === "" || v === undefined || v === null ? null : v),
        fechaYmd.nullable().optional(),
      ),
      notas: z
        .preprocess(
          (v) => (v === "" || v === undefined ? null : v),
          z.string().trim().max(2000).nullable().optional(),
        )
        .optional(),
    })
    .superRefine((data, ctx) => {
      const sin = Boolean(data.sin_vencimiento);
      if (sin && data.fecha_vencimiento) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["fecha_vencimiento"],
          message: "No envíes fecha si marcás sin vencimiento",
        });
      }
      if (!sin && !data.fecha_vencimiento) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["fecha_vencimiento"],
          message: "fecha_vencimiento es requerida",
        });
      }
    }),
});

export const actualizarDocumentoSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
  }),
  body: z
    .object({
      titulo: z.string().trim().min(1).max(300).optional(),
      tipo: z.string().trim().min(1).max(120).optional().nullable(),
      sin_vencimiento: z.boolean().optional(),
      fecha_vencimiento: z.preprocess(
        (v) => (v === "" || v === undefined ? undefined : v === null ? null : v),
        fechaYmd.nullable().optional(),
      ),
      notas: z.string().trim().max(2000).optional().nullable(),
    })
    .superRefine((data, ctx) => {
      if (data.sin_vencimiento === true && data.fecha_vencimiento) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["fecha_vencimiento"],
          message: "No envíes fecha si marcás sin vencimiento",
        });
      }
      if (data.sin_vencimiento === false && data.fecha_vencimiento === null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["fecha_vencimiento"],
          message: "fecha_vencimiento es requerida",
        });
      }
    }),
});
