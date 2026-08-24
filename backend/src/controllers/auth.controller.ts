import { Request, Response, NextFunction } from 'express';
import { supabaseAdmin, createPasswordAuthClient } from '../config/supabase';
import { userPerteneceAEmpresa, requireConsultoraId } from '../middlewares/empresaAccess';
import { clearAuthCookie, setAuthCookie } from '../utils/authCookie';

function digitsOnly(value: unknown): string {
  return String(value ?? "").replace(/\D/g, "");
}

function cuitLookupValues(cleanCuit: string): string[] {
  const formatted =
    cleanCuit.length === 11
      ? `${cleanCuit.slice(0, 2)}-${cleanCuit.slice(2, 10)}-${cleanCuit.slice(10)}`
      : cleanCuit;
  return Array.from(new Set([cleanCuit, formatted]));
}

export const authController = {
  async login(req: Request, res: Response, next: NextFunction) {
    try {
      const { cuit, username, password } = req.body;
      const LOGIN_ERROR = "Credenciales inválidas o sesión no iniciada";
      const cleanCuit = digitsOnly(cuit);
      const usernameNorm = String(username ?? "").trim();

      if (!cleanCuit || !usernameNorm) {
        return res.status(401).json({ error: LOGIN_ERROR });
      }

      const proxyEmail = `${usernameNorm}@${cleanCuit}.legajo.local`;

      const { data: empresas, error: empresaError } = await supabaseAdmin
        .from("empresas")
        .select("id, razon_social, cuit, logo_url, consultora_id, estado")
        .in("cuit", cuitLookupValues(cleanCuit))
        .limit(1);

      if (empresaError) throw empresaError;
      const empresa = empresas?.[0];

      if (!empresa) {
        return res.status(401).json({ error: LOGIN_ERROR });
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

      const { data: authData, error: authError } =
        await createPasswordAuthClient().auth.signInWithPassword({
          email: proxyEmail,
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
          .select('id, razon_social, cuit, logo_url, actividad, estado')
          .eq('consultora_id', consultoraId)
          .neq('estado', 'eliminada')
          .order('razon_social');

        if (error) throw error;
        empresas = data || [];

      } else if (rol === 'preventor') {
        // Preventor ve solo las empresas asignadas vía preventor_empresas
        const { data, error } = await supabaseAdmin
          .from('preventor_empresas')
          .select('empresa_id, empresas(id, razon_social, cuit, logo_url, actividad, estado)')
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
          .select('empresa_id, empresas(id, razon_social, cuit, logo_url, actividad, estado)')
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
            .select('id, razon_social, cuit, logo_url, actividad, estado')
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
