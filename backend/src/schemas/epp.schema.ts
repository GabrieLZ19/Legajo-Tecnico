import { z } from "zod";

const uuid = z.string().uuid("ID inválido");

export const listarPorEmpresaQuerySchema = z.object({
  query: z.object({
    empresa_id: uuid,
  }),
});

export const crearEmpleadoSchema = z.object({
  body: z.object({
    empresa_id: uuid,
    nombre: z.string().min(3, "El nombre debe tener al menos 3 caracteres"),
    documento: z
      .string()
      .regex(/^\d{7,8}$/, "El DNI debe tener 7 u 8 números"),
    sector: z.string().optional().nullable(),
  }),
});

export const actualizarEmpleadoSchema = z.object({
  params: z.object({ id: uuid }),
  body: z.object({
    nombre: z.string().min(3).optional(),
    documento: z
      .string()
      .regex(/^\d{7,8}$/)
      .optional(),
    sector: z.string().optional().nullable(),
    activo: z.boolean().optional(),
  }),
});

export const tokenParamSchema = z.object({
  params: z.object({
    token: z.string().min(8),
  }),
});

export const idParamSchema = z.object({
  params: z.object({ id: uuid }),
});

export const crearTipoBodySchema = z.object({
  body: z.object({
    nombre: z.string().min(1, "El nombre del EPP es requerido"),
    descripcion: z.string().optional().nullable(),
  }),
});

export const actualizarTipoSchema = z.object({
  params: z.object({ id: uuid }),
  body: z.object({
    nombre: z.string().min(1).optional(),
    descripcion: z.string().optional().nullable(),
    activo: z.preprocess(
      (value) => {
        if (value === "true" || value === "1") return true;
        if (value === "false" || value === "0") return false;
        return value;
      },
      z.boolean().optional(),
    ),
  }),
});

export const registrarEntregaSchema = z.object({
  body: z.object({
    empresa_id: uuid,
    empleado_id: uuid.optional().nullable(),
    nombre_empleado: z.string().min(3),
    dni_empleado: z.string().regex(/^\d{7,8}$/),
    fecha_entrega: z.string().optional(),
    firma: z.string().min(1, "La firma del trabajador es requerida"),
    firma_empleador: z.string().optional().nullable(),
    items: z
      .array(
        z.object({
          epp_tipo_id: uuid,
          cantidad: z.coerce.number().int().positive().default(1),
          marca: z.string().optional().nullable(),
          modelo: z.string().optional().nullable(),
          certificacion: z.string().optional().nullable(),
        }),
      )
      .min(1, "Seleccioná al menos un EPP"),
  }),
});

export const crearProveedorSchema = z.object({
  body: z.object({
    nombre: z.string().min(2),
    email: z.string().email("Email de proveedor inválido"),
  }),
});

export const actualizarProveedorSchema = z.object({
  params: z.object({ id: uuid }),
  body: z.object({
    nombre: z.string().min(2).optional(),
    email: z.string().email().optional(),
    activo: z.boolean().optional(),
  }),
});

export const crearLicitacionSchema = z.object({
  body: z.object({
    empresa_id: uuid,
    titulo: z.string().min(3),
    descripcion: z.string().optional().nullable(),
    fecha_cierre: z.string().optional().nullable(),
    proveedor_ids: z.array(uuid).min(1, "Invitá al menos un proveedor"),
    items: z
      .array(
        z.object({
          epp_tipo_id: uuid,
          cantidad: z.coerce.number().int().positive(),
        }),
      )
      .min(1),
  }),
});

export const cotizarPublicoSchema = z.object({
  params: z.object({ token: z.string().uuid() }),
  body: z.object({
    proveedor_nombre: z.string().min(2).optional(),
    monto: z.coerce.number().positive("El monto debe ser mayor a 0"),
    items_ofertados: z
      .array(
        z.object({
          epp_tipo_id: uuid,
          cantidad: z.coerce.number().int().positive(),
          precio_unitario: z.coerce.number().nonnegative(),
        }),
      )
      .optional()
      .default([]),
  }),
});
