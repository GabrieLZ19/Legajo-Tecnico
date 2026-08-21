"use client";

import { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import { usePlanAccion, exportarPlanAccion } from "@/hooks/usePlanAccion";

import { EstadoAccion } from "@/types";
import { FileSpreadsheet, FileText, Loader } from "lucide-react";
import { useAlert } from "@/context/AlertContext";
import { canWriteAppModule } from "@/lib/moduleAccess";
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
  const [exportingExcel, setExportingExcel] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const canEdit = canWriteAppModule(user, "planAccion");

  const {
    data: acciones,
    isLoading,
    total,
    resumen,
    actualizarEstado,
  } = usePlanAccion(
    empresa?.id,
    filterEstado === "todos" ? undefined : filterEstado,
    { limit: PAGE_SIZE, offset: page * PAGE_SIZE },
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
            Generadas automáticamente desde las observaciones de los informes.
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
                      Empresa · Sector · Fecha
                    </th>
                    <th className="px-6 py-4 text-left text-[9px] font-black text-slate-400 uppercase tracking-wider font-sans">
                      Estado
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {acciones.map((acc, index) => {
                    const sector =
                      acc.informes_visita?.lugar_visita || "Planta";
                    const fechaVisita = acc.informes_visita?.fecha_hora_visita
                      ? new Date(
                          acc.informes_visita.fecha_hora_visita,
                        ).toLocaleDateString("es-AR", {
                          day: "2-digit",
                          month: "2-digit",
                        })
                      : "";

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
                          <div className="flex items-center gap-2 flex-wrap">
                            <Link
                              href={`/informes/${acc.informe_id}?actionId=${acc.id}`}
                              className="hover:text-blue-600 hover:underline transition-all cursor-pointer"
                            >
                              {acc.descripcion}
                            </Link>
                            {acc.responsable && (
                              <span className="text-[9px] px-1.5 py-0.5 bg-blue-50 text-blue-655 font-bold rounded-md uppercase tracking-wider">
                                Resp: {acc.responsable}
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Empresa · Sector · Fecha */}
                        <td className="px-6 py-4 whitespace-nowrap text-xs font-bold text-slate-450 font-sans">
                          {empresa?.razon_social} · {sector} · {fechaVisita}
                        </td>

                        {/* Estado */}
                        <td className="px-6 py-4 whitespace-nowrap">
                          <select
                            value={acc.estado}
                            disabled={!canEdit}
                            onChange={(e) =>
                              handleStatusChange(acc.id, e.target.value as any)
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
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Vista Mobile: Tarjetas */}
          <div className="block md:hidden space-y-4">
            {acciones.map((acc, index) => {
              const sector = acc.informes_visita?.lugar_visita || "Planta";
              const fechaVisita = acc.informes_visita?.fecha_hora_visita
                ? new Date(
                    acc.informes_visita.fecha_hora_visita,
                  ).toLocaleDateString("es-AR", {
                    day: "2-digit",
                    month: "2-digit",
                  })
                : "";

              return (
                <div
                  key={acc.id}
                  className="bg-white border border-slate-200 rounded-2xl p-5 shadow-2xs space-y-4"
                >
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-slate-400">
                      ÍTEM {page * PAGE_SIZE + index + 1}
                    </span>
                    <h3 className="text-sm font-black text-slate-900 font-sans leading-snug flex items-center gap-2 flex-wrap">
                      <Link
                        href={`/informes/${acc.informe_id}?actionId=${acc.id}`}
                        className="hover:text-blue-600 hover:underline transition-all cursor-pointer"
                      >
                        {acc.descripcion}
                      </Link>
                      {acc.responsable && (
                        <span className="text-[9px] px-1.5 py-0.5 bg-blue-50 text-blue-655 font-bold rounded-md uppercase tracking-wider">
                          Resp: {acc.responsable}
                        </span>
                      )}
                    </h3>
                    <p className="text-xs font-bold text-slate-450 font-sans pt-1">
                      {empresa?.razon_social} · {sector} · {fechaVisita}
                    </p>
                  </div>

                  <div className="flex items-center justify-between pt-3.5 border-t border-slate-100">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      Estado
                    </span>

                    <select
                      value={acc.estado}
                      disabled={!canEdit}
                      onChange={(e) =>
                        handleStatusChange(acc.id, e.target.value as any)
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
    </div>
  );
}
