"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { Loader, Plus, Trash2 } from "lucide-react";
import { checklistsService } from "@/utils/services/checklists.service";
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
  // Fallback UUID v4-shaped (entornos sin crypto.randomUUID)
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
  /** Misma clave en reintentos de red → no duplica inspección. */
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
              "No se pudo cargar el equipo. Verificá el QR.",
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
    // Cambio de plantilla = nueva inspección lógica
    idempotencyKeyRef.current = null;
  }, [plantillaId, plantillas]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inspectorNombre.trim() || !plantillaId || items.length === 0) {
      setAlertMsg("Completá nombre, checklist y calificaciones.");
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
          "No se pudo registrar. Esperá unos segundos y tocá enviar de nuevo sin recargar la página.",
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader className="h-8 w-8 animate-spin text-slate-400" />
      </div>
    );
  }

  if (error || !equipo) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
        <p className="text-center text-slate-600 max-w-sm">
          {error || "Equipo no encontrado"}
        </p>
      </div>
    );
  }

  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
        <div className="max-w-sm w-full rounded-2xl border border-slate-200 bg-white p-6 text-center space-y-2">
          <h1 className="text-xl font-bold text-slate-900">
            Inspección registrada
          </h1>
          <p className="text-sm text-slate-600 capitalize">
            Resultado: <strong>{done.resultado}</strong>
          </p>
          <p className="text-xs text-slate-500">{equipo.nombre}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4">
      <div className="max-w-md mx-auto space-y-5">
        <div className="text-center">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
            Inspección por QR
          </p>
          <h1 className="text-xl font-bold text-slate-900 mt-1">
            {equipo.nombre}
          </h1>
          <p className="text-sm text-slate-500">
            {equipo.tipo_equipo}
            {equipo.empresa_nombre ? ` · ${equipo.empresa_nombre}` : ""}
          </p>
        </div>

        {alertMsg && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            {alertMsg}
          </div>
        )}

        <form
          onSubmit={(e) => void handleSubmit(e)}
          className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4"
        >
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Tu nombre
            </label>
            <input
              value={inspectorNombre}
              onChange={(e) => setInspectorNombre(e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Checklist
            </label>
            <select
              value={plantillaId}
              onChange={(e) => setPlantillaId(e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
              required
            >
              <option value="">Seleccionar…</option>
              {plantillas.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.titulo}
                </option>
              ))}
            </select>
            {plantillas.length === 0 && (
              <p className="text-xs text-amber-700 mt-1">
                No hay plantillas para este tipo de equipo. Creá una en la app.
              </p>
            )}
          </div>

          {items.map((item, idx) => (
            <div
              key={idx}
              className="rounded-xl border border-slate-100 bg-slate-50 p-3"
            >
              <p className="text-sm text-slate-800 mb-2">{item.texto}</p>
              <div className="flex gap-2">
                {(["bien", "regular", "mal"] as const).map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => {
                      const next = [...items];
                      next[idx] = { ...next[idx], calificacion: c };
                      setItems(next);
                    }}
                    className={`flex-1 py-2 rounded-lg text-xs font-bold capitalize border ${
                      item.calificacion === c
                        ? c === "bien"
                          ? "bg-emerald-600 text-white border-emerald-600"
                          : c === "regular"
                            ? "bg-amber-500 text-white border-amber-500"
                            : "bg-red-600 text-white border-red-600"
                        : "bg-white text-slate-600 border-slate-200"
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>
          ))}

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-slate-700">Plan de acción</p>
              <button
                type="button"
                onClick={() =>
                  setAcciones([
                    ...acciones,
                    { descripcion: "", responsable: "", fecha_vencimiento: "" },
                  ])
                }
                className="inline-flex items-center gap-1 text-sm text-blue-600"
              >
                <Plus className="h-4 w-4" />
                Agregar
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
                  placeholder="Acción"
                  className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm"
                />
                <button
                  type="button"
                  onClick={() =>
                    setAcciones(acciones.filter((_, i) => i !== idx))
                  }
                  className="p-2 text-slate-400"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>

          <textarea
            value={observaciones}
            onChange={(e) => setObservaciones(e.target.value)}
            placeholder="Observaciones (opcional)"
            rows={2}
            className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
          />

          <button
            type="submit"
            disabled={saving || items.length === 0}
            className="w-full rounded-xl bg-blue-600 text-white py-3 text-sm font-semibold disabled:opacity-60 inline-flex items-center justify-center gap-2"
          >
            {saving && <Loader className="h-4 w-4 animate-spin" />}
            Enviar inspección
          </button>
        </form>
      </div>
    </div>
  );
}
