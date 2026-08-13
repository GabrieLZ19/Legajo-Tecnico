/**
 * Helpers para react-signature-canvas.
 * No usamos getTrimmedCanvas(): en móviles suele colgarse o fallar
 * cuando el canvas se dimensiona por CSS / hay resize del viewport.
 */
import type SignatureCanvas from "react-signature-canvas";

export const SIGNATURE_IMAGE_ACCEPT =
  "image/png,image/jpeg,image/jpg,image/webp,image/gif";

const ACCEPTED_SIGNATURE_IMAGE_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
  "image/gif",
]);

const MAX_SIGNATURE_IMAGE_BYTES = 5 * 1024 * 1024;

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

export function assertSignatureImageFile(file: File): void {
  if (!ACCEPTED_SIGNATURE_IMAGE_TYPES.has(file.type)) {
    throw new Error(
      "Formato no válido. Usá PNG, JPG, WEBP o GIF.",
    );
  }
  if (file.size > MAX_SIGNATURE_IMAGE_BYTES) {
    throw new Error("La imagen supera el máximo de 5 MB.");
  }
}

export function readFileAsDataUrl(file: File): Promise<string> {
  assertSignatureImageFile(file);
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
        return;
      }
      reject(new Error("No se pudo leer la imagen."));
    };
    reader.onerror = () => reject(new Error("No se pudo leer la imagen."));
    reader.readAsDataURL(file);
  });
}

export function getClipboardImageFile(
  clipboardData: DataTransfer | null | undefined,
): File | null {
  if (!clipboardData) return null;

  const items = Array.from(clipboardData.items || []);
  for (const item of items) {
    if (item.type.startsWith("image/")) {
      const file = item.getAsFile();
      if (file) return file;
    }
  }

  const files = Array.from(clipboardData.files || []);
  return files.find((f) => f.type.startsWith("image/")) || null;
}

/**
 * Dibuja la imagen centrada y escalada dentro del pad.
 * Usa fromDataURL para que isEmpty() quede en false.
 */
export function loadSignatureFromImage(
  sig: SignatureCanvas,
  dataUrl: string,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const target = sig.getCanvas();
    if (!target || target.width === 0 || target.height === 0) {
      reject(new Error("El pad de firma todavía no está listo."));
      return;
    }

    const img = new Image();
    img.onload = () => {
      try {
        const temp = document.createElement("canvas");
        temp.width = target.width;
        temp.height = target.height;
        const ctx = temp.getContext("2d");
        if (!ctx) {
          reject(new Error("No se pudo preparar la imagen de firma."));
          return;
        }

        ctx.fillStyle = "#f8fafc";
        ctx.fillRect(0, 0, temp.width, temp.height);

        const scale = Math.min(
          temp.width / img.width,
          temp.height / img.height,
        );
        const drawW = img.width * scale;
        const drawH = img.height * scale;
        const x = (temp.width - drawW) / 2;
        const y = (temp.height - drawH) / 2;
        ctx.drawImage(img, x, y, drawW, drawH);

        sig.clear();
        // ratio: 1 evita el default devicePixelRatio de signature_pad,
        // que dibuja la imagen a la mitad y la desalinea.
        sig.fromDataURL(temp.toDataURL("image/png"), {
          ratio: 1,
          width: target.width,
          height: target.height,
        });
        resolve();
      } catch {
        reject(new Error("No se pudo insertar la imagen en el pad."));
      }
    };
    img.onerror = () =>
      reject(new Error("No se pudo cargar la imagen de la firma."));
    img.src = dataUrl;
  });
}
