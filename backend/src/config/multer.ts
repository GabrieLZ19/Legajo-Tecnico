import multer from 'multer';

// Almacenamiento en memoria para pasar los archivos a Supabase Storage como Buffer
const storage = multer.memoryStorage();

export const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // Limite de 5MB por archivo
  },
  fileFilter: (req, file, cb) => {
    // Aceptar solo imágenes y PDFs
    if (file.mimetype.startsWith('image/') || file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Formato de archivo no soportado. Solo imágenes y PDFs.'));
    }
  },
});
