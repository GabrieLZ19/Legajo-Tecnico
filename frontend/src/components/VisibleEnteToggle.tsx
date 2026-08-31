"use client";

import { Eye } from "lucide-react";

type Props = {
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  compact?: boolean;
};

/** Checkbox para marcar visibilidad ante el ente regulador. */
export function VisibleEnteToggle({
  checked,
  disabled = false,
  onChange,
  label = "Visible ente",
  compact = false,
}: Props) {
  return (
    <label
      className={`inline-flex items-center gap-1.5 select-none ${
        disabled ? "opacity-60 cursor-not-allowed" : "cursor-pointer"
      } ${compact ? "text-[10px]" : "text-xs"}`}
      title="Si está marcado, el ente regulador asignado puede ver este registro"
    >
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="h-3.5 w-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500/30 cursor-pointer disabled:cursor-not-allowed"
      />
      {!compact && (
        <span className="font-bold text-slate-500 inline-flex items-center gap-1">
          <Eye className="h-3 w-3" />
          {label}
        </span>
      )}
    </label>
  );
}
