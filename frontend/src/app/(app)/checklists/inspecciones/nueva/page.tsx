"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  Calendar,
  Check,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  Clock,
  ExternalLink,
  HelpCircle,
  Info,
  Loader,
  MapPin,
  Plus,
  RotateCcw,
  ShieldAlert,
  Sparkles,
  Tag,
  Trash2,
  User,
  Wrench,
  XCircle,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useAlert } from "@/context/AlertContext";
import { canWriteAppModule } from "@/lib/moduleAccess";
import { checklistsService } from "@/utils/services/checklists.service";
import { evaluarInspeccion } from "@/lib/inspeccionCalculos";
import type { CalificacionChecklist, CriticidadChecklist } from "@/types";

type ItemDraft = {
  texto: string;
  criticidad: CriticidadChecklist;
  calificacion: CalificacionChecklist;
};

type AccionDraft = {
  descripcion: string;
  responsable: string;
  fecha_vencimiento: string;
};

function NuevaInspeccionForm() {
  const { user, empresa } = useAuth();
  const { showAlert } = useAlert();
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const canWrite = canWriteAppModule(user, "checklists");

  const preEquipoId = searchParams.get("equipoId") || "";
  const prePlantillaId = searchParams.get("plantillaId") || "";

  const [equipoId, setEquipoId] = useState(preEquipoId);
  const [plantillaId, setPlantillaId] = useState(prePlantillaId);
  const [inspectorNombre, setInspectorNombre] = useState(
    user?.nombre_completo || user?.username || "",
  );
  const [items, setItems] = useState<ItemDraft[]>([]);
  const [acciones, setAcciones] = useState<AccionDraft[]>([]);
  const [observaciones, setObservaciones] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!inspectorNombre && (user?.nombre_completo || user?.username)) {
      setInspectorNombre(user.nombre_completo || user.username || "");
    }
  }, [user, inspectorNombre]);

  // Listar equipos
  const { data: equipos = [], isLoading: loadingEquipos } = useQuery({
    queryKey: ["checklists-equipos", empresa?.id],
    queryFn: () => checklistsService.listarEquipos(empresa!.id),
    enabled: !!empresa?.id,
  });

  const equipo = useMemo(
    () => equipos.find((e) => e.id === equipoId),
    [equipos, equipoId],
  );

  // Listar plantillas
  const { data: plantillasEmpresa = [], isLoading: loadingEmpresa } = useQuery({
    queryKey: ["checklist-plantillas-empresa", empresa?.id],
    queryFn: () =>
      checklistsService.listarPlantillas({
        ambito: "empresa",
        empresaId: empresa!.id,
      }),
    enabled: !!empresa?.id,
  });

  const { data: plantillasLt = [], isLoading: loadingLt } = useQuery({
    queryKey: ["checklist-plantillas-lt"],
    queryFn: () =>
      checklistsService.listarPlantillas({
        ambito: "global",
      }),
  });

  const todasPlantillas = useMemo(
    () => [...plantillasEmpresa, ...plantillasLt],
    [plantillasEmpresa, plantillasLt],
  );

  // Separar plantillas sugeridas para el equipo
  const { plantillasSugeridas, otrasPlantillas } = useMemo(() => {
    if (!equipo?.tipo_equipo) {
      return { plantillasSugeridas: [], otrasPlantillas: todasPlantillas };
    }
    const eqType = equipo.tipo_equipo.toLowerCase().trim();
    const sugeridas: typeof todasPlantillas = [];
    const otras: typeof todasPlantillas = [];

    for (const p of todasPlantillas) {
      const pType = (p.tipo_equipo || "").toLowerCase().trim();
      const match =
        pType === eqType ||
        (eqType.length > 2 && pType.includes(eqType)) ||
        (pType.length > 2 && eqType.includes(pType));
      if (match) {
        sugeridas.push(p);
      } else {
        otras.push(p);
      }
    }
    return { plantillasSugeridas: sugeridas, otrasPlantillas: otras };
  }, [equipo?.tipo_equipo, todasPlantillas]);

  // Auto-seleccionar plantilla si sólo hay una relevante
  useEffect(() => {
    if (!plantillaId && equipoId) {
      if (plantillasSugeridas.length === 1) {
        setPlantillaId(plantillasSugeridas[0].id);
      } else if (
        plantillasSugeridas.length === 0 &&
        todasPlantillas.length === 1
      ) {
        setPlantillaId(todasPlantillas[0].id);
      }
    }
  }, [equipoId, plantillasSugeridas, todasPlantillas, plantillaId]);

  // Cargar ítems de la plantilla al seleccionarla
  useEffect(() => {
    if (!plantillaId) {
      setItems([]);
      return;
    }
    void checklistsService.obtenerPlantilla(plantillaId).then((p) => {
      const src = p.items || p.checklist_plantilla_items || [];
      setItems(
        src.map((i) => ({
          texto: i.texto,
          criticidad: i.criticidad,
          calificacion: "bien" as const,
        })),
      );
    });
  }, [plantillaId]);

  // Dictamen en tiempo real
  const dictamen = useMemo(() => {
    return evaluarInspeccion(items);
  }, [items]);

  // Marcar todos como "Bien"
  const handleMarcarTodosBien = () => {
    setItems((prev) =>
      prev.map((it) => ({
        ...it,
        calificacion: "bien",
      })),
    );
    showAlert(
      "info",
      "Puntos verificados",
      "Se marcaron todos los ítems como Conforme (Bien).",
    );
  };

  // Agregar acción correctiva a partir de un ítem defectuoso
  const handleAgregarAccionParaItem = (textoItem: string) => {
    setAcciones((prev) => [
      ...prev,
      {
        descripcion: `Subsanar desvío detectado: ${textoItem}`,
        responsable: "",
        fecha_vencimiento: "",
      },
    ]);
    showAlert(
      "success",
      "Acción agregada",
      "Se sumó una tarea correctiva al plan de acción.",
    );
  };

  if (!canWrite) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center space-y-4">
        <AlertCircle className="h-10 w-10 text-amber-500 mx-auto" />
        <h2 className="text-lg font-bold text-slate-900">Acceso restringido</h2>
        <p className="text-xs text-slate-500">
          No tenés permisos para crear nuevas inspecciones en este módulo.
        </p>
        <Link
          href="/checklists/inspecciones"
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver
        </Link>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!empresa?.id || !equipoId || !plantillaId || items.length === 0) {
      showAlert(
        "warning",
        "Datos incompletos",
        "Seleccioná un equipo, un checklist y verificá los ítems antes de guardar.",
      );
      return;
    }
    if (!inspectorNombre.trim()) {
      showAlert(
        "warning",
        "Falta inspector",
        "Ingresá el nombre y apellido del inspector u operario que realizó la verificación.",
      );
      return;
    }
    const plantilla = todasPlantillas.find((p) => p.id === plantillaId);
    setSaving(true);
    try {
      const insp = await checklistsService.crearInspeccion({
        empresa_id: empresa.id,
        equipo_id: equipoId,
        plantilla_id: plantillaId,
        plantilla_titulo: plantilla?.titulo || "Checklist",
        inspector_nombre: inspectorNombre.trim(),
        observaciones: observaciones.trim() || null,
        items,
        acciones: acciones
          .filter((a) => a.descripcion.trim())
          .map((a) => ({
            descripcion: a.descripcion.trim(),
            responsable: a.responsable.trim() || null,
            fecha_vencimiento: a.fecha_vencimiento || null,
          })),
      });
      await queryClient.invalidateQueries({
        queryKey: ["checklists-inspecciones"],
      });
      showAlert(
        "success",
        "Inspección guardada",
        `Dictamen final: ${insp.resultado.toUpperCase()}`,
      );
      router.push(`/checklists/inspecciones/${insp.id}`);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: string } } };
      showAlert(
        "error",
        "Error al guardar",
        axiosErr.response?.data?.error ||
          (err instanceof Error
            ? err.message
            : "No se pudo guardar la inspección"),
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="w-full space-y-6">
      {/* Encabezado */}
      <div>
        <Link
          href="/checklists/inspecciones"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-brand-primary transition-colors mb-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver a Inspecciones
        </Link>
        <div className="flex items-center gap-3">
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">
            Nueva Inspección Técnica
          </h1>
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-50 text-brand-primary border border-blue-200">
            Puntos de Control OSH
          </span>
        </div>
        <p className="text-sm text-slate-500 mt-1">
          Completá la verificación en campo. El dictamen oficial se calculará
          automáticamente en base a las criticidades.
        </p>
      </div>

      <form onSubmit={(e) => void handleSubmit(e)}>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* COLUMNA PRINCIPAL IZQUIERDA: Formulario */}
          <div className="lg:col-span-8 space-y-6">
            {/* Paso 1: Selección de Equipo y Checklist */}
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-2xs space-y-5">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                  <Wrench className="h-4 w-4 text-brand-primary" />
                  1. Equipo y Checklist a evaluar
                </span>
                <span className="text-[10px] font-bold text-slate-400">
                  Paso 1 de 3
                </span>
              </div>

              {/* Identificación del Inspector / Operador */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Nombre y Apellido del Inspector / Operador{" "}
                  <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <User className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    value={inspectorNombre}
                    onChange={(e) => setInspectorNombre(e.target.value)}
                    placeholder="Ej: Diego Ariel (Inspector OSH / Operador Nave Central)"
                    className="w-full rounded-xl border border-slate-200 pl-10 pr-3.5 py-2.5 text-xs font-semibold text-slate-900 bg-white focus:outline-hidden focus:border-brand-primary"
                    required
                  />
                </div>
                <p className="mt-1 text-[11px] text-slate-400">
                  Profesional o técnico que llevó a cabo la inspección en
                  planta.
                </p>
              </div>
              {/* Selector de Equipo */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Seleccionar Equipo a Inspeccionar *
                </label>
                <select
                  value={equipoId}
                  onChange={(e) => {
                    setEquipoId(e.target.value);
                    setPlantillaId("");
                  }}
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-xs font-semibold text-slate-800 bg-white focus:outline-hidden focus:border-brand-primary"
                  required
                >
                  <option value="">Seleccionar equipo de planta…</option>
                  {equipos.map((eq) => (
                    <option key={eq.id} value={eq.id}>
                      {eq.nombre} — {eq.tipo_equipo}{" "}
                      {eq.codigo_interno ? `(TAG: ${eq.codigo_interno})` : ""}
                    </option>
                  ))}
                </select>

                {equipos.length === 0 && !loadingEquipos && (
                  <p className="mt-2 text-xs text-amber-600 bg-amber-50 p-2.5 rounded-xl border border-amber-200">
                    No tenés equipos registrados en tu empresa.{" "}
                    <Link
                      href="/checklists/equipos/nuevo"
                      className="underline font-bold text-amber-800"
                    >
                      Crear un equipo ahora
                    </Link>
                  </p>
                )}
              </div>

              {/* Ficha rápida del equipo seleccionado */}
              {equipo && (
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
                  <div className="space-y-0.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                      Equipo seleccionado
                    </span>
                    <strong className="text-slate-900 font-bold text-sm">
                      {equipo.nombre}
                    </strong>
                    <div className="flex items-center gap-2 text-slate-500 text-[11px] mt-0.5">
                      <span>
                        Tipo:{" "}
                        <strong className="text-slate-700">
                          {equipo.tipo_equipo}
                        </strong>
                      </span>
                      {equipo.codigo_interno && (
                        <span>
                          · TAG:{" "}
                          <strong className="font-mono text-slate-700">
                            {equipo.codigo_interno}
                          </strong>
                        </span>
                      )}
                      {equipo.ubicacion && (
                        <span className="flex items-center gap-1">
                          · <MapPin className="h-3 w-3 text-slate-400" />{" "}
                          {equipo.ubicacion}
                        </span>
                      )}
                    </div>
                  </div>

                  <Link
                    href={`/checklists/equipos/${equipo.id}`}
                    target="_blank"
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-brand-primary hover:underline bg-white px-2.5 py-1.5 rounded-lg border border-slate-200 shadow-2xs"
                  >
                    Ver ficha
                    <ExternalLink className="h-3 w-3" />
                  </Link>
                </div>
              )}

              {/* Selector de Checklist */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Checklist de Verificación *
                  </label>
                  {equipo && plantillasSugeridas.length > 0 && (
                    <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                      {plantillasSugeridas.length} sugerida(s) para{" "}
                      {equipo.tipo_equipo}
                    </span>
                  )}
                </div>

                <select
                  value={plantillaId}
                  onChange={(e) => setPlantillaId(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-xs font-semibold text-slate-800 bg-white focus:outline-hidden focus:border-brand-primary"
                  required
                  disabled={!equipoId}
                >
                  <option value="">
                    {!equipoId
                      ? "Primero seleccioná un equipo…"
                      : todasPlantillas.length === 0
                        ? "No hay plantillas disponibles"
                        : "Seleccionar checklist a aplicar…"}
                  </option>
                  {plantillasSugeridas.length > 0 && (
                    <optgroup label="Sugeridas para este tipo de equipo">
                      {plantillasSugeridas.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.titulo} ({p.tipo_equipo} ·{" "}
                          {p.ambito === "empresa" ? "Empresa" : "LT"})
                        </option>
                      ))}
                    </optgroup>
                  )}
                  {otrasPlantillas.length > 0 && (
                    <optgroup
                      label={
                        plantillasSugeridas.length > 0
                          ? "Otras plantillas disponibles"
                          : "Todas las plantillas"
                      }
                    >
                      {otrasPlantillas.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.titulo} ({p.tipo_equipo} ·{" "}
                          {p.ambito === "empresa" ? "Empresa" : "LT"})
                        </option>
                      ))}
                    </optgroup>
                  )}
                </select>

                {todasPlantillas.length === 0 &&
                  !loadingEmpresa &&
                  !loadingLt && (
                    <p className="mt-2 text-xs text-amber-600 bg-amber-50 p-2.5 rounded-xl border border-amber-200">
                      No tenés plantillas creadas todavía.{" "}
                      <Link
                        href="/checklists/plantillas/nueva"
                        className="underline font-bold text-amber-800"
                      >
                        Crear una plantilla
                      </Link>
                    </p>
                  )}
              </div>
            </div>

            {/* Paso 2: Calificación de Ítems */}
            {items.length > 0 && (
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-2xs space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                  <div>
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                      <ClipboardCheck className="h-4 w-4 text-brand-primary" />
                      2. Puntos de Inspección ({items.length})
                    </span>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Calificá cada punto según su condición actual observada en
                      la máquina.
                    </p>
                  </div>

                  {/* Botón rápido "Marcar todos Bien" */}
                  <button
                    type="button"
                    onClick={handleMarcarTodosBien}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-bold border border-emerald-200 transition-colors cursor-pointer shrink-0"
                    title="Acelera la carga marcando todos en Bien para luego modificar sólo los que tienen fallas"
                  >
                    <Check className="h-3.5 w-3.5 text-emerald-600" />
                    Marcar todos Conforme (Bien)
                  </button>
                </div>

                <div className="space-y-3">
                  {items.map((item, idx) => {
                    const esBien = item.calificacion === "bien";
                    const esReg = item.calificacion === "regular";
                    const esMal = item.calificacion === "mal";

                    const esAlta = item.criticidad === "alta";
                    const esMedia = item.criticidad === "media";

                    return (
                      <div
                        key={idx}
                        className={`rounded-xl border p-4 transition-all ${
                          esMal
                            ? "border-rose-300 bg-rose-50/40"
                            : esReg
                              ? "border-amber-300 bg-amber-50/30"
                              : "border-slate-200 bg-slate-50/40 hover:bg-white"
                        }`}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-xs font-bold text-slate-400 w-5">
                                #{idx + 1}
                              </span>
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
                                  Provoca Rechazo
                                </span>
                              )}
                            </div>
                            <p className="text-xs md:text-sm font-bold text-slate-900 leading-snug pl-7 sm:pl-0">
                              {item.texto}
                            </p>
                          </div>

                          {/* Botones de Calificación */}
                          <div className="inline-flex rounded-xl border border-slate-200 p-1 bg-white shrink-0 self-start sm:self-auto shadow-2xs">
                            <button
                              type="button"
                              onClick={() => {
                                const next = [...items];
                                next[idx] = {
                                  ...next[idx],
                                  calificacion: "bien",
                                };
                                setItems(next);
                              }}
                              className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                esBien
                                  ? "bg-emerald-600 text-white shadow-xs"
                                  : "text-slate-600 hover:text-emerald-700 hover:bg-emerald-50"
                              }`}
                            >
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              Bien
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                const next = [...items];
                                next[idx] = {
                                  ...next[idx],
                                  calificacion: "regular",
                                };
                                setItems(next);
                              }}
                              className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                esReg
                                  ? "bg-amber-500 text-white shadow-xs"
                                  : "text-slate-600 hover:text-amber-700 hover:bg-amber-50"
                              }`}
                            >
                              <AlertTriangle className="h-3.5 w-3.5" />
                              Regular
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                const next = [...items];
                                next[idx] = {
                                  ...next[idx],
                                  calificacion: "mal",
                                };
                                setItems(next);
                              }}
                              className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                esMal
                                  ? "bg-rose-600 text-white shadow-xs"
                                  : "text-slate-600 hover:text-rose-700 hover:bg-rose-50"
                              }`}
                            >
                              <XCircle className="h-3.5 w-3.5" />
                              Mal
                            </button>
                          </div>
                        </div>

                        {/* Botón sugerido para sumar acción correctiva si hay falla */}
                        {(esReg || esMal) && (
                          <div className="mt-2.5 pt-2.5 border-t border-slate-200/60 flex items-center justify-between text-xs">
                            <span className="text-[11px] text-slate-500 italic">
                              {esMal
                                ? "Falla detectada. Recomendado abrir una acción correctiva."
                                : "Observación menor detectada."}
                            </span>
                            <button
                              type="button"
                              onClick={() =>
                                handleAgregarAccionParaItem(item.texto)
                              }
                              className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-600 hover:text-blue-800 hover:underline"
                            >
                              <Plus className="h-3 w-3" />
                              Agregar al plan de acción
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Paso 3: Plan de Acción y Observaciones */}
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-2xs space-y-5">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                  <Clock className="h-4 w-4 text-brand-primary" />
                  3. Plan de Acción y Observaciones de Campo
                </span>
                <span className="text-[10px] font-bold text-slate-400">
                  Paso 3 de 3
                </span>
              </div>

              {/* Acciones Correctivas */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="block text-xs font-bold text-slate-800">
                      Plan de Acción Correctivo ({acciones.length})
                    </label>
                    <p className="text-[11px] text-slate-400">
                      Tareas de mantenimiento o reparación requeridas para
                      subsanar los desvíos.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      setAcciones([
                        ...acciones,
                        {
                          descripcion: "",
                          responsable: "",
                          fecha_vencimiento: "",
                        },
                      ])
                    }
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-blue-50 text-blue-700 hover:bg-blue-100 text-xs font-bold border border-blue-200 transition-colors cursor-pointer"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Nueva acción
                  </button>
                </div>

                {acciones.length === 0 ? (
                  <div className="p-4 rounded-xl border border-dashed border-slate-200 text-center text-xs text-slate-400">
                    No hay acciones correctivas cargadas todavía. Podés sumar
                    una si detectaste desvíos en el equipo.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {acciones.map((a, idx) => (
                      <div
                        key={idx}
                        className="rounded-xl border border-slate-200 p-3.5 space-y-2 bg-slate-50/50"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[10px] font-bold uppercase text-slate-400">
                            Acción #{idx + 1}
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              setAcciones(acciones.filter((_, i) => i !== idx))
                            }
                            className="p-1 text-slate-400 hover:text-rose-600 transition-colors"
                            title="Eliminar acción"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>

                        <input
                          value={a.descripcion}
                          onChange={(e) => {
                            const next = [...acciones];
                            next[idx] = {
                              ...next[idx],
                              descripcion: e.target.value,
                            };
                            setAcciones(next);
                          }}
                          placeholder="Descripción detallada de la reparación o tarea correctiva…"
                          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs bg-white focus:outline-hidden focus:border-brand-primary font-medium"
                          required
                        />

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <div>
                            <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                              Responsable asignado:
                            </label>
                            <input
                              value={a.responsable}
                              onChange={(e) => {
                                const next = [...acciones];
                                next[idx] = {
                                  ...next[idx],
                                  responsable: e.target.value,
                                };
                                setAcciones(next);
                              }}
                              placeholder="Ej: Mantenimiento Mecánico / Juan Pérez"
                              className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-xs bg-white focus:outline-hidden focus:border-brand-primary"
                            />
                          </div>

                          <div>
                            <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                              Fecha límite de cumplimiento:
                            </label>
                            <input
                              type="date"
                              value={a.fecha_vencimiento}
                              onChange={(e) => {
                                const next = [...acciones];
                                next[idx] = {
                                  ...next[idx],
                                  fecha_vencimiento: e.target.value,
                                };
                                setAcciones(next);
                              }}
                              className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-xs bg-white focus:outline-hidden focus:border-brand-primary"
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Observaciones Generales */}
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  Observaciones Generales de la Inspección
                </label>
                <textarea
                  value={observaciones}
                  onChange={(e) => setObservaciones(e.target.value)}
                  placeholder="Detalles sobre las condiciones de operación, carga, entorno de trabajo o recomendaciones para el supervisor…"
                  rows={3}
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-xs bg-white focus:outline-hidden focus:border-brand-primary leading-relaxed"
                />
              </div>

              {/* Botón de envío principal */}
              <button
                type="submit"
                disabled={
                  saving || !equipoId || !plantillaId || items.length === 0
                }
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-brand-primary hover:bg-brand-primary/95 text-white py-3.5 text-xs font-bold shadow-md disabled:opacity-50 cursor-pointer transition-all"
              >
                {saving ? (
                  <>
                    <Loader className="h-4 w-4 animate-spin" />
                    Registrando dictamen oficial…
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4" />
                    Guardar e emitir acta de inspección
                  </>
                )}
              </button>
            </div>
          </div>

          {/* COLUMNA DERECHA: Widget de Dictamen en Vivo (Sticky) */}
          <div className="lg:col-span-4 sticky top-6 space-y-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                  <Sparkles className="h-4 w-4 text-brand-primary" />
                  Dictamen preliminar en vivo
                </span>
                <span className="text-[10px] font-bold text-slate-400">
                  Simulación
                </span>
              </div>

              {items.length === 0 ? (
                <div className="text-center py-8 text-slate-400 space-y-2">
                  <ClipboardCheck className="h-8 w-8 mx-auto opacity-50" />
                  <p className="text-xs">
                    Seleccioná un checklist para ver el cálculo del dictamen en
                    vivo.
                  </p>
                </div>
              ) : (
                <>
                  {/* Badge de Dictamen Estimado */}
                  <div
                    className={`rounded-xl border p-4 text-center transition-all ${
                      dictamen.resultado === "aprobada"
                        ? "bg-emerald-50 border-emerald-300 text-emerald-950"
                        : dictamen.resultado === "observada"
                          ? "bg-amber-50 border-amber-300 text-amber-950"
                          : "bg-rose-50 border-rose-300 text-rose-950"
                    }`}
                  >
                    <div className="flex items-center justify-center gap-2 mb-1">
                      {dictamen.resultado === "aprobada" && (
                        <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                      )}
                      {dictamen.resultado === "observada" && (
                        <AlertTriangle className="h-5 w-5 text-amber-600" />
                      )}
                      {dictamen.resultado === "rechazada" && (
                        <ShieldAlert className="h-5 w-5 text-rose-600" />
                      )}
                      <strong className="text-sm font-black tracking-wide">
                        {dictamen.titulo}
                      </strong>
                    </div>
                    <p className="text-[11px] font-medium opacity-90 leading-snug">
                      {dictamen.subtitulo}
                    </p>
                  </div>

                  {/* Barra de Progreso de Conformidad */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-600">
                        Índice de conformidad
                      </span>
                      <strong className="font-black text-slate-900">
                        {dictamen.porcentajeConformidad}%
                      </strong>
                    </div>
                    <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                      <div
                        className={`h-full transition-all duration-300 ${
                          dictamen.porcentajeConformidad >= 80
                            ? "bg-emerald-500"
                            : dictamen.porcentajeConformidad >= 50
                              ? "bg-amber-500"
                              : "bg-rose-500"
                        }`}
                        style={{ width: `${dictamen.porcentajeConformidad}%` }}
                      />
                    </div>
                  </div>

                  {/* Desglose de Calificaciones */}
                  <div className="grid grid-cols-3 gap-2 text-center text-xs">
                    <div className="p-2 rounded-lg bg-emerald-50/70 border border-emerald-100">
                      <span className="text-[10px] uppercase font-bold text-emerald-600 block">
                        Bien
                      </span>
                      <strong className="text-base font-black text-emerald-700">
                        {dictamen.bienCount}
                      </strong>
                    </div>
                    <div className="p-2 rounded-lg bg-amber-50/70 border border-amber-100">
                      <span className="text-[10px] uppercase font-bold text-amber-600 block">
                        Regular
                      </span>
                      <strong className="text-base font-black text-amber-700">
                        {dictamen.regularCount}
                      </strong>
                    </div>
                    <div className="p-2 rounded-lg bg-rose-50/70 border border-rose-100">
                      <span className="text-[10px] uppercase font-bold text-rose-600 block">
                        Mal
                      </span>
                      <strong className="text-base font-black text-rose-700">
                        {dictamen.malCount}
                      </strong>
                    </div>
                  </div>

                  {/* Motivo Detallado */}
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 text-[11px] text-slate-600 leading-relaxed">
                    <strong>Criterio aplicado:</strong>{" "}
                    {dictamen.motivoDetallado}
                  </div>

                  {/* Botón rápido sticky */}
                  <button
                    type="submit"
                    disabled={
                      saving ||
                      !equipoId ||
                      !plantillaId ||
                      items.length === 0 ||
                      !inspectorNombre.trim()
                    }
                    className="w-full inline-flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-all disabled:opacity-50 cursor-pointer shadow-2xs"
                  >
                    {saving ? (
                      <Loader className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Check className="h-3.5 w-3.5" />
                    )}
                    Confirmar inspección
                  </button>
                </>
              )}
            </div>

            {/* Guía OSH de Buenas Prácticas */}
            <div className="p-4 rounded-2xl border border-blue-100 bg-blue-50/50 space-y-2 text-xs text-blue-900">
              <span className="font-bold flex items-center gap-1.5 text-blue-800">
                <Info className="h-4 w-4 shrink-0 text-blue-600" />
                Regla de Decisión Automática
              </span>
              <ul className="text-[11px] space-y-1 text-blue-800/90 list-disc pl-4 leading-relaxed">
                <li>
                  <strong>Rechazo directo:</strong> 1 o más ítems de criticidad{" "}
                  <em>Alta</em> calificados como <em>Mal</em>.
                </li>
                <li>
                  <strong>Observación:</strong> Ítems de criticidad{" "}
                  <em>Alta</em> en <em>Regular</em> o <em>Media</em> en{" "}
                  <em>Mal</em>.
                </li>
                <li>
                  Las tareas correctivas se sincronizan automáticamente con el
                  plan de acción general de la empresa.
                </li>
              </ul>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}

export default function NuevaInspeccionPage() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-col items-center justify-center py-24 text-slate-400 space-y-3">
          <Loader className="h-8 w-8 animate-spin text-brand-primary" />
          <p className="text-xs font-semibold">
            Cargando formulario de inspección…
          </p>
        </div>
      }
    >
      <NuevaInspeccionForm />
    </Suspense>
  );
}
