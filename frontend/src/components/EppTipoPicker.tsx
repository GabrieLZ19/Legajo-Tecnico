"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { ChevronDown, Plus, Search, X } from "lucide-react";
import type { EppTipo } from "@/types";

type EppTipoPickerProps = {
  tipos: EppTipo[];
  value: string;
  onChange: (tipoId: string) => void;
  /** Si se pasa, muestra “Agregar nuevo EPP” al final del listado. */
  onCreateNew?: () => void;
  placeholder?: string;
  disabled?: boolean;
};

function TipoThumb({
  fotoUrl,
  size = "md",
}: {
  fotoUrl?: string | null;
  size?: "sm" | "md";
}) {
  if (!fotoUrl) return null;
  const cls =
    size === "sm"
      ? "h-10 w-10 rounded-lg object-cover border border-slate-100 bg-slate-50 shrink-0"
      : "h-11 w-11 rounded-lg object-cover border border-slate-100 bg-slate-50 shrink-0";
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={fotoUrl} alt="" className={cls} />
  );
}

export function EppTipoPicker({
  tipos,
  value,
  onChange,
  onCreateNew,
  placeholder = "Seleccionar EPP…",
  disabled = false,
}: EppTipoPickerProps) {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const selected = useMemo(
    () => tipos.find((tipo) => tipo.id === value) ?? null,
    [tipos, value],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const activos = tipos.filter((tipo) => tipo.activo !== false);
    if (!q) return activos;
    return activos.filter(
      (tipo) =>
        tipo.nombre.toLowerCase().includes(q) ||
        (tipo.descripcion || "").toLowerCase().includes(q) ||
        (tipo.marca || "").toLowerCase().includes(q) ||
        (tipo.modelo || "").toLowerCase().includes(q) ||
        (tipo.certificacion || "").toLowerCase().includes(q),
    );
  }, [tipos, query]);

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        setQuery("");
      }
    };

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const pick = (tipoId: string) => {
    onChange(tipoId);
    setOpen(false);
    setQuery("");
  };

  const clear = () => {
    onChange("");
    setOpen(false);
    setQuery("");
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => !disabled && setOpen((prev) => !prev)}
        className="flex w-full items-center gap-3 min-h-12 px-3 py-2.5 border border-slate-200 rounded-xl bg-white text-left text-sm font-medium focus:outline-hidden focus:ring-2 focus:ring-blue-500/25 focus:border-blue-500 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <TipoThumb fotoUrl={selected?.foto_url} size="sm" />

        <span className="min-w-0 flex-1">
          {selected ? (
            <>
              <span className="block truncate font-bold text-slate-800">
                {selected.nombre}
              </span>
              {selected.descripcion ? (
                <span className="block truncate text-[11px] font-semibold text-slate-400">
                  {selected.descripcion}
                </span>
              ) : null}
            </>
          ) : (
            <span className="text-slate-400">{placeholder}</span>
          )}
        </span>

        <ChevronDown
          className={`h-4 w-4 text-slate-400 shrink-0 transition-transform ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {open && (
        <div className="absolute z-40 mt-2 w-full rounded-2xl border border-slate-200 bg-white shadow-xl overflow-hidden">
          <div className="flex items-center gap-2 border-b border-slate-100 px-3 py-2.5">
            <Search className="h-4 w-4 text-slate-400 shrink-0" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar en el catálogo…"
              className="w-full bg-transparent text-sm font-medium outline-none placeholder:text-slate-400"
            />
            {value && (
              <button
                type="button"
                onClick={clear}
                className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-400 hover:text-rose-600 cursor-pointer shrink-0"
              >
                <X className="h-3.5 w-3.5" />
                Quitar
              </button>
            )}
          </div>

          <ul
            id={listId}
            role="listbox"
            className="max-h-64 overflow-y-auto p-1.5"
          >
            {filtered.length === 0 ? (
              <li className="px-3 py-6 text-center text-xs font-semibold text-slate-400">
                {tipos.length === 0
                  ? "No hay EPP en el catálogo."
                  : "Ningún EPP coincide con la búsqueda."}
              </li>
            ) : (
              filtered.map((tipo) => {
                const isSelected = tipo.id === value;
                return (
                  <li key={tipo.id}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      onClick={() => pick(tipo.id)}
                      className={`flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition-colors cursor-pointer ${
                        isSelected
                          ? "bg-blue-50 ring-1 ring-blue-100"
                          : "hover:bg-slate-50"
                      }`}
                    >
                      <TipoThumb fotoUrl={tipo.foto_url} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-bold text-slate-800">
                          {tipo.nombre}
                        </span>
                        {tipo.descripcion ? (
                          <span className="block truncate text-[11px] font-semibold text-slate-400">
                            {tipo.descripcion}
                          </span>
                        ) : null}
                      </span>
                    </button>
                  </li>
                );
              })
            )}
          </ul>

          {onCreateNew && (
            <div className="border-t border-slate-100 p-1.5">
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  setQuery("");
                  onCreateNew();
                }}
                className="flex w-full items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-bold text-blue-600 hover:bg-blue-50 cursor-pointer"
              >
                <Plus className="h-4 w-4" />
                Agregar nuevo EPP…
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
