/** Persistencia local de borradores de informes de visita (sobrevive reinicios / cortes). */

export type InformeDraftAccion = {
  id?: string;
  descripcion: string;
  responsable: string;
};

export type InformeDraftImagenVisita = {
  id_temp: string;
  url?: string;
};

export type InformeDraftObservacion = {
  id_temp: string;
  id?: string;
  detalle: string;
  acciones: InformeDraftAccion[];
  evidencia_url?: string;
};

export type InformeDraftPayload = {
  version: 1;
  empresaId: string;
  informeId?: string;
  lugar: string;
  actividad: string;
  fecha: string;
  hora: string;
  declaracion_legal: string;
  observaciones: InformeDraftObservacion[];
  imagenes_visita?: InformeDraftImagenVisita[];
  savedAt: string;
  lastServerSyncAt?: string;
};

const STORAGE_PREFIX = "informe_draft_v1";

export function draftKeyNuevo(empresaId: string): string {
  return `${STORAGE_PREFIX}:nuevo:${empresaId}`;
}

export function draftKeyEditar(informeId: string): string {
  return `${STORAGE_PREFIX}:edit:${informeId}`;
}

export function readInformeDraft(key: string): InformeDraftPayload | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as InformeDraftPayload;
    if (parsed?.version !== 1) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeInformeDraft(
  key: string,
  draft: InformeDraftPayload,
): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key, JSON.stringify(draft));
  } catch (err) {
    console.warn("No se pudo guardar borrador local del informe:", err);
  }
}

export function clearInformeDraft(key: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(key);
  } catch {
    // ignore
  }
}

export function draftHasContent(
  draft: Pick<
    InformeDraftPayload,
    "actividad" | "lugar" | "declaracion_legal" | "observaciones" | "imagenes_visita"
  >,
): boolean {
  const decl = (draft.declaracion_legal || "")
    .replace(/<br\s*\/?>/gi, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/<[^>]+>/g, "")
    .trim();
  // No usar solo "lugar" (viene precargado como "Planta 1") para no crear borradores vacíos
  return (
    Boolean(draft.actividad?.trim()) ||
    draft.observaciones.length > 0 ||
    (draft.imagenes_visita?.length ?? 0) > 0 ||
    Boolean(decl)
  );
}

export function buildFechaHoraIso(fecha: string, hora: string): string | null {
  if (!fecha || !hora) return null;
  const dateObj = new Date(`${fecha}T${hora}:00`);
  if (Number.isNaN(dateObj.getTime())) return null;
  return dateObj.toISOString();
}
