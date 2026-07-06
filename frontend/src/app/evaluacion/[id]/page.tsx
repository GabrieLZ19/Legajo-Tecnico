"use client";

import React, { useEffect, useState, useRef } from "react";
import { useParams } from "next/navigation";
import { api } from "@/lib/api";
import {
  GraduationCap,
  CheckCircle2,
  XCircle,
  ShieldCheck,
  User,
  Hash,
  Briefcase,
} from "lucide-react";
import SignatureCanvas from "react-signature-canvas";

interface Pregunta {
  id: string;
  pregunta: string;
  opciones: string[];
  respuesta_correcta: string;
  orden: number;
}

interface CapData {
  id: string;
  titulo: string;
  temario?: string;
  estado: string;
  capacitacion_preguntas: Pregunta[];
}

export default function EvaluacionPublicaPage() {
  const { id } = useParams<{ id: string }>();
  const sigRef = useRef<SignatureCanvas>(null);

  const [cap, setCap] = useState<CapData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [nombre, setNombre] = useState("");
  const [dni, setDni] = useState("");
  const [sector, setSector] = useState("");
  const [respuestas, setRespuestas] = useState<Record<string, number | number[]>>({});
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState<{
    puntaje: number;
    aprobado: boolean;
  } | null>(null);

  const [step, setStep] = useState<"datos" | "test" | "firma" | "resultado">(
    "datos"
  );

  useEffect(() => {
    fetchCapacitacion();
  }, [id]);

  const fetchCapacitacion = async () => {
    try {
      const { data } = await api.get(`/capacitaciones/${id}`);
      setCap(data);
      if (data.estado !== "activa") {
        setError("Esta capacitación no está activa para evaluaciones.");
      }
    } catch (err) {
      setError("Capacitación no encontrada.");
    } finally {
      setLoading(false);
    }
  };

  const esMultiple = (respuestaCorrecta: string) => {
    return respuestaCorrecta && respuestaCorrecta.startsWith("[");
  };

  const seleccionarRespuesta = (preguntaId: string, opcionIdx: number, respuestaCorrecta: string) => {
    const isMult = esMultiple(respuestaCorrecta);
    if (isMult) {
      const current = Array.isArray(respuestas[preguntaId])
        ? (respuestas[preguntaId] as number[])
        : [];
      let next;
      if (current.includes(opcionIdx)) {
        next = current.filter((idx) => idx !== opcionIdx);
      } else {
        next = [...current, opcionIdx];
      }
      setRespuestas({ ...respuestas, [preguntaId]: next.sort((a, b) => a - b) });
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

      if (cap?.capacitacion_preguntas && cap.capacitacion_preguntas.length > 0) {
        setStep("test");
      } else {
        setStep("firma");
      }
    } else if (step === "test") {
      // Verificar que todas las preguntas fueron respondidas
      const preguntas = cap?.capacitacion_preguntas || [];
      const sinResponder = preguntas.filter((p) => {
        const ans = respuestas[p.id];
        if (ans === undefined) return true;
        if (Array.isArray(ans) && ans.length === 0) return true;
        return false;
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
    if (!sigRef.current || sigRef.current.isEmpty()) {
      setError("Por favor, firmá en el recuadro para confirmar tu asistencia.");
      return;
    }

    setError(null);
    setEnviando(true);
    try {
      const firmaBase64 = sigRef.current
        .getTrimmedCanvas()
        .toDataURL("image/png");

      const { data } = await api.post(`/capacitaciones/${id}/evaluar`, {
        nombre_empleado: nombre,
        dni_empleado: dni,
        sector,
        respuestas: Object.entries(respuestas).map(([preguntaId, seleccion]) => ({
          pregunta_id: preguntaId,
          seleccion,
        })),
        firma: firmaBase64,
      });

      setResultado({ puntaje: data.puntaje, aprobado: data.aprobado });
      setStep("resultado");
    } catch (err: any) {
      setError(
        err.response?.data?.error || "Error al enviar la evaluación."
      );
    } finally {
      setEnviando(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-600"></div>
        <p className="text-xs text-slate-400 mt-3 font-semibold">Cargando evaluación...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-between p-4">
      {/* Container */}
      <div className="max-w-md w-full mx-auto my-auto bg-white rounded-3xl border border-slate-100 p-6 shadow-xl space-y-6">
        {/* Title */}
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

        {/* Step: Datos del empleado */}
        {step === "datos" && (
          <div className="space-y-4">
            <div className="text-center mb-2">
              <h2 className="text-lg font-black text-slate-900">Bienvenido</h2>
              <p className="text-xs text-slate-500 font-semibold mt-1">
                Ingresá tus datos para registrar la asistencia y evaluación.
              </p>
            </div>

            <div className="space-y-3">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                  <User className="h-3.5 w-3.5 text-blue-500" /> Nombre y Apellido *
                </label>
                <input
                  type="text"
                  required
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value.replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑ\s]/g, ""))}
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
                  pattern="[0-9]*"
                  maxLength={8}
                  required
                  value={dni}
                  onChange={(e) => setDni(e.target.value.replace(/\D/g, "").slice(0, 8))}
                  placeholder="12345678"
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm font-semibold focus:outline-hidden focus:ring-2 focus:ring-blue-500/25 focus:border-blue-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                  <Briefcase className="h-3.5 w-3.5 text-blue-500" /> Sector / Puesto
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
              className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-sm transition-all cursor-pointer"
            >
              Continuar
            </button>
          </div>
        )}

        {/* Step: Test */}
        {step === "test" && cap?.capacitacion_preguntas && (
          <div className="space-y-4">
            <div className="text-center mb-2">
              <h2 className="text-lg font-black text-slate-900">Evaluación</h2>
              <p className="text-xs text-slate-500 font-semibold mt-0.5">
                Respondé las siguientes preguntas para validar tus conocimientos.
              </p>
            </div>

            <div className="space-y-4 max-h-[380px] overflow-y-auto pr-1">
              {cap.capacitacion_preguntas
                .sort((a, b) => a.orden - b.orden)
                .map((p, idx) => {
                  const isMult = esMultiple(p.respuesta_correcta);
                  return (
                    <div
                      key={p.id}
                      className="bg-slate-50 rounded-2xl border border-slate-100 p-4 space-y-3"
                    >
                      <div>
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
                            Pregunta {idx + 1}
                          </span>
                          {isMult && (
                            <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-blue-100 text-blue-700 uppercase tracking-wider">
                              Respuestas Múltiples
                            </span>
                          )}
                        </div>
                        <p className="text-sm font-bold text-slate-800 mt-1">
                          {p.pregunta}
                        </p>
                        {isMult && (
                          <p className="text-[10px] text-blue-600 font-semibold mt-0.5">
                            * Seleccioná todas las opciones correctas.
                          </p>
                        )}
                      </div>

                      <div className="space-y-2">
                        {p.opciones.map((opt, optIdx) => {
                          const isSelected = isMult
                            ? Array.isArray(respuestas[p.id]) &&
                              (respuestas[p.id] as number[]).includes(optIdx)
                            : respuestas[p.id] === optIdx;

                          return (
                            <button
                              key={optIdx}
                              onClick={() => seleccionarRespuesta(p.id, optIdx, p.respuesta_correcta)}
                              className={`w-full text-left px-4 py-3 rounded-xl text-sm font-medium transition-all cursor-pointer border flex items-center justify-between ${
                                isSelected
                                  ? "bg-blue-50 border-blue-300 text-blue-800 shadow-2xs"
                                  : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                              }`}
                            >
                              <div>
                                <span className="font-black mr-2">
                                  {String.fromCharCode(65 + optIdx)}.
                                </span>
                                {opt}
                              </div>
                              <div className="shrink-0 ml-2">
                                {isMult ? (
                                  <div className={`h-4 w-4 rounded border flex items-center justify-center transition-all ${
                                    isSelected ? "bg-blue-600 border-blue-600 text-white" : "border-slate-300 bg-white"
                                  }`}>
                                    {isSelected && (
                                      <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                      </svg>
                                    )}
                                  </div>
                                ) : (
                                  <div className={`h-4 w-4 rounded-full border flex items-center justify-center transition-all ${
                                    isSelected ? "border-blue-600 bg-blue-600 text-white" : "border-slate-300 bg-white"
                                  }`}>
                                    {isSelected && <div className="h-1.5 w-1.5 rounded-full bg-white" />}
                                  </div>
                                )}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
            </div>

            <button
              onClick={handleSiguiente}
              className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-sm transition-all cursor-pointer"
            >
              Continuar a Firma
            </button>
          </div>
        )}

        {/* Step: Firma */}
        {step === "firma" && (
          <div className="space-y-4">
            <div className="text-center mb-2">
              <h2 className="text-lg font-black text-slate-900">Registrar Firma</h2>
              <p className="text-xs text-slate-500 font-semibold mt-1">
                Firmá dentro del recuadro para certificar tu asistencia.
              </p>
            </div>

            <div className="border border-slate-200 rounded-2xl overflow-hidden bg-slate-50">
              <SignatureCanvas
                ref={sigRef}
                canvasProps={{
                  className: "w-full h-44 cursor-crosshair bg-slate-50",
                }}
              />
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => sigRef.current?.clear()}
                className="flex-1 py-3 border border-slate-200 text-slate-600 font-bold rounded-xl text-xs hover:bg-slate-50 transition-all cursor-pointer"
              >
                Limpiar
              </button>
              <button
                type="button"
                disabled={enviando}
                onClick={handleEnviar}
                className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs transition-all disabled:opacity-50 cursor-pointer"
              >
                {enviando ? "Enviando..." : "Confirmar Firma"}
              </button>
            </div>
          </div>
        )}

        {/* Step: Resultado */}
        {step === "resultado" && resultado && (
          <div className="text-center py-6 space-y-4">
            {resultado.aprobado ? (
              <div className="space-y-2">
                <div className="h-16 w-16 bg-emerald-50 rounded-full flex items-center justify-center mx-auto border border-emerald-100">
                  <ShieldCheck className="h-8 w-8 text-emerald-600" />
                </div>
                <h2 className="text-lg font-black text-slate-900">¡Capacitación Aprobada!</h2>
                <p className="text-xs text-slate-500 font-semibold">
                  Tu asistencia y examen se registraron con éxito.
                </p>
                <div className="text-sm font-black text-emerald-600 mt-2 bg-emerald-50 border border-emerald-100 rounded-xl py-2 w-32 mx-auto">
                  Nota: {resultado.puntaje}%
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="h-16 w-16 bg-rose-50 rounded-full flex items-center justify-center mx-auto border border-rose-100">
                  <XCircle className="h-8 w-8 text-rose-600" />
                </div>
                <h2 className="text-lg font-black text-slate-900">Evaluación no aprobada</h2>
                <p className="text-xs text-slate-500 font-semibold">
                  Se registró tu asistencia, pero tu puntaje es inferior al mínimo (60%).
                </p>
                <div className="text-sm font-black text-rose-600 mt-2 bg-rose-50 border border-rose-100 rounded-xl py-2 w-32 mx-auto">
                  Nota: {resultado.puntaje}%
                </div>
              </div>
            )}

            <div className="pt-4 border-t border-slate-100 text-[10px] text-slate-400 font-semibold uppercase tracking-wider">
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
