"use client";

import React from "react";
import dynamic from "next/dynamic";
import { Plus, Trash2 } from "lucide-react";
import { CapacitacionDiapositiva } from "@/types";

const RichTextEditor = dynamic(() => import("@/components/RichTextEditor"), {
  ssr: false,
  loading: () => (
    <div className="h-40 rounded-xl border border-slate-200 bg-slate-50 animate-pulse" />
  ),
});

interface DiapositivasEditorProps {
  diapositivas: CapacitacionDiapositiva[];
  onChange: (diapositivas: CapacitacionDiapositiva[]) => void;
  placeholder?: string;
}

export default function DiapositivasEditor({
  diapositivas,
  onChange,
  placeholder = "Contenido de la diapositiva (texto, imágenes, listas…)",
}: DiapositivasEditorProps) {
  const slides =
    diapositivas.length > 0 ? diapositivas : [{ contenido: "" }];

  const actualizar = (idx: number, contenido: string) => {
    const next = [...slides];
    next[idx] = { contenido };
    onChange(next);
  };

  const insertar = () => {
    onChange([...slides, { contenido: "" }]);
  };

  const eliminar = (idx: number) => {
    if (slides.length <= 1) return;
    onChange(slides.filter((_, i) => i !== idx));
  };

  return (
    <div className="space-y-4">
      <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
        Diapositivas de presentación
      </label>

      {slides.map((slide, idx) => (
        <div
          key={idx}
          className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 space-y-3"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-black text-slate-700 uppercase tracking-wider">
              Diapositiva {idx + 1}
            </span>
            {slides.length > 1 && (
              <button
                type="button"
                onClick={() => eliminar(idx)}
                className="inline-flex items-center gap-1.5 text-red-400 hover:text-red-600 text-[10px] font-bold uppercase px-2 py-1"
                title="Eliminar diapositiva"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Eliminar
              </button>
            )}
          </div>
          <RichTextEditor
            value={slide.contenido}
            onChange={(content) => actualizar(idx, content)}
            placeholder={placeholder}
          />
        </div>
      ))}

      <button
        type="button"
        onClick={insertar}
        className="w-full py-3.5 border-2 border-dashed border-slate-200 hover:border-blue-400 text-slate-500 hover:text-blue-600 font-bold rounded-xl text-xs transition-all flex items-center justify-center gap-2 bg-white"
      >
        <Plus className="h-4 w-4" />
        Insertar nueva diapositiva
      </button>
    </div>
  );
}
