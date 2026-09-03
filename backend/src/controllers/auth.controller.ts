import { Request, Response, NextFunction } from 'express';
import { supabaseAdmin, createPasswordAuthClient } from '../config/supabase';
import { userPerteneceAEmpresa, requireConsultoraId } from '../middlewares/empresaAccess';
import { clearAuthCookie, setAuthCookie } from '../utils/authCookie';
import {
  cuitLookupValues,
  digitsOnly,
  getBaseCuit,
  isCuitSucursalFormat,
  loginEmpresaOptionLabel,
} from '../utils/cuit';

type EmpresaLoginRow = {
  id: string;
  razon_social: string;
  cuit: string;
  logo_url: string | null;
  consultora_id: string;
  estado: string | null;
};

const EMPRESA_LOGIN_SELECT =
  "id, razon_social, cuit, logo_url, consultora_id, estado, domicilio, localidad";

async function resolveEmpresaForLogin(cuitInput: string): Promise<
  | { kind: "single"; empresa: EmpresaLoginRow }
  | { kind: "none" }
  | { kind: "multiple"; sucursales: EmpresaLoginRow[] }
> {
  const trimmed = String(cuitInput ?? "").trim();
  if (!trimmed) return { kind: "none" };

  if (isCuitSucursalFormat(trimmed)) {
    const normalized = trimmed.replace(/\s+/g, " ");
    const { data, error } = await supabaseAdmin
      .from("empresas")
      .select(EMPRESA_LOGIN_SELECT)
      .eq("cuit", normalized)
      .limit(1);

    if (error) throw error;
    if (data?.[0]) return { kind: "single", empresa: data[0] as EmpresaLoginRow };
    return { kind: "none" };
  }

  const lookupValues = cuitLookupValues(trimmed);
  const baseCuit = digitsOnly(trimmed);

  const { data: exactRows, error: exactError } = await supabaseAdmin
    .from("empresas")
    .select(EMPRESA_LOGIN_SELECT)
    .in("cuit", lookupValues);

  if (exactError) throw exactError;

  let branchRows: EmpresaLoginRow[] = [];
  if (baseCuit.length === 11) {
    const { data, error } = await supabaseAdmin
      .from("empresas")
      .select(EMPRESA_LOGIN_SELECT)
      .ilike("cuit", `${baseCuit} %`);

    if (error) throw error;
    branchRows = (data ?? []) as EmpresaLoginRow[];
  }

  const byId = new Map<string, EmpresaLoginRow>();
  for (const row of [...(exactRows ?? []), ...branchRows]) {
    byId.set(row.id, row as EmpresaLoginRow);
  }

  const matches = Array.from(byId.values());
  if (matches.length === 0) return { kind: "none" };
  if (matches.length === 1) return { kind: "single", empresa: matches[0] };
  return { kind: "multiple", sucursales: sortEmpresasForLoginPicker(matches) };
}

function sortEmpresasForLoginPicker(empresas: EmpresaLoginRow[]): EmpresaLoginRow[] {
  return [...empresas].sort((a, b) => {
    const aPrincipal = !isCuitSucursalFormat(a.cuit);
    const bPrincipal = !isCuitSucursalFormat(b.cuit);
    if (aPrincipal !== bPrincipal) return aPrincipal ? -1 : 1;
    return a.cuit.localeCompare(b.cuit);
  });
}

