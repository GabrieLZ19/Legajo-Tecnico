"use client";

import React, { useRef, useState } from "react";
import type SignatureCanvas from "react-signature-canvas";
import { Stamp } from "lucide-react";
import {
  fetchImageAsDataUrl,
  loadSignatureFromImage,
} from "@/lib/signature";
import { perfilSelloService } from "@/utils/services/perfilSello.service";

type UsarMiSelloButtonProps = {
  canvasRef: React.RefObject<SignatureCanvas | null>;
  selloUrl?: string | null;
  /** Se llama con la URL firmada cuando el usuario sube un sello por primera vez. */
  onSelloChanged?: (selloUrl: string) => void;
  onError?: (message: string) => void;
  onLoaded?: () => void;
  className?: string;
  label?: string;
  /**
   * Si no hay sello precargado, abre el selector de archivo para subirlo
   * y usarlo en el pad (default: true).
   */
  allowUploadWhenMissing?: boolean;
};

/**
 * Inserta en el pad la firma/sello precargada del usuario logueado.
 * Si todavía no tiene sello, permite cargarlo en el momento.
 */
export function UsarMiSelloButton({
  canvasRef,
  selloUrl,
  onSelloChanged,
  onError,
  onLoaded,
  className = "",
  label = "Insertar mi sello",
  allowUploadWhenMissing = true,
}: UsarMiSelloButtonProps) {
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!selloUrl && !allowUploadWhenMissing) return null;

  const applySelloToPad = async (url: string) => {
    const sig = canvasRef.current;
    if (!sig) {
      onError?.("El pad de firma todavía no está listo.");
      return;
    }
    const dataUrl = await fetchImageAsDataUrl(url);
    await loadSignatureFromImage(sig, dataUrl);
    onLoaded?.();
  };

  const handleClick = async () => {
    if (!selloUrl) {
      fileInputRef.current?.click();
      return;
    }

    setLoading(true);
    try {
      await applySelloToPad(selloUrl);
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

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      onError?.("El sello debe ser una imagen JPG, PNG o WEBP.");
      return;
    }

    setLoading(true);
    try {
      const url = await perfilSelloService.subirMiSello(file);
      onSelloChanged?.(url);
      await applySelloToPad(url);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: string } } };
      onError?.(
        axiosErr.response?.data?.error ||
          (err instanceof Error ? err.message : "No se pudo subir tu sello."),
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/jpg"
        className="hidden"
        onChange={(e) => void handleFileChange(e)}
      />
      <button
        type="button"
        onClick={() => void handleClick()}
        disabled={loading}
        title={
          selloUrl
            ? "Insertar tu sello precargado en la firma"
            : "Cargar tu sello y usarlo en la firma"
        }
        className={
          className ||
          "inline-flex items-center gap-1.5 px-3.5 py-2.5 border border-blue-200 bg-blue-50 hover:bg-blue-100 text-blue-800 rounded-xl text-xs font-bold transition-colors cursor-pointer disabled:opacity-50"
        }
      >
        <Stamp className="h-3.5 w-3.5" />
        {loading ? "Cargando…" : label}
      </button>
    </>
  );
}

export default UsarMiSelloButton;
