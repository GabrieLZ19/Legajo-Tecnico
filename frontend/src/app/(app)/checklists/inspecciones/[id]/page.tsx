"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  Calendar,
  CheckCircle2,
  Clock,
  ExternalLink,
  FileCheck2,
  Loader,
  MapPin,
  Pencil,
  Plus,
  Printer,
  RotateCcw,
  ShieldAlert,
  Sparkles,
  Tag,
  User,
  Wrench,
  XCircle,
} from "lucide-react";
import { checklistsService } from "@/utils/services/checklists.service";
import { useAlert } from "@/context/AlertContext";
import { canWriteAppModule } from "@/lib/moduleAccess";
import { useAuth } from "@/hooks/useAuth";
import { printInspeccionActa } from "@/lib/printInspeccionActa";
import { evaluarInspeccion } from "@/lib/inspeccionCalculos";

export default function InspeccionDetallePage() {
  const params = useParams();
  const id = params.id as string;
  const router = useRouter();
  const { user, empresa } = useAuth();
  const { showAlert } = useAlert();
  const queryClient = useQueryClient();
  const canWrite = canWriteAppModule(user, "checklists");

  const [updatingAccionId, setUpdatingAccionId] = useState<string | null>(null);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["checklist-inspeccion", id],
    queryFn: () => checklistsService.obtenerInspeccion(id),
    enabled: !!id,
  });

  const updateAccion = async (
    accionId: string,
    estado: "pendiente" | "en_curso" | "cumplida",
  ) => {
    setUpdatingAccionId(accionId);
    try {
      await checklistsService.actualizarAccion(accionId, estado);
      await refetch();
      await queryClient.invalidateQueries({
        queryKey: ["checklists-inspecciones"],
      });
      showAlert("success", "Plan de acción actualizado", `Estado cambiado a ${estado}`);
    } catch (err: unknown) {
      showAlert(
        "error",
        "Error",
        err instanceof Error ? err.message : "No se pudo actualizar la acción",
      );
    } finally {
      setUpdatingAccionId(null);
    }
  };

  const items = data?.items || data?.inspeccion_items || [];
  const acciones = data?.acciones || data?.inspeccion_acciones || [];

  // Evaluación y métricas cuantitativas
  const dictamen = useMemo(() => {
    return evaluarInspeccion(items);
  }, [items]);

  const handlePrint = () => {
    if (!data) return;
    printInspeccionActa({
      id: data.id,
      plantilla_titulo: data.plantilla_titulo,
      fecha: data.fecha,
      resultado: data.resultado,
      inspector_nombre: data.inspector_nombre,
      observaciones: data.observaciones,
      equipo: data.equipos,
      empresa_nombre: empresa?.razon_social,
      items,
      acciones,
    });
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-slate-400 space-y-3">
        <Loader className="h-8 w-8 animate-spin text-brand-primary" />
        <p className="text-xs font-semibold">Cargando acta técnica de inspección…</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center space-y-4">
        <AlertCircle className="h-10 w-10 text-rose-500 mx-auto" />
        <h2 className="text-lg font-bold text-slate-900">Inspección no encontrada</h2>
        <p className="text-xs text-slate-500">
          El registro solicitado no existe o no tenés permisos para visualizarlo.
        </p>
        <Link
          href="/checklists/inspecciones"
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver a inspecciones
        </Link>
      </div>
    );
  }

  const res = data.resultado.toLowerCase();
  const esAprobada = res === "aprobada";
  const esObservada = res === "observada";
  const esRechazada = res === "rechazada";

  const fechaFormateada = new Date(data.fecha).toLocaleString("es-AR", {
    dateStyle: "full",
    timeStyle: "short",
  });

  return (
    <div className="w-full space-y-6">
      {/* Navegación y Acciones Superiores */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <Link
            href="/checklists/inspecciones"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-brand-primary transition-colors mb-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Volver a Inspecciones
          </Link>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">
              Acta de Inspección Técnica
            </h1>
            <span className="font-mono text-xs font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
              #{data.id.slice(0, 8).toUpperCase()}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Checklist: <strong className="text-slate-700">{data.plantilla_titulo}</strong> · Registrada el {fechaFormateada}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={handlePrint}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-700 hover:text-slate-900 hover:bg-slate-50 text-xs font-bold transition-all shadow-2xs cursor-pointer"
          >
            <Printer className="h-4 w-4 text-slate-600" />
            Imprimir acta oficial (A4)
          </button>

          {canWrite && data.equipo_id && (
            <Link
              href={`/checklists/inspecciones/nueva?equipoId=${data.equipo_id}&plantillaId=${data.plantilla_id || ""}`}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-brand-primary hover:bg-brand-primary/95 text-white text-xs font-bold transition-all shadow-xs cursor-pointer"
            >
              <RotateCcw className="h-4 w-4" />
              Re-inspeccionar equipo
            </Link>
          )}
        </div>
      </div>

      {/* Banner de Dictamen Oficial de Higiene y Seguridad */}
      <div
        className={`rounded-2xl border-2 p-6 shadow-sm transition-all ${
          esAprobada
            ? "bg-linear-to-r from-emerald-50 via-emerald-50/50 to-white border-emerald-500 text-emerald-950"
            : esObservada
              ? "bg-linear-to-r from-amber-50 via-amber-50/50 to-white border-amber-500 text-amber-950"
              : "bg-linear-to-r from-rose-50 via-rose-50/50 to-white border-rose-500 text-rose-950"
        }`}
      >
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div
              className={`p-3 rounded-2xl shrink-0 ${
                esAprobada
                  ? "bg-emerald-600 text-white"
                  : esObservada
                    ? "bg-amber-600 text-white"
                    : "bg-rose-600 text-white"
              }`}
            >
              {esAprobada && <CheckCircle2 className="h-7 w-7" />}
              {esObservada && <AlertTriangle className="h-7 w-7" />}
              {esRechazada && <ShieldAlert className="h-7 w-7" />}
            </div>

            <div>
              <span className="text-[10px] font-mono uppercase font-black tracking-widest opacity-75 block">
                DICTAMEN TÉCNICO OFICIAL DE OPERATIVIDAD
              </span>
              <h2 className="text-xl md:text-2xl font-black tracking-tight mt-0.5">
                {esAprobada
                  ? "EQUIPO APTO PARA OPERAR"
                  : esObservada
                    ? "APROBADA CON OBSERVACIONES"
                    : "RECHAZADA / EQUIPO NO APTO - FUERA DE SERVICIO"}
              </h2>
              <p className="text-xs font-medium mt-1 opacity-90 max-w-2xl leading-relaxed">
                {esAprobada
                  ? "El equipo cumple satisfactoriamente con los requisitos de seguridad y estándares operativos verificados en el checklist."
                  : esObservada
                    ? "El equipo puede operar temporalmente bajo condición de seguimiento y ejecución del plan de acción correctivo."
                    : "PELIGRO CRÍTICO: Se han detectado desvíos de criticidad alta. El equipo debe suspender su uso de forma inmediata hasta su subsanación técnica."}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4 border-t md:border-t-0 md:border-l border-current/20 pt-3 md:pt-0 md:pl-6 shrink-0">
            <div>
              <div className="text-[10px] uppercase font-bold tracking-wider opacity-70">
                Conformidad
              </div>
              <div className="text-3xl font-black leading-none mt-1">
                {dictamen.porcentajeConformidad}%
              </div>
              <div className="text-[11px] font-semibold mt-0.5 opacity-80">
                {dictamen.bienCount} de {dictamen.totalItems} ítems bien
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Cuadrícula de Métricas de Evaluación */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs">
          <div className="text-xs font-bold text-slate-500 mb-1">Ítems Evaluados</div>
          <div className="text-2xl font-black text-slate-900">{items.length}</div>
          <p className="text-[11px] text-slate-400 mt-0.5">Puntos de control</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs">
          <div className="text-xs font-bold text-emerald-600 mb-1">Conformes (Bien)</div>
          <div className="text-2xl font-black text-emerald-600">{dictamen.bienCount}</div>
          <p className="text-[11px] text-slate-400 mt-0.5">Cumplen estándar</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs">
          <div className="text-xs font-bold text-amber-600 mb-1">Observados (Regular)</div>
          <div className="text-2xl font-black text-amber-600">{dictamen.regularCount}</div>
          <p className="text-[11px] text-slate-400 mt-0.5">Desvíos menores</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs">
          <div className="text-xs font-bold text-rose-600 mb-1">No Conformes (Mal)</div>
          <div className="text-2xl font-black text-rose-600">{dictamen.malCount}</div>
          <p className="text-[11px] text-slate-400 mt-0.5">Fallas detectadas</p>
        </div>
      </div>

      {/* Tarjeta de Especificaciones del Equipo y Auditoría */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-2xs space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
            <Wrench className="h-4 w-4 text-brand-primary" />
            Especificaciones del Equipo Inspeccionado
          </span>
          {data.equipo_id && (
            <Link
              href={`/checklists/equipos/${data.equipo_id}`}
              className="text-xs font-bold text-brand-primary hover:underline inline-flex items-center gap-1"
            >
              Ver expediente del equipo
              <ExternalLink className="h-3.5 w-3.5" />
            </Link>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs">
          <div>
            <span className="text-slate-400 block mb-0.5 font-medium">Equipo:</span>
            <p className="text-sm font-bold text-slate-900">
              {data.equipos?.nombre || "No especificado"}
            </p>
          </div>
          <div>
            <span className="text-slate-400 block mb-0.5 font-medium">Tipo de Equipo:</span>
            <p className="text-sm font-bold text-slate-800">
              {data.equipos?.tipo_equipo || "—"}
            </p>
          </div>
          <div>
            <span className="text-slate-400 block mb-0.5 font-medium">Código Interno / TAG:</span>
            <p className="text-sm font-mono font-bold text-slate-800">
              {data.equipos?.codigo_interno || "Sin código"}
            </p>
          </div>
          <div>
            <span className="text-slate-400 block mb-0.5 font-medium">Ubicación en Planta:</span>
            <p className="text-sm font-bold text-slate-800 flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5 text-slate-400 shrink-0" />
              {data.equipos?.ubicacion || "Sin ubicación"}
            </p>
          </div>
        </div>

        <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-slate-600">
          <div className="flex items-center gap-2">
            <User className="h-4 w-4 text-slate-400" />
            <span>
              Auditor / Inspector:{" "}
              <strong className="text-slate-900 font-bold">
                {data.inspector_nombre || "Auditor interno"}
              </strong>
            </span>
          </div>

          <div className="flex items-center gap-1.5 text-slate-500">
            <Clock className="h-3.5 w-3.5 text-slate-400" />
            <span>ID de registro: {data.id}</span>
          </div>
        </div>

        {data.observaciones && (
          <div className="pt-3 border-t border-slate-100">
            <span className="text-xs font-bold text-slate-700 block mb-1">
              Observaciones de campo del inspector:
            </span>
            <p className="text-xs text-slate-600 bg-amber-50/50 p-3 rounded-xl border border-amber-200/60 leading-relaxed whitespace-pre-wrap">
              {data.observaciones}
            </p>
          </div>
        )}
      </div>

      {/* Puntos de Control y Estado de Verificación */}
      <section className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-2xs">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div>
            <h2 className="text-sm font-black text-slate-900 uppercase tracking-wider">
              Puntos de Control Verificados ({items.length})
            </h2>
            <p className="text-xs text-slate-500">
              Detalle de calificación por ítem y nivel de criticidad asignado.
            </p>
          </div>
        </div>

        <div className="divide-y divide-slate-100">
          {items.map((item, idx) => {
            const calif = item.calificacion;
            const esBien = calif === "bien";
            const esReg = calif === "regular";
            const esMal = calif === "mal";

            const crit = item.criticidad;
            const esAlta = crit === "alta";
            const esMedia = crit === "media";

            return (
              <div
                key={item.id || idx}
                className={`p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors ${
                  esMal
                    ? "bg-rose-50/30"
                    : esReg
                      ? "bg-amber-50/20"
                      : "hover:bg-slate-50/50"
                }`}
              >
                <div className="flex items-start gap-3 min-w-0">
                  <span className="font-mono text-xs font-bold text-slate-400 w-6 text-center shrink-0 mt-0.5">
                    {idx + 1}
                  </span>
                  <div>
                    <p className="text-xs md:text-sm font-bold text-slate-900 leading-snug">
                      {item.texto}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <span
                        className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${
                          esAlta
                            ? "bg-rose-50 text-rose-700 border-rose-200"
                            : esMedia
                              ? "bg-amber-50 text-amber-700 border-amber-200"
                              : "bg-slate-100 text-slate-600 border-slate-200"
                        }`}
                      >
                        Criticidad {item.criticidad}
                      </span>
                      {esAlta && esMal && (
                        <span className="text-[10px] font-bold text-rose-600 flex items-center gap-1">
                          <ShieldAlert className="h-3 w-3" />
                          Determina rechazo del equipo
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="shrink-0 flex items-center gap-2 sm:self-center pl-9 sm:pl-0">
                  <span
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black capitalize border shadow-2xs ${
                      esBien
                        ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                        : esReg
                          ? "bg-amber-50 text-amber-800 border-amber-200"
                          : "bg-rose-50 text-rose-800 border-rose-200"
                    }`}
                  >
                    {esBien && <CheckCircle2 className="h-4 w-4 text-emerald-600" />}
                    {esReg && <AlertTriangle className="h-4 w-4 text-amber-600" />}
                    {esMal && <XCircle className="h-4 w-4 text-rose-600" />}
                    {esBien ? "Conforme (Bien)" : esReg ? "Regular" : "No conforme (Mal)"}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Plan de Acción Correctivo */}
      <section className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-2xs">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div>
            <h2 className="text-sm font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <Clock className="h-4 w-4 text-blue-600" />
              Plan de Acción Correctivo ({acciones.length})
            </h2>
            <p className="text-xs text-slate-500">
              Tareas asignadas para subsanar los desvíos detectados durante la inspección.
            </p>
          </div>
        </div>

        {acciones.length === 0 ? (
          <div className="p-8 text-center text-slate-500 space-y-1">
            <CheckCircle2 className="h-8 w-8 text-emerald-500 mx-auto mb-2 opacity-80" />
            <p className="text-xs font-bold text-slate-700">
              Sin acciones correctivas requeridas
            </p>
            <p className="text-[11px] text-slate-400">
              Esta inspección no requirió la apertura de tareas correctivas adicionales.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {acciones.map((a) => {
              const esCumplida = a.estado === "cumplida";
              const esEnCurso = a.estado === "en_curso";
              const esPendiente = a.estado === "pendiente";

              return (
                <div
                  key={a.id}
                  className={`p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 ${
                    esCumplida ? "bg-slate-50/40 opacity-75" : "bg-white"
                  }`}
                >
                  <div className="space-y-1 max-w-xl">
                    <p
                      className={`text-xs md:text-sm font-bold ${
                        esCumplida
                          ? "line-through text-slate-500"
                          : "text-slate-900"
                      }`}
                    >
                      {a.descripcion}
                    </p>
                    <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                      <span>
                        Responsable: <strong className="text-slate-700">{a.responsable || "Sin asignar"}</strong>
                      </span>
                      <span>·</span>
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3 text-slate-400" />
                        {a.fecha_vencimiento
                          ? `Vence: ${new Date(a.fecha_vencimiento + "T12:00:00").toLocaleDateString("es-AR")}`
                          : "Sin fecha límite"}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {canWrite ? (
                      <div className="flex items-center gap-1.5">
                        <select
                          value={a.estado}
                          disabled={updatingAccionId === a.id}
                          onChange={(e) =>
                            void updateAccion(
                              a.id,
                              e.target.value as "pendiente" | "en_curso" | "cumplida",
                            )
                          }
                          className={`text-xs font-bold rounded-xl border px-3 py-1.5 transition-all cursor-pointer ${
                            esCumplida
                              ? "bg-emerald-50 text-emerald-800 border-emerald-300"
                              : esEnCurso
                                ? "bg-blue-50 text-blue-800 border-blue-300"
                                : "bg-amber-50 text-amber-800 border-amber-300"
                          }`}
                        >
                          <option value="pendiente">● Pendiente</option>
                          <option value="en_curso">● En curso</option>
                          <option value="cumplida">✓ Cumplida</option>
                        </select>
                        {updatingAccionId === a.id && (
                          <Loader className="h-3.5 w-3.5 animate-spin text-slate-400" />
                        )}
                      </div>
                    ) : (
                      <span
                        className={`text-xs font-bold px-2.5 py-1 rounded-lg border capitalize ${
                          esCumplida
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : "bg-amber-50 text-amber-800 border-amber-200"
                        }`}
                      >
                        {a.estado}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
