"use client";

import React, { useMemo, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useInformes } from "@/hooks/useInformes";
import Link from "next/link";
import {
  Plus,
  Calendar,
  Search,
  Folder,
  Trash2,
  Loader2,
  X,
  RotateCcw,
  CheckCircle2,
} from "lucide-react";
import { canWriteAppModule } from "@/lib/moduleAccess";
import { useAlert } from "@/context/AlertContext";
import { VisibleEnteToggle } from "@/components/VisibleEnteToggle";
import { actualizarVisibilidadInforme } from "@/lib/visibilidadEnte";
import { useQueryClient } from "@tanstack/react-query";

function toInputDate(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export default function InformesPage() {
  const { user, empresa } = useAuth();
  const { showAlert } = useAlert();
  const queryClient = useQueryClient();
  const PAGE_SIZE = 10;
  const [page, setPage] = useState(0);
  // Filtros client-side: ampliar página para no “perder” resultados
  const [searchTerm, setSearchTerm] = useState("");
  const [fechaDesde, setFechaDesde] = useState("");
  const [fechaHasta, setFechaHasta] = useState("");
  const [estado, setEstado] = useState<string>("todos");
  const [lugar, setLugar] = useState<string>("todos");

  const hasActiveFilters =
    !!searchTerm.trim() ||
    !!fechaDesde ||
    !!fechaHasta ||
    estado !== "todos" ||
    lugar !== "todos";

  const {
    data: informes,
    isLoading,
    total,
    eliminarInforme,
    isDeleting,
  } = useInformes(empresa?.id, {
    limit: hasActiveFilters ? 200 : PAGE_SIZE,
    offset: hasActiveFilters ? 0 : page * PAGE_SIZE,
  });

  const canCreate = canWriteAppModule(user, "informes");
  const canEdit = canCreate;
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const handleVisibilidadChange = async (id: string, visible: boolean) => {
    try {
      await actualizarVisibilidadInforme(id, visible);
      await queryClient.invalidateQueries({ queryKey: ["informes"] });
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: string } } };
      showAlert(
        "error",
        "Error",
        axiosErr.response?.data?.error ||
          "No se pudo actualizar la visibilidad ante el ente regulador.",
      );
    }
  };

  const clearFilters = () => {
    setSearchTerm("");
    setFechaDesde("");
    setFechaHasta("");
    setEstado("todos");
    setLugar("todos");
    setPage(0);
  };

  const applyEsteMes = () => {
    const today = new Date();
    setFechaDesde(toInputDate(new Date(today.getFullYear(), today.getMonth(), 1)));
    setFechaHasta(
      toInputDate(new Date(today.getFullYear(), today.getMonth() + 1, 0)),
    );
  };

  const applyUltimos30 = () => {
    const today = new Date();
    const desde = new Date(today);
    desde.setDate(today.getDate() - 30);
    setFechaDesde(toInputDate(desde));
    setFechaHasta(toInputDate(today));
  };

  const handleEliminar = async () => {
    if (!confirmDeleteId) return;
    try {
      await eliminarInforme(confirmDeleteId);
      setConfirmDeleteId(null);
      showAlert(
        "success",
        "Visita eliminada",
        "El informe de visita se eliminó correctamente.",
      );
    } catch (err: any) {
      showAlert(
        "error",
        "No se pudo eliminar",
        err.response?.data?.error ||
          err.message ||
          "Ocurrió un error al eliminar la visita.",
      );
    }
  };

  const lugaresUnicos = Array.from(
    new Set(
      informes
        ?.map((inf) => inf.lugar_visita)
        .filter((l): l is string => !!l) || [],
    ),
  ).sort();

  const formatTableDate = (dateStr: string) => {
    if (!dateStr) return "";
    const date = new Date(dateStr);
    const day = String(date.getDate()).padStart(2, "0");
    const months = [
      "Ene",
      "Feb",
      "Mar",
      "Abr",
      "May",
      "Jun",
      "Jul",
      "Ago",
      "Sep",
      "Oct",
      "Nov",
      "Dic",
    ];
    const month = months[date.getMonth()];
    return `${day} ${month}`;
  };

  const formatTableTime = (dateStr: string) => {
    if (!dateStr) return "";
    return new Date(dateStr).toLocaleTimeString("es-AR", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatFullDate = (dateStr: string) => {
    if (!dateStr) return "";
    return new Date(dateStr).toLocaleDateString("es-AR");
  };

  const getEstadoBadge = (estadoFirma: string) => {
    switch (estadoFirma) {
      case "borrador":
        return {
          label: "Borrador",
          classes: "bg-slate-100 text-slate-700 border border-slate-200",
        };
      case "pendiente_preventor":
        return {
          label: "Pte. Preventor",
          classes: "bg-blue-50 text-blue-700 border border-blue-100",
        };
      case "pendiente_dueno":
        return {
          label: "Pte. Dueño",
          classes: "bg-amber-50 text-amber-700 border border-amber-100",
        };
      case "firmado":
        return {
          label: "Cerrado",
          classes: "bg-emerald-50 text-emerald-700 border border-emerald-100",
        };
      case "archivado":
        return {
          label: "Archivado",
          classes: "bg-indigo-50 text-indigo-700 border border-indigo-100",
        };
      default:
        return {
          label: estadoFirma,
          classes: "bg-slate-100 text-slate-700 border border-slate-200",
        };
    }
  };

  const filteredInformes = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return (informes || [])
      .filter((inf) => {
        const matchesText =
          !q ||
          inf.actividad?.toLowerCase().includes(q) ||
          inf.numero_informe.toString().includes(q) ||
          inf.lugar_visita?.toLowerCase().includes(q) ||
          empresa?.razon_social?.toLowerCase().includes(q);

        const visitDate = new Date(inf.fecha_hora_visita);
        const startDate = fechaDesde
          ? new Date(fechaDesde + "T00:00:00")
          : null;
        const endDate = fechaHasta
          ? new Date(fechaHasta + "T23:59:59")
          : null;

        const matchesDesde = !startDate || visitDate >= startDate;
        const matchesHasta = !endDate || visitDate <= endDate;
        const matchesEstado = estado === "todos" || inf.estado_firma === estado;
        const matchesLugar = lugar === "todos" || inf.lugar_visita === lugar;
        const matchesEnte = user?.rol !== "ente_regulador" || Boolean(inf.visible_ente_regulador);

        return (
          matchesText &&
          matchesDesde &&
          matchesHasta &&
          matchesEstado &&
          matchesLugar &&
          matchesEnte
        );
      })
      .slice()
      .sort((a, b) => b.numero_informe - a.numero_informe);
  }, [
    informes,
    searchTerm,
    fechaDesde,
    fechaHasta,
    estado,
    lugar,
    empresa?.razon_social,
  ]);

  const totalInformes = informes?.length || 0;
  const visibleCount = filteredInformes.length;

  return (
    <div className="space-y-8">
      {/* Encabezado */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">
            Informes de Visita
          </h1>
          <p className="text-sm font-semibold text-slate-400 mt-1">
            {isLoading
              ? "Cargando..."
              : hasActiveFilters
                ? `${visibleCount} de ${totalInformes} informes`
                : `${totalInformes} informe${totalInformes === 1 ? "" : "s"}`}
          </p>
        </div>
        <div className="flex gap-3 select-none">
          <Link
            href="/archivo"
            className="inline-flex items-center justify-center gap-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-bold px-5 py-3 rounded-xl shadow-2xs hover:shadow-xs transition-all text-sm cursor-pointer"
          >
            <Folder className="h-4 w-4 text-slate-555" />
            Archivo Histórico
          </Link>
          {canCreate && (
            <Link
              href="/informes/nuevo"
              className="inline-flex items-center justify-center gap-2 bg-brand-primary hover:bg-brand-primary/95 text-white font-bold px-5 py-3 rounded-xl shadow-md shadow-blue-900/10 hover:shadow-lg transition-all text-sm cursor-pointer"
            >
              <Plus className="h-4 w-4 stroke-3" />
              Nuevo Informe
            </Link>
          )}
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs space-y-3">
        <div className="flex flex-col lg:flex-row gap-3 items-stretch">
          <div className="relative flex-1 min-w-0">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
              <Search className="h-4 w-4 text-slate-400" />
            </div>
            <input
              type="text"
              placeholder="Buscar por N°, actividad, área o empresa..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="block w-full pl-10 pr-3 py-2.5 border border-slate-200 rounded-xl bg-slate-50/80 text-slate-800 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-blue-600/25 focus:border-blue-600 text-sm font-semibold"
            />
          </div>

          <div className="flex flex-col sm:flex-row gap-3 flex-1 lg:flex-none">
            <div className="flex items-center gap-2 border border-slate-200 rounded-xl bg-slate-50/80 px-3 py-2 min-w-40">
              <div className="flex flex-col flex-1 min-w-0">
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider leading-none">
                  Estado
                </span>
                <select
                  value={estado}
                  onChange={(e) => setEstado(e.target.value)}
                  className="text-sm font-bold text-slate-700 bg-transparent border-0 p-0 focus:ring-0 focus:outline-hidden cursor-pointer w-full mt-1.5 leading-none"
                >
                  <option value="todos">Todos</option>
                  <option value="borrador">Borrador</option>
                  <option value="pendiente_preventor">Pendiente Preventor</option>
                  <option value="pendiente_dueno">Pendiente Dueño</option>
                  <option value="firmado">Firmado</option>
                  <option value="archivado">Archivado</option>
                </select>
              </div>
            </div>

            <div className="flex items-center gap-2 border border-slate-200 rounded-xl bg-slate-50/80 px-3 py-2 min-w-40">
              <div className="flex flex-col flex-1 min-w-0">
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider leading-none">
                  Lugar / Planta
                </span>
                <select
                  value={lugar}
                  onChange={(e) => setLugar(e.target.value)}
                  className="text-sm font-bold text-slate-700 bg-transparent border-0 p-0 focus:ring-0 focus:outline-hidden cursor-pointer w-full mt-1.5 leading-none"
                >
                  <option value="todos">Todos</option>
                  {lugaresUnicos.map((lug) => (
                    <option key={lug} value={lug}>
                      {lug}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider mr-1">
              Fecha
            </span>
            <button
              type="button"
              onClick={() => {
                setFechaDesde("");
                setFechaHasta("");
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer border ${
                !fechaDesde && !fechaHasta
                  ? "bg-blue-600 text-white border-blue-600"
                  : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
              }`}
            >
              Todas
            </button>
            <button
              type="button"
              onClick={applyEsteMes}
              className="px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer border bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
            >
              Este mes
            </button>
            <button
              type="button"
              onClick={applyUltimos30}
              className="px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer border bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
            >
              Últimos 30 días
            </button>

            <div className="flex items-center gap-2 border border-slate-200 rounded-xl bg-slate-50/80 px-3 py-1.5">
              <Calendar className="h-3.5 w-3.5 text-blue-600 shrink-0" />
              <input
                type="date"
                value={fechaDesde}
                onChange={(e) => setFechaDesde(e.target.value)}
                className="text-xs font-bold text-slate-700 bg-transparent border-0 p-0 focus:ring-0 focus:outline-hidden cursor-pointer"
                aria-label="Fecha desde"
              />
              <span className="text-slate-300 text-xs font-bold">→</span>
              <input
                type="date"
                value={fechaHasta}
                onChange={(e) => setFechaHasta(e.target.value)}
                className="text-xs font-bold text-slate-700 bg-transparent border-0 p-0 focus:ring-0 focus:outline-hidden cursor-pointer"
                aria-label="Fecha hasta"
              />
              {(fechaDesde || fechaHasta) && (
                <button
                  type="button"
                  onClick={() => {
                    setFechaDesde("");
                    setFechaHasta("");
                  }}
                  className="p-0.5 rounded text-slate-400 hover:text-slate-700 cursor-pointer"
                  aria-label="Quitar filtro de fechas"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>

          {hasActiveFilters && (
            <button
              type="button"
              onClick={clearFilters}
              className="inline-flex items-center justify-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-800 cursor-pointer"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Limpiar filtros
            </button>
          )}
        </div>
      </div>

      {/* Tabla/Tarjetas de Informes */}
      {isLoading ? (
        <div className="space-y-3">
          <div className="h-16 bg-white border border-slate-200 rounded-2xl animate-pulse"></div>
          <div className="h-16 bg-white border border-slate-200 rounded-2xl animate-pulse"></div>
          <div className="h-16 bg-white border border-slate-200 rounded-2xl animate-pulse"></div>
        </div>
      ) : filteredInformes && filteredInformes.length > 0 ? (
        <div className="space-y-4">
          {/* Vista Desktop: Tabla */}
          <div className="hidden md:block bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-2xs">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-100 text-left text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th
                      scope="col"
                      className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider w-28"
                    >
                      N° Informe
                    </th>
                    <th
                      scope="col"
                      className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider w-36"
                    >
                      Fecha y hora
                    </th>
                    <th
                      scope="col"
                      className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider"
                    >
                      Empresa — Área
                    </th>
                    <th
                      scope="col"
                      className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider"
                    >
                      Resumen
                    </th>
                    <th
                      scope="col"
                      className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider w-32"
                    >
                      Estado
                    </th>
                    <th
                      scope="col"
                      className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider w-36"
                    >
                      Ente
                    </th>
                    <th scope="col" className="relative px-6 py-4 w-40">
                      <span className="sr-only">Acciones</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {filteredInformes.map((inf) => (
                    <tr
                      key={inf.id}
                      className="hover:bg-slate-50/50 transition-colors"
                    >
                      <td className="whitespace-nowrap px-6 py-4.5 font-black text-slate-900 tabular-nums">
                        N° {String(inf.numero_informe).padStart(6, "0")}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4.5">
                        <span className="block font-bold text-slate-700">
                          {formatTableDate(inf.fecha_hora_visita)}
                        </span>
                        <span className="block text-xs font-semibold text-slate-400 mt-0.5">
                          {formatTableTime(inf.fecha_hora_visita)}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-6 py-4.5 font-bold text-slate-900">
                        {empresa?.razon_social || "Empresa"} —{" "}
                        {inf.lugar_visita || "Planta 1"}
                      </td>
                      <td className="px-6 py-4.5 text-slate-500 font-medium">
                        <span className="line-clamp-1">
                          {inf.actividad ||
                            "Relevamiento general de condiciones de higiene y seguridad."}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-6 py-4.5">
                        {(() => {
                          const badge = getEstadoBadge(inf.estado_firma);
                          return (
                            <span
                              className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-bold ${badge.classes}`}
                            >
                              {badge.label}
                            </span>
                          );
                        })()}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4.5">
                        {user?.rol === "ente_regulador" ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full">
                            <CheckCircle2 className="h-3 w-3" /> Habilitado
                          </span>
                        ) : (
                          <VisibleEnteToggle
                            checked={Boolean(inf.visible_ente_regulador)}
                            disabled={!canEdit}
                            onChange={(v) => void handleVisibilidadChange(inf.id, v)}
                          />
                        )}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4.5 text-right text-sm font-bold">
                        <div className="inline-flex items-center gap-3 justify-end">
                          <Link
                            href={`/informes/${inf.id}`}
                            className="text-brand-primary hover:text-blue-600 transition-colors"
                          >
                            Ver detalle
                          </Link>
                          {canCreate && (
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(inf.id)}
                              className="text-rose-600 hover:text-rose-700 transition-colors inline-flex items-center gap-1 cursor-pointer"
                              title="Eliminar visita"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              Eliminar
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Vista Mobile: Tarjetas */}
          <div className="block md:hidden space-y-4">
            {filteredInformes.map((inf) => {
              return (
                <div
                  key={inf.id}
                  className="bg-white border border-slate-200 rounded-2xl p-5 shadow-2xs space-y-4"
                >
                  <div className="flex justify-between items-start gap-4">
                    <div>
                      <span className="text-xs font-black text-slate-400 font-sans block">
                        N° {String(inf.numero_informe).padStart(6, "0")}
                      </span>
                      <span className="text-sm font-black text-slate-900 font-sans block mt-1 leading-snug">
                        {inf.actividad || "Relevamiento general"}
                      </span>
                      <span className="text-xs font-bold text-slate-500 font-sans block mt-1.5">
                        {empresa?.razon_social} ·{" "}
                        {inf.lugar_visita || "Planta 1"}
                      </span>
                    </div>
                    {(() => {
                      const badge = getEstadoBadge(inf.estado_firma);
                      return (
                        <span
                          className={`inline-flex px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider shrink-0 ${badge.classes}`}
                        >
                          {badge.label}
                        </span>
                      );
                    })()}
                  </div>

                  <div className="flex items-center justify-between pt-3.5 border-t border-slate-100 gap-2 flex-wrap">
                    <div className="flex flex-col gap-2">
                      <span className="text-xs font-bold text-slate-400">
                        {formatFullDate(inf.fecha_hora_visita)} ·{" "}
                        {formatTableTime(inf.fecha_hora_visita)}
                      </span>
                      {user?.rol === "ente_regulador" ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full w-fit">
                          <CheckCircle2 className="h-3 w-3" /> Habilitado
                        </span>
                      ) : (
                        <VisibleEnteToggle
                          checked={Boolean(inf.visible_ente_regulador)}
                          disabled={!canEdit}
                          onChange={(v) => void handleVisibilidadChange(inf.id, v)}
                        />
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {canCreate && (
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(inf.id)}
                          className="px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 font-black rounded-xl text-xs transition-all cursor-pointer inline-flex items-center gap-1"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Eliminar
                        </button>
                      )}
                      <Link
                        href={`/informes/${inf.id}`}
                        className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-black rounded-xl text-xs transition-all cursor-pointer"
                      >
                        Ver detalle
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center shadow-2xs">
          <p className="text-sm font-semibold text-slate-400">
            No se encontraron informes de visita para los filtros aplicados.
          </p>
        </div>
      )}

      {!hasActiveFilters && total > PAGE_SIZE && (
        <div className="flex items-center justify-between gap-3 bg-white border border-slate-200 rounded-2xl px-4 py-3 shadow-2xs">
          <p className="text-xs font-semibold text-slate-500">
            Mostrando {Math.min(page * PAGE_SIZE + 1, total)}–
            {Math.min((page + 1) * PAGE_SIZE, total)} de {total}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={page === 0 || isLoading}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-black text-slate-700 hover:bg-slate-50 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
            >
              Anterior
            </button>
            <span className="text-xs font-bold text-slate-600">
              Pág. {page + 1} / {Math.max(1, Math.ceil(total / PAGE_SIZE))}
            </span>
            <button
              type="button"
              disabled={(page + 1) * PAGE_SIZE >= total || isLoading}
              onClick={() => setPage((p) => p + 1)}
              className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-black text-slate-700 hover:bg-slate-50 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
            >
              Siguiente
            </button>
          </div>
        </div>
      )}

      {confirmDeleteId ? (
        <div className="fixed inset-0 z-50 bg-slate-900/45 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl border border-slate-100 space-y-4">
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
                <Trash2 className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-black text-slate-900 text-sm">
                  ¿Eliminar esta visita?
                </h3>
                <p className="text-xs text-slate-500 font-semibold mt-1 leading-relaxed">
                  Se borrará el informe, sus observaciones, acciones y fotos. Esta
                  acción no se puede deshacer.
                </p>
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setConfirmDeleteId(null)}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-xs font-black hover:bg-slate-50 cursor-pointer disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => void handleEliminar()}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-black cursor-pointer disabled:opacity-50 inline-flex items-center justify-center gap-1.5"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Eliminando…
                  </>
                ) : (
                  "Eliminar"
                )}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
