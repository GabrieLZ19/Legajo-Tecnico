import { api } from "@/lib/api";

export type CotizarItemSolicitado = {
  cantidad: number;
  nombre_manual?: string | null;
  epp_tipos?: { id: string; nombre: string; descripcion?: string | null } | null;
};

export type CotizarPublicaInfo = {
  proveedor_nombre: string;
  estado: string;
  epp_licitaciones?: {
    titulo: string;
    descripcion?: string | null;
    comision_porcentaje?: number | null;
    comprador_nombre?: string | null;
    comprador_email?: string | null;
    comprador_telefono?: string | null;
    empresas?: { razon_social?: string } | null;
    epp_licitacion_items?: CotizarItemSolicitado[];
  } | null;
};

export const eppCotizarService = {
  async obtener(token: string): Promise<CotizarPublicaInfo> {
    const { data } = await api.get<{ cotizacion: CotizarPublicaInfo }>(
      `/epp/cotizar/${token}`,
    );
    return data.cotizacion;
  },

  async enviar(
    token: string,
    payload: {
      proveedor_nombre: string;
      monto: number;
      items_ofertados: Array<{
        epp_tipo_id?: string | null;
        nombre?: string | null;
        cantidad: number;
        precio_unitario: number;
      }>;
      presupuesto: File;
    },
  ) {
    const form = new FormData();
    form.append("proveedor_nombre", payload.proveedor_nombre);
    form.append("monto", String(payload.monto));
    form.append("items_ofertados", JSON.stringify(payload.items_ofertados));
    form.append("presupuesto", payload.presupuesto);

    const { data } = await api.post(`/epp/cotizar/${token}`, form, {
      headers: { "Content-Type": "multipart/form-data" },
      timeout: 60000,
    });
    return data as { success: boolean; cotizacion: unknown };
  },
};
