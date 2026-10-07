import type { CapacitacionDiapositiva } from "@/types";
import { compressImage } from "@/lib/compressImage";
import { capacitacionesService } from "@/utils/services/capacitaciones.service";

const DATA_URL_RE = /data:image\/[a-z0-9.+-]+;base64,[A-Za-z0-9+/=\s]+/gi;
const MAX_RAW_BYTES = 25 * 1024 * 1024;
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

const SLIDE_COMPRESS_OPTS = {
  maxWidth: 1280,
  maxHeight: 1280,
  quality: 0.8,
} as const;

export function normalizeDiapositivas(
  diapositivas?: CapacitacionDiapositiva[] | null,
  temario?: string | null,
): CapacitacionDiapositiva[] {
  if (Array.isArray(diapositivas) && diapositivas.length > 0) {
    return diapositivas.map((d) => ({
      contenido: typeof d?.contenido === "string" ? d.contenido : "",
    }));
  }
  if (temario) return [{ contenido: temario }];
  return [{ contenido: "" }];
}

export function deriveTemario(diapositivas: CapacitacionDiapositiva[]): string {
  return diapositivas.map((d) => d.contenido || "").join("");
}

function uniqueDataUrls(html: string): string[] {
  const matches = html.match(DATA_URL_RE) || [];
  return Array.from(new Set(matches.map((m) => m.replace(/\s+/g, ""))));
}

async function dataUrlToFile(dataUrl: string): Promise<File | null> {
  try {
    const res = await fetch(dataUrl);
    if (!res.ok) return null;
    const blob = await res.blob();
    if (!blob.type.startsWith("image/")) return null;
    if (blob.size > MAX_RAW_BYTES) return null;
    return new File([blob], "embedded-image", {
      type: blob.type || "image/png",
    });
  } catch {
    return null;
  }
}

/**
 * Sube a Storage cualquier data:image embebida y la reemplaza por URL.
 * Evita el error de “imágenes embebidas demasiado grandes” al guardar.
 */
export async function externalizeDiapositivasImages(
  diapositivas: CapacitacionDiapositiva[],
): Promise<CapacitacionDiapositiva[]> {
  const out: CapacitacionDiapositiva[] = [];

  for (const slide of diapositivas) {
    let html = slide.contenido || "";
    const dataUrls = uniqueDataUrls(html);
    if (dataUrls.length === 0) {
      out.push({ contenido: html });
      continue;
    }

    for (const dataUrl of dataUrls) {
      const file = await dataUrlToFile(dataUrl);
      if (!file) {
        throw new Error(
          "Hay una imagen embebida que no se pudo procesar. Sacá una captura más liviana o usá «Insertar Imagen».",
        );
      }

      const compressed = await compressImage(file, SLIDE_COMPRESS_OPTS);
      if (compressed.size > MAX_UPLOAD_BYTES) {
        throw new Error(
          "Una imagen sigue siendo muy pesada (>5 MB) después de comprimir. Usá «Insertar Imagen» con una foto más liviana.",
        );
      }

      const url = await capacitacionesService.subirMediaDiapositiva(compressed);
      html = html.split(dataUrl).join(url);
    }

    out.push({ contenido: html });
  }

  return out;
}
