import { Request, Response, NextFunction } from 'express';
import { supabaseAdmin } from '../config/supabase';
import { userPerteneceAEmpresa, requireConsultoraId } from '../middlewares/empresaAccess';
import { clearAuthCookie, setAuthCookie } from '../utils/authCookie';

export const authController = {
  async login(req: Request, res: Response, next: NextFunction) {
    try {
      const { cuit, username, password } = req.body;

      const LOGIN_ERROR = "Credenciales inválidas o sesión no iniciada";
      const proxyEmail = `${username}@${cuit}.legajo.local`;

      const { data: empresa } = await supabaseAdmin
        .from("empresas")
        .select("id, razon_social, cuit, logo_url, consultora_id")
        .eq("cuit", cuit)
        .maybeSingle();

      if (!empresa) {
        return res.status(401).json({ error: LOGIN_ERROR });
      }

      const { data: authData, error: authError } =
        await supabaseAdmin.auth.signInWithPassword({
          email: proxyEmail,
          password: password,
        });

      if (authError || !authData.user || !authData.session) {
        return res.status(401).json({ error: LOGIN_ERROR });
      }

      const { data: perfil } = await supabaseAdmin
        .from("perfiles")
        .select("*")
        .eq("id", authData.user.id)
        .single();

      if (!perfil || perfil.activo === false) {
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
        },
      });
    } catch (error) {
      next(error);
    }
  },

  async loginAdmin(req: Request, res: Response, next: NextFunction) {
    try {
      const { email, password } = req.body;
      const { data: authData, error: authError } = await supabaseAdmin.auth.signInWithPassword({
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
  
  async me(req: Request, res: Response) {
    res.json({ user: req.user });
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
          .select('id, razon_social, cuit, logo_url, actividad')
          .eq('consultora_id', consultoraId)
          .order('razon_social');

        if (error) throw error;
        empresas = data || [];

      } else if (rol === 'preventor') {
        // Preventor ve solo las empresas asignadas vía preventor_empresas
        const { data, error } = await supabaseAdmin
          .from('preventor_empresas')
          .select('empresa_id, empresas(id, razon_social, cuit, logo_url, actividad)')
          .eq('preventor_id', userId);

        if (error) throw error;
        empresas = (data || []).map((pe: any) => pe.empresas).filter(Boolean);

      } else if (rol === 'ente_regulador') {
        // Ente regulador ve las empresas autorizadas
        const { data, error } = await supabaseAdmin
          .from('ente_regulador_empresas')
          .select('empresa_id, empresas(id, razon_social, cuit, logo_url, actividad)')
          .eq('ente_id', userId);

        if (error) throw error;
        empresas = (data || []).map((ere: any) => ere.empresas).filter(Boolean);

      } else if (rol === 'dueno') {
        // Dueño ve solo su empresa
        if (req.user!.empresa_id) {
          const { data, error } = await supabaseAdmin
            .from('empresas')
            .select('id, razon_social, cuit, logo_url, actividad')
            .eq('id', req.user!.empresa_id)
            .single();

          if (error) throw error;
          if (data) empresas = [data];
        }
      }

      res.json({ empresas });
    } catch (error) {
      next(error);
    }
  }
};
