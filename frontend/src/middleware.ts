import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * No gateamos auth aquí: el JWT está en cookie httpOnly del dominio de la API
 * (cross-site). Un check de cookies del frontend provoca bucles login↔dashboard
 * en deploy. La protección real está en layouts + /auth/me + API requireAuth.
 */
export function middleware(_req: NextRequest) {
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
