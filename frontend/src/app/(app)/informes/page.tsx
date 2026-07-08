"use client";

import React, { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useInformes } from "@/hooks/useInformes";
import Link from "next/link";
import { Plus, Calendar, Search, Filter, Folder } from "lucide-react";

export default function InformesPage() {
  const { user, empresa } = useAuth();
  const { data: informes, isLoading } = useInformes(empresa?.id);

  // Fechas de filtro (por defecto el mes actual)
  const today = new Date();
  const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1)
    .toISOString()
    .split("T")[0];
  const lastDayOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0)
    .toISOString()
    .split("T")[0];

  // Estado temporal de los filtros (se modifica al interactuar)
  const [tempSearchTerm, setTempSearchTerm] = useState("");
  const [tempFechaDesde, setTempFechaDesde] = useState(firstDayOfMonth);
  const [tempFechaHasta, setTempFechaHasta] = useState(lastDayOfMonth);
  const [tempEstado, setTempEstado] = useState<string>("todos");
  const [tempLugar, setTempLugar] = useState<string>("todos");

  // Estado aplicado de los filtros (se activa al hacer clic en "Filtrar")
  const [appliedSearchTerm, setAppliedSearchTerm] = useState("");
  const [appliedFechaDesde, setAppliedFechaDesde] = useState(firstDayOfMonth);
  const [appliedFechaHasta, setAppliedFechaHasta] = useState(lastDayOfMonth);
  const [appliedEstado, setAppliedEstado] = useState<string>("todos");
  const [appliedLugar, setAppliedLugar] = useState<string>("todos");

  const canCreate = user?.rol === "preventor" || user?.rol === "admin";

  // Obtener todos los lugares únicos para el filtro
  const lugaresUnicos = Array.from(
    new Set(
      informes
        ?.map((inf) => inf.lugar_visita)
        .filter((l): l is string => !!l) || []
    )
  ).sort();

  // Formateador de fecha para la tabla (ej: "12 May")
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

  const getEstadoBadge = (estado: string) => {
    switch (estado) {
      case "borrador":
        return { label: "Borrador", classes: "bg-slate-100 text-slate-700 border border-slate-200" };
      case "pendiente_preventor":
        return { label: "Pte. Preventor", classes: "bg-blue-50 text-blue-700 border border-blue-100" };
      case "pendiente_dueno":
        return { label: "Pte. Dueño", classes: "bg-amber-50 text-amber-700 border border-amber-100" };
      case "firmado":
        return { label: "Cerrado", classes: "bg-emerald-50 text-emerald-700 border border-emerald-100" };
      case "archivado":
        return { label: "Archivado", classes: "bg-indigo-50 text-indigo-700 border border-indigo-100" };
      default:
        return { label: estado, classes: "bg-slate-100 text-slate-700 border border-slate-200" };
    }
  };


  // Aplicar filtros al hacer clic en el botón o enviar el formulario
  const handleFiltrar = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setAppliedSearchTerm(tempSearchTerm);
    setAppliedFechaDesde(tempFechaDesde);
    setAppliedFechaHasta(tempFechaHasta);
    setAppliedEstado(tempEstado);
    setAppliedLugar(tempLugar);
  };

  // Filtrado de informes por texto y por rango de fechas aplicados
  const filteredInformes = informes?.filter((inf) => {
    // Filtro de texto (actividad, nro informe, lugar o contacto)
    const matchesText =
      inf.actividad?.toLowerCase().includes(appliedSearchTerm.toLowerCase()) ||
      inf.numero_informe.toString().includes(appliedSearchTerm) ||
      inf.lugar_visita
        ?.toLowerCase()
        .includes(appliedSearchTerm.toLowerCase()) ||
      empresa?.razon_social
        ?.toLowerCase()
        .includes(appliedSearchTerm.toLowerCase());

    // Filtro por fecha de visita
    const visitDate = new Date(inf.fecha_hora_visita);
    const startDate = appliedFechaDesde
      ? new Date(appliedFechaDesde + "T00:00:00")
      : null;
    const endDate = appliedFechaHasta
      ? new Date(appliedFechaHasta + "T23:59:59")
      : null;

    const matchesDesde = !startDate || visitDate >= startDate;
    const matchesHasta = !endDate || visitDate <= endDate;

    // Filtro por estado de firma
    const matchesEstado = appliedEstado === "todos" || inf.estado_firma === appliedEstado;

    // Filtro por lugar / planta
    const matchesLugar = appliedLugar === "todos" || inf.lugar_visita === appliedLugar;

    return matchesText && matchesDesde && matchesHasta && matchesEstado && matchesLugar;
  });

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
              : `${filteredInformes?.length || 0} informes en este período`}
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

      {/* Formulario de Filtros */}
      <form
        onSubmit={handleFiltrar}
        className="flex flex-col md:flex-row items-stretch gap-4"
      >
        {/* Buscador */}
        <div className="relative flex-1">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-slate-400" />
          </div>
          <input
            type="text"
            placeholder="Buscar por empresa, área o fecha..."
            value={tempSearchTerm}
            onChange={(e) => setTempSearchTerm(e.target.value)}
            className="block w-full pl-11 pr-3 py-3 border border-slate-200 rounded-xl bg-white text-slate-800 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-blue-600/25 focus:border-blue-600 text-sm transition-all font-semibold"
          />
        </div>

        {/* Filtro Estado */}
        <div className="flex items-center gap-2 border border-slate-200 rounded-xl bg-white px-3 py-2 min-w-[150px] hover:border-slate-300 transition-colors">
          <div className="flex flex-col flex-1 min-w-0">
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider leading-none">
              Estado
            </span>
            <select
              value={tempEstado}
              onChange={(e) => setTempEstado(e.target.value)}
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

        {/* Filtro Lugar / Planta */}
        <div className="flex items-center gap-2 border border-slate-200 rounded-xl bg-white px-3 py-2 min-w-[150px] hover:border-slate-300 transition-colors">
          <div className="flex flex-col flex-1 min-w-0">
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider leading-none">
              Lugar / Planta
            </span>
            <select
              value={tempLugar}
              onChange={(e) => setTempLugar(e.target.value)}
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

        {/* Filtro Desde */}
        <div
          onClick={(e) => {
            const input = e.currentTarget.querySelector("input");
            if (input) {
              try {
                input.showPicker();
              } catch (err) {}
            }
          }}
          className="flex items-center gap-2 border border-slate-200 rounded-xl bg-white px-3 py-2 min-w-[165px] cursor-pointer hover:border-slate-300 transition-colors"
        >
          <Calendar className="h-4 w-4 text-blue-600 shrink-0" />
          <div className="flex flex-col flex-1 min-w-0">
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider leading-none">
              Desde
            </span>
            <input
              type="date"
              value={tempFechaDesde}
              onChange={(e) => setTempFechaDesde(e.target.value)}
              onClick={(e) => {
                e.stopPropagation();
                try {
                  e.currentTarget.showPicker();
                } catch (err) {}
              }}
              className="text-sm font-bold text-slate-700 bg-transparent border-0 p-0 focus:ring-0 focus:outline-hidden cursor-pointer w-full mt-1 leading-none"
            />
          </div>
        </div>

        {/* Filtro Hasta */}
        <div
          onClick={(e) => {
            const input = e.currentTarget.querySelector("input");
            if (input) {
              try {
                input.showPicker();
              } catch (err) {}
            }
          }}
          className="flex items-center gap-2 border border-slate-200 rounded-xl bg-white px-3 py-2 min-w-[165px] cursor-pointer hover:border-slate-300 transition-colors"
        >
          <Calendar className="h-4 w-4 text-blue-600 shrink-0" />
          <div className="flex flex-col flex-1 min-w-0">
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider leading-none">
              Hasta
            </span>
            <input
              type="date"
              value={tempFechaHasta}
              onChange={(e) => setTempFechaHasta(e.target.value)}
              onClick={(e) => {
                e.stopPropagation();
                try {
                  e.currentTarget.showPicker();
                } catch (err) {}
              }}
              className="text-sm font-bold text-slate-700 bg-transparent border-0 p-0 focus:ring-0 focus:outline-hidden cursor-pointer w-full mt-1 leading-none"
            />
          </div>
        </div>

        {/* Botón de Acción Filtrar */}
        <button
          type="submit"
          className="inline-flex items-center justify-center gap-2 bg-brand-primary hover:bg-brand-primary/95 text-white font-bold px-6 py-3 rounded-xl shadow-xs transition-all text-sm cursor-pointer shrink-0"
        >
          <Filter className="h-4 w-4" />
          Filtrar
        </button>
      </form>

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
                    <th scope="col" className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider w-32">
                      Fecha
                    </th>
                    <th scope="col" className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      Empresa — Área
                    </th>
                    <th scope="col" className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      Resumen
                    </th>
                    <th scope="col" className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider w-32">
                      Estado
                    </th>
                    <th scope="col" className="relative px-6 py-4 w-28">
                      <span className="sr-only">Acciones</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {filteredInformes.map((inf) => (
                    <tr key={inf.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="whitespace-nowrap px-6 py-4.5 font-bold text-slate-700">
                        {formatTableDate(inf.fecha_hora_visita)}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4.5 font-bold text-slate-900">
                        {empresa?.razon_social || "Empresa"} — {inf.lugar_visita || "Planta 1"}
                      </td>
                      <td className="px-6 py-4.5 text-slate-500 font-medium">
                        <span className="line-clamp-1">
                          {inf.actividad || "Relevamiento general de condiciones de higiene y seguridad."}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-6 py-4.5">
                        {(() => {
                          const badge = getEstadoBadge(inf.estado_firma);
                          return (
                            <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-bold ${badge.classes}`}>
                              {badge.label}
                            </span>
                          );
                        })()}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4.5 text-right text-sm font-bold">
                        <Link href={`/informes/${inf.id}`} className="text-brand-primary hover:text-blue-600 transition-colors">
                          Ver detalle
                        </Link>
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
              const isFirmado = inf.estado_firma === "firmado";
              return (
                <div key={inf.id} className="bg-white border border-slate-200 rounded-2xl p-5 shadow-2xs space-y-4">
                  <div className="flex justify-between items-start gap-4">
                    <div>
                      <span className="text-xs font-black text-slate-400 font-sans block">
                        N° {String(inf.numero_informe).padStart(6, "0")}
                      </span>
                      <span className="text-sm font-black text-slate-900 font-sans block mt-1 leading-snug">
                        {inf.actividad || "Relevamiento general"}
                      </span>
                      <span className="text-xs font-bold text-slate-500 font-sans block mt-1.5">
                        {empresa?.razon_social} · {inf.lugar_visita || "Planta 1"}
                      </span>
                    </div>
                    {(() => {
                      const badge = getEstadoBadge(inf.estado_firma);
                      return (
                        <span className={`inline-flex px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider shrink-0 ${badge.classes}`}>
                          {badge.label}
                        </span>
                      );
                    })()}
                  </div>

                  <div className="flex items-center justify-between pt-3.5 border-t border-slate-100">
                    <span className="text-xs font-bold text-slate-400">
                      {new Date(inf.fecha_hora_visita).toLocaleDateString("es-AR")}
                    </span>
                    <Link
                      href={`/informes/${inf.id}`}
                      className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-black rounded-xl text-xs transition-all cursor-pointer"
                    >
                      Ver detalle
                    </Link>
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
    </div>
  );
}
