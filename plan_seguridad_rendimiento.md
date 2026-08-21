# Plan: Seguridad y Rendimiento — Legajo Técnico

Fecha: 2026-08-21  
Estado: Oleada A ✅ · Oleada B ✅ · Oleada C ✅ (C7 manual en dashboard)  
Objetivo: cerrar riesgos de seguridad y cuellos de botella de performance detectados en la auditoría, en oleadas entregables.

---

## Contexto

Auditoría sobre backend (Express + Supabase), frontend (Next.js) y advisors de Supabase.  
La app ya tiene buena base (auth, `assertEmpresaAccess`, sanitización HTML, cookie httpOnly). Los gaps principales estaban en **autorización fina**, **storage público**, **listados sin paginar** y **PDF síncrono**.

---

## Principios de ejecución

1. **Database-first** cuando haya índices/RLS/buckets.
2. **Backend antes que frontend** en cada ítem.
3. Un PR/commit por oleada o por ítem crítico (mensajes en español, `feat|fix(back|front|db)`).
4. Verificar en staging antes de producción.
5. No mezclar refactors cosméticos con cambios de seguridad.

---

## Oleada A — Seguridad rápida (prioridad 1)

**Estado:** ✅ Completada (2026-08-21)

### A1–A6 — ✅ Completados

---

## Oleada B — Performance rápida (prioridad 2)

**Estado:** ✅ Completada (2026-08-21)

### B1–B5 — ✅ Completados
Índices, batch create, uploads paralelos, timeouts firma, TipTap/Recharts dynamic.

---

## Oleada C — Arquitectura (prioridad 3)

**Estado:** ✅ Completada en código (2026-08-21) — C7 requiere toggle manual en Auth

### C1. Storage privado + signed URLs — ✅
- Buckets `evidencia_visitas`, `firmas_digitales`, `informes_pdf` → `public = false`.
- Policies SELECT públicas eliminadas en esos buckets.
- `storageService`: parse URL, `createSignedUrl`, `signUrl`, `downloadBuffer`.
- Detalle/listado de informes firman URLs al responder (TTL 1h).
- PDF generation descarga vía Storage admin (no depende de URL pública).

### C2. PDF asíncrono — ✅
- Firma informe y entrega EPP no bloquean con `await` del PDF.
- Refino opcional futuro: columna de estado `pdf_pendiente | listo | error`.

### C3. Paginación de listados — ✅ (informes)
- API `GET /informes?limit&offset` → `{ items, total, limit, offset }`.
- Frontend: páginas de 20 en listado; dashboard/archivo con límites mayores.

### C4. CSRF / SameSite — ✅
- Header `X-Requested-With` en mutaciones con cookie de sesión.
- Axios lo envía por defecto.

### C5. Middleware Next.js — ✅
- Redirect a login sin cookie `lt_token`/`token`.

### C6. Hardening evaluación / cotización — ✅
- Rate limit público 15/15min.
- Detalle público sin clave de respuestas.
- Cotización pública valida `fecha_cierre` (410 si expiró).

### C7. Supabase Auth — ⏳ Manual
- Activar en Dashboard → Authentication → Providers/Password → **Leaked password protection** (HaveIBeenPwned).
- No expone API de migración vía MCP para este flag.

**Criterio de done Oleada C:** buckets privados ✅ · PDF no bloquea ✅ · listados paginados ✅ · C7 pendiente de un click en dashboard.

---

## Checklist de verificación global

- [x] Preventor no firma como dueño (API)
- [x] Ente no crea/edita informes (API)
- [x] Upload SVG rechazado
- [x] Evaluación con DNI malicioso no altera paths
- [x] Visita con 5+ fotos guarda a la primera
- [x] Advisor Supabase: FKs críticas indexadas
- [x] Firma no timeout 20s / no doble registro
- [x] (Oleada C) PDF no bloquea response
- [x] (Oleada C) URLs de evidencia no accesibles sin auth (buckets private + signed)

---

## Primera tarea al retomar

1. Activar **C7 leaked password protection** en Supabase Auth (manual).
2. Smoke test: ver foto de evidencia en detalle, firmar informe, descargar PDF, paginar listado.
3. (Opcional) estados PDF en DB + UX “generando…”.
