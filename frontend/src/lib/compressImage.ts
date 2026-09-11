/** MIME aceptados por el backend (multer) para fotos. */
export const ALLOWED_IMAGE_MIME = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
]);

const CONVERTIBLE_MIME = new Set([
  ...ALLOWED_IMAGE_MIME,
  "image/heic",
  "image/heif",
  "image/gif",
  "image/bmp",
  "image/pjpeg",
  "image/jfif",
]);

function isAllowedMime(type: string): boolean {
  return ALLOWED_IMAGE_MIME.has(type.toLowerCase());
}

/**
 * Comprime / normaliza una imagen del lado del cliente.
 * Convierte HEIC/GIF/BMP a JPEG cuando el navegador puede decodificarlos
 * (p. ej. Safari en iPhone), para que pasen el filtro del backend.
 */
export async function compressImage(
  file: File,
  options?: { maxWidth?: number; maxHeight?: number; quality?: number },
): Promise<File> {
  if (!file.type.startsWith("image/") && file.type !== "") return file;

  const mime = (file.type || "image/jpeg").toLowerCase();
  const needsConvert = !isAllowedMime(mime);
  const maxWidth = options?.maxWidth ?? 1600;
  const maxHeight = options?.maxHeight ?? 1600;
  const quality = options?.quality ?? 0.82;

  // Ya es formato permitido y pesa poco: no tocar
  if (!needsConvert && file.size < 800_000) return file;

  // Formatos raros que ni intentamos decodificar
  if (needsConvert && mime && !CONVERTIBLE_MIME.has(mime) && mime !== "image/") {
    throw new Error(
      "Formato no soportado. Usá JPG, PNG o WEBP (en iPhone: Preferencias → Cámara → Formatos → Más compatible).",
    );
  }

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    if (needsConvert || mime.includes("heic") || mime.includes("heif")) {
      throw new Error(
        "No se pudo leer la imagen. En iPhone elegí JPG (Más compatible) o exportá como PNG/JPG.",
      );
    }
    return file;
  }

  try {
    const ratio = Math.min(
      1,
      maxWidth / bitmap.width,
      maxHeight / bitmap.height,
    );
    const width = Math.max(1, Math.round(bitmap.width * ratio));
    const height = Math.max(1, Math.round(bitmap.height * ratio));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      if (needsConvert) {
        throw new Error("No se pudo procesar la imagen en este navegador.");
      }
      return file;
    }
    ctx.drawImage(bitmap, 0, 0, width, height);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", quality),
    );
    if (!blob) {
      if (needsConvert) {
        throw new Error("No se pudo convertir la imagen a JPG.");
      }
      return file;
    }

    // Si no hacía falta convertir y no achicó, devolver original
    if (!needsConvert && blob.size >= file.size) return file;

    const base = file.name.replace(/\.[^.]+$/, "") || "foto";
    return new File([blob], `${base}.jpg`, {
      type: "image/jpeg",
      lastModified: Date.now(),
    });
  } finally {
    bitmap.close();
  }
}
