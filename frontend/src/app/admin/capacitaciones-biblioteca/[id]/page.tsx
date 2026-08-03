"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, BookOpen, Save, Loader2 } from "lucide-react";
import CapacitacionPlantillaForm from "@/components/CapacitacionPlantillaForm";
import {
  PreguntaPlantillaForm,
  mapPlantillaPreguntasToForm,
  useCapacitacionPlantillas,
} from "@/hooks/useCapacitacionPlantillas";
import { CapacitacionDiapositiva } from "@/types";
import {
  deriveTemario,
  normalizeDiapositivas,
} from "@/lib/cap-diapositivas";
import { useAlert } from "@/context/AlertContext";

export default function EditarPlantillaGlobalPage() {
  const params = useParams();
  const id = String(params.id);
  const router = useRouter();
  const { showAlert } = useAlert();
  const { getPlantillaDetalle, actualizarPlantilla } =
    useCapacitacionPlantillas();

  const [titulo, setTitulo] = useState("");
  const [diapositivas, setDiapositivas] = useState<CapacitacionDiapositiva[]>([
    { contenido: "" },
  ]);
  const [preguntas, setPreguntas] = useState<PreguntaPlantillaForm[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getPlantillaDetalle(id)
      .then((data) => {
        setTitulo(data.titulo || "");
        setDiapositivas(
          normalizeDiapositivas(data.diapositivas, data.temario),
        );
        setPreguntas(
          mapPlantillaPreguntasToForm(
            data.capacitacion_plantilla_preguntas || [],
          ),
        );
      })
      .catch(() => setError("No se pudo cargar la plantilla."))
      .finally(() => setLoading(false));
  }, [id, getPlantillaDetalle]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!titulo.trim()) {
      setError("El título es obligatorio.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await actualizarPlantilla(id, {
        titulo: titulo.trim(),
        temario: deriveTemario(diapositivas),
        diapositivas,
        preguntas,
      });
      showAlert("success", "Éxito", "Plantilla actualizada.");
      router.push("/admin/capacitaciones-biblioteca");
    } catch (err: any) {
      setError(err.response?.data?.error || "Error al actualizar.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-slate-500 gap-2">
        <Loader2 className="h-5 w-5 animate-spin" />
        Cargando plantilla...
      </div>
    );
  }

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
            Editar plantilla
          </h1>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <CapacitacionPlantillaForm
          titulo={titulo}
          diapositivas={diapositivas}
          preguntas={preguntas}
          onTituloChange={setTitulo}
          onDiapositivasChange={setDiapositivas}
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
            {saving ? "Guardando..." : "Guardar cambios"}
          </button>
        </div>
      </form>
    </div>
  );
}
