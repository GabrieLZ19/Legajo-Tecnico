"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { sanitizeRichHtml } from "@/lib/sanitizeHtml";
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

/** Base de medición en fullscreen; el scale real lo aplica el contenedor. */
const slideHtmlFullscreenClass =
  "cap-html-content-invert cap-slide-fullscreen prose prose-invert max-w-none w-max mx-auto text-center " +
  "[&_ul]:list-disc [&_ul]:pl-6 [&_ul]:my-3 [&_ul]:space-y-2 [&_ul]:text-left " +
  "[&_ol]:list-decimal [&_ol]:pl-6 [&_ol]:my-3 [&_ol]:space-y-2 [&_ol]:text-left " +
  "[&_p]:mb-3 " +
  "[&_h1]:text-4xl [&_h1]:font-black [&_h1]:mb-4 " +
  "[&_h2]:text-3xl [&_h2]:font-bold [&_h2]:mb-3 " +
  "[&_h3]:text-2xl [&_h3]:font-bold [&_h3]:mb-2 " +
  "[&_strong]:font-bold [&_em]:italic " +
  "[&_img]:rounded-2xl [&_img]:mx-auto [&_img]:shadow-2xl [&_img]:block " +
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
  const [slideScale, setSlideScale] = useState(1);
  const [slideReady, setSlideReady] = useState(true);
  const stageRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const exitedFullscreenAt = useRef(0);

  // total = slides + QR final
  const total = slides.length + 1;
  const isQrSlide = index === slides.length;
  const fitKey = `${index}-${isFullscreen}-${isQrSlide}`;
  const [fitTrack, setFitTrack] = useState(fitKey);

  // Ocultar de inmediato al cambiar slide/fullscreen para no pintar el tamaño sin escalar
  if (fitTrack !== fitKey) {
    setFitTrack(fitKey);
    if (isFullscreen && !isQrSlide) {
      setSlideReady(false);
      setSlideScale(1);
    } else {
      setSlideReady(true);
      setSlideScale(1);
    }
  }

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

  /** Escala el slide para llenar el área útil (como un proyector). */
  const measureSlideScale = useCallback((): number | null => {
    const viewport = viewportRef.current;
    const content = contentRef.current;
    if (!viewport || !content) return null;
    if (!isFullscreen || isQrSlide) return 1;

    const pad = 16;
    const vw = Math.max(0, viewport.clientWidth - pad * 2);
    const vh = Math.max(0, viewport.clientHeight - pad * 2);
    const cw = content.offsetWidth;
    const ch = content.offsetHeight;
    if (vw < 1 || vh < 1 || cw < 1 || ch < 1) return null;

    return Math.min(Math.max(Math.min(vw / cw, vh / ch), 0.2), 6);
  }, [isFullscreen, isQrSlide]);

  const applySlideScale = useCallback(
    (next: number) => {
      setSlideScale(next);
      const el = contentRef.current;
      if (el && isFullscreen && !isQrSlide) {
        el.style.transform = `scale(${next})`;
        el.style.transformOrigin = "center center";
        el.style.opacity = "1";
      }
      setSlideReady(true);
    },
    [isFullscreen, isQrSlide],
  );

  useLayoutEffect(() => {
    if (!isFullscreen || isQrSlide) {
      const el = contentRef.current;
      if (el) {
        el.style.transform = "";
        el.style.opacity = "";
      }
      setSlideScale(1);
      setSlideReady(true);
      return;
    }

    const content = contentRef.current;
    if (content) {
      content.style.opacity = "0";
      content.style.transform = "scale(1)";
      content.style.transformOrigin = "center center";
    }

    const tryApply = () => {
      const next = measureSlideScale();
      if (next == null) return false;
      applySlideScale(next);
      return true;
    };

    if (tryApply()) return;

    const imgs = Array.from(content?.querySelectorAll("img") ?? []);
    const pending = imgs.filter((img) => !img.complete);
    if (pending.length === 0) {
      // Dimensiones aún no disponibles: reintentar en el próximo frame
      const rafId = requestAnimationFrame(() => {
        if (!tryApply()) applySlideScale(1);
      });
      return () => cancelAnimationFrame(rafId);
    }

    let cancelled = false;
    const onImg = () => {
      if (cancelled) return;
      if (pending.every((img) => img.complete)) {
        if (!tryApply()) applySlideScale(1);
      }
    };
    pending.forEach((img) => {
      img.addEventListener("load", onImg);
      img.addEventListener("error", onImg);
    });

    return () => {
      cancelled = true;
      pending.forEach((img) => {
        img.removeEventListener("load", onImg);
        img.removeEventListener("error", onImg);
      });
    };
  }, [applySlideScale, isFullscreen, isQrSlide, index, measureSlideScale, slides]);

  useEffect(() => {
    if (!isFullscreen || isQrSlide) return;
    const viewport = viewportRef.current;
    if (!viewport) return;

    const ro = new ResizeObserver(() => {
      const next = measureSlideScale();
      if (next != null) applySlideScale(next);
    });
    ro.observe(viewport);
    return () => ro.disconnect();
  }, [applySlideScale, isFullscreen, isQrSlide, measureSlideScale]);

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
      <div
        ref={viewportRef}
        className={`flex-1 min-h-0 flex items-center justify-center ${
          isFullscreen
            ? "overflow-hidden px-2 py-2"
            : "overflow-y-auto px-4 sm:px-10 py-8"
        }`}
      >
        {isQrSlide ? (
          <div
            className={`flex flex-col items-center gap-6 text-center ${
              isFullscreen ? "max-w-3xl" : "max-w-lg"
            }`}
          >
            <h2
              className={`font-black tracking-tight ${
                isFullscreen
                  ? "text-4xl sm:text-5xl lg:text-6xl"
                  : "text-3xl sm:text-4xl"
              }`}
            >
              {cap?.con_evaluacion === false ? "Firma de asistencia" : "Evaluación"}
            </h2>
            <p
              className={`text-slate-300 font-medium ${
                isFullscreen ? "text-lg sm:text-xl" : "text-base sm:text-lg"
              }`}
            >
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
                className={`rounded-2xl bg-white p-4 shadow-2xl ${
                  isFullscreen
                    ? "w-[min(28rem,70vw)] h-[min(28rem,70vw)] max-h-[calc(100dvh-14rem)]"
                    : "w-64 h-64 sm:w-80 sm:h-80"
                }`}
              />
            ) : (
              <div
                className={`rounded-2xl bg-white/10 flex items-center justify-center text-slate-400 text-sm font-semibold ${
                  isFullscreen
                    ? "w-[min(28rem,70vw)] h-[min(28rem,70vw)]"
                    : "w-64 h-64 sm:w-80 sm:h-80"
                }`}
              >
                QR no disponible
              </div>
            )}
            {qrData?.url && (
              <p
                className={`text-blue-300 font-mono break-all px-2 ${
                  isFullscreen ? "text-base sm:text-lg" : "text-sm sm:text-base"
                }`}
              >
                {qrData.url}
              </p>
            )}
          </div>
        ) : (
          <div
            ref={contentRef}
            className={isFullscreen ? slideHtmlFullscreenClass : slideHtmlClass}
            style={
              isFullscreen
                ? {
                    transform: `scale(${slideScale})`,
                    transformOrigin: "center center",
                    opacity: slideReady ? 1 : 0,
                    willChange: "transform, opacity",
                  }
                : undefined
            }
            dangerouslySetInnerHTML={{
              __html: sanitizeRichHtml(slides[index]?.contenido || ""),
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
