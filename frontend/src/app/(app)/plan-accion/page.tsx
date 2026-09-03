"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import { usePlanAccion, usePlanAccionResponsables, exportarPlanAccion } from "@/hooks/usePlanAccion";

import { AccionMejora, EstadoAccion } from "@/types";
import { FileSpreadsheet, FileText, Loader, Plus, X, CheckCircle2 } from "lucide-react";
import { useAlert } from "@/context/AlertContext";
import { canWriteAppModule } from "@/lib/moduleAccess";
import { VisibleEnteToggle } from "@/components/VisibleEnteToggle";
import {
  assertDownloadBlob,
  triggerBrowserDownload,
} from "@/lib/downloadBlob";

export default function PlanAccionPage() {
  const { user, empresa } = useAuth();
  const { showAlert } = useAlert();
  const PAGE_SIZE = 10;
  const [page, setPage] = useState(0);
  const [filterEstado, setFilterEstado] = useState<EstadoAccion | "todos">(
    "todos",
  );
  const [filterResponsable, setFilterResponsable] = useState<string>("todos");
  const [exportingExcel, setExportingExcel] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [nuevaDescripcion, setNuevaDescripcion] = useState("");
  const [nuevoResponsable, setNuevoResponsable] = useState("");
  const [nuevoSector, setNuevoSector] = useState("Planta");
  const [nuevaVisibleEnte, setNuevaVisibleEnte] = useState(false);
  const [savingAccion, setSavingAccion] = useState(false);
  const canEdit = canWriteAppModule(user, "planAccion");

  const formatAccionFecha = (acc: AccionMejora) => {
    const raw = acc.informes_visita?.fecha_hora_visita || acc.created_at;
    return new Date(raw).toLocaleDateString("es-AR", {
      day: "2-digit",
      month: "2-digit",
    });
  };

  const accionSector = (acc: AccionMejora) =>
    acc.sector || acc.informes_visita?.lugar_visita || "Planta";

  const {
    data: acciones,
    isLoading,
    total,
    resumen,
    actualizarEstado,
    actualizarAccion,
    crearAccionManual,
  } = usePlanAccion(
    empresa?.id,
    filterEstado === "todos" ? undefined : filterEstado,
    { limit: PAGE_SIZE, offset: page * PAGE_SIZE },
    filterResponsable === "todos" ? undefined : filterResponsable,
  );

  const { data: responsables = [] } = usePlanAccionResponsables(empresa?.id);

  const accionesList = useMemo(
    () =>
      (acciones || []).filter(
        (acc) => user?.rol !== "ente_regulador" || Boolean(acc.visible_ente_regulador),
      ),
    [acciones, user?.rol],
  );

  const handleStatusChange = async (id: string, nuevoEstado: EstadoAccion) => {
    try {
      await actualizarEstado({ id, estado: nuevoEstado });
      showAlert(
        "success",
        "Estado actualizado",
        "La medida correctiva se actualizó con éxito.",
      );
    } catch (err: any) {
      showAlert(
        "error",
        "Error",
        err.message || "Error al actualizar el estado de la acción",
      );
    }
  };

  const handleVisibilidadChange = async (id: string, visible: boolean) => {
    try {
      await actualizarAccion({ id, visible_ente_regulador: visible });
    } catch (err: any) {
      showAlert(
        "error",
        "Error",
        err.message || "No se pudo actualizar la visibilidad",
      );
    }
  };

  const handleCrearAccion = async () => {
    if (!empresa?.id || !nuevaDescripcion.trim()) return;
    setSavingAccion(true);
    try {
      await crearAccionManual({
        empresa_id: empresa.id,
        descripcion: nuevaDescripcion.trim(),
        responsable: nuevoResponsable.trim() || undefined,
        sector: nuevoSector.trim() || "Planta",
        visible_ente_regulador: nuevaVisibleEnte,
      });
      setShowModal(false);
      setNuevaDescripcion("");
      setNuevoResponsable("");
      setNuevoSector("Planta");
      setNuevaVisibleEnte(false);
      showAlert("success", "Acción creada", "La acción manual se agregó al plan.");
    } catch (err: any) {
      showAlert(
        "error",
        "Error",
        err.response?.data?.error || err.message || "No se pudo crear la acción",
      );
    } finally {
      setSavingAccion(false);
    }
  };

  const handleExportExcel = async () => {
    if (!empresa) return;
    setExportingExcel(true);
    try {
      const data = await exportarPlanAccion(empresa.id, "csv");
      const blob = await assertDownloadBlob(data);
      triggerBrowserDownload(
        new Blob([blob], { type: "text/csv;charset=utf-8" }),
        `plan_de_accion_${empresa.cuit}.csv`,
      );
      showAlert(
        "success",
        "Exportación exitosa",
        "El archivo Excel (.csv) se ha descargado correctamente.",
      );
    } catch (err) {
      showAlert(
        "error",
        "Error al exportar",
        err instanceof Error
          ? err.message
          : "No se pudo exportar el plan de acción a Excel.",
      );
    } finally {
      setExportingExcel(false);
    }
  };

  const handleExportPDF = async () => {
    if (!empresa) return;
    setExportingPdf(true);
    try {
      const data = await exportarPlanAccion(empresa.id, "pdf");
      const blob = await assertDownloadBlob(data, "pdf");
      triggerBrowserDownload(
        blob,
        `plan_de_accion_${empresa.cuit}.pdf`,
      );
      showAlert(
        "success",
        "Exportación exitosa",
        "El documento PDF se ha descargado correctamente.",
      );
    } catch (err) {
      showAlert(
        "error",
        "Error al exportar",
        err instanceof Error
          ? err.message
          : "No se pudo exportar el plan de acción a PDF.",
      );
    } finally {
      setExportingPdf(false);
    }
  };

  // Tarjetas: resumen global de la empresa (no solo la página actual)
  const totalAcciones = resumen?.total ?? 0;
  const cumplidas = resumen?.cumplidas ?? 0;
  const pendientes = (resumen?.pendientes ?? 0) + (resumen?.atendidas ?? 0);

  return (
    <div className="space-y-6">
      {/* Encabezado */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight font-sans">
            Plan de Acción
          </h1>
          <p className="text-xs font-semibold text-slate-400 mt-1 font-sans">
            Desde informes de visita o ingreso manual. Marcá qué puede ver el ente regulador.
          </p>
        </div>

        {/* Botones de Descarga */}
        <div className="grid grid-cols-2 sm:flex gap-3 w-full sm:w-auto select-none">
          <button
            onClick={handleExportExcel}
            disabled={
              exportingExcel || isLoading || !resumen || resumen.total === 0
            }
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-50 hover:bg-emerald-150/80 border border-emerald-250 text-emerald-700 font-bold rounded-xl text-xs transition-all shadow-2xs hover:shadow-xs disabled:opacity-50 cursor-pointer w-full"
          >
            {exportingExcel ? (
              <Loader className="h-4 w-4 animate-spin" />
            ) : (
              <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
            )}
            Descargar Excel
          </button>

          <button
            onClick={handleExportPDF}
            disabled={
              exportingPdf || isLoading || !resumen || resumen.total === 0
            }
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-rose-50 hover:bg-rose-150/80 border border-rose-250 text-rose-700 font-bold rounded-xl text-xs transition-all shadow-2xs hover:shadow-xs disabled:opacity-50 cursor-pointer w-full"
          >
            {exportingPdf ? (
              <Loader className="h-4 w-4 animate-spin" />
            ) : (
              <FileText className="h-4 w-4 text-rose-600" />
            )}
            Descargar PDF
          </button>
        </div>
      </div>

      {/* Tarjetas de Estadísticas */}
      <div className="grid grid-cols-3 gap-3 sm:gap-6">
        <div className="bg-white border border-slate-200 rounded-xl sm:rounded-2xl p-4 sm:p-6 shadow-2xs flex flex-col items-center justify-center text-center min-h-20 sm:min-h-22.5">
          <span className="text-2xl sm:text-3xl font-black text-amber-500 font-sans leading-none">
            {isLoading ? "-" : pendientes}
          </span>
          <span className="text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-wider mt-1.5 font-sans">
            Pendientes
          </span>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl sm:rounded-2xl p-4 sm:p-6 shadow-2xs flex flex-col items-center justify-center text-center min-h-20 sm:min-h-22.5">
          <span className="text-2xl sm:text-3xl font-black text-emerald-500 font-sans leading-none">
            {isLoading ? "-" : cumplidas}
          </span>
          <span className="text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-wider mt-1.5 font-sans">
            Cumplidas
          </span>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl sm:rounded-2xl p-4 sm:p-6 shadow-2xs flex flex-col items-center justify-center text-center min-h-20 sm:min-h-22.5">
          <span className="text-2xl sm:text-3xl font-black text-slate-900 font-sans leading-none">
            {isLoading ? "-" : totalAcciones}
          </span>
          <span className="text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-wider mt-1.5 font-sans">
            Total<span className="hidden sm:inline"> de acciones</span>
          </span>
        </div>
      </div>

      {/* Filtros de Tabla */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 flex-1">
        <div className="flex gap-1.5 bg-white border border-slate-200 p-1.5 rounded-xl max-w-sm shadow-2xs select-none">
          {(["todos", "pendiente", "atendida", "cumplida"] as const).map(
            (est) => (
              <button
                key={est}
                onClick={() => {
                  setFilterEstado(est);
                  setPage(0);
                }}
                className={`flex-1 text-center py-1.5 px-2.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                  filterEstado === est
                    ? "bg-slate-900 text-white shadow-xs"
                    : "text-slate-500 hover:text-slate-800 hover:bg-slate-50"
                }`}
              >
                {est === "todos" ? "Todos" : est}
              </button>
            ),
          )}
        </div>

        <div className="flex items-center gap-2 bg-white border border-slate-200 px-3 py-2 rounded-xl shadow-2xs">
          <label
            htmlFor="filter-responsable"
            className="text-[10px] font-black text-slate-400 uppercase tracking-wider whitespace-nowrap"
          >
            Responsable
          </label>
          <select
            id="filter-responsable"
            value={filterResponsable}
            onChange={(e) => {
              setFilterResponsable(e.target.value);
              setPage(0);
            }}
            className="text-xs font-bold text-slate-700 bg-transparent border-0 outline-hidden cursor-pointer min-w-32"
          >
            <option value="todos">Todos</option>
            <option value="__sin_asignar__">Sin asignar</option>
            {responsables.map((nombre) => (
              <option key={nombre} value={nombre}>
                {nombre}
              </option>
            ))}
          </select>
        </div>
        </div>

        {canEdit && (
          <button
            type="button"
            onClick={() => setShowModal(true)}
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs transition-colors cursor-pointer shrink-0"
          >
            <Plus className="h-4 w-4" />
            Ingresar acción
          </button>
        )}
      </div>

      {/* Listado / Tabla */}
      {isLoading ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-8 space-y-4 shadow-2xs">
          <div className="h-6 bg-slate-100 rounded-lg animate-pulse w-1/4"></div>
          <div className="space-y-2">
            <div className="h-10 bg-slate-50 rounded-lg animate-pulse"></div>
            <div className="h-10 bg-slate-50 rounded-lg animate-pulse"></div>
            <div className="h-10 bg-slate-50 rounded-lg animate-pulse"></div>
          </div>
        </div>
      ) : acciones && acciones.length > 0 ? (
        <div className="space-y-4">
          {/* Vista Desktop: Tabla */}
          <div className="hidden md:block bg-white border border-slate-200 rounded-2xl shadow-2xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-100">
                <thead className="bg-slate-50/70 select-none">
                  <tr>
                    <th className="px-6 py-4 text-left text-[9px] font-black text-slate-400 uppercase tracking-wider font-sans">
                      #
                    </th>
                    <th className="px-6 py-4 text-left text-[9px] font-black text-slate-400 uppercase tracking-wider font-sans">
                      Acción de Mejora
                    </th>
                    <th className="px-6 py-4 text-left text-[9px] font-black text-slate-400 uppercase tracking-wider font-sans">
                      Responsable
                    </th>
                    <th className="px-6 py-4 text-left text-[9px] font-black text-slate-400 uppercase tracking-wider font-sans">
                      Empresa · Sector · Fecha
                    </th>
                    <th className="px-6 py-4 text-left text-[9px] font-black text-slate-400 uppercase tracking-wider font-sans">
                      Estado
                    </th>
                    <th className="px-6 py-4 text-left text-[9px] font-black text-slate-400 uppercase tracking-wider font-sans">
                      Ente
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {accionesList.map((acc, index) => {
                    const sector = accionSector(acc);
                    const fechaVisita = formatAccionFecha(acc);
                    const origen = acc.es_manual ? "Manual" : sector;

                    return (
                      <tr
                        key={acc.id}
                        className="hover:bg-slate-50/40 transition-colors"
                      >
                        {/* Número */}
                        <td className="px-6 py-4 whitespace-nowrap text-xs font-bold text-slate-400 font-sans">
                          {page * PAGE_SIZE + index + 1}
                        </td>

                        {/* Acción de Mejora */}
                        <td className="px-6 py-4 text-xs font-black text-slate-900 font-sans max-w-md">
                          {acc.informe_id ? (
                            <Link
                              href={`/informes/${acc.informe_id}?actionId=${acc.id}`}
                              className="hover:text-blue-600 hover:underline transition-all cursor-pointer"
                            >
                              {acc.descripcion}
                            </Link>
                          ) : (
                            <span>{acc.descripcion}</span>
                          )}
                        </td>

                        {/* Responsable */}
                        <td className="px-6 py-4 text-xs font-bold text-slate-600 font-sans whitespace-nowrap">
                          {acc.responsable?.trim() || (
                            <span className="text-slate-300">—</span>
                          )}
                        </td>

                        {/* Empresa · Sector · Fecha */}
                        <td className="px-6 py-4 whitespace-nowrap text-xs font-bold text-slate-450 font-sans">
                          {empresa?.razon_social} · {origen} · {fechaVisita}
                        </td>

                        {/* Estado */}
                        <td className="px-6 py-4 whitespace-nowrap">
                          <select
                            value={acc.estado}
                            disabled={!canEdit}
                            onChange={(e) =>
                              handleStatusChange(acc.id, e.target.value as EstadoAccion)
                            }
                            className={`text-[10px] font-black px-3 py-1.5 rounded-full border border-transparent outline-hidden transition-all ${
                              canEdit ? "cursor-pointer" : "cursor-not-allowed opacity-80"
                            } ${
                              acc.estado === "cumplida"
                                ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100/70 hover:border-emerald-200"
                                : acc.estado === "atendida"
                                  ? "bg-blue-50 text-blue-700 hover:bg-blue-100/70 hover:border-blue-200"
                                  : "bg-amber-50 text-amber-700 hover:bg-amber-100/70 hover:border-amber-200"
                            }`}
                          >
                            <option
                              value="pendiente"
                              className="bg-white text-slate-800 font-semibold"
                            >
                              Pendiente
                            </option>
                            <option
                              value="atendida"
                              className="bg-white text-slate-800 font-semibold"
                            >
                              Atendida
                            </option>
                            <option
                              value="cumplida"
                              className="bg-white text-slate-800 font-semibold"
                            >
                              Cumplida
                            </option>
                          </select>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {user?.rol === "ente_regulador" ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full">
                              <CheckCircle2 className="h-3 w-3" /> Habilitada
                            </span>
                          ) : (
                            <VisibleEnteToggle
                              checked={Boolean(acc.visible_ente_regulador)}
                              disabled={!canEdit}
                              compact
                              onChange={(v) => handleVisibilidadChange(acc.id, v)}
                            />
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Vista Mobile: Tarjetas */}
          <div className="block md:hidden space-y-4">
            {accionesList.map((acc, index) => {
              const sector = accionSector(acc);
              const fechaVisita = formatAccionFecha(acc);
              const origen = acc.es_manual ? "Manual" : sector;

              return (
                <div
                  key={acc.id}
                  className="bg-white border border-slate-200 rounded-2xl p-5 shadow-2xs space-y-4"
                >
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-slate-400">
                      ÍTEM {page * PAGE_SIZE + index + 1}
                    </span>
                    <h3 className="text-sm font-black text-slate-900 font-sans leading-snug">
                      {acc.informe_id ? (
                        <Link
                          href={`/informes/${acc.informe_id}?actionId=${acc.id}`}
                          className="hover:text-blue-600 hover:underline transition-all cursor-pointer"
                        >
                          {acc.descripcion}
                        </Link>
                      ) : (
                        acc.descripcion
                      )}
                    </h3>
                    <p className="text-xs font-bold text-slate-500 font-sans">
                      Responsable:{" "}
                      <span className="text-slate-700">
                        {acc.responsable?.trim() || "Sin asignar"}
                      </span>
                    </p>
                    <p className="text-xs font-bold text-slate-450 font-sans pt-1">
                      {empresa?.razon_social} · {origen} · {fechaVisita}
                    </p>
                  </div>

                  <div className="flex items-center justify-between pt-3.5 border-t border-slate-100">
                    {user?.rol === "ente_regulador" ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full">
                        <CheckCircle2 className="h-3 w-3" /> Habilitada
                      </span>
                    ) : (
                      <VisibleEnteToggle
                        checked={Boolean(acc.visible_ente_regulador)}
                        disabled={!canEdit}
                        onChange={(v) => handleVisibilidadChange(acc.id, v)}
                      />
                    )}
                    <select
                      value={acc.estado}
                      disabled={!canEdit}
                      onChange={(e) =>
                        handleStatusChange(acc.id, e.target.value as EstadoAccion)
                      }
                      className={`text-[10px] font-black px-3.5 py-1.5 rounded-full border border-transparent outline-hidden transition-all ${
                        canEdit ? "cursor-pointer" : "cursor-not-allowed opacity-80"
                      } ${
                        acc.estado === "cumplida"
                          ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100/70"
                          : acc.estado === "atendida"
                            ? "bg-blue-50 text-blue-700 hover:bg-blue-100/70"
                            : "bg-amber-50 text-amber-700 hover:bg-amber-100/70"
                      }`}
                    >
                      <option
                        value="pendiente"
                        className="bg-white text-slate-800 font-semibold"
                      >
                        Pendiente
                      </option>
                      <option
                        value="atendida"
                        className="bg-white text-slate-800 font-semibold"
                      >
                        Atendida
                      </option>
                      <option
                        value="cumplida"
                        className="bg-white text-slate-800 font-semibold"
                      >
                        Cumplida
                      </option>
                    </select>
                  </div>
                </div>
              );
            })}
          </div>

          {total > PAGE_SIZE && (
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
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center shadow-2xs">
          <p className="text-xs font-bold text-slate-400">
            No se encontraron medidas correctivas para el filtro seleccionado.
          </p>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/45 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white rounded-2xl p-6 w-full max-w-lg shadow-xl border border-slate-100 space-y-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-black text-slate-900 text-base">
                  Ingresar acción manual
                </h3>
                <p className="text-xs text-slate-500 font-semibold mt-1">
                  La acción queda en el plan sin estar vinculada a un informe de visita.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
                aria-label="Cerrar"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label
                  htmlFor="nueva-descripcion"
                  className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1.5"
                >
                  Acción de mejora *
                </label>
                <textarea
                  id="nueva-descripcion"
                  rows={3}
                  value={nuevaDescripcion}
                  onChange={(e) => setNuevaDescripcion(e.target.value)}
                  placeholder="Describí la medida correctiva..."
                  className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl bg-slate-50/80 text-sm font-semibold text-slate-800 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-blue-600/25 focus:border-blue-600 resize-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="nuevo-responsable"
                    className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1.5"
                  >
                    Responsable
                  </label>
                  <input
                    id="nuevo-responsable"
                    type="text"
                    value={nuevoResponsable}
                    onChange={(e) => setNuevoResponsable(e.target.value)}
                    placeholder="Nombre del responsable"
                    className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl bg-slate-50/80 text-sm font-semibold text-slate-800 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-blue-600/25 focus:border-blue-600"
                  />
                </div>
                <div>
                  <label
                    htmlFor="nuevo-sector"
                    className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1.5"
                  >
                    Sector / Área
                  </label>
                  <input
                    id="nuevo-sector"
                    type="text"
                    value={nuevoSector}
                    onChange={(e) => setNuevoSector(e.target.value)}
                    placeholder="Planta"
                    className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl bg-slate-50/80 text-sm font-semibold text-slate-800 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-blue-600/25 focus:border-blue-600"
                  />
                </div>
              </div>

              <VisibleEnteToggle
                checked={nuevaVisibleEnte}
                onChange={setNuevaVisibleEnte}
                label="Visible para el ente regulador"
              />
            </div>

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                disabled={savingAccion}
                onClick={() => setShowModal(false)}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-xs font-black hover:bg-slate-50 cursor-pointer disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={savingAccion || !nuevaDescripcion.trim()}
                onClick={() => void handleCrearAccion()}
                className="flex-1 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-black cursor-pointer disabled:opacity-50 inline-flex items-center justify-center gap-1.5"
              >
                {savingAccion ? (
                  <>
                    <Loader className="h-3.5 w-3.5 animate-spin" />
                    Guardando…
                  </>
                ) : (
                  "Agregar acción"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
