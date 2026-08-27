"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  Clock3,
  Edit2,
  HelpCircle,
  Loader2,
  Presentation,
  User,
  XCircle,
} from "lucide-react";
import {
  CapacitacionDiapositiva,
  CapacitacionPlantilla,
  EstadoPublicacionPlantilla,
} from "@/types";
import {
  mapPlantillaPreguntasToForm,
  PreguntaPlantillaForm,
  useCapacitacionPlantillas,
} from "@/hooks/useCapacitacionPlantillas";
import { normalizeDiapositivas } from "@/lib/cap-diapositivas";
import { sanitizeRichHtml } from "@/lib/sanitizeHtml";
import { useAlert } from "@/context/AlertContext";

function estadoBadge(estado?: EstadoPublicacionPlantilla | null) {
  if (estado === "pendiente") {
    return {
      label: "Pendiente de aprobación",
      className: "bg-amber-50 text-amber-700 border-amber-100",
      icon: Clock3,
    };
  }
  if (estado === "rechazada") {
    return {
      label: "Rechazada",
      className: "bg-red-50 text-red-700 border-red-100",
      icon: XCircle,
    };
  }
  return {
    label: "Publicada",
    className: "bg-emerald-50 text-emerald-700 border-emerald-100",
    icon: CheckCircle2,
  };
}

function esCorrecto(
  respuestaCorrecta: number | number[],
  optIdx: number,
) {
  if (Array.isArray(respuestaCorrecta)) {
    return respuestaCorrecta.includes(optIdx);
  }
  return Number(respuestaCorrecta) === optIdx;
}

