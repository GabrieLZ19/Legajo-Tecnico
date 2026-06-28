# Estrategia de Frontend (Next.js + TypeScript)

> **Alcance:** únicamente **web responsive** (PWA opcional en el futuro). No se desarrolla app nativa iOS/Android.

## 1. Stack Tecnológico
| Componente | Tecnología |
|------------|------------|
| Framework | Next.js (App Router) |
| Lenguaje | TypeScript |
| Estilos | Tailwind CSS (*Mobile First*) |
| Componentes UI | shadcn/ui |
| Estado servidor | TanStack Query (React Query) |
| HTTP | Axios con interceptor JWT |
| Firmas | `react-signature-canvas` |
| Auth inicial | Supabase JS SDK para sesión; API Node para lógica |

## 2. Dos Superficies de Usuario (misma web responsive)
Según los diseños en Drive (`Diseño Web General`, `Diseño Web CRM`; los mockups "App" son referencia de layout móvil en navegador):

| Superficie | Usuarios | Rutas base |
|------------|----------|------------|
| **Web Empresa** | Dueño, Preventor en campo | `/login`, `/dashboard`, `/informes`, `/plan-accion`, `/archivo` |
| **Panel CRM / Admin** | Admin, Preventor (gestión) | `/admin/login`, `/admin/dashboard`, `/admin/usuarios`, `/admin/empresas` |

Fase 1 implementa la superficie **Web Empresa**. El CRM se maqueta en Fase 3 pero las rutas `/admin/*` pueden existir como placeholder.

## 3. Estructura de Carpetas

```
frontend/
├── src/
│   ├── app/
│   │   ├── (auth)/login/page.tsx          # CUIT + usuario + contraseña
│   │   ├── (app)/
│   │   │   ├── dashboard/page.tsx
│   │   │   ├── informes/
│   │   │   │   ├── page.tsx               # Listado (5.3 / W03)
│   │   │   │   ├── nuevo/page.tsx         # Wizard (5.4 / W04)
│   │   │   │   └── [id]/
│   │   │   │       ├── page.tsx           # Detalle (W05)
│   │   │   │       ├── firma/page.tsx     # Flujo 5.6a–d
│   │   │   │       └── esperando/page.tsx # 5.6b
│   │   │   ├── plan-accion/page.tsx       # 5.7 / W06
│   │   │   ├── archivo/page.tsx           # 5.8 / W07
│   │   │   └── configuracion/page.tsx     # Logos empresa (5.18)
│   │   └── admin/                         # Fase 3
│   ├── components/
│   │   ├── ui/                            # shadcn
│   │   ├── forms/InformeVisitaWizard/
│   │   ├── FirmaCanvas.tsx
│   │   └── EvidenciaUpload.tsx
│   ├── hooks/                             # useAuth, useInformes, useDashboard
│   ├── lib/                               # api.ts, supabase.ts
│   └── types/                             # Alineados con base_de_datos.md
```

## 4. Prioridades Fase 1 (demo)

### A. Login (`5.1 Login CUIT` / `W01_Login`)
- Campos: **CUIT**, **Usuario**, **Contraseña**
- Estados: loading, error de credenciales, empresa no encontrada
- Tras login: redirect a `/dashboard`

### B. Dashboard (`W02_Dashboard`)
Métricas desde `GET /api/dashboard/:empresaId`:
- Porcentaje "Empresa Segura" (cumplimiento acciones)
- Informes del mes
- Observaciones abiertas
- Accesos rápidos a módulos habilitados

Si el endpoint no está listo, mock temporal con banner "datos de demostración".

### C. Informes — Wizard Mobile (`5.4 Modal Nuevo Informe`)
Pasos del wizard (no saturar pantalla móvil):
1. **Datos generales:** actividad, fecha/hora, lugar, contacto
2. **Peligros y puntos a mejorar:** agregar ítems dinámicos + fotos (`capture="environment"`)
3. **Revisión y firma preventor:** canvas de firma → `POST /api/informes/:id/firma-preventor`

### D. Flujo de firma dual (`5.6a` → `5.6d`)
| Pantalla | Actor | Acción |
|----------|-------|--------|
| Firma Preventor | Preventor | Firma y envía |
| Esperando Dueño | Preventor | Estado intermedio + notificación |
| Firma Dueño | Dueño | Firma desde su sesión |
| Confirmación | Ambos | PDF generado, link de descarga |

### E. Configuración de logos (`5.18 Config Logos`)
- Dueño: subir logo de su empresa (`POST /api/empresas/:id/logo`)
- Admin: subir logo consultora (panel admin, Fase 3)

## 5. Tipos TypeScript (alineados con BD)

```typescript
// src/types/index.ts
export type RolUsuario = 'admin' | 'preventor' | 'dueno' | 'ente_regulador';
export type EstadoFirmaInforme = 'borrador' | 'pendiente_preventor' | 'pendiente_dueno' | 'firmado' | 'archivado';
export type EstadoAccion = 'pendiente' | 'cumplida' | 'atendida';

export interface Empresa {
  id: string;
  cuit: string;
  razon_social: string;
  actividad?: string;
  logo_url?: string;
}

export interface InformeVisita {
  id: string;
  empresa_id: string;
  preventor_id: string;
  numero_informe: number;
  actividad?: string;
  fecha_hora_visita: string;
  lugar_visita?: string;
  contacto_visita?: string;
  estado_firma: EstadoFirmaInforme;
  url_pdf_generado?: string;
  peligros_detectados?: PeligroDetectado[];
  puntos_mejora?: PuntoMejora[];
  acciones_mejora?: AccionMejora[];
}

export interface AccionMejora {
  id: string;
  descripcion: string;
  estado: EstadoAccion;
  numero_item: number;
}
```

## 6. Integración con Backend
1. Login vía `POST /api/auth/login` → guardar tokens (httpOnly cookie o secure storage).
2. Axios interceptor: `Authorization: Bearer <token>` en cada request.
3. React Query: cache de informes y dashboard; invalidar tras crear/firmar.
4. **No escribir directo a Supabase** desde el frontend excepto para auth inicial si se usa SDK.

## 7. UX Mobile First
- Bottom navigation en móvil para Dashboard / Informes / Plan / Archivo
- Formularios en pasos con barra de progreso
- Skeletons durante carga
- Toasts para feedback ("Informe guardado", "Firma registrada")
- Inputs de fecha/hora nativos del dispositivo

## 8. Roadmap Frontend por Fase
| Fase | Pantallas nuevas |
|------|------------------|
| 1 | Login, Dashboard, Informes, Firmas, Plan Acción, Archivo, Config logos |
| 2 | Capacitaciones, QR modal, Evaluación digital, Difusión material |
| 3 | EPP entrega, Licitación, Panel CRM completo, Ente regulador |
