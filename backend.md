# Estrategia de Backend (Node.js + Express + TypeScript)

## 1. Stack Tecnológico
| Componente | Tecnología |
|------------|------------|
| Runtime | Node.js 20+ |
| Framework | Express.js |
| Lenguaje | TypeScript |
| Base de datos | `@supabase/supabase-js` (service role para operaciones privilegiadas) |
| Validación | `zod` |
| PDF | `pdfkit` (diseño tabular alineado al Excel `CONSTANCIA DE VISITA`) |
| QR | `qrcode` |
| Uploads | `multer` (MemoryStorage) → Supabase Storage |

## 2. Principio de Diseño
- El backend es la **única capa de lógica de negocio** (firmas, PDF, plan de acción, métricas).
- El frontend **no** escribe directamente en tablas sensibles; usa la API.
- Los endpoints de Fases 2 y 3 se declaran desde el inicio como rutas stub (`501 Not Implemented`) para mantener el contrato de API estable.

## 3. Estructura de Carpetas

```
backend/
├── src/
│   ├── config/           # supabase.ts, env.ts
│   ├── middlewares/      # requireAuth, requireRole, errorHandler, validate
│   ├── routes/
│   │   ├── auth.routes.ts
│   │   ├── empresas.routes.ts
│   │   ├── informes.routes.ts
│   │   ├── planAccion.routes.ts
│   │   ├── capacitaciones.routes.ts   # stub Fase 2
│   │   ├── epp.routes.ts              # stub Fase 3
│   │   └── admin.routes.ts            # CRM Fase 3
│   ├── controllers/
│   ├── services/
│   │   ├── informe.service.ts
│   │   ├── firma.service.ts
│   │   ├── pdf.service.ts
│   │   ├── planAccion.service.ts
│   │   └── dashboard.service.ts
│   ├── schemas/          # zod schemas por dominio
│   ├── types/            # Tipos alineados 1:1 con base_de_datos.md
│   └── index.ts
├── package.json
└── tsconfig.json
```

## 4. Autenticación

### Flujo de login (app empresa)
```
POST /api/auth/login
Body: { cuit, username, password }
```
1. Buscar `empresa` por CUIT.
2. Autenticar con Supabase Auth (`email` derivado o `username` + password).
3. Validar que `perfil.empresa_id` coincida con la empresa del CUIT (dueños) o que el preventor tenga la empresa asignada.
4. Devolver `{ access_token, refresh_token, perfil, empresa }`.

### Flujo de login (CRM/Admin)
```
POST /api/auth/login-admin
Body: { email, password }
```
Solo roles `admin` y `preventor`.

### Middleware `requireAuth`
Valida JWT Bearer. Adjunta `req.user = { id, rol, empresa_id, consultora_id }`.

### Middleware `requireRole(...roles)`
Restringe endpoints por rol.

## 5. Endpoints — Fase 1 (prioridad inmediata)

### Auth y configuración
| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/api/auth/login` | Login CUIT + usuario + contraseña |
| POST | `/api/auth/login-admin` | Login panel CRM |
| POST | `/api/auth/logout` | Invalidar sesión |
| GET | `/api/auth/me` | Perfil y empresa actual |

### Empresas y logos
| Método | Ruta | Rol | Descripción |
|--------|------|-----|-------------|
| GET | `/api/empresas/:id` | dueño/admin/preventor | Datos de empresa |
| POST | `/api/empresas/:id/logo` | dueno/admin | Subir logo empresa (Storage) |
| POST | `/api/consultoras/:id/logo` | admin | Subir logo consultora |

### Informes de visita
| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/api/informes` | Crear informe (cabecera + peligros + puntos + acciones en transacción) |
| GET | `/api/informes` | Listar por empresa (query: `empresaId`, `desde`, `hasta`) |
| GET | `/api/informes/:id` | Detalle completo con relaciones |
| PATCH | `/api/informes/:id` | Editar borrador (solo si `estado_firma = borrador`) |
| POST | `/api/informes/:id/evidencia` | Subir foto de punto a mejorar (multer → Storage) |

### Firmas y PDF
| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/api/informes/:id/firma-preventor` | Guarda firma, estado → `pendiente_dueno`, notifica dueño |
| POST | `/api/informes/:id/firma-dueno` | Guarda firma, estado → `firmado`, dispara PDF |
| GET | `/api/informes/:id/pdf` | Genera/descarga PDF (incluye logos consultora + empresa) |

### Plan de acción y archivo
| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/plan-accion` | Acciones por empresa con filtros de estado |
| PATCH | `/api/plan-accion/:id` | Cambiar estado (pendiente → cumplida/atendida) |
| GET | `/api/plan-accion/export` | Exportar Excel o PDF (`?format=xlsx\|pdf`) |
| GET | `/api/archivo` | Explorador histórico (informes + PDFs por fecha) |

### Dashboard
| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/dashboard/:empresaId` | Métricas: % cumplimiento, informes mes, obs. abiertas |

## 6. Endpoints — Fases 2 y 3 (stub inicial)

Devuelven `501` con mensaje claro hasta implementación:

```
POST   /api/capacitaciones
GET    /api/capacitaciones/:id/qr
POST   /api/capacitaciones/:id/asistencia
GET    /api/admin/usuarios
GET    /api/admin/empresas
POST   /api/epp/entregas
POST   /api/epp/licitaciones
```

## 7. Servicio de PDF (`pdf.service.ts`)
El PDF replica la estructura del Excel `CONSTANCIA DE VISITA.xlsx`:
1. Logos consultora (izq.) y empresa (der.)
2. N° de informe, cliente, actividad, fecha/hora, lugar, contacto
3. Bloque peligros detectados / medida de control
4. Puntos a mejorar con detalle
5. Listado de acciones de mejora con estado
6. Firmas: Responsable empresa + Prof. Seguridad e Higiene

## 8. Payload de creación de informe (referencia)

```typescript
// POST /api/informes
{
  empresa_id: string;
  actividad: string;
  fecha_hora_visita: string; // ISO 8601
  lugar_visita: string;
  contacto_visita: string;
  peligros: Array<{ descripcion: string; medida_control?: string }>;
  puntos_mejora: Array<{
    detalle: string;
    acciones: Array<{ descripcion: string }>;
  }>;
}
```

El servicio asigna `numero_informe` vía función SQL, crea `acciones_mejora` en estado `pendiente` y deja el informe en `borrador`.

## 9. Prevención de Errores
- **Manejo centralizado:** `catchAsync` + middleware `errorHandler` global.
- **CORS:** Solo origen del frontend (env `FRONTEND_URL`).
- **Validación:** Todo body/params validado con zod antes del controller.
- **Transacciones:** Creación de informe completo en una sola operación (rollback si falla).
- **Tipos compartidos:** Los tipos de `/types` deben coincidir con `base_de_datos.md` para evitar drift frontend ↔ backend.

## 10. Variables de Entorno

```env
PORT=4000
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
FRONTEND_URL=http://localhost:3000
```
