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
import { useAuth } from "@/hooks/useAuth";
import { useAlert } from "@/context/AlertContext";

export default function NuevaPlantillaEmpresaPage() {
  const { empresa } = useAuth();
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
    if (!empresa?.id) {
      setError("No hay empresa seleccionada.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await crearPlantilla({
        ambito: "empresa",
        empresa_id: empresa.id,
        titulo: titulo.trim(),
        temario,
        preguntas,
      });
      showAlert("success", "Éxito", "Plantilla guardada en la biblioteca.");
      router.push("/capacitaciones/biblioteca");
    } catch (err: any) {
      setError(err.response?.data?.error || "Error al guardar.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 w-full">
      <div className="flex items-center gap-4">
        <Link
          href="/capacitaciones/biblioteca"
          className="h-10 w-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center hover:bg-slate-50 shrink-0"
        >
          <ArrowLeft className="h-5 w-5 text-slate-600" />
        </Link>
        <div>
          <span className="text-sm font-semibold text-slate-500 flex items-center gap-1.5">
            <BookOpen className="h-4 w-4" /> Biblioteca empresa
          </span>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">
            Nueva plantilla
          </h1>
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
        <button
          type="submit"
          disabled={saving}
          className="w-full py-4 bg-brand-primary text-white font-bold rounded-xl shadow-md text-sm flex items-center justify-center gap-2 disabled:opacity-50"
        >
          <Save className="h-4 w-4" />
          {saving ? "Guardando..." : "Guardar en biblioteca"}
        </button>
      </form>
    </div>
  );
}
