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

export default function EditarPlantillaEmpresaPage() {
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
  const [conEvaluacion, setConEvaluacion] = useState(true);
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
        const preguntasForm = mapPlantillaPreguntasToForm(
          data.capacitacion_plantilla_preguntas || [],
        );
        setPreguntas(preguntasForm);
        setConEvaluacion(preguntasForm.length > 0);
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
    if (conEvaluacion && preguntas.length === 0) {
      setError(
        "Agregá al menos una pregunta, o elegí “Sin evaluación (solo firmar)”.",
      );
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await actualizarPlantilla(id, {
        titulo: titulo.trim(),
        temario: deriveTemario(diapositivas),
        diapositivas,
        preguntas: conEvaluacion ? preguntas : [],
      });
      showAlert("success", "Éxito", "Plantilla actualizada.");
      router.push("/capacitaciones/biblioteca");
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
        Cargando...
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      <div className="flex items-center gap-4">
        <Link
          href="/capacitaciones/biblioteca"
          className="h-10 w-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center hover:bg-slate-50 transition-colors shrink-0"
        >
          <ArrowLeft className="h-5 w-5 text-slate-600" />
        </Link>
        <div>
          <span className="text-sm font-semibold text-slate-500 flex items-center gap-1.5">
            <BookOpen className="h-4 w-4" /> Biblioteca empresa
          </span>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">
            Editar plantilla
          </h1>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3">
          <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
            Al finalizar la presentación
          </h2>
          <p className="text-xs text-slate-500 font-semibold">
            La plantilla puede incluir evaluación con preguntas, o solo firma
            de asistencia al usarla en una sesión.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setConEvaluacion(true)}
              className={`px-4 py-3 rounded-xl text-left border transition-all cursor-pointer ${
                conEvaluacion
                  ? "border-blue-500 bg-blue-50 text-blue-800"
                  : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
              }`}
            >
              <span className="block text-xs font-black uppercase tracking-wide">
                Con evaluación
              </span>
              <span className="block text-[11px] font-semibold mt-1 opacity-80">
                Datos → preguntas → firma
              </span>
            </button>
            <button
              type="button"
              onClick={() => {
                setConEvaluacion(false);
                setPreguntas([]);
              }}
              className={`px-4 py-3 rounded-xl text-left border transition-all cursor-pointer ${
                !conEvaluacion
                  ? "border-blue-500 bg-blue-50 text-blue-800"
                  : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
              }`}
            >
              <span className="block text-xs font-black uppercase tracking-wide">
                Sin evaluación
              </span>
              <span className="block text-[11px] font-semibold mt-1 opacity-80">
                Solo datos y firma de asistencia
              </span>
            </button>
          </div>
        </div>

        <CapacitacionPlantillaForm
          titulo={titulo}
          diapositivas={diapositivas}
          preguntas={preguntas}
          onTituloChange={setTitulo}
          onDiapositivasChange={setDiapositivas}
          onPreguntasChange={setPreguntas}
          showPreguntas={conEvaluacion}
          error={error}
        />
        <button
          type="submit"
          disabled={saving}
          className="w-full py-4 bg-brand-primary hover:bg-brand-primary/95 text-white font-bold rounded-xl shadow-md text-sm flex items-center justify-center gap-2 disabled:opacity-50 transition-all"
        >
          <Save className="h-4 w-4" />
          {saving ? "Guardando..." : "Guardar cambios"}
        </button>
      </form>
    </div>
  );
}
