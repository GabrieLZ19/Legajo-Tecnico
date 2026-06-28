"use client";

import React from "react";
import { useAuth } from "@/hooks/useAuth";
import { useDashboard } from "@/hooks/useDashboard";
import { useInformes } from "@/hooks/useInformes";
import Link from "next/link";
import {
  Plus,
  FileText,
  CheckSquare,
  AlertTriangle,
  ChevronRight,
  ShieldCheck,
  GraduationCap,
  Award,
  Lock,
  HardHat,
  ClipboardList,
} from "lucide-react";

export default function DashboardPage() {
  const { user, empresa } = useAuth();
  const { data: metricas, isLoading: loadingMetrics } = useDashboard(
    empresa?.id,
  );
  const { data: informes, isLoading: loadingInformes } = useInformes(
    empresa?.id,
  );

  const canCreate = user?.rol === "preventor" || user?.rol === "admin";
  const firstName = user?.nombre_completo?.split(" ")[0] || "Usuario";

  // Mapear los informes recientes para la actividad
  const actividadesRecientes =
    informes?.slice(0, 3).map((inf) => {
      if (inf.estado_firma === "firmado") {
        return {
          id: inf.id,
          tipo: "cerrado",
          titulo: `Informe de visita cerrado`,
          subtitulo: `${new Date(inf.fecha_hora_visita).toLocaleDateString("es-AR")} • N° ${inf.numero_informe}`,
          icon: FileText,
          iconBg: "bg-blue-100 text-blue-600",
        };
      } else {
        return {
          id: inf.id,
          tipo: "pendiente",
          titulo: `Firma pendiente en Informe N° ${inf.numero_informe}`,
          subtitulo: `${new Date(inf.fecha_hora_visita).toLocaleDateString("es-AR")} • ${inf.estado_firma === "borrador" ? "Pte. Preventor" : "Pte. Dueño"}`,
          icon: AlertTriangle,
          iconBg: "bg-amber-100 text-amber-600",
        };
      }
    }) || [];

  return (
    <div className="space-y-8">
      {/* Encabezado Bienvenida */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <span className="text-sm font-semibold text-slate-500 flex items-center gap-1.5">
            Hola, {firstName}{" "}
          </span>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight mt-1">
            Panel de Legajo Técnico
          </h1>
        </div>
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

      {/* Grid de Métricas Principales */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Tarjeta de Cumplimiento Global (2/3 width) */}
        <div className="lg:col-span-2 bg-[#1e40af] rounded-2xl p-6 text-white shadow-xl relative overflow-hidden flex flex-col justify-between min-h-[220px]">
          {/* Fondo decorativo */}
          <div className="absolute right-0 bottom-0 opacity-10 transform translate-x-4 translate-y-4">
            <ShieldCheck className="h-48 w-48" />
          </div>

          <div className="flex items-center justify-between relative z-10">
            <span className="text-xs font-bold uppercase tracking-wider text-blue-100">
              Cumplimiento Global • {empresa?.razon_social || "Empresa"}
            </span>
            <div className="flex items-center gap-1 bg-white/10 backdrop-blur-md border border-white/20 px-3 py-1 rounded-full text-xs font-bold">
              <Award className="h-3.5 w-3.5" />
              <span>Empresa Segura</span>
            </div>
          </div>

          <div className="my-4 relative z-10">
            <div className="text-5xl font-black tracking-tight flex items-baseline">
              {loadingMetrics ? "..." : metricas?.porcentaje_cumplimiento || 0}
              <span className="text-2xl font-bold ml-1">%</span>
            </div>
          </div>

          <div className="space-y-3 relative z-10 w-full">
            {/* Barra de progreso gruesa */}
            <div className="w-full bg-blue-950 h-3.5 rounded-full overflow-hidden">
              <div
                className="bg-[#10b981] h-full rounded-full transition-all duration-1000"
                style={{
                  width: `${loadingMetrics ? 0 : metricas?.porcentaje_cumplimiento || 0}%`,
                }}
              />
            </div>
            <p className="text-xs font-bold text-blue-100">
              {loadingMetrics
                ? "Calculando..."
                : `${metricas?.observaciones_abiertas || 0} puntos de mejora pendientes`}
            </p>
          </div>
        </div>

        {/* Tarjetas del lado derecho (1/3 width) */}
        <div className="flex flex-col gap-4 justify-between">
          {/* Tarjeta Informes del Mes */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs flex items-center gap-4 flex-1">
            <div className="h-10 w-10 rounded-full bg-blue-50 flex items-center justify-center border border-blue-100 shrink-0">
              <FileText className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <div className="text-2xl font-black text-slate-900">
                {loadingMetrics ? "..." : metricas?.informes_mes || 0}
              </div>
              <span className="text-xs font-bold text-slate-400">
                Informes este mes
              </span>
            </div>
          </div>

          {/* Tarjeta Observaciones Abiertas */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs flex items-center gap-4 flex-1">
            <div className="h-10 w-10 rounded-full bg-amber-50 flex items-center justify-center border border-amber-100 shrink-0">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <div className="text-2xl font-black text-slate-900">
                {loadingMetrics ? "..." : metricas?.observaciones_abiertas || 0}
              </div>
              <span className="text-xs font-bold text-slate-400">
                Observaciones abiertas
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Módulos Habilitados */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900">
            Módulos habilitados
          </h2>
          <span className="text-xs font-bold text-slate-400">Según CUIT</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Route to Informes */}
          <Link
            href="/informes"
            className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs hover:shadow-md transition-all flex flex-col justify-between h-36 cursor-pointer"
          >
            <div className="h-10 w-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600">
              <ClipboardList className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-800">
                Informe de Visita
              </h3>
              <span className="inline-flex mt-2 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full uppercase tracking-wider border border-emerald-100">
                Habilitado
              </span>
            </div>
          </Link>

          {/* Entrega de EPP */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs flex flex-col justify-between h-36">
            <div className="h-10 w-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600">
              <HardHat className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-800">
                Entrega de EPP
              </h3>
              <span className="inline-flex mt-2 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full uppercase tracking-wider border border-emerald-100">
                Habilitado
              </span>
            </div>
          </div>

          {/* Plan de Acción */}
          <Link
            href="/plan-accion"
            className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs hover:shadow-md transition-all flex flex-col justify-between h-36 cursor-pointer"
          >
            <div className="h-10 w-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600">
              <CheckSquare className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-800">
                Plan de Acción
              </h3>
              <span className="inline-flex mt-2 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full uppercase tracking-wider border border-emerald-100">
                Habilitado
              </span>
            </div>
          </Link>

          {/* Capacitaciones */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs flex flex-col justify-between h-36 relative overflow-hidden">
            <div className="absolute top-4 right-4 text-slate-300">
              <Lock className="h-4 w-4" />
            </div>
            <div className="h-10 w-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400">
              <GraduationCap className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-400">
                Capacitaciones
              </h3>
              <span className="inline-flex mt-2 text-[10px] font-bold text-amber-700 bg-amber-50 px-2.5 py-0.5 rounded-full uppercase tracking-wider border border-amber-100">
                Fase 2
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Actividad Reciente */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900">
            Actividad Reciente
          </h2>
          <Link
            href="/informes"
            className="text-xs font-bold text-blue-600 hover:underline"
          >
            Ver todo
          </Link>
        </div>

        {loadingInformes ? (
          <div className="space-y-3">
            <div className="h-16 bg-white border border-slate-200 rounded-2xl animate-pulse"></div>
            <div className="h-16 bg-white border border-slate-200 rounded-2xl animate-pulse"></div>
          </div>
        ) : actividadesRecientes.length > 0 ? (
          <div className="space-y-3">
            {actividadesRecientes.map((act) => {
              const Icon = act.icon;
              return (
                <Link
                  key={act.id}
                  href={`/informes/${act.id}`}
                  className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs hover:border-slate-300 transition-all flex items-center justify-between group cursor-pointer"
                >
                  <div className="flex items-center gap-4 min-w-0">
                    <div
                      className={`h-10 w-10 rounded-full flex items-center justify-center shrink-0 ${act.iconBg}`}
                    >
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-sm font-bold text-slate-800 group-hover:text-blue-600 transition-colors truncate">
                        {act.titulo}
                      </h4>
                      <p className="text-xs text-slate-400 font-semibold truncate mt-0.5">
                        {act.subtitulo}
                      </p>
                    </div>
                  </div>
                  <ChevronRight className="h-5 w-5 text-slate-300 group-hover:text-slate-500 transition-colors" />
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center">
            <p className="text-sm text-slate-500">
              No se registra actividad reciente.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
