import { sanitizeRichHtml } from "./sanitizeHtml";

export interface CapacitacionDiapositiva {
  contenido: string;
}

/**
 * Normaliza diapositivas y deriva temario (compatibilidad lecturas viejas).
 * Si diapositivas viene vacío y hay temario, se trata como 1 diapositiva.
 */
export function resolveDiapositivasAndTemario(params: {
  diapositivas?: CapacitacionDiapositiva[] | null;
  temario?: string | null;
}): { diapositivas: CapacitacionDiapositiva[]; temario: string | null } {
  const incoming = Array.isArray(params.diapositivas)
    ? params.diapositivas.filter(
        (d) => d && typeof d.contenido === "string",
      )
    : [];

  let diapositivas = incoming.map((d) => ({
    ...d,
    contenido: sanitizeRichHtml(d.contenido),
  }));
  if (diapositivas.length === 0 && params.temario) {
    diapositivas = [{ contenido: sanitizeRichHtml(params.temario) }];
  }

  const temario =
    diapositivas.length > 0
      ? diapositivas.map((d) => d.contenido || "").join("")
      : params.temario
        ? sanitizeRichHtml(params.temario)
        : null;

  return { diapositivas, temario };
}

/** Para respuestas de detalle: garantiza al menos fallback desde temario. */
export function ensureDiapositivas(
  diapositivas: CapacitacionDiapositiva[] | null | undefined,
  temario?: string | null,
): CapacitacionDiapositiva[] {
  return resolveDiapositivasAndTemario({ diapositivas, temario }).diapositivas;
}
