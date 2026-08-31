"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Calendar,
  Database,
  Download,
  FileText,
  Loader2,
  RotateCcw,
  Search,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useEpp } from "@/hooks/useEpp";
import { useAlert } from "@/context/AlertContext";
import type { EppHistoricoFiltros, EppHistoricoRow } from "@/types";

const PAGE_SIZE = 25;
const SEARCH_DEBOUNCE_MS = 350;

function formatFecha(dateStr: string) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function toInputDate(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export default function BaseDatosEppPage() {
  const { empresa } = useAuth();
  const { showAlert } = useAlert();
  const {
    getHistoricoEpp,
    exportarHistoricoEpp,
    descargarPlanillaHistoricaEmpleado,
  } = useEpp();

  const [registros, setRegistros] = useState<EppHistoricoRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [downloadingEmpleadoId, setDownloadingEmpleadoId] = useState<string | null>(
    null,
  );

  const [trabajador, setTrabajador] = useState("");
  const [producto, setProducto] = useState("");
  const [fechaDesde, setFechaDesde] = useState("");
  const [fechaHasta, setFechaHasta] = useState("");

  const [trabajadorDebounced, setTrabajadorDebounced] = useState("");
  const [productoDebounced, setProductoDebounced] = useState("");

  useEffect(() => {
    const t = window.setTimeout(() => {
      setTrabajadorDebounced(trabajador);
      setPage(0);
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(t);
  }, [trabajador]);

  useEffect(() => {
    const t = window.setTimeout(() => {
      setProductoDebounced(producto);
      setPage(0);
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(t);
  }, [producto]);

  const filtrosActivos = useMemo(
    (): Omit<EppHistoricoFiltros, "limit" | "offset"> => ({
      trabajador: trabajadorDebounced.trim() || undefined,
      producto: productoDebounced.trim() || undefined,
      fecha_desde: fechaDesde || undefined,
      fecha_hasta: fechaHasta || undefined,
    }),
    [trabajadorDebounced, productoDebounced, fechaDesde, fechaHasta],
  );

  const hasActiveFilters =
    !!trabajador.trim() ||
    !!producto.trim() ||
    !!fechaDesde ||
    !!fechaHasta;

  useEffect(() => {
    if (!empresa?.id) return;

    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const data = await getHistoricoEpp(empresa.id, {
          ...filtrosActivos,
          limit: PAGE_SIZE,
          offset: page * PAGE_SIZE,
        });
        if (cancelled) return;
        setRegistros(data.registros);
        setTotal(data.total);
      } catch {
        if (cancelled) return;
        showAlert(
          "error",
          "Error",
          "No se pudo cargar la base histórica de EPP.",
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empresa?.id, filtrosActivos, page]);

  const registrosOrdenados = useMemo(
    () =>
      [...registros].sort((a, b) => {
        const ta = new Date(a.fecha || 0).getTime();
        const tb = new Date(b.fecha || 0).getTime();
        if (tb !== ta) return tb - ta;
        return b.id.localeCompare(a.id);
      }),
    [registros],
  );

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const showingFrom = total === 0 ? 0 : page * PAGE_SIZE + 1;
  const showingTo = Math.min((page + 1) * PAGE_SIZE, total);

  const clearFilters = () => {
    setTrabajador("");
    setProducto("");
    setFechaDesde("");
    setFechaHasta("");
    setPage(0);
  };

  const applyUltimos30 = () => {
    const today = new Date();
    const desde = new Date(today);
    desde.setDate(today.getDate() - 30);
    setFechaDesde(toInputDate(desde));
    setFechaHasta(toInputDate(today));
    setPage(0);
  };

  const applyEsteAnio = () => {
    const today = new Date();
    setFechaDesde(toInputDate(new Date(today.getFullYear(), 0, 1)));
    setFechaHasta(toInputDate(today));
    setPage(0);
  };

  const handleExport = async () => {
    if (!empresa?.id) return;
    setExporting(true);
    try {
      const blob = await exportarHistoricoEpp(empresa.id, filtrosActivos);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `base_historica_epp_${empresa.cuit || empresa.id}.csv`;
      link.click();
      window.URL.revokeObjectURL(url);
      showAlert(
        "success",
        "Exportación lista",
        "Se descargó el CSV con los filtros aplicados.",
      );
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: string } } };
      showAlert(
        "error",
        "Error",
        axiosErr.response?.data?.error ||
          "No se pudo exportar la base histórica.",
      );
    } finally {
      setExporting(false);
    }
  };

  const handlePlanillaHistorica = async (empleadoId: string | null, dni: string) => {
    if (!empleadoId) {
      showAlert(
        "warning",
        "Sin padrón",
        "Esta entrega no está vinculada al padrón. Solo se puede generar planilla histórica para trabajadores del padrón.",
      );
      return;
    }

    setDownloadingEmpleadoId(empleadoId);
    try {
      const blob = await descargarPlanillaHistoricaEmpleado(empleadoId);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `Planilla_EPP_historica_${dni}.pdf`;
      link.click();
      window.URL.revokeObjectURL(url);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: string } } };
      showAlert(
        "error",
        "Error",
        axiosErr.response?.data?.error ||
          "No se pudo generar la planilla histórica.",
      );
    } finally {
      setDownloadingEmpleadoId(null);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center gap-4">
        <Link
          href="/epp"
          className="h-10 w-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center hover:bg-slate-50 transition-colors cursor-pointer"
        >
          <ArrowLeft className="h-5 w-5 text-slate-600" />
        </Link>
        <div>
          <span className="text-sm font-semibold text-slate-500 flex items-center gap-1.5">
            <Database className="h-4 w-4" /> EPP
          </span>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">
            Base histórica de entregas
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Consultá todas las entregas y descargá la planilla Anexo I consolidada por trabajador.
          </p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-6 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Trabajador / DNI
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                value={trabajador}
                onChange={(e) => setTrabajador(e.target.value)}
                placeholder="Nombre o DNI..."
                className="w-full pl-9 pr-3 py-2.5 border border-slate-200 rounded-xl text-sm"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Producto EPP
            </label>
            <input
              type="text"
              value={producto}
              onChange={(e) => setProducto(e.target.value)}
              placeholder="Ej: Casco, Guantes..."
              className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Desde
            </label>
            <input
              type="date"
              value={fechaDesde}
              onChange={(e) => {
                setFechaDesde(e.target.value);
                setPage(0);
              }}
              className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Hasta
            </label>
            <input
              type="date"
              value={fechaHasta}
              onChange={(e) => {
                setFechaHasta(e.target.value);
                setPage(0);
              }}
              className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={applyUltimos30}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-100 text-slate-600 hover:bg-slate-200 cursor-pointer"
          >
            <Calendar className="h-3.5 w-3.5" />
            Últimos 30 días
          </button>
          <button
            type="button"
            onClick={applyEsteAnio}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-100 text-slate-600 hover:bg-slate-200 cursor-pointer"
          >
            <Calendar className="h-3.5 w-3.5" />
            Este año
          </button>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={clearFilters}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-slate-500 hover:text-slate-700 cursor-pointer"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Limpiar filtros
            </button>
          )}
          <button
            type="button"
            onClick={handleExport}
            disabled={exporting || loading}
            className="ml-auto inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 cursor-pointer"
          >
            {exporting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            Exportar CSV
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-slate-400">
            <Loader2 className="h-6 w-6 animate-spin mr-2" />
            Cargando registros...
          </div>
        ) : registros.length === 0 ? (
          <div className="py-16 text-center text-slate-500 text-sm">
            No hay entregas que coincidan con los filtros.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100 text-left">
                  <th className="px-4 py-3 text-[11px] font-bold text-slate-500 uppercase">
                    Trabajador
                  </th>
                  <th className="px-4 py-3 text-[11px] font-bold text-slate-500 uppercase">
                    DNI
                  </th>
                  <th className="px-4 py-3 text-[11px] font-bold text-slate-500 uppercase">
                    Producto
                  </th>
                  <th className="px-4 py-3 text-[11px] font-bold text-slate-500 uppercase">
                    Fecha
                  </th>
                  <th className="px-4 py-3 text-[11px] font-bold text-slate-500 uppercase text-right">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody>
                {registrosOrdenados.map((row) => (
                  <tr
                    key={row.id}
                    className="border-b border-slate-50 hover:bg-slate-50/50"
                  >
                    <td className="px-4 py-3 font-medium text-slate-800">
                      {row.trabajador}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{row.dni}</td>
                    <td className="px-4 py-3 text-slate-600">
                      {row.producto}
                      {row.cantidad > 1 ? ` (x${row.cantidad})` : ""}
                    </td>
                    <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                      {formatFecha(row.fecha)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() =>
                          handlePlanillaHistorica(row.empleado_id, row.dni)
                        }
                        disabled={
                          !row.empleado_id ||
                          (downloadingEmpleadoId !== null &&
                            downloadingEmpleadoId === row.empleado_id)
                        }
                        title={
                          row.empleado_id
                            ? "Descargar planilla Anexo I con todas las entregas"
                            : "Entrega sin vínculo al padrón"
                        }
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                      >
                        {downloadingEmpleadoId !== null &&
                        downloadingEmpleadoId === row.empleado_id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <FileText className="h-3.5 w-3.5" />
                        )}
                        Planilla histórica
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!loading && total > 0 && (
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-4 py-3 border-t border-slate-100 bg-slate-50/50">
            <p className="text-xs text-slate-500">
              Mostrando {showingFrom}–{showingTo} de {total}
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
                className="px-3 py-1.5 rounded-lg text-xs font-bold border border-slate-200 disabled:opacity-40 cursor-pointer"
              >
                Anterior
              </button>
              <span className="text-xs text-slate-500">
                Página {page + 1} de {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
                className="px-3 py-1.5 rounded-lg text-xs font-bold border border-slate-200 disabled:opacity-40 cursor-pointer"
              >
                Siguiente
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
