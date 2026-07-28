import { useState } from "react";
import { api } from "@/lib/api";

export function useCapacitaciones() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getCapacitaciones = async (empresaId: string) => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.get(`/capacitaciones?empresa_id=${empresaId}`);
      return data.capacitaciones || [];
    } catch (err: any) {
      setError(err.response?.data?.error || "Error al cargar capacitaciones");
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const getCapacitacionDetalle = async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.get(`/capacitaciones/${id}`);
      return data;
    } catch (err: any) {
      setError(err.response?.data?.error || "Error al cargar detalle");
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const getCapacitacionPublica = async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.get(`/capacitaciones/${id}/publica`);
      return data;
    } catch (err: any) {
      setError(
        err.response?.data?.error || "Capacitación no encontrada o inactiva",
      );
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const evaluarCapacitacion = async (
    id: string,
    payload: {
      nombre_empleado: string;
      dni_empleado: string;
      sector?: string;
      respuestas: Array<{ pregunta_id: string; seleccion: number | number[] }>;
      firma: string;
    },
  ) => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.post(`/capacitaciones/${id}/evaluar`, payload);
      return data;
    } catch (err: any) {
      setError(err.response?.data?.error || "Error al enviar la evaluación");
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const getCapacitacionQr = async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.get(`/capacitaciones/${id}/qr`);
      return data;
    } catch (err: any) {
      setError(err.response?.data?.error || "Error al obtener QR");
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const cambiarEstadoCapacitacion = async (id: string, nuevoEstado: string) => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.patch(`/capacitaciones/${id}`, { estado: nuevoEstado });
      return data;
    } catch (err: any) {
      setError(err.response?.data?.error || "Error al cambiar estado");
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const eliminarCapacitacion = async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.delete(`/capacitaciones/${id}`);
      return data;
    } catch (err: any) {
      setError(err.response?.data?.error || "Error al eliminar la capacitación");
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const exportarCapacitacion = async (
    id: string,
    format: "csv" | "pdf",
    filters?: { search?: string; sector?: string; estado?: string }
  ) => {
    const params = new URLSearchParams({ format });
    if (filters?.search) params.append("search", filters.search);
    if (filters?.sector && filters.sector !== "todos") params.append("sector", filters.sector);
    if (filters?.estado && filters.estado !== "todos") params.append("estado", filters.estado);

    const response = await api.get(`/capacitaciones/${id}/exportar?${params.toString()}`, {
      responseType: "blob",
    });
    return response.data;
  };

  const crearCapacitacion = async (payload: any) => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.post("/capacitaciones", payload);
      return data;
    } catch (err: any) {
      setError(err.response?.data?.error || "Error al crear la capacitación");
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const actualizarCapacitacion = async (id: string, payload: any) => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.put(`/capacitaciones/${id}`, payload);
      return data;
    } catch (err: any) {
      setError(err.response?.data?.error || "Error al actualizar la capacitación");
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return {
    loading,
    error,
    getCapacitaciones,
    getCapacitacionDetalle,
    getCapacitacionPublica,
    getCapacitacionQr,
    cambiarEstadoCapacitacion,
    eliminarCapacitacion,
    exportarCapacitacion,
    crearCapacitacion,
    actualizarCapacitacion,
    evaluarCapacitacion,
  };
}

