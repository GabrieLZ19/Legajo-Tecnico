"use client";

import React, { useState } from "react";
import { useAdminDashboard } from "@/hooks/useAdminDashboard";
import type { EmpresaDetalle } from "@/hooks/useAdminEmpresas";
import Link from "next/link";
import {
  Building2,
  FileText,
  TrendingUp,
  Search,
  Building,
  Bell,
  AlertTriangle,
  Award,
  GraduationCap,
  ChevronDown,
  Info,
} from "lucide-react";

type AdminDashboardMetrics = {
  totalEmpresas: number;
  totalPreventores: number;
  totalInformes: number;
  informesFirmados: number;
  informesPendientes: number;
  cumplimientoGlobal: number;
  totalCapacitaciones: number;
  totalEntregasEpp: number;
};

type DashboardInforme = {
  fecha_hora_visita: string;
};

type DashboardEmpresa = EmpresaDetalle & {
  informes_visita?: Array<{
    id: string;
  }>;
};

export default function AdminDashboardPage() {
  const [searchTerm, setSearchTerm] = useState("");

  // Selector de Empresa: null significa "Consolidado (Todas)"
  const [selectedEmpresaId, setSelectedEmpresaId] = useState<string | null>(
    null,
  );
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  // Hook personalizado de React Query
  const {
    metrics,
    empresas,
    informes,
    isLoading: loading,
    isRefetching,
    error,
    refetch,
  } = useAdminDashboard(selectedEmpresaId || undefined);

  const empresasLista = empresas as DashboardEmpresa[];
  const informesLista = informes as DashboardInforme[];
  const metricsData = metrics as AdminDashboardMetrics | undefined;

  const selectedEmpresa =
    (selectedEmpresaId
      ? empresasLista.find((emp) => emp.id === selectedEmpresaId) || null
      : null) || null;

  const filteredEmpresas = empresasLista.filter(
    (emp: DashboardEmpresa) =>
      emp.razon_social.toLowerCase().includes(searchTerm.toLowerCase()) ||
      emp.cuit.includes(searchTerm),
  );

  const activeEmpresasCount = metricsData?.totalEmpresas || 0;
  const activeCumplimiento = metricsData?.cumplimientoGlobal || 100;
  const activeInformesCount =
    metricsData?.totalInformes ?? informesLista.length;
  const activePendientes = metricsData?.informesPendientes || 0;

  // Datos del Gráfico de Evolución Dinámico (Últimos 5 meses)
  const getEvolucionData = () => {
    const mesesNombres = [
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
    const hoy = new Date();
    const ultimosMeses = Array.from({ length: 5 }, (_, i) => {
      const d = new Date(hoy.getFullYear(), hoy.getMonth() - (4 - i), 1);
      return {
        key: `${d.getFullYear()}-${d.getMonth()}`,
        label: mesesNombres[d.getMonth()],
        count: 0,
      };
    });

    informesLista.forEach((inf) => {
      const date = new Date(inf.fecha_hora_visita);
      const key = `${date.getFullYear()}-${date.getMonth()}`;
      const match = ultimosMeses.find((m) => m.key === key);
      if (match) {
        match.count += 1;
      }
    });

    const maxCount = Math.max(...ultimosMeses.map((m) => m.count), 1);

    return ultimosMeses.map((m) => ({
      ...m,
      percentage: Math.max((m.count / maxCount) * 100, 8), // Mínimo 8% para visibilidad de la barra
    }));
  };

  const evolucionData = getEvolucionData();

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-10 bg-slate-200 rounded-lg w-1/4"></div>
        <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-28 bg-slate-200 rounded-2xl"></div>
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 h-72 bg-slate-200 rounded-2xl"></div>
          <div className="h-72 bg-slate-200 rounded-2xl"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white border border-slate-200 rounded-2xl p-8 shadow-2xs space-y-4">
        <div>
          <h1 className="text-xl font-black text-slate-900">
            Dashboard Global
          </h1>
          <p className="text-xs font-semibold text-slate-500 mt-1">
            No se pudieron cargar las métricas del panel.
          </p>
        </div>
        <p className="text-sm text-slate-600">
          {error instanceof Error ? error.message : "Error inesperado"}
        </p>
        <button
          onClick={() => refetch()}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold"
        >
          Reintentar carga
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Header Bar */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 pb-4 border-b border-slate-200/60 relative z-35">
        <div>
          <h1 className="text-2xl font-black text-brand-text-dark tracking-tight font-sans">
            Dashboard Global
          </h1>
          <p className="text-xs font-bold text-brand-text-muted mt-0.5 font-sans">
            Resumen consolidado de cumplimiento
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
          {/* Empresa Selector Dropdown */}
          <div className="relative">
            <button
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              className="bg-white border border-slate-200 rounded-xl px-4 py-2.5 flex items-center gap-3 shadow-2xs hover:border-slate-300 transition-all cursor-pointer select-none"
            >
              <div className="h-8 w-8 rounded-lg bg-blue-50 flex items-center justify-center border border-blue-100 shrink-0">
                <Building className="h-4.5 w-4.5 text-brand-secondary" />
              </div>
              <div className="text-left pr-2">
                <span className="text-[11px] font-black text-slate-800 block leading-tight">
                  {selectedEmpresa
                    ? selectedEmpresa.razon_social
                    : "Consolidado (Todas)"}
                </span>
                <span className="text-[9px] font-bold text-slate-400 block mt-0.5">
                  {selectedEmpresa
                    ? `CUIT ${selectedEmpresa.cuit}`
                    : "Vista multi-empresa"}
                </span>
              </div>
              <ChevronDown className="h-4 w-4 text-slate-400 shrink-0" />
            </button>

            {isDropdownOpen && (
              <div className="absolute right-0 mt-2 w-64 bg-white border border-slate-200 rounded-2xl shadow-xl py-2 z-50 animate-fade-in max-h-60 overflow-y-auto">
                <button
                  onClick={() => {
                    setSelectedEmpresaId(null);
                    setIsDropdownOpen(false);
                  }}
                  className={`w-full text-left px-4 py-2.5 text-xs font-bold transition-colors ${
                    !selectedEmpresa
                      ? "bg-blue-50 text-brand-secondary"
                      : "hover:bg-slate-50 text-slate-755"
                  }`}
                >
                  Consolidado (Todas)
                </button>
                {empresasLista.map((emp) => (
                  <button
                    key={emp.id}
                    onClick={() => {
                      setSelectedEmpresaId(emp.id);
                      setIsDropdownOpen(false);
                    }}
                    className={`w-full text-left px-4 py-2.5 text-xs font-bold transition-colors ${
                      selectedEmpresa?.id === emp.id
                        ? "bg-blue-50 text-brand-secondary"
                        : "hover:bg-slate-50 text-slate-755"
                    }`}
                  >
                    {emp.razon_social}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Role Badge */}
          <div className="bg-blue-50 text-brand-secondary border border-blue-100 px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 select-none">
            <span className="h-2 w-2 rounded-full bg-brand-secondary animate-pulse" />
            Administrador
          </div>

          {/* Search Bar */}
          <div className="relative">
            <Search className="absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 pr-4 py-3 w-44 border border-slate-200 rounded-xl text-xs font-semibold bg-white focus:outline-hidden focus:border-brand-secondary transition-all"
            />
          </div>

          {/* Notification Button */}
          <button className="p-3 border border-slate-200 rounded-xl hover:bg-slate-50 transition-all text-slate-500 cursor-pointer relative">
            <Bell className="h-4.5 w-4.5" />
            {isRefetching && (
              <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-brand-secondary animate-pulse" />
            )}
          </button>
        </div>
      </div>

      {/* Info Banner */}
      <div className="bg-blue-50/40 border border-blue-100/50 rounded-2xl p-4 flex items-start gap-3 text-xs text-slate-600 font-semibold">
        <Info className="h-4.5 w-4.5 text-brand-secondary shrink-0 mt-0.5" />
        <span>
          Como administrador general gestionas todos los CUIT y preventores. Los
          perfiles Dueño/Director solo ven la información de su propia empresa.
        </span>
      </div>

      {/* 6 Metric Cards (Larger Numbers) */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
        {/* 1. Empresas Activas */}
        <div className="bg-white border border-slate-200/85 rounded-2xl p-6 shadow-2xs space-y-4 hover:shadow-xs transition-shadow">
          <div className="h-11 w-11 rounded-xl bg-blue-50 text-brand-secondary flex items-center justify-center">
            <Building2 className="h-6 w-6" />
          </div>
          <div>
            <span className="text-3xl lg:text-4xl font-black text-slate-900 block leading-none tracking-tight">
              {activeEmpresasCount}
            </span>
            <span className="text-[10px] font-bold text-slate-400 block mt-2">
              Empresas activas
            </span>
            <span className="text-[9px] font-bold text-slate-500 mt-1.5 block">
              {selectedEmpresa
                ? "Empresa seleccionada"
                : "Vista de la consultora"}
            </span>
          </div>
        </div>

        {/* 2. Cumplimiento Global */}
        <div className="bg-white border border-slate-200/85 rounded-2xl p-6 shadow-2xs space-y-4 hover:shadow-xs transition-shadow">
          <div className="h-11 w-11 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <TrendingUp className="h-6 w-6" />
          </div>
          <div>
            <span className="text-3xl lg:text-4xl font-black text-slate-900 block leading-none tracking-tight">
              {activeCumplimiento}%
            </span>
            <span className="text-[10px] font-bold text-slate-400 block mt-2">
              Cumplimiento global
            </span>
            <span className="text-[9px] font-bold text-slate-500 mt-1.5 block">
              {selectedEmpresa
                ? "Promedio de la empresa"
                : "Promedio consolidado"}
            </span>
          </div>
        </div>

        {/* 3. Informes del Mes */}
        <div className="bg-white border border-slate-200/85 rounded-2xl p-6 shadow-2xs space-y-4 hover:shadow-xs transition-shadow">
          <div className="h-11 w-11 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
            <FileText className="h-6 w-6" />
          </div>
          <div>
            <span className="text-3xl lg:text-4xl font-black text-slate-900 block leading-none tracking-tight">
              {activeInformesCount}
            </span>
            <span className="text-[10px] font-bold text-slate-400 block mt-2">
              Informes del mes
            </span>
            <span className="text-[9px] font-bold text-slate-500 mt-1.5 block">
              Datos en tiempo real
            </span>
          </div>
        </div>

        {/* 4. Informes Pendientes */}
        <div className="bg-white border border-slate-200/85 rounded-2xl p-6 shadow-2xs space-y-4 hover:shadow-xs transition-shadow">
          <div className="h-11 w-11 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <div>
            <span className="text-3xl lg:text-4xl font-black text-slate-900 block leading-none tracking-tight">
              {activePendientes}
            </span>
            <span className="text-[10px] font-bold text-slate-400 block mt-2">
              Informes pendientes
            </span>
            <span className="text-[9px] font-bold text-slate-500 mt-1.5 block">
              Según el filtro actual
            </span>
          </div>
        </div>

        {/* 5. Capacitaciones */}
        <div className="bg-white border border-slate-200/85 rounded-2xl p-6 shadow-2xs space-y-4 hover:shadow-xs transition-shadow">
          <div className="h-11 w-11 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
            <GraduationCap className="h-6 w-6" />
          </div>
          <div>
            <span className="text-3xl lg:text-4xl font-black text-slate-900 block leading-none tracking-tight">
              {metrics?.totalCapacitaciones || 0}
            </span>
            <span className="text-[10px] font-bold text-slate-400 block mt-2">
              Capacitaciones
            </span>
            <span className="text-[9px] font-bold text-slate-500 mt-1.5 block">
              Registros asociados
            </span>
          </div>
        </div>

        {/* 6. Entregas EPP */}
        <div className="bg-white border border-slate-200/85 rounded-2xl p-6 shadow-2xs space-y-4 hover:shadow-xs transition-shadow">
          <div className="h-11 w-11 rounded-xl bg-teal-50 text-teal-655 flex items-center justify-center">
            <Award className="h-6 w-6" />
          </div>
          <div>
            <span className="text-3xl lg:text-4xl font-black text-slate-900 block leading-none tracking-tight">
              {metrics?.totalEntregasEpp || 0}
            </span>
            <span className="text-[10px] font-bold text-slate-400 block mt-2">
              Entregas EPP
            </span>
            <span className="text-[9px] font-bold text-slate-500 mt-1.5 block">
              Registros asociados
            </span>
          </div>
        </div>
      </div>

      {/* Cumplimiento por Empresa & Evolución */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Cumplimiento por Empresa Table */}
        <div className="lg:col-span-2 bg-white border border-slate-200/85 rounded-2xl p-6 shadow-2xs space-y-5">
          <div className="flex justify-between items-center">
            <h3 className="text-sm font-black text-slate-900 font-sans">
              Cumplimiento por empresa
            </h3>
            <Link
              href="/admin/empresas"
              className="text-xs font-bold text-brand-secondary hover:underline"
            >
              Ver todas
            </Link>
          </div>

          <div className="divide-y divide-slate-100">
            {(selectedEmpresa ? [selectedEmpresa] : filteredEmpresas).map(
              (emp: DashboardEmpresa) => {
                const compliance = Math.round(
                  Number(emp.porcentaje_cumplimiento || 100),
                );
                const reportsCount = emp.informes_visita?.length || 0;

                let badgeColor =
                  "bg-emerald-50 text-emerald-700 border border-emerald-100";
                let badgeText = "OK";
                if (compliance < 70) {
                  badgeColor =
                    "bg-rose-50 text-rose-700 border border-rose-100";
                  badgeText = "Riesgo";
                } else if (compliance < 80) {
                  badgeColor =
                    "bg-amber-50 text-amber-700 border border-amber-100";
                  badgeText = "Pendiente";
                }

                return (
                  <div
                    key={emp.id}
                    className="py-4 flex items-center justify-between gap-4"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {emp.logo_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={emp.logo_url}
                          alt="Logo"
                          className="h-8 w-8 rounded-lg object-contain border border-slate-200 p-0.5"
                        />
                      ) : (
                        <div className="h-8 w-8 rounded-lg   flex items-center justify-center shrink-0">
                          <Building className="h-4.5 w-4.5" />
                        </div>
                      )}
                      <span className="text-xs font-black text-slate-900 truncate">
                        {emp.razon_social}
                      </span>
                    </div>

                    <div className="flex items-center gap-6 shrink-0">
                      <span className="text-xs font-bold text-slate-450 w-20 text-center">
                        {reportsCount}{" "}
                        {reportsCount === 1 ? "informe" : "informes"}
                      </span>

                      <div className="flex items-center gap-2.5 w-32">
                        <div className="flex-1 bg-slate-100 h-2 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              compliance >= 80
                                ? "bg-emerald-500"
                                : compliance >= 70
                                  ? "bg-amber-500"
                                  : "bg-rose-500"
                            }`}
                            style={{ width: `${compliance}%` }}
                          />
                        </div>
                        <span className="text-xs font-black text-slate-800 w-8 text-right">
                          {compliance}%
                        </span>
                      </div>

                      <span
                        className={`px-2 py-1 rounded-md text-[10px] font-bold ${badgeColor} w-20 text-center`}
                      >
                        {badgeText}
                      </span>
                    </div>
                  </div>
                );
              },
            )}
            {!selectedEmpresa && filteredEmpresas.length === 0 && (
              <div className="p-8 text-center text-xs font-bold text-slate-400">
                No hay empresas cargadas que coincidan con la búsqueda.
              </div>
            )}
          </div>
        </div>

        {/* Evolución de Cumplimiento Chart */}
        <div className="bg-white border border-slate-200/85 rounded-2xl p-6 shadow-2xs flex flex-col justify-between space-y-6">
          <div>
            <h3 className="text-sm font-black text-slate-900 font-sans">
              Evolución de informes
            </h3>
            <p className="text-[10px] font-bold text-slate-400 mt-0.5">
              Volumen de informes en los últimos meses
            </p>
          </div>

          {/* Premium Dynamic Bar Chart */}
          <div className="flex items-end justify-between h-44 px-2 pt-4 border-b border-slate-100 pb-2">
            {evolucionData.map((item, i) => (
              <div
                key={i}
                className="flex flex-col items-center gap-2.5 flex-1 group relative"
              >
                {/* Tooltip con el conteo real */}
                <div className="absolute bottom-full mb-2 bg-slate-800 text-white text-[10px] font-bold px-2 py-1 rounded-md opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-md z-20">
                  {item.count} {item.count === 1 ? "informe" : "informes"}
                </div>

                <div className="w-8 bg-slate-50 border border-slate-100 rounded-t-lg h-36 flex items-end overflow-hidden">
                  <div
                    className="w-full bg-linear-to-t from-brand-secondary to-brand-accent rounded-t-lg transition-all duration-500 ease-out"
                    style={{ height: `${item.percentage}%` }}
                  />
                </div>
                <span className="text-[10px] font-bold text-slate-400">
                  {item.label}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
