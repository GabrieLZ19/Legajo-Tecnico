# Requerimientos del Proyecto: Legajo Técnico (Web Responsive)

## Descripción General
Plataforma **web responsive** de gestión digital de seguridad e higiene laboral (sin app nativa ni publicación en stores). Diseñada con enfoque *Mobile First* para usarse desde el navegador del celular o desktop. Permite a consultoras de higiene y seguridad gestionar informes de visita, capacitaciones, planes de acción, entregas de EPP y un panel CRM/administrativo.

**Contrato:** WHAPY LLC ↔ Diego Ariel Ludueña — Cronograma ~5 meses (Jun–Nov 2026)  
**Referencia de diseño y alcance:** [Carpeta Google Drive del proyecto](https://drive.google.com/drive/u/0/folders/1OUrMMlsysl0TsCuzheR-RQj4uOF6cv-o)

## Actores y Roles
| Rol | Descripción |
|-----|-------------|
| **Admin del Sistema** | Gestión global: usuarios, empresas, preventores, métricas, archivo completo |
| **Preventor** | Crea informes en campo, firma, gestiona capacitaciones y entregas EPP de sus empresas asignadas |
| **Dueño de Empresa** | Firma informes, ve dashboard de cumplimiento de su empresa, accede al archivo histórico |
| **Ente Regulador** | Acceso de solo lectura limitado (ART/Municipio), según permisos del admin |

## Autenticación
- Login con **CUIT de empresa + usuario + contraseña** (la app se ingresa en contexto de una empresa).
- Panel CRM/Admin: login separado para administradores y preventores.
- Gestión de sesiones vía Supabase Auth + JWT validado en el backend Node.js.

## White-label / Logos (requisito del Excel)
La herramienta puede ser usada por distintas consultoras. Cada instancia debe permitir:
1. **Logo de consultora** (parte superior del informe/PDF) — configurable por el admin del sistema.
2. **Logo de empresa visitada** (lado opuesto) — configurable por el dueño de la empresa al ingresar por CUIT.

Estos logos deben persistirse en Storage y usarse en la generación de PDFs.

---

## Fases y Módulos (34 features totales)

### Fase 1 — Módulo 1: Informe de Visita (Jun–Jul 2026)
| # | Feature | Prioridad |
|---|---------|-----------|
| 1.0 | Diseño UI/UX completo (web y mobile, Mobile First) | Crítica |
| 2.0 | Arquitectura general de la plataforma | Crítica |
| 3.0 | Autenticación segura con gestión de sesiones y roles | Crítica |
| 4.0 | Dashboard principal: estado global de cumplimiento por empresa | Alta |
| 5.0 | Creación de informes de visita en campo | Crítica |
| 6.0 | Flujo de firma dual (Preventor → Dueño) | Crítica |
| 7.0 | Generación de informe en PDF con firmas electrónicas | Crítica |
| 8.0 | Lista de observaciones al pie (atendidas vs pendientes) | Alta |
| 9.0 | Plan de Acción descargable en Excel y PDF | Alta |
| 10.0 | Archivo histórico por empresa y fecha (explorador) | Alta |
| 11.0 | Interfaz web de campo optimizada (Mobile First, sin instalación) | Alta |

#### Estructura del Informe (basada en `CONSTANCIA DE VISITA.xlsx`)
Cada informe debe capturar:
- **N° de informe** (correlativo por empresa)
- **Cliente** (empresa visitada)
- **Actividad**
- **Fecha y hora de visita**
- **Lugar de visita**
- **Contacto de la visita**
- **Peligros detectados / medida de control** (texto libre o bloques)
- **Puntos a mejorar** (ítems con detalle, evidencia fotográfica y acciones de mejora asociadas)
- **Listado de acciones de mejora** con estado: `PENDIENTE` | `CUMPLIDA` | `ATENDIDA`
- **Firmas:** Responsable por la empresa (dueño) + Prof. Seguridad e Higiene (preventor)

### Fase 2 — Módulo 2: Capacitación (Jul–Ago 2026)
| # | Feature | Prioridad |
|---|---------|-----------|
| 12.0 | Creación de capacitaciones (temario, preguntas/respuestas, empresa, fecha) | Crítica |
| 13.0 | Generación de código QR por capacitación (asistencia) | Crítica |
| 14.0 | Evaluación digital interactiva con corrección automática (vía QR) | Crítica |
| 15.0 | Botón "Firmar Asistencia" con firma electrónica vinculante | Crítica |
| 16.0 | Difusión de material vía enlace web (WhatsApp) | Alta |
| 17.0 | Base de datos de registros con exportación PDF/Excel y filtros | Alta |

### Fase 3 — Módulo 3: EPP + Panel CRM (Ago–Sep 2026)
| # | Feature | Prioridad |
|---|---------|-----------|
| 18.0 | Registro digital de entrega de EPP por lectura de QR del empleado | Crítica |
| 19.0 | Selección de tipo de EPP con fotos y descripción | Alta |
| 20.0 | Generación del registro oficial de entrega (Res. SRT 299/11) | Crítica |
| 21.0 | Módulo de licitación de EPP (proveedores, cotizaciones, comisión configurable) | Alta |
| 22.0 | Roles jerárquicos independientes (Admin, Dueño, Preventor, Ente Regulador) | Crítica |
| 23.0 | Dashboard de control global por empresa | Alta |
| 24.0 | Gestión de usuarios y asignación de empresas a preventores | Alta |
| 25.0 | Gestión de empresas clientes del preventor | Alta |
| 26.0 | Acceso al archivo histórico completo | Alta |
| 27.0 | Métricas de cumplimiento por empresa y consolidadas | Alta |
| 28.0 | Acceso diferenciado para entes reguladores | Media |
| 29.0 | Soporte técnico para dominio legajotecnico.com | Media |

### Cierre — Testing y Entrega (Sep–Nov 2026)
Features 30.0 a 34.0: testing integral, correcciones, despliegue, entrega de código y soporte post-lanzamiento (2 semanas).

## Fuera de Alcance (v1)
- App nativa en App Store / Google Play
- Integración con sistemas externos (ART, ERP)
- Pasarela de pago para comisiones de licitación (el sistema calcula; cobro online es adicional)
- Alertas de vencimientos documentales
- Multi-preventor con delegación de tareas
- Reportes analíticos avanzados

---

## Orden de Implementación Acordado
Para evitar reestructuraciones, el desarrollo sigue este orden estricto:

1. **Supabase (Base de Datos):** Modelo completo desde el inicio (tablas de Fase 1 operativas + tablas de Fases 2 y 3 como esquema vacío/stub). Ver `base_de_datos.md`.
2. **Backend (Node.js + Express + TypeScript):** API con autenticación, informes, firmas, PDF y endpoints stub para módulos futuros. Ver `backend.md`.
3. **Frontend (Next.js):** Login, Dashboard, Informes de Visita. Ver `frontend.md`.

## Prioridad Inmediata (demo)
1. Base de Datos (Supabase): migraciones, RLS, Storage, funciones helper.
2. Backend: API de informes, firmas y generación de PDF.
3. Frontend: Login (CUIT), Dashboard y wizard de creación de informe.
