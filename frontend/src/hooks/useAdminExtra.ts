import { useState, useCallback } from "react";
import { api } from "@/lib/api";
import { descargarInformePdf } from "@/hooks/useInformes";

export function useAdminMetricas() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getMetricas = useCallback(async (dateFrom?: string, dateTo?: string) => {
    setLoading(true);
    setError(null);
    try {
      const [empresasRes, dashboardRes] = await Promise.all([
        api.get("/admin/empresas"),
        api.get("/admin/dashboard", {
          params: {
            ...(dateFrom ? { fechaDesde: dateFrom } : {}),
            ...(dateTo ? { fechaHasta: dateTo } : {}),
          },
        }),
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

export type AuditoriaLogEntry = {
  id: string;
  usuario_id: string;
  accion: string;
  entidad: string;
  entidad_id: string;
  detalles: Record<string, unknown> | null;
  created_at: string;
  perfiles: {
    nombre_completo: string;
    username: string;
  } | null;
};

export type AuditoriaResponse = {
  items: AuditoriaLogEntry[];
  total: number;
  limit: number;
  offset: number;
};

export function useAuditoria() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getAuditoria = useCallback(
    async (params?: { limit?: number; offset?: number; q?: string }) => {
      setLoading(true);
      setError(null);
      try {
        const { data } = await api.get<AuditoriaResponse>("/admin/auditoria", {
          params,
        });
        return data;
      } catch (err: any) {
        setError(err.response?.data?.error || "Error al obtener registros de auditoría");
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  return {
    loading,
    error,
    getAuditoria,
  };
}

export function useArchivo() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getArchivoData = useCallback(async (params?: { empresaId?: string; tipo?: string }) => {
    setLoading(true);
    setError(null);
    try {
      const [empresasRes, archivoRes, dashboardRes] = await Promise.all([
        api.get("/admin/empresas"),
        api.get("/admin/archivo", { params }),
        api.get("/admin/dashboard"),
      ]);
      const documentos = (archivoRes.data.documentos || []) as Array<{
        id: string;
        tipo: "informe" | "capacitacion" | "epp";
        titulo: string;
        fecha: string;
        empresa_id: string;
        empresa_razon_social: string;
        pdf_disponible: boolean;
        extra?: Record<string, string | number | boolean | null>;
      }>;

      const informes = documentos.map((doc) => ({
        id: doc.id,
        empresa_id: doc.empresa_id,
        preventor_id: "",
        numero_informe: doc.tipo === "informe" ? Number(doc.titulo.replace(/\D/g, "")) || 0 : 0,
        actividad: doc.titulo,
        fecha_hora_visita: doc.fecha,
        estado_firma:
          doc.extra?.estado_firma === "firmado" || doc.pdf_disponible ? "firmado" : "borrador",
        url_pdf_generado: doc.pdf_disponible ? "1" : undefined,
        created_at: doc.fecha,
        updated_at: doc.fecha,
        tipo_archivo: doc.tipo,
        titulo_archivo: doc.titulo,
      }));

      return {
        empresas: empresasRes.data,
        informes,
        dashboard: dashboardRes.data,
        documentos,
      };
    } catch (err: any) {
      setError(err.response?.data?.error || "Error al cargar archivo");
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);


  const descargarPdfArchivo = useCallback(async (informeId: string, tipo: "informe" | "capacitacion" | "epp" = "informe") => {
    setLoading(true);
    setError(null);
    try {
      if (tipo === "informe") {
        return await descargarInformePdf(informeId);
      }
      const path =
        tipo === "epp"
          ? `/epp/entregas/${informeId}/pdf`
          : `/capacitaciones/${informeId}/exportar?formato=pdf`;
      const response = await api.get(path, {
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
