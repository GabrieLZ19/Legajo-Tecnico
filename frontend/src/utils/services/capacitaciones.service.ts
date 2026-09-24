import { api } from "@/lib/api";
import type { Capacitacion } from "@/types";

export type CapacitacionesListParams = {
  limit?: number;
  offset?: number;
  estado?: string;
};

export type CapacitacionesListResponse = {
  capacitaciones: Capacitacion[];
  total: number;
  limit: number;
  offset: number;
};

export const capacitacionesService = {
  async listar(
    empresaId: string,
    params?: CapacitacionesListParams,
  ): Promise<CapacitacionesListResponse> {
    const { data } = await api.get<CapacitacionesListResponse>("/capacitaciones", {
      params: {
        empresa_id: empresaId,
        limit: params?.limit,
        offset: params?.offset,
        estado: params?.estado && params.estado !== "todas" ? params.estado : undefined,
      },
    });
    return data;
  },

  /**
   * Sube una imagen de diapositiva a Storage y devuelve la URL canónica.
   * Evita embebir base64 en el HTML (causa cuelgues al guardar).
   */
  async subirMediaDiapositiva(file: File): Promise<string> {
    const form = new FormData();
    form.append("imagen", file);
    const { data } = await api.post<{ url: string }>(
      "/capacitaciones/media",
      form,
      { timeout: 60_000 },
    );
    if (!data?.url) {
      throw new Error("El servidor no devolvió la URL de la imagen");
    }
    return data.url;
  },
};
