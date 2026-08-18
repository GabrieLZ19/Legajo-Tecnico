"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Minimize2,
  Presentation,
  X,
} from "lucide-react";
import { Capacitacion, CapacitacionDiapositiva } from "@/types";
import { useCapacitaciones } from "@/hooks/useCapacitaciones";
import { normalizeDiapositivas } from "@/lib/cap-diapositivas";

type FsDocument = Document & {
  webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => Promise<void> | void;
};

type FsElement = HTMLElement & {
  webkitRequestFullscreen?: () => Promise<void> | void;
};

function getFullscreenElement(): Element | null {
  const doc = document as FsDocument;
  return document.fullscreenElement || doc.webkitFullscreenElement || null;
}

async function requestFullscreen(el: FsElement) {
  if (el.requestFullscreen) {
    await el.requestFullscreen();
    return;
  }
  if (el.webkitRequestFullscreen) {
    await el.webkitRequestFullscreen();
  }
}

async function exitFullscreen() {
  const doc = document as FsDocument;
  if (document.exitFullscreen) {
    await document.exitFullscreen();
    return;
  }
  if (doc.webkitExitFullscreen) {
    await doc.webkitExitFullscreen();
  }
}

const slideHtmlClass =
  "cap-html-content-invert prose prose-invert max-w-4xl mx-auto text-left " +
  "[&_ul]:list-disc [&_ul]:pl-6 [&_ul]:my-3 [&_ul]:space-y-2 " +
  "[&_ol]:list-decimal [&_ol]:pl-6 [&_ol]:my-3 [&_ol]:space-y-2 " +
  "[&_p]:mb-3 [&_h1]:text-4xl [&_h1]:font-black [&_h1]:mb-4 " +
  "[&_h2]:text-3xl [&_h2]:font-bold [&_h2]:mb-3 " +
  "[&_h3]:text-2xl [&_h3]:font-bold [&_h3]:mb-2 " +
  "[&_strong]:font-bold [&_em]:italic " +
  "[&_img]:rounded-2xl [&_img]:max-w-full [&_img]:my-4 [&_img]:mx-auto [&_img]:shadow-lg " +
  "[&_table]:my-4 [&_table]:w-full " +
  "text-xl md:text-2xl leading-relaxed text-slate-100";

