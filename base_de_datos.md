# Estrategia de Base de Datos (Supabase / PostgreSQL)

## 1. Principio de Diseño
El esquema se define **completo desde el inicio** para las 3 fases del contrato. Las tablas de Fases 2 y 3 se crean en la migración inicial (vacías o con RLS básico) para evitar reestructuraciones cuando se implementen capacitación, EPP y CRM.

**Stack:** PostgreSQL (Supabase) + Supabase Auth + Supabase Storage + RLS con funciones `SECURITY DEFINER`.

---

## 2. Diagrama de Relaciones (resumen)

```
consultoras ──┬── empresas ──┬── informes_visita ──┬── peligros_detectados
              │              │                     ├── puntos_mejora ── acciones_mejora
              │              │                     └── firmas_informe
              │              ├── capacitaciones ──┬── capacitacion_preguntas
              │              │                    ├── capacitacion_asistencias
              │              │                    └── capacitacion_materiales
              │              └── epp_entregas
              │
perfiles ─────┴── preventor_empresas (N:M)
              └── ente_regulador_empresas (N:M, solo lectura)
```

---

## 3. Enums

```sql
CREATE TYPE rol_usuario AS ENUM ('admin', 'preventor', 'dueno', 'ente_regulador');
CREATE TYPE estado_firma_informe AS ENUM ('borrador', 'pendiente_preventor', 'pendiente_dueno', 'firmado', 'archivado');
CREATE TYPE estado_accion AS ENUM ('pendiente', 'cumplida', 'atendida');
CREATE TYPE tipo_firma AS ENUM ('preventor', 'dueno', 'asistente_capacitacion');
CREATE TYPE estado_capacitacion AS ENUM ('borrador', 'activa', 'cerrada');
CREATE TYPE estado_entrega_epp AS ENUM ('registrada', 'firmada', 'anulada');
```

---

## 4. Tablas — Núcleo Multi-tenant

### `consultoras`
Soporte white-label: cada consultora que usa la plataforma.
| Columna | Tipo | Notas |
|---------|------|-------|
| `id` | UUID PK | |
| `nombre` | TEXT NOT NULL | |
| `logo_url` | TEXT | Storage: `logos_consultora/` |
| `config` | JSONB DEFAULT '{}' | Comisiones EPP, campos custom, etc. |
| `created_at` | TIMESTAMPTZ | |

### `empresas`
Clientes visitados / dueños del legajo.
| Columna | Tipo | Notas |
|---------|------|-------|
| `id` | UUID PK | |
| `consultora_id` | UUID FK → consultoras | |
| `cuit` | TEXT UNIQUE NOT NULL | Usado en login |
| `razon_social` | TEXT NOT NULL | |
| `actividad` | TEXT | Rubro/actividad |
| `logo_url` | TEXT | Storage: `logos_empresa/` |
| `porcentaje_cumplimiento` | NUMERIC(5,2) | Calculado o cacheado para dashboard |
| `created_at` | TIMESTAMPTZ | |

### `perfiles`
Extiende `auth.users` de Supabase.
| Columna | Tipo | Notas |
|---------|------|-------|
| `id` | UUID PK FK → auth.users | |
| `consultora_id` | UUID FK → consultoras | Nulo solo para entes reguladores globales |
| `empresa_id` | UUID FK → empresas | Solo para rol `dueno` |
| `nombre_completo` | TEXT | |
| `username` | TEXT UNIQUE | Login junto con CUIT |
| `rol` | rol_usuario | |
| `activo` | BOOLEAN DEFAULT true | |
| `created_at` | TIMESTAMPTZ | |

### `preventor_empresas`
Asignación N:M preventor ↔ empresas (feature 24.0).
| Columna | Tipo |
|---------|------|
| `preventor_id` | UUID FK → perfiles |
| `empresa_id` | UUID FK → empresas |
| PK compuesta `(preventor_id, empresa_id)` | |

### `ente_regulador_empresas`
Acceso de solo lectura para ART/Municipio (feature 28.0).
| Columna | Tipo |
|---------|------|
| `ente_id` | UUID FK → perfiles |
| `empresa_id` | UUID FK → empresas |
| `permisos` | JSONB | Qué módulos puede ver |

---

## 5. Tablas — Módulo 1: Informe de Visita

### `informes_visita`
Cabecera del informe (mapea `CONSTANCIA DE VISITA.xlsx`).
| Columna | Tipo | Notas |
|---------|------|-------|
| `id` | UUID PK | |
| `empresa_id` | UUID FK → empresas | |
| `preventor_id` | UUID FK → perfiles | |
| `numero_informe` | INTEGER | Correlativo por empresa (secuencia o trigger) |
| `actividad` | TEXT | |
| `fecha_hora_visita` | TIMESTAMPTZ NOT NULL | |
| `lugar_visita` | TEXT | |
| `contacto_visita` | TEXT | |
| `estado_firma` | estado_firma_informe DEFAULT 'borrador' | |
| `url_pdf_generado` | TEXT | Storage: `informes_pdf/` |
| `created_at` | TIMESTAMPTZ | |
| `updated_at` | TIMESTAMPTZ | |

