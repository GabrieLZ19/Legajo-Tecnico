import { useState, useCallback } from "react";
import { api } from "@/lib/api";
import type { EppProveedor, EppHistoricoFiltros, EppHistoricoRow } from "@/types";

export function useEpp() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(async <T,>(fn: () => Promise<T>, fallback: string): Promise<T> => {
    setLoading(true);
    setError(null);
    try {
      return await fn();
    } catch (err: unknown) {
      const message =
        typeof err === "object" &&
        err !== null &&
        "response" in err &&
        typeof (err as { response?: { data?: { error?: string } } }).response?.data?.error ===
          "string"
          ? (err as { response: { data: { error: string } } }).response.data.error
          : fallback;
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const getEntregas = useCallback(
    (empresaId: string) =>
      run(async () => {
        const { data } = await api.get(`/epp/entregas?empresa_id=${empresaId}`);
        return data;
      }, "Error al obtener entregas de EPP"),
    [run],
  );

  const getTiposEpp = useCallback(
    (incluirInactivos = false) =>
      run(async () => {
        const { data } = await api.get("/epp/tipos", {
          params: incluirInactivos ? { incluir_inactivos: true } : undefined,
        });
        return data;
      }, "Error al obtener tipos de EPP"),
    [run],
  );

  const descargarPdfEntrega = useCallback(
    (entregaId: string) =>
      run(async () => {
        const res = await api.get(`/epp/entregas/${entregaId}/pdf`, { responseType: "blob" });
        return res.data;
      }, "Error al descargar PDF de EPP"),
    [run],
  );

  const crearTipoEpp = useCallback(
    (payload: { nombre: string; descripcion?: string; foto?: File }) =>
      run(async () => {
        const form = new FormData();
        form.append("nombre", payload.nombre);
        if (payload.descripcion) form.append("descripcion", payload.descripcion);
        if (payload.foto) form.append("foto", payload.foto);
        const { data } = await api.post("/epp/tipos", form, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        return data;
      }, "Error al crear tipo de EPP"),
    [run],
  );

  const actualizarTipoEpp = useCallback(
    (id: string, payload: { nombre?: string; descripcion?: string; activo?: boolean; foto?: File }) =>
      run(async () => {
        const form = new FormData();
        if (payload.nombre !== undefined) form.append("nombre", payload.nombre);
        if (payload.descripcion !== undefined) form.append("descripcion", payload.descripcion);
        if (payload.activo !== undefined) form.append("activo", String(payload.activo));
        if (payload.foto) form.append("foto", payload.foto);
        const { data } = await api.patch(`/epp/tipos/${id}`, form, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        return data;
      }, "Error al actualizar tipo de EPP"),
    [run],
  );

  const crearEntregaEpp = useCallback(
    (payload: unknown) =>
      run(async () => {
        const { data } = await api.post("/epp/entregas", payload);
        return data;
      }, "Error al registrar entrega de EPP"),
    [run],
  );

  const getEmpleados = useCallback(
    (empresaId: string) =>
      run(async () => {
        const { data } = await api.get(`/epp/empleados?empresa_id=${empresaId}`);
        return data;
      }, "Error al obtener trabajadores"),
    [run],
  );

  const crearEmpleado = useCallback(
    (payload: { empresa_id: string; nombre: string; documento: string; sector?: string }) =>
      run(async () => {
        const { data } = await api.post("/epp/empleados", payload);
        return data;
      }, "Error al crear trabajador"),
    [run],
  );

  const actualizarEmpleado = useCallback(
    (id: string, payload: { nombre?: string; documento?: string; sector?: string | null; activo?: boolean }) =>
      run(async () => {
        const { data } = await api.patch(`/epp/empleados/${id}`, payload);
        return data;
      }, "Error al actualizar trabajador"),
    [run],
  );

  const buscarEmpleadoPorQr = useCallback(
    (token: string) =>
      run(async () => {
        const encoded = encodeURIComponent(token);
        const { data } = await api.get(`/epp/empleados/qr/${encoded}`);
        return data;
      }, "QR de trabajador no reconocido"),
    [run],
  );

  const generarQrEmpleado = useCallback(
    (id: string) =>
      run(async () => {
        const { data } = await api.get(`/epp/empleados/${id}/qr`);
        return data as { qr: string; payload: string; empleado: unknown };
      }, "Error al generar QR"),
    [run],
  );

  const getProveedores = useCallback(
    () =>
      run(async () => {
        const { data } = await api.get("/epp/proveedores");
        return data;
      }, "Error al obtener proveedores"),
    [run],
  );

  const crearProveedor = useCallback(
    (payload: { nombre: string; email: string }) =>
      run(async () => {
        const { data } = await api.post<EppProveedor>("/epp/proveedores", payload);
        return data;
      }, "Error al crear proveedor"),
    [run],
  );

  const getLicitaciones = useCallback(
    (empresaId: string) =>
      run(async () => {
        const { data } = await api.get(`/epp/licitaciones?empresa_id=${empresaId}`);
        return data;
      }, "Error al obtener licitaciones"),
    [run],
  );

  const crearLicitacion = useCallback(
    (payload: unknown) =>
      run(async () => {
        const { data } = await api.post("/epp/licitaciones", payload);
        return data;
      }, "Error al crear licitación"),
    [run],
  );

  const getHistoricoEpp = useCallback(
    (empresaId: string, filtros: EppHistoricoFiltros = {}) =>
      run(async () => {
        const { data } = await api.get("/epp/historico", {
          params: { empresa_id: empresaId, ...filtros },
        });
        return data as {
          registros: EppHistoricoRow[];
          total: number;
          limit: number;
          offset: number;
        };
      }, "Error al obtener base histórica de EPP"),
    [run],
  );

  const exportarHistoricoEpp = useCallback(
    (empresaId: string, filtros: Omit<EppHistoricoFiltros, "limit" | "offset"> = {}) =>
      run(async () => {
        const params = new URLSearchParams({ empresa_id: empresaId });
        if (filtros.trabajador) params.set("trabajador", filtros.trabajador);
        if (filtros.producto) params.set("producto", filtros.producto);
        if (filtros.fecha_desde) params.set("fecha_desde", filtros.fecha_desde);
        if (filtros.fecha_hasta) params.set("fecha_hasta", filtros.fecha_hasta);
        const res = await api.get(`/epp/historico/exportar?${params.toString()}`, {
          responseType: "blob",
        });
        return res.data as Blob;
      }, "Error al exportar base histórica de EPP"),
    [run],
  );

  const descargarPlanillaHistoricaEmpleado = useCallback(
    (empleadoId: string) =>
      run(async () => {
        const res = await api.get(`/epp/empleados/${empleadoId}/planilla-historica`, {
          responseType: "blob",
        });
        return res.data as Blob;
      }, "Error al descargar planilla histórica"),
    [run],
  );

  return {
    loading,
    error,
    getEntregas,
    getTiposEpp,
    descargarPdfEntrega,
    crearTipoEpp,
    actualizarTipoEpp,
    crearEntregaEpp,
    getEmpleados,
    crearEmpleado,
    actualizarEmpleado,
    buscarEmpleadoPorQr,
    generarQrEmpleado,
    getProveedores,
    crearProveedor,
    getLicitaciones,
    crearLicitacion,
    getHistoricoEpp,
    exportarHistoricoEpp,
    descargarPlanillaHistoricaEmpleado,
  };
}
