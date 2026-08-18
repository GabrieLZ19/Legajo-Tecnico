import type { CookieOptions, Request, Response } from "express";
import { env } from "../config/env";

export const AUTH_COOKIE = "lt_token";

export function authCookieOptions(): CookieOptions {
  const frontend = new URL(env.FRONTEND_URL);
  const isLocal =
    frontend.hostname === "localhost" || frontend.hostname === "127.0.0.1";

  return {
    httpOnly: true,
    secure: !isLocal,
    sameSite: isLocal ? "lax" : "none",
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: "/",
  };
}

export function setAuthCookie(res: Response, token: string) {
  res.cookie(AUTH_COOKIE, token, authCookieOptions());
}

export function clearAuthCookie(res: Response) {
  res.clearCookie(AUTH_COOKIE, {
    ...authCookieOptions(),
    maxAge: 0,
  });
}

export function readAuthToken(req: Request): string | undefined {
  const header = req.headers.authorization;
  if (header?.startsWith("Bearer ")) {
    const bearer = header.slice(7).trim();
    if (bearer) return bearer;
  }

  const raw = req.headers.cookie;
  if (!raw) return undefined;

  for (const part of raw.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === AUTH_COOKIE) {
      try {
        return decodeURIComponent(rest.join("="));
      } catch {
        return rest.join("=");
      }
    }
  }

  return undefined;
}
