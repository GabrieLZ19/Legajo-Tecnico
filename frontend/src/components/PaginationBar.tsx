"use client";

type PaginationBarProps = {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  disabled?: boolean;
  className?: string;
};

/**
 * Paginación compartida (mismo patrón visual que Plan de Acción / Informes).
 */
export function PaginationBar({
  page,
  pageSize,
  total,
  onPageChange,
  disabled = false,
  className = "",
}: PaginationBarProps) {
  if (total <= pageSize) return null;

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(Math.max(0, page), totalPages - 1);
  const showingFrom = Math.min(safePage * pageSize + 1, total);
  const showingTo = Math.min((safePage + 1) * pageSize, total);

  return (
    <div
      className={`flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white border border-slate-200 rounded-2xl px-4 py-3 shadow-2xs ${className}`}
    >
      <p className="text-xs font-semibold text-slate-500">
        Mostrando {showingFrom}–{showingTo} de {total}
      </p>
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={safePage === 0 || disabled}
          onClick={() => onPageChange(Math.max(0, safePage - 1))}
          className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-black text-slate-700 hover:bg-slate-50 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
        >
          Anterior
        </button>
        <span className="text-xs font-bold text-slate-600 tabular-nums">
          Pág. {safePage + 1} / {totalPages}
        </span>
        <button
          type="button"
          disabled={safePage >= totalPages - 1 || disabled}
          onClick={() => onPageChange(Math.min(totalPages - 1, safePage + 1))}
          className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-black text-slate-700 hover:bg-slate-50 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
        >
          Siguiente
        </button>
      </div>
    </div>
  );
}
