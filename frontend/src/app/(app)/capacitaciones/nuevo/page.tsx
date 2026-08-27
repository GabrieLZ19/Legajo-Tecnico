"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useRouter } from "next/navigation";
import { CapacitacionDiapositiva, CapacitacionPlantilla } from "@/types";
import {
  GraduationCap,
  ArrowLeft,
  Plus,
  Save,
  Calendar,
  BookOpen,
  Building2,
} from "lucide-react";
import Link from "next/link";
import { useAlert } from "@/context/AlertContext";
import CapacitacionPlantillaForm from "@/components/CapacitacionPlantillaForm";
import { useCapacitaciones } from "@/hooks/useCapacitaciones";
import {
  PreguntaPlantillaForm,
  mapPlantillaPreguntasToForm,
  useCapacitacionPlantillas,
} from "@/hooks/useCapacitacionPlantillas";
import {
  deriveTemario,
  normalizeDiapositivas,
} from "@/lib/cap-diapositivas";
import CapacitacionAgendaFields from "@/components/CapacitacionAgendaFields";
import {
  CapAgendaErrors,
  CapAgendaValue,
  buildFechasHorario,
  emptyAgenda,
  hasAgendaErrors,
  validateAgenda,
} from "@/lib/cap-agenda";
import { canPublishToBibliotecaLt } from "@/lib/moduleAccess";

type ModoOrigen = "cero" | "empresa" | "lt";

