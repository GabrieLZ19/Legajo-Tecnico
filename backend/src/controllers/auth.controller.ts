import { Request, Response } from 'express';
import { supabaseAdmin } from '../config/supabase';
import { Perfil } from '../types/database';

export const authController = {
  async login(req: Request, res: Response) {
    try {
      const { cuit, username, password } = req.body;

      // En un flujo real: 
      // 1. Buscamos la empresa por CUIT para validar que exista
      const { data: empresa } = await supabaseAdmin
        .from('empresas')
        .select('id, razon_social, cuit, logo_url')
        .eq('cuit', cuit)
        .single();
      
      if (!empresa) {
        return res.status(401).json({ error: 'Empresa no encontrada con ese CUIT' });
      }

      // 2. Autenticamos con Supabase Auth (ej. el username podría mapearse a un email dummy como username@cuit.empresa)
      // Supongamos que usamos un proxy de email:
      const proxyEmail = `${username}@${cuit}.legajo.local`;
      
      const { data: authData, error: authError } = await supabaseAdmin.auth.signInWithPassword({
        email: proxyEmail,
        password: password,
      });

      if (authError || !authData.user || !authData.session) {
        return res.status(401).json({ error: 'Credenciales inválidas o sesión no iniciada' });
      }

      // 3. Obtenemos el perfil
      const { data: perfil } = await supabaseAdmin
        .from('perfiles')
        .select('*')
        .eq('id', authData.user.id)
        .single();

      res.json({
        access_token: authData.session.access_token,
        refresh_token: authData.session.refresh_token,
        perfil,
        empresa
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  },

  async loginAdmin(req: Request, res: Response) {
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

      if (!perfil || (perfil.rol !== 'admin' && perfil.rol !== 'preventor')) {
        return res.status(403).json({ error: 'No tienes permisos de administrador' });
      }

      res.json({
        access_token: authData.session.access_token,
        refresh_token: authData.session.refresh_token,
        perfil
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  },
  
  async me(req: Request, res: Response) {
    // Retorna los datos que inyectamos en req.user desde el middleware
    res.json({ user: req.user });
  },

  /**
   * Retorna las empresas accesibles para el usuario autenticado según su rol:
   * - admin: todas las empresas de su consultora
   * - preventor: las asignadas en preventor_empresas
   * - ente_regulador: las autorizadas en ente_regulador_empresas
   * - dueno: su propia empresa
   */
  async misEmpresas(req: Request, res: Response) {
    try {
      const userId = req.user!.id;
      const rol = req.user!.rol;

      let empresas: any[] = [];

      if (rol === 'admin') {
        // Admin ve todas las empresas (de su consultora si tiene una asignada)
        const query = supabaseAdmin
          .from('empresas')
          .select('id, razon_social, cuit, logo_url, actividad')
          .order('razon_social');

        if (req.user!.consultora_id) {
          query.eq('consultora_id', req.user!.consultora_id);
        }

        const { data, error } = await query;
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
          .eq('ente_regulador_id', userId);

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
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
};
