"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  CheckCircle2,
  ClipboardCheck,
  Copy,
  Eye,
  FileText,
  Info,
  Loader,
  Plus,
  ShieldAlert,
  Trash2,
  Wrench,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useAlert } from "@/context/AlertContext";
import { canWriteAppModule } from "@/lib/moduleAccess";
import { checklistsService } from "@/utils/services/checklists.service";
import type { CriticidadChecklist, Equipo } from "@/types";

type ItemDraft = {
  id?: string;
  texto: string;
  criticidad: CriticidadChecklist;
};

export default function EditarPlantillaChecklistPage() {
  const params = useParams();
  const id = params.id as string;
  const { user, empresa } = useAuth();
  const { showAlert } = useAlert();
  const router = useRouter();
  const queryClient = useQueryClient();
  const canWrite = canWriteAppModule(user, "checklists");

  const [titulo, setTitulo] = useState("");
  const [tipoEquipo, setTipoEquipo] = useState("");
  const [items, setItems] = useState<ItemDraft[]>([]);
  const [saving, setSaving] = useState(false);

  // Obtener datos existentes de la plantilla
  const { data: plantilla, isLoading } = useQuery({
    queryKey: ["checklist-plantilla", id],
    queryFn: () => checklistsService.obtenerPlantilla(id),
    enabled: !!id,
  });

  // Equipos para sugerencias de tipo de equipo
  const { data: equipos = [] } = useQuery({
    queryKey: ["checklists-equipos", empresa?.id],
    queryFn: () => checklistsService.listarEquipos(empresa!.id),
    enabled: !!empresa?.id,
  });

  const tiposSugeridos = useMemo<string[]>(() => {
    const set = new Set<string>();
    equipos.forEach((e: Equipo) => {
      if (e.tipo_equipo?.trim()) set.add(e.tipo_equipo.trim());
    });
    return Array.from(set);
  }, [equipos]);

  // Cargar datos en el formulario cuando la plantilla se obtiene
  useEffect(() => {
    if (plantilla) {
      setTitulo(plantilla.titulo || "");
      setTipoEquipo(plantilla.tipo_equipo || "");
      const srcItems =
        plantilla.items || plantilla.checklist_plantilla_items || [];
      if (srcItems.length > 0) {
        setItems(
          srcItems.map((i) => ({
            id: i.id,
            texto: i.texto,
            criticidad: i.criticidad,
          })),
        );
      } else {
        setItems([{ texto: "", criticidad: "media" }]);
      }
    }
  }, [plantilla]);

  // Conteo de criticidades
  const conteoCriticidad = useMemo(() => {
    let alta = 0;
    let media = 0;
    let baja = 0;
    items.forEach((i) => {
      if (!i.texto.trim()) return;
      if (i.criticidad === "alta") alta++;
      if (i.criticidad === "media") media++;
      if (i.criticidad === "baja") baja++;
    });
    return { alta, media, baja, total: alta + media + baja };
  }, [items]);

  if (!canWrite) {
    return (
      <div className="p-12 text-center text-slate-500">
        No tenés permiso para editar plantillas.
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex justify-center py-24 text-slate-400">
        <Loader className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!plantilla) {
    return (
      <div className="p-12 text-center text-slate-500">
        Plantilla no encontrada.
      </div>
    );
  }

  const handleMoverItem = (index: number, direccion: "arriba" | "abajo") => {
    const nuevoIndex = direccion === "arriba" ? index - 1 : index + 1;
    if (nuevoIndex < 0 || nuevoIndex >= items.length) return;
    const copia = [...items];
    const [removido] = copia.splice(index, 1);
    copia.splice(nuevoIndex, 0, removido);
    setItems(copia);
  };

  const handleDuplicarItem = (index: number) => {
    const copia = [...items];
    const clon = { texto: copia[index].texto, criticidad: copia[index].criticidad };
    copia.splice(index + 1, 0, clon);
    setItems(copia);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanItems = items
      .map((i) => ({ texto: i.texto.trim(), criticidad: i.criticidad }))
      .filter((i) => i.texto);

    if (!titulo.trim() || !tipoEquipo.trim() || cleanItems.length === 0) {
      showAlert(
        "warning",
        "Datos incompletos",
        "Completá el título, tipo de equipo y al menos un ítem a verificar.",
      );
      return;
    }

    setSaving(true);
    try {
      await checklistsService.actualizarPlantilla(id, {
        titulo: titulo.trim(),
        tipo_equipo: tipoEquipo.trim(),
        items: cleanItems,
      });

      await queryClient.invalidateQueries({
        queryKey: ["checklist-plantilla", id],
      });
      await queryClient.invalidateQueries({
        queryKey: ["checklist-plantillas-empresa"],
      });
      await queryClient.invalidateQueries({
        queryKey: ["checklist-plantillas-lt"],
      });

      showAlert(
        "success",
        "Plantilla actualizada",
        "Los cambios se guardaron correctamente.",
      );
      router.push(`/checklists/plantillas/${id}`);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: string } } };
      showAlert(
        "error",
        "Error",
        axiosErr.response?.data?.error ||
          (err instanceof Error ? err.message : "No se pudo actualizar"),
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="w-full space-y-6">
      {/* Encabezado */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <Link
            href={`/checklists/plantillas/${id}`}
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-brand-primary mb-2 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Volver al detalle
          </Link>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-black text-slate-900 tracking-tight">
              Modificar plantilla
            </h1>
            <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-slate-100 text-slate-700">
              {plantilla.ambito === "empresa" ? "Empresa" : "LT Global"}
            </span>
          </div>
          <p className="text-sm text-brand-text-muted mt-1">
            Modificá el título, tipo de equipo, agregá nuevos puntos de control o ajustá las criticidades.
          </p>
        </div>
      </div>

      {/* Layout Split: Constructor a la izquierda + Live Preview a la derecha */}
      <form onSubmit={(e) => void handleSubmit(e)}>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Columna Constructor (7 de 12) */}
          <div className="lg:col-span-7 space-y-5">
            {/* Tarjeta 1: Información básica */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs space-y-4">
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <FileText className="h-4.5 w-4.5 text-brand-primary" />
                Datos generales
              </h2>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                  Título de la plantilla <span className="text-rose-500">*</span>
                </label>
                <input
                  value={titulo}
                  onChange={(e) => setTitulo(e.target.value)}
                  placeholder="Ej. Control Diario de Puente Grúa…"
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/10"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                  Tipo de equipo asignado <span className="text-rose-500">*</span>
                </label>
                <input
                  list="tipos-sugeridos-edit"
                  value={tipoEquipo}
                  onChange={(e) => setTipoEquipo(e.target.value)}
                  placeholder="Ej. PUENTE DE 4 TN, Extintor, Autoelevador…"
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/10"
                  required
                />
                <datalist id="tipos-sugeridos-edit">
                  {tiposSugeridos.map((t) => (
                    <option key={t} value={t} />
                  ))}
                </datalist>

                {tiposSugeridos.length > 0 && (
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <span className="text-xs text-slate-400">Sugerencias:</span>
                    {tiposSugeridos.slice(0, 5).map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setTipoEquipo(t)}
                        className={`text-xs px-2.5 py-1 rounded-lg border transition-colors ${
                          tipoEquipo === t
                            ? "bg-brand-primary text-white border-brand-primary font-bold"
                            : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                        }`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Tarjeta 2: Constructor de Ítems */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <ClipboardCheck className="h-4.5 w-4.5 text-brand-primary" />
                    Ítems de verificación ({items.length})
                  </h2>
                  <p className="text-xs text-brand-text-muted mt-0.5">
                    Definí cada elemento que el inspector deberá calificar (Bien / Regular / Mal).
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setItems([...items, { texto: "", criticidad: "media" }])
                  }
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold transition-colors cursor-pointer"
                >
                  <Plus className="h-4 w-4" />
                  Agregar ítem
                </button>
              </div>

              {/* Guía de criticidades */}
              <div className="grid grid-cols-3 gap-2 p-3 bg-slate-50 rounded-xl border border-slate-100 text-[11px]">
                <div className="flex items-start gap-1.5 text-rose-700">
                  <ShieldAlert className="h-3.5 w-3.5 shrink-0 mt-0.5 text-rose-600" />
                  <div>
                    <strong>Alta:</strong> Si falla, rechaza inspección y bloquea equipo.
                  </div>
                </div>
                <div className="flex items-start gap-1.5 text-amber-700">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5 text-amber-600" />
                  <div>
                    <strong>Media:</strong> Si falla, genera observación y plan de acción.
                  </div>
                </div>
                <div className="flex items-start gap-1.5 text-blue-700">
                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0 mt-0.5 text-blue-600" />
                  <div>
                    <strong>Baja:</strong> Falla menor o estética. Mantenimiento rutinario.
                  </div>
                </div>
              </div>

              {/* Lista editable de ítems */}
              <div className="space-y-3">
                {items.map((item, idx) => (
                  <div
                    key={idx}
                    className="group rounded-xl border border-slate-200 bg-white hover:border-slate-300 p-3.5 space-y-3 transition-all shadow-2xs"
                  >
                    <div className="flex items-start gap-2.5">
                      {/* Número de ítem */}
                      <span className="flex items-center justify-center h-6 w-6 rounded-lg bg-slate-100 text-slate-700 text-xs font-bold shrink-0 mt-1">
                        #{idx + 1}
                      </span>

                      {/* Texto del ítem */}
                      <textarea
                        value={item.texto}
                        onChange={(e) => {
                          const next = [...items];
                          next[idx] = { ...next[idx], texto: e.target.value };
                          setItems(next);
                        }}
                        rows={2}
                        placeholder="Describí el punto a verificar…"
                        className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/10 resize-none"
                        required
                      />

                      {/* Botones subir/bajar */}
                      <div className="flex flex-col gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleMoverItem(idx, "arriba")}
                          disabled={idx === 0}
                          className="p-1 rounded text-slate-400 hover:text-slate-700 disabled:opacity-20 cursor-pointer"
                          title="Subir"
                        >
                          <ArrowUp className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleMoverItem(idx, "abajo")}
                          disabled={idx === items.length - 1}
                          className="p-1 rounded text-slate-400 hover:text-slate-700 disabled:opacity-20 cursor-pointer"
                          title="Bajar"
                        >
                          <ArrowDown className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Selector visual de criticidad + botón duplicar/eliminar */}
                    <div className="flex items-center justify-between pt-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs text-slate-500 font-medium mr-1">
                          Criticidad:
                        </span>
                        {(["alta", "media", "baja"] as const).map((crit) => {
                          const isSelected = item.criticidad === crit;
                          return (
                            <button
                              key={crit}
                              type="button"
                              onClick={() => {
                                const next = [...items];
                                next[idx] = { ...next[idx], criticidad: crit };
                                setItems(next);
                              }}
                              className={`text-xs px-2.5 py-1 rounded-lg font-bold capitalize border transition-all cursor-pointer ${
                                isSelected
                                  ? crit === "alta"
                                    ? "bg-rose-600 text-white border-rose-600 shadow-2xs"
                                    : crit === "media"
                                      ? "bg-amber-500 text-white border-amber-500 shadow-2xs"
                                      : "bg-blue-600 text-white border-blue-600 shadow-2xs"
                                  : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                              }`}
                            >
                              {crit}
                            </button>
                          );
                        })}
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleDuplicarItem(idx)}
                          className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 cursor-pointer"
                          title="Duplicar ítem"
                        >
                          <Copy className="h-4 w-4" />
                        </button>
                        {items.length > 1 && (
                          <button
                            type="button"
                            onClick={() =>
                              setItems(items.filter((_, i) => i !== idx))
                            }
                            className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 cursor-pointer"
                            title="Eliminar ítem"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={() =>
                  setItems([...items, { texto: "", criticidad: "media" }])
                }
                className="w-full py-3 border-2 border-dashed border-slate-200 hover:border-brand-primary/40 rounded-xl text-xs font-bold text-slate-600 hover:text-brand-primary hover:bg-slate-50 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <Plus className="h-4 w-4" />
                Agregar otro ítem a la lista
              </button>
            </div>

            {/* Botones de Envío */}
            <div className="flex items-center gap-3">
              <Link
                href={`/checklists/plantillas/${id}`}
                className="flex-1 text-center py-3 rounded-xl border border-slate-200 bg-white text-slate-700 text-sm font-bold hover:bg-slate-50 transition-colors"
              >
                Cancelar
              </Link>
              <button
                type="submit"
                disabled={saving}
                className="flex-[2] inline-flex items-center justify-center gap-2 rounded-xl bg-brand-primary hover:bg-brand-primary/95 text-white py-3 text-sm font-bold shadow-sm hover:shadow-md transition-all disabled:opacity-60 cursor-pointer"
              >
                {saving && <Loader className="h-4 w-4 animate-spin" />}
                Guardar modificaciones
              </button>
            </div>
          </div>

          {/* Columna Live Preview (5 de 12 - Sticky) */}
          <div className="lg:col-span-5 sticky top-6 space-y-4">
            <div className="rounded-2xl border border-slate-200 bg-linear-to-b from-slate-50 to-white p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                  <Eye className="h-4 w-4 text-brand-primary" />
                  Vista previa en vivo (Hoja de inspección)
                </div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 bg-slate-200/60 px-2 py-0.5 rounded">
                  Inspector Móvil / Web
                </span>
              </div>

              {/* Simulación del formulario que verá el operario */}
              <div className="space-y-3">
                <div>
                  <h3 className="text-base font-black text-slate-900 leading-snug">
                    {titulo.trim() || "Título del checklist..."}
                  </h3>
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-blue-100 text-blue-800">
                      {tipoEquipo.trim() || "Tipo de equipo"}
                    </span>
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-slate-100 text-slate-600">
                      {plantilla.ambito === "empresa" ? "Empresa" : "LT"}
                    </span>
                  </div>
                </div>

                {/* Resumen de criticidades del preview */}
                <div className="flex items-center gap-2 py-2 px-3 rounded-xl bg-white border border-slate-200 text-xs font-medium text-slate-600 justify-between">
                  <span>Ítems: <strong>{conteoCriticidad.total}</strong></span>
                  <div className="flex items-center gap-1.5 text-[11px]">
                    <span className="text-rose-600 font-bold">{conteoCriticidad.alta} Alta</span>
                    <span>·</span>
                    <span className="text-amber-600 font-bold">{conteoCriticidad.media} Media</span>
                    <span>·</span>
                    <span className="text-blue-600 font-bold">{conteoCriticidad.baja} Baja</span>
                  </div>
                </div>

                {/* Lista simulada con botones interactivos */}
                <div className="space-y-2.5 max-h-[460px] overflow-y-auto pr-1">
                  {items.map((item, idx) => (
                    <div
                      key={idx}
                      className="rounded-xl border border-slate-200 bg-white p-3 space-y-2 shadow-2xs"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-xs font-semibold text-slate-800 leading-snug">
                          {idx + 1}. {item.texto.trim() || "(Ítem sin descripción)"}
                        </p>
                        <span
                          className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded ${
                            item.criticidad === "alta"
                              ? "bg-rose-100 text-rose-700"
                              : item.criticidad === "media"
                                ? "bg-amber-100 text-amber-700"
                                : "bg-blue-100 text-blue-700"
                          }`}
                        >
                          {item.criticidad}
                        </span>
                      </div>

                      {/* Botones simulados Bien / Regular / Mal */}
                      <div className="grid grid-cols-3 gap-1.5 pt-1">
                        <div className="py-1 rounded-lg text-center text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          Bien
                        </div>
                        <div className="py-1 rounded-lg text-center text-[11px] font-bold bg-slate-50 text-slate-500 border border-slate-200">
                          Regular
                        </div>
                        <div className="py-1 rounded-lg text-center text-[11px] font-bold bg-slate-50 text-slate-500 border border-slate-200">
                          Mal
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="p-3 bg-blue-50/60 rounded-xl border border-blue-100 text-xs text-blue-900 flex items-start gap-2">
                <Info className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
                <p className="text-[11px] leading-relaxed">
                  Las modificaciones afectarán a las nuevas inspecciones que se creen con esta plantilla. Las inspecciones pasadas mantendrán su histórico intacto.
                </p>
              </div>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
