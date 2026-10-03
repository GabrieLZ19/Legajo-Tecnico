/** Zona horaria operativa de la app (Argentina). */
export const APP_TIMEZONE = "America/Argentina/Buenos_Aires";

const dateOpts: Intl.DateTimeFormatOptions = {
  timeZone: APP_TIMEZONE,
};

/** Fecha calendario YYYY-MM-DD en zona Argentina (evita desfase UTC). */
export function todayYmdAR(base: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(base);
  const y = parts.find((p) => p.type === "year")?.value;
  const m = parts.find((p) => p.type === "month")?.value;
  const d = parts.find((p) => p.type === "day")?.value;
  return `${y}-${m}-${d}`;
}

/** Suma días a una fecha YYYY-MM-DD (calendario, sin UTC). */
export function addDaysYmd(ymd: string, days: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

/** Diferencia en días entre dos YYYY-MM-DD. */
export function diffDaysYmd(fromYmd: string, toYmd: string): number {
  const [fy, fm, fd] = fromYmd.split("-").map(Number);
  const [ty, tm, td] = toYmd.split("-").map(Number);
  const from = Date.UTC(fy, fm - 1, fd);
  const to = Date.UTC(ty, tm - 1, td);
  return Math.round((to - from) / (1000 * 60 * 60 * 24));
}

export function formatDateAR(input: string | Date): string {
  const d = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("es-AR", dateOpts);
}

export function formatTimeAR(input: string | Date): string {
  const d = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("es-AR", {
    ...dateOpts,
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatDateTimeAR(input: string | Date): string {
  const d = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("es-AR", {
    ...dateOpts,
    hour: "2-digit",
    minute: "2-digit",
  });
}
