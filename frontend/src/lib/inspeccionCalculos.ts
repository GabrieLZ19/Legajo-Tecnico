import type { CalificacionChecklist, CriticidadChecklist } from "@/types";

export type ResultadoInspeccion = "aprobada" | "observada" | "rechazada";

export interface ItemParaCalculo {
  criticidad: CriticidadChecklist;
  calificacion: CalificacionChecklist;
}

export interface DictamenInspeccion {
  resultado: ResultadoInspeccion;
  titulo: string;
  subtitulo: string;
  motivoDetallado: string;
  porcentajeConformidad: number;
  totalItems: number;
  bienCount: number;
  regularCount: number;
  malCount: number;
  criticosConFalla: number;
}

/**
 * Calcula en tiempo real el resultado oficial y las métricas de conformidad
 * según las reglas de negocio de Higiene y Seguridad de Legajo Técnico:
 * - Cualquier ítem con criticidad "alta" calificado "mal" -> RECHAZADA.
 * - Cualquier ítem con criticidad "alta" calificado "regular", o "media" calificado "mal" -> OBSERVADA.
 * - En cualquier otro caso -> APROBADA.
 */
export function evaluarInspeccion(items: ItemParaCalculo[]): DictamenInspeccion {
  const total = items.length;
  if (total === 0) {
    return {
      resultado: "aprobada",
      titulo: "Sin ítems calificados",
      subtitulo: "Cargá los ítems para evaluar el estado",
      motivoDetallado: "No hay ítems registrados",
      porcentajeConformidad: 100,
      totalItems: 0,
      bienCount: 0,
      regularCount: 0,
      malCount: 0,
      criticosConFalla: 0,
    };
  }

  let bienCount = 0;
  let regularCount = 0;
  let malCount = 0;
  let criticosConFalla = 0;

  let tieneAltaMal = false;
  let tieneAltaRegular = false;
  let tieneMediaMal = false;

  for (const item of items) {
    if (item.calificacion === "bien") {
      bienCount++;
    } else if (item.calificacion === "regular") {
      regularCount++;
      if (item.criticidad === "alta") {
        tieneAltaRegular = true;
        criticosConFalla++;
      }
    } else if (item.calificacion === "mal") {
      malCount++;
      if (item.criticidad === "alta") {
        tieneAltaMal = true;
        criticosConFalla++;
      }
      if (item.criticidad === "media") {
        tieneMediaMal = true;
      }
    }
  }

  // Porcentaje ponderado: bien = 100%, regular = 50%, mal = 0%
  const puntajeTotal = bienCount * 100 + regularCount * 50;
  const porcentajeConformidad = Math.round(puntajeTotal / total);

  if (tieneAltaMal) {
    return {
      resultado: "rechazada",
      titulo: "RECHAZADA / NO APTO",
      subtitulo: "Peligro Crítico: Equipo fuera de servicio hasta subsanar desvíos",
      motivoDetallado: "Se detectaron ítems de criticidad alta no conformes (Mal).",
      porcentajeConformidad,
      totalItems: total,
      bienCount,
      regularCount,
      malCount,
      criticosConFalla,
    };
  }

  if (tieneAltaRegular || tieneMediaMal) {
    return {
      resultado: "observada",
      titulo: "APROBADA CON OBSERVACIONES",
      subtitulo: "Operación condicional: Requiere subsanar observaciones en plan de acción",
      motivoDetallado: tieneAltaRegular
        ? "Existen desvíos regulares en ítems de criticidad alta."
        : "Existen ítems de criticidad media calificados como no conformes.",
      porcentajeConformidad,
      totalItems: total,
      bienCount,
      regularCount,
      malCount,
      criticosConFalla,
    };
  }

  return {
    resultado: "aprobada",
    titulo: "APROBADA / APTO",
    subtitulo: "Equipo en condiciones operativas seguras",
    motivoDetallado: "Todos los ítems verificados cumplen satisfactoriamente los estándares.",
    porcentajeConformidad,
    totalItems: total,
    bienCount,
    regularCount,
    malCount,
    criticosConFalla: 0,
  };
}
