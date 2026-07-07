"use client";

import React, { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { usePlanAccion } from "@/hooks/usePlanAccion";
import { EstadoAccion } from "@/types";
import { api } from "@/lib/api";
import {
  CheckCircle2,
  FileSpreadsheet,
  FileText,
  Loader,
  Calendar,
} from "lucide-react";
import { useAlert } from "@/context/AlertContext";

export default function PlanAccionPage() {
  const { empresa } = useAuth();
  const { showAlert } = useAlert();
  const [filterEstado, setFilterEstado] = useState<EstadoAccion | "todos">("todos");
  const [exportingExcel, setExportingExcel] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);

  const { data: acciones, isLoading, actualizarEstado } = usePlanAccion(
    empresa?.id,
    filterEstado === "todos" ? undefined : filterEstado
  );

  const handleStatusChange = async (id: string, nuevoEstado: EstadoAccion) => {
    try {
      await actualizarEstado({ id, estado: nuevoEstado });
      showAlert("success", "Estado actualizado", "La medida correctiva se actualizó con éxito.");
    } catch (err: any) {
      showAlert("error", "Error", err.message || "Error al actualizar el estado de la acción");
    }
  };

  const handleExportExcel = async () => {
    if (!empresa) return;
    setExportingExcel(true);
    try {
      const response = await api.get(`/plan-accion/export?empresaId=${empresa.id}&format=csv`, {
        responseType: "blob",
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `plan_de_accion_${empresa.cuit}.csv`);
      document.body.appendChild(link);
      link.click();
      link.parentNode?.removeChild(link);
      showAlert("success", "Exportación exitosa", "El archivo Excel (.csv) se ha descargado correctamente.");
    } catch (err) {
      showAlert("error", "Error al exportar", "No se pudo exportar el plan de acción a Excel.");
    } finally {
      setExportingExcel(false);
    }
  };

  const handleExportPDF = async () => {
    if (!empresa) return;
    setExportingPdf(true);
    try {
      const response = await api.get(`/plan-accion/export?empresaId=${empresa.id}&format=pdf`, {
        responseType: "blob",
      });

      const url = window.URL.createObjectURL(new Blob([response.data], { type: "application/pdf" }));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `plan_de_accion_${empresa.cuit}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.parentNode?.removeChild(link);
      showAlert("success", "Exportación exitosa", "El documento PDF se ha descargado correctamente.");
    } catch (err) {
      showAlert("error", "Error al exportar", "No se pudo exportar el plan de acción a PDF.");
    } finally {
      setExportingPdf(false);
    }
  };

  // Cálculos para las tarjetas de estadísticas
  const totalAcciones = acciones?.length || 0;
  const cumplidas = acciones?.filter((a) => a.estado === "cumplida").length || 0;
  const pendientes = totalAcciones - cumplidas;

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
            disabled={exportingExcel || isLoading || !acciones || acciones.length === 0}
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
            disabled={exportingPdf || isLoading || !acciones || acciones.length === 0}
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
        <div className="bg-white border border-slate-200 rounded-xl sm:rounded-2xl p-4 sm:p-6 shadow-2xs flex flex-col items-center justify-center text-center min-h-[80px] sm:min-h-[90px]">
          <span className="text-2xl sm:text-3xl font-black text-amber-500 font-sans leading-none">
            {isLoading ? "-" : pendientes}
          </span>
          <span className="text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-wider mt-1.5 font-sans">
            Pendientes
          </span>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl sm:rounded-2xl p-4 sm:p-6 shadow-2xs flex flex-col items-center justify-center text-center min-h-[80px] sm:min-h-[90px]">
          <span className="text-2xl sm:text-3xl font-black text-emerald-500 font-sans leading-none">
            {isLoading ? "-" : cumplidas}
          </span>
          <span className="text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-wider mt-1.5 font-sans">
            Cumplidas
          </span>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl sm:rounded-2xl p-4 sm:p-6 shadow-2xs flex flex-col items-center justify-center text-center min-h-[80px] sm:min-h-[90px]">
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
        {(["todos", "pendiente", "atendida", "cumplida"] as const).map((est) => (
          <button
            key={est}
            onClick={() => setFilterEstado(est)}
            className={`flex-1 text-center py-1.5 px-2.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer ${
              filterEstado === est
                ? "bg-slate-900 text-white shadow-xs"
                : "text-slate-500 hover:text-slate-800 hover:bg-slate-50"
            }`}
          >
            {est === "todos" ? "Todos" : est}
          </button>
        ))}
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
                    const sector = acc.informes_visita?.lugar_visita || "Planta";
                    const fechaVisita = acc.informes_visita?.fecha_hora_visita
                      ? new Date(acc.informes_visita.fecha_hora_visita).toLocaleDateString("es-AR", {
                          day: "2-digit",
                          month: "2-digit",
                        })
                      : "";

                    return (
                      <tr key={acc.id} className="hover:bg-slate-50/40 transition-colors">
                        {/* Número */}
                        <td className="px-6 py-4 whitespace-nowrap text-xs font-bold text-slate-400 font-sans">
                          {index + 1}
                        </td>

                        {/* Acción de Mejora */}
                        <td className="px-6 py-4 text-xs font-black text-slate-900 font-sans max-w-md">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span>{acc.descripcion}</span>
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
                            onChange={(e) => handleStatusChange(acc.id, e.target.value as any)}
                            className={`text-[10px] font-black px-3 py-1.5 rounded-full border border-transparent outline-hidden cursor-pointer transition-all ${
                              acc.estado === "cumplida"
                                ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100/70 hover:border-emerald-200"
                                : acc.estado === "atendida"
                                  ? "bg-blue-50 text-blue-700 hover:bg-blue-100/70 hover:border-blue-200"
                                  : "bg-amber-50 text-amber-700 hover:bg-amber-100/70 hover:border-amber-200"
                            }`}
                          >
                            <option value="pendiente" className="bg-white text-slate-800 font-semibold">
                              Pendiente
                            </option>
                            <option value="atendida" className="bg-white text-slate-800 font-semibold">
                              Atendida
                            </option>
                            <option value="cumplida" className="bg-white text-slate-800 font-semibold">
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
                ? new Date(acc.informes_visita.fecha_hora_visita).toLocaleDateString("es-AR", {
                    day: "2-digit",
                    month: "2-digit",
                  })
                : "";

              return (
                <div key={acc.id} className="bg-white border border-slate-200 rounded-2xl p-5 shadow-2xs space-y-4">
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-slate-400">
                      ÍTEM {index + 1}
                    </span>
                    <h3 className="text-sm font-black text-slate-900 font-sans leading-snug flex items-center gap-2 flex-wrap">
                      <span>{acc.descripcion}</span>
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
                      onChange={(e) => handleStatusChange(acc.id, e.target.value as any)}
                      className={`text-[10px] font-black px-3.5 py-1.5 rounded-full border border-transparent outline-hidden cursor-pointer transition-all ${
                        acc.estado === "cumplida"
                          ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100/70"
                          : acc.estado === "atendida"
                            ? "bg-blue-50 text-blue-700 hover:bg-blue-100/70"
                            : "bg-amber-50 text-amber-700 hover:bg-amber-100/70"
                      }`}
                    >
                      <option value="pendiente" className="bg-white text-slate-800 font-semibold">
                        Pendiente
                      </option>
                      <option value="atendida" className="bg-white text-slate-800 font-semibold">
                        Atendida
                      </option>
                      <option value="cumplida" className="bg-white text-slate-800 font-semibold">
                        Cumplida
                      </option>
                    </select>
                  </div>
                </div>
              );
            })}
          </div>
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
