"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  BookOpen,
  Building2,
  Check,
  CheckCircle2,
  ChevronDown,
  ClipboardCheck,
  Copy,
  Eye,
  FileCheck2,
  FileText,
  HelpCircle,
  Info,
  Loader,
  Plus,
  ShieldAlert,
  Sparkles,
  Trash2,
  Wrench,
  XCircle,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useAlert } from "@/context/AlertContext";
import {
  canPublishToBibliotecaLt,
  canWriteAppModule,
} from "@/lib/moduleAccess";
import { checklistsService } from "@/utils/services/checklists.service";
import type { ChecklistPlantilla, CriticidadChecklist, Equipo } from "@/types";
import { useQuery, useQueryClient } from "@tanstack/react-query";

type ItemDraft = {
  texto: string;
  criticidad: CriticidadChecklist;
};

// Modelos precargados estándar de Higiene y Seguridad
const PRESETS_MODELO: Array<{
  nombre: string;
  tipo: string;
  titulo: string;
  items: ItemDraft[];
}> = [
  {
    nombre: "Puente Grúa / Aparejos",
    tipo: "PUENTE DE 4 TN",
    titulo: "Control Diario y Operacional de Puente Grúa",
    items: [
      {
        texto: "Estado del cable de acero, pasteca y gancho con traba de seguridad en posición",
        criticidad: "alta",
      },
      {
        texto: "Funcionamiento de finales de carrera superior, inferior y traslación",
        criticidad: "alta",
      },
      {
        texto: "Botonera de mando / radiocontrol: pulsadores legibles y parada de emergencia operativa",
        criticidad: "alta",
      },
      {
        texto: "Frenos de elevación y traslación responden sin desplazamiento excesivo",
        criticidad: "alta",
      },
      {
        texto: "Baliza lumínica y señal acústica (sirena/bocina) de advertencia en funcionamiento",
        criticidad: "media",
      },
      {
        texto: "Cartelería de capacidad máxima de carga visible y legible",
        criticidad: "baja",
      },
    ],
  },
  {
    nombre: "Extintores Portátiles",
    tipo: "Extintor",
    titulo: "Inspección Mensual de Extintores Portátiles",
    items: [
      {
        texto: "Manómetro de presión en rango operativo (aguja en zona verde)",
        criticidad: "alta",
      },
      {
        texto: "Precinto de seguridad plástico y pasador metálico intactos sin violar",
        criticidad: "alta",
      },
      {
        texto: "Manguera, tobera y pico de descarga limpios, flexibles y sin fisuras",
        criticidad: "media",
      },
      {
        texto: "Vigencia de carga anual y prueba hidráulica (IRAM) al día en tarjeta",
        criticidad: "alta",
      },
      {
        texto: "Acceso despejado en radio de 1 metro, sin obstáculos que impidan el uso",
        criticidad: "media",
      },
      {
        texto: "Chapa baliza de señalización visible a distancia y altura reglamentaria",
        criticidad: "baja",
      },
    ],
  },
  {
    nombre: "Autoelevador / Clark",
    tipo: "Autoelevador",
    titulo: "Checklist Pre-Uso de Autoelevador",
    items: [
      {
        texto: "Frenos de servicio (pedal) y freno de mano / estacionamiento operativos",
        criticidad: "alta",
      },
      {
        texto: "Cinturón de seguridad funcional y estructura de protección antivuelco (ROPS)",
        criticidad: "alta",
      },
      {
        texto: "Alarma sonora de marcha atrás y baliza destellante estroboscópica funcionando",
        criticidad: "alta",
      },
      {
        texto: "Horquillas (uñas) sin fisuras ni desgaste excesivo en talón; cadenas lubricadas",
        criticidad: "alta",
      },
      {
        texto: "Cilindros hidráulicos de elevación e inclinación sin pérdidas de fluido",
        criticidad: "media",
      },
      {
        texto: "Matafuego reglamentario tipo ABC con carga vigente montado en cabina",
        criticidad: "media",
      },
    ],
  },
  {
    nombre: "Escalera Portátil",
    tipo: "Escalera",
    titulo: "Inspección de Seguridad para Escaleras Portátiles",
    items: [
      {
        texto: "Zapatas antideslizantes de goma en base completas y sin roturas",
        criticidad: "alta",
      },
      {
        texto: "Peldaños firmes, limpios, sin fisuras, deformaciones ni soldaduras caseras",
        criticidad: "alta",
      },
      {
        texto: "Tirantes o sistema de bloqueo de apertura (tijera) en buen estado",
        criticidad: "alta",
      },
      {
        texto: "Largueros rectos sin abolladuras, corrosión ni golpes estructurales",
        criticidad: "media",
      },
    ],
  },
];

