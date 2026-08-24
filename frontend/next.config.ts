import type { NextConfig } from "next";

/**
 * Proxy same-origin: el browser habla con `/api/*` en el dominio del frontend.
 * Evita cookies cross-site (SameSite=None) que Safari/iOS bloquea o no persiste.
 *
 * En Vercel/local definir API_PROXY_TARGET apuntando al backend Express
 * (ej. https://api.legajotecnico.com o http://localhost:4000).
 */
const apiProxyTarget = (
  process.env.API_PROXY_TARGET ||
  process.env.BACKEND_URL ||
  "http://localhost:4000"
).replace(/\/$/, "");

const nextConfig: NextConfig = {
  compress: true,
  poweredByHeader: false,
  experimental: {
    optimizePackageImports: ["lucide-react"],
  },
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${apiProxyTarget}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
