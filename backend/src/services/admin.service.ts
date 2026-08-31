import { createPasswordAuthClient, supabaseAdmin } from "../config/supabase";
import { logService } from "./log.service";
import { notificacionService } from "./notificacion.service";
import { storageService } from "./storage.service";
import { HttpError } from "../utils/httpError";
import { RolUsuario, EstadoEmpresa } from "../types/database";

const ROLES_CREABLES: RolUsuario[] = ["dueno", "preventor", "ente_regulador"];
const ESTADOS_EMPRESA: EstadoEmpresa[] = [
  "activa",
  "aviso_deuda",
  "pausada",
  "eliminada",
];

export const adminService = {
  async listarUsuarios(consultoraId: string) {
    const { data, error } = await supabaseAdmin
      .from("perfiles")
      .select("*, preventor_empresas(empresa_id, empresas(razon_social))")
      .eq("consultora_id", consultoraId);

    if (error) throw error;
    return data;
  },

  async crearUsuario(
    usuarioCreadorId: string,
    consultoraIdToken: string | undefined,
    userData: {
      email: string;
      password?: string;
      username: string;
      nombre_completo: string;
      rol: string;
      empresa_id?: string;
    }
  ) {
    const { email, password, username, nombre_completo, rol, empresa_id } = userData;
    if (!consultoraIdToken) {
      throw new HttpError(403, "El usuario no tiene consultora asignada");
    }
    if (!ROLES_CREABLES.includes(rol as RolUsuario)) {
      throw new HttpError(
        400,
        "Rol inválido. Solo se pueden crear dueño, preventor o ente regulador.",
      );
    }
    const consultora_id = consultoraIdToken;

    let finalEmail = email;

    // Si el rol es dueño, obligatoriamente el email en Supabase Auth debe ser el proxy: username@cuit.legajo.local
    if (rol === "dueno" && empresa_id) {
      const { data: emp } = await supabaseAdmin
        .from("empresas")
        .select("cuit")
        .eq("id", empresa_id)
        .single();
      
      if (emp?.cuit) {
        const cleanCuit = emp.cuit.replace(/\D/g, "");
        finalEmail = `${username}@${cleanCuit}.legajo.local`;
      }
    }

    // 1. Crear usuario en Supabase Auth con metadatos completos para el trigger DB
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: finalEmail,
      password,
      email_confirm: true,
      user_metadata: {
        username,
        nombre_completo,
        rol,
        empresa_id: rol === "dueno" ? empresa_id : undefined,
        consultora_id,
      },
    });

    if (authError) throw authError;

    // 2. Insertar o actualizar (upsert) la fila en perfiles (combina con la acción del trigger)
    const { data: perfilData, error: perfilError } = await supabaseAdmin
      .from("perfiles")
      .upsert({
        id: authData.user.id,
        consultora_id,
        empresa_id: rol === "dueno" ? empresa_id : null,
        nombre_completo,
        username,
        rol,
        activo: true,
      })
      .select()
      .single();

    if (perfilError) {
      // Rollback auth user
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
      throw perfilError;
    }

    await logService.registrar({
      usuario_id: usuarioCreadorId,
      accion: "CREAR_USUARIO",
      entidad: "perfiles",
      entidad_id: perfilData.id,
      detalles: { username, rol, nombre_completo },
      consultora_id: consultora_id,
    });

    return perfilData;
  },

  async editarUsuario(
    usuarioEditorId: string,
    consultoraId: string,
    id: string,
    userData: {
      nombre_completo: string;
      username: string;
      rol: string;
      activo: boolean;
      empresa_id?: string;
      permisos_personalizados?: unknown;
    }
  ) {
    const { nombre_completo, username, rol, activo, empresa_id, permisos_personalizados } = userData;

    const { data: actual, error: errActual } = await supabaseAdmin
      .from("perfiles")
      .select("rol")
      .eq("id", id)
      .eq("consultora_id", consultoraId)
      .maybeSingle();

    if (errActual) throw errActual;
    if (!actual) throw new HttpError(404, "Usuario no encontrado");

    const rolPermitido =
      ROLES_CREABLES.includes(rol as RolUsuario) ||
      (rol === "admin" && actual.rol === "admin");
    if (!rolPermitido) {
      throw new HttpError(
        400,
        "Rol inválido. No se puede asignar ese rol desde el panel.",
      );
    }

    const updatePayload: Record<string, unknown> = {
      nombre_completo,
      username,
      rol,
      activo,
      empresa_id: rol === "dueno" ? empresa_id : null,
    };

    // Solo tocar permisos cuando el cliente los envía (evita borrarlos en ediciones parciales)
    if (permisos_personalizados !== undefined) {
      updatePayload.permisos_personalizados = permisos_personalizados;
    }

    const { data, error } = await supabaseAdmin
      .from("perfiles")
      .update(updatePayload)
      .eq("id", id)
      .eq("consultora_id", consultoraId)
      .select()
      .single();

    if (error) throw error;

    await logService.registrar({
      usuario_id: usuarioEditorId,
      accion: "EDITAR_USUARIO",
      entidad: "perfiles",
      entidad_id: id,
      detalles: {
        activo,
        rol,
        nombre_completo,
        username,
        ...(permisos_personalizados !== undefined
          ? { permisos_personalizados: true }
          : {}),
      },
      consultora_id: consultoraId,
    });

    return data;
  },

  async listarEmpresas(consultoraId: string) {
    const { data, error } = await supabaseAdmin
      .from("empresas")
      .select(
        "*, consultoras(*), informes_visita(id), preventor_empresas(preventor_id, perfiles(nombre_completo)), perfiles!perfiles_empresa_id_fkey(id, nombre_completo, username, activo, rol)",
      )
      .eq("consultora_id", consultoraId)
      .order("razon_social");

    if (error) throw error;
    return data;
  },

  async crearEmpresa(
    usuarioCreadorId: string,
    consultoraIdToken: string | undefined,
    empresaData: {
      cuit: string;
      razon_social: string;
      actividad?: string;
      domicilio?: string;
      localidad?: string;
      codigo_postal?: string;
      provincia?: string;
      telefono?: string;
      contacto?: string;
    }
  ) {
    const { cuit, razon_social, actividad, domicilio, localidad, codigo_postal, provincia, telefono, contacto } = empresaData;
    if (!consultoraIdToken) {
      throw new HttpError(403, "El usuario no tiene consultora asignada");
    }
    const consultora_id = consultoraIdToken;

    const { data, error } = await supabaseAdmin
      .from("empresas")
      .insert({
        consultora_id,
        cuit,
        razon_social,
        actividad,
        domicilio,
        localidad,
        codigo_postal,
        provincia,
        telefono,
        contacto,
        porcentaje_cumplimiento: 100,
      })
      .select("*, consultoras(*)")
      .single();

    if (error) throw error;

    await logService.registrar({
      usuario_id: usuarioCreadorId,
      accion: "CREAR_EMPRESA",
      entidad: "empresas",
      entidad_id: data.id,
      detalles: { razon_social, cuit },
      consultora_id: consultora_id,
    });

    return data;
  },

  async editarEmpresa(
    usuarioEditorId: string,
    consultoraId: string,
    id: string,
    empresaData: {
      cuit: string;
      razon_social: string;
      actividad?: string;
      domicilio?: string;
      localidad?: string;
      codigo_postal?: string;
      provincia?: string;
      telefono?: string;
      contacto?: string;
    }
  ) {
    const { cuit, razon_social, actividad, domicilio, localidad, codigo_postal, provincia, telefono, contacto } = empresaData;

    // Obtener CUIT anterior antes de actualizar
    const { data: oldEmpresa } = await supabaseAdmin
      .from("empresas")
      .select("cuit")
      .eq("id", id)
      .single();

    const { data, error } = await supabaseAdmin
      .from("empresas")
      .update({
        cuit,
        razon_social,
        actividad,
        domicilio,
        localidad,
        codigo_postal,
        provincia,
        telefono,
        contacto,
      })
      .eq("id", id)
      .eq("consultora_id", consultoraId)
      .select("*, consultoras(*)")
      .single();

    if (error) throw error;

    // Actualizar emails en Supabase Auth de todos los perfiles asociados al cambiar el CUIT (dueño, preventor, etc)
    try {
      const cleanNewCuit = cuit.replace(/\D/g, "");
      const cleanOldCuit = oldEmpresa?.cuit?.replace(/\D/g, "");

      if (cleanOldCuit && cleanOldCuit !== cleanNewCuit) {
        const { data: authUsers } = await supabaseAdmin.auth.admin.listUsers({
          perPage: 1000,
        });
        if (authUsers?.users) {
          for (const user of authUsers.users) {
            if (user.email && user.email.endsWith(`@${cleanOldCuit}.legajo.local`)) {
              const username = user.email.split("@")[0];
              const newEmail = `${username}@${cleanNewCuit}.legajo.local`;
              await supabaseAdmin.auth.admin.updateUserById(user.id, {
                email: newEmail,
              });
            }
          }
        }
      }
    } catch (authUpdateErr) {
      console.error("Error al actualizar emails de usuarios por cambio de CUIT:", authUpdateErr);
    }

    await logService.registrar({
      usuario_id: usuarioEditorId,
      accion: "EDITAR_EMPRESA",
      entidad: "empresas",
      entidad_id: id,
      detalles: { razon_social, cuit },
      consultora_id: consultoraId,
    });

    return data;
  },

  /**
   * Verifica la contraseña de un usuario Auth por su id (sin afectar la sesión del admin).
   */
  async assertPasswordDeUsuario(
    userId: string,
    password: string,
    messages?: { missing?: string; invalid?: string },
  ) {
    if (!password?.trim()) {
      throw new HttpError(
        400,
        messages?.missing || "Ingresá tu contraseña de administrador",
      );
    }

    const { data: authUser, error: authLookupError } =
      await supabaseAdmin.auth.admin.getUserById(userId);
    if (authLookupError || !authUser.user?.email) {
      throw new HttpError(404, "Usuario no encontrado");
    }

    const { error: signInError } =
      await createPasswordAuthClient().auth.signInWithPassword({
        email: authUser.user.email,
        password,
      });

    if (signInError) {
      throw new HttpError(
        400,
        messages?.invalid || "Tu contraseña de administrador no es correcta",
      );
    }

    return authUser.user;
  },

  async assertPasswordActualUsuario(
    consultoraId: string,
    userId: string,
    currentPassword: string,
  ) {
    const { data: perfil } = await supabaseAdmin
      .from("perfiles")
      .select("id, username, rol, consultora_id, nombre_completo")
      .eq("id", userId)
      .eq("consultora_id", consultoraId)
      .maybeSingle();

    if (!perfil) {
      throw new HttpError(404, "Usuario no encontrado");
    }

    await this.assertPasswordDeUsuario(userId, currentPassword, {
      missing: "Ingresá la contraseña actual",
      invalid: "La contraseña actual no es correcta",
    });
    return perfil;
  },

  async resetPasswordUsuario(
    usuarioEditorId: string,
    consultoraId: string,
    userId: string,
    password: string,
    adminPassword: string,
  ) {
    if (!password || password.length < 6) {
      throw new HttpError(400, "La contraseña debe tener al menos 6 caracteres");
    }

    // El admin confirma identidad con SU propia contraseña
    await this.assertPasswordDeUsuario(usuarioEditorId, adminPassword);

    const { data: perfil, error } = await supabaseAdmin
      .from("perfiles")
      .select("id, username, rol, consultora_id, nombre_completo")
      .eq("id", userId)
      .eq("consultora_id", consultoraId)
      .maybeSingle();
    if (error) throw error;
    if (!perfil) throw new HttpError(404, "Usuario no encontrado");

    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      userId,
      { password },
    );
    if (updateError) throw updateError;

    await logService.registrar({
      usuario_id: usuarioEditorId,
      accion: "RESET_PASSWORD_USUARIO",
      entidad: "perfiles",
      entidad_id: userId,
      detalles: {
        username: perfil.username,
        rol: perfil.rol,
        nombre_completo: perfil.nombre_completo,
        confirmed_by_admin_password: true,
      },
      consultora_id: consultoraId,
    });

    return { success: true };
  },

  async cambiarEstadoEmpresa(
    usuarioId: string,
    consultoraId: string,
    id: string,
    estado: EstadoEmpresa,
  ) {
    if (!ESTADOS_EMPRESA.includes(estado)) {
      throw new HttpError(400, "Estado de empresa inválido");
    }

    const { data, error } = await supabaseAdmin
      .from("empresas")
      .update({ estado })
      .eq("id", id)
      .eq("consultora_id", consultoraId)
      .select("*, consultoras(*)")
      .single();

    if (error) throw error;
    if (!data) throw new HttpError(404, "Empresa no encontrada");

    await logService.registrar({
      usuario_id: usuarioId,
      accion:
        estado === "pausada"
          ? "PAUSAR_EMPRESA"
          : estado === "eliminada"
            ? "ELIMINAR_EMPRESA"
            : estado === "aviso_deuda"
              ? "AVISO_DEUDA_EMPRESA"
              : "REACTIVAR_EMPRESA",
      entidad: "empresas",
      entidad_id: id,
      detalles: { estado, razon_social: data.razon_social, cuit: data.cuit },
      consultora_id: consultoraId,
    });

    return data;
  },

  async obtenerDashboardGlobal(
    consultoraId: string,
    filters: { empresaId?: string; fechaDesde?: string; fechaHasta?: string }
  ) {
    const { empresaId, fechaDesde, fechaHasta } = filters;

    // 1. Total empresas
    let totalEmpresas = 0;
    if (empresaId) {
      totalEmpresas = 1;
    } else {
      const { count: countEmp, error: errEmp } = await supabaseAdmin
        .from("empresas")
        .select("*", { count: "exact", head: true })
        .eq("consultora_id", consultoraId)
        .in("estado", ["activa", "aviso_deuda"]);
      if (errEmp) throw errEmp;
      totalEmpresas = countEmp || 0;
    }

    // 2. Total preventores
    let totalPreventores = 0;
    if (empresaId) {
      const { count: countPrev, error: errPrev } = await supabaseAdmin
        .from("preventor_empresas")
        .select("*", { count: "exact", head: true })
        .eq("empresa_id", empresaId);
      if (errPrev) throw errPrev;
      totalPreventores = countPrev || 0;
    } else {
      const { count: countPrev, error: errPrev } = await supabaseAdmin
        .from("perfiles")
        .select("*", { count: "exact", head: true })
        .eq("consultora_id", consultoraId)
        .eq("rol", "preventor");
      if (errPrev) throw errPrev;
      totalPreventores = countPrev || 0;
    }

    // 3. Informes totales
    let informesQuery = supabaseAdmin
      .from("informes_visita")
      .select("id, estado_firma, empresa_id, fecha_hora_visita");
    if (empresaId) {
      informesQuery = informesQuery.eq("empresa_id", empresaId);
    } else {
      const { data: consultoraEmpresas } = await supabaseAdmin
        .from("empresas")
        .select("id")
        .eq("consultora_id", consultoraId);
      const empresaIds = consultoraEmpresas?.map((e) => e.id) || [];
      informesQuery = informesQuery.in("empresa_id", empresaIds);
    }

    if (fechaDesde) {
      informesQuery = informesQuery.gte("fecha_hora_visita", fechaDesde);
    } else {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      informesQuery = informesQuery.gte("fecha_hora_visita", startOfMonth);
    }
    if (fechaHasta) {
      informesQuery = informesQuery.lte("fecha_hora_visita", fechaHasta);
    }

    const { data: informes, error: errInf } = await informesQuery;
    if (errInf) throw errInf;

    const totalInformes = informes?.length || 0;
    const firmados = informes?.filter((i) => i.estado_firma === "firmado").length || 0;
    const pendientes = totalInformes - firmados;

    // 4. Cumplimiento global promedio
    let cumplimientoPromedio = 100;
    if (empresaId) {
      const { data: empData, error: errCump } = await supabaseAdmin
        .from("empresas")
        .select("porcentaje_cumplimiento")
        .eq("id", empresaId)
        .single();
      if (errCump) throw errCump;
      cumplimientoPromedio = Math.round(Number(empData?.porcentaje_cumplimiento || 100));
    } else {
      const { data: cumplimientoData, error: errCump } = await supabaseAdmin
        .from("empresas")
        .select("porcentaje_cumplimiento")
        .eq("consultora_id", consultoraId);
      if (errCump) throw errCump;

      const validCump = cumplimientoData?.map((c) => Number(c.porcentaje_cumplimiento || 0)) || [];
      cumplimientoPromedio =
        validCump.length > 0
          ? Math.round(validCump.reduce((acc, curr) => acc + curr, 0) / validCump.length)
          : 100;
    }

    // 5. Total capacitaciones
    let capQuery = supabaseAdmin.from("capacitaciones").select("*", { count: "exact", head: true });
    if (empresaId) {
      capQuery = capQuery.eq("empresa_id", empresaId);
    } else {
      const { data: consultoraEmpresas } = await supabaseAdmin
        .from("empresas")
        .select("id")
        .eq("consultora_id", consultoraId);
      const empresaIds = consultoraEmpresas?.map((e) => e.id) || [];
      capQuery = capQuery.in("empresa_id", empresaIds);
    }

    if (fechaDesde) {
      capQuery = capQuery.gte("fecha", fechaDesde);
    }
    if (fechaHasta) {
      capQuery = capQuery.lte("fecha", fechaHasta);
    }

    const { count: totalCapacitaciones } = await capQuery;

    // 6. Total entregas EPP
    let eppQuery = supabaseAdmin.from("epp_entregas").select("*", { count: "exact", head: true });
    if (empresaId) {
      eppQuery = eppQuery.eq("empresa_id", empresaId);
    } else {
      const { data: consultoraEmpresas } = await supabaseAdmin
        .from("empresas")
        .select("id")
        .eq("consultora_id", consultoraId);
      const empresaIds = consultoraEmpresas?.map((e) => e.id) || [];
      eppQuery = eppQuery.in("empresa_id", empresaIds);
    }

    if (fechaDesde) {
      eppQuery = eppQuery.gte("entregado_at", fechaDesde);
    }
    if (fechaHasta) {
      eppQuery = eppQuery.lte("entregado_at", fechaHasta);
    }

    const { count: totalEntregasEpp } = await eppQuery;

    // 7. Observaciones abiertas
    let obsQuery = supabaseAdmin
      .from("acciones_mejora")
      .select("*", { count: "exact", head: true })
      .eq("estado", "pendiente");
    if (empresaId) {
      obsQuery = obsQuery.eq("empresa_id", empresaId);
    } else {
      const { data: consultoraEmpresas } = await supabaseAdmin
        .from("empresas")
        .select("id")
        .eq("consultora_id", consultoraId);
      const empresaIds = consultoraEmpresas?.map((e) => e.id) || [];
      obsQuery = obsQuery.in("empresa_id", empresaIds);
    }
    const { count: observacionesAbiertas } = await obsQuery;

    return {
      totalEmpresas,
      totalPreventores,
      totalInformes,
      informesFirmados: firmados,
      informesPendientes: pendientes,
      cumplimientoGlobal: cumplimientoPromedio,
      totalCapacitaciones: totalCapacitaciones || 0,
      totalEntregasEpp: totalEntregasEpp || 0,
      observacionesAbiertas: observacionesAbiertas || 0,
    };
  },

  async asignarEmpresaAPreventor(preventor_id: string, empresa_id: string) {
    const { error } = await supabaseAdmin.from("preventor_empresas").insert({ preventor_id, empresa_id });
    if (error) throw error;
    return true;
  },

  async desasignarEmpresaAPreventor(preventor_id: string, empresa_id: string) {
    const { error } = await supabaseAdmin
      .from("preventor_empresas")
      .delete()
      .eq("preventor_id", preventor_id)
      .eq("empresa_id", empresa_id);

    if (error) throw error;
    return true;
  },

  async obtenerConsultora(consultoraId: string) {
    const { data, error } = await supabaseAdmin
      .from("consultoras")
      .select("*")
      .eq("id", consultoraId)
      .single();

    if (error) throw error;
    return data;
  },

  async actualizarConsultora(
    usuarioId: string,
    consultoraId: string,
    payload: {
      nombre?: string;
      cuit?: string;
      comision_epp_porcentaje?: number;
    }
  ) {
    const actual = await this.obtenerConsultora(consultoraId);
    const currentConfig =
      actual?.config && typeof actual.config === "object" ? (actual.config as Record<string, unknown>) : {};

    const nextConfig = {
      ...currentConfig,
      ...(payload.cuit !== undefined ? { cuit: payload.cuit } : {}),
      ...(payload.comision_epp_porcentaje !== undefined
        ? { comision_epp_porcentaje: payload.comision_epp_porcentaje }
        : {}),
    };

    const updates: Record<string, unknown> = { config: nextConfig };
    if (payload.nombre !== undefined) updates.nombre = payload.nombre;

    const { data, error } = await supabaseAdmin
      .from("consultoras")
      .update(updates)
      .eq("id", consultoraId)
      .select()
      .single();

    if (error) throw error;

    await logService.registrar({
      usuario_id: usuarioId,
      accion: "ACTUALIZAR_CONFIGURACION",
      entidad: "consultoras",
      entidad_id: consultoraId,
      detalles: payload,
      consultora_id: consultoraId,
    });

    return data;
  },

  async listarLogs(consultoraId: string) {
    return await logService.listarPorConsultora(consultoraId);
  },

  async enviarNotificacion(
    usuarioId: string,
    consultoraId: string,
    titulo: string,
    mensaje: string,
    tipo: string
  ) {
    const notificacion = await notificacionService.enviarGlobal({
      titulo,
      mensaje,
      tipo,
      consultora_id: consultoraId,
    });

    await logService.registrar({
      usuario_id: usuarioId,
      accion: "ENVIAR_NOTIFICACION",
      entidad: "notificaciones",
      entidad_id: notificacion.id,
      detalles: { titulo, tipo },
      consultora_id: consultoraId,
    });

    return notificacion;
  },

  async listarMisNotificaciones(usuarioId: string, consultoraId: string) {
    return await notificacionService.listarPorUsuario(usuarioId, consultoraId);
  },

  async marcarNotificacionLeida(notificacionId: string, usuarioId: string) {
    await notificacionService.marcarComoLeida(notificacionId, usuarioId);
    return { ok: true };
  },

  async marcarTodasNotificacionesLeidas(usuarioId: string, consultoraId: string) {
    return await notificacionService.marcarTodasLeidas(usuarioId, consultoraId);
  },

  async subirLogoConsultora(consultoraId: string, file: Express.Multer.File) {
    const ext = file.originalname.split(".").pop();
    const path = `${consultoraId}/logo_${Date.now()}.${ext}`;

    await storageService.subirArchivo("logos_consultora", path, file);
    const logoUrl = storageService.obtenerUrlPublica("logos_consultora", path);

    const { error: dbError } = await supabaseAdmin
      .from("consultoras")
      .update({ logo_url: logoUrl })
      .eq("id", consultoraId);

    if (dbError) {
      await storageService.eliminarArchivo("logos_consultora", path);
      throw dbError;
    }

    return logoUrl;
  },

  async subirLogoEmpresa(consultoraId: string, empresaId: string, file: Express.Multer.File) {
    const ext = file.originalname.split(".").pop();
    const path = `${empresaId}/logo_${Date.now()}.${ext}`;

    await storageService.subirArchivo("logos_empresa", path, file);
    const logoUrl = storageService.obtenerUrlPublica("logos_empresa", path);

    const { error: dbError } = await supabaseAdmin
      .from("empresas")
      .update({ logo_url: logoUrl })
      .eq("id", empresaId)
      .eq("consultora_id", consultoraId);

    if (dbError) {
      await storageService.eliminarArchivo("logos_empresa", path);
      throw dbError;
    }

    return logoUrl;
  },

  async buscarCuit(cuit: string) {
    const cleanCuit = cuit.replace(/\D/g, "");
    if (cleanCuit.length !== 11) {
      throw new Error("CUIT debe tener 11 dígitos");
    }

    const response = await fetch(`https://soa.afip.gob.ar/sr-padron/v1/persona/${cleanCuit}`);
    if (!response.ok) {
      throw new Error("Error al conectar con el padrón de AFIP");
    }

    const json = (await response.json()) as any;
    if (!json || !json.data) {
      throw new Error("CUIT no encontrado en el padrón de AFIP");
    }

    const { nombre, domicilioFiscal, idPersona } = json.data;
    const address = domicilioFiscal?.direccion || "";
    const local = domicilioFiscal?.localidad || "";
    const cp = domicilioFiscal?.codPostal || "";

    return {
      razon_social: nombre || "",
      cuit: String(idPersona || cleanCuit),
      domicilio: address,
      localidad: local,
      codigo_postal: String(cp),
      telefono: "",
      contacto: "",
    };
  },
};
