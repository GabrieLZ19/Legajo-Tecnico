/** Zona horaria operativa de la app (Argentina). */
export const APP_TIMEZONE = "America/Argentina/Buenos_Aires";

const dateOpts: Intl.DateTimeFormatOptions = {
  timeZone: APP_TIMEZONE,
};

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
