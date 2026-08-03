import { CapacitacionDiapositiva } from "@/types";

export function normalizeDiapositivas(
  diapositivas?: CapacitacionDiapositiva[] | null,
  temario?: string | null,
): CapacitacionDiapositiva[] {
  if (Array.isArray(diapositivas) && diapositivas.length > 0) {
    return diapositivas.map((d) => ({
      contenido: typeof d?.contenido === "string" ? d.contenido : "",
    }));
  }
  if (temario) return [{ contenido: temario }];
  return [{ contenido: "" }];
}

export function deriveTemario(diapositivas: CapacitacionDiapositiva[]): string {
  return diapositivas.map((d) => d.contenido || "").join("");
}
