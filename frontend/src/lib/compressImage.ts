/** Comprime una imagen del lado del cliente para subidas más rápidas en móvil. */
export async function compressImage(
  file: File,
  options?: { maxWidth?: number; maxHeight?: number; quality?: number },
): Promise<File> {
  if (!file.type.startsWith("image/")) return file;
  // HEIC / raros: dejar pasar sin tocar
  if (!["image/jpeg", "image/jpg", "image/png", "image/webp"].includes(file.type)) {
    return file;
  }

  const maxWidth = options?.maxWidth ?? 1600;
  const maxHeight = options?.maxHeight ?? 1600;
  const quality = options?.quality ?? 0.82;

  // Si ya es chica (< 800KB), no vale la pena comprimir
  if (file.size < 800_000) return file;

  const bitmap = await createImageBitmap(file);
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
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, width, height);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", quality),
    );
    if (!blob || blob.size >= file.size) return file;

    const base = file.name.replace(/\.[^.]+$/, "") || "evidencia";
    return new File([blob], `${base}.jpg`, {
      type: "image/jpeg",
      lastModified: Date.now(),
    });
  } finally {
    bitmap.close();
  }
}
