import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Señal de sesión en el origen del frontend (lt_session).
 * No usamos `perfil` solo: puede quedar cookie stale y abrir rutas sin JWT válido.
 * El JWT real vive en cookie httpOnly del dominio de la API.
 */
const SESSION_MARKERS = ["lt_session", "lt_token", "token"] as const;

const PUBLIC_PREFIXES = [
  "/login",
  "/login-admin",
  "/evaluacion",
  "/firmar",
  "/cotizar",
  "/api",
];

function isPublicPath(pathname: string): boolean {
  if (pathname === "/") return true;
  return PUBLIC_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
}

function hasSessionCookie(req: NextRequest): boolean {
  return SESSION_MARKERS.some((name) => Boolean(req.cookies.get(name)?.value));
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  if (!hasSessionCookie(req)) {
    const login = pathname.startsWith("/admin") ? "/login-admin" : "/login";
    const url = req.nextUrl.clone();
    url.pathname = login;
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
