"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Loader, Plus, Trash2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useAlert } from "@/context/AlertContext";
import { canWriteAppModule } from "@/lib/moduleAccess";
import { checklistsService } from "@/utils/services/checklists.service";
import type {
  CalificacionChecklist,
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

function NuevaInspeccionForm() {
  const { user, empresa } = useAuth();
  const { showAlert } = useAlert();
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const canWrite = canWriteAppModule(user, "checklists");

  const preEquipoId = searchParams.get("equipoId") || "";

  const [equipoId, setEquipoId] = useState(preEquipoId);
  const [plantillaId, setPlantillaId] = useState("");
  const [items, setItems] = useState<ItemDraft[]>([]);
  const [acciones, setAcciones] = useState<AccionDraft[]>([]);
  const [observaciones, setObservaciones] = useState("");
  const [saving, setSaving] = useState(false);

  const { data: equipos = [] } = useQuery({
    queryKey: ["checklists-equipos", empresa?.id],
    queryFn: () => checklistsService.listarEquipos(empresa!.id),
    enabled: !!empresa?.id,
  });

  const equipo = useMemo(
    () => equipos.find((e) => e.id === equipoId),
    [equipos, equipoId],
  );

  const { data: plantillasEmpresa = [] } = useQuery({
    queryKey: [
      "checklist-plantillas-empresa",
      empresa?.id,
      equipo?.tipo_equipo,
    ],
    queryFn: () =>
      checklistsService.listarPlantillas({
        ambito: "empresa",
        empresaId: empresa!.id,
        tipo_equipo: equipo?.tipo_equipo,
      }),
    enabled: !!empresa?.id && !!equipo?.tipo_equipo,
  });

  const { data: plantillasLt = [] } = useQuery({
    queryKey: ["checklist-plantillas-lt", equipo?.tipo_equipo],
    queryFn: () =>
      checklistsService.listarPlantillas({
        ambito: "global",
        tipo_equipo: equipo?.tipo_equipo,
      }),
    enabled: !!equipo?.tipo_equipo,
  });

  const plantillas = [...plantillasEmpresa, ...plantillasLt];

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

  if (!canWrite) {
    return (
      <p className="text-center py-16 text-slate-500">
        No tenés permiso para crear inspecciones.
      </p>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!empresa?.id || !equipoId || !plantillaId || items.length === 0) {
      showAlert(
        "warning",
        "Datos incompletos",
        "Seleccioná equipo, plantilla y calificá los ítems.",
      );
      return;
    }
    const plantilla = plantillas.find((p) => p.id === plantillaId);
    setSaving(true);
    try {
      const insp = await checklistsService.crearInspeccion({
        empresa_id: empresa.id,
        equipo_id: equipoId,
        plantilla_id: plantillaId,
        plantilla_titulo: plantilla?.titulo || "Checklist",
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
        `Resultado: ${insp.resultado}`,
      );
      router.push(`/checklists/inspecciones/${insp.id}`);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: string } } };
      showAlert(
        "error",
        "Error",
        axiosErr.response?.data?.error ||
          (err instanceof Error ? err.message : "No se pudo guardar"),
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="w-full max-w-3xl space-y-6">
      <Link
        href="/checklists/inspecciones"
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-brand-primary"
      >
        <ArrowLeft className="h-4 w-4" />
        Inspecciones
      </Link>
      <div>
        <h1 className="text-3xl font-black text-slate-900 tracking-tight">
          Nueva inspección
        </h1>
        <p className="text-sm text-brand-text-muted mt-1">
          Calificá Bien / Regular / Mal. El resultado se calcula por criticidad
          y podés cargar un plan de acción.
        </p>
      </div>

      <form
        onSubmit={(e) => void handleSubmit(e)}
        className="rounded-2xl border border-slate-200 bg-white p-6 space-y-5 shadow-2xs"
      >
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">
            Equipo
          </label>
          <select
            value={equipoId}
            onChange={(e) => {
              setEquipoId(e.target.value);
              setPlantillaId("");
            }}
            className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
            required
          >
            <option value="">Seleccionar…</option>
            {equipos.map((eq) => (
              <option key={eq.id} value={eq.id}>
                {eq.nombre} ({eq.tipo_equipo})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">
            Checklist
          </label>
          <select
            value={plantillaId}
            onChange={(e) => setPlantillaId(e.target.value)}
            className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
            required
            disabled={!equipoId}
          >
            <option value="">Seleccionar…</option>
            {plantillas.map((p) => (
              <option key={p.id} value={p.id}>
                {p.titulo} ({p.ambito})
              </option>
            ))}
          </select>
        </div>

        {items.length > 0 && (
          <div className="space-y-3">
            <p className="text-sm font-medium text-slate-700">
              Calificación (Bien / Regular / Mal)
            </p>
            {items.map((item, idx) => (
              <div
                key={idx}
                className="rounded-xl border border-slate-100 bg-slate-50/70 p-3"
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <p className="text-sm text-slate-800">{item.texto}</p>
                  <span className="text-[10px] font-bold uppercase text-slate-500">
                    {item.criticidad}
                  </span>
                </div>
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
                      className={`flex-1 py-1.5 rounded-lg text-xs font-bold capitalize border ${
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
          </div>
        )}

        <div className="space-y-2 border-t border-slate-100 pt-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-slate-700">
              Plan de acción
            </p>
            <button
              type="button"
              onClick={() =>
                setAcciones([
                  ...acciones,
                  { descripcion: "", responsable: "", fecha_vencimiento: "" },
                ])
              }
              className="inline-flex items-center gap-1 text-sm text-blue-600 font-medium"
            >
              <Plus className="h-4 w-4" />
              Agregar
            </button>
          </div>
          {acciones.map((a, idx) => (
            <div
              key={idx}
              className="rounded-xl border border-slate-100 p-3 space-y-2"
            >
              <div className="flex gap-2">
                <input
                  value={a.descripcion}
                  onChange={(e) => {
                    const next = [...acciones];
                    next[idx] = { ...next[idx], descripcion: e.target.value };
                    setAcciones(next);
                  }}
                  placeholder="Descripción de la acción"
                  className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm"
                />
                <button
                  type="button"
                  onClick={() =>
                    setAcciones(acciones.filter((_, i) => i !== idx))
                  }
                  className="p-2 text-slate-400 hover:text-red-600"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input
                  value={a.responsable}
                  onChange={(e) => {
                    const next = [...acciones];
                    next[idx] = { ...next[idx], responsable: e.target.value };
                    setAcciones(next);
                  }}
                  placeholder="Responsable"
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                />
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
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                />
              </div>
            </div>
          ))}
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">
            Observaciones
          </label>
          <textarea
            value={observaciones}
            onChange={(e) => setObservaciones(e.target.value)}
            rows={3}
            className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
          />
        </div>

        <button
          type="submit"
          disabled={saving}
          className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-brand-primary hover:bg-brand-primary/95 text-white py-3 text-sm font-bold disabled:opacity-60 cursor-pointer"
        >
          {saving && <Loader className="h-4 w-4 animate-spin" />}
          Guardar inspección
        </button>
      </form>
    </div>
  );
}

export default function NuevaInspeccionPage() {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center py-20 text-slate-400">
          <Loader className="h-6 w-6 animate-spin" />
        </div>
      }
    >
      <NuevaInspeccionForm />
    </Suspense>
  );
}
