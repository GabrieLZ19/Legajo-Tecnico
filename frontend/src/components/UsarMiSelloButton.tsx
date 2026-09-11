"use client";

import React, { useState } from "react";
import type SignatureCanvas from "react-signature-canvas";
import { Stamp } from "lucide-react";
import {
  fetchImageAsDataUrl,
  loadSignatureFromImage,
} from "@/lib/signature";

type UsarMiSelloButtonProps = {
  canvasRef: React.RefObject<SignatureCanvas | null>;
  selloUrl?: string | null;
  onError?: (message: string) => void;
  onLoaded?: () => void;
  className?: string;
  label?: string;
};

/**
 * Inserta en el pad la firma/sello precargada del usuario logueado.
 */
export function UsarMiSelloButton({
  canvasRef,
  selloUrl,
  onError,
  onLoaded,
  className = "",
  label = "Usar mi sello",
}: UsarMiSelloButtonProps) {
  const [loading, setLoading] = useState(false);

  if (!selloUrl) return null;

  const handleClick = async () => {
    const sig = canvasRef.current;
    if (!sig) {
      onError?.("El pad de firma todavía no está listo.");
      return;
    }
    setLoading(true);
    try {
      const dataUrl = await fetchImageAsDataUrl(selloUrl);
      await loadSignatureFromImage(sig, dataUrl);
      onLoaded?.();
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : "No se pudo cargar tu sello precargado.";
      onError?.(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={() => void handleClick()}
      disabled={loading}
      className={
        className ||
        "inline-flex items-center gap-1.5 px-3.5 py-2.5 border border-blue-200 bg-blue-50 hover:bg-blue-100 text-blue-800 rounded-xl text-xs font-bold transition-colors cursor-pointer disabled:opacity-50"
      }
    >
      <Stamp className="h-3.5 w-3.5" />
      {loading ? "Cargando…" : label}
    </button>
  );
}

export default UsarMiSelloButton;
