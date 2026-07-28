"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useRouter } from "next/navigation";
import { Capacitacion } from "@/types";
import {
  GraduationCap,
  ArrowLeft,
  Plus,
  Trash2,
  Save,
  Calendar,
  X,
  BookOpen,
} from "lucide-react";
import Link from "next/link";
import { useAlert } from "@/context/AlertContext";
import RichTextEditor from "@/components/RichTextEditor";
import { useCapacitaciones } from "@/hooks/useCapacitaciones";

interface PreguntaForm {
  pregunta: string;
  opciones: string[];
  respuesta_correcta: number | number[];
  es_multiple?: boolean;
}

export default function NuevaCapacitacionPage() {
  const { empresa } = useAuth();
  const { showAlert } = useAlert();
  const router = useRouter();
  const { getCapacitaciones, getCapacitacionDetalle, crearCapacitacion } =
    useCapacitaciones();

  const [modoOrigen, setModoOrigen] = useState<"cero" | "biblioteca">("cero");
  const [bibliotecaCapacitaciones, setBibliotecaCapacitaciones] = useState<
    Capacitacion[]
  >([]);
  const [selectedCapacitacionId, setSelectedCapacitacionId] =
    useState<string>("");

  const [titulo, setTitulo] = useState("");
  const [temario, setTemario] = useState("");
  const [fecha, setFecha] = useState(new Date().toISOString().split("T")[0]);
  const [preguntas, setPreguntas] = useState<PreguntaForm[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Cargar capacitaciones previas para la biblioteca
  useEffect(() => {
    if (empresa?.id) {
      getCapacitaciones(empresa.id)
        .then((data) => {
          setBibliotecaCapacitaciones(data || []);
        })
        .catch(console.error);
    }
  }, [empresa?.id, getCapacitaciones]);

  // Al seleccionar de la biblioteca, cargar Título, Temario (RichText/HTML) y Preguntas
  const handleSeleccionarDeBiblioteca = async (capId: string) => {
    setSelectedCapacitacionId(capId);
    if (!capId) return;

    try {
      const data = await getCapacitacionDetalle(capId);
      if (data) {
        setTitulo(data.titulo || "");
        setTemario(data.temario || ""); // <--- Se envía a RichTextEditor y el useEffect actualiza el editor
        if (data.capacitacion_preguntas) {
          setPreguntas(
            data.capacitacion_preguntas.map((p: any) => {
              const esMult =
                typeof p.respuesta_correcta === "string" &&
                p.respuesta_correcta.startsWith("[");
              let resp;
              try {
                resp = esMult
                  ? JSON.parse(p.respuesta_correcta)
                  : Number(p.respuesta_correcta);
              } catch (e) {
                resp = p.respuesta_correcta;
              }
              return {
                pregunta: p.pregunta || p.enunciado,
                opciones: p.opciones,
                respuesta_correcta: resp,
                es_multiple: esMult,
              };
            }),
          );
        }
        showAlert(
          "success",
          "Cargada",
          "Capacitación, temario e imágenes importados correctamente.",
        );
      }
    } catch (err) {
      showAlert("error", "Error", "No se pudo cargar la capacitación elegida.");
    }
  };

  const agregarPregunta = () => {
    setPreguntas([
      ...preguntas,
      {
        pregunta: "",
        opciones: ["", ""],
        respuesta_correcta: 0,
        es_multiple: false,
      },
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
    setPreguntas(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!titulo.trim()) {
      setError("El título de la capacitación es obligatorio.");
      return;
    }

    setSaving(true);
    try {
      await crearCapacitacion({
        empresa_id: empresa!.id,
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

      showAlert(
        "success",
        "Éxito",
        "Capacitación creada y añadida a la biblioteca.",
      );
      router.push("/capacitaciones");
    } catch (err: any) {
      setError(err.response?.data?.error || "Error al crear la capacitación.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-8 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href="/capacitaciones"
          className="h-10 w-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center hover:bg-slate-50 transition-colors cursor-pointer"
        >
          <ArrowLeft className="h-5 w-5 text-slate-600" />
        </Link>
        <div>
          <span className="text-sm font-semibold text-slate-500 flex items-center gap-1.5">
            <GraduationCap className="h-4 w-4" /> Capacitaciones
          </span>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">
            Nueva Capacitación
          </h1>
        </div>
      </div>

      {/* Selector de Modo */}
      <div className="grid grid-cols-2 gap-3 bg-slate-100 p-1.5 rounded-2xl border border-slate-200">
        <button
          type="button"
          onClick={() => {
            setModoOrigen("cero");
            setTitulo("");
            setTemario("");
            setPreguntas([]);
          }}
          className={`py-3 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer ${
            modoOrigen === "cero"
              ? "bg-white text-blue-600 shadow-xs"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          <Plus className="h-4 w-4" />
          Crear desde Cero
        </button>

        <button
          type="button"
          onClick={() => setModoOrigen("biblioteca")}
          className={`py-3 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer ${
            modoOrigen === "biblioteca"
              ? "bg-white text-blue-600 shadow-xs"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          <BookOpen className="h-4 w-4" />
          Seleccionar de Biblioteca
        </button>
      </div>

      {/* Selector de Biblioteca */}
      {modoOrigen === "biblioteca" && (
        <div className="bg-blue-50 border border-blue-100 p-5 rounded-2xl space-y-3 animate-in fade-in duration-200">
          <label className="text-xs font-bold text-blue-900 uppercase tracking-wider block">
            Elegir de capacitaciones guardadas:
          </label>
          <select
            value={selectedCapacitacionId}
            onChange={(e) => handleSeleccionarDeBiblioteca(e.target.value)}
            className="w-full px-4 py-3 bg-white border border-blue-200 rounded-xl text-sm font-semibold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
          >
            <option value="">-- Seleccionar capacitación guardada --</option>
            {bibliotecaCapacitaciones.map((cap) => (
              <option key={cap.id} value={cap.id}>
                {cap.titulo} (
                {cap.fecha ? cap.fecha.split("T")[0] : "Sin fecha"})
              </option>
            ))}
          </select>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <div className="rounded-xl bg-red-50 border border-red-100 p-4 text-sm text-red-800 font-semibold">
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
              placeholder="Ej: Trabajos en Altura y Uso de Arnés"
              className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-blue-500 bg-white text-slate-800"
            />
          </div>

          <div className="space-y-2">
            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
              Temario / Descripción (soporta imágenes y formato)
            </label>
            <RichTextEditor
              value={temario}
              onChange={(content) => setTemario(content)}
              placeholder="Escribí o pegá aquí el temario completo de la capacitación con sus imágenes y diagramas..."
            />
          </div>

          <div className="space-y-2">
            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
              <Calendar className="h-3 w-3" /> Fecha de Capacitación
            </label>
            <input
              type="date"
              required
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 bg-white"
            />
          </div>
        </div>

        {/* Preguntas de evaluación */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-5">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
              Preguntas de Evaluación ({preguntas.length})
            </h2>
          </div>

          {preguntas.map((p, idx) => (
            <div
              key={idx}
              className="bg-slate-50 rounded-2xl p-5 space-y-4 border border-slate-100"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-slate-700 uppercase">
                  Pregunta {idx + 1}
                </span>

                <div className="flex items-center gap-4">
                  <label className="inline-flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={p.es_multiple || false}
                      onChange={() => toggleEsMultiple(idx)}
                      className="h-4 w-4 text-blue-600 rounded-xs"
                    />
                    <span className="text-[10px] font-bold text-slate-500 uppercase">
                      Múltiples correctas
                    </span>
                  </label>

                  <button
                    type="button"
                    onClick={() => eliminarPregunta(idx)}
                    className="text-red-400 hover:text-red-600 p-1"
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
                placeholder="Enunciado de la pregunta..."
                className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm font-semibold bg-white text-slate-800"
              />

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-black text-slate-400 uppercase">
                    Opciones de Respuesta
                  </label>
                  <button
                    type="button"
                    onClick={() => agregarOpcion(idx)}
                    className="inline-flex items-center gap-1 text-[10px] font-black text-blue-600 uppercase"
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
                              actualizarPregunta(
                                idx,
                                "respuesta_correcta",
                                optIdx,
                              );
                            }
                          }}
                          className="h-4 w-4 text-blue-600"
                        />
                        <input
                          type="text"
                          value={opt}
                          onChange={(e) =>
                            actualizarOpcion(idx, optIdx, e.target.value)
                          }
                          placeholder={`Opción ${optIdx + 1}`}
                          className="flex-1 px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm font-medium bg-white text-slate-700"
                        />
                        {p.opciones.length > 2 && (
                          <button
                            type="button"
                            onClick={() => eliminarOpcion(idx, optIdx)}
                            className="text-slate-400 hover:text-red-500 p-1.5"
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
            className="w-full py-4 border-2 border-dashed border-slate-200 hover:border-blue-400 text-slate-500 hover:text-blue-600 font-bold rounded-2xl text-xs transition-all flex items-center justify-center gap-2 bg-slate-50/50"
          >
            <Plus className="h-4 w-4" />
            AGREGAR PREGUNTA
          </button>
        </div>

        {/* Botón guardar */}
        <button
          type="submit"
          disabled={saving}
          className="w-full py-4 bg-brand-primary hover:bg-brand-primary/95 text-white font-bold rounded-xl shadow-md transition-all text-sm flex items-center justify-center gap-2 disabled:opacity-50"
        >
          <Save className="h-4 w-4" />
          {saving ? "Guardando..." : "Guardar Capacitación en Biblioteca"}
        </button>
      </form>
    </div>
  );
}
