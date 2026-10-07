import { randomUUID } from "crypto";
import { storageService } from "../services/storage.service";
import { HttpError } from "./httpError";
import { sanitizeRichHtml } from "./sanitizeHtml";

export interface CapacitacionDiapositiva {
  contenido: string;
}

/** Bucket de imágenes embebidas en diapositivas. */
export const CAP_MEDIA_BUCKET = "capacitacion_materiales";

/** Límite duro del JSON de diapositivas al guardar (~8 MB; Express acepta 15). */
const MAX_DIAPOSITIVAS_JSON_BYTES = 8 * 1024 * 1024;

/**
 * Tras externalizar, no debería quedar casi ningún data URL.
 * Si queda uno enorme, el cliente no pudo procesarlo.
 */
const MAX_DATA_URL_CHARS = 200_000;

/** Máximo a intentar subir automáticamente desde el backend (~4.5 MB binarios). */
const MAX_EXTERNALIZE_DATA_URL_CHARS = 6 * 1024 * 1024;

const DATA_URL_RE =
  /data:image\/([a-z0-9.+-]+);base64,([A-Za-z0-9+/=\s]+)/gi;

const IMG_SRC_RE = /(<img\b[^>]*?\bsrc=["'])([^"']+)(["'])/gi;

function rewriteImgSrcs(
  html: string,
  rewriter: (src: string) => string,
): string {
  return html.replace(IMG_SRC_RE, (_m, pre: string, src: string, post: string) => {
    return `${pre}${rewriter(src)}${post}`;
  });
}

/** Convierte signed/public URLs de Storage a la URL canónica pública. */
export function canonicalizeMediaSrc(src: string): string {
  const parsed = storageService.parseStorageUrl(src);
  if (!parsed || parsed.bucket !== CAP_MEDIA_BUCKET) return src;
  return storageService.obtenerUrlPublica(parsed.bucket, parsed.path);
}

function canonicalizeHtmlMedia(html: string): string {
  return rewriteImgSrcs(html, canonicalizeMediaSrc);
}

/**
 * Normaliza diapositivas y deriva temario (compatibilidad lecturas viejas).
 * Si diapositivas viene vacío y hay temario, se trata como 1 diapositiva.
 * Canonicaliza URLs de Storage para no persistir tokens de signed URLs.
 */
export function resolveDiapositivasAndTemario(params: {
  diapositivas?: CapacitacionDiapositiva[] | null;
  temario?: string | null;
}): { diapositivas: CapacitacionDiapositiva[]; temario: string | null } {
  const incoming = Array.isArray(params.diapositivas)
    ? params.diapositivas.filter(
        (d) => d && typeof d.contenido === "string",
      )
    : [];

  let diapositivas = incoming.map((d) => ({
    ...d,
    contenido: canonicalizeHtmlMedia(sanitizeRichHtml(d.contenido)),
  }));
  if (diapositivas.length === 0 && params.temario) {
    diapositivas = [
      {
        contenido: canonicalizeHtmlMedia(sanitizeRichHtml(params.temario)),
      },
    ];
  }

  const temario =
    diapositivas.length > 0
      ? diapositivas.map((d) => d.contenido || "").join("")
      : params.temario
        ? canonicalizeHtmlMedia(sanitizeRichHtml(params.temario))
        : null;

  return { diapositivas, temario };
}

/** Para respuestas de detalle: garantiza al menos fallback desde temario. */
export function ensureDiapositivas(
  diapositivas: CapacitacionDiapositiva[] | null | undefined,
  temario?: string | null,
): CapacitacionDiapositiva[] {
  return resolveDiapositivasAndTemario({ diapositivas, temario }).diapositivas;
}

function mimeToExt(mime: string): string {
  const m = mime.toLowerCase();
  if (m.includes("png")) return "png";
  if (m.includes("webp")) return "webp";
  if (m.includes("gif")) return "gif";
  return "jpg";
}

/**
 * Sube data:image embebidas a Storage y las reemplaza por URL pública.
 * Red de seguridad si el cliente no externalizó antes de guardar.
 */
