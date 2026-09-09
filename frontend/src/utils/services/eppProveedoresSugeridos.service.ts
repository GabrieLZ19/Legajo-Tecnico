import { api } from "@/lib/api";
import type {
  EppProveedor,
  EppProveedorSugerido,
  EstadoPublicacionProveedorSugerido,
} from "@/types";

export const eppProveedoresSugeridosService = {
  async listar(estado: EstadoPublicacionProveedorSugerido | "todas" = "aprobada") {
    const { data } = await api.get<{ proveedores: EppProveedorSugerido[] }>(
      "/epp-proveedores-sugeridos",
      { params: { estado_publicacion: estado } },
    );
    return data.proveedores ?? [];
  },

  async crear(payload: {
    nombre: string;
    email: string;
    direccion?: string | null;
    telefono?: string | null;
    notas?: string | null;
  }) {
    const { data } = await api.post<{ proveedor: EppProveedorSugerido }>(
      "/epp-proveedores-sugeridos",
      payload,
    );
    return data.proveedor;
  },

  async actualizar(
    id: string,
    payload: {
      nombre?: string;
      email?: string;
      direccion?: string | null;
      telefono?: string | null;
      notas?: string | null;
    },
  ) {
    const { data } = await api.patch<{ proveedor: EppProveedorSugerido }>(
      `/epp-proveedores-sugeridos/${id}`,
      payload,
    );
    return data.proveedor;
  },

  async cambiarPublicacion(
    id: string,
    payload: { estado: "aprobada" | "rechazada"; rechazo_motivo?: string | null },
  ) {
    const { data } = await api.patch<{ proveedor: EppProveedorSugerido }>(
      `/epp-proveedores-sugeridos/${id}/publicacion`,
      payload,
    );
    return data.proveedor;
  },

  async eliminar(id: string) {
    const { data } = await api.delete(`/epp-proveedores-sugeridos/${id}`);
    return data as { success: boolean };
  },

  async adoptar(id: string) {
    const { data } = await api.post<{ proveedor: EppProveedor; creado: boolean }>(
      `/epp-proveedores-sugeridos/${id}/adoptar`,
    );
    return data;
  },
};