async function resolveEmpresaById(
  empresaId: string,
  cuitInput: string,
): Promise<EmpresaLoginRow | null> {
  const { data, error } = await supabaseAdmin
    .from("empresas")
    .select(EMPRESA_LOGIN_SELECT)
    .eq("id", empresaId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  const empresa = data as EmpresaLoginRow;
  const trimmed = cuitInput.trim();

  if (isCuitSucursalFormat(trimmed)) {
    if (empresa.cuit.replace(/\s+/g, " ") !== trimmed.replace(/\s+/g, " ")) {
      return null;
    }
    return empresa;
  }

  const baseInput = digitsOnly(trimmed);
  if (baseInput.length !== 11) return null;
  if (getBaseCuit(empresa.cuit) !== baseInput) return null;

  return empresa;
}

/**
 * Resuelve el perfil que puede entrar a una empresa con un username:
 * - dueño de esa empresa, o
 * - preventor asignado en preventor_empresas.
 * El email de Auth del preventor NO es el proxy @cuit.legajo.local (ese es solo del dueño).
 */
async function findPerfilLoginEmpresa(
  username: string,
  empresaId: string,
): Promise<Record<string, unknown> | null> {
  const usernameNorm = username.trim();
  if (!usernameNorm) return null;

  const { data: duenos, error: duenoError } = await supabaseAdmin
    .from("perfiles")
    .select("*")
    .eq("empresa_id", empresaId)
    .eq("rol", "dueno")
    .ilike("username", usernameNorm)
    .limit(1);

  if (duenoError) throw duenoError;
  if (duenos?.[0]) return duenos[0];

  const { data: asignaciones, error: asigError } = await supabaseAdmin
    .from("preventor_empresas")
    .select("preventor_id")
    .eq("empresa_id", empresaId);

  if (asigError) throw asigError;
  const preventorIds = (asignaciones ?? []).map((a) => a.preventor_id);
  if (preventorIds.length > 0) {
    const { data: preventores, error: prevError } = await supabaseAdmin
      .from("perfiles")
      .select("*")
      .in("id", preventorIds)
      .eq("rol", "preventor")
      .ilike("username", usernameNorm)
      .limit(1);

    if (prevError) throw prevError;
    if (preventores?.[0]) return preventores[0];
  }

  // Verificar si es un ente regulador asignado a la empresa
  const { data: asignacionesEnte, error: enteError } = await supabaseAdmin
    .from("ente_regulador_empresas")
    .select("ente_id")
    .eq("empresa_id", empresaId);

  if (enteError) throw enteError;
  const enteIds = (asignacionesEnte ?? []).map((a) => a.ente_id);
  if (enteIds.length > 0) {
    const { data: entes, error: entesError } = await supabaseAdmin
      .from("perfiles")
      .select("*")
      .in("id", enteIds)
      .eq("rol", "ente_regulador")
      .ilike("username", usernameNorm)
      .limit(1);

    if (entesError) throw entesError;
    if (entes?.[0]) return entes[0];
  }

  return null;
}

export const authController = {
  async login(req: Request, res: Response, next: NextFunction) {
    try {
      const { cuit, username, password, empresa_id } = req.body;
      const LOGIN_ERROR = "Credenciales inválidas o sesión no iniciada";
      const cuitInput = String(cuit ?? "").trim();
      const usernameNorm = String(username ?? "").trim();
      const empresaIdInput =
        typeof empresa_id === "string" && empresa_id.trim()
          ? empresa_id.trim()
          : null;

      if (!cuitInput || !usernameNorm) {
        return res.status(401).json({ error: LOGIN_ERROR });
      }

      let empresa: EmpresaLoginRow | null = null;

      if (empresaIdInput) {
        empresa = await resolveEmpresaById(empresaIdInput, cuitInput);
        if (!empresa) {
          return res.status(401).json({ error: LOGIN_ERROR });
        }
      } else {
        const resolution = await resolveEmpresaForLogin(cuitInput);
        if (resolution.kind === "none") {
          return res.status(401).json({ error: LOGIN_ERROR });
        }

        if (resolution.kind === "multiple") {
          return res.status(409).json({
            error:
              "Este CUIT tiene legajo principal y sucursales. Elegí cuál querés ingresar.",
            code: "MULTIPLE_SUCURSALES",
            sucursales: resolution.sucursales.map((row) => ({
              id: row.id,
              razon_social: row.razon_social,
              cuit: row.cuit,
              label: loginEmpresaOptionLabel(row.razon_social, row.cuit),
            })),
          });
        }

        empresa = resolution.empresa;
      }

      if (empresa.estado === "pausada") {
        return res.status(403).json({
          error:
            "Esta empresa está pausada (p. ej. por falta de pago). Contactá a tu consultora.",
        });
      }

      if (empresa.estado === "eliminada") {
        return res.status(403).json({
          error: "Esta empresa ya no está disponible en el sistema.",
        });
      }

      const perfilCandidato = await findPerfilLoginEmpresa(
        usernameNorm,
        empresa.id,
      );
      if (!perfilCandidato || perfilCandidato.activo === false) {
        return res.status(401).json({ error: LOGIN_ERROR });
      }

      const { data: authUserData, error: authUserError } =
        await supabaseAdmin.auth.admin.getUserById(
          String(perfilCandidato.id),
        );
      const authEmail = authUserData?.user?.email;
      if (authUserError || !authEmail) {
        return res.status(401).json({ error: LOGIN_ERROR });
      }

      const { data: authData, error: authError } =
        await createPasswordAuthClient().auth.signInWithPassword({
          email: authEmail,
          password: password,
        });

      if (authError || !authData.user || !authData.session) {
        return res.status(401).json({ error: LOGIN_ERROR });
      }

      const { data: perfil, error: perfilError } = await supabaseAdmin
        .from("perfiles")
        .select("*")
        .eq("id", authData.user.id)
        .maybeSingle();

      if (perfilError || !perfil || perfil.activo === false) {
        return res.status(401).json({ error: LOGIN_ERROR });
      }

      const pertenece = await userPerteneceAEmpresa(perfil, empresa);
      if (!pertenece) {
        return res.status(401).json({ error: LOGIN_ERROR });
      }

      setAuthCookie(res, authData.session.access_token);
      res.json({
        perfil,
        empresa: {
          id: empresa.id,
          razon_social: empresa.razon_social,
          cuit: empresa.cuit,
          logo_url: empresa.logo_url,
          estado: empresa.estado || "activa",
        },
      });
    } catch (error) {
      next(error);
    }
  },

  async loginAdmin(req: Request, res: Response, next: NextFunction) {
    try {
      const { email, password } = req.body;
      const { data: authData, error: authError } = await createPasswordAuthClient().auth.signInWithPassword({
        email,
        password,
      });

      if (authError || !authData.user || !authData.session) {
        return res.status(401).json({ error: 'Credenciales inválidas o sesión no iniciada' });
      }

      const { data: perfil } = await supabaseAdmin
        .from('perfiles')
        .select('*')
        .eq('id', authData.user.id)
        .single();

      if (!perfil || perfil.activo === false || !['admin', 'preventor', 'ente_regulador'].includes(perfil.rol)) {
        return res.status(401).json({ error: 'Credenciales inválidas o sesión no iniciada' });
      }

      setAuthCookie(res, authData.session.access_token);
      res.json({
        perfil
      });
    } catch (error) {
      next(error);
    }
  },
  
  async me(req: Request, res: Response, next: NextFunction) {
    try {
      const { data: perfil, error } = await supabaseAdmin
        .from("perfiles")
        .select(
          "id, consultora_id, empresa_id, nombre_completo, username, rol, activo, created_at, permisos_personalizados",
        )
        .eq("id", req.user!.id)
        .single();

      if (error || !perfil || perfil.activo === false) {
        return res.status(401).json({ error: "Sesión inválida" });
      }

      res.json({ user: perfil });
    } catch (error) {
      next(error);
    }
  },

  async logout(_req: Request, res: Response) {
    clearAuthCookie(res);
    res.json({ success: true });
  },

  /**
   * Retorna las empresas accesibles para el usuario autenticado según su rol:
   * - admin: todas las empresas de su consultora
   * - preventor: las asignadas en preventor_empresas
   * - ente_regulador: las autorizadas en ente_regulador_empresas
   * - dueno: su propia empresa
   */
  async misEmpresas(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      const rol = req.user!.rol;

      let empresas: any[] = [];

      if (rol === 'admin') {
        const consultoraId = requireConsultoraId(req.user!);
        const { data, error } = await supabaseAdmin
          .from('empresas')
          .select('id, razon_social, cuit, logo_url, actividad, estado, domicilio, localidad')
          .eq('consultora_id', consultoraId)
          .neq('estado', 'eliminada')
          .order('razon_social');

        if (error) throw error;
        empresas = data || [];

      } else if (rol === 'preventor') {
        // Preventor ve solo las empresas asignadas vía preventor_empresas
        const { data, error } = await supabaseAdmin
          .from('preventor_empresas')
          .select('empresa_id, empresas(id, razon_social, cuit, logo_url, actividad, estado, domicilio, localidad)')
          .eq('preventor_id', userId);

        if (error) throw error;
        empresas = (data || [])
          .map((pe: any) => pe.empresas)
          .filter(
            (e: any) => e && (e.estado === "activa" || e.estado === "aviso_deuda"),
          );

      } else if (rol === 'ente_regulador') {
        // Ente regulador ve las empresas autorizadas
        const { data, error } = await supabaseAdmin
          .from('ente_regulador_empresas')
          .select('empresa_id, empresas(id, razon_social, cuit, logo_url, actividad, estado, domicilio, localidad)')
          .eq('ente_id', userId);

        if (error) throw error;
        empresas = (data || [])
          .map((ere: any) => ere.empresas)
          .filter(
            (e: any) => e && (e.estado === "activa" || e.estado === "aviso_deuda"),
          );

      } else if (rol === 'dueno') {
        // Dueño ve solo su empresa
        if (req.user!.empresa_id) {
          const { data, error } = await supabaseAdmin
            .from('empresas')
            .select('id, razon_social, cuit, logo_url, actividad, estado, domicilio, localidad')
            .eq('id', req.user!.empresa_id)
            .single();

          if (error) throw error;
          if (
            data &&
            (data.estado === "activa" || data.estado === "aviso_deuda")
          ) {
            empresas = [data];
          }
        }
      }

      res.json({ empresas });
    } catch (error) {
      next(error);
    }
  }
};
