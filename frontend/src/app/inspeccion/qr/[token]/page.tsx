"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import {
  AlertCircle,
  AlertTriangle,
  Building2,
  Check,
  CheckCircle2,
  ClipboardCheck,
  Info,
  Loader,
  MapPin,
  Plus,
  ShieldAlert,
  Sparkles,
  Tag,
  Trash2,
  User,
  Wrench,
  XCircle,
} from "lucide-react";
import { checklistsService } from "@/utils/services/checklists.service";
import { evaluarInspeccion } from "@/lib/inspeccionCalculos";
import type {
  CalificacionChecklist,
  ChecklistPlantilla,
  CriticidadChecklist,
} from "@/types";

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

function newIdempotencyKey() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export default function InspeccionQrPublicPage() {
  const params = useParams();
  const token = params.token as string;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [equipo, setEquipo] = useState<{
    id: string;
    nombre: string;
    tipo_equipo: string;
    empresa_nombre: string | null;
  } | null>(null);
  const [plantillas, setPlantillas] = useState<ChecklistPlantilla[]>([]);
  const [plantillaId, setPlantillaId] = useState("");
  const [inspectorNombre, setInspectorNombre] = useState("");
  const [items, setItems] = useState<ItemDraft[]>([]);
  const [acciones, setAcciones] = useState<AccionDraft[]>([]);
  const [observaciones, setObservaciones] = useState("");
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState<{ resultado: string } | null>(null);
  const [alertMsg, setAlertMsg] = useState<string | null>(null);
  const idempotencyKeyRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await checklistsService.equipoPorQr(token);
        if (cancelled) return;
        setEquipo(data.equipo);
        setPlantillas(data.plantillas);
      } catch (err: unknown) {
        const axiosErr = err as { response?: { data?: { error?: string } } };
        if (!cancelled) {
          setError(
            axiosErr.response?.data?.error ||
              "No se pudo cargar el equipo. Verificá que el código QR sea válido.",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  useEffect(() => {
    if (!plantillaId) {
      setItems([]);
      return;
    }
    const p = plantillas.find((x) => x.id === plantillaId);
    const src = p?.items || p?.checklist_plantilla_items || [];
    setItems(
      src.map((i) => ({
        texto: i.texto,
        criticidad: i.criticidad,
        calificacion: "bien" as const,
      })),
    );
    idempotencyKeyRef.current = null;
  }, [plantillaId, plantillas]);

  const dictamen = useMemo(() => {
    return evaluarInspeccion(items);
  }, [items]);

  const { plantillasSugeridas, otrasPlantillas } = useMemo(() => {
    if (!equipo?.tipo_equipo) {
      return { plantillasSugeridas: [], otrasPlantillas: plantillas };
    }
    const eqType = equipo.tipo_equipo.toLowerCase().trim();
    const sugeridas: ChecklistPlantilla[] = [];
    const otras: ChecklistPlantilla[] = [];

    for (const p of plantillas) {
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
  }, [equipo?.tipo_equipo, plantillas]);

  useEffect(() => {
    if (!plantillaId && plantillas.length > 0) {
      if (plantillasSugeridas.length === 1) {
        setPlantillaId(plantillasSugeridas[0].id);
      } else if (plantillasSugeridas.length === 0 && plantillas.length === 1) {
        setPlantillaId(plantillas[0].id);
      }
    }
  }, [plantillas, plantillasSugeridas, plantillaId]);

  const handleMarcarTodosBien = () => {
    setItems((prev) =>
      prev.map((it) => ({
        ...it,
        calificacion: "bien",
      })),
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inspectorNombre.trim() || !plantillaId || items.length === 0) {
      setAlertMsg("Completá tu nombre, seleccioná el checklist y calificá los ítems.");
      return;
    }
    const plantilla = plantillas.find((p) => p.id === plantillaId);
    if (!idempotencyKeyRef.current) {
      idempotencyKeyRef.current = newIdempotencyKey();
    }
    const idempotencyKey = idempotencyKeyRef.current;
    setSaving(true);
    setAlertMsg(null);
    try {
      if (items.length === 0) {
        setAlertMsg("La plantilla no tiene ítems cargados.");
        setSaving(false);
        return;
      }
      const result = await checklistsService.crearInspeccionPublica(token, {
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
        idempotency_key: idempotencyKey,
      });
      setDone({ resultado: result.resultado });
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: string } } };
      setAlertMsg(
        axiosErr.response?.data?.error ||
          "No se pudo registrar la inspección. Verificá tu conexión y reintentá.",
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-900 text-white p-4 space-y-3">
        <Loader className="h-10 w-10 animate-spin text-brand-secondary" />
        <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
          Identificando equipo mediante QR…
        </p>
      </div>
    );
  }

  if (error || !equipo) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900 px-4">
        <div className="max-w-sm w-full rounded-2xl bg-white p-6 text-center space-y-3 shadow-xl">
          <AlertCircle className="h-10 w-10 text-rose-500 mx-auto" />
          <h2 className="text-base font-bold text-slate-900">Código QR Inválido</h2>
          <p className="text-xs text-slate-600 leading-relaxed">
            {error || "No se encontró el equipo correspondiente a este código QR."}
          </p>
        </div>
      </div>
    );
  }

  if (done) {
    const res = done.resultado.toLowerCase();
    const esAprobada = res === "aprobada";
    const esObservada = res === "observada";

    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900 px-4 py-8">
        <div className="max-w-sm w-full rounded-3xl bg-white p-6 text-center space-y-4 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
          <div
            className={`w-14 h-14 rounded-2xl mx-auto flex items-center justify-center text-white ${
              esAprobada
                ? "bg-emerald-600"
                : esObservada
                  ? "bg-amber-600"
                  : "bg-rose-600"
            }`}
          >
            {esAprobada && <CheckCircle2 className="h-8 w-8" />}
            {esObservada && <AlertTriangle className="h-8 w-8" />}
            {!esAprobada && !esObservada && <ShieldAlert className="h-8 w-8" />}
          </div>

          <div>
            <span className="text-[10px] font-bold uppercase font-mono tracking-widest text-slate-400 block">
              REGISTRO CONFIRMADO
            </span>
            <h1 className="text-xl font-black text-slate-900 mt-1">
              Inspección Registrada
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              El dictamen oficial ha sido archivado exitosamente en el legajo técnico.
            </p>
          </div>

          <div
            className={`rounded-2xl p-4 border text-center ${
              esAprobada
                ? "bg-emerald-50 border-emerald-200 text-emerald-950"
                : esObservada
                  ? "bg-amber-50 border-amber-200 text-amber-950"
                  : "bg-rose-50 border-rose-200 text-rose-950"
            }`}
          >
            <div className="text-[10px] font-bold uppercase tracking-wider opacity-70">
              DICTAMEN OFICIAL
            </div>
            <div className="text-lg font-black mt-0.5">
              {esAprobada
                ? "APROBADA / APTO"
                : esObservada
                  ? "APROBADA CON OBS."
                  : "RECHAZADA / NO APTO"}
            </div>
          </div>

          <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-xs text-slate-600 space-y-1">
            <div className="font-bold text-slate-900">{equipo.nombre}</div>
            <div className="text-[11px] text-slate-500">
              {equipo.tipo_equipo} {equipo.empresa_nombre ? `· ${equipo.empresa_nombre}` : ""}
            </div>
            {inspectorNombre && (
              <div className="text-[10px] text-slate-400 pt-1 border-t border-slate-200/60">
                Auditor: {inspectorNombre}
              </div>
            )}
          </div>

          <p className="text-[11px] text-slate-400">
            Ya podés cerrar esta pestaña o realizar otra verificación.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 py-6 px-3 sm:px-4 text-slate-900">
      <div className="max-w-lg mx-auto space-y-4">
        {/* Chapa Técnica del Equipo */}
        <div className="rounded-2xl bg-white p-5 shadow-xl border-2 border-slate-800 space-y-2">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <span className="text-[10px] font-mono uppercase font-bold tracking-widest text-slate-400">
              LEGAJO TÉCNICO DIGITAL · QR INSPECCIÓN
            </span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-900">
              En campo
            </span>
          </div>

          <div>
            <h1 className="text-xl font-black text-slate-900 leading-tight">
              {equipo.nombre}
            </h1>
            <div className="flex flex-wrap items-center gap-1.5 mt-1">
              <span className="text-xs font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md">
                {equipo.tipo_equipo}
              </span>
              {equipo.empresa_nombre && (
                <span className="text-xs text-slate-500">
                  · {equipo.empresa_nombre}
                </span>
              )}
            </div>
          </div>
        </div>

        {alertMsg && (
          <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-xs font-medium text-amber-900 flex items-start gap-2 shadow-sm">
            <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
            <p>{alertMsg}</p>
          </div>
        )}

        <form
          onSubmit={(e) => void handleSubmit(e)}
          className="rounded-3xl bg-white p-5 sm:p-6 space-y-5 shadow-2xl"
        >
          {/* Identificación del Inspector */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Nombre y Apellido del Inspector / Operador *
            </label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                value={inspectorNombre}
                onChange={(e) => setInspectorNombre(e.target.value)}
                placeholder="Ej: Carlos Gómez (Operador Nave Central)"
                className="w-full rounded-xl border border-slate-200 pl-9 pr-3.5 py-2.5 text-xs font-medium text-slate-900 bg-slate-50 focus:bg-white focus:outline-hidden focus:border-brand-primary"
                required
              />
            </div>
          </div>

          {/* Selector de Checklist */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                Checklist a aplicar *
              </label>
              {equipo && plantillasSugeridas.length > 0 && (
                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                  {plantillasSugeridas.length} sugerida(s)
                </span>
              )}
            </div>
            <select
              value={plantillaId}
              onChange={(e) => setPlantillaId(e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-xs font-semibold text-slate-800 bg-slate-50 focus:bg-white focus:outline-hidden focus:border-brand-primary"
              required
            >
              <option value="">Seleccionar checklist…</option>
              {plantillasSugeridas.length > 0 && (
                <optgroup label="Sugeridas para este tipo de equipo">
                  {plantillasSugeridas.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.titulo} ({p.tipo_equipo})
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
                      {p.titulo} ({p.tipo_equipo})
                    </option>
                  ))}
                </optgroup>
              )}
            </select>
            {plantillas.length === 0 && (
              <p className="text-xs text-amber-600 mt-1">
                No hay plantillas disponibles para este equipo.
              </p>
            )}
          </div>

          {/* Puntos de Inspección */}
          {items.length > 0 && (
            <div className="space-y-3 pt-2 border-t border-slate-100">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-slate-800 uppercase tracking-wider block">
                    Puntos de Verificación ({items.length})
                  </span>
                  <span className="text-[11px] text-slate-400">
                    Tocá cada botón según la condición observada
                  </span>
                </div>

                <button
                  type="button"
                  onClick={handleMarcarTodosBien}
                  className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100 transition-colors"
                >
                  <Check className="h-3 w-3" />
                  Todos Bien
                </button>
              </div>

              {/* Dictamen Preliminar en tiempo real */}
              <div
                className={`rounded-xl p-3 border text-xs font-bold flex items-center justify-between ${
                  dictamen.resultado === "aprobada"
                    ? "bg-emerald-50 border-emerald-200 text-emerald-900"
                    : dictamen.resultado === "observada"
                      ? "bg-amber-50 border-amber-200 text-amber-900"
                      : "bg-rose-50 border-rose-200 text-rose-900"
                }`}
              >
                <div className="flex items-center gap-1.5">
                  {dictamen.resultado === "aprobada" && <CheckCircle2 className="h-4 w-4 text-emerald-600" />}
                  {dictamen.resultado === "observada" && <AlertTriangle className="h-4 w-4 text-amber-600" />}
                  {dictamen.resultado === "rechazada" && <ShieldAlert className="h-4 w-4 text-rose-600" />}
                  <span>Dictamen en vivo: {dictamen.titulo}</span>
                </div>
                <span>{dictamen.porcentajeConformidad}% conf.</span>
              </div>

              <div className="space-y-3">
                {items.map((item, idx) => {
                  const esBien = item.calificacion === "bien";
                  const esReg = item.calificacion === "regular";
                  const esMal = item.calificacion === "mal";
                  const esAlta = item.criticidad === "alta";

                  return (
                    <div
                      key={idx}
                      className={`rounded-2xl border p-3.5 space-y-2.5 transition-all ${
                        esMal
                          ? "border-rose-300 bg-rose-50/50"
                          : esReg
                            ? "border-amber-300 bg-amber-50/40"
                            : "border-slate-200 bg-slate-50/60"
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        <span className="font-mono text-xs font-bold text-slate-400 mt-0.5">
                          #{idx + 1}
                        </span>
                        <div className="flex-1">
                          <p className="text-xs font-bold text-slate-900 leading-snug">
                            {item.texto}
                          </p>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span
                              className={`text-[9px] font-bold uppercase px-1.5 py-0.2 rounded ${
                                esAlta
                                  ? "bg-rose-100 text-rose-800"
                                  : "bg-slate-200 text-slate-700"
                              }`}
                            >
                              {item.criticidad}
                            </span>
                            {esAlta && esMal && (
                              <span className="text-[10px] font-bold text-rose-700">
                                ⚠ Determina rechazo
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Botones Grandes Táctiles para Móvil */}
                      <div className="grid grid-cols-3 gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            const next = [...items];
                            next[idx] = { ...next[idx], calificacion: "bien" };
                            setItems(next);
                          }}
                          className={`py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1 ${
                            esBien
                              ? "bg-emerald-600 text-white shadow-xs"
                              : "bg-white text-slate-600 border border-slate-200"
                          }`}
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Bien
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            const next = [...items];
                            next[idx] = { ...next[idx], calificacion: "regular" };
                            setItems(next);
                          }}
                          className={`py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1 ${
                            esReg
                              ? "bg-amber-500 text-white shadow-xs"
                              : "bg-white text-slate-600 border border-slate-200"
                          }`}
                        >
                          <AlertTriangle className="h-3.5 w-3.5" />
                          Regular
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            const next = [...items];
                            next[idx] = { ...next[idx], calificacion: "mal" };
                            setItems(next);
                          }}
                          className={`py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1 ${
                            esMal
                              ? "bg-rose-600 text-white shadow-xs"
                              : "bg-white text-slate-600 border border-slate-200"
                          }`}
                        >
                          <XCircle className="h-3.5 w-3.5" />
                          Mal
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Plan de Acción Breve */}
          <div className="space-y-2 pt-2 border-t border-slate-100">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                Plan de acción correctivo
              </span>
              <button
                type="button"
                onClick={() =>
                  setAcciones([
                    ...acciones,
                    { descripcion: "", responsable: "", fecha_vencimiento: "" },
                  ])
                }
                className="inline-flex items-center gap-1 text-xs font-bold text-blue-600"
              >
                <Plus className="h-3.5 w-3.5" />
                Sumar tarea
              </button>
            </div>

            {acciones.map((a, idx) => (
              <div key={idx} className="flex gap-2">
                <input
                  value={a.descripcion}
                  onChange={(e) => {
                    const next = [...acciones];
                    next[idx] = { ...next[idx], descripcion: e.target.value };
                    setAcciones(next);
                  }}
                  placeholder="Describir acción correctiva…"
                  className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-xs bg-slate-50 focus:bg-white"
                />
                <button
                  type="button"
                  onClick={() =>
                    setAcciones(acciones.filter((_, i) => i !== idx))
                  }
                  className="p-2 text-slate-400 hover:text-rose-600"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>

          {/* Observaciones */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Observaciones de campo (opcional)
            </label>
            <textarea
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
              placeholder="Detalles adicionales observados durante la inspección…"
              rows={2}
              className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-xs bg-slate-50 focus:bg-white focus:outline-hidden focus:border-brand-primary"
            />
          </div>

          {/* Botón de Envío */}
          <button
            type="submit"
            disabled={saving || items.length === 0}
            className="w-full rounded-2xl bg-brand-primary hover:bg-brand-primary/95 text-white py-3.5 text-xs font-bold shadow-lg disabled:opacity-50 inline-flex items-center justify-center gap-2 transition-all cursor-pointer"
          >
            {saving ? (
              <>
                <Loader className="h-4 w-4 animate-spin" />
                Enviando inspección…
              </>
            ) : (
              <>
                <CheckCircle2 className="h-4 w-4" />
                Enviar inspección y dictamen
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
