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
};
