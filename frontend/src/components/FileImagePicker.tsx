"use client";

import { ImagePlus, Loader2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useAlert } from "@/context/AlertContext";
import { compressImage } from "@/lib/compressImage";
import { getClipboardImageFile } from "@/lib/signature";

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

type FileImagePickerProps = {
  file: File | null;
  onChange: (file: File | null) => void;
  label?: string;
  hint?: string;
  previewUrl?: string | null;
  /** En móvil abre la cámara trasera cuando el navegador lo soporta. */
  capture?: boolean | "user" | "environment";
  /** Si es false, no escucha Ctrl+V / pegado global. */
  enablePaste?: boolean;
};

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.tagName === "INPUT" ||
    target.tagName === "TEXTAREA" ||
    target.isContentEditable
  );
}

export function FileImagePicker({
  file,
  onChange,
  label = "Foto",
  hint = "JPG, PNG, WEBP, GIF o HEIC, hasta 5 MB · Ctrl+V para pegar un recorte",
  previewUrl,
  capture,
  enablePaste = true,
}: FileImagePickerProps) {
  const { showAlert } = useAlert();
  const inputRef = useRef<HTMLInputElement>(null);
  const onChangeRef = useRef(onChange);
  const showAlertRef = useRef(showAlert);
  const [localPreview, setLocalPreview] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [processing, setProcessing] = useState(false);
  const dragDepthRef = useRef(0);

  onChangeRef.current = onChange;
  showAlertRef.current = showAlert;

  useEffect(() => {
    if (!file) {
      setLocalPreview(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setLocalPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const applyFile = async (next: File | null) => {
    if (!next) return;
    const mime = (next.type || "").toLowerCase();
    const looksImage =
      mime.startsWith("image/") ||
      /\.(jpe?g|png|webp|heic|heif|gif|bmp|jfif)$/i.test(next.name || "");
    if (!looksImage) {
      showAlertRef.current(
        "warning",
        "Formato no válido",
        "Usá JPG, PNG, WEBP, GIF o HEIC (o pegá un recorte con Ctrl+V).",
      );
      return;
    }

    setProcessing(true);
    try {
      const compressed = await compressImage(next);
      if (compressed.size > MAX_IMAGE_BYTES) {
        showAlertRef.current(
          "warning",
          "Archivo demasiado grande",
          "La imagen supera el máximo de 5 MB. Probá con otra más liviana.",
        );
        return;
      }
      // Renombrar recortes del clipboard (suelen venir como "image.png")
      const named =
        !compressed.name ||
        compressed.name === "image.png" ||
        compressed.name === "image.jpg"
          ? new File([compressed], `recorte-${Date.now()}.jpg`, {
              type: compressed.type || "image/jpeg",
            })
          : compressed;
      onChangeRef.current(named);
    } catch (err) {
      showAlertRef.current(
        "warning",
        "No se pudo usar la imagen",
        err instanceof Error
          ? err.message
          : "Usá JPG, PNG o WEBP (máx. 5 MB).",
      );
    } finally {
      setProcessing(false);
    }
  };

  useEffect(() => {
    if (!enablePaste) return;

    const onPaste = (event: ClipboardEvent) => {
      if (isTypingTarget(event.target)) return;

      const pasted = getClipboardImageFile(event.clipboardData);
      if (!pasted) return;

      event.preventDefault();
      void applyFile(pasted);
    };

    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [enablePaste]);

  const shown = localPreview || previewUrl || null;
  const captureAttr =
    capture === true ? "environment" : capture === false || capture == null ? undefined : capture;

  const openPicker = () => {
    if (processing) return;
    inputRef.current?.click();
  };

  return (
    <div className="space-y-1.5">
      <span className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider">
        {label}
      </span>
      <div
        role="button"
        tabIndex={0}
        onClick={openPicker}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            openPicker();
          }
        }}
        onDragEnter={(e) => {
          e.preventDefault();
          e.stopPropagation();
          dragDepthRef.current += 1;
          setDragging(true);
        }}
        onDragOver={(e) => {
          e.preventDefault();
          e.stopPropagation();
          e.dataTransfer.dropEffect = "copy";
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          e.stopPropagation();
          dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
          if (dragDepthRef.current === 0) setDragging(false);
        }}
        onDrop={(e) => {
          e.preventDefault();
          e.stopPropagation();
          dragDepthRef.current = 0;
          setDragging(false);
          const dropped = getClipboardImageFile(e.dataTransfer);
          if (dropped) void applyFile(dropped);
        }}
        onPaste={(e) => {
          const pasted = getClipboardImageFile(e.clipboardData);
          if (!pasted) return;
          e.preventDefault();
          e.stopPropagation();
          void applyFile(pasted);
        }}
        className={`flex items-center gap-3 w-full cursor-pointer rounded-2xl border-2 border-dashed transition-colors p-3 outline-none focus-visible:ring-2 focus-visible:ring-blue-500/30 ${
          processing
            ? "pointer-events-none opacity-70 border-slate-200 bg-slate-50"
            : dragging
              ? "border-blue-500 bg-blue-50"
              : "border-slate-200 bg-slate-50 hover:border-blue-400 hover:bg-blue-50/40"
        }`}
      >
        <div className="h-14 w-14 rounded-xl bg-white border border-slate-100 overflow-hidden flex items-center justify-center shrink-0">
          {shown ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={shown} alt="Vista previa" className="h-full w-full object-cover" />
          ) : (
            <ImagePlus className="h-6 w-6 text-blue-500" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-slate-800 truncate">
            {processing
              ? "Procesando imagen..."
              : file
                ? file.name
                : shown
                  ? "Cambiar foto"
                  : dragging
                    ? "Soltá la imagen acá"
                    : "Elegir, arrastrar o pegar foto"}
          </p>
          <p className="text-[11px] text-slate-400 font-semibold">{hint}</p>
        </div>
        {processing ? (
          <Loader2 className="h-5 w-5 text-blue-500 animate-spin shrink-0" />
        ) : null}
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif,image/bmp,image/heic,image/heif,image/*,.jpg,.jpeg,.png,.webp,.gif,.bmp,.heic,.heif,.jfif"
          capture={captureAttr}
          disabled={processing}
          className="sr-only"
          onChange={(e) => {
            const next = e.target.files?.[0] ?? null;
            e.target.value = "";
            void applyFile(next);
          }}
        />
      </div>
      {file && (
        <button
          type="button"
          onClick={() => onChange(null)}
          className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-400 hover:text-rose-600 cursor-pointer"
        >
          <X className="h-3 w-3" />
          Quitar archivo
        </button>
      )}
    </div>
  );
}
