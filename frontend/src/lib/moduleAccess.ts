import type { Perfil, RolUsuario } from "@/types";
import {
  resolveModulePermissions,
  type AccessLevel,
  type RoleModulePermission,
} from "@/lib/adminUsuarios";

export type AppModuleKey =
  | "informes"
  | "planAccion"
  | "epp"
  | "capacitaciones";

export type AppNavModule = {
  key: AppModuleKey;
  module: string;
  href: string;
  label: string;
  shortLabel: string;
};

/** Módulos del navbar / dashboard vinculados a permisos_personalizados. */
export const APP_NAV_MODULES: AppNavModule[] = [
  {
    key: "informes",
    module: "Informe de visita",
    href: "/informes",
    label: "Informes",
    shortLabel: "Informes",
  },
  {
    key: "planAccion",
    module: "Plan de acción",
    href: "/plan-accion",
    label: "Plan de Acción",
    shortLabel: "Plan",
  },
  {
    key: "epp",
    module: "Entrega EPP",
    href: "/epp",
    label: "EPP",
    shortLabel: "EPP",
  },
  {
    key: "capacitaciones",
    module: "Capacitaciones",
    href: "/capacitaciones",
    label: "Capacitaciones",
    shortLabel: "Capacit.",
  },
];

function asPermissionList(
  value: Perfil["permisos_personalizados"],
): RoleModulePermission[] | null {
  if (!value || !Array.isArray(value)) return null;
  return value as RoleModulePermission[];
}

export function getResolvedPermissions(
  user: Pick<Perfil, "rol" | "permisos_personalizados"> | null | undefined,
): RoleModulePermission[] {
  if (!user?.rol) return [];
  return resolveModulePermissions(
    user.rol as RolUsuario,
    asPermissionList(user.permisos_personalizados),
  );
}

export function getModuleAccess(
  user: Pick<Perfil, "rol" | "permisos_personalizados"> | null | undefined,
  moduleName: string,
): AccessLevel {
  const resolved = getResolvedPermissions(user);
  const found = resolved.find((item) => item.module === moduleName);
  return found?.access || "oculto";
}

export function canAccessModule(
  user: Pick<Perfil, "rol" | "permisos_personalizados"> | null | undefined,
  moduleName: string,
): boolean {
  return getModuleAccess(user, moduleName) !== "oculto";
}

export function canWriteModule(
  user: Pick<Perfil, "rol" | "permisos_personalizados"> | null | undefined,
  moduleName: string,
): boolean {
  if (!user || user.rol === "ente_regulador") return false;
  return getModuleAccess(user, moduleName) === "total";
}

export function canAccessAppModule(
  user: Pick<Perfil, "rol" | "permisos_personalizados"> | null | undefined,
  key: AppModuleKey,
): boolean {
  const mod = APP_NAV_MODULES.find((item) => item.key === key);
  if (!mod) return false;
  return canAccessModule(user, mod.module);
}

export function canWriteAppModule(
  user: Pick<Perfil, "rol" | "permisos_personalizados"> | null | undefined,
  key: AppModuleKey,
): boolean {
  if (!user || user.rol === "ente_regulador") return false;
  const mod = APP_NAV_MODULES.find((item) => item.key === key);
  if (!mod) return false;
  return canWriteModule(user, mod.module);
}

/**
 * Publicar en la biblioteca general LT (ámbito global).
 * Solo roles de consultora (admin/preventor): no usa permisos_personalizados
 * del módulo Capacitaciones, porque un dueño con acceso "total" no debe
 * poder publicar plantillas globales de Legajo Técnico.
 */
export function canPublishToBibliotecaLt(
  user: Pick<Perfil, "rol"> | null | undefined,
): boolean {
  if (!user || user.rol === "ente_regulador") return false;
  return user.rol === "admin" || user.rol === "preventor";
}

export function getVisibleAppNavModules(
  user: Pick<Perfil, "rol" | "permisos_personalizados"> | null | undefined,
): AppNavModule[] {
  return APP_NAV_MODULES.filter((item) =>
    canAccessModule(user, item.module),
  );
}

/** True si la ruta actual pertenece a un módulo oculto para el usuario. */
export function isPathBlockedByPermissions(
  user: Pick<Perfil, "rol" | "permisos_personalizados"> | null | undefined,
  pathname: string | null,
): boolean {
  if (!pathname || !user) return false;
  const blocked = APP_NAV_MODULES.find((item) => {
    if (pathname === item.href || pathname.startsWith(`${item.href}/`)) {
      return !canAccessModule(user, item.module);
    }
    return false;
  });
  return Boolean(blocked);
}

type WriteRouteRule = {
  key: AppModuleKey;
  match: (pathname: string) => boolean;
};

const WRITE_ROUTE_RULES: WriteRouteRule[] = [
  {
    key: "informes",
    match: (pathname) =>
      pathname.endsWith("/informes/nuevo") ||
      /\/informes\/[^/]+\/editar\/?$/.test(pathname),
  },
  {
    key: "epp",
    match: (pathname) =>
      pathname.startsWith("/epp/nueva-entrega") ||
      (pathname.includes("/epp/") && pathname.includes("/editar")),
  },
  {
    key: "capacitaciones",
    match: (pathname) =>
      pathname.endsWith("/capacitaciones/nuevo") ||
      pathname.endsWith("/capacitaciones/registro-manual") ||
      pathname.startsWith("/capacitaciones/biblioteca/nueva") ||
      /\/capacitaciones\/biblioteca\/[^/]+\/?$/.test(pathname) ||
      /\/capacitaciones\/[^/]+\/editar\/?$/.test(pathname),
  },
];

/** Bloquea rutas de alta/edición si el módulo no tiene acceso total. */
export function isWritePathBlockedByPermissions(
  user: Pick<Perfil, "rol" | "permisos_personalizados"> | null | undefined,
  pathname: string | null,
): boolean {
  if (!pathname || !user) return false;
  return WRITE_ROUTE_RULES.some(
    (rule) => rule.match(pathname) && !canWriteAppModule(user, rule.key),
  );
}
