"use client";

import { ImagePlus, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useAlert } from "@/context/AlertContext";
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
  hint = "PNG o JPG, hasta 5 MB · Ctrl+V para pegar un recorte",
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

  const applyFile = (next: File | null) => {
    if (!next) return;
    if (!next.type.startsWith("image/")) {
      showAlertRef.current(
        "warning",
        "Formato no válido",
        "Usá una imagen PNG, JPG, WEBP o GIF.",
      );
      return;
    }
    if (next.size > MAX_IMAGE_BYTES) {
      showAlertRef.current(
        "warning",
        "Archivo demasiado grande",
        "La imagen supera el máximo de 5 MB.",
      );
      return;
    }
    // Renombrar recortes del clipboard (suelen venir como "image.png")
    const named =
      !next.name || next.name === "image.png" || next.name === "image.jpg"
        ? new File([next], `recorte-${Date.now()}.png`, {
            type: next.type || "image/png",
          })
        : next;
    onChangeRef.current(named);
  };

  useEffect(() => {
    if (!enablePaste) return;

    const onPaste = (event: ClipboardEvent) => {
      if (isTypingTarget(event.target)) return;

      const pasted = getClipboardImageFile(event.clipboardData);
      if (!pasted) return;

      event.preventDefault();
      applyFile(pasted);
    };

    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [enablePaste]);

  const shown = localPreview || previewUrl || null;
  const captureAttr =
    capture === true ? "environment" : capture === false || capture == null ? undefined : capture;

  const openPicker = () => inputRef.current?.click();

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
          if (dropped) applyFile(dropped);
        }}
        onPaste={(e) => {
          const pasted = getClipboardImageFile(e.clipboardData);
          if (!pasted) return;
          e.preventDefault();
          e.stopPropagation();
          applyFile(pasted);
        }}
        className={`flex items-center gap-3 w-full cursor-pointer rounded-2xl border-2 border-dashed transition-colors p-3 outline-none focus-visible:ring-2 focus-visible:ring-blue-500/30 ${
          dragging
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
            {file
              ? file.name
              : shown
                ? "Cambiar foto"
                : dragging
                  ? "Soltá la imagen acá"
                  : "Elegir, arrastrar o pegar foto"}
          </p>
          <p className="text-[11px] text-slate-400 font-semibold">{hint}</p>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          capture={captureAttr}
          className="sr-only"
          onChange={(e) => {
            const next = e.target.files?.[0] ?? null;
            e.target.value = "";
            applyFile(next);
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
