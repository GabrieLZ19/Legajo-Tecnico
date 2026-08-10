import multer from "multer";

const EXCEL_MIMES = new Set([
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/octet-stream",
]);

const EXCEL_EXTS = [".xls", ".xlsx"];

export const uploadExcel = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
  fileFilter: (_req, file, cb) => {
    const name = (file.originalname || "").toLowerCase();
    const hasExt = EXCEL_EXTS.some((ext) => name.endsWith(ext));
    if (hasExt || EXCEL_MIMES.has(file.mimetype)) {
      cb(null, true);
      return;
    }
    cb(new Error("Solo se permiten archivos Excel (.xls o .xlsx)."));
  },
});
