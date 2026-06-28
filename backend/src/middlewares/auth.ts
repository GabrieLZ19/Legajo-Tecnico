import { Request, Response, NextFunction } from 'express';
import { supabaseAdmin } from '../config/supabase';
import { RolUsuario } from '../types/database';

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        rol: RolUsuario;
        empresa_id?: string;
        consultora_id?: string;
      };
    }
  }
}

export const requireAuth = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Token no provisto o formato inválido' });
      return;
    }

    const token = authHeader.split(' ')[1];
    
    // Validar el token con Supabase Auth
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);

    if (authError || !user) {
      res.status(401).json({ error: 'Token inválido o expirado' });
      return;
    }

    // Obtener el perfil del usuario para saber su rol y empresa/consultora asignada
    const { data: perfil, error: perfilError } = await supabaseAdmin
      .from('perfiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (perfilError || !perfil) {
      res.status(401).json({ error: 'Perfil de usuario no encontrado' });
      return;
    }

    if (!perfil.activo) {
      res.status(403).json({ error: 'Usuario inactivo' });
      return;
    }

    // Inyectar el usuario en la request
    req.user = {
      id: perfil.id,
      rol: perfil.rol,
      empresa_id: perfil.empresa_id || undefined,
      consultora_id: perfil.consultora_id || undefined,
    };

    next();
  } catch (error) {
    next(error);
  }
};

export const requireRole = (...roles: RolUsuario[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.rol)) {
      res.status(403).json({ error: 'Acceso denegado. Rol insuficiente.' });
      return;
    }
    next();
  };
};
