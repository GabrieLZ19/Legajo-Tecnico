"use client";

import {
  CapAgendaErrors,
  CapAgendaValue,
  calcHorasFromRange,
} from "@/lib/cap-agenda";

interface CapacitacionAgendaFieldsProps {
  value: CapAgendaValue;
  onChange: (next: CapAgendaValue) => void;
  errors?: CapAgendaErrors;
  disabled?: boolean;
  /** Si true, oculta el campo fecha (cuando ya está en otro lado) */
  hideFecha?: boolean;
  className?: string;
}

const inputClass =
  "w-full px-4 py-3 border rounded-xl text-sm font-bold text-slate-700 bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500/25 focus:border-blue-500 disabled:bg-slate-50 disabled:text-slate-500";

function fieldBorder(hasError?: string) {
  return hasError ? "border-rose-300" : "border-slate-200";
}

export default function CapacitacionAgendaFields({
  value,
  onChange,
  errors = {},
  disabled = false,
  hideFecha = false,
  className = "",
}: CapacitacionAgendaFieldsProps) {
  const patch = (partial: Partial<CapAgendaValue>) => {
    const next = { ...value, ...partial };

    if (partial.horaDesde !== undefined || partial.horaHasta !== undefined) {
      const auto = calcHorasFromRange(next.horaDesde, next.horaHasta);
      if (auto) next.cantidadHoras = auto;
    }

    onChange(next);
  };

  return (
    <div className={`space-y-3 ${className}`}>
      <div
        className={`grid grid-cols-1 gap-3 ${
          hideFecha ? "sm:grid-cols-3" : "sm:grid-cols-2 lg:grid-cols-4"
        }`}
      >
        {!hideFecha && (
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Fecha *
            </label>
            <input
              type="date"
              disabled={disabled}
              required
              value={value.fecha}
              onChange={(e) => patch({ fecha: e.target.value })}
              className={`${inputClass} ${fieldBorder(errors.fecha)}`}
            />
            {errors.fecha && (
              <p className="text-[11px] font-semibold text-rose-600">
                {errors.fecha}
              </p>
            )}
          </div>
        )}

        <div className="space-y-1.5">
          <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
            Desde *
          </label>
          <input
            type="time"
            disabled={disabled}
            required
            value={value.horaDesde}
            onChange={(e) => patch({ horaDesde: e.target.value })}
            className={`${inputClass} ${fieldBorder(errors.horaDesde)}`}
          />
          {errors.horaDesde && (
            <p className="text-[11px] font-semibold text-rose-600">
              {errors.horaDesde}
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
            Hasta *
          </label>
          <input
            type="time"
            disabled={disabled}
            required
            value={value.horaHasta}
            onChange={(e) => patch({ horaHasta: e.target.value })}
            className={`${inputClass} ${fieldBorder(errors.horaHasta)}`}
          />
          {errors.horaHasta && (
            <p className="text-[11px] font-semibold text-rose-600">
              {errors.horaHasta}
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
            Cantidad de horas *
          </label>
          <input
            type="number"
            inputMode="decimal"
            min={0.25}
            max={24}
            step={0.25}
            disabled={disabled}
            required
            value={value.cantidadHoras}
            onChange={(e) => patch({ cantidadHoras: e.target.value })}
            className={`${inputClass} ${fieldBorder(errors.cantidadHoras)}`}
          />
          {errors.cantidadHoras ? (
            <p className="text-[11px] font-semibold text-rose-600">
              {errors.cantidadHoras}
            </p>
          ) : (
            <p className="text-[10px] font-semibold text-slate-400">
              Se calcula solo con Desde/Hasta; podés ajustarla.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
