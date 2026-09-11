import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import multer from 'multer';

export const errorHandler = (err: any, req: Request, res: Response, next: NextFunction) => {
  console.error(err);

  if (err instanceof ZodError) {
    res.status(400).json({
      error: 'Error de validación',
      detalles: err.issues
    });
    return;
  }

  if (err instanceof multer.MulterError) {
    const message =
      err.code === 'LIMIT_FILE_SIZE'
        ? 'El archivo supera el máximo permitido (5 MB).'
        : err.message || 'Error al subir el archivo';
    res.status(400).json({ error: message });
    return;
  }

  // fileFilter de multer (Error genérico con mensaje claro)
  if (
    typeof err?.message === 'string' &&
    (err.message.includes('Formato no soportado') ||
      err.message.includes('máx. 5 MB') ||
      err.message.includes('máx. 10 MB'))
  ) {
    res.status(400).json({ error: err.message });
    return;
  }

  let statusCode = 500;
  if (err.statusCode) {
    statusCode = typeof err.statusCode === 'string' ? parseInt(err.statusCode, 10) : err.statusCode;
  } else if (err.status) {
    statusCode = typeof err.status === 'string' ? parseInt(err.status, 10) : err.status;
  }
  const message =
    statusCode >= 500
      ? "Error interno del servidor"
      : err.message || "Error interno del servidor";

  res.status(statusCode).json({
    error: message
  });
};
