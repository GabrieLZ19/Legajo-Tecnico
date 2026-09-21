import { z } from "zod";

const uuid = z.string().uuid("ID inválido");

function telefonoOpcionalSchema(label = "teléfono") {
  return z.preprocess(
    (value) => {
      if (value == null) return null;
      if (typeof value !== "string") return value;
      const trimmed = value.trim();
      return trimmed.length === 0 ? null : trimmed;
    },
    z
      .string()
      .nullable()
      .refine(
        (v) => {
          if (v == null) return true;
          if (!/^[+\d]?[\d\s\-()]*$/.test(v)) return false;
          const digits = v.replace(/\D/g, "");
          return digits.length >= 6 && digits.length <= 15;
        },
        {
          message: `El ${label} solo admite números (y +, espacios o guiones), entre 6 y 15 dígitos`,
        },
      ),
  );
}

function telefonoRequeridoSchema(label = "teléfono") {
  return z
    .string()
    .trim()
    .min(6, `Indicá el ${label}`)
    .refine(
      (v) => {
        if (!/^[+\d]?[\d\s\-()]*$/.test(v)) return false;
        const digits = v.replace(/\D/g, "");
        return digits.length >= 6 && digits.length <= 15;
      },
      {
        message: `El ${label} solo admite números (y +, espacios o guiones), entre 6 y 15 dígitos`,
      },
    );
}

const nombreProveedorSchema = z
  .string()
  .trim()
  .min(2, "El nombre debe tener al menos 2 caracteres")
  .max(120)
  .regex(
    /^[\p{L}\p{N}][\p{L}\p{N}\s.'&\-/]*$/u,
    "El nombre contiene caracteres no válidos",
  );

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
    /** Descripción del puesto (Anexo I 299/11). */
    puesto: z.string().max(500).optional().nullable(),
    /** EPP necesarios según el puesto (Anexo I 299/11). */
    epp_necesarios: z.string().max(1000).optional().nullable(),
    /** Si true, copia epp_necesarios a todos los de la empresa con el mismo puesto. */
    aplicar_epp_por_puesto: z.boolean().optional().default(false),
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
    puesto: z.string().max(500).optional().nullable(),
    epp_necesarios: z.string().max(1000).optional().nullable(),
    activo: z.boolean().optional(),
    aplicar_epp_por_puesto: z.boolean().optional().default(false),
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

export const listarTiposQuerySchema = z.object({
  query: z.object({
    empresa_id: uuid,
    incluir_inactivos: z
      .preprocess((value) => value === "true" || value === "1" || value === true, z.boolean())
      .optional(),
  }),
});

export const crearTipoBodySchema = z.object({
  body: z.object({
    empresa_id: uuid,
    nombre: z.string().min(1, "El nombre del EPP es requerido"),
    descripcion: z.string().optional().nullable(),
    marca: z.string().optional().nullable(),
    modelo: z.string().optional().nullable(),
    certificacion: z.string().optional().nullable(),
  }),
});

export const actualizarTipoSchema = z.object({
  params: z.object({ id: uuid }),
  body: z.object({
    empresa_id: uuid,
    nombre: z.string().min(1).optional(),
    descripcion: z.string().optional().nullable(),
    marca: z.string().optional().nullable(),
    modelo: z.string().optional().nullable(),
    certificacion: z.string().optional().nullable(),
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
    empleado_id: uuid,
    nombre_empleado: z.string().min(3).optional(),
    dni_empleado: z
      .string()
      .regex(/^\d{7,8}$/)
      .optional(),
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
      .length(1, "Registrá un solo elemento por entrega"),
  }),
});

export const crearProveedorSchema = z.object({
  body: z.object({
    nombre: nombreProveedorSchema,
    email: z.string().trim().email("Email de proveedor inválido").max(160),
    direccion: z
      .string()
      .trim()
      .max(200, "La dirección es demasiado larga")
      .optional()
      .nullable()
      .transform((v) => {
        if (v == null) return null;
        const t = v.trim();
        return t.length === 0 ? null : t;
      }),
    telefono: telefonoOpcionalSchema("teléfono del proveedor"),
  }),
});

export const actualizarProveedorSchema = z.object({
  params: z.object({ id: uuid }),
  body: z.object({
    nombre: nombreProveedorSchema.optional(),
    email: z.string().trim().email("Email de proveedor inválido").max(160).optional(),
    direccion: z
      .string()
      .trim()
      .max(200, "La dirección es demasiado larga")
      .optional()
      .nullable()
      .transform((v) => {
        if (v == null) return null;
        const t = v.trim();
        return t.length === 0 ? null : t;
      }),
    telefono: telefonoOpcionalSchema("teléfono del proveedor"),
    activo: z.boolean().optional(),
  }),
});

export const crearLicitacionSchema = z.object({
  body: z.object({
    empresa_id: uuid,
    titulo: z.string().min(3),
    descripcion: z.string().optional().nullable(),
    fecha_cierre: z.string().optional().nullable(),
    comprador_nombre: z
      .string()
      .trim()
      .min(2, "Indicá el nombre del responsable de la compra")
      .max(120)
      .regex(
        /^[\p{L}\p{N}][\p{L}\p{N}\s.'&\-/]*$/u,
        "El nombre del comprador contiene caracteres no válidos",
      ),
    comprador_email: z.string().trim().email("Email del comprador inválido").max(160),
    comprador_telefono: telefonoRequeridoSchema("teléfono del comprador"),
    proveedor_ids: z.array(uuid).min(1, "Invitá al menos un proveedor"),
    items: z
      .array(
        z
          .object({
            epp_tipo_id: uuid.optional().nullable(),
            nombre_manual: z.string().min(2).optional().nullable(),
            cantidad: z.coerce.number().int().positive(),
          })
          .superRefine((item, ctx) => {
            const tieneTipo = Boolean(item.epp_tipo_id);
            const tieneManual = Boolean(item.nombre_manual?.trim());
            if (tieneTipo === tieneManual) {
              ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: "Cada ítem debe ser del catálogo o manual, no ambos ni ninguno",
              });
            }
          }),
      )
      .min(1, "Agregá al menos un EPP a cotizar"),
  }),
});

