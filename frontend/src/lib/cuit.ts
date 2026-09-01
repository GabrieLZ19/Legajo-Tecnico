/** CUIT con sufijo de sucursal, ej. "30637182907 SUC-LOMAS" */
export const CUIT_SUCURSAL_REGEX = /^\d{11}\s+[A-Za-z0-9.-]+$/;

export function isCuitSucursalFormat(value: string): boolean {
  return CUIT_SUCURSAL_REGEX.test(value.trim());
}

export function sanitizeCuitSucursalInput(value: string): string {
  return value.replace(/[^A-Za-z0-9\s-]/g, "");
}

export function sanitizeCuitNumericoInput(value: string): string {
  return value.replace(/\D/g, "");
}

export function formatCuitDisplay(value: string): string {
  const trimmed = value.trim();
  const sucursalMatch = trimmed.match(/^(\d{11})(\s+.+)$/);
  if (sucursalMatch) {
    const [, digits, suffix] = sucursalMatch;
    const formatted = `${digits.slice(0, 2)}-${digits.slice(2, 10)}-${digits.slice(10)}`;
    return `${formatted} ${suffix.trim()}`;
  }

  const digits = sanitizeCuitNumericoInput(trimmed);
  if (digits.length === 11) {
    return `${digits.slice(0, 2)}-${digits.slice(2, 10)}-${digits.slice(10)}`;
  }

  return value;
}

/** Etiqueta legible para listados: principal = CUIT formateado; sucursal = CODIGO · CUIT */
export function formatLegajoIdentificador(cuit: string): string {
  const sucursal = getSucursalLabel(cuit);
  const base = formatCuitDisplay(getBaseCuit(cuit));
  if (sucursal) {
    return `${sanitizeSucursalCodigoInput(sucursal)} · ${base}`;
  }
  return base;
}

export function normalizeCuitForSave(
  value: string,
  multiplesSucursales: boolean,
): string {
  const trimmed = value.trim();
  if (multiplesSucursales) {
    return trimmed.replace(/\s+/g, " ");
  }
  return sanitizeCuitNumericoInput(trimmed);
}

export function validateCuitForSave(
  value: string,
  multiplesSucursales: boolean,
): string | null {
  const normalized = normalizeCuitForSave(value, multiplesSucursales);

  if (multiplesSucursales) {
    if (!CUIT_SUCURSAL_REGEX.test(normalized)) {
      return "Ingresá los 11 dígitos del CUIT seguidos del nombre de sucursal. Ej: 30637182907 SUC-LOMAS";
    }
    return null;
  }

  if (normalized.length !== 11) {
    return "El CUIT debe tener exactamente 11 dígitos.";
  }

  return null;
}

export function cuitForLogin(value: string): string {
  const trimmed = value.trim();
  if (isCuitSucursalFormat(trimmed)) {
    return trimmed.replace(/\s+/g, " ");
  }
  return sanitizeCuitNumericoInput(trimmed);
}

export function getBaseCuit(cuit: string): string {
  return sanitizeCuitNumericoInput(cuit).slice(0, 11);
}

export function getSucursalLabel(cuit: string): string | null {
  const match = cuit.trim().match(/^\d{11}\s+(.+)$/);
  return match?.[1] ?? null;
}

export type EmpresaCuitGroup<T extends { id: string; cuit?: string }> = {
  baseCuit: string;
  empresas: T[];
  isMultiSucursal: boolean;
};

export function groupEmpresasByBaseCuit<T extends { id: string; cuit?: string }>(
  empresas: T[],
): EmpresaCuitGroup<T>[] {
  const map = new Map<string, T[]>();

  for (const empresa of empresas) {
    const baseCuit = getBaseCuit(empresa.cuit || "");
    if (!baseCuit) continue;
    const current = map.get(baseCuit) ?? [];
    current.push(empresa);
    map.set(baseCuit, current);
  }

  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([baseCuit, items]) => ({
      baseCuit,
      empresas: [...items].sort((a, b) =>
        (a.cuit || "").localeCompare(b.cuit || ""),
      ),
      isMultiSucursal: items.length > 1,
    }));
}

export type LoginSucursalOption = {
  id: string;
  razon_social: string;
  cuit: string;
  label: string;
};

export function loginEmpresaOptionLabel(razonSocial: string, cuit: string): string {
  if (isCuitSucursalFormat(cuit)) {
    const sucursal = normalizeSucursalCodigoInput(getSucursalLabel(cuit) || "");
    return `${sucursal} · ${formatCuitDisplay(getBaseCuit(cuit))}`;
  }
  return `Principal · ${razonSocial}`;
}

export function isEmpresaPrincipalCuit(cuit: string): boolean {
  return sanitizeCuitNumericoInput(cuit).length === 11 && !isCuitSucursalFormat(cuit);
}

export function buildCuitSucursal(baseCuit: string, codigo: string): string {
  const codigoNormalizado = normalizeSucursalCodigoInput(codigo);
  return `${sanitizeCuitNumericoInput(baseCuit).slice(0, 11)} ${codigoNormalizado}`;
}

/** Formateo en vivo mientras se escribe (conserva guión/punto al final). */
export function formatSucursalCodigoInput(value: string): string {
  const formatted = value
    .toUpperCase()
    .replace(/[^A-Z0-9.\-]/g, "")
    .replace(/-+/g, "-")
    .replace(/\.+/g, ".");

  if (formatted === "SUC") {
    return "SUC-";
  }

  return formatted;
}

/** Normalización final al guardar (sin guiones/puntos al inicio o fin). */
export function normalizeSucursalCodigoInput(value: string): string {
  return formatSucursalCodigoInput(value).replace(/^[-.]+|[-.]+$/g, "");
}

/** @deprecated Usar formatSucursalCodigoInput (vivo) o normalizeSucursalCodigoInput (guardar). */
export function sanitizeSucursalCodigoInput(value: string): string {
  return normalizeSucursalCodigoInput(value);
}

export function validateSucursalCodigo(codigo: string): string | null {
  const normalized = normalizeSucursalCodigoInput(codigo);
  if (!normalized) {
    return "Ingresá un código de sucursal (ej. SUC-LOMAS).";
  }
  if (!/^[A-Z0-9][A-Z0-9.\-]*[A-Z0-9]$|^[A-Z0-9]$/i.test(normalized)) {
    return "El código solo puede tener letras, números, guiones y puntos.";
  }
  return null;
}

export type SucursalDraft = {
  id: string;
  codigo: string;
  domicilio: string;
  localidad: string;
  provincia: string;
  codigo_postal: string;
  telefono: string;
  expanded: boolean;
};

export function createEmptySucursalDraft(): SucursalDraft {
  return {
    id:
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `suc-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    codigo: "",
    domicilio: "",
    localidad: "",
    provincia: "",
    codigo_postal: "",
    telefono: "",
    expanded: true,
  };
}