export default function NuevaCapacitacionPage() {
  const { empresa, user } = useAuth();
  const { showAlert } = useAlert();
  const router = useRouter();
  const { crearCapacitacion } = useCapacitaciones();
  const { listarPlantillas, getPlantillaDetalle, crearPlantilla } =
    useCapacitacionPlantillas();

  const [modoOrigen, setModoOrigen] = useState<ModoOrigen>("cero");
  const [plantillasEmpresa, setPlantillasEmpresa] = useState<
    CapacitacionPlantilla[]
  >([]);
  const [plantillasLt, setPlantillasLt] = useState<CapacitacionPlantilla[]>([]);
  const [selectedPlantillaId, setSelectedPlantillaId] = useState("");
  const [guardarEnBibliotecaEmpresa, setGuardarEnBibliotecaEmpresa] =
    useState(false);
  const [guardarEnBibliotecaLt, setGuardarEnBibliotecaLt] = useState(false);

  const canSaveToLt = canPublishToBibliotecaLt(user);

  const [titulo, setTitulo] = useState("");
  const [diapositivas, setDiapositivas] = useState<CapacitacionDiapositiva[]>([
    { contenido: "" },
  ]);
  const [agenda, setAgenda] = useState<CapAgendaValue>(
    emptyAgenda(new Date().toISOString().split("T")[0]),
  );
  const [agendaErrors, setAgendaErrors] = useState<CapAgendaErrors>({});
  const [instructor, setInstructor] = useState("");
  const [conEvaluacion, setConEvaluacion] = useState(true);
  const [preguntas, setPreguntas] = useState<PreguntaPlantillaForm[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!empresa?.id) return;
    listarPlantillas("empresa", empresa.id)
      .then((data) => setPlantillasEmpresa(data || []))
      .catch(console.error);
    listarPlantillas("global")
      .then((data) => setPlantillasLt(data || []))
      .catch(console.error);
  }, [empresa?.id, listarPlantillas]);

  const resetFormContent = () => {
    setSelectedPlantillaId("");
    setTitulo("");
    setDiapositivas([{ contenido: "" }]);
    setPreguntas([]);
    setConEvaluacion(true);
  };

  const handleSeleccionarPlantilla = async (plantillaId: string) => {
    setSelectedPlantillaId(plantillaId);
    if (!plantillaId) return;

    try {
      const data = await getPlantillaDetalle(plantillaId);
      setTitulo(data.titulo || "");
      setDiapositivas(
        normalizeDiapositivas(data.diapositivas, data.temario),
      );
      const preguntasForm = mapPlantillaPreguntasToForm(
        data.capacitacion_plantilla_preguntas || [],
      );
      setPreguntas(preguntasForm);
      if (preguntasForm.length > 0) setConEvaluacion(true);
      showAlert(
        "success",
        "Cargada",
        "Plantilla importada. Podés ajustar título, diapositivas y preguntas antes de guardar la sesión.",
      );
    } catch {
      showAlert("error", "Error", "No se pudo cargar la plantilla elegida.");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!titulo.trim()) {
      setError("El título de la capacitación es obligatorio.");
      return;
    }

    const nextAgendaErrors = validateAgenda(agenda, {
      requireFecha: true,
      requireHorario: true,
    });
    setAgendaErrors(nextAgendaErrors);
    if (hasAgendaErrors(nextAgendaErrors)) {
      setError("Revisá la fecha, el horario y la cantidad de horas.");
      return;
    }

    if (conEvaluacion && preguntas.length === 0) {
      setError(
        "Agregá al menos una pregunta, o elegí “Sin evaluación (solo firmar)”.",
      );
      return;
    }

    setSaving(true);
    try {
      const temario = deriveTemario(diapositivas);
      const preguntasPayload = conEvaluacion
        ? preguntas.map((p) => ({
            pregunta: p.pregunta,
            opciones: p.opciones,
            respuesta_correcta: Array.isArray(p.respuesta_correcta)
              ? JSON.stringify(p.respuesta_correcta)
              : String(p.respuesta_correcta),
          }))
        : [];

      await crearCapacitacion({
        empresa_id: empresa!.id,
        titulo,
        temario,
        diapositivas,
        fecha: agenda.fecha,
        instructor: instructor.trim() || undefined,
        fechas_horario: buildFechasHorario(agenda),
        cantidad_horas: agenda.cantidadHoras.trim(),
        con_evaluacion: conEvaluacion,
        preguntas: preguntasPayload,
        ...(selectedPlantillaId
          ? { copiar_de_plantilla_id: selectedPlantillaId }
          : {}),
      });

      const plantillaPayload = {
        titulo: titulo.trim(),
        temario,
        diapositivas,
        preguntas: conEvaluacion ? preguntas : [],
      };
      const destinos: string[] = [];

      if (guardarEnBibliotecaEmpresa && empresa?.id) {
        await crearPlantilla({
          ambito: "empresa",
          empresa_id: empresa.id,
          ...plantillaPayload,
        });
        destinos.push("biblioteca de la empresa");
      }

      if (guardarEnBibliotecaLt && canSaveToLt) {
        await crearPlantilla({
          ambito: "global",
          ...plantillaPayload,
        });
        destinos.push("biblioteca LT (pendiente de aprobación)");
      }

      showAlert(
        "success",
        "Éxito",
        destinos.length > 0
          ? `Sesión creada y plantilla enviada a ${destinos.join(" y ")}.`
          : "Capacitación creada correctamente.",
      );
      router.push("/capacitaciones");
    } catch (err: any) {
      setError(err.response?.data?.error || "Error al crear la capacitación.");
    } finally {
      setSaving(false);
    }
  };

  const plantillasActivas =
    modoOrigen === "empresa"
      ? plantillasEmpresa
      : modoOrigen === "lt"
        ? plantillasLt
        : [];

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
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

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 bg-slate-100 p-1.5 rounded-2xl border border-slate-200">
        <button
          type="button"
          onClick={() => {
            setModoOrigen("cero");
            resetFormContent();
            setGuardarEnBibliotecaEmpresa(false);
            setGuardarEnBibliotecaLt(false);
          }}
          className={`py-3 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer ${
            modoOrigen === "cero"
              ? "bg-white text-blue-600 shadow-xs"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          <Plus className="h-4 w-4" />
          Desde cero
        </button>
        <button
          type="button"
          onClick={() => {
            setModoOrigen("empresa");
            resetFormContent();
            setGuardarEnBibliotecaEmpresa(false);
            setGuardarEnBibliotecaLt(false);
          }}
          className={`py-3 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer ${
            modoOrigen === "empresa"
              ? "bg-white text-blue-600 shadow-xs"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          <Building2 className="h-4 w-4" />
          Biblioteca empresa
        </button>
        <button
          type="button"
          onClick={() => {
            setModoOrigen("lt");
            resetFormContent();
            setGuardarEnBibliotecaEmpresa(false);
            setGuardarEnBibliotecaLt(false);
          }}
          className={`py-3 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer ${
            modoOrigen === "lt"
              ? "bg-white text-blue-600 shadow-xs"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          <BookOpen className="h-4 w-4" />
          Biblioteca LT
        </button>
      </div>

      {(modoOrigen === "empresa" || modoOrigen === "lt") && (
        <div
          className={`border p-5 rounded-2xl space-y-3 ${
            modoOrigen === "lt"
              ? "bg-indigo-50 border-indigo-100"
              : "bg-blue-50 border-blue-100"
          }`}
        >
          <label
            className={`text-xs font-bold uppercase tracking-wider block ${
              modoOrigen === "lt" ? "text-indigo-900" : "text-blue-900"
            }`}
          >
            {modoOrigen === "lt"
              ? "Elegir de la biblioteca Legajo Técnico"
              : "Elegir de la biblioteca de la empresa"}
          </label>
          <select
            value={selectedPlantillaId}
            onChange={(e) => handleSeleccionarPlantilla(e.target.value)}
            className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
          >
            <option value="">-- Seleccionar plantilla --</option>
            {plantillasActivas.map((p) => (
              <option key={p.id} value={p.id}>
                {p.titulo} ({p.total_preguntas || 0} preguntas)
              </option>
            ))}
          </select>
          {plantillasActivas.length === 0 && (
            <p className="text-xs text-slate-600 font-medium">
              {modoOrigen === "lt"
                ? "Todavía no hay plantillas globales cargadas."
                : "No hay plantillas en la biblioteca de esta empresa."}{" "}
              {modoOrigen === "empresa" && (
                <Link
                  href="/capacitaciones/biblioteca"
                  className="text-blue-600 font-bold underline"
                >
                  Gestionar biblioteca
                </Link>
              )}
            </p>
          )}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3">
          <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
            Al finalizar la presentación
          </h2>
          <p className="text-xs text-slate-500 font-semibold">
            El QR puede llevar a una evaluación con preguntas, o solo a firmar
            la asistencia.
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

        <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
          <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
            <Calendar className="h-4 w-4 text-blue-600" />
            Fecha y horario
          </h2>

          <CapacitacionAgendaFields
            value={agenda}
            onChange={(next) => {
              setAgenda(next);
              setAgendaErrors({});
            }}
            errors={agendaErrors}
          />

          <div className="space-y-1.5 pt-1">
            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Instructor
            </label>
            <input
              type="text"
              value={instructor}
              onChange={(e) => setInstructor(e.target.value)}
              placeholder="Nombre del capacitador"
              className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm font-semibold"
            />
          </div>
        </div>

        <div className="space-y-2">
          <label className="flex items-center gap-3 bg-slate-50 border border-slate-200 rounded-2xl p-4 cursor-pointer">
            <input
              type="checkbox"
              checked={guardarEnBibliotecaEmpresa}
              onChange={(e) => setGuardarEnBibliotecaEmpresa(e.target.checked)}
              className="h-4 w-4 text-blue-600 rounded-xs"
            />
            <span className="text-sm font-semibold text-slate-700">
              Guardar en biblioteca de la empresa
            </span>
          </label>
          {canSaveToLt && (
            <label className="flex items-start gap-3 bg-indigo-50 border border-indigo-100 rounded-2xl p-4 cursor-pointer">
              <input
                type="checkbox"
                checked={guardarEnBibliotecaLt}
                onChange={(e) => setGuardarEnBibliotecaLt(e.target.checked)}
                className="h-4 w-4 text-indigo-600 rounded-xs mt-0.5"
              />
              <span className="text-sm font-semibold text-slate-700">
                Guardar en biblioteca LT
                <span className="block text-[11px] font-medium text-slate-500 mt-0.5">
                  Se envía a revisión del CRM. Solo queda visible a los clientes
                  cuando un admin la aprueba.
                </span>
              </span>
            </label>
          )}
        </div>

        <button
          type="submit"
          disabled={saving}
          className="w-full py-4 bg-brand-primary hover:bg-brand-primary/95 text-white font-bold rounded-xl shadow-md transition-all text-sm flex items-center justify-center gap-2 disabled:opacity-50"
        >
          <Save className="h-4 w-4" />
          {saving ? "Guardando..." : "Crear sesión de capacitación"}
        </button>
      </form>
    </div>
  );
}
