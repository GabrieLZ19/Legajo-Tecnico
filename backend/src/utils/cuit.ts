/** CUIT con sufijo de sucursal, ej. "30637182907 SUC-LOMAS" */
export const CUIT_SUCURSAL_REGEX = /^\d{11}\s+[A-Za-z0-9.-]+$/;

export function digitsOnly(value: unknown): string {
  return String(value ?? "").replace(/\D/g, "");
}

export function isCuitSucursalFormat(value: string): boolean {
  return CUIT_SUCURSAL_REGEX.test(value.trim());
}

export function normalizeCuit(value: string, multiplesSucursales?: boolean): string {
  const trimmed = value.trim();
  if (multiplesSucursales || isCuitSucursalFormat(trimmed)) {
    return trimmed.replace(/\s+/g, " ");
  }
  return digitsOnly(trimmed);
}

export function validateCuit(value: string, multiplesSucursales?: boolean): void {
  const trimmed = value.trim();
  const sucursal = multiplesSucursales || isCuitSucursalFormat(trimmed);

  if (sucursal) {
    if (!CUIT_SUCURSAL_REGEX.test(trimmed.replace(/\s+/g, " "))) {
      throw new Error(
        "CUIT inválido: ingresá 11 dígitos seguidos del nombre de sucursal (ej. 30637182907 SUC-LOMAS)",
      );
    }
    return;
  }

  if (digitsOnly(trimmed).length !== 11) {
    throw new Error("CUIT debe tener 11 dígitos");
  }
}

export function cuitLookupValues(cuitInput: string): string[] {
  const trimmed = String(cuitInput ?? "").trim();
  if (isCuitSucursalFormat(trimmed)) {
    return [trimmed.replace(/\s+/g, " ")];
  }

  const cleanCuit = digitsOnly(trimmed);
  const formatted =
    cleanCuit.length === 11
      ? `${cleanCuit.slice(0, 2)}-${cleanCuit.slice(2, 10)}-${cleanCuit.slice(10)}`
      : cleanCuit;

  return Array.from(new Set([cleanCuit, formatted].filter(Boolean)));
}

export function getBaseCuit(cuit: string): string {
  return digitsOnly(cuit).slice(0, 11);
}

export function getSucursalLabel(cuit: string): string | null {
  const match = cuit.trim().match(/^\d{11}\s+(.+)$/);
  return match?.[1] ?? null;
}

/** Slug único para el dominio proxy de Auth (diferencia sucursales del mismo CUIT fiscal). */
export function cuitAuthSlug(cuit: string): string {
  const trimmed = cuit.trim().replace(/\s+/g, " ");
  if (isCuitSucursalFormat(trimmed)) {
    return trimmed
      .replace(/\s+/g, "-")
      .replace(/[^A-Za-z0-9-]/g, "")
      .toLowerCase();
  }
  return getBaseCuit(trimmed);
}

export function duenoAuthEmail(username: string, cuit: string): string {
  return `${username.trim()}@${cuitAuthSlug(cuit)}.legajo.local`;
}

export function buildCuitSucursal(baseCuit: string, codigo: string): string {
  const codigoNormalizado = sanitizeSucursalCodigo(codigo);
  return `${getBaseCuit(baseCuit)} ${codigoNormalizado}`;
}

export function sanitizeSucursalCodigo(value: string): string {
  return value
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9.\-]/g, "")
    .replace(/-+/g, "-")
    .replace(/\.+/g, ".")
    .replace(/^[-.]+|[-.]+$/g, "");
}