**Índices:** `(empresa_id, fecha_hora_visita DESC)`, `(empresa_id, numero_informe)`.

### `peligros_detectados`
Sección "Peligros detectados / medida de control".
| Columna | Tipo |
|---------|------|
| `id` | UUID PK |
| `informe_id` | UUID FK → informes_visita ON DELETE CASCADE |
| `descripcion` | TEXT NOT NULL |
| `medida_control` | TEXT |
| `orden` | SMALLINT DEFAULT 0 |

### `puntos_mejora`
Ítems "Puntos a mejorar detectados en la visita".
| Columna | Tipo |
|---------|------|
| `id` | UUID PK |
| `informe_id` | UUID FK → informes_visita ON DELETE CASCADE |
| `numero_item` | SMALLINT | ITEM 1, ITEM 2... |
| `detalle` | TEXT NOT NULL |
| `evidencia_url` | TEXT | Storage: `evidencia_visitas/` |
| `orden` | SMALLINT DEFAULT 0 |

### `acciones_mejora`
Plan de acción alimentado desde informes (feature 9.0). Aparece en listado con ESTADO.
| Columna | Tipo |
|---------|------|
| `id` | UUID PK |
| `informe_id` | UUID FK → informes_visita | Origen del informe |
| `empresa_id` | UUID FK → empresas | Desnormalizado para consultas rápidas del plan |
| `punto_mejora_id` | UUID FK → puntos_mejora | Opcional |
| `numero_item` | SMALLINT | |
| `descripcion` | TEXT NOT NULL | |
| `estado` | estado_accion DEFAULT 'pendiente' | PENDIENTE / CUMPLIDA / ATENDIDA |
| `fecha_cumplimiento` | TIMESTAMPTZ | |
| `created_at` | TIMESTAMPTZ | |

### `firmas_informe`
Trazabilidad de firmas electrónicas (reutilizable en capacitaciones).
| Columna | Tipo |
|---------|------|
| `id` | UUID PK |
| `informe_id` | UUID FK → informes_visita | |
| `firmante_id` | UUID FK → perfiles | |
| `tipo` | tipo_firma | preventor / dueno |
| `firma_url` | TEXT | Storage: `firmas_digitales/` |
| `firmado_at` | TIMESTAMPTZ | |
| `ip_address` | INET | Opcional, trazabilidad |

---

## 6. Tablas — Módulo 2: Capacitación (esquema Fase 2)

### `capacitaciones`
| Columna | Tipo |
|---------|------|
| `id` | UUID PK |
| `empresa_id` | UUID FK |
| `preventor_id` | UUID FK → perfiles |
| `titulo` | TEXT |
| `temario` | TEXT |
| `fecha` | TIMESTAMPTZ |
| `qr_token` | TEXT UNIQUE | Token del QR de asistencia |
| `estado` | estado_capacitacion |
| `created_at` | TIMESTAMPTZ |

### `capacitacion_preguntas`
| Columna | Tipo |
|---------|------|
| `id` | UUID PK |
| `capacitacion_id` | UUID FK |
| `enunciado` | TEXT |
| `opciones` | JSONB | Array de opciones |
| `respuesta_correcta` | TEXT |
| `orden` | SMALLINT |

### `capacitacion_asistencias`
| Columna | Tipo |
|---------|------|
| `id` | UUID PK |
| `capacitacion_id` | UUID FK |
| `nombre_empleado` | TEXT |
| `documento` | TEXT | DNI/legajo |
| `sector` | TEXT |
| `puntaje` | NUMERIC(5,2) | |
| `firma_url` | TEXT | |
| `firmado_at` | TIMESTAMPTZ |

### `capacitacion_materiales`
Enlaces de difusión vía WhatsApp (feature 16.0).
| Columna | Tipo |
|---------|------|
| `id` | UUID PK |
| `capacitacion_id` | UUID FK |
| `titulo` | TEXT |
| `url_enlace` | TEXT |
| `requiere_firma` | BOOLEAN DEFAULT true |

---

## 7. Tablas — Módulo 3: EPP (esquema Fase 3)

### `epp_tipos`
Catálogo de EPP con foto y descripción.
| Columna | Tipo |
|---------|------|
| `id` | UUID PK |
| `consultora_id` | UUID FK |
| `nombre` | TEXT |
| `descripcion` | TEXT |
| `foto_url` | TEXT |
| `activo` | BOOLEAN DEFAULT true |

