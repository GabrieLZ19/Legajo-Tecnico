import multer from 'multer';
import path from 'path';

const ALLOWED_MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'application/pdf': 'pdf',
};

const ALLOWED_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'webp', 'pdf']);

/** Extensión segura a partir del MIME (ignora el nombre del cliente). */
export function safeExtensionFromUpload(file: Express.Multer.File): string {
  const fromMime = ALLOWED_MIME_TO_EXT[file.mimetype.toLowerCase()];
  if (fromMime) return fromMime;

  const raw = path.extname(file.originalname || '').replace('.', '').toLowerCase();
  if (ALLOWED_EXTENSIONS.has(raw)) {
    return raw === 'jpeg' ? 'jpg' : raw;
  }
  return 'bin';
}

export function isAllowedUpload(file: Express.Multer.File): boolean {
  const mime = file.mimetype.toLowerCase();
  if (!ALLOWED_MIME_TO_EXT[mime]) return false;
  // Rechazar SVG aunque algún cliente mande image/*
  const name = (file.originalname || '').toLowerCase();
  if (name.endsWith('.svg') || mime.includes('svg')) return false;
  return true;
}

// Almacenamiento en memoria para pasar los archivos a Supabase Storage como Buffer
const storage = multer.memoryStorage();

export const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // Limite de 5MB por archivo
  },
  fileFilter: (_req, file, cb) => {
    if (isAllowedUpload(file)) {
      cb(null, true);
    } else {
      cb(
        new Error(
          'Formato no soportado. Solo JPG, PNG, WEBP o PDF (máx. 5 MB).',
        ),
      );
    }
  },
});