export default function VerPlantillaGlobalPage() {
  const params = useParams();
  const id = String(params.id);
  const router = useRouter();
  const { showAlert, showConfirm } = useAlert();
  const { getPlantillaDetalle, cambiarEstadoPublicacion } =
    useCapacitacionPlantillas();

  const [plantilla, setPlantilla] = useState<CapacitacionPlantilla | null>(
    null,
  );
  const [diapositivas, setDiapositivas] = useState<CapacitacionDiapositiva[]>(
    [],
  );
  const [preguntas, setPreguntas] = useState<PreguntaPlantillaForm[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getPlantillaDetalle(id)
      .then((data) => {
        setPlantilla(data);
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

  const handleAprobar = async () => {
    if (!plantilla) return;
    const ok = await showConfirm(
      "Aprobar publicación",
      `¿Publicar “${plantilla.titulo}” en la biblioteca LT para todos los clientes?`,
      {
        type: "success",
        confirmLabel: "Aprobar y publicar",
        cancelLabel: "Cancelar",
      },
    );
    if (!ok) return;
    setActing(true);
    try {
      const updated = await cambiarEstadoPublicacion(id, {
        estado: "aprobada",
      });
      setPlantilla(updated);
      showAlert(
        "success",
        "Publicada",
        "La capacitación ya está disponible para los demás clientes.",
      );
    } catch {
      showAlert("error", "Error", "No se pudo aprobar la plantilla.");
    } finally {
      setActing(false);
    }
  };

  const handleRechazar = async () => {
    if (!plantilla) return;
    const ok = await showConfirm(
      "Rechazar publicación",
      `¿Rechazar “${plantilla.titulo}”? No aparecerá en la biblioteca LT de los clientes.`,
      { type: "warning", confirmLabel: "Rechazar", cancelLabel: "Cancelar" },
    );
    if (!ok) return;
    setActing(true);
    try {
      const updated = await cambiarEstadoPublicacion(id, {
        estado: "rechazada",
      });
      setPlantilla(updated);
      showAlert("success", "Rechazada", "La plantilla quedó rechazada.");
    } catch {
      showAlert("error", "Error", "No se pudo rechazar la plantilla.");
    } finally {
      setActing(false);
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

  if (error || !plantilla) {
    return (
      <div className="space-y-4 max-w-full mx-auto w-full">
        <p className="text-sm font-semibold text-red-600">
          {error || "Plantilla no encontrada."}
        </p>
        <button
          type="button"
          onClick={() => router.push("/admin/capacitaciones-biblioteca")}
          className="text-sm font-bold text-blue-600"
        >
          Volver a la biblioteca
        </button>
      </div>
    );
  }

  const badge = estadoBadge(plantilla.estado_publicacion);
  const BadgeIcon = badge.icon;
  const isPending = plantilla.estado_publicacion === "pendiente";
  const slides =
    diapositivas.length > 0 ? diapositivas : [{ contenido: "" }];

  return (
    <div className="space-y-8 w-full max-w-full">
      <div className="flex items-start gap-4">
        <Link
          href="/admin/capacitaciones-biblioteca"
          className="h-10 w-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center hover:bg-slate-50 shrink-0"
        >
          <ArrowLeft className="h-5 w-5 text-slate-600" />
        </Link>
        <div className="min-w-0 flex-1 space-y-2">
          <span className="text-sm font-semibold text-slate-500 flex items-center gap-1.5">
            <BookOpen className="h-4 w-4" /> Biblioteca Capacitaciones
          </span>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">
            {plantilla.titulo}
          </h1>
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 font-semibold">
            <span
              className={`inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wide px-2 py-1 rounded-lg border ${badge.className}`}
            >
              <BadgeIcon className="h-3 w-3" />
              {badge.label}
            </span>
            {plantilla.autor_nombre && (
              <span className="inline-flex items-center gap-1.5">
                <User className="h-3.5 w-3.5" />
                Enviada por {plantilla.autor_nombre}
              </span>
            )}
            <span>
              {new Date(plantilla.created_at).toLocaleDateString("es-AR")}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <HelpCircle className="h-3.5 w-3.5" />
              {preguntas.length} preguntas
            </span>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {isPending && (
          <>
            <button
              type="button"
              disabled={acting}
              onClick={() => void handleAprobar()}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold disabled:opacity-50 cursor-pointer"
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              Aprobar
            </button>
            <button
              type="button"
              disabled={acting}
              onClick={() => void handleRechazar()}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-amber-200 bg-amber-50 text-amber-800 text-xs font-bold disabled:opacity-50 cursor-pointer"
            >
              <XCircle className="h-3.5 w-3.5" />
              Rechazar
            </button>
          </>
        )}
        {plantilla.estado_publicacion === "rechazada" && (
          <button
            type="button"
            disabled={acting}
            onClick={() => void handleAprobar()}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold disabled:opacity-50 cursor-pointer"
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            Aprobar igual
          </button>
        )}
        <Link
          href={`/admin/capacitaciones-biblioteca/${id}`}
          className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-700 text-xs font-bold hover:bg-slate-50"
        >
          <Edit2 className="h-3.5 w-3.5" />
          Editar
        </Link>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-6 md:p-8 space-y-5">
        <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
          <Presentation className="h-4 w-4 text-blue-600" />
          Diapositivas ({slides.length})
        </h2>
        <div className="space-y-4">
          {slides.map((slide, idx) => (
            <div
              key={idx}
              className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 space-y-2"
            >
              <span className="text-xs font-black text-slate-700 uppercase tracking-wider">
                Diapositiva {idx + 1}
              </span>
              <div
                className="prose prose-sm max-w-none text-slate-800
                  [&_img]:rounded-xl [&_img]:max-w-full [&_img]:my-3
                  [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5"
                dangerouslySetInnerHTML={{
                  __html: sanitizeRichHtml(slide.contenido || "<p>—</p>"),
                }}
              />
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-6 md:p-8 space-y-5">
        <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
          Preguntas de evaluación ({preguntas.length})
        </h2>
        {preguntas.length === 0 ? (
          <p className="text-sm text-slate-500 font-semibold">
            Esta plantilla no tiene evaluación (solo firma de asistencia).
          </p>
        ) : (
          <div className="space-y-4">
            {preguntas.map((p, idx) => (
              <div
                key={idx}
                className="bg-slate-50 rounded-2xl p-5 space-y-3 border border-slate-100"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs font-black text-slate-700 uppercase">
                    Pregunta {idx + 1}
                  </span>
                  {p.es_multiple && (
                    <span className="text-[10px] font-bold text-blue-600 uppercase">
                      Múltiples correctas
                    </span>
                  )}
                </div>
                <p className="text-sm font-semibold text-slate-800">
                  {p.pregunta || "—"}
                </p>
                <div className="space-y-2">
                  {p.opciones.map((opt, optIdx) => {
                    const correct = esCorrecto(p.respuesta_correcta, optIdx);
                    return (
                      <div
                        key={optIdx}
                        className={`text-xs px-3 py-1.5 rounded-lg flex items-center gap-2 border ${
                          correct
                            ? "bg-emerald-50 text-emerald-700 font-bold border-emerald-200"
                            : "text-slate-600 border-transparent"
                        }`}
                      >
                        {correct ? (
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                        ) : (
                          <div className="h-3.5 w-3.5 rounded-full border border-slate-300 shrink-0" />
                        )}
                        {opt || `Opción ${optIdx + 1}`}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
