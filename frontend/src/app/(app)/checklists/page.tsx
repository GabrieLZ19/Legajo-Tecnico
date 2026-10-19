"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  ArrowUpRight,
  Calendar,
  Check,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  Clock,
  ExternalLink,
  FileCheck2,
  FileStack,
  Filter,
  History,
  Layers,
  LayoutGrid,
  Loader,
  MapPin,
  Plus,
  Printer,
  QrCode,
  RotateCcw,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Tag,
  TrendingUp,
  User,
  Wrench,
  XCircle,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { canWriteAppModule } from "@/lib/moduleAccess";
import { checklistsService } from "@/utils/services/checklists.service";
import { printInspeccionActa } from "@/lib/printInspeccionActa";

export default function ChecklistsHubPage() {
  const { user, empresa } = useAuth();
  const canWrite = canWriteAppModule(user, "checklists");

  const [filtroFeed, setFiltroFeed] = useState<"todas" | "aprobadas" | "desvios">("todas");

  // Equipos registrados
  const { data: equipos = [], isLoading: loadingEquipos } = useQuery({
    queryKey: ["checklists-equipos", empresa?.id],
    queryFn: () => checklistsService.listarEquipos(empresa!.id, true),
    enabled: !!empresa?.id,
  });

  // Inspecciones recientes
  const { data: inspData, isLoading: loadingInsp } = useQuery({
    queryKey: ["checklists-inspecciones", empresa?.id],
    queryFn: () =>
      checklistsService.listarInspecciones({
        empresaId: empresa!.id,
        limit: 20,
      }),
    enabled: !!empresa?.id,
  });

  // Plantillas de empresa
  const { data: plantillasEmpresa = [], isLoading: loadingPlantillas } = useQuery({
    queryKey: ["checklist-plantillas-empresa", empresa?.id],
    queryFn: () =>
      checklistsService.listarPlantillas({
        ambito: "empresa",
        empresaId: empresa!.id,
      }),
    enabled: !!empresa?.id,
  });

  // Plantillas de biblioteca LT
  const { data: plantillasLt = [] } = useQuery({
    queryKey: ["checklist-plantillas-lt"],
    queryFn: () => checklistsService.listarPlantillas({ ambito: "global" }),
  });

  const inspecciones = inspData?.inspecciones || [];
  const totalEquipos = equipos.length;
  const activos = equipos.filter((e) => e.activo).length;
  const inactivos = totalEquipos - activos;

  const totalInspecciones = inspecciones.length;
  const rechazadas = inspecciones.filter((i) => i.resultado === "rechazada").length;
  const observadas = inspecciones.filter((i) => i.resultado === "observada").length;
  const aprobadas = inspecciones.filter((i) => i.resultado === "aprobada").length;

  // % de conformidad
  const tasaConformidad =
    totalInspecciones > 0
      ? Math.round((aprobadas / totalInspecciones) * 100)
      : 100;

  // Acciones pendientes totales
  const totalAccionesPendientes = inspecciones.reduce(
    (acc, cur) => acc + (cur.acciones_pendientes || 0),
    0,
  );

  // Filtrado del feed principal
  const inspeccionesFiltradas = useMemo(() => {
    if (filtroFeed === "aprobadas") {
      return inspecciones.filter((i) => i.resultado === "aprobada");
    }
    if (filtroFeed === "desvios") {
      return inspecciones.filter(
        (i) => i.resultado === "observada" || i.resultado === "rechazada",
      );
    }
    return inspecciones;
  }, [inspecciones, filtroFeed]);

  const handlePrintQuick = async (e: React.MouseEvent, inspId: string) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      const fullInsp = await checklistsService.obtenerInspeccion(inspId);
      if (fullInsp) {
        printInspeccionActa({
          id: fullInsp.id,
          plantilla_titulo: fullInsp.plantilla_titulo,
          fecha: fullInsp.fecha,
          resultado: fullInsp.resultado,
          inspector_nombre: fullInsp.inspector_nombre,
          observaciones: fullInsp.observaciones,
          equipo: fullInsp.equipos,
          empresa_nombre: empresa?.razon_social,
          items: fullInsp.items || fullInsp.inspeccion_items || [],
          acciones: fullInsp.acciones || fullInsp.inspeccion_acciones || [],
        });
      }
    } catch (err) {
      console.error("Error al imprimir acta rápida:", err);
    }
  };

  return (
    <div className="w-full space-y-6 pb-12">
      {/* 1. HEADER CORPORATIVO DEL SITIO (Colores y estilo estándar) */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <span className="text-sm font-semibold text-slate-500 flex items-center gap-1.5">
            <ClipboardCheck className="h-4 w-4 text-brand-primary" />
            Módulo de Checklists
          </span>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight mt-1">
            Checklists y Control de Equipos
          </h1>
          <p className="text-sm text-brand-text-muted mt-1 max-w-2xl">
            Inspección y aptitud de maquinaria en campo con QR, control normativo de Higiene y Seguridad Laboral y seguimiento de planes de acción.
          </p>
        </div>

        {canWrite && (
          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <Link
              href="/checklists/inspecciones/nueva"
              className="inline-flex items-center justify-center gap-2 bg-brand-primary hover:bg-brand-primary/95 text-white font-bold px-5 py-3 rounded-xl shadow-md shadow-blue-900/10 hover:shadow-lg transition-all text-sm cursor-pointer"
            >
              <ClipboardCheck className="h-4 w-4" />
              Nueva inspección
            </Link>
            <Link
              href="/checklists/equipos/nuevo"
              className="inline-flex items-center justify-center gap-2 bg-white hover:bg-slate-50 text-slate-700 font-bold px-4 py-3 rounded-xl border border-slate-200 shadow-xs hover:border-slate-300 transition-all text-sm cursor-pointer"
            >
              <Plus className="h-4 w-4 text-slate-500" />
              Nuevo equipo
            </Link>
            <Link
              href="/checklists/plantillas/nueva"
              className="inline-flex items-center justify-center gap-2 bg-white hover:bg-slate-50 text-slate-700 font-bold px-4 py-3 rounded-xl border border-slate-200 shadow-xs hover:border-slate-300 transition-all text-sm cursor-pointer"
            >
              <FileStack className="h-4 w-4 text-slate-500" />
              Nueva plantilla
            </Link>
          </div>
        )}
      </div>

      {/* 2. STATS CARDS DEL SITIO (Estilo idéntico a ART / Mediciones / Dashboard) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[11px] uppercase font-bold tracking-wider text-slate-400 block">
              Conformidad Técnica
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-black text-slate-900">
                {tasaConformidad}%
              </span>
              <span className="text-xs text-slate-500 font-medium">
                ({aprobadas}/{totalInspecciones})
              </span>
            </div>
            <p className="text-xs text-emerald-600 font-semibold">Inspecciones aprobadas</p>
          </div>
          <div className="h-11 w-11 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 shrink-0">
            <ShieldCheck className="h-5 w-5" />
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[11px] uppercase font-bold tracking-wider text-slate-400 block">
              Parque de Equipos
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-black text-slate-900">
                {activos}
              </span>
              <span className="text-xs text-slate-500 font-medium">
                de {totalEquipos} activos
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium">
              {inactivos > 0 ? `${inactivos} en mantenimiento` : "100% operativos"}
            </p>
          </div>
          <div className="h-11 w-11 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-brand-primary shrink-0">
            <Wrench className="h-5 w-5" />
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[11px] uppercase font-bold tracking-wider text-slate-400 block">
              Desvíos Activos
            </span>
            <div className="flex items-baseline gap-2">
              <span className={`text-2xl sm:text-3xl font-black ${rechazadas > 0 ? "text-rose-600" : "text-slate-900"}`}>
                {rechazadas}
              </span>
              <span className="text-xs text-slate-500 font-medium">
                rechazadas · {observadas} obs.
              </span>
            </div>
            <p className="text-xs text-rose-600 font-medium">
              {rechazadas > 0 ? "Requieren intervención" : "Sin desvíos críticos"}
            </p>
          </div>
          <div className="h-11 w-11 rounded-xl bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-600 shrink-0">
            <ShieldAlert className="h-5 w-5" />
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[11px] uppercase font-bold tracking-wider text-slate-400 block">
              Plan de Acción
            </span>
            <div className="flex items-baseline gap-2">
              <span className={`text-2xl sm:text-3xl font-black ${totalAccionesPendientes > 0 ? "text-amber-600" : "text-slate-900"}`}>
                {totalAccionesPendientes}
              </span>
              <span className="text-xs text-slate-500 font-medium">pendientes</span>
            </div>
            <p className="text-xs text-amber-600 font-medium">
              {totalAccionesPendientes > 0 ? "Tareas correctivas abiertas" : "Todo regularizado"}
            </p>
          </div>
          <div className="h-11 w-11 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600 shrink-0">
            <AlertCircle className="h-5 w-5" />
          </div>
        </div>
      </div>

      {/* 2. GRID PRINCIPAL DE 2 COLUMNAS (7 / 5) APROVECHANDO TODO EL ANCHO DE PANTALLA */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* COLUMNA IZQUIERDA (7 cols): Feed Operativo de Inspecciones Recientes */}
        <div className="lg:col-span-7 space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-2xs">
            {/* Header del Feed con Pestañas de Filtro */}
            <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50">
              <div>
                <h2 className="text-sm font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
                  <History className="h-4 w-4 text-brand-primary" />
                  Auditorías e Inspecciones Recientes
                </h2>
                <p className="text-xs text-slate-500">
                  Verificaciones técnicas con cálculo de aptitud operativa en tiempo real.
                </p>
              </div>

              {/* Filtros rápidos por resultado */}
              <div className="inline-flex rounded-xl border border-slate-200 p-0.5 bg-white shrink-0 self-start sm:self-auto shadow-2xs text-xs">
                <button
                  type="button"
                  onClick={() => setFiltroFeed("todas")}
                  className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
                    filtroFeed === "todas"
                      ? "bg-slate-900 text-white shadow-2xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  Todas ({totalInspecciones})
                </button>
                <button
                  type="button"
                  onClick={() => setFiltroFeed("aprobadas")}
                  className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
                    filtroFeed === "aprobadas"
                      ? "bg-emerald-600 text-white shadow-2xs"
                      : "text-slate-600 hover:text-emerald-700"
                  }`}
                >
                  Aprobadas ({aprobadas})
                </button>
                <button
                  type="button"
                  onClick={() => setFiltroFeed("desvios")}
                  className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
                    filtroFeed === "desvios"
                      ? "bg-rose-600 text-white shadow-2xs"
                      : "text-slate-600 hover:text-rose-700"
                  }`}
                >
                  Con desvíos ({observadas + rechazadas})
                </button>
              </div>
            </div>

            {/* Lista del Feed */}
            {loadingInsp ? (
              <div className="flex flex-col items-center justify-center py-20 text-slate-400 space-y-2">
                <Loader className="h-6 w-6 animate-spin text-brand-primary" />
                <p className="text-xs font-semibold">Cargando inspecciones…</p>
              </div>
            ) : inspeccionesFiltradas.length === 0 ? (
              <div className="p-12 text-center space-y-3">
                <ClipboardCheck className="h-10 w-10 text-slate-300 mx-auto" />
                <div>
                  <h3 className="text-sm font-bold text-slate-800">
                    {filtroFeed === "todas"
                      ? "Sin inspecciones registradas aún"
                      : "No hay inspecciones con este filtro"}
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5 max-w-sm mx-auto">
                    {filtroFeed === "todas"
                      ? "Realizá la primera verificación técnica para emitir el acta oficial del equipo."
                      : "No se encontraron inspecciones en esta categoría."}
                  </p>
                </div>
                {canWrite && filtroFeed === "todas" && (
                  <Link
                    href="/checklists/inspecciones/nueva"
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-brand-primary text-white text-xs font-bold hover:bg-brand-primary/95 transition-colors cursor-pointer"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Iniciar inspección
                  </Link>
                )}
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {inspeccionesFiltradas.slice(0, 6).map((insp) => {
                  const res = insp.resultado;
                  const esAprobada = res === "aprobada";
                  const esObservada = res === "observada";
                  const esRechazada = res === "rechazada";

                  return (
                    <div
                      key={insp.id}
                      className="p-4 sm:p-5 hover:bg-slate-50/70 transition-colors flex items-center justify-between gap-4 group"
                    >
                      <div className="min-w-0 space-y-1.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={`inline-flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${
                              esAprobada
                                ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                                : esObservada
                                  ? "bg-amber-50 text-amber-800 border-amber-200"
                                  : "bg-rose-50 text-rose-800 border-rose-200"
                            }`}
                          >
                            {esAprobada && <CheckCircle2 className="h-3 w-3 text-emerald-600" />}
                            {esObservada && <AlertTriangle className="h-3 w-3 text-amber-600" />}
                            {esRechazada && <ShieldAlert className="h-3 w-3 text-rose-600" />}
                            {esAprobada ? "Aprobada" : esObservada ? "Observada" : "Rechazada"}
                          </span>

                          <span className="text-[11px] font-medium text-slate-400">
                            {new Date(insp.fecha).toLocaleDateString("es-AR", {
                              day: "2-digit",
                              month: "short",
                              year: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>

                          {insp.equipos?.codigo_interno && (
                            <span className="text-[10px] font-mono font-bold text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded">
                              TAG: {insp.equipos.codigo_interno}
                            </span>
                          )}
                        </div>

                        <Link
                          href={`/checklists/inspecciones/${insp.id}`}
                          className="text-xs sm:text-sm font-black text-slate-900 group-hover:text-brand-primary transition-colors block truncate"
                        >
                          {insp.equipos?.nombre || "Equipo"} · {insp.plantilla_titulo}
                        </Link>

                        <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                          {insp.inspector_nombre && (
                            <span className="flex items-center gap-1">
                              <User className="h-3 w-3 text-slate-400" />
                              Auditor: <strong>{insp.inspector_nombre}</strong>
                            </span>
                          )}
                          {(insp.acciones_pendientes ?? 0) > 0 && (
                            <span className="text-amber-600 font-bold flex items-center gap-1">
                              · <Clock className="h-3 w-3" /> {insp.acciones_pendientes} acc. pendientes
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={(e) => handlePrintQuick(e, insp.id)}
                          className="p-2 rounded-xl border border-slate-200 text-slate-500 hover:text-slate-900 hover:bg-white transition-colors"
                          title="Imprimir acta técnica oficial (A4)"
                        >
                          <Printer className="h-3.5 w-3.5" />
                        </button>

                        <Link
                          href={`/checklists/inspecciones/${insp.id}`}
                          className="p-2 rounded-xl bg-slate-100 group-hover:bg-slate-900 group-hover:text-white text-slate-600 transition-colors"
                          title="Ver acta técnica"
                        >
                          <ChevronRight className="h-4 w-4" />
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Footer del Feed */}
            {inspecciones.length > 0 && (
              <div className="p-3 bg-slate-50 border-t border-slate-100 text-center">
                <Link
                  href="/checklists/inspecciones"
                  className="text-xs font-bold text-brand-primary hover:underline inline-flex items-center gap-1"
                >
                  Ver todo el historial de inspecciones ({totalInspecciones})
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* COLUMNA DERECHA (5 cols): Centro de Módulos & Accesos Operativos */}
        <div className="lg:col-span-5 space-y-4">
          {/* Módulo 1: Parque de Equipos & QR */}
          <div className="rounded-2xl border border-orange-200/80 bg-linear-to-b from-orange-50/40 via-white to-white p-5 shadow-2xs space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-orange-500 text-white flex items-center justify-center shadow-xs">
                  <QrCode className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900">
                    Parque de Equipos & QR
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    {activos} activos de {totalEquipos} registrados
                  </p>
                </div>
              </div>

              <Link
                href="/checklists/equipos"
                className="text-xs font-bold text-orange-600 hover:underline inline-flex items-center gap-0.5"
              >
                Ver todos
                <ChevronRight className="h-3.5 w-3.5" />
              </Link>
            </div>

            {/* Mini feed de equipos */}
            {equipos.length === 0 ? (
              <p className="text-xs text-slate-400 italic">No hay equipos cargados.</p>
            ) : (
              <div className="space-y-2">
                {equipos.slice(0, 3).map((eq) => (
                  <div
                    key={eq.id}
                    className="p-2.5 rounded-xl border border-slate-200 bg-white hover:border-orange-300 transition-colors flex items-center justify-between text-xs"
                  >
                    <div className="min-w-0 pr-2">
                      <Link
                        href={`/checklists/equipos/${eq.id}`}
                        className="font-bold text-slate-900 hover:text-orange-600 truncate block"
                      >
                        {eq.nombre}
                      </Link>
                      <div className="text-[10px] text-slate-400 flex items-center gap-1.5 mt-0.5">
                        <span>{eq.tipo_equipo}</span>
                        {eq.codigo_interno && (
                          <span>· TAG: <strong className="font-mono text-slate-600">{eq.codigo_interno}</strong></span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      {canWrite && eq.activo && (
                        <Link
                          href={`/checklists/inspecciones/nueva?equipoId=${eq.id}`}
                          className="px-2 py-1 rounded-lg bg-orange-50 hover:bg-orange-100 text-orange-800 text-[10px] font-bold transition-colors"
                          title="Inspeccionar"
                        >
                          Inspeccionar
                        </Link>
                      )}
                      <Link
                        href={`/checklists/equipos/${eq.id}`}
                        className="p-1 rounded-lg text-slate-400 hover:text-slate-700"
                        title="Ver QR"
                      >
                        <QrCode className="h-3.5 w-3.5" />
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {canWrite && (
              <Link
                href="/checklists/equipos/nuevo"
                className="w-full inline-flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-800 text-xs font-bold transition-colors shadow-2xs"
              >
                <Plus className="h-3.5 w-3.5 text-orange-600" />
                Dar de alta nuevo equipo
              </Link>
            )}
          </div>

          {/* Módulo 2: Plantillas de Checklist */}
          <div className="rounded-2xl border border-blue-200/80 bg-linear-to-b from-blue-50/40 via-white to-white p-5 shadow-2xs space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-brand-primary text-white flex items-center justify-center shadow-xs">
                  <FileStack className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900">
                    Plantillas de Checklist
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    {plantillasEmpresa.length} propias · {plantillasLt.length} modelos LT
                  </p>
                </div>
              </div>

              <Link
                href="/checklists/plantillas"
                className="text-xs font-bold text-brand-primary hover:underline inline-flex items-center gap-0.5"
              >
                Ver todas
                <ChevronRight className="h-3.5 w-3.5" />
              </Link>
            </div>

            {/* Mini feed de plantillas */}
            {plantillasEmpresa.length === 0 && plantillasLt.length === 0 ? (
              <p className="text-xs text-slate-400 italic">No hay plantillas creadas.</p>
            ) : (
              <div className="space-y-2">
                {[...plantillasEmpresa, ...plantillasLt].slice(0, 3).map((p) => (
                  <div
                    key={p.id}
                    className="p-2.5 rounded-xl border border-slate-200 bg-white hover:border-blue-300 transition-colors flex items-center justify-between text-xs"
                  >
                    <div className="min-w-0 pr-2">
                      <Link
                        href={`/checklists/plantillas/${p.id}`}
                        className="font-bold text-slate-900 hover:text-brand-primary truncate block"
                      >
                        {p.titulo}
                      </Link>
                      <div className="text-[10px] text-slate-400 flex items-center gap-1.5 mt-0.5">
                        <span>{p.tipo_equipo}</span>
                        <span>· {p.ambito === "empresa" ? "Empresa" : "LT Global"}</span>
                      </div>
                    </div>

                    <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md shrink-0">
                      {p.total_items ?? 0} ítems
                    </span>
                  </div>
                ))}
              </div>
            )}

            {canWrite && (
              <Link
                href="/checklists/plantillas/nueva"
                className="w-full inline-flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-800 text-xs font-bold transition-colors shadow-2xs"
              >
                <Plus className="h-3.5 w-3.5 text-brand-primary" />
                Crear nueva plantilla
              </Link>
            )}
          </div>

          {/* Módulo 3: Plan de Acción OSH & Estado de Seguridad */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                <Clock className="h-4 w-4 text-blue-600" />
                Seguimiento de Acciones Correctivas
              </span>
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  totalAccionesPendientes > 0
                    ? "bg-amber-100 text-amber-900"
                    : "bg-emerald-100 text-emerald-900"
                }`}
              >
                {totalAccionesPendientes > 0
                  ? `${totalAccionesPendientes} pendientes`
                  : "Al día"}
              </span>
            </div>

            <p className="text-xs text-slate-500 leading-relaxed">
              {totalAccionesPendientes > 0
                ? "Existen tareas correctivas abiertas generadas en las últimas inspecciones. Revisá los responsables y plazos de vencimiento."
                : "No hay acciones correctivas pendientes. Todos los equipos verificados operan bajo estándares de seguridad conformes."}
            </p>

            <Link
              href="/plan-accion"
              className="inline-flex items-center gap-1 text-xs font-bold text-brand-primary hover:underline"
            >
              Ir al módulo general de Plan de Acción
              <ExternalLink className="h-3 w-3" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
