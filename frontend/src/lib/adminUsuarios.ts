import type { RolUsuario } from "@/types";

export type AccessLevel = "total" | "lectura" | "oculto";

export type RoleOption = {
  value: RolUsuario;
  label: string;
  description: string;
};

export type RoleModulePermission = {
  module: string;
  access: AccessLevel;
  description: string;
};

export const ROLE_OPTIONS: RoleOption[] = [
  {
    value: "preventor",
    label: "Preventor",
    description: "Opera visitas, informes y seguimiento de acciones.",
  },
  {
    value: "dueno",
    label: "Dueño",
    description: "Accede a su empresa y valida información operativa.",
  },
  {
    value: "admin",
    label: "Administrador",
    description: "Gestiona usuarios, empresas y métricas globales.",
  },
  {
    value: "ente_regulador",
    label: "Ente regulador",
    description: "Visualiza información de control con acceso restringido.",
  },
];

export const MODULE_PERMISSIONS: Record<RolUsuario, RoleModulePermission[]> = {
  preventor: [
    {
      module: "Informe de visita",
      access: "total",
      description: "Carga, edita y firma informes asignados.",
    },
    {
      module: "Plan de acción",
      access: "total",
      description: "Crea y actualiza acciones derivadas de hallazgos.",
    },
    {
      module: "Entrega EPP",
      access: "total",
      description: "Registra entregas y firmas del legajo.",
    },
    {
      module: "Capacitaciones",
      access: "total",
      description: "Administra capacitaciones y asistencias.",
    },
    {
      module: "Métricas y reportes",
      access: "lectura",
      description: "Consulta el desempeño operativo de sus empresas.",
    },
    {
      module: "Gestión empresas",
      access: "lectura",
      description: "Visualiza las empresas asignadas para trabajar.",
    },
  ],
  dueno: [
    {
      module: "Informe de visita",
      access: "lectura",
      description: "Consulta los informes de su empresa.",
    },
    {
      module: "Plan de acción",
      access: "total",
      description: "Sigue el estado de las acciones pendientes.",
    },
    {
      module: "Entrega EPP",
      access: "lectura",
      description: "Consulta entregas y trazabilidad.",
    },
    {
      module: "Capacitaciones",
      access: "lectura",
      description: "Visualiza capacitaciones y asistencia.",
    },
    {
      module: "Métricas y reportes",
      access: "total",
      description: "Monitorea indicadores de cumplimiento.",
    },
    {
      module: "Gestión empresas",
      access: "lectura",
      description: "Sólo ve su propia empresa y legajo.",
    },
  ],
  admin: [
    {
      module: "Informe de visita",
      access: "total",
      description: "Control total sobre informes y aprobaciones.",
    },
    {
      module: "Plan de acción",
      access: "total",
      description: "Administra acciones y estados de seguimiento.",
    },
    {
      module: "Entrega EPP",
      access: "total",
      description: "Gestiona entregas y documentación asociada.",
    },
    {
      module: "Capacitaciones",
      access: "total",
      description: "Gestiona altas, material y asistencias.",
    },
    {
      module: "Métricas y reportes",
      access: "total",
      description: "Acceso completo a tablero y reportes globales.",
    },
    {
      module: "Gestión empresas",
      access: "total",
      description: "Alta, edición y asignación de preventores.",
    },
  ],
  ente_regulador: [
    {
      module: "Informe de visita",
      access: "lectura",
      description: "Consulta informes autorizados por la consultora.",
    },
    {
      module: "Plan de acción",
      access: "lectura",
      description: "Visualiza el seguimiento de acciones derivadas.",
    },
    {
      module: "Entrega EPP",
      access: "oculto",
      description: "No accede a este módulo desde el panel.",
    },
    {
      module: "Capacitaciones",
      access: "oculto",
      description: "No accede a este módulo desde el panel.",
    },
    {
      module: "Métricas y reportes",
      access: "lectura",
      description: "Consulta indicadores de control.",
    },
    {
      module: "Gestión empresas",
      access: "oculto",
      description: "No puede administrar empresas.",
    },
  ],
};

export function getRoleLabel(role: RolUsuario) {
  return ROLE_OPTIONS.find((option) => option.value === role)?.label || role;
}

export function getRoleDescription(role: RolUsuario) {
  return (
    ROLE_OPTIONS.find((option) => option.value === role)?.description || ""
  );
}

export function getRoleBadgeClasses(role: RolUsuario) {
  switch (role) {
    case "admin":
      return "bg-blue-700 text-white border border-blue-700";
    case "preventor":
      return "bg-blue-50 text-blue-700 border border-blue-100";
    case "dueno":
      return "bg-indigo-50 text-indigo-700 border border-indigo-100";
    case "ente_regulador":
      return "bg-sky-50 text-sky-700 border border-sky-100";
    default:
      return "bg-slate-50 text-slate-700 border border-slate-200";
  }
}

export function getAccessLabel(access: AccessLevel) {
  switch (access) {
    case "total":
      return "Total";
    case "lectura":
      return "Solo lectura";
    case "oculto":
      return "Oculto";
  }
}

export function getAccessBadgeClasses(access: AccessLevel) {
  switch (access) {
    case "total":
      return "bg-blue-50 text-blue-700 border border-blue-100";
    case "lectura":
      return "bg-sky-50 text-sky-700 border border-sky-100";
    case "oculto":
      return "bg-slate-50 text-slate-500 border border-slate-200";
  }
}
