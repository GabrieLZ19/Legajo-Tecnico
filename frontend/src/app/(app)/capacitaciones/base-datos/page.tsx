"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Calendar,
  Database,
  Download,
  Loader2,
  RotateCcw,
  Search,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useCapacitaciones } from "@/hooks/useCapacitaciones";
import { useAlert } from "@/context/AlertContext";
import type {
  CapacitacionHistoricoFiltros,
  CapacitacionHistoricoRow,
  HistoricoResultadoFiltro,
} from "@/types";

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

const RESULTADO_OPCIONES: { key: HistoricoResultadoFiltro; label: string }[] =
  [
    { key: "todos", label: "Todos" },
    { key: "aprobado", label: "Aprobados" },
    { key: "desaprobado", label: "Desaprobados" },
    { key: "sin_evaluacion", label: "Sin evaluación" },
  ];

export default function BaseDatosCapacitacionesPage() {
  const { empresa } = useAuth();
  const { showAlert } = useAlert();
  const { getHistoricoCapacitaciones, exportarHistoricoCapacitaciones } =
    useCapacitaciones();

  const [registros, setRegistros] = useState<CapacitacionHistoricoRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  const [participante, setParticipante] = useState("");
  const [tema, setTema] = useState("");
  const [fechaDesde, setFechaDesde] = useState("");
  const [fechaHasta, setFechaHasta] = useState("");
  const [resultado, setResultado] = useState<HistoricoResultadoFiltro>("todos");

  const [participanteDebounced, setParticipanteDebounced] = useState("");
  const [temaDebounced, setTemaDebounced] = useState("");

  useEffect(() => {
    const t = window.setTimeout(() => {
      setParticipanteDebounced(participante);
      setPage(0);
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(t);
  }, [participante]);

  useEffect(() => {
    const t = window.setTimeout(() => {
      setTemaDebounced(tema);
      setPage(0);
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(t);
  }, [tema]);

  const filtrosActivos = useMemo(
    (): Omit<CapacitacionHistoricoFiltros, "limit" | "offset"> => ({
      participante: participanteDebounced.trim() || undefined,
      tema: temaDebounced.trim() || undefined,
      fecha_desde: fechaDesde || undefined,
      fecha_hasta: fechaHasta || undefined,
      resultado: resultado !== "todos" ? resultado : undefined,
    }),
    [
      participanteDebounced,
      temaDebounced,
      fechaDesde,
      fechaHasta,
      resultado,
    ],
  );

  const hasActiveFilters =
    !!participante.trim() ||
    !!tema.trim() ||
    !!fechaDesde ||
    !!fechaHasta ||
    resultado !== "todos";

  useEffect(() => {
    if (!empresa?.id) return;

    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const data = await getHistoricoCapacitaciones(empresa.id, {
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
          "No se pudo cargar la base histórica de capacitaciones.",
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

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const showingFrom = total === 0 ? 0 : page * PAGE_SIZE + 1;
  const showingTo = Math.min((page + 1) * PAGE_SIZE, total);

  const clearFilters = () => {
    setParticipante("");
    setTema("");
    setFechaDesde("");
    setFechaHasta("");
    setResultado("todos");
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
      const blob = await exportarHistoricoCapacitaciones(
        empresa.id,
        filtrosActivos,
      );
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `base_historica_capacitaciones_${empresa.cuit || empresa.id}.csv`;
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

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="space-y-3">
          <Link
            href="/capacitaciones"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-800 transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Volver a capacitaciones
          </Link>
          <div>
            <span className="text-sm font-semibold text-slate-500 flex items-center gap-1.5">
              <Database className="h-4 w-4" /> Base histórica
            </span>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight mt-1">
              Capacitaciones por participante
            </h1>
            <p className="text-sm text-slate-500 font-medium mt-1 max-w-2xl">
              Filtrá por persona, tema, fechas o resultado para encontrar
              capacitaciones rápido.
            </p>
          </div>
        </div>

        <button
          type="button"
          disabled={exporting || loading || total === 0}
          onClick={() => void handleExport()}
          className="inline-flex items-center justify-center gap-2 shrink-0 min-h-11 px-5 py-3 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-800 font-bold rounded-xl text-sm cursor-pointer disabled:opacity-50"
        >
          {exporting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Download className="h-4 w-4" />
          )}
          Descargar Excel (.csv)
        </button>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={participante}
              onChange={(e) => setParticipante(e.target.value)}
              maxLength={80}
              placeholder="Participante o DNI..."
              className="w-full pl-10 pr-3 py-2.5 border border-slate-200 rounded-xl bg-slate-50/80 text-sm font-semibold text-slate-800 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-blue-600/25 focus:border-blue-600"
            />
          </div>
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={tema}
              onChange={(e) => setTema(e.target.value)}
              maxLength={80}
              placeholder="Tema de capacitación..."
              className="w-full pl-10 pr-3 py-2.5 border border-slate-200 rounded-xl bg-slate-50/80 text-sm font-semibold text-slate-800 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-blue-600/25 focus:border-blue-600"
            />
          </div>
        </div>

        <div className="flex flex-col lg:flex-row lg:items-center gap-3 justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider mr-1">
              Resultado
            </span>
            {RESULTADO_OPCIONES.map((opt) => (
              <button
                key={opt.key}
                type="button"
                onClick={() => {
                  setResultado(opt.key);
                  setPage(0);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer border ${
                  resultado === opt.key
                    ? "bg-blue-600 text-white border-blue-600"
                    : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={applyUltimos30}
              className="px-3 py-1.5 rounded-lg text-xs font-bold border bg-white text-slate-600 border-slate-200 hover:bg-slate-50 cursor-pointer"
            >
              Últimos 30 días
            </button>
            <button
              type="button"
              onClick={applyEsteAnio}
              className="px-3 py-1.5 rounded-lg text-xs font-bold border bg-white text-slate-600 border-slate-200 hover:bg-slate-50 cursor-pointer"
            >
              Este año
            </button>
            <div className="flex items-center gap-2 border border-slate-200 rounded-xl bg-slate-50/80 px-3 py-1.5">
              <Calendar className="h-3.5 w-3.5 text-blue-600 shrink-0" />
              <input
                type="date"
                value={fechaDesde}
                onChange={(e) => {
                  setFechaDesde(e.target.value);
                  setPage(0);
                }}
                className="text-xs font-bold text-slate-700 bg-transparent border-0 p-0 focus:ring-0 focus:outline-hidden cursor-pointer"
                aria-label="Fecha desde"
              />
              <span className="text-slate-300 text-xs font-bold">→</span>
              <input
                type="date"
                value={fechaHasta}
                onChange={(e) => {
                  setFechaHasta(e.target.value);
                  setPage(0);
                }}
                className="text-xs font-bold text-slate-700 bg-transparent border-0 p-0 focus:ring-0 focus:outline-hidden cursor-pointer"
                aria-label="Fecha hasta"
              />
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 pt-1 border-t border-slate-100">
          <p className="text-xs font-semibold text-slate-400">
            {loading
              ? "Cargando registros..."
              : `${total} registro${total === 1 ? "" : "s"}${
                  hasActiveFilters ? " con filtros aplicados" : " en total"
                }`}
          </p>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={clearFilters}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-800 cursor-pointer"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Limpiar filtros
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-12 flex flex-col items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          <p className="text-xs text-slate-400 mt-3 font-semibold">
            Cargando base histórica...
          </p>
        </div>
      ) : registros.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center">
          <Database className="h-10 w-10 text-slate-300 mx-auto mb-3" />
          <p className="text-sm font-semibold text-slate-500">
            {hasActiveFilters
              ? "No hay registros que coincidan con los filtros."
              : "Aún no hay asistencias registradas en capacitaciones digitales."}
          </p>
        </div>
      ) : (
        <>
          <div className="hidden md:block bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-2xs">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-100 text-left text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    {[
                      "Participante",
                      "DNI",
                      "Tema de capacitación",
                      "Fecha",
                      "Calif.",
                    ].map((col) => (
                      <th
                        key={col}
                        scope="col"
                        className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-wider"
                      >
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {registros.map((row) => (
                    <tr
                      key={row.id}
                      className="hover:bg-slate-50/60 transition-colors"
                    >
                      <td className="px-6 py-4 font-bold text-slate-900 whitespace-nowrap">
                        {row.participante}
                      </td>
                      <td className="px-6 py-4 font-semibold text-slate-600 tabular-nums whitespace-nowrap">
                        {row.dni}
                      </td>
                      <td className="px-6 py-4 font-medium text-slate-700 max-w-xs">
                        <Link
                          href={`/capacitaciones/${row.capacitacion_id}`}
                          className="hover:text-blue-600 hover:underline line-clamp-2"
                        >
                          {row.tema}
                        </Link>
                      </td>
                      <td className="px-6 py-4 text-slate-600 font-semibold whitespace-nowrap">
                        {formatFecha(row.fecha)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {row.con_evaluacion ? (
                          <span
                            className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-black ${
                              row.aprobado
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-100"
                                : "bg-rose-50 text-rose-700 border border-rose-100"
                            }`}
                          >
                            {row.calificacion ?? 0}%
                          </span>
                        ) : (
                          <span className="text-xs font-bold text-slate-500">
                            Asistió
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="md:hidden space-y-3">
            {registros.map((row) => (
              <div
                key={row.id}
                className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs space-y-2"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-black text-slate-900">
                      {row.participante}
                    </p>
                    <p className="text-xs font-bold text-slate-500 mt-0.5">
                      DNI {row.dni}
                    </p>
                  </div>
                  {row.con_evaluacion ? (
                    <span
                      className={`shrink-0 inline-flex px-2.5 py-0.5 rounded-full text-[10px] font-black ${
                        row.aprobado
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-rose-50 text-rose-700"
                      }`}
                    >
                      {row.calificacion ?? 0}%
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold text-slate-500 shrink-0">
                      Asistió
                    </span>
                  )}
                </div>
                <Link
                  href={`/capacitaciones/${row.capacitacion_id}`}
                  className="text-sm font-bold text-slate-700 hover:text-blue-600 block"
                >
                  {row.tema}
                </Link>
                <p className="text-xs font-semibold text-slate-400">
                  {formatFecha(row.fecha)}
                </p>
              </div>
            ))}
          </div>

          {total > PAGE_SIZE && (
            <div className="flex items-center justify-between gap-3 bg-white border border-slate-200 rounded-2xl px-4 py-3 shadow-2xs">
              <p className="text-xs font-semibold text-slate-500">
                Mostrando {showingFrom}–{showingTo} de {total}
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={page === 0 || loading}
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-black text-slate-700 hover:bg-slate-50 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
                >
                  Anterior
                </button>
                <span className="text-xs font-bold text-slate-600">
                  Pág. {page + 1} / {totalPages}
                </span>
                <button
                  type="button"
                  disabled={(page + 1) * PAGE_SIZE >= total || loading}
                  onClick={() => setPage((p) => p + 1)}
                  className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-black text-slate-700 hover:bg-slate-50 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
                >
                  Siguiente
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