export default function NuevaPlantillaChecklistPage() {
  const { user, empresa } = useAuth();
  const { showAlert } = useAlert();
  const router = useRouter();
  const queryClient = useQueryClient();
  const canWrite = canWriteAppModule(user, "checklists");
  const canLt = canPublishToBibliotecaLt(user);

  const [titulo, setTitulo] = useState("");
  const [tipoEquipo, setTipoEquipo] = useState("");
  const [guardarEmpresa, setGuardarEmpresa] = useState(true);
  const [enviarLt, setEnviarLt] = useState(false);
  const [items, setItems] = useState<ItemDraft[]>([
    { texto: "", criticidad: "alta" },
    { texto: "", criticidad: "media" },
    { texto: "", criticidad: "baja" },
  ]);
  const [saving, setSaving] = useState(false);

  // Consulta de equipos de la empresa para sugerencias de tipos de equipos
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
    // Añadir también los de los presets
    PRESETS_MODELO.forEach((p) => set.add(p.tipo));
    return Array.from(set);
  }, [equipos]);

  // Contadores por criticidad
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
        No tenés permiso para crear plantillas.
      </div>
    );
  }

  const handleCargarPreset = (preset: (typeof PRESETS_MODELO)[number]) => {
    setTitulo(preset.titulo);
    setTipoEquipo(preset.tipo);
    setItems(preset.items.map((i) => ({ ...i })));
    showAlert("info", "Modelo aplicado", `Se cargaron los ítems para ${preset.nombre}`);
  };

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
    const clon = { ...copia[index] };
    copia.splice(index + 1, 0, clon);
    setItems(copia);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!empresa?.id) return;
    const cleanItems = items
      .map((i) => ({ ...i, texto: i.texto.trim() }))
      .filter((i) => i.texto);

    if (!titulo.trim() || !tipoEquipo.trim() || cleanItems.length === 0) {
      showAlert(
        "warning",
        "Datos incompletos",
        "Completá título, tipo de equipo y al menos un ítem a verificar.",
      );
      return;
    }
    if (!guardarEmpresa && !enviarLt) {
      showAlert(
        "warning",
        "Destino requerido",
        "Elegí guardar en la biblioteca de la empresa y/o enviar a LT.",
      );
      return;
    }

    setSaving(true);
    try {
      let lastId: string | null = null;
      if (guardarEmpresa) {
        const p = await checklistsService.crearPlantilla({
          titulo: titulo.trim(),
          tipo_equipo: tipoEquipo.trim(),
          ambito: "empresa",
          empresa_id: empresa.id,
          items: cleanItems,
        });
        lastId = p.id;
      }
      if (enviarLt && canLt) {
        const p = await checklistsService.crearPlantilla({
          titulo: titulo.trim(),
          tipo_equipo: tipoEquipo.trim(),
          ambito: "global",
          items: cleanItems,
          publicar_directo: user?.rol === "admin",
        });
        lastId = p.id;
      }
      await queryClient.invalidateQueries({
        queryKey: ["checklist-plantillas-empresa"],
      });
      await queryClient.invalidateQueries({
        queryKey: ["checklist-plantillas-lt"],
      });
      showAlert("success", "Plantilla creada", "Se guardó correctamente.");
      router.push(
        lastId ? `/checklists/plantillas/${lastId}` : "/checklists/plantillas",
      );
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: string } } };
      showAlert(
        "error",
        "Error",
        axiosErr.response?.data?.error ||
          (err instanceof Error ? err.message : "No se pudo crear"),
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
            href="/checklists/plantillas"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-brand-primary mb-2 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Volver a plantillas
          </Link>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">
            Nueva plantilla de checklist
          </h1>
          <p className="text-sm text-brand-text-muted mt-1">
            Diseñá los puntos de control, su criticidad y visualizá en tiempo real cómo lo verá el inspector en planta.
          </p>
        </div>
      </div>

      {/* Barra de Presets Rápidos */}
      <div className="rounded-2xl border border-blue-100 bg-linear-to-r from-blue-50/70 via-indigo-50/40 to-slate-50 p-4 shadow-2xs">
        <div className="flex items-center gap-2 mb-2 text-xs font-bold text-blue-900">
          <Sparkles className="h-4 w-4 text-blue-600" />
          Plantillas sugeridas de Higiene y Seguridad (Habilitación con 1 clic):
        </div>
        <div className="flex flex-wrap gap-2">
          {PRESETS_MODELO.map((p) => (
            <button
              key={p.nombre}
              type="button"
              onClick={() => handleCargarPreset(p)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-blue-200 text-xs font-semibold text-slate-700 hover:border-blue-400 hover:text-blue-700 shadow-2xs transition-all cursor-pointer"
            >
              <FileCheck2 className="h-3.5 w-3.5 text-blue-600" />
              {p.nombre}
            </button>
          ))}
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
                  placeholder="Ej. Control Diario de Puente Grúa, Inspección de Autoelevador…"
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/10"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                  Tipo de equipo asignado <span className="text-rose-500">*</span>
                </label>
                <input
                  list="tipos-sugeridos-plantilla"
                  value={tipoEquipo}
                  onChange={(e) => setTipoEquipo(e.target.value)}
                  placeholder="Ej. PUENTE DE 4 TN, Extintor, Autoelevador, Escalera…"
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/10"
                  required
                />
                <datalist id="tipos-sugeridos-plantilla">
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
                    <strong>Alta:</strong> Si está &quot;Mal&quot;, rechaza la inspección y bloquea el equipo.
                  </div>
                </div>
                <div className="flex items-start gap-1.5 text-amber-700">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5 text-amber-600" />
                  <div>
                    <strong>Media:</strong> Si está &quot;Mal&quot;, genera observación y plan de acción.
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
                        placeholder={`Describí el punto a verificar (Ej. ${
                          idx === 0
                            ? "Estado del cable de acero y gancho con traba..."
                            : idx === 1
                              ? "Frenos de servicio y traslación..."
                              : "Señalización acústica y lumínica..."
                        })`}
                        className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/10 resize-none"
                        required
                      />

                      {/* Botones de acción del ítem */}
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

            {/* Tarjeta 3: Destino y Opciones */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs space-y-3">
              <h2 className="text-sm font-bold text-slate-900">
                Destino y publicación
              </h2>
              <div className="space-y-2.5">
                <label className="flex items-start gap-3 p-3 rounded-xl border border-slate-200 bg-slate-50/60 cursor-pointer hover:bg-slate-50">
                  <input
                    type="checkbox"
                    checked={guardarEmpresa}
                    onChange={(e) => setGuardarEmpresa(e.target.checked)}
                    className="mt-0.5 rounded text-brand-primary"
                  />
                  <div>
                    <span className="text-sm font-bold text-slate-900 block">
                      Guardar en la biblioteca de la empresa
                    </span>
                    <span className="text-xs text-slate-500">
                      Quedará disponible inmediatamente para todos los inspectores y equipos de esta empresa.
                    </span>
                  </div>
                </label>

                {canLt && (
                  <label className="flex items-start gap-3 p-3 rounded-xl border border-slate-200 bg-slate-50/60 cursor-pointer hover:bg-slate-50">
                    <input
                      type="checkbox"
                      checked={enviarLt}
                      onChange={(e) => setEnviarLt(e.target.checked)}
                      className="mt-0.5 rounded text-brand-primary"
                    />
                    <div>
                      <span className="text-sm font-bold text-slate-900 block">
                        Enviar a la biblioteca Legajo Técnico
                      </span>
                      <span className="text-xs text-slate-500">
                        {user?.rol === "admin"
                          ? "Se publicará como plantilla global del sistema."
                          : "Se enviará al CRM de la consultora para revisión y aprobación."}
                      </span>
                    </div>
                  </label>
                )}
              </div>
            </div>

            {/* Botones de Envío */}
            <div className="flex items-center gap-3">
              <Link
                href="/checklists/plantillas"
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
                Guardar plantilla
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
                      {guardarEmpresa ? "Empresa" : "LT"}
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
                  Las respuestas serán guardadas en el historial del equipo y podrán desencadenar planes de acción automáticos.
                </p>
              </div>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