export const agregarProveedorLicitacionSchema = z.object({
  params: z.object({ id: uuid }),
  body: z.object({
    proveedor_id: uuid,
  }),
});

export const actualizarEstadoLicitacionSchema = z.object({
  params: z.object({ id: uuid }),
  body: z.object({
    estado: z.enum(["abierta", "adjudicacion", "cerrada"]),
    ganador_cotizacion_id: uuid.optional().nullable(),
  }),
});

export const cotizarPublicoSchema = z.object({
  params: z.object({ token: z.string().uuid() }),
  body: z.object({
    proveedor_nombre: z.string().min(2).optional(),
    monto: z.coerce.number().positive("El monto debe ser mayor a 0"),
    items_ofertados: z.preprocess((value) => {
      if (typeof value === "string") {
        try {
          return JSON.parse(value);
        } catch {
          return value;
        }
      }
      return value;
    }, z
      .array(
        z.object({
          epp_tipo_id: uuid.optional().nullable(),
          nombre: z.string().optional().nullable(),
          cantidad: z.coerce.number().int().positive(),
          precio_unitario: z.coerce.number().nonnegative(),
        }),
      )
      .optional()
      .default([])),
  }),
});

export const empresaIdQuerySchema = z.object({
  query: z.object({
    empresa_id: uuid,
  }),
});

export const buscarEmpleadoEntregaPublicaSchema = z.object({
  params: z.object({ token: z.string().uuid() }),
  query: z.object({
    dni: z
      .string()
      .regex(/^\d{7,8}$/, "El DNI debe tener 7 u 8 números"),
  }),
});

const entregaPublicaItemSchema = z.object({
  epp_tipo_id: uuid,
  cantidad: z.coerce.number().int().positive().default(1),
  marca: z.string().optional().nullable(),
  modelo: z.string().optional().nullable(),
  certificacion: z.string().optional().nullable(),
});

export const registrarEntregaPublicaSchema = z.object({
  params: z.object({ token: z.string().uuid() }),
  body: z.object({
    nombre_empleado: z.string().min(3, "El nombre debe tener al menos 3 caracteres"),
    dni_empleado: z
      .string()
      .regex(/^\d{7,8}$/, "El DNI debe tener 7 u 8 números"),
    puesto: z
      .string()
      .trim()
      .min(2, "El puesto de trabajo es obligatorio (Anexo I)")
      .max(500),
    sector: z.string().optional().nullable(),
    items: z.preprocess((value) => {
      if (typeof value === "string") {
        try {
          return JSON.parse(value) as unknown;
        } catch {
          return value;
        }
      }
      return value;
    }, z
      .array(entregaPublicaItemSchema)
      .min(1, "Seleccioná al menos un EPP")
      .max(20, "Máximo 20 ítems por entrega")),
    firma: z.string().min(1, "La firma del trabajador es requerida"),
  }),
});

export const listarProveedoresSugeridosSchema = z.object({
  query: z.object({
    estado_publicacion: z
      .enum(["pendiente", "aprobada", "rechazada", "todas"])
      .optional()
      .default("todas"),
  }),
});

export const crearProveedorSugeridoSchema = z.object({
  body: z.object({
    nombre: nombreProveedorSchema,
    email: z.string().trim().email("Email de proveedor inválido").max(160),
    direccion: z
      .string()
      .trim()
      .max(200)
      .optional()
      .nullable()
      .transform((v) => {
        if (v == null) return null;
        const t = v.trim();
        return t.length === 0 ? null : t;
      }),
    telefono: telefonoOpcionalSchema("teléfono del proveedor"),
    notas: z
      .string()
      .trim()
      .max(500)
      .optional()
      .nullable()
      .transform((v) => {
        if (v == null) return null;
        const t = v.trim();
        return t.length === 0 ? null : t;
      }),
  }),
});

export const actualizarProveedorSugeridoSchema = z.object({
  params: z.object({ id: uuid }),
  body: z.object({
    nombre: nombreProveedorSchema.optional(),
    email: z.string().trim().email("Email de proveedor inválido").max(160).optional(),
    direccion: z
      .string()
      .trim()
      .max(200)
      .optional()
      .nullable()
      .transform((v) => {
        if (v == null) return null;
        const t = v.trim();
        return t.length === 0 ? null : t;
      }),
    telefono: telefonoOpcionalSchema("teléfono del proveedor"),
    notas: z
      .string()
      .trim()
      .max(500)
      .optional()
      .nullable()
      .transform((v) => {
        if (v == null) return null;
        const t = v.trim();
        return t.length === 0 ? null : t;
      }),
  }),
});

export const publicacionProveedorSugeridoSchema = z.object({
  params: z.object({ id: uuid }),
  body: z.object({
    estado: z.enum(["aprobada", "rechazada"]),
    rechazo_motivo: z.string().trim().max(400).optional().nullable(),
  }),
});

export const adoptarProveedorSugeridoSchema = z.object({
  params: z.object({ id: uuid }),
});
