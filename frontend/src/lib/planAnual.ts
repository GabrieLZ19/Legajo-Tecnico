import { api } from "@/lib/api";

export interface PlanAnualFila {
  n?: string | number;
  peligro?: string;
  tema?: string;
  propuesta?: string;
  real?: string;
}

export interface PlanAnualRecord {
  id: string;
  empresa_id: string;
  anio: number;
  archivo_path: string;
  archivo_nombre: string;
  archivo_mime?: string | null;
  archivo_size?: number | null;
  subido_por?: string | null;
  created_at: string;
  updated_at: string;
}

export interface PlanAnualAnioItem {
  id: string;
  anio: number;
  archivo_nombre: string;
  created_at: string;
  updated_at: string;
}

export interface PlanAnualResponse {
  anio: number;
  plan: PlanAnualRecord | null;
  preview: { titulo?: string; filas: PlanAnualFila[] } | null;
  downloadUrl: string | null;
  tipo: "pdf" | "excel" | null;
}

export async function listarAniosPlanAnual(empresaId: string) {
  const { data } = await api.get<{ anios: PlanAnualAnioItem[] }>(
    `/capacitaciones/plan-anual/anios?empresa_id=${empresaId}`,
  );
  return data.anios || [];
}

export async function obtenerPlanAnual(empresaId: string, anio?: number) {
  const params = new URLSearchParams({ empresa_id: empresaId });
  if (anio) params.set("anio", String(anio));
  const { data } = await api.get<PlanAnualResponse>(
    `/capacitaciones/plan-anual?${params.toString()}`,
  );
  return data;
}

export async function subirPlanAnual(params: {
  empresaId: string;
  anio: number;
  archivo: File;
}) {
  const form = new FormData();
  form.append("empresa_id", params.empresaId);
  form.append("anio", String(params.anio));
  form.append("archivo", params.archivo);

  const { data } = await api.post("/capacitaciones/plan-anual", form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
}

export async function descargarPlantillaPlanAnual(anio?: number) {
  const params = new URLSearchParams();
  if (anio) params.set("anio", String(anio));
  const qs = params.toString();
  const { data } = await api.get(
    `/capacitaciones/plan-anual/plantilla${qs ? `?${qs}` : ""}`,
    { responseType: "blob" },
  );
  const blob = data as Blob;
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `plantilla-plan-anual-capacitacion-${anio || new Date().getFullYear()}.xlsx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
