# Plan: Seguridad y Rendimiento — Legajo Técnico

Fecha: 2026-08-21  
Estado: pendiente de ejecución  
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

### A1. Roles en firmas de informe (Crítico) — ✅
### A2. Roles en escritura de informes (Alto) — ✅
### A3. Validación de uploads (Alto) — ✅
### A4. Path traversal en evaluación pública (Alto) — ✅
### A5. Allowlist de roles al crear/editar usuarios (Alto) — ✅
### A6. Plantillas de declaración — roles (Medio) — ✅

**Criterio de done Oleada A:** listo en código. Verificar en staging: preventor≠firma dueño; ente≠POST informes; SVG rechazado; DNI `../` → 400.

---

## Oleada B — Performance rápida (prioridad 2)

**Meta:** aliviar lo que ya duele en visitas con fotos y listados medianos.  
**Estado:** 🟡 En progreso (B1–B4)

### B1. Índices DB faltantes — ✅
- Migración aplicada: `add_performance_indexes_oleada_b1`

### B2. Batch en create de informes — ✅
- Puntos + acciones en insert batch (crear).

### B3. Uploads de evidencia en paralelo — ✅
- Backend `Promise.all` en subir evidencia; frontend `mapPool` (3) en nuevo/editar.

### B4. Timeouts axios en firma / PDF — ✅
- `firmarInforme` timeout 120s.

### B5. Dynamic import de TipTap / Recharts — ✅ (TipTap)
- `RichTextEditor` y `DiapositivasEditor` cargan con `next/dynamic` (`ssr: false`).
- Recharts en métricas: pendiente fino (menor impacto que TipTap).

**Criterio de done Oleada B:** guardar visita con varias fotos estable; listados con índices OK; firma sin doble click por timeout.

---

## Oleada C — Arquitectura (prioridad 3)

**Meta:** cambios estructurales con más diseño y regresión.  
**Esfuerzo estimado:** varias sesiones.

### C1. Storage privado + signed URLs (Alto / seguridad)
- Buckets: `evidencia_visitas`, `firmas_digitales`, `informes_pdf` → private.
- Backend genera URLs firmadas con TTL corto tras authz.
- Frontend consume solo URLs firmadas (o proxy autenticado).
- Migración de objetos existentes y de URLs públicas guardadas en DB.

### C2. PDF asíncrono (Crítico / performance)
- Firma / entrega EPP no esperan `generarPdf`.
- Job/cola o proceso background + estado `pdf_pendiente | listo | error`.
- Descarga solo desde Storage; si no está, mensaje “generando…”.
- Reduce timeouts y duplicados de firma.

### C3. Paginación de listados (Crítico / performance)
- API: `limit` + `cursor`/`offset` en informes, archivo, plan de acción, EPP, caps, admin.
- Frontend: React Query + infinite scroll o páginas.
- Selects lean (sin nested arrays solo para counts).

### C4. CSRF / SameSite (Alto / seguridad)
- Preferir deploy same-site + `SameSite=Lax` si posible.
- Si se mantiene cross-site: header custom o double-submit CSRF en mutaciones cookie-auth.

### C5. Middleware Next.js (Medio)
- Proteger `/admin`, `/(app)`, `/ente` validando sesión antes del render client.

### C6. Hardening evaluación / cotización públicas (Medio)
- Tokens one-time / expiración; no devolver clave de respuestas completa; rate limit más estricto.

### C7. Supabase Auth
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
| 4+ | C2 (PDF async) en paralelo con diseño de C1 |
| 5+ | C1 storage privado |
| 6+ | C3 paginación |
| 7 | C4, C5, C6, C7 |

---

## Fuera de alcance (por ahora)

- Reescritura completa a RSC en todas las páginas.
- Eliminar índices “unused” del advisor sin medir en prod.
- Refactors UI no ligados a seguridad/performance.

---

## Checklist de verificación global

- [ ] Preventor no firma como dueño (API)
- [ ] Ente no crea/edita informes (API)
- [ ] Upload SVG rechazado
- [ ] Evaluación con DNI malicioso no altera paths
- [ ] Visita con 5+ fotos guarda a la primera
- [ ] Advisor Supabase: FKs críticas indexadas
- [ ] Firma no timeout 20s / no doble registro
- [ ] (Oleada C) PDF no bloquea response
- [ ] (Oleada C) URLs de evidencia no accesibles sin auth

---

## Primera tarea al retomar

**Oleada B casi completa.** Siguiente: **Oleada C** — empezar por **C2 (PDF async)** o **C1 (storage privado)**.
