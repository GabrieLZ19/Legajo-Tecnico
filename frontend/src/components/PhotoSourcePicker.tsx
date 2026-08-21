"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Camera, ImagePlus, Loader2, SwitchCamera, X } from "lucide-react";
import { compressImage } from "@/lib/compressImage";

type PhotoSourcePickerProps = {
  onSelect: (file: File) => void;
  disabled?: boolean;
  children: ReactNode;
  className?: string;
  triggerClassName?: string;
};

function stopStream(stream: MediaStream | null) {
  stream?.getTracks().forEach((t) => t.stop());
}

/**
 * Sheet: Tomar foto (getUserMedia / webcam) o Buscar desde galería.
 * En desktop abre la webcam; en móvil usa la cámara del dispositivo.
 */
export function PhotoSourcePicker({
  onSelect,
  disabled = false,
  children,
  className,
  triggerClassName,
}: PhotoSourcePickerProps) {
  const uid = useId();
  const galleryRef = useRef<HTMLInputElement>(null);
  const cameraFallbackRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [sheetOpen, setSheetOpen] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [capturing, setCapturing] = useState(false);
  const [facingMode, setFacingMode] = useState<"environment" | "user">(
    "environment",
  );

  const closeCamera = useCallback(() => {
    stopStream(streamRef.current);
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraOpen(false);
    setCameraReady(false);
    setCameraError(null);
    setCapturing(false);
  }, []);

  const startCamera = useCallback(async (facing: "environment" | "user") => {
    setCameraError(null);
    setCameraReady(false);
    stopStream(streamRef.current);
    streamRef.current = null;

    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error("Este navegador no permite acceso a la cámara.");
    }

    const stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: {
        facingMode: { ideal: facing },
        width: { ideal: 1920 },
        height: { ideal: 1080 },
      },
    });

    streamRef.current = stream;
    const video = videoRef.current;
    if (video) {
      video.srcObject = stream;
      await video.play();
      setCameraReady(true);
    }
  }, []);

  useEffect(() => {
    if (!cameraOpen) return;

    let cancelled = false;
    (async () => {
      try {
        await startCamera(facingMode);
      } catch (err) {
        if (cancelled) return;
        const message =
          err instanceof DOMException && err.name === "NotAllowedError"
            ? "Permiso de cámara denegado. Revisá los permisos del navegador."
            : err instanceof Error
              ? err.message
              : "No se pudo abrir la cámara.";
        setCameraError(message);
      }
    })();

    return () => {
      cancelled = true;
      stopStream(streamRef.current);
      streamRef.current = null;
    };
  }, [cameraOpen, facingMode, startCamera]);

  const handleFile = async (file: File | undefined | null) => {
    if (!file) return;
    try {
      const compressed = await compressImage(file);
      onSelect(compressed);
    } catch {
      onSelect(file);
    }
    setSheetOpen(false);
    closeCamera();
    if (galleryRef.current) galleryRef.current.value = "";
    if (cameraFallbackRef.current) cameraFallbackRef.current.value = "";
  };

  const openLiveCamera = () => {
    setSheetOpen(false);
    if (!navigator.mediaDevices?.getUserMedia) {
      // Fallback: input nativo con capture (útil en algunos móviles)
      window.setTimeout(() => cameraFallbackRef.current?.click(), 50);
      return;
    }
    setCameraOpen(true);
  };

  const capturePhoto = async () => {
    const video = videoRef.current;
    if (!video || !cameraReady || capturing) return;

    setCapturing(true);
    try {
      const w = video.videoWidth || 1280;
      const h = video.videoHeight || 720;
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("No se pudo capturar la imagen.");
      // La preview frontal está espejada; igualar el JPEG capturado
      if (facingMode === "user") {
        ctx.translate(w, 0);
        ctx.scale(-1, 1);
      }
      ctx.drawImage(video, 0, 0, w, h);

      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          (b) => (b ? resolve(b) : reject(new Error("Error al generar la foto."))),
          "image/jpeg",
          0.92,
        );
      });

      const file = new File([blob], `evidencia-${Date.now()}.jpg`, {
        type: "image/jpeg",
      });
      await handleFile(file);
    } catch (err) {
      setCameraError(
        err instanceof Error ? err.message : "No se pudo capturar la foto.",
      );
      setCapturing(false);
    }
  };

  const switchFacing = () => {
    setFacingMode((prev) => (prev === "environment" ? "user" : "environment"));
  };

  return (
    <div className={className}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setSheetOpen(true)}
        className={triggerClassName}
      >
        {children}
      </button>

      <input
        id={`${uid}-camera-fallback`}
        ref={cameraFallbackRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        disabled={disabled}
        onChange={(e) => handleFile(e.target.files?.[0])}
      />
      <input
        id={`${uid}-gallery`}
        ref={galleryRef}
        type="file"
        accept="image/*"
        className="hidden"
        disabled={disabled}
        onChange={(e) => handleFile(e.target.files?.[0])}
      />

      {sheetOpen ? (
        <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center">
          <button
            type="button"
            aria-label="Cerrar"
            className="absolute inset-0 bg-slate-950/50 backdrop-blur-[2px]"
            onClick={() => setSheetOpen(false)}
          />
          <div className="relative z-[81] w-full sm:max-w-sm mx-0 sm:mx-4 rounded-t-3xl sm:rounded-3xl bg-white shadow-2xl border border-slate-200 overflow-hidden animate-fadeIn">
            <div className="flex items-center justify-between px-5 pt-4 pb-2">
              <div>
                <h4 className="text-sm font-black text-slate-900">
                  Evidencia fotográfica
                </h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  Elegí cómo querés cargar la foto
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSheetOpen(false)}
                className="p-2 rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
                aria-label="Cerrar opciones"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-4 space-y-2 pb-[max(1rem,env(safe-area-inset-bottom))]">
              <button
                type="button"
                disabled={disabled}
                onClick={openLiveCamera}
                className="w-full flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 hover:bg-blue-50 hover:border-blue-200 px-4 py-3.5 text-left transition-colors disabled:opacity-50"
              >
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-600 text-white shrink-0">
                  <Camera className="h-5 w-5" />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-bold text-slate-900">
                    Tomar foto
                  </span>
                  <span className="block text-xs text-slate-500 mt-0.5">
                    Usar la cámara o webcam
                  </span>
                </span>
              </button>

              <button
                type="button"
                disabled={disabled}
                onClick={() => {
                  setSheetOpen(false);
                  window.setTimeout(() => galleryRef.current?.click(), 50);
                }}
                className="w-full flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 hover:bg-blue-50 hover:border-blue-200 px-4 py-3.5 text-left transition-colors disabled:opacity-50"
              >
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-800 text-white shrink-0">
                  <ImagePlus className="h-5 w-5" />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-bold text-slate-900">
                    Buscar desde galería
                  </span>
                  <span className="block text-xs text-slate-500 mt-0.5">
                    Elegir una imagen ya guardada
                  </span>
                </span>
              </button>

              <button
                type="button"
                onClick={() => setSheetOpen(false)}
                className="w-full mt-1 py-3 text-sm font-bold text-slate-500 hover:text-slate-800 transition-colors"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {cameraOpen ? (
        <div className="fixed inset-0 z-[90] flex flex-col bg-slate-950">
          <div className="flex items-center justify-between px-4 py-3 text-white shrink-0">
            <button
              type="button"
              onClick={closeCamera}
              className="inline-flex items-center gap-2 rounded-full bg-white/10 hover:bg-white/20 px-3 py-2 text-sm font-bold transition-colors"
            >
              <X className="h-4 w-4" />
              Cerrar
            </button>
            <span className="text-sm font-bold tracking-wide">Tomar foto</span>
            <button
              type="button"
              onClick={switchFacing}
              className="inline-flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 p-2.5 transition-colors"
              aria-label="Cambiar cámara"
              title="Cambiar cámara"
            >
              <SwitchCamera className="h-4 w-4" />
            </button>
          </div>

          <div className="relative flex-1 min-h-0 bg-black flex items-center justify-center overflow-hidden">
            {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
            <video
              ref={videoRef}
              playsInline
              muted
              autoPlay
              className={`max-h-full max-w-full object-contain ${
                facingMode === "user" ? "scale-x-[-1]" : ""
              } ${cameraReady && !cameraError ? "opacity-100" : "opacity-0"}`}
            />

            {!cameraReady && !cameraError ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-white">
                <Loader2 className="h-8 w-8 animate-spin text-blue-400" />
                <p className="text-sm font-semibold text-slate-300">
                  Abriendo cámara…
                </p>
              </div>
            ) : null}

            {cameraError ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 px-6 text-center">
                <Camera className="h-10 w-10 text-slate-500" />
                <p className="text-sm font-semibold text-slate-200 max-w-sm">
                  {cameraError}
                </p>
                <div className="flex flex-wrap items-center justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setCameraError(null);
                      void startCamera(facingMode).catch((err) => {
                        setCameraError(
                          err instanceof Error
                            ? err.message
                            : "No se pudo abrir la cámara.",
                        );
                      });
                    }}
                    className="rounded-xl bg-blue-600 hover:bg-blue-500 px-4 py-2.5 text-sm font-bold text-white"
                  >
                    Reintentar
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      closeCamera();
                      window.setTimeout(
                        () => cameraFallbackRef.current?.click(),
                        50,
                      );
                    }}
                    className="rounded-xl bg-white/10 hover:bg-white/20 px-4 py-2.5 text-sm font-bold text-white"
                  >
                    Usar selector del sistema
                  </button>
                </div>
              </div>
            ) : null}
          </div>

          <div className="shrink-0 px-4 pt-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] flex flex-col items-center gap-3">
            <button
              type="button"
              disabled={!cameraReady || !!cameraError || capturing}
              onClick={() => void capturePhoto()}
              className="h-16 w-16 rounded-full border-4 border-white bg-white/20 hover:bg-white/30 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
              aria-label="Capturar"
            >
              {capturing ? (
                <Loader2 className="h-6 w-6 animate-spin text-white" />
              ) : (
                <span className="h-12 w-12 rounded-full bg-white" />
              )}
            </button>
            <p className="text-xs font-semibold text-slate-400">
              Tocá el botón para capturar
            </p>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default PhotoSourcePicker;
