import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const AUTH_COOKIE = "lt_token";
const LEGACY_TOKEN = "token";

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
  return Boolean(
    req.cookies.get(AUTH_COOKIE)?.value ||
      req.cookies.get(LEGACY_TOKEN)?.value,
  );
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Assets / Next internals
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

  // Rutas de app / admin / ente requieren cookie de sesión
  if (!hasSessionCookie(req)) {
    const login =
      pathname.startsWith("/admin") || pathname.startsWith("/login-admin")
        ? "/login-admin"
        : "/login";
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
