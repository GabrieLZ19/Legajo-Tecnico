import multer from "multer";

const PLAN_ANUAL_MIMES = new Set([
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/excel",
  "application/x-excel",
  "application/x-msexcel",
  "application/octet-stream",
  "application/pdf",
]);

const PLAN_ANUAL_EXTS = [".xls", ".xlsx", ".pdf"];

export const uploadExcel = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
  fileFilter: (_req, file, cb) => {
    const name = (file.originalname || "").toLowerCase();
    const hasExt = PLAN_ANUAL_EXTS.some((ext) => name.endsWith(ext));
    if (hasExt || PLAN_ANUAL_MIMES.has(file.mimetype)) {
      cb(null, true);
      return;
    }
    cb(new Error("Solo se permiten archivos Excel (.xls o .xlsx) o PDF."));
  },
});
