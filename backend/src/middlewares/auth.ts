import { Request, Response, NextFunction } from "express";
import { supabaseAdmin } from "../config/supabase";
import { env } from "../config/env";
import { RolUsuario } from "../types/database";
import { readAuthToken } from "../utils/authCookie";

type AuthUser = {
  id: string;
  rol: RolUsuario;
  empresa_id?: string;
  consultora_id?: string;
};

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

const joseReady = import("jose").then((jose) => ({
  jwtVerify: jose.jwtVerify,
  JWKS: jose.createRemoteJWKSet(new URL(env.SUPABASE_JWKS_URL)),
}));
const CACHE_MS = 15_000;

const authCache = new Map<string, { user: AuthUser; expiresAt: number }>();
const inflight = new Map<string, Promise<AuthUser>>();

function pruneCache(now: number) {
  if (authCache.size < 200) return;
  for (const [key, value] of authCache) {
    if (value.expiresAt <= now) authCache.delete(key);
  }
}

async function loadPerfil(userId: string): Promise<AuthUser> {
  const { data: perfil, error: perfilError } = await supabaseAdmin
    .from("perfiles")
    .select("id, rol, empresa_id, consultora_id, activo")
    .eq("id", userId)
    .single();

  if (perfilError || !perfil) {
    const err = new Error("Perfil de usuario no encontrado") as Error & {
      statusCode: number;
    };
    err.statusCode = 401;
    throw err;
  }

  if (!perfil.activo) {
    const err = new Error("Usuario inactivo") as Error & { statusCode: number };
    err.statusCode = 403;
    throw err;
  }

  return {
    id: perfil.id,
    rol: perfil.rol,
    empresa_id: perfil.empresa_id || undefined,
    consultora_id: perfil.consultora_id || undefined,
  };
}

async function resolveAuthUser(token: string): Promise<AuthUser> {
  const now = Date.now();
  const cached = authCache.get(token);
  if (cached && cached.expiresAt > now) {
    return cached.user;
  }

  const pending = inflight.get(token);
  if (pending) return pending;

  const task = (async () => {
    let userId: string | undefined;
    try {
      const { jwtVerify, JWKS } = await joseReady;
      const { payload } = await jwtVerify(token, JWKS, {
        issuer: `${env.SUPABASE_URL.replace(/\/$/, "")}/auth/v1`,
        audience: "authenticated",
      });
      userId = typeof payload.sub === "string" ? payload.sub : undefined;
    } catch {
      const { data, error } = await supabaseAdmin.auth.getUser(token);
      if (error || !data.user) {
        const err = new Error("Token inválido o expirado") as Error & {
          statusCode: number;
        };
        err.statusCode = 401;
        throw err;
      }
      userId = data.user.id;
    }

    if (!userId) {
      const err = new Error("Token inválido o expirado") as Error & {
        statusCode: number;
      };
      err.statusCode = 401;
      throw err;
    }

    const user = await loadPerfil(userId);
    pruneCache(Date.now());
    authCache.set(token, { user, expiresAt: Date.now() + CACHE_MS });
    return user;
  })().finally(() => {
    inflight.delete(token);
  });

  inflight.set(token, task);
  return task;
}

export const requireAuth = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const token = readAuthToken(req);
    if (!token) {
      res.status(401).json({ error: "Token no provisto o formato inválido" });
      return;
    }

    req.user = await resolveAuthUser(token);
    next();
  } catch (error) {
    const status =
      typeof (error as { statusCode?: number }).statusCode === "number"
        ? (error as { statusCode: number }).statusCode
        : 401;
    if (status === 401 || status === 403) {
      res.status(status).json({
        error: error instanceof Error ? error.message : "No autorizado",
      });
      return;
    }
    next(error);
  }
};

export const requireRole = (...roles: RolUsuario[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.rol)) {
      res.status(403).json({ error: "Acceso denegado. Rol insuficiente." });
      return;
    }
    next();
  };
};
