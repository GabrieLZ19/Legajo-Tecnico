import { supabaseAdmin } from "../config/supabase";

const KNOWN_BUCKETS = [
  "evidencia_visitas",
  "firmas_digitales",
  "informes_pdf",
  "epp_fotos",
  "capacitacion_materiales",
  "capacitacion_planes",
  "logos_consultora",
  "logos_empresa",
] as const;

export type StorageBucket = (typeof KNOWN_BUCKETS)[number] | string;

export type ParsedStorageRef = {
  bucket: string;
  path: string;
};

const DEFAULT_SIGNED_TTL_SEC = 60 * 60; // 1 hora

export const storageService = {
  /**
   * Sube un archivo de Multer a un bucket de Supabase Storage
   */
  async subirArchivo(
    bucket: string,
    path: string,
    file: Express.Multer.File,
  ): Promise<string> {
    const { error } = await supabaseAdmin.storage
      .from(bucket)
      .upload(path, file.buffer, {
        contentType: file.mimetype,
        upsert: true,
      });

    if (error) {
      throw new Error(
        `Error al subir archivo a Storage (${bucket}): ${error.message}`,
      );
    }

    return path;
  },

  /**
   * URL canónica (formato public) usada como referencia en DB.
   * Con buckets privados no es accesible sin firma; firmar al leer.
   */
  obtenerUrlPublica(bucket: string, path: string): string {
    const { data } = supabaseAdmin.storage.from(bucket).getPublicUrl(path);
    return data.publicUrl;
  },

  parseStorageUrl(urlOrPath: string | null | undefined): ParsedStorageRef | null {
    if (!urlOrPath) return null;
    const raw = urlOrPath.trim();
    if (!raw) return null;

    // Ya es path relativo con bucket conocido: "evidencia_visitas/foo/bar.jpg"
    for (const bucket of KNOWN_BUCKETS) {
      if (raw.startsWith(`${bucket}/`)) {
        return { bucket, path: raw.slice(bucket.length + 1) };
      }
    }

    const markers = [
      "/storage/v1/object/public/",
      "/storage/v1/object/sign/",
      "/object/public/",
      "/object/sign/",
    ];

    for (const marker of markers) {
      const idx = raw.indexOf(marker);
      if (idx === -1) continue;
      const rest = decodeURIComponent(raw.slice(idx + marker.length));
      const slash = rest.indexOf("/");
      if (slash <= 0) continue;
      const bucket = rest.slice(0, slash);
      // signed URLs include ?token=...
      const pathWithQuery = rest.slice(slash + 1);
      const path = pathWithQuery.split("?")[0];
      if (bucket && path) return { bucket, path };
    }

    return null;
  },

  async createSignedUrl(
    bucket: string,
    path: string,
    expiresInSec = DEFAULT_SIGNED_TTL_SEC,
  ): Promise<string> {
    const { data, error } = await supabaseAdmin.storage
      .from(bucket)
      .createSignedUrl(path, expiresInSec);

    if (error || !data?.signedUrl) {
      throw new Error(
        `No se pudo firmar URL (${bucket}/${path}): ${error?.message || "sin URL"}`,
      );
    }
    return data.signedUrl;
  },

  /**
   * Convierte una URL pública/path guardada en DB a URL firmada temporal.
   * Si no es de Storage, devuelve el valor original.
   */
  async signUrl(
    urlOrPath: string | null | undefined,
    expiresInSec = DEFAULT_SIGNED_TTL_SEC,
  ): Promise<string | null> {
    if (!urlOrPath) return null;
    const parsed = this.parseStorageUrl(urlOrPath);
    if (!parsed) return urlOrPath;

    try {
      return await this.createSignedUrl(
        parsed.bucket,
        parsed.path,
        expiresInSec,
      );
    } catch (err) {
      console.error("Error firmando URL de storage:", err);
      return urlOrPath;
    }
  },

  async signUrls(
    urls: Array<string | null | undefined>,
    expiresInSec = DEFAULT_SIGNED_TTL_SEC,
  ): Promise<Array<string | null>> {
    return Promise.all(urls.map((u) => this.signUrl(u, expiresInSec)));
  },

  /**
   * Descarga bytes vía Storage admin (funciona con buckets privados).
   */
  async downloadBuffer(
    urlOrPath: string | null | undefined,
  ): Promise<Buffer | null> {
    if (!urlOrPath) return null;
    const parsed = this.parseStorageUrl(urlOrPath);
    if (parsed) {
      const { data, error } = await supabaseAdmin.storage
        .from(parsed.bucket)
        .download(parsed.path);
      if (error || !data) {
        console.error(
          `Error descargando ${parsed.bucket}/${parsed.path}:`,
          error?.message,
        );
        return null;
      }
      return Buffer.from(await data.arrayBuffer());
    }

    try {
      const response = await fetch(urlOrPath);
      if (!response.ok) return null;
      return Buffer.from(await response.arrayBuffer());
    } catch (err) {
      console.error(`Error descargando URL externa:`, err);
      return null;
    }
  },

  async eliminarArchivo(bucket: string, path: string): Promise<void> {
    const { error } = await supabaseAdmin.storage.from(bucket).remove([path]);
    if (error) {
      throw new Error(
        `Error al eliminar archivo de Storage (${bucket}): ${error.message}`,
      );
    }
  },
};
