# Dominio legajotecnico.com (feature 29.0)

Soporte de vinculación del dominio de producción. El Excel nombra `legajotecnico.com`; algunas specs internas mencionan `legajotecnico.com.ar`. Confirmar el hostname final con el cliente antes de publicar DNS.

## Piezas

| Pieza | Hosting sugerido | Hostname típico |
|-------|------------------|-----------------|
| Frontend Next.js | Vercel | `https://legajotecnico.com` |
| Backend Express | Railway / Render | `https://api.legajotecnico.com` |
| Auth + DB + Storage | Supabase | proyecto existente |

## DNS

1. Apex y `www` del frontend → Vercel (A / CNAME según su panel).
2. `api` → CNAME al host del backend.
3. No apuntar el frontend al origen de GitHub Whapy; los deploys siguen el remote `origin` (ver `docs/WHAPY_DUAL_REMOTE.md`).

## Variables

Backend:

```
FRONTEND_URL=https://legajotecnico.com
PORT=4000
SUPABASE_URL=...
SUPABASE_PUBLISHABLE_KEY=...
SUPABASE_SECRET_KEY=...
SUPABASE_JWKS_URL=...
```

Frontend:

```
NEXT_PUBLIC_API_URL=https://api.legajotecnico.com/api
```

`FRONTEND_URL` alimenta CORS, cookies y los QR (capacitación, EPP, enlace público de cotización). Si el dominio cambia, regenerar QR nuevos; los ya impresos quedan con la URL vieja.

## Checklist post-DNS

- Login empresa (`/login`) y CRM (`/login-admin`) por HTTPS.
- CORS: el backend solo acepta `FRONTEND_URL`.
- Evaluación pública `/evaluacion/:id` y cotización `/cotizar/:token` abren sin sesión.
- Logos y PDFs en Storage siguen resolviendo.
- No commitear `.env` reales.
