"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, BookOpen, Save } from "lucide-react";
import CapacitacionPlantillaForm from "@/components/CapacitacionPlantillaForm";
import {
  PreguntaPlantillaForm,
  useCapacitacionPlantillas,
} from "@/hooks/useCapacitacionPlantillas";
import { useAlert } from "@/context/AlertContext";

export default function NuevaPlantillaGlobalPage() {
  const router = useRouter();
  const { showAlert } = useAlert();
  const { crearPlantilla } = useCapacitacionPlantillas();
  const [titulo, setTitulo] = useState("");
  const [temario, setTemario] = useState("");
  const [preguntas, setPreguntas] = useState<PreguntaPlantillaForm[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!titulo.trim()) {
      setError("El título es obligatorio.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await crearPlantilla({
        ambito: "global",
        titulo: titulo.trim(),
        temario,
        preguntas,
      });
      showAlert("success", "Éxito", "Plantilla agregada a la biblioteca LT.");
      router.push("/admin/capacitaciones-biblioteca");
    } catch (err: any) {
      setError(err.response?.data?.error || "Error al guardar la plantilla.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-8 w-full">
      <div className="flex items-center gap-4">
        <Link
          href="/admin/capacitaciones-biblioteca"
          className="h-10 w-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center hover:bg-slate-50 shrink-0"
        >
          <ArrowLeft className="h-5 w-5 text-slate-600" />
        </Link>
        <div className="min-w-0">
          <span className="text-sm font-semibold text-slate-500 flex items-center gap-1.5">
            <BookOpen className="h-4 w-4" /> Biblioteca Capacitaciones
          </span>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">
            Nueva plantilla global
          </h1>
          <p className="text-sm font-medium text-slate-500 mt-1">
            Capacitación base disponible para todos los preventores.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <CapacitacionPlantillaForm
          titulo={titulo}
          temario={temario}
          preguntas={preguntas}
          onTituloChange={setTitulo}
          onTemarioChange={setTemario}
          onPreguntasChange={setPreguntas}
          error={error}
        />
        <div className="flex flex-col sm:flex-row gap-3 sm:justify-end">
          <Link
            href="/admin/capacitaciones-biblioteca"
            className="inline-flex items-center justify-center px-5 py-3 rounded-xl border border-slate-200 bg-white text-slate-700 font-bold text-sm hover:bg-slate-50"
          >
            Cancelar
          </Link>
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-brand-secondary hover:bg-brand-secondary/95 text-white font-bold rounded-xl shadow-md text-sm disabled:opacity-50 min-w-52"
          >
            <Save className="h-4 w-4" />
            {saving ? "Guardando..." : "Guardar en biblioteca LT"}
          </button>
        </div>
      </form>
    </div>
  );
}
