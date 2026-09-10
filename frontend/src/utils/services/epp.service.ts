import { api } from "@/lib/api";
import type { EppTipo } from "@/types";

export type EppEntregaPublicaPayload = {
  nombre_empleado: string;
  dni_empleado: string;
  sector?: string;
  epp_tipo_id: string;
  cantidad: number;
  marca?: string;
  modelo?: string;
  certificacion?: string;
  firma: string;
  foto?: File | null;
};

export type EppEntregaPublicaInfo = {
  empresa: {
    id: string;
    razon_social: string;
    logo_url?: string | null;
  };
  tipos: EppTipo[];
};

export type EppQrEntregaResult = {
  qr: string;
  url: string;
  token: string;
  empresa: { id: string; razon_social: string };
};

export const eppService = {
  async generarQrEntrega(empresaId: string): Promise<EppQrEntregaResult> {
    const { data } = await api.get<EppQrEntregaResult>("/epp/entrega-qr", {
      params: { empresa_id: empresaId },
    });
    return data;
  },

  async obtenerEntregaPublica(token: string): Promise<EppEntregaPublicaInfo> {
    const { data } = await api.get<EppEntregaPublicaInfo>(
      `/epp/entrega-publica/${token}`,
    );
    return data;
  },

  async registrarEntregaPublica(token: string, payload: EppEntregaPublicaPayload) {
    const form = new FormData();
    form.append("nombre_empleado", payload.nombre_empleado);
    form.append("dni_empleado", payload.dni_empleado);
    if (payload.sector) form.append("sector", payload.sector);
    form.append("epp_tipo_id", payload.epp_tipo_id);
    form.append("cantidad", String(payload.cantidad));
    if (payload.marca) form.append("marca", payload.marca);
    if (payload.modelo) form.append("modelo", payload.modelo);
    if (payload.certificacion) form.append("certificacion", payload.certificacion);
    form.append("firma", payload.firma);
    if (payload.foto) form.append("foto", payload.foto);

    const { data } = await api.post(`/epp/entrega-publica/${token}`, form, {
      headers: { "Content-Type": "multipart/form-data" },
      timeout: 60000,
    });
    return data as {
      success: boolean;
      entrega: unknown;
      pdf_generando: boolean;
      mensaje: string;
    };
  },
};
