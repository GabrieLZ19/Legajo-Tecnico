import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * No gateamos auth aquí: la sesión es cookie httpOnly same-origin vía
 * rewrite `/api` → backend. La protección real está en layouts + /auth/me + API.
 */
export function middleware(_req: NextRequest) {
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
