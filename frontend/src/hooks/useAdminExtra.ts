import { useState, useCallback } from "react";
import { api } from "@/lib/api";

export function useAdminMetricas() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getMetricas = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [empresasRes, dashboardRes] = await Promise.all([
        api.get("/admin/empresas"),
        api.get("/admin/dashboard"),
      ]);
      return {
        empresas: empresasRes.data,
        dashboard: dashboardRes.data,
      };
    } catch (err: any) {
      setError(err.response?.data?.error || "Error al obtener métricas");
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    loading,
    error,
    getMetricas,
  };
}

export function useAuditoria() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getAuditoria = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.get("/admin/auditoria");
      return data;
    } catch (err: any) {
      setError(err.response?.data?.error || "Error al obtener registros de auditoría");
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    loading,
    error,
    getAuditoria,
  };
}

export function useArchivo() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getArchivoData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [empresasRes, informesRes, dashboardRes] = await Promise.all([
        api.get("/admin/empresas"),
        api.get("/informes"),
        api.get("/admin/dashboard"),
      ]);
      return {
        empresas: empresasRes.data,
        informes: informesRes.data,
        dashboard: dashboardRes.data,
      };
    } catch (err: any) {
      setError(err.response?.data?.error || "Error al cargar archivo");
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);


  const descargarPdfArchivo = useCallback(async (informeId: string) => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.get(`/informes/${informeId}/pdf`, {
        responseType: "blob",
      });
      return response.data;
    } catch (err: any) {
      setError(err.response?.data?.error || "Error al descargar PDF");
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    loading,
    error,
    getArchivoData,
    descargarPdfArchivo,
  };
}
