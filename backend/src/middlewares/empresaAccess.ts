import { supabaseAdmin } from "../config/supabase";
import { HttpError } from "../utils/httpError";

export type AuthUser = {
  id: string;
  rol: string;
  empresa_id?: string;
  consultora_id?: string;
};

export function requireConsultoraId(user: AuthUser): string {
  if (!user.consultora_id) {
    throw new HttpError(403, "El usuario no tiene consultora asignada");
  }
  return user.consultora_id;
}

export async function assertEmpresaAccess(user: AuthUser, empresaId: string) {
  if (!empresaId) {
    throw new HttpError(400, "empresa_id es requerido");
  }

  if (user.rol === "dueno") {
    if (user.empresa_id !== empresaId) {
      throw new HttpError(403, "No tenés acceso a esta empresa");
    }
    return;
  }

  if (user.rol === "admin") {
    const consultoraId = requireConsultoraId(user);
    const { data } = await supabaseAdmin
      .from("empresas")
      .select("id")
      .eq("id", empresaId)
      .eq("consultora_id", consultoraId)
      .maybeSingle();
    if (!data) {
      throw new HttpError(403, "No tenés acceso a esta empresa");
    }
    return;
  }

  if (user.rol === "preventor") {
    const { data } = await supabaseAdmin
      .from("preventor_empresas")
      .select("empresa_id")
      .eq("preventor_id", user.id)
      .eq("empresa_id", empresaId)
      .maybeSingle();
    if (!data) {
      throw new HttpError(403, "No tenés acceso a esta empresa");
    }
    return;
  }

  if (user.rol === "ente_regulador") {
    const { data } = await supabaseAdmin
      .from("ente_regulador_empresas")
      .select("empresa_id")
      .eq("ente_id", user.id)
      .eq("empresa_id", empresaId)
      .maybeSingle();
    if (!data) {
      throw new HttpError(403, "No tenés acceso a esta empresa");
    }
    return;
  }

  throw new HttpError(403, "No tenés acceso a esta empresa");
}

export async function assertPerfilDeConsultora(
  perfilId: string,
  consultoraId: string,
  rolEsperado?: string,
) {
  const { data } = await supabaseAdmin
    .from("perfiles")
    .select("id, rol, consultora_id")
    .eq("id", perfilId)
    .maybeSingle();
  if (!data || data.consultora_id !== consultoraId) {
    throw new HttpError(403, "No tenés acceso a este usuario");
  }
  if (rolEsperado && data.rol !== rolEsperado) {
    throw new HttpError(404, "Usuario no encontrado");
  }
}

async function empresaIdDe(
  table: string,
  id: string,
  notFound: string,
): Promise<string> {
  const { data } = await supabaseAdmin
    .from(table)
    .select("empresa_id")
    .eq("id", id)
    .maybeSingle();
  if (!data?.empresa_id) {
    throw new HttpError(404, notFound);
  }
  return data.empresa_id as string;
}

export async function assertInformeAccess(user: AuthUser, informeId: string) {
  await assertEmpresaAccess(
    user,
    await empresaIdDe("informes_visita", informeId, "Informe no encontrado"),
  );
}

export async function assertCapacitacionAccess(user: AuthUser, capId: string) {
  await assertEmpresaAccess(
    user,
    await empresaIdDe("capacitaciones", capId, "Capacitación no encontrada"),
  );
}

export async function assertAccionAccess(user: AuthUser, accionId: string) {
  await assertEmpresaAccess(
    user,
    await empresaIdDe("acciones_mejora", accionId, "Acción no encontrada"),
  );
}

export async function assertEmpleadoAccess(user: AuthUser, empleadoId: string) {
  await assertEmpresaAccess(
    user,
    await empresaIdDe("empleados", empleadoId, "Empleado no encontrado"),
  );
}

export async function assertEntregaAccess(user: AuthUser, entregaId: string) {
  await assertEmpresaAccess(
    user,
    await empresaIdDe("epp_entregas", entregaId, "Entrega de EPP no encontrada"),
  );
}

export async function userPerteneceAEmpresa(
  perfil: {
    id: string;
    rol: string;
    activo?: boolean | null;
    empresa_id?: string | null;
    consultora_id?: string | null;
  },
  empresa: { id: string; consultora_id?: string | null },
): Promise<boolean> {
  if (perfil.activo === false) return false;
  if (perfil.rol === "dueno") return perfil.empresa_id === empresa.id;
  if (perfil.rol === "admin") {
    return Boolean(perfil.consultora_id && empresa.consultora_id === perfil.consultora_id);
  }
  if (perfil.rol === "preventor") {
    const { data } = await supabaseAdmin
      .from("preventor_empresas")
      .select("empresa_id")
      .eq("preventor_id", perfil.id)
      .eq("empresa_id", empresa.id)
      .maybeSingle();
    return Boolean(data);
  }
  if (perfil.rol === "ente_regulador") {
    const { data } = await supabaseAdmin
      .from("ente_regulador_empresas")
      .select("empresa_id")
      .eq("ente_id", perfil.id)
      .eq("empresa_id", empresa.id)
      .maybeSingle();
    return Boolean(data);
  }
  return false;
}
