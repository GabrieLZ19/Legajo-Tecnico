import { useState, useCallback } from "react";
import { api } from "@/lib/api";

export interface TipoEPP {
  id: string;
  nombre: string;
  categoria?: string;
  descripcion?: string;
}

export interface EntregaEPP {
  id: string;
  empresa_id: string;
  nombre_empleado: string;
  dni_empleado: string;
  sector?: string;
  puesto?: string;
  fecha_entrega: string;
  firma_url?: string;
  pdf_url?: string;
  items?: Array<{
    tipo_epp_id: string;
    cantidad: number;
    observaciones?: string;
  }>;
}

export function useEpp() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getEntregas = useCallback(async (empresaId: string) => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.get(`/epp/entregas?empresa_id=${empresaId}`);
      return data;
    } catch (err: any) {
      setError(err.response?.data?.error || "Error al obtener entregas de EPP");
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const getTiposEpp = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.get("/epp/tipos");
      return data;
    } catch (err: any) {
      setError(err.response?.data?.error || "Error al obtener tipos de EPP");
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const descargarPdfEntrega = useCallback(async (entregaId: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get(`/epp/entregas/${entregaId}/pdf`, {
        responseType: "blob",
      });
      return res.data;
    } catch (err: any) {
      setError(err.response?.data?.error || "Error al descargar PDF de EPP");
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const crearTipoEpp = useCallback(async (payload: { nombre: string; categoria?: string; descripcion?: string }) => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.post("/epp/tipos", payload);
      return data;
    } catch (err: any) {
      setError(err.response?.data?.error || "Error al crear tipo de EPP");
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const crearEntregaEpp = useCallback(async (payload: any) => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.post("/epp/entregas", payload);
      return data;
    } catch (err: any) {
      setError(err.response?.data?.error || "Error al registrar entrega de EPP");
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    loading,
    error,
    getEntregas,
    getTiposEpp,
    descargarPdfEntrega,
    crearTipoEpp,
    crearEntregaEpp,
  };
}
