import { api } from "@/lib/api";
import type { EppCotizacion, EppLicitacion } from "@/types";

export type LicitacionEstado = "abierta" | "adjudicacion" | "cerrada";

export type AdjudicacionPublicaInfo = {
  titulo: string;
  estado: string;
  empresa: string;
  comprador_nombre?: string | null;
  comprador_email?: string | null;
  comprador_telefono?: string | null;
  ganador_nombre: string;
  adjudicado_at?: string | null;
  mensaje: string;
};

export const eppLicitacionService = {
  async obtener(id: string): Promise<EppLicitacion> {
    const { data } = await api.get<{ licitacion: EppLicitacion }>(
      `/epp/licitaciones/${id}`,
    );
    return data.licitacion;
  },

  async agregarProveedor(id: string, proveedorId: string): Promise<EppCotizacion> {
    const { data } = await api.post<{ cotizacion: EppCotizacion }>(
      `/epp/licitaciones/${id}/proveedores`,
      { proveedor_id: proveedorId },
    );
    return data.cotizacion;
  },

  async actualizarEstado(
    id: string,
    payload: {
      estado: LicitacionEstado;
      ganador_cotizacion_id?: string | null;
    },
  ): Promise<EppLicitacion> {
    const { data } = await api.patch<{ licitacion: EppLicitacion }>(
      `/epp/licitaciones/${id}/estado`,
      payload,
    );
    return data.licitacion;
  },

  async obtenerAdjudicacionPublica(token: string): Promise<AdjudicacionPublicaInfo> {
    const { data } = await api.get<{ adjudicacion: AdjudicacionPublicaInfo }>(
      `/epp/adjudicacion/${token}`,
    );
    return data.adjudicacion;
  },
};