export default function PresentarCapacitacionPage() {
  const params = useParams();
  const id = params.id as string;
  const router = useRouter();
  const { getCapacitacionDetalle, getCapacitacionQr } = useCapacitaciones();

  const [cap, setCap] = useState<Capacitacion | null>(null);
  const [slides, setSlides] = useState<CapacitacionDiapositiva[]>([]);
  const [qrData, setQrData] = useState<{ qr: string; url: string } | null>(
    null,
  );
  const [index, setIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const stageRef = useRef<HTMLDivElement>(null);
  const exitedFullscreenAt = useRef(0);

  // total = slides + QR final
  const total = slides.length + 1;
  const isQrSlide = index === slides.length;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const data = await getCapacitacionDetalle(id);
        if (cancelled) return;
        setCap(data);
        setSlides(normalizeDiapositivas(data.diapositivas, data.temario));
        try {
          const qr = await getCapacitacionQr(id);
          if (!cancelled) setQrData(qr);
        } catch {
          // QR opcional si falla; la slide final igual se muestra
        }
      } catch {
        if (!cancelled) setError("No se pudo cargar la presentación.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- cargar una vez por id
  }, [id]);

  const goPrev = useCallback(() => {
    setIndex((i) => Math.max(0, i - 1));
  }, []);

  const goNext = useCallback(() => {
    setIndex((i) => Math.min(total - 1, i + 1));
  }, [total]);

  const salir = useCallback(() => {
    if (getFullscreenElement()) {
      void exitFullscreen().catch(() => undefined);
    }
    router.push(`/capacitaciones/${id}`);
  }, [router, id]);

  const toggleFullscreen = useCallback(async () => {
    try {
      if (getFullscreenElement()) {
        await exitFullscreen();
        return;
      }
      const el = stageRef.current;
      if (!el) return;
      await requestFullscreen(el);
    } catch {
      // Algunos navegadores (p. ej. iOS) no permiten fullscreen en este elemento
    }
  }, []);

  useEffect(() => {
    const sync = () => {
      const active = Boolean(getFullscreenElement());
      setIsFullscreen(active);
      if (!active) exitedFullscreenAt.current = Date.now();
    };
    document.addEventListener("fullscreenchange", sync);
    document.addEventListener("webkitfullscreenchange", sync);
    return () => {
      document.removeEventListener("fullscreenchange", sync);
      document.removeEventListener("webkitfullscreenchange", sync);
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === " " || e.key === "PageDown") {
        e.preventDefault();
        goNext();
      } else if (e.key === "ArrowLeft" || e.key === "PageUp") {
        e.preventDefault();
        goPrev();
      } else if (e.key === "f" || e.key === "F") {
        e.preventDefault();
        void toggleFullscreen();
      } else if (e.key === "Escape") {
        // Esc sale de pantalla completa; no cerrar la presentación en el mismo toque
        if (getFullscreenElement() || Date.now() - exitedFullscreenAt.current < 400) {
          return;
        }
        e.preventDefault();
        salir();
      } else if (e.key === "Home") {
        e.preventDefault();
        setIndex(0);
      } else if (e.key === "End") {
        e.preventDefault();
        setIndex(total - 1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [goNext, goPrev, salir, toggleFullscreen, total]);

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 bg-slate-950 flex flex-col items-center justify-center text-slate-300">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-blue-400" />
        <p className="mt-4 text-sm font-semibold">Cargando presentación…</p>
      </div>
    );
  }

  if (error || !cap) {
    return (
      <div className="fixed inset-0 z-50 bg-slate-950 flex flex-col items-center justify-center gap-4 text-slate-200">
        <p className="font-semibold">{error || "Capacitación no encontrada"}</p>
        <button
          type="button"
          onClick={salir}
          className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-sm font-bold"
        >
          Volver
        </button>
      </div>
    );
  }

  return (
    <div
      ref={stageRef}
      className="fixed inset-0 z-50 bg-slate-950 text-white flex flex-col"
    >
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 sm:px-6 py-3 border-b border-white/10 bg-black/40 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <Presentation className="h-4 w-4 text-blue-400 shrink-0" />
          <h1 className="text-sm sm:text-base font-bold truncate">
            {cap.titulo}
          </h1>
        </div>
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <span className="text-xs font-bold text-slate-400 tabular-nums">
            {index + 1} / {total}
          </span>
          <button
            type="button"
            onClick={() => void toggleFullscreen()}
            aria-pressed={isFullscreen}
            className="inline-flex items-center gap-1.5 min-h-9 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-bold transition-colors"
            title={
              isFullscreen
                ? "Salir de pantalla completa (Esc o F)"
                : "Proyectar en pantalla completa (F)"
            }
          >
            {isFullscreen ? (
              <Minimize2 className="h-3.5 w-3.5" />
            ) : (
              <Maximize2 className="h-3.5 w-3.5" />
            )}
            <span className="hidden sm:inline">
              {isFullscreen ? "Ventana" : "Pantalla completa"}
            </span>
          </button>
          <button
            type="button"
            onClick={salir}
            className="inline-flex items-center gap-1.5 min-h-9 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-bold transition-colors"
            title="Salir (Esc)"
          >
            <X className="h-3.5 w-3.5" />
            Salir
          </button>
        </div>
      </div>

      {/* Slide content */}
      <div className="flex-1 overflow-y-auto flex items-center justify-center px-4 sm:px-10 py-8">
        {isQrSlide ? (
          <div className="flex flex-col items-center gap-6 text-center max-w-lg">
            <h2 className="text-3xl sm:text-4xl font-black tracking-tight">
              {cap?.con_evaluacion === false ? "Firma de asistencia" : "Evaluación"}
            </h2>
            <p className="text-slate-300 text-base sm:text-lg font-medium">
              {cap?.con_evaluacion === false
                ? "Escaneá el código QR para firmar y registrar la asistencia"
                : "Escaneá el código QR para completar la evaluación"}
            </p>
            {qrData?.qr ? (
              <img
                src={qrData.qr}
                alt={
                  cap?.con_evaluacion === false
                    ? "QR de asistencia"
                    : "QR de evaluación"
                }
                className="w-64 h-64 sm:w-80 sm:h-80 rounded-2xl bg-white p-4 shadow-2xl"
              />
            ) : (
              <div className="w-64 h-64 sm:w-80 sm:h-80 rounded-2xl bg-white/10 flex items-center justify-center text-slate-400 text-sm font-semibold">
                QR no disponible
              </div>
            )}
            {qrData?.url && (
              <p className="text-sm sm:text-base text-blue-300 font-mono break-all px-2">
                {qrData.url}
              </p>
            )}
          </div>
        ) : (
          <div
            className={slideHtmlClass}
            dangerouslySetInnerHTML={{
              __html: slides[index]?.contenido || "",
            }}
          />
        )}
      </div>

      {/* Controls */}
      <div className="shrink-0 border-t border-white/10 bg-black/40 px-4 sm:px-6 py-4 flex items-center justify-between gap-4">
        <button
          type="button"
          onClick={goPrev}
          disabled={index === 0}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 disabled:opacity-30 disabled:cursor-not-allowed text-sm font-bold transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
          Anterior
        </button>

        <div className="hidden sm:flex items-center gap-1.5">
          {Array.from({ length: total }).map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setIndex(i)}
              className={`h-2 rounded-full transition-all ${
                i === index
                  ? "w-6 bg-blue-400"
                  : "w-2 bg-white/30 hover:bg-white/50"
              }`}
              aria-label={`Ir a diapositiva ${i + 1}`}
            />
          ))}
        </div>

        <button
          type="button"
          onClick={goNext}
          disabled={index >= total - 1}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-30 disabled:cursor-not-allowed text-sm font-bold transition-colors"
        >
          Siguiente
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
