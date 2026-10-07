"use client";

import { useEffect, useState, useRef } from "react";
import { useParams } from "next/navigation";
import { useCapacitaciones } from "@/hooks/useCapacitaciones";
import {
  GraduationCap,
  CheckCircle2,
  XCircle,
  ShieldCheck,
  User,
  Hash,
  Briefcase,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  Square,
  CheckSquare,
  Presentation,
} from "lucide-react";
import type SignatureCanvas from "react-signature-canvas";
import SignaturePad, { readSignatureOrThrow } from "@/components/SignaturePad";
import SignatureImageImport from "@/components/SignatureImageImport";
import { isSignatureEmpty } from "@/lib/signature";
import { sanitizeRichHtml } from "@/lib/sanitizeHtml";
import { normalizeDiapositivas } from "@/lib/cap-diapositivas";
import type { CapacitacionDiapositiva } from "@/types";

interface Pregunta {
  id: string;
  pregunta: string;
  opciones: string[];
  respuesta_correcta?: string;
  es_multiple?: boolean;
  orden: number;
}

interface ItemRevision {
  pregunta_id: string;
  enunciado: string;
  opciones: string[];
  seleccion: number | number[];
  respuesta_correcta: number | number[];
  es_correcta: boolean;
}

const STORAGE_PREFIX = "evaluacion_state_";

function loadPersistedState(capacitacionId: string) {
  if (typeof window === "undefined") return null;
  try {
    const saved = localStorage.getItem(`${STORAGE_PREFIX}${capacitacionId}`);
    if (!saved) return null;
    return JSON.parse(saved) as {
      nombre?: string;
      dni?: string;
      sector?: string;
      respuestas?: Record<string, number | number[]>;
      currentPreguntaIndex?: number;
      slideIndex?: number;
      step?: string;
    };
  } catch {
    return null;
  }
}

function clearPersistedState(capacitacionId: string) {
  if (typeof window === "undefined") return;
  localStorage.removeItem(`${STORAGE_PREFIX}${capacitacionId}`);
}

type EvaluacionStep = "filminas" | "datos" | "test" | "firma" | "resultado";

function persistState(
  capacitacionId: string,
  state: {
    nombre: string;
    dni: string;
    sector: string;
    respuestas: Record<string, number | number[]>;
    currentPreguntaIndex: number;
    slideIndex: number;
    step: EvaluacionStep;
  },
) {
  if (typeof window === "undefined") return;
  if (
    state.step !== "datos" &&
    state.step !== "test" &&
    state.step !== "filminas"
  ) {
    return;
  }
  localStorage.setItem(`${STORAGE_PREFIX}${capacitacionId}`, JSON.stringify(state));
}

function respuestasCompletas(
  preguntas: Pregunta[],
  respuestas: Record<string, number | number[]>,
) {
  return preguntas.every((p) => {
    const ans = respuestas[p.id];
    return ans !== undefined && (!Array.isArray(ans) || ans.length > 0);
  });
}

interface CapData {
  id: string;
  titulo: string;
  temario?: string;
  diapositivas?: CapacitacionDiapositiva[] | null;
  estado: string;
  con_evaluacion?: boolean;
  capacitacion_preguntas: Pregunta[];
}

