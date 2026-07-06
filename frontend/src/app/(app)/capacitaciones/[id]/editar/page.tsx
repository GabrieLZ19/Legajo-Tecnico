"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useRouter, useParams } from "next/navigation";
import { api } from "@/lib/api";
import {
  GraduationCap,
  ArrowLeft,
  Plus,
  Trash2,
  Save,
  HelpCircle,
  Calendar,
  X,
} from "lucide-react";
import Link from "next/link";
import { useAlert } from "@/context/AlertContext";

interface PreguntaForm {
  pregunta: string;
  opciones: string[];
  respuesta_correcta: number | number[];
  es_multiple?: boolean;
}

export default function EditarCapacitacionPage() {
  const { empresa } = useAuth();
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const { showAlert } = useAlert();

  const [titulo, setTitulo] = useState("");
  const [temario, setTemario] = useState("");
  const [fecha, setFecha] = useState("");
  const [preguntas, setPreguntas] = useState<PreguntaForm[]>([]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Biblioteca de plantillas personalizadas (localStorage)
  const [customTemplates, setCustomTemplates] = useState<Array<{ nombre: string; preguntas: PreguntaForm[] }>>([]);
  const [showSaveTemplateModal, setShowSaveTemplateModal] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState("");

  useEffect(() => {
    fetchCapacitacion();
    
    // Cargar plantillas
    const saved = localStorage.getItem("capacitaciones_templates");
    if (saved) {
      try {
        setCustomTemplates(JSON.parse(saved));
      } catch (err) {
        console.error("Error al cargar plantillas personalizadas:", err);
      }
    }
  }, [id]);

  const fetchCapacitacion = async () => {
    setLoading(true);
    try {
      const { data } = await api.get(`/capacitaciones/${id}`);
      if (data.estado !== "borrador") {
        setError("Solo se pueden editar capacitaciones en estado borrador.");
        return;
      }
      setTitulo(data.titulo);
      setTemario(data.temario || "");
      setFecha(data.fecha ? data.fecha.split("T")[0] : "");
      
      if (data.capacitacion_preguntas) {
        setPreguntas(
          data.capacitacion_preguntas.map((p: any) => {
            const esMult = p.respuesta_correcta && p.respuesta_correcta.startsWith("[");
            let resp;
            try {
              resp = esMult ? JSON.parse(p.respuesta_correcta) : Number(p.respuesta_correcta);
            } catch (e) {
              resp = p.respuesta_correcta;
            }
            return {
              pregunta: p.pregunta,
              opciones: p.opciones,
              respuesta_correcta: resp,
              es_multiple: esMult,
            };
          })
        );
      }
    } catch (err) {
      setError("Error al cargar los datos de la capacitación.");
    } finally {
      setLoading(false);
    }
  };

  const agregarPregunta = () => {
    setPreguntas([
      ...preguntas,
      { pregunta: "", opciones: ["", ""], respuesta_correcta: 0, es_multiple: false },
    ]);
  };

  const eliminarPregunta = (idx: number) => {
    setPreguntas(preguntas.filter((_, i) => i !== idx));
  };

  const actualizarPregunta = (idx: number, field: string, value: any) => {
    const updated = [...preguntas];
    (updated[idx] as any)[field] = value;
    setPreguntas(updated);
  };

  const toggleEsMultiple = (idx: number) => {
    const updated = [...preguntas];
    const wasMultiple = updated[idx].es_multiple || false;
    updated[idx].es_multiple = !wasMultiple;
    updated[idx].respuesta_correcta = !wasMultiple ? [0] : 0;
    setPreguntas(updated);
  };

  const toggleRespuestaCorrectaMultiple = (pregIdx: number, optIdx: number) => {
    const updated = [...preguntas];
    let current = Array.isArray(updated[pregIdx].respuesta_correcta)
      ? (updated[pregIdx].respuesta_correcta as number[])
      : [];

    if (current.includes(optIdx)) {
      current = current.filter((idx) => idx !== optIdx);
    } else {
      current.push(optIdx);
    }

    current.sort((a, b) => a - b);
    updated[pregIdx].respuesta_correcta = current;
    setPreguntas(updated);
  };

  const actualizarOpcion = (pregIdx: number, optIdx: number, value: string) => {
    const updated = [...preguntas];
    updated[pregIdx].opciones[optIdx] = value;
    setPreguntas(updated);
  };

  const agregarOpcion = (pregIdx: number) => {
    const updated = [...preguntas];
    updated[pregIdx].opciones.push("");
    setPreguntas(updated);
  };

  const eliminarOpcion = (pregIdx: number, optIdx: number) => {
    const updated = [...preguntas];
    if (updated[pregIdx].opciones.length <= 2) return;
    updated[pregIdx].opciones.splice(optIdx, 1);
    
    const currentCorrect = updated[pregIdx].respuesta_correcta;
    if (Array.isArray(currentCorrect)) {
      const filtered = currentCorrect
        .filter((idx) => idx !== optIdx)
        .map((idx) => (idx > optIdx ? idx - 1 : idx));
      updated[pregIdx].respuesta_correcta = filtered.length > 0 ? filtered : [0];
    } else {
      if (currentCorrect >= updated[pregIdx].opciones.length) {
        updated[pregIdx].respuesta_correcta = 0;
      }
    }
    setPreguntas(updated);
  };

  const cargarPlantilla = (tipo: "higiene" | "epp" | "incendios") => {
    const plantillas = {
      higiene: [
        {
          pregunta: "¿Cuál es la primera acción recomendada ante un accidente de trabajo?",
          opciones: ["Dar aviso inmediato al supervisor o preventor", "Intentar mover al accidentado", "Limpiar el área antes de llamar", "Retirarse a su domicilio"],
          respuesta_correcta: 0,
          es_multiple: false,
        },
        {
          pregunta: "¿Qué significan las siglas EPP?",
          opciones: ["Elementos de Protección Personal", "Estándares de Prevención Pública", "Equipos de Planificación Preventiva", "Ninguna de las anteriores"],
          respuesta_correcta: 0,
          es_multiple: false,
        },
        {
          pregunta: "¿Es obligatorio reportar los cuasi-accidentes (incidentes sin lesión)?",
          opciones: ["Sí, para investigar y prevenir futuros accidentes graves", "No, solo si hay heridos de gravedad", "Solo si el supervisor lo solicita", "Queda a criterio del empleado"],
          respuesta_correcta: 0,
          es_multiple: false,
        }
      ],
      epp: [
        {
          pregunta: "¿Quién es responsable del cuidado diario y conservación del EPP?",
          opciones: ["El propio trabajador que lo utiliza", "El área de compras de la empresa", "El preventor de Higiene y Seguridad", "El fabricante del equipo"],
          respuesta_correcta: 0,
          es_multiple: false,
        },
        {
          pregunta: "¿Cuándo debe reemplazarse un casco de seguridad?",
          opciones: ["Cuando sufra un impacto fuerte, grieta o desgaste severo", "Cada 10 años únicamente", "Cuando cambie de color por el sol", "No requiere reemplazo si se limpia bien"],
          respuesta_correcta: 0,
          es_multiple: false,
        },
        {
          pregunta: "¿Qué EPP es indispensable en tareas con riesgo de proyección de partículas?",
          opciones: ["Anteojos de seguridad con protección lateral", "Guantes de algodón simple", "Protección auditiva de copa", "Faja lumbar"],
          respuesta_correcta: 0,
          es_multiple: false,
        }
      ],
      incendios: [
        {
          pregunta: "¿Ante una evacuación por emergencia de incendio, qué está prohibido usar?",
          opciones: ["Los ascensores del edificio", "Las salidas de emergencia señalizadas", "Escaleras peatonales libres de humo", "El punto de encuentro designado"],
          respuesta_correcta: 0,
          es_multiple: false,
        },
        {
          pregunta: "¿Qué tipo de extintor es adecuado para fuegos eléctricos (Clase C)?",
          opciones: ["Extintor de Dióxido de Carbono (CO2)", "Polvo Químico ABC", "Agua presurizada común", "Extintor de espuma química AFFF"],
          respuesta_correcta: [0, 1],
          es_multiple: true,
        },
        {
          pregunta: "¿Qué indica la sigla ABC en un extintor de polvo químico seco?",
          opciones: ["Apto para fuegos de sólidos, líquidos e inflamables eléctricos", "Fuego de aceites vegetales únicamente", "Avisar, Buscar, Combatir", "Nivel de carga del extintor"],
          respuesta_correcta: 0,
          es_multiple: false,
        }
      ]
    };

    setPreguntas(plantillas[tipo]);
  };

  const handleSaveAsTemplate = () => {
    if (preguntas.length === 0) {
      showAlert("error", "Sin Preguntas", "Agregá al menos una pregunta para guardar como plantilla.");
      return;
    }
    setShowSaveTemplateModal(true);
  };

  const confirmarGuardarPlantilla = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTemplateName.trim()) return;

    const nuevaPlantilla = {
      nombre: newTemplateName.trim(),
      preguntas: preguntas.map((p) => ({
        pregunta: p.pregunta,
        opciones: p.opciones,
        respuesta_correcta: p.respuesta_correcta,
        es_multiple: p.es_multiple || false,
      })),
    };

    const updatedTemplates = [...customTemplates, nuevaPlantilla];
    setCustomTemplates(updatedTemplates);
    localStorage.setItem("capacitaciones_templates", JSON.stringify(updatedTemplates));
    setNewTemplateName("");
    setShowSaveTemplateModal(false);
    showAlert("success", "Plantilla Guardada", "La plantilla personalizada se guardó correctamente.");
  };

  const eliminarPlantillaPersonalizada = (nombre: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = customTemplates.filter((t) => t.nombre !== nombre);
    setCustomTemplates(updated);
    localStorage.setItem("capacitaciones_templates", JSON.stringify(updated));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!titulo.trim()) {
      setError("El título de la capacitación es obligatorio.");
      return;
    }

    // Validar preguntas
    for (let i = 0; i < preguntas.length; i++) {
      const p = preguntas[i];
      if (!p.pregunta.trim()) {
        setError(`La pregunta ${i + 1} no tiene texto.`);
        return;
      }
      if (p.opciones.length < 2) {
        setError(`La pregunta ${i + 1} necesita al menos 2 opciones.`);
        return;
      }
      for (let j = 0; j < p.opciones.length; j++) {
        if (!p.opciones[j].trim()) {
          setError(`La opción ${j + 1} de la pregunta ${i + 1} está vacía.`);
          return;
        }
      }
      if (p.es_multiple) {
        if (!Array.isArray(p.respuesta_correcta) || p.respuesta_correcta.length === 0) {
          setError(`La pregunta ${i + 1} (múltiple) debe tener al menos una respuesta correcta marcada.`);
          return;
        }
      }
    }

    setSaving(true);
    try {
      await api.put(`/capacitaciones/${id}`, {
        titulo,
        temario,
        fecha,
        preguntas: preguntas.map((p) => ({
          pregunta: p.pregunta,
          opciones: p.opciones,
          respuesta_correcta: Array.isArray(p.respuesta_correcta)
            ? JSON.stringify(p.respuesta_correcta)
            : String(p.respuesta_correcta),
        })),
      });

      showAlert("success", "Guardado", "La capacitación fue actualizada con éxito.");
      router.push(`/capacitaciones/${id}`);
    } catch (err: any) {
      setError(err.response?.data?.error || "Error al actualizar la capacitación.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[400px] flex flex-col items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-600"></div>
        <p className="text-xs text-slate-400 mt-3 font-semibold">Cargando capacitación...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href={`/capacitaciones/${id}`}
          className="h-10 w-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center hover:bg-slate-50 transition-colors cursor-pointer"
        >
          <ArrowLeft className="h-5 w-5 text-slate-600" />
        </Link>
        <div>
          <span className="text-sm font-semibold text-slate-500 flex items-center gap-1.5">
            <GraduationCap className="h-4 w-4" /> Capacitaciones
          </span>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">
            Modificar Capacitación y Test
          </h1>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <div className="rounded-xl bg-red-50 border border-red-100 p-4 text-sm text-red-800 font-semibold animate-in fade-in slide-in-from-top-3 duration-200">
            {error}
          </div>
        )}

        {/* Datos generales */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
          <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
            Información General
          </h2>

          <div className="space-y-2">
            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Título de la capacitación *
            </label>
            <input
              type="text"
              required
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Ej: Uso Correcto de EPP e Higiene"
              className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm font-medium focus:outline-hidden focus:ring-2 focus:ring-blue-500/25 focus:border-blue-500 transition-all bg-white text-slate-800"
            />
          </div>

          <div className="space-y-2">
            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Temario / Descripción
            </label>
            <textarea
              value={temario}
              onChange={(e) => setTemario(e.target.value)}
              placeholder="Detalles sobre lo que se va a capacitar..."
              rows={4}
              className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm font-medium focus:outline-hidden focus:ring-2 focus:ring-blue-500/25 focus:border-blue-500 transition-all resize-none bg-white text-slate-800"
            />
          </div>

          <div className="space-y-2">
            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
              <Calendar className="h-3 w-3" /> Fecha de Capacitación
            </label>
            <div
              onClick={(e) => {
                const input = e.currentTarget.querySelector('input[type="date"]');
                if (input) {
                  try {
                    (input as any).showPicker();
                  } catch (err) {}
                }
              }}
              className="flex items-center gap-2 pl-3.5 pr-3 py-3 border border-slate-200 rounded-xl bg-brand-input-bg text-slate-700 focus-within:ring-2 focus-within:ring-blue-600/25 focus-within:border-blue-600 transition-all cursor-pointer select-none"
            >
              <Calendar className="h-5 w-5 text-blue-600 shrink-0" />
              <input
                type="date"
                required
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
                onClick={(e) => {
                  e.stopPropagation();
                  try {
                    e.currentTarget.showPicker();
                  } catch (err) {}
                }}
                className="block flex-1 bg-transparent border-0 p-0 text-slate-700 focus:ring-0 focus:outline-hidden text-sm font-bold cursor-pointer"
              />
            </div>
          </div>
        </div>

        {/* Preguntas de evaluación */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-5">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                Preguntas de Evaluación
              </h2>
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mt-0.5">
                {preguntas.length} pregunta{preguntas.length !== 1 ? "s" : ""} cargada{preguntas.length !== 1 ? "s" : ""}
              </span>
            </div>
            {preguntas.length > 0 && (
              <button
                type="button"
                onClick={handleSaveAsTemplate}
                className="inline-flex items-center gap-1.5 px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold rounded-xl text-xs transition-all border border-emerald-150 cursor-pointer shadow-2xs shrink-0"
              >
                <Save className="h-3.5 w-3.5" />
                Guardar Plantilla
              </button>
            )}
          </div>

          {/* Sección de Plantillas */}
          <div className="space-y-3 pt-1 pb-3 border-b border-slate-50">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mr-2">Plantillas Estándar:</span>
              <button
                type="button"
                onClick={() => cargarPlantilla("higiene")}
                className="px-3.5 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 font-bold rounded-lg text-xs transition-colors cursor-pointer"
              >
                Higiene General
              </button>
              <button
                type="button"
                onClick={() => cargarPlantilla("epp")}
                className="px-3.5 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 font-bold rounded-lg text-xs transition-colors cursor-pointer"
              >
                Uso de EPP
              </button>
              <button
                type="button"
                onClick={() => cargarPlantilla("incendios")}
                className="px-3.5 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 font-bold rounded-lg text-xs transition-colors cursor-pointer"
              >
                Incendios y Evacuación
              </button>
            </div>

            {/* Mis Plantillas (LocalStorage) */}
            {customTemplates.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-dashed border-slate-100">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mr-2">Mis Plantillas:</span>
                {customTemplates.map((t, idx) => (
                  <div key={idx} className="inline-flex items-center gap-1.5 bg-blue-50 border border-blue-100 rounded-lg pl-3 pr-1.5 py-1 text-xs">
                    <button
                      type="button"
                      onClick={() => setPreguntas(t.preguntas)}
                      className="font-bold text-blue-700 hover:text-blue-800 transition-colors cursor-pointer"
                    >
                      {t.nombre}
                    </button>
                    <button
                      type="button"
                      onClick={(e) => eliminarPlantillaPersonalizada(t.nombre, e)}
                      className="text-blue-300 hover:text-red-500 font-bold p-0.5 rounded-full hover:bg-blue-100/50 transition-colors cursor-pointer"
                      title="Eliminar plantilla"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {preguntas.length === 0 && (
            <div className="text-center py-8">
              <HelpCircle className="h-10 w-10 text-slate-300 mx-auto mb-3" />
              <p className="text-sm text-slate-500 font-semibold">
                Agregá preguntas para evaluar a los empleados.
              </p>
              <p className="text-xs text-slate-400 mt-1">
                Las preguntas son opcionales y se mostrarán al trabajador tras escanear el QR.
              </p>
            </div>
          )}

          {preguntas.map((p, idx) => (
            <div
              key={idx}
              className="bg-slate-50 rounded-2xl p-5 space-y-4 border border-slate-100 shadow-xs"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-slate-700 uppercase tracking-wider">
                  Pregunta {idx + 1}
                </span>

                <div className="flex items-center gap-4">
                  <label className="inline-flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={p.es_multiple || false}
                      onChange={() => toggleEsMultiple(idx)}
                      className="h-4 w-4 text-blue-600 rounded-sm cursor-pointer"
                    />
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                      Múltiples correctas
                    </span>
                  </label>

                  <button
                    type="button"
                    onClick={() => eliminarPregunta(idx)}
                    className="text-red-400 hover:text-red-600 p-1 rounded-lg hover:bg-red-50 transition-colors cursor-pointer"
                    title="Eliminar pregunta"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <input
                type="text"
                value={p.pregunta}
                onChange={(e) =>
                  actualizarPregunta(idx, "pregunta", e.target.value)
                }
                placeholder="Escribí el enunciado de la pregunta..."
                className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm font-semibold bg-white text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-blue-500/25 focus:border-blue-500"
              />

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
                    Opciones de Respuesta ({p.es_multiple ? "marcar todas las correctas" : "marcar la correcta"})
                  </label>
                  <button
                    type="button"
                    onClick={() => agregarOpcion(idx)}
                    className="inline-flex items-center gap-1 text-[10px] font-black text-blue-600 hover:text-blue-700 uppercase tracking-wider cursor-pointer"
                  >
                    <Plus className="h-3 w-3" /> Agregar Opción
                  </button>
                </div>

                <div className="space-y-2">
                  {p.opciones.map((opt, optIdx) => {
                    const isSelected = p.es_multiple
                      ? Array.isArray(p.respuesta_correcta) &&
                        (p.respuesta_correcta as number[]).includes(optIdx)
                      : p.respuesta_correcta === optIdx;

                    return (
                      <div key={optIdx} className="flex items-center gap-3">
                        <input
                          type={p.es_multiple ? "checkbox" : "radio"}
                          name={`correcta-${idx}`}
                          checked={isSelected}
                          onChange={() => {
                            if (p.es_multiple) {
                              toggleRespuestaCorrectaMultiple(idx, optIdx);
                            } else {
                              actualizarPregunta(idx, "respuesta_correcta", optIdx);
                            }
                          }}
                          className="h-4 w-4 text-blue-600 cursor-pointer focus:ring-blue-500"
                        />
                        <input
                          type="text"
                          value={opt}
                          onChange={(e) =>
                            actualizarOpcion(idx, optIdx, e.target.value)
                          }
                          placeholder={`Opción ${optIdx + 1}`}
                          className="flex-1 px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm font-medium bg-white text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-blue-500/25 focus:border-blue-500"
                        />
                        {p.opciones.length > 2 && (
                          <button
                            type="button"
                            onClick={() => eliminarOpcion(idx, optIdx)}
                            className="text-slate-400 hover:text-red-500 p-1.5 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
                            title="Eliminar opción"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ))}

          <button
            type="button"
            onClick={agregarPregunta}
            className="w-full py-4 border-2 border-dashed border-slate-200 hover:border-blue-400 text-slate-500 hover:text-blue-600 font-bold rounded-2xl text-xs transition-all flex items-center justify-center gap-2 cursor-pointer bg-slate-50/50 hover:bg-blue-50/10"
          >
            <Plus className="h-4 w-4" />
            AGREGAR PREGUNTA DESDE CERO
          </button>
        </div>

        {/* Botón guardar */}
        <button
          type="submit"
          disabled={saving}
          className="w-full py-4 bg-brand-primary hover:bg-brand-primary/95 text-white font-bold rounded-xl shadow-md shadow-blue-900/10 hover:shadow-lg transition-all text-sm flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
        >
          <Save className="h-4 w-4" />
          {saving ? "Guardando..." : "Guardar Cambios"}
        </button>
      </form>

      {/* Modal para guardar como plantilla personalizada */}
      {showSaveTemplateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl border border-slate-100 flex flex-col space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider">Guardar como Plantilla</h3>
              <button
                type="button"
                onClick={() => setShowSaveTemplateModal(false)}
                className="text-slate-400 hover:text-slate-600 font-bold text-lg cursor-pointer"
              >
                &times;
              </button>
            </div>

            <form onSubmit={confirmarGuardarPlantilla} className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  Nombre de la plantilla *
                </label>
                <input
                  type="text"
                  required
                  value={newTemplateName}
                  onChange={(e) => setNewTemplateName(e.target.value)}
                  placeholder="Ej: Plantilla Básica de Alturas"
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm font-medium focus:outline-hidden focus:ring-2 focus:ring-blue-500/25 focus:border-blue-500"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowSaveTemplateModal(false)}
                  className="flex-1 py-2.5 border border-slate-200 text-slate-600 font-bold rounded-xl text-sm hover:bg-slate-50 transition-all cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-sm transition-all cursor-pointer"
                >
                  Guardar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
