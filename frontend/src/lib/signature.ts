/**
 * Helpers para react-signature-canvas.
 * No usamos getTrimmedCanvas(): en móviles suele colgarse o fallar
 * cuando el canvas se dimensiona por CSS / hay resize del viewport.
 */
import type SignatureCanvas from "react-signature-canvas";

export function exportSignaturePng(sig: SignatureCanvas): string {
  const canvas = sig.getCanvas();
  if (!canvas || canvas.width === 0 || canvas.height === 0) {
    throw new Error("No se pudo leer la firma. Probá firmar de nuevo.");
  }

  const dataUrl = canvas.toDataURL("image/png");
  if (!dataUrl || dataUrl === "data:," || dataUrl.length < 100) {
    throw new Error("La firma quedó vacía. Probá firmar de nuevo.");
  }

  return dataUrl;
}

export function isSignatureEmpty(sig: SignatureCanvas | null): boolean {
  if (!sig) return true;
  try {
    return sig.isEmpty();
  } catch {
    return true;
  }
}
