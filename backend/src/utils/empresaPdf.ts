/** Valor visible en planillas legales cuando falta un dato de empresa. */
export const EMPRESA_CAMPO_SIN_DATO = "Sin especificar";

export type EmpresaPlanillaRaw = {
  razon_social?: string | null;
  cuit?: string | null;
  domicilio?: string | null;
  localidad?: string | null;
  codigo_postal?: string | null;
  provincia?: string | null;
  actividad?: string | null;
  logo_url?: string | null;
};

export type EmpresaPlanillaNormalizada = {
  razon_social: string;
  cuit: string;
  domicilio: string;
  localidad: string;
  codigo_postal: string;
  provincia: string;
  actividad: string | null;
  logo_url: string | null;
  /** true si algún campo obligatorio de la planilla usó fallback */
  datos_incompletos: boolean;
};

function limpiar(value?: string | null): string {
  return (value ?? "").trim();
}

/**
 * Normaliza datos de empresa para la planilla EPP Anexo I.
 * - Usa "Sin especificar" si falta un campo.
 * - Si localidad viene como "Ciudad, Provincia" y no hay provincia, intenta separar.
 */
export function normalizarEmpresaParaPlanilla(
  raw: EmpresaPlanillaRaw | null | undefined,
): EmpresaPlanillaNormalizada {
  let localidad = limpiar(raw?.localidad);
  let provincia = limpiar(raw?.provincia);
  let datosIncompletos = false;

  if (!provincia && localidad.includes(",")) {
    const partes = localidad.split(",").map((p) => p.trim()).filter(Boolean);
    if (partes.length >= 2) {
      localidad = partes[0];
      provincia = partes.slice(1).join(", ");
    }
  }

  const pick = (value: string, obligatorio = true): string => {
    if (value) return value;
    if (obligatorio) datosIncompletos = true;
    return EMPRESA_CAMPO_SIN_DATO;
  };

  return {
    razon_social: pick(limpiar(raw?.razon_social)),
    cuit: pick(limpiar(raw?.cuit)),
    domicilio: pick(limpiar(raw?.domicilio)),
    localidad: pick(localidad),
    codigo_postal: pick(limpiar(raw?.codigo_postal)),
    provincia: pick(provincia),
    actividad: limpiar(raw?.actividad) || null,
    logo_url: raw?.logo_url ?? null,
    datos_incompletos: datosIncompletos,
  };
}
