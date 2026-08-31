/** Limpia texto de búsqueda para filtros ilike (evita wildcards abusivos). */
export function sanitizeSearchTerm(raw: unknown, maxLen = 80): string | undefined {
  const q = String(raw ?? "")
    .trim()
    .slice(0, maxLen)
    .replace(/[%_,]/g, " ");
  const normalized = q.replace(/\s+/g, " ").trim();
  return normalized.length > 0 ? normalized : undefined;
}

export function parseDateFilter(raw: unknown): string | undefined {
  const s = String(raw ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return undefined;
  const d = new Date(`${s}T12:00:00`);
  if (Number.isNaN(d.getTime())) return undefined;
  return s;
}

export type HistoricoResultadoFiltro =
  | "todos"
  | "aprobado"
  | "desaprobado"
  | "sin_evaluacion";

export function parseHistoricoResultado(raw: unknown): HistoricoResultadoFiltro {
  const v = String(raw ?? "todos").trim();
  if (v === "aprobado" || v === "desaprobado" || v === "sin_evaluacion") {
    return v;
  }
  return "todos";
}

export function clampInt(
  raw: unknown,
  fallback: number,
  min: number,
  max: number,
): number {
  const n = parseInt(String(raw ?? ""), 10);
  if (Number.isNaN(n)) return fallback;
  return Math.min(Math.max(n, min), max);
}