export default function EvaluacionPublicaPage() {
  const { id: idParam } = useParams<{ id: string }>();
  const id = idParam ?? "";
  const sigRef = useRef<SignatureCanvas>(null);
  const {
    getCapacitacionPublica,
    evaluarCapacitacion,
    consultarIntentoCapacitacion,
    loading: apiLoading,
  } = useCapacitaciones();

  const [cap, setCap] = useState<CapData | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [nombre, setNombre] = useState("");
  const [dni, setDni] = useState("");
  const [sector, setSector] = useState("");
  const [respuestas, setRespuestas] = useState<
    Record<string, number | number[]>
  >({});
  const [enviando, setEnviando] = useState(false);
  const [validandoDni, setValidandoDni] = useState(false);
  const [resultado, setResultado] = useState<{
    puntaje: number;
    aprobado: boolean;
    revision?: ItemRevision[];
  } | null>(null);

  const [step, setStep] = useState<EvaluacionStep>("filminas");
  const [currentPreguntaIndex, setCurrentPreguntaIndex] = useState(0);
  const [slideIndex, setSlideIndex] = useState(0);
  const [slides, setSlides] = useState<CapacitacionDiapositiva[]>([]);
  const restoredStepRef = useRef<EvaluacionStep | null>(null);

  useEffect(() => {
    if (!id) return;
    const state = loadPersistedState(id);
    if (!state) {
      restoredStepRef.current = null;
      return;
    }

    if (state.nombre) setNombre(state.nombre);
    if (state.dni) setDni(state.dni);
    if (state.sector) setSector(state.sector);
    if (state.respuestas) setRespuestas(state.respuestas);
    if (state.currentPreguntaIndex !== undefined) {
      setCurrentPreguntaIndex(state.currentPreguntaIndex);
    }
    if (typeof state.slideIndex === "number") {
      setSlideIndex(Math.max(0, state.slideIndex));
    }

    // Nunca restaurar firma/resultado: evita envíos con respuestas vacías
    if (state.step === "test" || state.step === "datos" || state.step === "filminas") {
      restoredStepRef.current = state.step;
      setStep(state.step);
    } else {
      restoredStepRef.current = "filminas";
      setStep("filminas");
      if (state.step === "firma" || state.step === "resultado") {
        clearPersistedState(id);
      }
    }
  }, [id]);

  useEffect(() => {
    if (!id || step === "resultado") return;
    persistState(id, {
      nombre,
      dni,
      sector,
      respuestas,
      currentPreguntaIndex,
      slideIndex,
      step,
    });
  }, [id, nombre, dni, sector, respuestas, currentPreguntaIndex, slideIndex, step]);

  useEffect(() => {
    if (!id) return;
    getCapacitacionPublica(id)
      .then((data) => {
        setCap(data);
        const nextSlides = normalizeDiapositivas(
          data.diapositivas,
          data.temario,
        ).filter((s) => {
          const html = s.contenido || "";
          const text = html.replace(/<[^>]+>/g, "").trim();
          return Boolean(text) || /<img[\s>]/i.test(html);
        });
        setSlides(nextSlides);

        const restored = restoredStepRef.current;
        if (nextSlides.length === 0) {
          if (!restored || restored === "filminas") setStep("datos");
        } else if (!restored) {
          setStep("filminas");
          setSlideIndex(0);
        } else if (restored === "filminas") {
          setSlideIndex((idx) =>
            Math.min(idx, Math.max(0, nextSlides.length - 1)),
          );
        }

        if (data.estado !== "activa") {
          setError("Esta capacitación no está activa para evaluaciones.");
        }
      })
      .catch(() => {
        setError("Capacitación no encontrada o inactiva.");
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- cargar una vez por id
  }, [id]);

  const esMultiple = (p: Pregunta) => {
    if (p.es_multiple) return true;
    const raw = p.respuesta_correcta;
    if (!raw) return false;
    if (Array.isArray(raw)) return true;
    return String(raw).trim().startsWith("[");
  };

  const preguntaRespondida = (p: Pregunta) => {
    const ans = respuestas[p.id];
    return ans !== undefined && (!Array.isArray(ans) || ans.length > 0);
  };

  const seleccionarRespuesta = (
    preguntaId: string,
    opcionIdx: number,
    isMult: boolean,
  ) => {
    setError(null);
    setRespuestas((prev) => {
      if (isMult) {
        const current = Array.isArray(prev[preguntaId])
          ? (prev[preguntaId] as number[])
          : [];
        const next = current.includes(opcionIdx)
          ? current.filter((idx) => idx !== opcionIdx)
          : [...current, opcionIdx];
        return {
          ...prev,
          [preguntaId]: next.sort((a, b) => a - b),
        };
      }
      return { ...prev, [preguntaId]: opcionIdx };
    });
  };

  const handleSiguiente = async () => {
    if (step === "datos") {
      if (!nombre.trim() || !dni.trim()) {
        setError("Completá tu nombre y DNI para continuar.");
        return;
      }
      if (!/^\d{7,8}$/.test(dni.replace(/\D/g, ""))) {
        setError("El DNI debe tener 7 u 8 dígitos.");
        return;
      }

      setValidandoDni(true);
      try {
        const intento = await consultarIntentoCapacitacion(
          id,
          dni.replace(/\D/g, ""),
        );
        if (intento.registrado && intento.aprobado) {
          setResultado({
            puntaje: intento.puntaje ?? 100,
            aprobado: true,
          });
          setStep("resultado");
          clearPersistedState(id);
          setError(null);
          return;
        }
        if (intento.registrado && !intento.aprobado) {
          setRespuestas({});
          setCurrentPreguntaIndex(0);
          clearPersistedState(id);
        }
      } catch {
        // Si falla la consulta, permitir continuar igual
      } finally {
        setValidandoDni(false);
      }

      setError(null);

      if (
        cap?.con_evaluacion !== false &&
        cap?.capacitacion_preguntas &&
        cap.capacitacion_preguntas.length > 0
      ) {
        setStep("test");
        setCurrentPreguntaIndex(0);
      } else {
        setStep("firma");
      }
    } else if (step === "test") {
      const preguntas = cap?.capacitacion_preguntas || [];
      const sinResponder = preguntas.filter((p) => {
        const ans = respuestas[p.id];
        return ans === undefined || (Array.isArray(ans) && ans.length === 0);
      });
      if (sinResponder.length > 0) {
        setError(`Te faltan ${sinResponder.length} pregunta(s) por responder.`);
        return;
      }
      setError(null);
      setStep("firma");
    }
  };

  /** Avanza de pregunta solo con confirmación explícita (no auto-avance). */
  const avanzarPregunta = () => {
    const preguntas = (cap?.capacitacion_preguntas || [])
      .slice()
      .sort((a, b) => a.orden - b.orden);
    const actual = preguntas[currentPreguntaIndex];
    if (!actual) return;

    if (!preguntaRespondida(actual)) {
      setError(
        esMultiple(actual)
          ? "Marcá todas las opciones que correspondan y después tocá Siguiente."
          : "Seleccioná una opción para continuar.",
      );
      return;
    }

    setError(null);
    if (currentPreguntaIndex < preguntas.length - 1) {
      setCurrentPreguntaIndex((prev) => prev + 1);
    } else {
      void handleSiguiente();
    }
  };

  const handleEnviar = async () => {
    if (isSignatureEmpty(sigRef.current)) {
      setError("Por favor, firmá en el recuadro para confirmar tu asistencia.");
      return;
    }

    const preguntas = cap?.capacitacion_preguntas || [];
    const requiereTest =
      cap?.con_evaluacion !== false && preguntas.length > 0;
    if (requiereTest && !respuestasCompletas(preguntas, respuestas)) {
      setError("Completá todas las preguntas antes de firmar.");
      setStep("test");
      return;
    }

    setError(null);
    setEnviando(true);
    try {
      const firmaBase64 = readSignatureOrThrow(sigRef.current);

      const data = await evaluarCapacitacion(id, {
        nombre_empleado: nombre,
        dni_empleado: dni,
        sector,
        respuestas: Object.entries(respuestas).map(
          ([preguntaId, seleccion]) => ({
            pregunta_id: preguntaId,
            seleccion,
          }),
        ),
        firma: firmaBase64,
      });

      setResultado({
        puntaje: data.puntaje,
        aprobado: data.aprobado,
        revision: data.revision,
      });
      setStep("resultado");
      clearPersistedState(id);
    } catch (err: unknown) {
      const axiosErr = err as {
        response?: { status?: number; data?: { error?: string } };
        message?: string;
      };
      const status = axiosErr.response?.status;
      setError(
        status === 429
          ? "Hay muchas personas registrándose al mismo tiempo. Esperá 30 segundos y tocá «Confirmar Firma» de nuevo sin recargar la página."
          : status === 409
            ? "Este DNI ya aprobó la evaluación. No podés volver a rendirla."
          : axiosErr.response?.data?.error ||
              axiosErr.message ||
              "Error al enviar la evaluación.",
      );
    } finally {
      setEnviando(false);
    }
  };

  const reiniciarEvaluacion = () => {
    clearPersistedState(id);
    setResultado(null);
    setRespuestas({});
    setCurrentPreguntaIndex(0);
    setSlideIndex(0);
    restoredStepRef.current = null;
    setStep(slides.length > 0 ? "filminas" : "datos");
    setError(null);
    sigRef.current?.clear();
  };

  const terminarFilminas = () => {
    setError(null);
    setStep("datos");
  };

  const totalPreguntas = cap?.capacitacion_preguntas?.length || 0;
  const preguntasOrdenadas = (cap?.capacitacion_preguntas || [])
    .slice()
    .sort((a, b) => a.orden - b.orden);
  const preguntasRespondidas =
    preguntasOrdenadas.filter((p) => {
      const ans = respuestas[p.id];
      return ans !== undefined && (!Array.isArray(ans) || ans.length > 0);
    }).length || 0;
  const porcentajeProgreso =
    totalPreguntas > 0
      ? Math.round((preguntasRespondidas / totalPreguntas) * 100)
      : 0;
  const preguntaActual = preguntasOrdenadas[currentPreguntaIndex] ?? null;
  const isMultActual = preguntaActual ? esMultiple(preguntaActual) : false;

  if (apiLoading && !cap) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-600"></div>
        <p className="text-xs text-slate-400 mt-3 font-semibold">
          Cargando evaluación...
        </p>
      </div>
    );
  }

  const containerClass =
    step === "filminas"
      ? "max-w-3xl"
      : step === "test" || step === "resultado"
        ? "max-w-2xl"
        : "max-w-md";

  const totalSlides = slides.length;
  const slideActual = slides[slideIndex] ?? null;
  const esUltimaFilmina = slideIndex >= totalSlides - 1;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-between p-4 sm:p-6 md:p-8">
      <div
        className={`${containerClass} w-full mx-auto my-auto bg-white rounded-3xl border border-slate-100 p-6 sm:p-8 shadow-xl space-y-6`}
      >
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
            {step === "filminas" ? (
              <Presentation className="h-5 w-5 text-blue-600" />
            ) : (
              <GraduationCap className="h-5 w-5 text-blue-600" />
            )}
          </div>
          <div>
            <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest block">
              {step === "filminas" ? "Material de capacitación" : "Registro Digital"}
            </span>
            <h1 className="text-sm font-black text-slate-800 uppercase tracking-tight line-clamp-1">
              {cap?.titulo || "Capacitación"}
            </h1>
          </div>
        </div>

        {error && (
          <div className="rounded-xl bg-rose-50 border border-rose-100 p-4 text-xs text-rose-800 font-semibold animate-in fade-in duration-200">
            {error}
          </div>
        )}

        {/* Step: Filminas */}
        {step === "filminas" && slideActual && (
          <div className="space-y-5">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs font-bold text-slate-500">
                Diapositiva{" "}
                <span className="text-blue-600">{slideIndex + 1}</span> de{" "}
                {totalSlides}
              </p>
              <div className="h-2 flex-1 max-w-[140px] bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-600 rounded-full transition-all"
                  style={{
                    width: `${Math.round(((slideIndex + 1) / totalSlides) * 100)}%`,
                  }}
                />
              </div>
            </div>

            <div
              className="cap-html-content rounded-2xl border border-slate-100 bg-slate-50 p-4 sm:p-6 min-h-[220px] max-h-[55vh] overflow-y-auto text-sm text-slate-800 leading-relaxed
                [&_img]:rounded-xl [&_img]:max-w-full [&_img]:mx-auto [&_img]:my-3
                [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5
                [&_table]:w-full [&_h1]:text-xl [&_h1]:font-black [&_h2]:text-lg [&_h2]:font-bold"
              dangerouslySetInnerHTML={{
                __html: sanitizeRichHtml(slideActual.contenido || "<p>—</p>"),
              }}
            />

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setSlideIndex((i) => Math.max(0, i - 1))}
                disabled={slideIndex === 0}
                className="inline-flex items-center justify-center gap-1 px-4 py-3 rounded-xl border border-slate-200 bg-white text-slate-700 text-sm font-bold disabled:opacity-40 cursor-pointer hover:bg-slate-50"
              >
                <ChevronLeft className="h-4 w-4" />
                Anterior
              </button>

              {esUltimaFilmina ? (
                <button
                  type="button"
                  onClick={terminarFilminas}
                  className="flex-1 py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-sm transition-all cursor-pointer shadow-md shadow-blue-500/10"
                >
                  {cap?.con_evaluacion === false
                    ? "Continuar a firmar asistencia"
                    : "Continuar a la evaluación"}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() =>
                    setSlideIndex((i) => Math.min(totalSlides - 1, i + 1))
                  }
                  className="flex-1 inline-flex items-center justify-center gap-1 py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-sm transition-all cursor-pointer shadow-md shadow-blue-500/10"
                >
                  Siguiente
                  <ChevronRight className="h-4 w-4" />
                </button>
              )}
            </div>

            {!esUltimaFilmina && (
              <button
                type="button"
                onClick={terminarFilminas}
                className="w-full text-center text-[11px] font-bold text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                Ya vi el material · ir a{" "}
                {cap?.con_evaluacion === false ? "firmar" : "evaluar"}
              </button>
            )}
          </div>
        )}

        {/* Step: Datos */}
        {step === "datos" && (
          <div className="space-y-5">
            <div className="text-center mb-2">
              <h2 className="text-lg font-black text-slate-900">
                {slides.length > 0 ? "Listo para registrar" : "Bienvenido"}
              </h2>
              <p className="text-xs text-slate-500 font-semibold mt-1">
                {cap?.con_evaluacion === false
                  ? "Ingresá tus datos para firmar y registrar la asistencia."
                  : "Ingresá tus datos para completar la evaluación y registrar la asistencia."}
              </p>
            </div>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                  <User className="h-3.5 w-3.5 text-blue-500" /> Nombre y
                  Apellido *
                </label>
                <input
                  type="text"
                  required
                  value={nombre}
                  onChange={(e) =>
                    setNombre(
                      e.target.value.replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑ\s]/g, ""),
                    )
                  }
                  placeholder="Juan Pérez"
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm font-semibold focus:outline-hidden focus:ring-2 focus:ring-blue-500/25 focus:border-blue-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                  <Hash className="h-3.5 w-3.5 text-blue-500" /> DNI *
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={8}
                  required
                  value={dni}
                  onChange={(e) =>
                    setDni(e.target.value.replace(/\D/g, "").slice(0, 8))
                  }
                  placeholder="12345678"
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm font-semibold focus:outline-hidden focus:ring-2 focus:ring-blue-500/25 focus:border-blue-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                  <Briefcase className="h-3.5 w-3.5 text-blue-500" /> Sector /
                  Puesto
                </label>
                <input
                  type="text"
                  value={sector}
                  onChange={(e) => setSector(e.target.value)}
                  placeholder="Ej: Producción, Logística"
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm font-semibold focus:outline-hidden focus:ring-2 focus:ring-blue-500/25 focus:border-blue-500"
                />
              </div>
            </div>

            <button
              onClick={() => void handleSiguiente()}
              disabled={validandoDni}
              className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-sm transition-all cursor-pointer shadow-md shadow-blue-500/10 disabled:opacity-50"
            >
              {validandoDni ? "Verificando..." : "Continuar"}
            </button>
          </div>
        )}

        {/* Step: Test */}
        {step === "test" && cap?.capacitacion_preguntas && (
          <div className="space-y-6">
            <div className="space-y-3 bg-slate-50 border border-slate-100 p-4 rounded-2xl">
              <div className="flex items-center justify-between text-xs font-bold text-slate-600">
                <span>
                  Resueltas:{" "}
                  <span className="text-blue-600">{preguntasRespondidas}</span>{" "}
                  de {totalPreguntas}
                </span>
                <span className="text-emerald-600 font-extrabold">
                  {porcentajeProgreso}% Completado
                </span>
              </div>

              <div className="h-2.5 w-full bg-slate-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-600 rounded-full transition-all duration-300"
                  style={{ width: `${porcentajeProgreso}%` }}
                />
              </div>

              <div className="pt-2 border-t border-slate-200/60">
                <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-2 text-center">
                  Saltar a Pregunta
                </p>
                <div className="flex flex-wrap gap-1.5 justify-center">
                  {preguntasOrdenadas.map((p, idx) => {
                    const isCurrent = idx === currentPreguntaIndex;
                    const isAnswered =
                      respuestas[p.id] !== undefined &&
                      (!Array.isArray(respuestas[p.id]) ||
                        (respuestas[p.id] as number[]).length > 0);
                    return (
                      <button
                        type="button"
                        key={p.id}
                        onClick={() => {
                          setError(null);
                          setCurrentPreguntaIndex(idx);
                        }}
                        className={`h-9 w-9 rounded-xl text-xs font-bold transition-all flex items-center justify-center cursor-pointer border ${
                          isCurrent
                            ? "bg-blue-600 border-blue-600 text-white shadow-md scale-105"
                            : isAnswered
                              ? "bg-emerald-500 border-emerald-500 text-white"
                              : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                        }`}
                      >
                        {idx + 1}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {preguntaActual && (
              <div className="space-y-4 animate-in fade-in duration-300">
                <div className="bg-slate-50 rounded-2xl border border-slate-100 p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest bg-blue-100/60 px-2 py-0.5 rounded-md">
                      Pregunta {currentPreguntaIndex + 1}
                    </span>
                    {isMultActual && (
                      <span className="px-2.5 py-0.5 rounded-full text-[9px] font-black bg-purple-100 text-purple-700 uppercase">
                        Respuestas Múltiples
                      </span>
                    )}
                  </div>
                  <p className="text-base sm:text-lg font-bold text-slate-800 leading-snug">
                    {preguntaActual.pregunta}
                  </p>
                  {isMultActual && (
                    <p className="text-sm font-semibold text-purple-700">
                      Marcá todas las correctas y después tocá Siguiente.
                    </p>
                  )}
                </div>

                <div className="space-y-2.5">
                  {preguntaActual.opciones.map((opt, optIdx) => {
                    const isSelected = isMultActual
                      ? Array.isArray(respuestas[preguntaActual.id]) &&
                        (
                          respuestas[preguntaActual.id] as number[]
                        ).includes(optIdx)
                      : respuestas[preguntaActual.id] === optIdx;

                    return (
                      <button
                        type="button"
                        key={optIdx}
                        onClick={() =>
                          seleccionarRespuesta(
                            preguntaActual.id,
                            optIdx,
                            isMultActual,
                          )
                        }
                        className={`w-full text-left px-5 py-4 rounded-2xl text-sm font-semibold transition-all cursor-pointer border flex items-center justify-between gap-3 ${
                          isSelected
                            ? "bg-blue-50 border-blue-400 text-blue-900"
                            : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                        }`}
                      >
                        <div className="flex items-start min-w-0">
                          <span className="font-black mr-3 text-slate-400">
                            {String.fromCharCode(65 + optIdx)}.
                          </span>
                          <span className="text-slate-800 leading-normal">
                            {opt}
                          </span>
                        </div>
                        {isMultActual &&
                          (isSelected ? (
                            <CheckSquare className="h-5 w-5 text-blue-600 shrink-0" />
                          ) : (
                            <Square className="h-5 w-5 text-slate-300 shrink-0" />
                          ))}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="flex items-center justify-between gap-3 pt-5 border-t border-slate-100">
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  setCurrentPreguntaIndex((prev) => Math.max(0, prev - 1));
                }}
                disabled={currentPreguntaIndex === 0}
                className="flex-1 py-3.5 px-4 border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold rounded-xl text-sm disabled:opacity-30 flex items-center justify-center gap-1.5"
              >
                <ChevronLeft className="h-4 w-4" /> Anterior
              </button>
              {currentPreguntaIndex < totalPreguntas - 1 ? (
                <button
                  type="button"
                  onClick={avanzarPregunta}
                  className="flex-1 py-3.5 px-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-sm flex items-center justify-center gap-1.5"
                >
                  Siguiente <ChevronRight className="h-4 w-4" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={avanzarPregunta}
                  className="flex-1 py-3.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-sm flex items-center justify-center gap-1.5"
                >
                  Finalizar Test
                </button>
              )}
            </div>
          </div>
        )}

        {/* Step: Firma */}
        {step === "firma" && (
          <div className="space-y-4">
            <div className="text-center mb-2">
              <h2 className="text-lg font-black text-slate-900">
                Registrar Firma
              </h2>
              <p className="text-xs text-slate-500 font-semibold mt-1">
                Firmá en el recuadro, subí una imagen o pegá un recorte
                (Ctrl+V).
              </p>
            </div>

            <SignaturePad ref={sigRef} />

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => sigRef.current?.clear()}
                className="flex-1 min-w-[90px] py-3 border border-slate-200 text-slate-600 font-bold rounded-xl text-xs hover:bg-slate-50"
              >
                Limpiar
              </button>
              <SignatureImageImport
                canvasRef={sigRef}
                onError={(msg) => setError(msg)}
                className="flex-1 min-w-[120px] inline-flex items-center justify-center gap-1.5 py-3 border border-slate-200 text-slate-600 font-bold rounded-xl text-xs hover:bg-slate-50"
                label="Insertar imagen"
              />
              <button
                type="button"
                disabled={enviando}
                onClick={handleEnviar}
                className="flex-1 min-w-[120px] py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs disabled:opacity-50"
              >
                {enviando ? "Enviando..." : "Confirmar Firma"}
              </button>
            </div>
          </div>
        )}

        {/* Step: Resultado (Estilo Google Forms con Revisión) */}
        {step === "resultado" && resultado && (
          <div className="space-y-6">
            <div className="text-center py-4 space-y-3">
              {cap?.con_evaluacion === false ? (
                <div className="space-y-2">
                  <div className="h-16 w-16 bg-emerald-50 rounded-full flex items-center justify-center mx-auto border border-emerald-100">
                    <ShieldCheck className="h-8 w-8 text-emerald-600" />
                  </div>
                  <h2 className="text-xl font-black text-slate-900">
                    ¡Asistencia registrada!
                  </h2>
                  <p className="text-xs text-slate-500 font-semibold">
                    Tu firma se guardó correctamente. Gracias por participar.
                  </p>
                </div>
              ) : resultado.aprobado ? (
                <div className="space-y-2">
                  <div className="h-16 w-16 bg-emerald-50 rounded-full flex items-center justify-center mx-auto border border-emerald-100">
                    <ShieldCheck className="h-8 w-8 text-emerald-600" />
                  </div>
                  <h2 className="text-xl font-black text-slate-900">
                    ¡Capacitación Aprobada!
                  </h2>
                  <p className="text-xs text-slate-500 font-semibold">
                    Tu asistencia y examen se registraron con éxito.
                  </p>
                  <div className="text-base font-black text-emerald-600 bg-emerald-50 border border-emerald-100 rounded-xl py-2 w-36 mx-auto">
                    Nota: {resultado.puntaje}%
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="h-16 w-16 bg-rose-50 rounded-full flex items-center justify-center mx-auto border border-rose-100">
                    <XCircle className="h-8 w-8 text-rose-600" />
                  </div>
                  <h2 className="text-xl font-black text-slate-900">
                    Evaluación no aprobada
                  </h2>
                  <p className="text-xs text-slate-500 font-semibold">
                    Se registró tu asistencia, pero tu puntaje es inferior al
                    mínimo (60%).
                  </p>
                  <div className="text-base font-black text-rose-600 bg-rose-50 border border-rose-100 rounded-xl py-2 w-36 mx-auto">
                    Nota: {resultado.puntaje}%
                  </div>
                  <p className="text-sm font-semibold text-rose-800 leading-snug max-w-sm mx-auto">
                    Ud deberá volver a tomar el curso y rendir nuevamente el
                    examen
                  </p>
                  <button
                    type="button"
                    onClick={reiniciarEvaluacion}
                    className="mt-2 w-full max-w-xs mx-auto py-3 bg-white border border-rose-200 hover:bg-rose-50 text-rose-700 font-bold rounded-xl text-sm cursor-pointer"
                  >
                    Intentar de nuevo
                  </button>
                </div>
              )}
            </div>

            {/* Revisión Estilo Google Forms */}
            {resultado.revision && resultado.revision.length > 0 && (
              <div className="space-y-4 pt-4 border-t border-slate-100">
                <h3 className="text-xs font-black text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                  <AlertCircle className="h-4 w-4 text-blue-600" /> Revisión de
                  Respuestas
                </h3>

                <div className="space-y-4">
                  {resultado.revision.map((item, idx) => {
                    const esCorrecta = item.es_correcta;

                    return (
                      <div
                        key={item.pregunta_id}
                        className={`p-4 rounded-2xl border ${
                          esCorrecta
                            ? "bg-emerald-50/40 border-emerald-200"
                            : "bg-rose-50/40 border-rose-200"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <p className="text-xs font-bold text-slate-800">
                            {idx + 1}. {item.enunciado}
                          </p>
                          <span
                            className={`inline-flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-md uppercase shrink-0 ${
                              esCorrecta
                                ? "bg-emerald-100 text-emerald-700"
                                : "bg-rose-100 text-rose-700"
                            }`}
                          >
                            {esCorrecta ? (
                              <>
                                <CheckCircle2 className="h-3 w-3" /> Correcta
                              </>
                            ) : (
                              <>
                                <XCircle className="h-3 w-3" /> Incorrecta
                              </>
                            )}
                          </span>
                        </div>

                        {/* Opciones */}
                        <div className="space-y-1.5 mt-2">
                          {item.opciones.map((opt, optIdx) => {
                            const isUserSelected = Array.isArray(item.seleccion)
                              ? item.seleccion.includes(optIdx)
                              : item.seleccion === optIdx;

                            const isCorrectOpt = Array.isArray(
                              item.respuesta_correcta,
                            )
                              ? item.respuesta_correcta.includes(optIdx)
                              : item.respuesta_correcta === optIdx;

                            let optStyle =
                              "bg-white border-slate-200 text-slate-600";
                            if (isCorrectOpt) {
                              optStyle =
                                "bg-emerald-100 border-emerald-300 text-emerald-900 font-bold";
                            } else if (isUserSelected && !esCorrecta) {
                              optStyle =
                                "bg-rose-100 border-rose-300 text-rose-900 font-bold line-through";
                            }

                            return (
                              <div
                                key={optIdx}
                                className={`text-xs p-2.5 rounded-xl border flex items-center justify-between ${optStyle}`}
                              >
                                <span>
                                  <strong className="mr-1.5">
                                    {String.fromCharCode(65 + optIdx)}.
                                  </strong>
                                  {opt}
                                </span>
                                {isUserSelected && (
                                  <span className="text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded bg-black/5">
                                    Tu respuesta
                                  </span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="pt-4 border-t border-slate-100 text-center text-[10px] text-slate-400 font-semibold uppercase tracking-wider">
              Legajo Técnico Digital
            </div>
          </div>
        )}
      </div>

      <div className="text-center text-[10px] text-slate-400 font-bold uppercase tracking-widest py-2">
        Legajo Técnico • {new Date().getFullYear()}
      </div>
    </div>
  );
}
