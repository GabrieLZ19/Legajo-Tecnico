import multer from 'multer';
import path from 'path';

const ALLOWED_MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/pjpeg': 'jpg',
  'image/jfif': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'application/pdf': 'pdf',
  'application/msword': 'doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
    'docx',
};

const ALLOWED_EXTENSIONS = new Set([
  'jpg',
  'jpeg',
  'png',
  'webp',
  'pdf',
  'jfif',
  'doc',
  'docx',
]);

/** Documentos de mediciones/ART: imágenes, PDF y Word hasta 10 MB. */
const DOCS_MIME_TO_EXT: Record<string, string> = {
  ...ALLOWED_MIME_TO_EXT,
};

function isAllowedDocsUpload(file: Express.Multer.File): boolean {
  const mime = file.mimetype.toLowerCase();
  if (DOCS_MIME_TO_EXT[mime]) {
    const name = (file.originalname || '').toLowerCase();
    if (name.endsWith('.svg') || mime.includes('svg')) return false;
    return true;
  }
  const raw = path.extname(file.originalname || '').replace('.', '').toLowerCase();
  if (
    (!mime || mime === 'application/octet-stream') &&
    ALLOWED_EXTENSIONS.has(raw)
  ) {
    return true;
  }
  return false;
}

/** Extensión segura a partir del MIME (ignora el nombre del cliente). */
export function safeExtensionFromUpload(file: Express.Multer.File): string {
  const fromMime = ALLOWED_MIME_TO_EXT[file.mimetype.toLowerCase()];
  if (fromMime) return fromMime;

  const raw = path.extname(file.originalname || '').replace('.', '').toLowerCase();
  if (ALLOWED_EXTENSIONS.has(raw)) {
    if (raw === 'jpeg' || raw === 'jfif') return 'jpg';
    return raw;
  }
  return 'bin';
}

export function isAllowedUpload(file: Express.Multer.File): boolean {
  const mime = file.mimetype.toLowerCase();
  if (ALLOWED_MIME_TO_EXT[mime]) {
    const name = (file.originalname || '').toLowerCase();
    if (name.endsWith('.svg') || mime.includes('svg')) return false;
    return true;
  }
  // Algunos navegadores mandan JPEG como application/octet-stream o vacío
  // con extensión .jpg/.jfif/.jpeg
  const raw = path.extname(file.originalname || '').replace('.', '').toLowerCase();
  if (
    (!mime || mime === 'application/octet-stream') &&
    (raw === 'jpg' || raw === 'jpeg' || raw === 'jfif' || raw === 'png' || raw === 'webp')
  ) {
    return true;
  }
  return false;
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

/** Escaneos de registro en papel (imagen/PDF), hasta 10 MB. */
export const uploadRegistroManual = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024,
  },
  fileFilter: (_req, file, cb) => {
    if (isAllowedUpload(file)) {
      cb(null, true);
    } else {
      cb(
        new Error(
          'Formato no soportado. Solo JPG, PNG, WEBP o PDF (máx. 10 MB).',
        ),
      );
    }
  },
});

/** Adjuntos de mediciones/ART (imagen, PDF, Word), hasta 10 MB. */
export const uploadDocumentosVencimiento = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024,
  },
  fileFilter: (_req, file, cb) => {
    if (isAllowedDocsUpload(file)) {
      cb(null, true);
    } else {
      cb(
        new Error(
          'Formato no soportado. Solo JPG, PNG, WEBP, PDF, DOC o DOCX (máx. 10 MB).',
        ),
      );
    }
  },
});

export function safeExtensionFromDocsUpload(file: Express.Multer.File): string {
  const fromMime = DOCS_MIME_TO_EXT[file.mimetype.toLowerCase()];
  if (fromMime) return fromMime;
  const raw = path.extname(file.originalname || '').replace('.', '').toLowerCase();
  if (ALLOWED_EXTENSIONS.has(raw)) {
    if (raw === 'jpeg' || raw === 'jfif') return 'jpg';
    return raw;
  }
  return 'bin';
}
