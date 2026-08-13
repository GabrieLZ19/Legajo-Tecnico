"use client";

import React, { useEffect, useRef } from "react";
import type SignatureCanvas from "react-signature-canvas";
import { ImagePlus } from "lucide-react";
import {
  SIGNATURE_IMAGE_ACCEPT,
  getClipboardImageFile,
  loadSignatureFromImage,
  readFileAsDataUrl,
} from "@/lib/signature";

interface SignatureImageImportProps {
  canvasRef: React.RefObject<SignatureCanvas | null>;
  /** Si es false, no escucha Ctrl+V / pegado global. */
  enablePaste?: boolean;
  onError?: (message: string) => void;
  onLoaded?: () => void;
  className?: string;
  label?: string;
}

export function SignatureImageImport({
  canvasRef,
  enablePaste = true,
  onError,
  onLoaded,
  className = "",
  label = "Insertar imagen",
}: SignatureImageImportProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const onErrorRef = useRef(onError);
  const onLoadedRef = useRef(onLoaded);

  useEffect(() => {
    onErrorRef.current = onError;
    onLoadedRef.current = onLoaded;
  }, [onError, onLoaded]);

  const applyFile = async (file: File) => {
    const sig = canvasRef.current;
    if (!sig) {
      onErrorRef.current?.("El pad de firma todavía no está listo.");
      return;
    }

    try {
      const dataUrl = await readFileAsDataUrl(file);
      await loadSignatureFromImage(sig, dataUrl);
      onLoadedRef.current?.();
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : "No se pudo insertar la imagen de la firma.";
      onErrorRef.current?.(message);
    }
  };

  const applyFileRef = useRef(applyFile);
  applyFileRef.current = applyFile;

  useEffect(() => {
    if (!enablePaste) return;

    const onPaste = (event: ClipboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }

      const file = getClipboardImageFile(event.clipboardData);
      if (!file) return;

      event.preventDefault();
      void applyFileRef.current(file);
    };

    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [enablePaste]);

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept={SIGNATURE_IMAGE_ACCEPT}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) void applyFile(file);
        }}
      />
      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        className={
          className ||
          "inline-flex items-center gap-1.5 px-3.5 py-2.5 border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-xl text-xs font-bold transition-colors cursor-pointer"
        }
      >
        <ImagePlus className="h-3.5 w-3.5" />
        {label}
      </button>
    </>
  );
}

export default SignatureImageImport;
