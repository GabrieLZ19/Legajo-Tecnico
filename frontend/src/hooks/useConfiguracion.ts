import { useState, useCallback } from "react";
import { api } from "@/lib/api";

export interface ConsultoraConfig {
  id: string;
  nombre: string;
  cuit?: string;
  direccion?: string;
  telefono?: string;
  email?: string;
  logo_url?: string;
}

export function useConfiguracion() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getConsultora = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.get("/admin/consultora");
      return data;
    } catch (err: any) {
      setError(err.response?.data?.error || "Error al cargar datos de la consultora");
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const updateConsultora = useCallback(async (formData: any) => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.put("/admin/consultora", formData);
      return data;
    } catch (err: any) {
      setError(err.response?.data?.error || "Error al actualizar la consultora");
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const uploadConsultoraLogo = useCallback(async (consultoraId: string, logoFile: File) => {
    setLoading(true);
    setError(null);
    try {
      const formDataUpload = new FormData();
      formDataUpload.append("logo", logoFile);
      const { data } = await api.post(`/admin/consultoras/${consultoraId}/logo`, formDataUpload, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      return data;
    } catch (err: any) {
      setError(err.response?.data?.error || "Error al subir el logo");
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const uploadEmpresaLogo = useCallback(async (empresaId: string, logoFile: File) => {
    setLoading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("logo", logoFile);
      const { data } = await api.post(`/empresas/${empresaId}/logo`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      return data;
    } catch (err: any) {
      setError(err.response?.data?.error || "Error al subir logo de empresa");
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const enviarNotificacionAdmin = useCallback(async (notificacionData: any) => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.post("/admin/notificaciones", notificacionData);
      return data;
    } catch (err: any) {
      setError(err.response?.data?.error || "Error al enviar notificación");
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    loading,
    error,
    getConsultora,
    updateConsultora,
    uploadConsultoraLogo,
    uploadEmpresaLogo,
    enviarNotificacionAdmin,
  };
}
