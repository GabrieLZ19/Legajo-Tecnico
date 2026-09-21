import { api } from "@/lib/api";
import type { Empleado, EppEntrega, EppLicitacion, EppTipo } from "@/types";

export type EppListParams = {
  limit?: number;
  offset?: number;
  q?: string;
};

export type EmpleadosListResponse = {
  empleados: Empleado[];
  total: number;
  limit: number;
  offset: number;
};

export type EntregasListResponse = {
  entregas: EppEntrega[];
  total: number;
  limit: number;
  offset: number;
};

export type LicitacionesListResponse = {
  licitaciones: EppLicitacion[];
  total: number;
  limit: number;
  offset: number;
  stats?: {
    abiertas: number;
    adjudicacion: number;
    cerradas: number;
  };
};

export type EppEntregaPublicaPayload = {
  nombre_empleado: string;
  dni_empleado: string;
  puesto: string;
  sector?: string;
  items: Array<{
    epp_tipo_id: string;
    cantidad: number;
    marca?: string;
    modelo?: string;
    certificacion?: string;
  }>;
  firma: string;
  foto?: File | null;
};

export type EppEntregaPublicaEmpleadoLookup =
  | { found: false }
  | {
      found: true;
      nombre: string;
      documento: string;
      sector: string | null;
      puesto: string | null;
      epp_necesarios: string | null;
      epp_tipos: Array<{ id: string; nombre: string }>;
    };

export type EppTipoPayload = {
  empresa_id: string;
  nombre: string;
  descripcion?: string;
  marca?: string;
  modelo?: string;
  certificacion?: string;
  foto?: File;
};

export type EppTipoUpdatePayload = {
  empresa_id: string;
  nombre?: string;
  descripcion?: string;
  marca?: string;
  modelo?: string;
  certificacion?: string;
  activo?: boolean;
  foto?: File;
};

export type EmpleadoCreatePayload = {
  empresa_id: string;
  nombre: string;
  documento: string;
  sector?: string;
  puesto?: string;
  epp_necesarios?: string;
  aplicar_epp_por_puesto?: boolean;
};

export type EmpleadoUpdatePayload = {
  nombre?: string;
  documento?: string;
  sector?: string | null;
  puesto?: string | null;
  epp_necesarios?: string | null;
  activo?: boolean;
  aplicar_epp_por_puesto?: boolean;
};

export type EmpleadoMutationResult = Empleado & {
  epp_aplicados_a?: number;
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
  async listarEmpleados(
    empresaId: string,
    params?: EppListParams,
  ): Promise<EmpleadosListResponse> {
    const { data } = await api.get<EmpleadosListResponse>("/epp/empleados", {
      params: {
        empresa_id: empresaId,
        limit: params?.limit,
        offset: params?.offset,
        q: params?.q || undefined,
      },
    });
    return data;
  },

  async listarEntregas(
    empresaId: string,
    params?: EppListParams,
  ): Promise<EntregasListResponse> {
    const { data } = await api.get<EntregasListResponse>("/epp/entregas", {
      params: {
        empresa_id: empresaId,
        limit: params?.limit,
        offset: params?.offset,
        q: params?.q || undefined,
      },
    });
    return data;
  },

  async listarLicitaciones(
    empresaId: string,
    params?: EppListParams,
  ): Promise<LicitacionesListResponse> {
    const { data } = await api.get<LicitacionesListResponse>("/epp/licitaciones", {
      params: {
        empresa_id: empresaId,
        limit: params?.limit,
        offset: params?.offset,
        q: params?.q || undefined,
      },
    });
    return data;
  },

  async crearTipo(payload: EppTipoPayload): Promise<EppTipo> {
    const form = new FormData();
    form.append("empresa_id", payload.empresa_id);
    form.append("nombre", payload.nombre);
    if (payload.descripcion) form.append("descripcion", payload.descripcion);
    if (payload.marca !== undefined) form.append("marca", payload.marca);
    if (payload.modelo !== undefined) form.append("modelo", payload.modelo);
    if (payload.certificacion !== undefined) {
      form.append("certificacion", payload.certificacion);
    }
    if (payload.foto) form.append("foto", payload.foto);
    const { data } = await api.post<EppTipo>("/epp/tipos", form, {
      timeout: 60000,
    });
    return data;
  },

  async actualizarTipo(id: string, payload: EppTipoUpdatePayload): Promise<EppTipo> {
    const form = new FormData();
    form.append("empresa_id", payload.empresa_id);
    if (payload.nombre !== undefined) form.append("nombre", payload.nombre);
    if (payload.descripcion !== undefined) form.append("descripcion", payload.descripcion);
    if (payload.marca !== undefined) form.append("marca", payload.marca);
    if (payload.modelo !== undefined) form.append("modelo", payload.modelo);
    if (payload.certificacion !== undefined) {
      form.append("certificacion", payload.certificacion);
    }
    if (payload.activo !== undefined) form.append("activo", String(payload.activo));
    if (payload.foto) form.append("foto", payload.foto);
    const { data } = await api.patch<EppTipo>(`/epp/tipos/${id}`, form, {
      timeout: 60000,
    });
    return data;
  },

  async crearEmpleado(payload: EmpleadoCreatePayload): Promise<EmpleadoMutationResult> {
    const { data } = await api.post<EmpleadoMutationResult>("/epp/empleados", payload);
    return data;
  },

  async actualizarEmpleado(
    id: string,
    payload: EmpleadoUpdatePayload,
  ): Promise<EmpleadoMutationResult> {
    const { data } = await api.patch<EmpleadoMutationResult>(
      `/epp/empleados/${id}`,
      payload,
    );
    return data;
  },

  async eliminarEntrega(id: string): Promise<{ success: boolean; id: string }> {
    const { data } = await api.delete<{ success: boolean; id: string }>(
      `/epp/entregas/${id}`,
    );
    return data;
  },

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

  async buscarEmpleadoEntregaPublica(
    token: string,
    dni: string,
  ): Promise<EppEntregaPublicaEmpleadoLookup> {
    const { data } = await api.get<EppEntregaPublicaEmpleadoLookup>(
      `/epp/entrega-publica/${token}/empleado`,
      { params: { dni } },
    );
    return data;
  },

  async registrarEntregaPublica(token: string, payload: EppEntregaPublicaPayload) {
    const form = new FormData();
    form.append("nombre_empleado", payload.nombre_empleado);
    form.append("dni_empleado", payload.dni_empleado);
    form.append("puesto", payload.puesto);
    if (payload.sector) form.append("sector", payload.sector);
    form.append("items", JSON.stringify(payload.items));
    form.append("firma", payload.firma);
    if (payload.foto) form.append("foto", payload.foto);

    const { data } = await api.post(`/epp/entrega-publica/${token}`, form, {
      headers: { "Content-Type": "multipart/form-data" },
      timeout: 60000,
    });
    return data as {
      success: boolean;
      entrega: unknown;
      entregas?: unknown[];
      pdf_generando: boolean;
      mensaje: string;
    };
  },
};
