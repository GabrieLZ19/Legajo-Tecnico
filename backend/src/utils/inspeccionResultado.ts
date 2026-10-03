export type CriticidadItem = "alta" | "media" | "baja";
export type CalificacionItem = "bien" | "regular" | "mal";
export type ResultadoInspeccion = "aprobada" | "observada" | "rechazada";

export type ItemResultadoInput = {
  criticidad: CriticidadItem;
  calificacion: CalificacionItem;
};

/**
 * Regla de resultado automático:
 * - alta + mal → rechazada
 * - alta + regular o media + mal → observada
 * - resto → aprobada
 */
export function calcularResultadoInspeccion(
  items: ItemResultadoInput[],
): ResultadoInspeccion {
  if (items.some((i) => i.criticidad === "alta" && i.calificacion === "mal")) {
    return "rechazada";
  }
  if (
    items.some(
      (i) =>
        (i.criticidad === "alta" && i.calificacion === "regular") ||
        (i.criticidad === "media" && i.calificacion === "mal"),
    )
  ) {
    return "observada";
  }
  return "aprobada";
}
