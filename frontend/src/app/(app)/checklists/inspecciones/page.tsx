"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  Calendar,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  Clock,
  Filter,
  Grid,
  LayoutGrid,
  List,
  Loader,
  Plus,
  Printer,
  Search,
  ShieldAlert,
  Sparkles,
  Tag,
  User,
  Wrench,
  X,
  XCircle,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { canWriteAppModule } from "@/lib/moduleAccess";
import { checklistsService } from "@/utils/services/checklists.service";
import { printInspeccionActa } from "@/lib/printInspeccionActa";
import type { Inspeccion } from "@/types";

type FiltroResultado = "todas" | "aprobada" | "observada" | "rechazada";

export default function InspeccionesPage() {
  const { user, empresa } = useAuth();
  const canWrite = canWriteAppModule(user, "checklists");

  // Filtros reactivos
  const [q, setQ] = useState("");
  const [filtroResultado, setFiltroResultado] = useState<FiltroResultado>("todas");
  const [equipoFiltro, setEquipoFiltro] = useState<string>("todos");
  const [vista, setVista] = useState<"cards" | "tabla">("cards");

  // Consultar inspecciones
  const { data, isLoading } = useQuery({
    queryKey: ["checklists-inspecciones", empresa?.id, "all"],
    queryFn: () =>
      checklistsService.listarInspecciones({
        empresaId: empresa!.id,
        limit: 100,
      }),
    enabled: !!empresa?.id,
  });

  // Consultar equipos para el filtro desplegable
  const { data: equipos = [] } = useQuery({
    queryKey: ["checklists-equipos", empresa?.id],
    queryFn: () => checklistsService.listarEquipos(empresa!.id),
    enabled: !!empresa?.id,
  });

  const inspecciones = data?.inspecciones || [];

  // Métricas globales en tiempo real
  const totalInspecciones = inspecciones.length;
  const totalAprobadas = inspecciones.filter((i) => i.resultado === "aprobada").length;
  const totalObservadas = inspecciones.filter((i) => i.resultado === "observada").length;
  const totalRechazadas = inspecciones.filter((i) => i.resultado === "rechazada").length;
  const tasaAprobacion =
    totalInspecciones > 0
      ? Math.round((totalAprobadas / totalInspecciones) * 100)
      : 100;
  const totalAccionesPendientes = inspecciones.reduce(
    (acc, cur) => acc + (cur.acciones_pendientes || 0),
    0,
  );

  // Filtrado reactivo en cliente
  const filtradas = useMemo(() => {
    return inspecciones.filter((i) => {
      // Filtro por resultado
      if (filtroResultado !== "todas" && i.resultado !== filtroResultado) {
        return false;
      }
      // Filtro por equipo
      if (equipoFiltro !== "todos" && i.equipo_id !== equipoFiltro) {
        return false;
      }
      // Búsqueda de texto
      if (q.trim()) {
        const query = q.toLowerCase();
        const eqNombre = (i.equipos?.nombre || "").toLowerCase();
        const eqCodigo = (i.equipos?.codigo_interno || "").toLowerCase();
        const plantilla = (i.plantilla_titulo || "").toLowerCase();
        const inspector = (i.inspector_nombre || "").toLowerCase();
        const res = (i.resultado || "").toLowerCase();
        return (
          eqNombre.includes(query) ||
          eqCodigo.includes(query) ||
          plantilla.includes(query) ||
          inspector.includes(query) ||
          res.includes(query)
        );
      }
      return true;
    });
  }, [inspecciones, filtroResultado, equipoFiltro, q]);

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
    <div className="w-full space-y-6">
      {/* Encabezado */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <Link
            href="/checklists"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-brand-primary transition-colors mb-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Volver a Checklists
          </Link>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-black text-slate-900 tracking-tight">
              Inspecciones de Equipos
            </h1>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-50 text-brand-primary border border-blue-200">
              {totalInspecciones} registradas
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Registro auditable de verificaciones en campo, dictámenes de aptitud operativa y planes de acción correctivos.
          </p>
        </div>

        {canWrite && (
          <Link
            href="/checklists/inspecciones/nueva"
            className="inline-flex items-center justify-center gap-2 bg-brand-primary hover:bg-brand-primary/95 text-white font-bold px-5 py-3 rounded-xl shadow-md text-sm transition-all cursor-pointer shrink-0"
          >
            <Plus className="h-4 w-4" />
            Nueva inspección
          </Link>
        )}
      </div>

      {/* Franja de Métricas KPI */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-bold">Total Inspecciones</span>
            <ClipboardCheck className="h-4 w-4 text-brand-primary" />
          </div>
          <div className="text-2xl font-black text-slate-900">{totalInspecciones}</div>
          <p className="text-[11px] text-slate-400 mt-0.5">Historial acumulado</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs">
          <div className="flex items-center justify-between text-emerald-600 mb-1">
            <span className="text-xs font-bold">Aprobadas / Aptas</span>
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-black text-emerald-600">{totalAprobadas}</div>
          <p className="text-[11px] text-slate-400 mt-0.5">{tasaAprobacion}% de conformidad</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs">
          <div className="flex items-center justify-between text-amber-600 mb-1">
            <span className="text-xs font-bold">Con Observaciones</span>
            <AlertTriangle className="h-4 w-4 text-amber-500" />
          </div>
          <div className="text-2xl font-black text-amber-600">{totalObservadas}</div>
          <p className="text-[11px] text-slate-400 mt-0.5">Requieren subsanación</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs">
          <div className="flex items-center justify-between text-rose-600 mb-1">
            <span className="text-xs font-bold">Rechazadas / No Aptas</span>
            <ShieldAlert className="h-4 w-4 text-rose-500" />
          </div>
          <div className="text-2xl font-black text-rose-600">{totalRechazadas}</div>
          <p className="text-[11px] text-slate-400 mt-0.5">Fuera de servicio</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs col-span-2 md:col-span-1">
          <div className="flex items-center justify-between text-blue-600 mb-1">
            <span className="text-xs font-bold">Acciones Pendientes</span>
            <Clock className="h-4 w-4 text-blue-500" />
          </div>
          <div className="text-2xl font-black text-blue-600">{totalAccionesPendientes}</div>
          <p className="text-[11px] text-slate-400 mt-0.5">Planes en curso</p>
        </div>
      </div>

      {/* Barra de Filtros y Búsqueda */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs space-y-3">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Input Buscador */}
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar por equipo, código interno, plantilla o inspector…"
              className="w-full pl-10 pr-9 py-2 rounded-xl border border-slate-200 text-xs focus:outline-hidden focus:border-brand-primary bg-slate-50/50 focus:bg-white transition-all"
            />
            {q && (
              <button
                type="button"
                onClick={() => setQ("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Filtro por Equipo */}
          <div className="flex items-center gap-2">
            <select
              value={equipoFiltro}
              onChange={(e) => setEquipoFiltro(e.target.value)}
              className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700 bg-white focus:outline-hidden focus:border-brand-primary"
            >
              <option value="todos">Todos los equipos</option>
              {equipos.map((eq) => (
                <option key={eq.id} value={eq.id}>
                  {eq.nombre} {eq.codigo_interno ? `(${eq.codigo_interno})` : ""}
                </option>
              ))}
            </select>

            {/* Selector de Vista: Cards vs Tabla */}
            <div className="inline-flex rounded-xl border border-slate-200 p-0.5 bg-slate-100/70 shrink-0">
              <button
                type="button"
                onClick={() => setVista("cards")}
                className={`p-1.5 rounded-lg text-xs font-bold transition-all ${
                  vista === "cards"
                    ? "bg-white text-slate-900 shadow-2xs"
                    : "text-slate-500 hover:text-slate-900"
                }`}
                title="Vista en tarjetas"
              >
                <LayoutGrid className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setVista("tabla")}
                className={`p-1.5 rounded-lg text-xs font-bold transition-all ${
                  vista === "tabla"
                    ? "bg-white text-slate-900 shadow-2xs"
                    : "text-slate-500 hover:text-slate-900"
                }`}
                title="Vista en tabla"
              >
                <List className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Tabs de Filtro por Resultado */}
        <div className="flex items-center gap-2 overflow-x-auto pt-1 pb-0.5 border-t border-slate-100">
          <button
            type="button"
            onClick={() => setFiltroResultado("todas")}
            className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all shrink-0 cursor-pointer ${
              filtroResultado === "todas"
                ? "bg-slate-900 text-white shadow-xs"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            Todas ({totalInspecciones})
          </button>
          <button
            type="button"
            onClick={() => setFiltroResultado("aprobada")}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all shrink-0 cursor-pointer ${
              filtroResultado === "aprobada"
                ? "bg-emerald-600 text-white shadow-xs"
                : "bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200/60"
            }`}
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            Aprobadas ({totalAprobadas})
          </button>
          <button
            type="button"
            onClick={() => setFiltroResultado("observada")}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all shrink-0 cursor-pointer ${
              filtroResultado === "observada"
                ? "bg-amber-600 text-white shadow-xs"
                : "bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-200/60"
            }`}
          >
            <AlertTriangle className="h-3.5 w-3.5" />
            Observadas ({totalObservadas})
          </button>
          <button
            type="button"
            onClick={() => setFiltroResultado("rechazada")}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all shrink-0 cursor-pointer ${
              filtroResultado === "rechazada"
                ? "bg-rose-600 text-white shadow-xs"
                : "bg-rose-50 text-rose-800 hover:bg-rose-100 border border-rose-200/60"
            }`}
          >
            <ShieldAlert className="h-3.5 w-3.5" />
            Rechazadas ({totalRechazadas})
          </button>
        </div>
      </div>

      {/* Contenido: Cards o Tabla */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-24 text-slate-400 space-y-3 bg-white rounded-2xl border border-slate-200">
          <Loader className="h-8 w-8 animate-spin text-brand-primary" />
          <p className="text-xs font-semibold">Cargando historial de inspecciones…</p>
        </div>
      ) : filtradas.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center space-y-4 shadow-2xs">
          <div className="mx-auto w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400">
            <ClipboardCheck className="h-6 w-6" />
          </div>
          <div className="max-w-md mx-auto">
            <h3 className="text-base font-bold text-slate-900">
              {q || filtroResultado !== "todas" || equipoFiltro !== "todos"
                ? "No se encontraron inspecciones con estos filtros"
                : "No hay inspecciones registradas"}
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              {q || filtroResultado !== "todas" || equipoFiltro !== "todos"
                ? "Probá restableciendo los filtros o buscando con otros términos."
                : "Realizá la primera inspección técnica de campo para iniciar el registro auditable de seguridad de tus equipos."}
            </p>
          </div>
          {q || filtroResultado !== "todas" || equipoFiltro !== "todos" ? (
            <button
              type="button"
              onClick={() => {
                setQ("");
                setFiltroResultado("todas");
                setEquipoFiltro("todos");
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors cursor-pointer"
            >
              Restablecer filtros
            </button>
          ) : canWrite ? (
            <Link
              href="/checklists/inspecciones/nueva"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-brand-primary text-white text-xs font-bold hover:bg-brand-primary/95 transition-all shadow-xs cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              Nueva inspección
            </Link>
          ) : null}
        </div>
      ) : vista === "cards" ? (
        /* VISTA EN TARJETAS */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtradas.map((insp) => {
            const res = insp.resultado;
            const esAprobada = res === "aprobada";
            const esObservada = res === "observada";
            const esRechazada = res === "rechazada";

            return (
              <div
                key={insp.id}
                className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs hover:shadow-md transition-all flex flex-col justify-between group"
              >
                <div className="space-y-3">
                  {/* Fila superior: Dictamen y fecha */}
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={`inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-lg border ${
                        esAprobada
                          ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                          : esObservada
                            ? "bg-amber-50 text-amber-800 border-amber-200"
                            : "bg-rose-50 text-rose-800 border-rose-200"
                      }`}
                    >
                      {esAprobada && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />}
                      {esObservada && <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />}
                      {esRechazada && <ShieldAlert className="h-3.5 w-3.5 text-rose-600" />}
                      {esAprobada
                        ? "Aprobada"
                        : esObservada
                          ? "Observada"
                          : "Rechazada / No Apto"}
                    </span>

                    <span className="text-[11px] font-medium text-slate-400 flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {new Date(insp.fecha).toLocaleDateString("es-AR", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })}
                    </span>
                  </div>

                  {/* Datos del Equipo */}
                  <div>
                    <h3 className="text-base font-black text-slate-900 group-hover:text-brand-primary transition-colors leading-snug">
                      {insp.equipos?.nombre || "Equipo"}
                    </h3>
                    <div className="flex flex-wrap items-center gap-1.5 mt-1">
                      {insp.equipos?.codigo_interno && (
                        <span className="text-[11px] font-mono font-bold text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded">
                          {insp.equipos.codigo_interno}
                        </span>
                      )}
                      {insp.equipos?.tipo_equipo && (
                        <span className="text-[11px] font-medium text-slate-500">
                          {insp.equipos.tipo_equipo}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Checklist aplicado */}
                  <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-xs">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">
                      Checklist aplicado
                    </span>
                    <p className="font-bold text-slate-800 truncate">
                      {insp.plantilla_titulo}
                    </p>
                  </div>

                  {/* Inspector y observaciones */}
                  <div className="space-y-1.5 pt-1 text-xs text-slate-600">
                    {insp.inspector_nombre && (
                      <div className="flex items-center gap-1.5 text-slate-500 text-[11px]">
                        <User className="h-3.5 w-3.5 text-slate-400" />
                        <span>Inspector: <strong className="text-slate-700">{insp.inspector_nombre}</strong></span>
                      </div>
                    )}

                    {insp.observaciones && (
                      <p className="text-[11px] text-slate-500 line-clamp-2 italic bg-amber-50/40 p-2 rounded-lg border border-amber-100/60">
                        "{insp.observaciones}"
                      </p>
                    )}
                  </div>

                  {/* Acciones Pendientes Badge */}
                  {(insp.acciones_pendientes ?? 0) > 0 && (
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-50 text-blue-800 text-[11px] font-bold border border-blue-200/60">
                      <Clock className="h-3.5 w-3.5 text-blue-600" />
                      {insp.acciones_pendientes} acción(es) correctiva(s) pendientes
                    </div>
                  )}
                </div>

                {/* Acciones de la tarjeta */}
                <div className="flex items-center gap-2 pt-4 mt-3 border-t border-slate-100">
                  <Link
                    href={`/checklists/inspecciones/${insp.id}`}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-colors shadow-2xs"
                  >
                    Ver acta técnica
                    <ChevronRight className="h-3.5 w-3.5" />
                  </Link>

                  <button
                    type="button"
                    onClick={(e) => handlePrintQuick(e, insp.id)}
                    className="p-2 rounded-xl border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-colors"
                    title="Imprimir acta oficial"
                  >
                    <Printer className="h-4 w-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* VISTA EN TABLA DE CONTROL */
        <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-2xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200 uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="px-5 py-3.5">Dictamen</th>
                  <th className="px-4 py-3.5">Equipo</th>
                  <th className="px-4 py-3.5">Checklist</th>
                  <th className="px-4 py-3.5">Fecha</th>
                  <th className="px-4 py-3.5">Inspector</th>
                  <th className="px-4 py-3.5 text-center">Acciones Pend.</th>
                  <th className="px-5 py-3.5 text-right">Opciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtradas.map((insp) => {
                  const res = insp.resultado;
                  const esAprobada = res === "aprobada";
                  const esObservada = res === "observada";

                  return (
                    <tr key={insp.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="px-5 py-3.5">
                        <span
                          className={`inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${
                            esAprobada
                              ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                              : esObservada
                                ? "bg-amber-50 text-amber-800 border-amber-200"
                                : "bg-rose-50 text-rose-800 border-rose-200"
                          }`}
                        >
                          {esAprobada && <CheckCircle2 className="h-3 w-3 text-emerald-600" />}
                          {esObservada && <AlertTriangle className="h-3 w-3 text-amber-600" />}
                          {!esAprobada && !esObservada && (
                            <ShieldAlert className="h-3 w-3 text-rose-600" />
                          )}
                          {res}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 font-bold text-slate-900">
                        <Link
                          href={`/checklists/equipos/${insp.equipo_id}`}
                          className="hover:text-brand-primary"
                        >
                          {insp.equipos?.nombre || "Equipo"}
                        </Link>
                        {insp.equipos?.codigo_interno && (
                          <span className="ml-1.5 text-[10px] font-mono text-slate-400">
                            TAG: {insp.equipos.codigo_interno}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-slate-700 font-medium">
                        {insp.plantilla_titulo}
                      </td>
                      <td className="px-4 py-3.5 text-slate-500 whitespace-nowrap">
                        {new Date(insp.fecha).toLocaleString("es-AR", {
                          dateStyle: "short",
                          timeStyle: "short",
                        })}
                      </td>
                      <td className="px-4 py-3.5 text-slate-600">
                        {insp.inspector_nombre || "—"}
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        {(insp.acciones_pendientes ?? 0) > 0 ? (
                          <span className="inline-block px-2 py-0.5 rounded-full bg-blue-100 text-blue-900 text-[10px] font-bold">
                            {insp.acciones_pendientes}
                          </span>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5 justify-end">
                          <Link
                            href={`/checklists/inspecciones/${insp.id}`}
                            className="px-2.5 py-1 rounded-lg bg-slate-900 text-white text-[11px] font-bold hover:bg-slate-800 transition-colors"
                          >
                            Ver acta
                          </Link>
                          <button
                            type="button"
                            onClick={(e) => handlePrintQuick(e, insp.id)}
                            className="p-1 rounded-lg border border-slate-200 text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors"
                            title="Imprimir"
                          >
                            <Printer className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
