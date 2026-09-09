import { supabaseAdmin } from "../config/supabase";
import { HttpError } from "../utils/httpError";
import { notificacionService } from "./notificacion.service";

export type EstadoPublicacionProveedorSugerido =
  | "pendiente"
  | "aprobada"
  | "rechazada";

type AuthUser = {
  id: string;
  rol: string;
  consultora_id?: string;
};

function requireAdmin(user: AuthUser) {
  if (user.rol !== "admin") {
    throw new HttpError(403, "Solo administradores de LT pueden gestionar esta lista");
  }
}

export const eppProveedoresSugeridosService = {
  async listar(
    user: AuthUser,
    opts: { estado_publicacion?: EstadoPublicacionProveedorSugerido | "todas" } = {},
  ) {
    let query = supabaseAdmin
      .from("epp_proveedores_sugeridos")
      .select("*")
      .order("created_at", { ascending: false });

    if (user.rol === "admin") {
      const estado = opts.estado_publicacion ?? "todas";
      if (estado !== "todas") {
        query = query.eq("estado_publicacion", estado);
      }
    } else {
      // Clientes / preventores solo ven publicados
      query = query.eq("estado_publicacion", "aprobada");
    }

    const { data, error } = await query;
    if (error) throw error;
    return { proveedores: data ?? [] };
  },

  async obtener(user: AuthUser, id: string) {
    const { data, error } = await supabaseAdmin
      .from("epp_proveedores_sugeridos")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new HttpError(404, "Proveedor sugerido no encontrado");

    if (
      user.rol !== "admin" &&
      data.estado_publicacion !== "aprobada" &&
      data.created_by !== user.id
    ) {
      throw new HttpError(403, "Este proveedor aún no está publicado");
    }
    return data;
  },

  async crear(
    user: AuthUser,
    payload: {
      nombre: string;
      email: string;
      direccion?: string | null;
      telefono?: string | null;
      notas?: string | null;
    },
  ) {
    const esAdmin = user.rol === "admin";
    if (!esAdmin && user.rol !== "preventor") {
      throw new HttpError(403, "No tenés permiso para sugerir proveedores LT");
    }

    const estado: EstadoPublicacionProveedorSugerido = esAdmin
      ? "aprobada"
      : "pendiente";

    const { data, error } = await supabaseAdmin
      .from("epp_proveedores_sugeridos")
      .insert({
        nombre: payload.nombre.trim(),
        email: payload.email.trim().toLowerCase(),
        direccion: payload.direccion?.trim() || null,
        telefono: payload.telefono?.trim() || null,
        notas: payload.notas?.trim() || null,
        estado_publicacion: estado,
        created_by: user.id,
        ...(esAdmin
          ? { aprobado_por: user.id, aprobado_at: new Date().toISOString() }
          : {}),
      })
      .select()
      .single();
    if (error) throw error;

    if (estado === "pendiente" && user.consultora_id) {
      void notificacionService
        .enviarAAdmins({
          consultora_id: user.consultora_id,
          tipo: "warning",
          titulo: "Proveedor LT pendiente",
          mensaje: `Hay un proveedor sugerido (“${data.nombre}”) esperando aprobación en Proveedores EPP LT.`,
        })
        .catch((err) =>
          console.error("No se pudo notificar proveedor sugerido pendiente:", err),
        );
    }

    return data;
  },

  async actualizar(
    user: AuthUser,
    id: string,
    payload: {
      nombre?: string;
      email?: string;
      direccion?: string | null;
      telefono?: string | null;
      notas?: string | null;
    },
  ) {
    requireAdmin(user);
    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if (payload.nombre !== undefined) updates.nombre = payload.nombre.trim();
    if (payload.email !== undefined) updates.email = payload.email.trim().toLowerCase();
    if (payload.direccion !== undefined) {
      updates.direccion = payload.direccion?.trim() || null;
    }
    if (payload.telefono !== undefined) {
      updates.telefono = payload.telefono?.trim() || null;
    }
    if (payload.notas !== undefined) updates.notas = payload.notas?.trim() || null;

    const { data, error } = await supabaseAdmin
      .from("epp_proveedores_sugeridos")
      .update(updates)
      .eq("id", id)
      .select()
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new HttpError(404, "Proveedor sugerido no encontrado");
    return data;
  },

  async cambiarPublicacion(
    user: AuthUser,
    id: string,
    payload: {
      estado: "aprobada" | "rechazada";
      rechazo_motivo?: string | null;
    },
  ) {
    requireAdmin(user);
    if (payload.estado === "rechazada" && !payload.rechazo_motivo?.trim()) {
      throw new HttpError(400, "Indicá el motivo del rechazo");
    }

    const updates: Record<string, unknown> = {
      estado_publicacion: payload.estado,
      updated_at: new Date().toISOString(),
    };
    if (payload.estado === "aprobada") {
      updates.aprobado_por = user.id;
      updates.aprobado_at = new Date().toISOString();
      updates.rechazo_motivo = null;
    } else {
      updates.rechazo_motivo = payload.rechazo_motivo?.trim() || null;
      updates.aprobado_por = null;
      updates.aprobado_at = null;
    }

    const { data, error } = await supabaseAdmin
      .from("epp_proveedores_sugeridos")
      .update(updates)
      .eq("id", id)
      .select()
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new HttpError(404, "Proveedor sugerido no encontrado");
    return data;
  },

  async eliminar(user: AuthUser, id: string) {
    requireAdmin(user);
    const { error } = await supabaseAdmin
      .from("epp_proveedores_sugeridos")
      .delete()
      .eq("id", id);
    if (error) throw error;
    return { success: true };
  },

  /**
   * Copia un proveedor publicado de LT a la agenda de la consultora
   * (o reutiliza si ya existe el mismo email).
   */
  async adoptar(user: AuthUser, sugeridoId: string) {
    if (!user.consultora_id) {
      throw new HttpError(400, "El usuario no tiene consultora asignada");
    }
    const sugerido = await this.obtener(user, sugeridoId);
    if (sugerido.estado_publicacion !== "aprobada") {
      throw new HttpError(400, "Solo se pueden adoptar proveedores publicados");
    }

    const email = String(sugerido.email).trim().toLowerCase();
    const { data: existente, error: existError } = await supabaseAdmin
      .from("epp_proveedores")
      .select("*")
      .eq("consultora_id", user.consultora_id)
      .ilike("email", email)
      .maybeSingle();
    if (existError) throw existError;

    if (existente) {
      if (!existente.activo) {
        const { data: reactivado, error: reactError } = await supabaseAdmin
          .from("epp_proveedores")
          .update({
            activo: true,
            nombre: sugerido.nombre,
            direccion: sugerido.direccion,
            telefono: sugerido.telefono,
          })
          .eq("id", existente.id)
          .select()
          .single();
        if (reactError) throw reactError;
        return { proveedor: reactivado, creado: false };
      }
      return { proveedor: existente, creado: false };
    }

    const { data: creado, error: createError } = await supabaseAdmin
      .from("epp_proveedores")
      .insert({
        consultora_id: user.consultora_id,
        nombre: sugerido.nombre,
        email,
        direccion: sugerido.direccion,
        telefono: sugerido.telefono,
        activo: true,
      })
      .select()
      .single();
    if (createError) throw createError;
    return { proveedor: creado, creado: true };
  },
};
