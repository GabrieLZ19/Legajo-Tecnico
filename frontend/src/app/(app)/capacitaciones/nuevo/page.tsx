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

type ModoOrigen = "cero" | "empresa" | "lt";

export default function NuevaCapacitacionPage() {
  const { empresa } = useAuth();
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
  const [guardarEnBiblioteca, setGuardarEnBiblioteca] = useState(false);

  const [titulo, setTitulo] = useState("");
  const [diapositivas, setDiapositivas] = useState<CapacitacionDiapositiva[]>([
    { contenido: "" },
  ]);
  const [fecha, setFecha] = useState(new Date().toISOString().split("T")[0]);
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
      setPreguntas(
        mapPlantillaPreguntasToForm(
          data.capacitacion_plantilla_preguntas || [],
        ),
      );
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

    setSaving(true);
    try {
      const temario = deriveTemario(diapositivas);
      const preguntasPayload = preguntas.map((p) => ({
        pregunta: p.pregunta,
        opciones: p.opciones,
        respuesta_correcta: Array.isArray(p.respuesta_correcta)
          ? JSON.stringify(p.respuesta_correcta)
          : String(p.respuesta_correcta),
      }));

      await crearCapacitacion({
        empresa_id: empresa!.id,
        titulo,
        temario,
        diapositivas,
        fecha,
        preguntas: preguntasPayload,
        ...(selectedPlantillaId
          ? { copiar_de_plantilla_id: selectedPlantillaId }
          : {}),
      });

      if (guardarEnBiblioteca && modoOrigen === "cero" && empresa?.id) {
        await crearPlantilla({
          ambito: "empresa",
          empresa_id: empresa.id,
          titulo: titulo.trim(),
          temario,
          diapositivas,
          preguntas,
        });
      }

      showAlert(
        "success",
        "Éxito",
        guardarEnBiblioteca && modoOrigen === "cero"
          ? "Sesión creada y plantilla guardada en la biblioteca de la empresa."
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
    <div className="space-y-8 max-w-3xl mx-auto">
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
            setGuardarEnBiblioteca(false);
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
            setGuardarEnBiblioteca(false);
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
            setGuardarEnBiblioteca(false);
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
        <CapacitacionPlantillaForm
          titulo={titulo}
          diapositivas={diapositivas}
          preguntas={preguntas}
          onTituloChange={setTitulo}
          onDiapositivasChange={setDiapositivas}
          onPreguntasChange={setPreguntas}
          error={error}
        />

        <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-2">
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

        {modoOrigen === "cero" && (
          <label className="flex items-center gap-3 bg-slate-50 border border-slate-200 rounded-2xl p-4 cursor-pointer">
            <input
              type="checkbox"
              checked={guardarEnBiblioteca}
              onChange={(e) => setGuardarEnBiblioteca(e.target.checked)}
              className="h-4 w-4 text-blue-600 rounded-xs"
            />
            <span className="text-sm font-semibold text-slate-700">
              También guardar en la biblioteca de la empresa
            </span>
          </label>
        )}

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
