export type ProveedorFichaInput = {
  nombre: string;
  email: string;
  direccion: string;
  telefono: string;
};

/** Solo dígitos, espacios, guiones, paréntesis y + inicial. */
export function sanitizeTelefonoInput(raw: string): string {
  const cleaned = raw.replace(/[^\d+\s\-()]/g, "");
  // El + solo puede ir al inicio
  const hasPlus = cleaned.startsWith("+");
  const rest = (hasPlus ? cleaned.slice(1) : cleaned).replace(/\+/g, "");
  return (hasPlus ? "+" : "") + rest.slice(0, 20);
}

export function telefonoDigitos(value: string): string {
  return value.replace(/\D/g, "");
}

export function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value.trim());
}

export function isValidTelefono(value: string, opts?: { required?: boolean }): boolean {
  const trimmed = value.trim();
  if (!trimmed) return !opts?.required;
  if (!/^[+\d]?[\d\s\-()]*$/.test(trimmed)) return false;
  const digits = telefonoDigitos(trimmed);
  return digits.length >= 6 && digits.length <= 15;
}

export function isValidNombreProveedor(value: string): boolean {
  const trimmed = value.trim();
  if (trimmed.length < 2 || trimmed.length > 120) return false;
  // Letras, números, espacios y puntuación habitual de razón social
  return /^[\p{L}\p{N}][\p{L}\p{N}\s.'&\-/]*$/u.test(trimmed);
}

export function validateProveedorFicha(
  value: ProveedorFichaInput,
  opts?: { telefonoRequired?: boolean },
): string | null {
  if (!isValidNombreProveedor(value.nombre)) {
    return "El nombre debe tener al menos 2 caracteres válidos (sin símbolos raros).";
  }
  if (!isValidEmail(value.email)) {
    return "Ingresá un correo válido (ej. correo@proveedor.com).";
  }
  if (value.direccion.trim().length > 200) {
    return "La dirección es demasiado larga.";
  }
  if (!isValidTelefono(value.telefono, { required: opts?.telefonoRequired })) {
    return "El teléfono solo admite números (y +, espacios o guiones). Usá al menos 6 dígitos.";
  }
  return null;
}
