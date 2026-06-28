"use client";

import React, { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useInformes } from "@/hooks/useInformes";
import Link from "next/link";
import {
  Folder,
  FileText,
  Search,
  FileDown,
  Clock,
  ArrowLeft,
  ChevronRight,
  Calendar,
  X,
  Building2,
} from "lucide-react";

// Nombres de los meses para mostrar en las carpetas
const MESES = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];

export default function ArchivoPage() {
  const { empresa } = useAuth();
  const { data: informes, isLoading } = useInformes(empresa?.id);

  // Estados de navegación del explorador
  const [currentYear, setCurrentYear] = useState<number | null>(null);
  const [currentMonth, setCurrentMonth] = useState<number | null>(null); // 0-11

  // Filtros de búsqueda
  const [searchQuery, setSearchQuery] = useState("");
  const [fechaDesde, setFechaDesde] = useState("");
  const [fechaHasta, setFechaHasta] = useState("");

  // Determinar si hay alguna búsqueda o filtro de fecha activo
  const isFilteringActive = searchQuery !== "" || fechaDesde !== "" || fechaHasta !== "";

  // Filtrar los informes de acuerdo a la búsqueda y fechas
  const filteredInformes = informes?.filter((inf) => {
    // 1. Filtro por fecha desde/hasta
    const fechaVisita = new Date(inf.fecha_hora_visita).getTime();
    const desde = fechaDesde ? new Date(fechaDesde).getTime() : null;
    const hasta = fechaHasta
      ? new Date(fechaHasta).getTime() + 24 * 60 * 60 * 1000
      : null;

    if (desde && fechaVisita < desde) return false;
    if (hasta && fechaVisita > hasta) return false;

    // 2. Filtro por texto de búsqueda (número de informe, actividad o establecimiento/lugar)
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const numMatch = String(inf.numero_informe).includes(query);
      const actMatch = inf.actividad?.toLowerCase().includes(query);
      const lugarMatch = inf.lugar_visita?.toLowerCase().includes(query);

      if (!numMatch && !actMatch && !lugarMatch) return false;
    }

    return true;
  });

  // Si no se está buscando de manera global, agrupamos los informes para la vista de explorador
  // 1. Obtener los años disponibles y la cantidad de informes en cada uno
  const yearsGroup = React.useMemo(() => {
    if (!informes) return {};
    const groups: { [key: number]: number } = {};
    informes.forEach((inf) => {
      const year = new Date(inf.fecha_hora_visita).getFullYear();
      groups[year] = (groups[year] || 0) + 1;
    });
    return groups;
  }, [informes]);

  // 2. Obtener los meses disponibles para el año seleccionado y su conteo de informes
  const monthsGroup = React.useMemo(() => {
    if (!informes || currentYear === null) return {};
    const groups: { [key: number]: number } = {};
    informes.forEach((inf) => {
      const date = new Date(inf.fecha_hora_visita);
      if (date.getFullYear() === currentYear) {
        const month = date.getMonth();
        groups[month] = (groups[month] || 0) + 1;
      }
    });
    return groups;
  }, [informes, currentYear]);

  // 3. Obtener los informes específicos del año y mes seleccionado
  const explorerReports = React.useMemo(() => {
    if (!informes || currentYear === null || currentMonth === null) return [];
    return informes.filter((inf) => {
      const date = new Date(inf.fecha_hora_visita);
      return date.getFullYear() === currentYear && date.getMonth() === currentMonth;
    });
  }, [informes, currentYear, currentMonth]);

  // Limpiar todos los filtros de búsqueda
  const handleClearFilters = () => {
    setSearchQuery("");
    setFechaDesde("");
    setFechaHasta("");
  };

  return (
    <div className="space-y-6">
      {/* Encabezado */}
      <div>
        <h1 className="text-2xl font-black text-slate-900 tracking-tight font-sans">
          Archivo Histórico
        </h1>
        <p className="text-sm font-semibold text-slate-400 mt-1 font-sans">
          Explorador de documentos oficiales e informes técnicos de la empresa.
        </p>
      </div>

      {/* Buscador y Filtros de Fecha */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-2xs space-y-4">
        <div className="flex flex-col md:flex-row gap-4">
          {/* Barra de búsqueda */}
          <div className="relative flex-1">
            <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400">
              <Search className="h-4 w-4" />
            </span>
            <input
              type="text"
              placeholder="Buscar por N° informe, actividad o establecimiento..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="block w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl bg-slate-50/50 text-slate-700 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-blue-600/25 focus:border-blue-600 text-xs font-bold transition-all"
            />
          </div>

          {/* Rango de fechas */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative">
              <input
                type="date"
                value={fechaDesde}
                onChange={(e) => setFechaDesde(e.target.value)}
                className="border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-bold focus:outline-hidden focus:ring-2 focus:ring-blue-600/25 focus:border-blue-600 bg-slate-50/50 text-slate-700"
              />
            </div>
            <span className="text-xs font-bold text-slate-400">a</span>
            <div className="relative">
              <input
                type="date"
                value={fechaHasta}
                onChange={(e) => setFechaHasta(e.target.value)}
                className="border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-bold focus:outline-hidden focus:ring-2 focus:ring-blue-600/25 focus:border-blue-600 bg-slate-50/50 text-slate-700"
              />
            </div>

            {isFilteringActive && (
              <button
                onClick={handleClearFilters}
                className="p-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-500 hover:text-slate-800 rounded-xl transition-colors cursor-pointer"
                title="Limpiar búsqueda"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* breadcrumbs del Explorador */}
      {!isFilteringActive && (
        <div className="flex items-center gap-1.5 text-xs font-bold text-slate-450 select-none bg-white border border-slate-200 rounded-xl px-4 py-3 shadow-2xs">
          <button
            onClick={() => {
              setCurrentYear(null);
              setCurrentMonth(null);
            }}
            className="hover:text-blue-600 transition-colors cursor-pointer"
          >
            Archivo
          </button>

          {currentYear !== null && (
            <>
              <ChevronRight className="h-3.5 w-3.5 text-slate-300" />
              <button
                onClick={() => {
                  setCurrentMonth(null);
                }}
                className={`hover:text-blue-600 transition-colors cursor-pointer ${
                  currentMonth === null ? "text-slate-800 font-black" : ""
                }`}
              >
                {currentYear}
              </button>
            </>
          )}

          {currentYear !== null && currentMonth !== null && (
            <>
              <ChevronRight className="h-3.5 w-3.5 text-slate-300" />
              <span className="text-slate-800 font-black">{MESES[currentMonth]}</span>
            </>
          )}
        </div>
      )}

      {/* Vista de Contenido */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          <div className="h-24 bg-white border border-slate-200 rounded-2xl animate-pulse"></div>
          <div className="h-24 bg-white border border-slate-200 rounded-2xl animate-pulse"></div>
          <div className="h-24 bg-white border border-slate-200 rounded-2xl animate-pulse"></div>
        </div>
      ) : isFilteringActive ? (
        /* VISTA PLANA DE BÚSQUEDA */
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs font-bold text-slate-400 select-none px-1">
            <span>RESULTADOS DE LA BÚSQUEDA ({filteredInformes?.length || 0})</span>
            <button
              onClick={handleClearFilters}
              className="text-blue-600 hover:underline cursor-pointer"
            >
              Volver al Explorador
            </button>
          </div>

          {filteredInformes && filteredInformes.length > 0 ? (
            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-2xs">
              <div className="divide-y divide-slate-100">
                {filteredInformes.map((inf) => (
                  <FileRow key={inf.id} informe={inf} />
                ))}
              </div>
            </div>
          ) : (
            <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center shadow-2xs">
              <p className="text-xs font-bold text-slate-400">
                No se encontraron informes que coincidan con la búsqueda.
              </p>
            </div>
          )}
        </div>
      ) : (
        /* VISTA DE EXPLORADOR DE CARPETAS */
        <div>
          {/* 1. Vista de Años (Raíz) */}
          {currentYear === null && (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">
              {Object.keys(yearsGroup).length > 0 ? (
                Object.keys(yearsGroup)
                  .sort((a, b) => Number(b) - Number(a))
                  .map((yearStr) => {
                    const year = Number(yearStr);
                    const count = yearsGroup[year];
                    return (
                      <div
                        key={year}
                        onClick={() => setCurrentYear(year)}
                        className="bg-white border border-slate-200 hover:border-blue-500 rounded-2xl p-5 shadow-2xs hover:shadow-xs flex items-center gap-4 cursor-pointer transition-all group select-none"
                      >
                        <div className="h-12 w-12 rounded-xl bg-blue-50 group-hover:bg-blue-100/70 text-blue-600 flex items-center justify-center shrink-0 transition-colors">
                          <Folder className="h-6 w-6 fill-blue-100 group-hover:fill-blue-200/50" />
                        </div>
                        <div>
                          <span className="text-sm font-black text-slate-800 group-hover:text-blue-750 transition-colors block">
                            Año {year}
                          </span>
                          <span className="text-[10px] font-bold text-slate-400 block mt-0.5">
                            {count} {count === 1 ? "informe" : "informes"}
                          </span>
                        </div>
                      </div>
                    );
                  })
              ) : (
                <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center shadow-2xs col-span-full">
                  <p className="text-xs font-bold text-slate-400">
                    Aún no hay informes de visita registrados en tu archivo.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* 2. Vista de Meses del Año Seleccionado */}
          {currentYear !== null && currentMonth === null && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentYear(null)}
                  className="h-8 w-8 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg flex items-center justify-center text-slate-500 transition-colors cursor-pointer shadow-2xs"
                >
                  <ArrowLeft className="h-4 w-4" />
                </button>
                <span className="text-xs font-black text-slate-400 uppercase tracking-wider">
                  Carpetas de {currentYear}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">
                {Object.keys(monthsGroup)
                  .sort((a, b) => Number(b) - Number(a))
                  .map((monthStr) => {
                    const month = Number(monthStr);
                    const count = monthsGroup[month];
                    return (
                      <div
                        key={month}
                        onClick={() => setCurrentMonth(month)}
                        className="bg-white border border-slate-200 hover:border-blue-500 rounded-2xl p-5 shadow-2xs hover:shadow-xs flex items-center gap-4 cursor-pointer transition-all group select-none"
                      >
                        <div className="h-12 w-12 rounded-xl bg-blue-50 group-hover:bg-blue-100/70 text-blue-600 flex items-center justify-center shrink-0 transition-colors">
                          <Folder className="h-6 w-6 fill-blue-100 group-hover:fill-blue-200/50" />
                        </div>
                        <div>
                          <span className="text-sm font-black text-slate-800 group-hover:text-blue-750 transition-colors block">
                            {MESES[month]}
                          </span>
                          <span className="text-[10px] font-bold text-slate-400 block mt-0.5">
                            {count} {count === 1 ? "informe" : "informes"}
                          </span>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}

          {/* 3. Vista de Archivos del Mes Seleccionado */}
          {currentYear !== null && currentMonth !== null && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentMonth(null)}
                  className="h-8 w-8 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg flex items-center justify-center text-slate-500 transition-colors cursor-pointer shadow-2xs"
                >
                  <ArrowLeft className="h-4 w-4" />
                </button>
                <span className="text-xs font-black text-slate-400 uppercase tracking-wider">
                  Documentos de {MESES[currentMonth]} de {currentYear}
                </span>
              </div>

              {explorerReports.length > 0 ? (
                <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-2xs">
                  <div className="divide-y divide-slate-100">
                    {explorerReports.map((inf) => (
                      <FileRow key={inf.id} informe={inf} />
                    ))}
                  </div>
                </div>
              ) : (
                <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center shadow-2xs">
                  <p className="text-xs font-bold text-slate-400">
                    No hay informes registrados en este mes.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Componente secundario para renderizar una fila de archivo
function FileRow({ informe }: { informe: any }) {
  const isFirmado =
    informe.firmas_informe?.some((f: any) => f.tipo === "preventor") &&
    informe.firmas_informe?.some((f: any) => f.tipo === "dueno");

  const fechaFormateada = new Date(informe.fecha_hora_visita).toLocaleDateString("es-AR");

  return (
    <div className="flex items-center justify-between p-4 hover:bg-slate-50/40 transition-colors">
      <div className="flex items-center gap-4 min-w-0">
        <div className="h-10 w-10 bg-slate-50 border border-slate-150 rounded-xl flex items-center justify-center shrink-0">
          <FileText className="h-5 w-5 text-slate-555" />
        </div>
        <div className="min-w-0">
          <span className="font-black text-slate-900 block text-sm">
            Informe N° {String(informe.numero_informe).padStart(6, "0")}
          </span>
          <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 mt-0.5 select-none">
            <span className="truncate">{informe.actividad || "Relevamiento técnico"}</span>
            <span>·</span>
            <div className="flex items-center gap-1 shrink-0 text-slate-450">
              <Building2 className="h-3 w-3" />
              <span>{informe.lugar_visita || "Planta"}</span>
            </div>
            <span>·</span>
            <span className="shrink-0">{fechaFormateada}</span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3 shrink-0">
        {/* Estado de Firma / Descarga */}
        {isFirmado && informe.url_pdf_generado ? (
          <a
            href={informe.url_pdf_generado}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 bg-emerald-50 hover:bg-emerald-100/80 text-emerald-700 border border-emerald-200 font-black px-3 py-1.5 rounded-xl text-xs transition-all shadow-2xs"
          >
            <FileDown className="h-3.5 w-3.5" />
            Descargar
          </a>
        ) : (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-400 bg-slate-50 border border-slate-150 px-2.5 py-1.5 rounded-xl select-none">
            <Clock className="h-3 w-3 text-slate-400" />
            Pendiente Firma
          </span>
        )}

        <Link
          href={`/informes/${informe.id}`}
          className="px-3.5 py-1.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-600 font-black rounded-xl text-xs transition-all shadow-2xs"
        >
          Detalle
        </Link>
      </div>
    </div>
  );
}
