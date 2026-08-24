import type { NextFunction, Request, Response } from "express";
import { AUTH_COOKIE } from "../utils/authCookie";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

function hasAuthCookie(req: Request): boolean {
  const raw = req.headers.cookie;
  if (!raw) return false;
  for (const part of raw.split(";")) {
    const [key] = part.trim().split("=");
    if (key === AUTH_COOKIE || key === "token") return true;
  }
  return false;
}

/**
 * Mitigación CSRF para sesión por cookie (SameSite=Lax, same-origin vía proxy):
 * mutaciones con cookie de auth deben traer X-Requested-With.
 * Requests sin cookie (públicos / Bearer) no se bloquean.
 */
export function requireCsrfHeader(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  if (SAFE_METHODS.has(req.method.toUpperCase())) {
    next();
    return;
  }

  const auth = req.headers.authorization;
  if (auth?.startsWith("Bearer ")) {
    next();
    return;
  }

  if (!hasAuthCookie(req)) {
    next();
    return;
  }

  const requestedWith = String(req.headers["x-requested-with"] || "");
  if (requestedWith.toLowerCase() === "xmlhttprequest") {
    next();
    return;
  }

  res.status(403).json({
    error: "Solicitud rechazada por falta de encabezado anti-CSRF.",
  });
}