### `epp_entregas`
Registro Res. SRT 299/11.
| Columna | Tipo |
|---------|------|
| `id` | UUID PK |
| `empresa_id` | UUID FK |
| `preventor_id` | UUID FK |
| `empleado_documento` | TEXT |
| `empleado_nombre` | TEXT |
| `epp_tipo_id` | UUID FK → epp_tipos |
| `cantidad` | INTEGER DEFAULT 1 |
| `estado` | estado_entrega_epp |
| `firma_empleado_url` | TEXT |
| `url_registro_oficial` | TEXT | PDF generado |
| `entregado_at` | TIMESTAMPTZ |

### `epp_licitaciones` / `epp_licitacion_cotizaciones`
Stub para feature 21.0 (proveedores, cotizaciones, comisión configurable en `consultoras.config`).

---

## 8. Secuencia de N° de Informe

```sql
CREATE OR REPLACE FUNCTION next_numero_informe(p_empresa_id UUID)
RETURNS INTEGER
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT COALESCE(MAX(numero_informe), 0) + 1
  FROM informes_visita
  WHERE empresa_id = p_empresa_id;
$$;
```

---

## 9. Seguridad RLS — Funciones Helper (evitar recursión 42P17)

**Nunca** consultar `perfiles` dentro de una política RLS de `perfiles` sin `SECURITY DEFINER`.

```sql
-- Rol del usuario actual
CREATE OR REPLACE FUNCTION get_user_role()
RETURNS rol_usuario LANGUAGE sql SECURITY DEFINER STABLE
AS $$ SELECT rol FROM perfiles WHERE id = auth.uid(); $$;

-- Empresa del dueño
CREATE OR REPLACE FUNCTION get_user_empresa_id()
RETURNS UUID LANGUAGE sql SECURITY DEFINER STABLE
AS $$ SELECT empresa_id FROM perfiles WHERE id = auth.uid(); $$;

-- Consultora del usuario
CREATE OR REPLACE FUNCTION get_user_consultora_id()
RETURNS UUID LANGUAGE sql SECURITY DEFINER STABLE
AS $$ SELECT consultora_id FROM perfiles WHERE id = auth.uid(); $$;

-- ¿El preventor tiene acceso a esta empresa?
CREATE OR REPLACE FUNCTION preventor_tiene_empresa(p_empresa_id UUID)
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM preventor_empresas
    WHERE preventor_id = auth.uid() AND empresa_id = p_empresa_id
  );
$$;
```

### Políticas clave (ejemplos)

| Tabla | Quién lee | Quién escribe |
|-------|-----------|---------------|
| `empresas` | admin (su consultora), preventor (asignadas), dueño (la suya), ente (habilitadas) | admin |
| `informes_visita` | preventor (sus empresas), dueño (su empresa), admin | preventor crea; dueño solo firma |
| `acciones_mejora` | misma lógica que informes | preventor/dueno según estado |
| `capacitaciones` | misma lógica (Fase 2) | preventor |

---

## 10. Storage (Buckets)

| Bucket | Contenido | Acceso |
|--------|-----------|--------|
| `logos_consultora` | Logo white-label | Público o signed URL |
| `logos_empresa` | Logo del cliente | Privado por empresa |
| `evidencia_visitas` | Fotos de puntos a mejorar | Privado por empresa |
| `firmas_digitales` | Canvas de firmas | Privado |
| `informes_pdf` | PDFs finales firmados | Privado por empresa |
| `capacitacion_materiales` | Archivos de difusión | Privado (Fase 2) |
| `epp_fotos` | Fotos de tipos de EPP | Privado (Fase 3) |

---

## 11. Vistas Útiles (Dashboard)

```sql
-- Métricas por empresa para el dashboard (feature 4.0 / 27.0)
CREATE VIEW v_dashboard_empresa AS
SELECT
  e.id AS empresa_id,
  e.razon_social,
  COUNT(DISTINCT iv.id) FILTER (WHERE iv.fecha_hora_visita >= date_trunc('month', now())) AS informes_mes,
  COUNT(am.id) FILTER (WHERE am.estado = 'pendiente') AS observaciones_abiertas,
  ROUND(
    100.0 * COUNT(am.id) FILTER (WHERE am.estado IN ('cumplida','atendida'))
    / NULLIF(COUNT(am.id), 0), 1
  ) AS porcentaje_cumplimiento
FROM empresas e
LEFT JOIN informes_visita iv ON iv.empresa_id = e.id
LEFT JOIN acciones_mejora am ON am.empresa_id = e.id
GROUP BY e.id, e.razon_social;
```

---

## 12. Orden de Migraciones Sugerido

1. Enums + tablas núcleo (`consultoras`, `empresas`, `perfiles`, `preventor_empresas`)
2. Trigger `on_auth_user_created` → insertar en `perfiles`
3. Módulo 1 (`informes_visita`, `peligros_detectados`, `puntos_mejora`, `acciones_mejora`, `firmas_informe`)
4. Funciones RLS + políticas Módulo 1
5. Storage buckets + políticas de Storage
6. Tablas stub Módulos 2 y 3 (sin políticas complejas aún)
7. Vista `v_dashboard_empresa`
