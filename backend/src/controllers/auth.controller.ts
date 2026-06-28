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
  }
};
