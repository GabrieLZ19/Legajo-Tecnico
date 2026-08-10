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
} from "lucide-react";
import type SignatureCanvas from "react-signature-canvas";
import SignaturePad, { readSignatureOrThrow } from "@/components/SignaturePad";
import { isSignatureEmpty } from "@/lib/signature";

interface Pregunta {
  id: string;
  pregunta: string;
  opciones: string[];
  respuesta_correcta: string;
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

interface CapData {
  id: string;
  titulo: string;
  temario?: string;
  estado: string;
  con_evaluacion?: boolean;
  capacitacion_preguntas: Pregunta[];
}

export default function EvaluacionPublicaPage() {
  const { id } = useParams<{ id: string }>();
  const sigRef = useRef<SignatureCanvas>(null);
  const {
    getCapacitacionPublica,
    evaluarCapacitacion,
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
  const [resultado, setResultado] = useState<{
    puntaje: number;
    aprobado: boolean;
    revision?: ItemRevision[];
  } | null>(null);

  const [step, setStep] = useState<"datos" | "test" | "firma" | "resultado">(
    "datos",
  );
  const [currentPreguntaIndex, setCurrentPreguntaIndex] = useState(0);

  useEffect(() => {
    if (!id) return;
    const saved = localStorage.getItem(`evaluacion_state_${id}`);
    if (saved) {
      try {
        const state = JSON.parse(saved);
        if (state.nombre) setNombre(state.nombre);
        if (state.dni) setDni(state.dni);
        if (state.sector) setSector(state.sector);
        if (state.respuestas) setRespuestas(state.respuestas);
        if (state.currentPreguntaIndex !== undefined)
          setCurrentPreguntaIndex(state.currentPreguntaIndex);
        if (state.step) setStep(state.step);
      } catch (err) {
        console.error("Error al cargar estado:", err);
      }
    }
  }, [id]);

  useEffect(() => {
    if (!id || step === "resultado") return;
    const state = {
      nombre,
      dni,
      sector,
      respuestas,
      currentPreguntaIndex,
      step,
    };
    localStorage.setItem(`evaluacion_state_${id}`, JSON.stringify(state));
  }, [id, nombre, dni, sector, respuestas, currentPreguntaIndex, step]);

  useEffect(() => {
    if (id) {
      getCapacitacionPublica(id)
        .then((data) => {
          setCap(data);
          if (data.estado !== "activa") {
            setError("Esta capacitación no está activa para evaluaciones.");
          }
        })
        .catch((err) => {
          setError("Capacitación no encontrada o inactiva.");
        });
    }
  }, [id]);

  const esMultiple = (respuestaCorrecta: string) => {
    return respuestaCorrecta && respuestaCorrecta.startsWith("[");
  };

  const seleccionarRespuesta = (
    preguntaId: string,
    opcionIdx: number,
    respuestaCorrecta: string,
  ) => {
    const isMult = esMultiple(respuestaCorrecta);
    if (isMult) {
      const current = Array.isArray(respuestas[preguntaId])
        ? (respuestas[preguntaId] as number[])
        : [];
      let next = current.includes(opcionIdx)
        ? current.filter((idx) => idx !== opcionIdx)
        : [...current, opcionIdx];

      setRespuestas({
        ...respuestas,
        [preguntaId]: next.sort((a, b) => a - b),
      });
    } else {
      setRespuestas({ ...respuestas, [preguntaId]: opcionIdx });
    }
  };

  const handleSiguiente = () => {
    if (step === "datos") {
      if (!nombre.trim() || !dni.trim()) {
        setError("Completá tu nombre y DNI para continuar.");
        return;
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

  const handleEnviar = async () => {
    if (isSignatureEmpty(sigRef.current)) {
      setError("Por favor, firmá en el recuadro para confirmar tu asistencia.");
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
      localStorage.removeItem(`evaluacion_state_${id}`);
    } catch (err: unknown) {
      const axiosErr = err as {
        response?: { data?: { error?: string } };
        message?: string;
      };
      setError(
        axiosErr.response?.data?.error ||
          axiosErr.message ||
          "Error al enviar la evaluación.",
      );
    } finally {
      setEnviando(false);
    }
  };

  const totalPreguntas = cap?.capacitacion_preguntas?.length || 0;
  const preguntasRespondidas =
    cap?.capacitacion_preguntas?.filter((p) => {
      const ans = respuestas[p.id];
      return ans !== undefined && (!Array.isArray(ans) || ans.length > 0);
    }).length || 0;
  const porcentajeProgreso =
    totalPreguntas > 0
      ? Math.round((preguntasRespondidas / totalPreguntas) * 100)
      : 0;

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
    step === "test" || step === "resultado" ? "max-w-2xl" : "max-w-md";

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-between p-4 sm:p-6 md:p-8">
      <div
        className={`${containerClass} w-full mx-auto my-auto bg-white rounded-3xl border border-slate-100 p-6 sm:p-8 shadow-xl space-y-6 transition-all duration-300`}
      >
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
            <GraduationCap className="h-5 w-5 text-blue-600" />
          </div>
          <div>
            <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest block">
              Registro Digital
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

        {/* Step: Datos */}
        {step === "datos" && (
          <div className="space-y-5">
            <div className="text-center mb-2">
              <h2 className="text-lg font-black text-slate-900">Bienvenido</h2>
              <p className="text-xs text-slate-500 font-semibold mt-1">
                {cap?.con_evaluacion === false
                  ? "Ingresá tus datos para registrar la asistencia."
                  : "Ingresá tus datos para registrar la asistencia y evaluación."}
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
              onClick={handleSiguiente}
              className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-sm transition-all cursor-pointer shadow-md shadow-blue-500/10"
            >
              Continuar
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
                  {cap.capacitacion_preguntas
                    .sort((a, b) => a.orden - b.orden)
                    .map((p, idx) => {
                      const isCurrent = idx === currentPreguntaIndex;
                      const isAnswered =
                        respuestas[p.id] !== undefined &&
                        (!Array.isArray(respuestas[p.id]) ||
                          (respuestas[p.id] as number[]).length > 0);
                      return (
                        <button
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

            {(() => {
              const p = cap.capacitacion_preguntas.sort(
                (a, b) => a.orden - b.orden,
              )[currentPreguntaIndex];
              if (!p) return null;
              const isMult = esMultiple(p.respuesta_correcta);
              return (
                <div className="space-y-4 animate-in fade-in duration-300">
                  <div className="bg-slate-50 rounded-2xl border border-slate-100 p-5 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest bg-blue-100/60 px-2 py-0.5 rounded-md">
                        Pregunta {currentPreguntaIndex + 1}
                      </span>
                      {isMult && (
                        <span className="px-2.5 py-0.5 rounded-full text-[9px] font-black bg-purple-100 text-purple-700 uppercase">
                          Respuestas Múltiples
                        </span>
                      )}
                    </div>
                    <p className="text-base sm:text-lg font-bold text-slate-800 leading-snug">
                      {p.pregunta}
                    </p>
                  </div>

                  <div className="space-y-2.5">
                    {p.opciones.map((opt, optIdx) => {
                      const isSelected = isMult
                        ? Array.isArray(respuestas[p.id]) &&
                          (respuestas[p.id] as number[]).includes(optIdx)
                        : respuestas[p.id] === optIdx;

                      return (
                        <button
                          key={optIdx}
                          onClick={() =>
                            seleccionarRespuesta(
                              p.id,
                              optIdx,
                              p.respuesta_correcta,
                            )
                          }
                          className={`w-full text-left px-5 py-4 rounded-2xl text-sm font-semibold transition-all cursor-pointer border flex items-center justify-between ${
                            isSelected
                              ? "bg-blue-50 border-blue-400 text-blue-900"
                              : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                          }`}
                        >
                          <div className="flex items-start">
                            <span className="font-black mr-3 text-slate-400">
                              {String.fromCharCode(65 + optIdx)}.
                            </span>
                            <span className="text-slate-800 leading-normal">
                              {opt}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })()}

            <div className="flex items-center justify-between gap-3 pt-5 border-t border-slate-100">
              <button
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
                  onClick={() => {
                    setError(null);
                    setCurrentPreguntaIndex((prev) => prev + 1);
                  }}
                  className="flex-1 py-3.5 px-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-sm flex items-center justify-center gap-1.5"
                >
                  Siguiente <ChevronRight className="h-4 w-4" />
                </button>
              ) : (
                <button
                  onClick={handleSiguiente}
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
                Firmá dentro del recuadro para certificar tu asistencia.
              </p>
            </div>

            <SignaturePad ref={sigRef} />

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => sigRef.current?.clear()}
                className="flex-1 py-3 border border-slate-200 text-slate-600 font-bold rounded-xl text-xs hover:bg-slate-50"
              >
                Limpiar
              </button>
              <button
                type="button"
                disabled={enviando}
                onClick={handleEnviar}
                className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs disabled:opacity-50"
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
