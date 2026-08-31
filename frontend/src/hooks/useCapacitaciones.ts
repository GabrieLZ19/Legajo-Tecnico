import { useState } from "react";
import { api } from "@/lib/api";
import type {
  CapacitacionHistoricoFiltros,
  CapacitacionHistoricoRow,
} from "@/types";
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

  const getHistoricoCapacitaciones = async (
    empresaId: string,
    opts?: CapacitacionHistoricoFiltros,
  ) => {
    try {
      const params: Record<string, string | number> = { empresa_id: empresaId };
      if (opts?.participante?.trim()) {
        params.participante = opts.participante.trim().slice(0, 80);
      }
      if (opts?.tema?.trim()) {
        params.tema = opts.tema.trim().slice(0, 80);
      }
      if (opts?.fecha_desde) params.fecha_desde = opts.fecha_desde;
      if (opts?.fecha_hasta) params.fecha_hasta = opts.fecha_hasta;
      if (opts?.resultado && opts.resultado !== "todos") {
        params.resultado = opts.resultado;
      }
      if (opts?.limit != null) params.limit = opts.limit;
      if (opts?.offset != null) params.offset = opts.offset;
      const { data } = await api.get("/capacitaciones/historico", { params });
      return {
        registros: (data.registros || []) as CapacitacionHistoricoRow[],
        total: Number(data.total ?? 0),
        limit: Number(data.limit ?? 25),
        offset: Number(data.offset ?? 0),
      };
    } catch (err: any) {
      setError(
        err.response?.data?.error || "Error al cargar la base histórica",
      );
      throw err;
    }
  };

  const exportarHistoricoCapacitaciones = async (
    empresaId: string,
    opts?: Omit<CapacitacionHistoricoFiltros, "limit" | "offset">,
  ) => {
    const params = new URLSearchParams({ empresa_id: empresaId });
    if (opts?.participante?.trim()) {
      params.set("participante", opts.participante.trim().slice(0, 80));
    }
    if (opts?.tema?.trim()) {
      params.set("tema", opts.tema.trim().slice(0, 80));
    }
    if (opts?.fecha_desde) params.set("fecha_desde", opts.fecha_desde);
    if (opts?.fecha_hasta) params.set("fecha_hasta", opts.fecha_hasta);
    if (opts?.resultado && opts.resultado !== "todos") {
      params.set("resultado", opts.resultado);
    }
    const response = await api.get(
      `/capacitaciones/historico/exportar?${params.toString()}`,
      { responseType: "blob" },
    );
    return response.data as Blob;
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

  const eliminarAsistencia = async (capacitacionId: string, asistenciaId: string) => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.delete(
        `/capacitaciones/${capacitacionId}/asistencias/${asistenciaId}`,
      );
      return data;
    } catch (err: any) {
      setError(
        err.response?.data?.error || "Error al eliminar el participante",
      );
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const exportarCapacitacion = async (
    id: string,
    format: "xlsx" | "pdf" | "csv",
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

  const actualizarRegistroCapacitacion = async (
    id: string,
    payload: {
      instructor?: string;
      fecha?: string;
      fechas_horario?: string;
      cantidad_horas?: string;
      aclaracion_capacitador?: string;
      aclaracion_empresa?: string;
      firma_capacitador?: string;
      firma_empresa?: string;
    },
  ) => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.patch(`/capacitaciones/${id}/registro`, payload);
      return data;
    } catch (err: any) {
      setError(err.response?.data?.error || "Error al guardar el registro");
      throw err;
    } finally {
      setLoading(false);
    }
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

  const adjuntarRegistroManualCapacitacion = async (
    capacitacionId: string,
    archivo: File,
  ) => {
    setLoading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("archivo", archivo);
      const { data } = await api.post(
        `/capacitaciones/${capacitacionId}/registro-manual`,
        formData,
        {
          headers: { "Content-Type": "multipart/form-data" },
        },
      );
      return data;
    } catch (err: any) {
      setError(
        err.response?.data?.error || "Error al adjuntar el registro manual",
      );
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const crearRegistroManual = async (formData: FormData) => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.post(
        "/capacitaciones/registro-manual",
        formData,
        {
          headers: { "Content-Type": "multipart/form-data" },
        },
      );
      return data;
    } catch (err: any) {
      setError(
        err.response?.data?.error || "Error al cargar el registro manual",
      );
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const descargarPlantillaRegistroCapacitacion = async (capacitacionId: string) => {
    const response = await api.get(
      `/capacitaciones/${capacitacionId}/registro-manual/plantilla`,
      { responseType: "blob" },
    );
    return response.data;
  };

  const descargarPlantillaRegistroManual = async (params: {
    empresa_id: string;
    titulo?: string;
    fecha?: string;
    instructor?: string;
    fechas_horario?: string;
    cantidad_horas?: string;
  }) => {
    const qs = new URLSearchParams({ empresa_id: params.empresa_id });
    if (params.titulo) qs.set("titulo", params.titulo);
    if (params.fecha) qs.set("fecha", params.fecha);
    if (params.instructor) qs.set("instructor", params.instructor);
    if (params.fechas_horario) qs.set("fechas_horario", params.fechas_horario);
    if (params.cantidad_horas) qs.set("cantidad_horas", params.cantidad_horas);

    const response = await api.get(
      `/capacitaciones/registro-manual/plantilla?${qs.toString()}`,
      { responseType: "blob" },
    );
    return response.data;
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
    getHistoricoCapacitaciones,
    exportarHistoricoCapacitaciones,
    getCapacitacionQr,
    cambiarEstadoCapacitacion,
    eliminarCapacitacion,
    eliminarAsistencia,
    exportarCapacitacion,
    crearCapacitacion,
    crearRegistroManual,
    adjuntarRegistroManualCapacitacion,
    descargarPlantillaRegistroCapacitacion,
    descargarPlantillaRegistroManual,
    actualizarCapacitacion,
    evaluarCapacitacion,
    actualizarRegistroCapacitacion,
  };
}

