"use client";

import React from "react";
import { Plus, Trash2, X } from "lucide-react";
import DiapositivasEditor from "@/components/DiapositivasEditor";
import { PreguntaPlantillaForm } from "@/hooks/useCapacitacionPlantillas";
import { CapacitacionDiapositiva } from "@/types";

interface CapacitacionPlantillaFormProps {
  titulo: string;
  diapositivas: CapacitacionDiapositiva[];
  preguntas: PreguntaPlantillaForm[];
  onTituloChange: (v: string) => void;
  onDiapositivasChange: (diapositivas: CapacitacionDiapositiva[]) => void;
  onPreguntasChange: (preguntas: PreguntaPlantillaForm[]) => void;
  error?: string | null;
}

export default function CapacitacionPlantillaForm({
  titulo,
  diapositivas,
  preguntas,
  onTituloChange,
  onDiapositivasChange,
  onPreguntasChange,
  error,
}: CapacitacionPlantillaFormProps) {
  const actualizarPregunta = (
    idx: number,
    field: keyof PreguntaPlantillaForm,
    value: PreguntaPlantillaForm[keyof PreguntaPlantillaForm],
  ) => {
    const updated = [...preguntas];
    updated[idx] = { ...updated[idx], [field]: value };
    onPreguntasChange(updated);
  };

  const toggleEsMultiple = (idx: number) => {
    const updated = [...preguntas];
    const wasMultiple = updated[idx].es_multiple || false;
    updated[idx].es_multiple = !wasMultiple;
    updated[idx].respuesta_correcta = !wasMultiple ? [0] : 0;
    onPreguntasChange(updated);
  };

  const toggleRespuestaCorrectaMultiple = (pregIdx: number, optIdx: number) => {
    const updated = [...preguntas];
    let current = Array.isArray(updated[pregIdx].respuesta_correcta)
      ? ([...updated[pregIdx].respuesta_correcta] as number[])
      : [];

    if (current.includes(optIdx)) {
      current = current.filter((i) => i !== optIdx);
    } else {
      current.push(optIdx);
    }
    current.sort((a, b) => a - b);
    updated[pregIdx].respuesta_correcta = current;
    onPreguntasChange(updated);
  };

  const actualizarOpcion = (pregIdx: number, optIdx: number, value: string) => {
    const updated = [...preguntas];
    updated[pregIdx].opciones[optIdx] = value;
    onPreguntasChange(updated);
  };

  const agregarOpcion = (pregIdx: number) => {
    const updated = [...preguntas];
    updated[pregIdx].opciones.push("");
    onPreguntasChange(updated);
  };

  const eliminarOpcion = (pregIdx: number, optIdx: number) => {
    const updated = [...preguntas];
    if (updated[pregIdx].opciones.length <= 2) return;
    updated[pregIdx].opciones.splice(optIdx, 1);
    onPreguntasChange(updated);
  };

  const agregarPregunta = () => {
    onPreguntasChange([
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
    onPreguntasChange(preguntas.filter((_, i) => i !== idx));
  };

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-xl bg-red-50 border border-red-100 p-4 text-sm text-red-800 font-semibold">
          {error}
        </div>
      )}

      <div className="bg-white rounded-2xl border border-slate-200 p-6 md:p-8 space-y-5">
        <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
          Información General
        </h2>

        <div className="space-y-2">
          <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
            Título *
          </label>
          <input
            type="text"
            required
            value={titulo}
            onChange={(e) => onTituloChange(e.target.value)}
            placeholder="Ej: Trabajos en Altura y Uso de Arnés"
            className="w-full px-4 py-3.5 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-blue-500 bg-white text-slate-800"
          />
        </div>

        <DiapositivasEditor
          diapositivas={diapositivas}
          onChange={onDiapositivasChange}
        />
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-6 md:p-8 space-y-5">
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
    </div>
  );
}
