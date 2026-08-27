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
import { CapacitacionDiapositiva } from "@/types";
import { deriveTemario } from "@/lib/cap-diapositivas";
import { useAuth } from "@/hooks/useAuth";
import { useAlert } from "@/context/AlertContext";
import {
  canPublishToBibliotecaLt,
  canWriteAppModule,
} from "@/lib/moduleAccess";

export default function NuevaPlantillaEmpresaPage() {
  const { empresa, user } = useAuth();
  const router = useRouter();
  const { showAlert } = useAlert();
  const { crearPlantilla } = useCapacitacionPlantillas();

  const [titulo, setTitulo] = useState("");
  const [diapositivas, setDiapositivas] = useState<CapacitacionDiapositiva[]>([
    { contenido: "" },
  ]);
  const [preguntas, setPreguntas] = useState<PreguntaPlantillaForm[]>([]);
  const [conEvaluacion, setConEvaluacion] = useState(true);
  const [guardarEnEmpresa, setGuardarEnEmpresa] = useState(true);
  const [guardarEnLt, setGuardarEnLt] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSaveEmpresa = canWriteAppModule(user, "capacitaciones");
  const canSaveLt = canPublishToBibliotecaLt(user);

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

    const quiereEmpresa = guardarEnEmpresa && canSaveEmpresa;
    const quiereLt = guardarEnLt && canSaveLt;

    if (!quiereEmpresa && !quiereLt) {
      setError("Elegí al menos un destino: biblioteca de la empresa o LT.");
      return;
    }
    if (quiereEmpresa && !empresa?.id) {
      setError("No hay empresa seleccionada.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const payload = {
        titulo: titulo.trim(),
        temario: deriveTemario(diapositivas),
        diapositivas,
        preguntas: conEvaluacion ? preguntas : [],
      };
      const destinos: string[] = [];

      if (quiereEmpresa) {
        await crearPlantilla({
          ambito: "empresa",
          empresa_id: empresa!.id,
          ...payload,
        });
        destinos.push("biblioteca de la empresa");
      }

      if (quiereLt) {
        await crearPlantilla({
          ambito: "global",
          ...payload,
        });
        destinos.push("biblioteca LT (pendiente de aprobación)");
      }

      showAlert(
        "success",
        "Éxito",
        `Plantilla guardada en ${destinos.join(" y ")}.`,
      );
      router.push("/capacitaciones/biblioteca");
    } catch (err: any) {
      setError(err.response?.data?.error || "Error al guardar.");
    } finally {
      setSaving(false);
    }
  };

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
            Nueva plantilla
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

        <div className="space-y-2">
          {canSaveEmpresa && (
            <label className="flex items-center gap-3 bg-slate-50 border border-slate-200 rounded-2xl p-4 cursor-pointer">
              <input
                type="checkbox"
                checked={guardarEnEmpresa}
                onChange={(e) => setGuardarEnEmpresa(e.target.checked)}
                className="h-4 w-4 text-blue-600 rounded-xs"
              />
              <span className="text-sm font-semibold text-slate-700">
                Guardar en biblioteca de la empresa
              </span>
            </label>
          )}
          {canSaveLt && (
            <label className="flex items-start gap-3 bg-indigo-50 border border-indigo-100 rounded-2xl p-4 cursor-pointer">
              <input
                type="checkbox"
                checked={guardarEnLt}
                onChange={(e) => setGuardarEnLt(e.target.checked)}
                className="h-4 w-4 text-indigo-600 rounded-xs mt-0.5"
              />
              <span className="text-sm font-semibold text-slate-700">
                Guardar en biblioteca LT
                <span className="block text-[11px] font-medium text-slate-500 mt-0.5">
                  Se envía a revisión del CRM antes de publicarse a los clientes.
                </span>
              </span>
            </label>
          )}
        </div>

        <button
          type="submit"
          disabled={saving || (!canSaveEmpresa && !canSaveLt)}
          className="w-full py-4 bg-brand-primary hover:bg-brand-primary/95 text-white font-bold rounded-xl shadow-md text-sm flex items-center justify-center gap-2 disabled:opacity-50 transition-all"
        >
          <Save className="h-4 w-4" />
          {saving ? "Guardando..." : "Guardar plantilla"}
        </button>
      </form>
    </div>
  );
}
