/** Agenda de capacitación: fecha + horario + horas con validación. */

export type CapAgendaValue = {
  fecha: string; // YYYY-MM-DD
  horaDesde: string; // HH:mm
  horaHasta: string; // HH:mm
  cantidadHoras: string; // ej "4" | "4.5"
};

export type CapAgendaErrors = {
  fecha?: string;
  horaDesde?: string;
  horaHasta?: string;
  cantidadHoras?: string;
};

const FECHAS_HORARIO_RE =
  /^(?:(\d{2})\/(\d{2})\/(\d{4})\s+)?(\d{1,2}:\d{2})\s*(?:a|-|–|—)\s*(\d{1,2}:\d{2})$/i;

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

export function toDisplayDate(isoDate: string): string {
  if (!isoDate || !/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return "";
  const [y, m, d] = isoDate.split("-");
  return `${d}/${m}/${y}`;
}

export function minutesFromTime(hhmm: string): number | null {
  if (!/^\d{2}:\d{2}$/.test(hhmm)) return null;
  const [h, m] = hhmm.split(":").map(Number);
  if (h > 23 || m > 59) return null;
  return h * 60 + m;
}

export function calcHorasFromRange(horaDesde: string, horaHasta: string): string {
  const a = minutesFromTime(horaDesde);
  const b = minutesFromTime(horaHasta);
  if (a === null || b === null || b <= a) return "";
  const hours = (b - a) / 60;
  // 1 decimal max, sin ceros innecesarios
  const rounded = Math.round(hours * 4) / 4; // pasos de 0.25
  return Number.isInteger(rounded) ? String(rounded) : String(rounded);
}

export function buildFechasHorario(value: CapAgendaValue): string {
  const fechaTxt = toDisplayDate(value.fecha);
  if (!value.horaDesde || !value.horaHasta) {
    return fechaTxt;
  }
  if (!fechaTxt) return `${value.horaDesde} a ${value.horaHasta}`;
  return `${fechaTxt} ${value.horaDesde} a ${value.horaHasta}`;
}

export function parseFechasHorario(
  fechasHorario?: string | null,
  fechaFallback?: string | null,
): Pick<CapAgendaValue, "horaDesde" | "horaHasta" | "fecha"> {
  const empty = {
    fecha: fechaFallback ? fechaFallback.split("T")[0] : "",
    horaDesde: "",
    horaHasta: "",
  };
  if (!fechasHorario?.trim()) return empty;

  const raw = fechasHorario.trim();
  const match = raw.match(FECHAS_HORARIO_RE);
  if (!match) return empty;

  const [, dd, mm, yyyy, desde, hasta] = match;
  const normalizeTime = (t: string) => {
    const [h, m] = t.split(":");
    return `${pad2(Number(h))}:${pad2(Number(m))}`;
  };

  return {
    fecha:
      dd && mm && yyyy
        ? `${yyyy}-${mm}-${dd}`
        : empty.fecha,
    horaDesde: normalizeTime(desde),
    horaHasta: normalizeTime(hasta),
  };
}

export function emptyAgenda(fecha = ""): CapAgendaValue {
  return {
    fecha,
    horaDesde: "",
    horaHasta: "",
    cantidadHoras: "",
  };
}

export function agendaFromStored(params: {
  fecha?: string | null;
  fechas_horario?: string | null;
  cantidad_horas?: string | null;
}): CapAgendaValue {
  const fecha = params.fecha ? params.fecha.split("T")[0] : "";
  const parsed = parseFechasHorario(params.fechas_horario, fecha);
  const cantidad =
    params.cantidad_horas?.trim() ||
    calcHorasFromRange(parsed.horaDesde, parsed.horaHasta);

  return {
    fecha: parsed.fecha || fecha,
    horaDesde: parsed.horaDesde,
    horaHasta: parsed.horaHasta,
    cantidadHoras: cantidad,
  };
}

/**
 * Valida agenda. `requireHorario` fuerza hora desde/hasta y horas.
 */
export function validateAgenda(
  value: CapAgendaValue,
  opts?: { requireFecha?: boolean; requireHorario?: boolean },
): CapAgendaErrors {
  const requireFecha = opts?.requireFecha ?? true;
  const requireHorario = opts?.requireHorario ?? false;
  const errors: CapAgendaErrors = {};

  if (requireFecha && !value.fecha) {
    errors.fecha = "La fecha es obligatoria.";
  } else if (value.fecha && !/^\d{4}-\d{2}-\d{2}$/.test(value.fecha)) {
    errors.fecha = "Fecha inválida.";
  }

  const hasDesde = !!value.horaDesde;
  const hasHasta = !!value.horaHasta;
  const hasAnyTime = hasDesde || hasHasta;

  if (requireHorario || hasAnyTime) {
    if (!hasDesde) errors.horaDesde = "Indicá la hora de inicio.";
    if (!hasHasta) errors.horaHasta = "Indicá la hora de fin.";
  }

  const minDesde = minutesFromTime(value.horaDesde);
  const minHasta = minutesFromTime(value.horaHasta);

  if (hasDesde && minDesde === null) {
    errors.horaDesde = "Hora de inicio inválida.";
  }
  if (hasHasta && minHasta === null) {
    errors.horaHasta = "Hora de fin inválida.";
  }
  if (
    minDesde !== null &&
    minHasta !== null &&
    !errors.horaDesde &&
    !errors.horaHasta &&
    minHasta <= minDesde
  ) {
    errors.horaHasta = "La hora de fin debe ser posterior al inicio.";
  }

  const horasRaw = value.cantidadHoras.trim().replace(",", ".");
  if (requireHorario || hasAnyTime || horasRaw) {
    if (!horasRaw) {
      errors.cantidadHoras = "Indicá la cantidad de horas.";
    } else {
      const n = Number(horasRaw);
      if (!Number.isFinite(n) || n <= 0) {
        errors.cantidadHoras = "Debe ser un número mayor a 0.";
      } else if (n > 24) {
        errors.cantidadHoras = "No puede superar 24 horas.";
      } else if (Math.round(n * 100) !== n * 100) {
        errors.cantidadHoras = "Usá como máximo 2 decimales.";
      }
    }
  }

  // Si el rango es válido, las horas no pueden ser mayores al rango
  if (
    minDesde !== null &&
    minHasta !== null &&
    minHasta > minDesde &&
    horasRaw &&
    !errors.cantidadHoras
  ) {
    const maxHoras = (minHasta - minDesde) / 60;
    const n = Number(horasRaw);
    if (n > maxHoras + 0.001) {
      errors.cantidadHoras = `No puede superar la duración del horario (${calcHorasFromRange(value.horaDesde, value.horaHasta)} h).`;
    }
  }

  return errors;
}

export function hasAgendaErrors(errors: CapAgendaErrors): boolean {
  return Object.keys(errors).length > 0;
}
