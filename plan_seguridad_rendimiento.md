# Plan: Seguridad y Rendimiento — Legajo Técnico

Fecha: 2026-08-21  
Estado: Oleada A ✅ · Oleada B ✅ · Oleada C en progreso  
Objetivo: cerrar riesgos de seguridad y cuellos de botella de performance detectados en la auditoría, en oleadas entregables.

---

## Contexto

Auditoría sobre backend (Express + Supabase), frontend (Next.js) y advisors de Supabase.  
La app ya tiene buena base (auth, `assertEmpresaAccess`, sanitización HTML, cookie httpOnly). Los gaps principales están en **autorización fina**, **storage público**, **listados sin paginar** y **PDF síncrono**.

---

## Principios de ejecución

1. **Database-first** cuando haya índices/RLS/buckets.
2. **Backend antes que frontend** en cada ítem.
3. Un PR/commit por oleada o por ítem crítico (mensajes en español, `feat|fix(back|front|db)`).
4. Verificar en staging antes de producción.
5. No mezclar refactors cosméticos con cambios de seguridad.

---

## Oleada A — Seguridad rápida (prioridad 1)

**Meta:** impedir abusos de API y uploads peligrosos sin cambiar la UX de fondo.  
**Estado:** ✅ Completada (2026-08-21)

### A1–A6 — ✅ Completados

**Criterio de done Oleada A:** listo en código. Verificar en staging: preventor≠firma dueño; ente≠POST informes; SVG rechazado; DNI `../` → 400.

---

## Oleada B — Performance rápida (prioridad 2)

**Meta:** aliviar lo que ya duele en visitas con fotos y listados medianos.  
**Estado:** ✅ Completada (2026-08-21)

### B1. Índices DB faltantes — ✅
- Migración aplicada: `add_performance_indexes_oleada_b1`

### B2. Batch en create de informes — ✅
- Puntos + acciones en insert batch (crear).

### B3. Uploads de evidencia en paralelo — ✅
- Backend `Promise.all` en subir evidencia; frontend `mapPool` (3) en nuevo/editar.

### B4. Timeouts axios en firma / PDF — ✅
- `firmarInforme` timeout 120s.

### B5. Dynamic import de TipTap / Recharts — ✅
- TipTap: `RichTextEditor` y `DiapositivasEditor` con `next/dynamic` (`ssr: false`).
- Recharts: `AdminMetricasCharts` lazy en `/admin/metricas`.

**Criterio de done Oleada B:** guardar visita con varias fotos estable; listados con índices OK; firma sin doble click por timeout; bundles TipTap/Recharts fuera del critical path.

---

## Oleada C — Arquitectura (prioridad 3)

**Meta:** cambios estructurales con más diseño y regresión.  
**Estado:** 🟡 En progreso (C2, C4, C5, C6 parcial)

### C1. Storage privado + signed URLs (Alto / seguridad) — ⏳ Pendiente
- Buckets: `evidencia_visitas`, `firmas_digitales`, `informes_pdf` → private.
- Backend genera URLs firmadas con TTL corto tras authz.
- Frontend consume solo URLs firmadas (o proxy autenticado).
- Migración de objetos existentes y de URLs públicas guardadas en DB.

### C2. PDF asíncrono (Crítico / performance) — ✅ Parcial
- Firma de informe: `generarPdf` en background (`void` + catch), respuesta inmediata.
- Entrega EPP: mismo patrón; `url_registro_oficial` se actualiza cuando el PDF termina.
- Pendiente fino: estados DB `pdf_pendiente | listo | error` + UX “generando…”.

### C3. Paginación de listados (Crítico / performance) — ⏳ Pendiente
- API: `limit` + `cursor`/`offset` en informes, archivo, plan de acción, EPP, caps, admin.
- Frontend: React Query + infinite scroll o páginas.

### C4. CSRF / SameSite (Alto / seguridad) — ✅ Parcial
- SameSite=None se mantiene (API cross-site con cookie).
- Middleware `requireCsrfHeader`: mutaciones con cookie de sesión requieren `X-Requested-With: XMLHttpRequest`.
- Axios envía el header por defecto.

### C5. Middleware Next.js (Medio) — ✅
- `frontend/src/middleware.ts`: redirige a login si no hay `lt_token`/`token` en rutas privadas.
- Públicas: `/login`, `/login-admin`, `/evaluacion`, `/firmar`, `/cotizar`.

### C6. Hardening evaluación / cotización públicas (Medio) — ✅ Parcial
- Rate limit público: 15 req / 15 min (antes 40).
- Detalle público ya no expone `respuesta_correcta` (solo `es_multiple`).
- Revisión post-evaluación sigue mostrando respuestas correctas (feedback pedagógico).
- Pendiente: tokens one-time / expiración en cotización.

### C7. Supabase Auth — ⏳ Pendiente (manual)
- Activar leaked password protection (HaveIBeenPwned) en dashboard Auth.

**Criterio de done Oleada C:** buckets privados en prod; firma < 2s sin esperar PDF; listados >100 filas paginados.

---

## Orden de trabajo recomendado (día a día)

| Día | Foco |
|-----|------|
| 1 | A1 + A2 + A5 (roles) |
| 1–2 | A3 + A4 (uploads / path) |
| 2 | B1 (migración índices) |
| 2–3 | B2 + B3 + B4 (informes + timeouts) |
| 3 | B5 (dynamic imports) |
| 4+ | C2 (PDF async) ✅ parcial |
| 5+ | C1 storage privado |
| 6+ | C3 paginación |
| 7 | C4–C6 ✅ parcial · C7 manual |

---

## Fuera de alcance (por ahora)

- Reescritura completa a RSC en todas las páginas.
- Eliminar índices “unused” del advisor sin medir en prod.
- Refactors UI no ligados a seguridad/performance.

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
- [ ] (Oleada C) URLs de evidencia no accesibles sin auth

---

## Primera tarea al retomar

**Oleada C restante:** C1 (storage privado), C3 (paginación), C7 (leaked passwords en dashboard), refinamiento de estados PDF.