export async function externalizeDiapositivasDataUrls(
  diapositivas: CapacitacionDiapositiva[],
  userId: string,
): Promise<CapacitacionDiapositiva[]> {
  const out: CapacitacionDiapositiva[] = [];

  for (const slide of diapositivas) {
    let html = slide.contenido || "";
    const matches = Array.from(html.matchAll(DATA_URL_RE));
    if (matches.length === 0) {
      out.push({ contenido: html });
      continue;
    }

    // Deduplicar por data URL compacta (sin whitespace en base64)
    const seen = new Map<string, string>();
    for (const match of matches) {
      const compact = match[0].replace(/\s+/g, "");
      if (seen.has(compact)) continue;
      if (compact.length > MAX_EXTERNALIZE_DATA_URL_CHARS) {
        throw new HttpError(
          400,
          "Hay imágenes embebidas demasiado grandes. Usá «Insertar Imagen» para cada foto en lugar de pegar la filmina completa.",
        );
      }

      const mime = `image/${match[1]}`.toLowerCase();
      if (mime.includes("svg")) {
        throw new HttpError(400, "No se permiten imágenes SVG embebidas.");
      }

      let buffer: Buffer;
      try {
        buffer = Buffer.from(match[2].replace(/\s+/g, ""), "base64");
      } catch {
        throw new HttpError(
          400,
          "Hay una imagen embebida inválida en las diapositivas.",
        );
      }

      if (buffer.length === 0) continue;

      const ext = mimeToExt(mime);
      const path = `${userId}/${randomUUID()}.${ext}`;
      await storageService.subirArchivo(CAP_MEDIA_BUCKET, path, {
        buffer,
        mimetype: mime.startsWith("image/") ? mime : "image/jpeg",
        originalname: `embedded.${ext}`,
        fieldname: "imagen",
        encoding: "7bit",
        size: buffer.length,
      } as Express.Multer.File);

      seen.set(
        compact,
        storageService.obtenerUrlPublica(CAP_MEDIA_BUCKET, path),
      );
    }

    html = html.replace(DATA_URL_RE, (full) => {
      const compact = full.replace(/\s+/g, "");
      return seen.get(compact) || full;
    });

    out.push({ contenido: html });
  }

  return out;
}

/**
 * Rechaza payloads de diapositivas demasiado pesados (base64 embebido).
 * Las imágenes nuevas deben subirse a Storage vía POST /capacitaciones/media.
 */
export function assertDiapositivasPayloadOk(
  diapositivas: CapacitacionDiapositiva[] | null | undefined,
): void {
  if (!diapositivas || diapositivas.length === 0) return;

  const json = JSON.stringify(diapositivas);
  if (Buffer.byteLength(json, "utf8") > MAX_DIAPOSITIVAS_JSON_BYTES) {
    throw new HttpError(
      400,
      "Las diapositivas son demasiado pesadas. Subí las imágenes con «Insertar Imagen» (no pegues filminas enteras con fotos embebidas).",
    );
  }

  for (const d of diapositivas) {
    const dataUrls =
      d.contenido.match(/data:image\/[^;]+;base64,[A-Za-z0-9+/=]+/gi) || [];
    for (const url of dataUrls) {
      if (url.length > MAX_DATA_URL_CHARS) {
        throw new HttpError(
          400,
          "Hay imágenes embebidas demasiado grandes. Usá «Insertar Imagen» para cada foto en lugar de pegar la filmina completa.",
        );
      }
    }
  }
}

/** Firma img src de capacitacion_materiales para lectura en el cliente. */
export async function signDiapositivasImages(
  diapositivas: CapacitacionDiapositiva[],
): Promise<CapacitacionDiapositiva[]> {
  return Promise.all(
    diapositivas.map(async (d) => {
      const srcs = new Set<string>();
      rewriteImgSrcs(d.contenido || "", (src) => {
        const parsed = storageService.parseStorageUrl(src);
        if (parsed?.bucket === CAP_MEDIA_BUCKET) srcs.add(src);
        return src;
      });

      if (srcs.size === 0) return d;

      let html = d.contenido;
      for (const src of srcs) {
        const signed = await storageService.signUrl(src, 60 * 60);
        if (signed && signed !== src) {
          html = html.split(src).join(signed);
        }
      }
      return { ...d, contenido: html };
    }),
  );
}
