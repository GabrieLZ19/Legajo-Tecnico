"use client";

import { MapPin, Mail, Phone } from "lucide-react";
import { sanitizeTelefonoInput } from "@/lib/proveedorValidation";

export type ProveedorFichaForm = {
  nombre: string;
  email: string;
  direccion: string;
  telefono: string;
};

export function emptyProveedorFicha(): ProveedorFichaForm {
  return {
    nombre: "",
    email: "",
    direccion: "",
    telefono: "",
  };
}

type ProveedorFichaFieldsProps = {
  value: ProveedorFichaForm;
  onChange: (next: ProveedorFichaForm) => void;
  idPrefix: string;
};

export function ProveedorFichaFields({
  value,
  onChange,
  idPrefix,
}: ProveedorFichaFieldsProps) {
  return (
    <div className="space-y-3">
      <label className="block space-y-1.5" htmlFor={`${idPrefix}-nombre`}>
        <span className="text-[11px] font-bold text-slate-500 uppercase">Nombre</span>
        <input
          id={`${idPrefix}-nombre`}
          required
          minLength={2}
          maxLength={120}
          value={value.nombre}
          onChange={(e) => onChange({ ...value, nombre: e.target.value })}
          placeholder="Razón social o contacto"
          className="w-full min-h-12 px-4 py-3 border border-slate-200 rounded-xl text-base sm:text-sm bg-white"
        />
      </label>
      <label className="block space-y-1.5" htmlFor={`${idPrefix}-direccion`}>
        <span className="text-[11px] font-bold text-slate-500 uppercase inline-flex items-center gap-1">
          <MapPin className="h-3 w-3" /> Dirección
        </span>
        <input
          id={`${idPrefix}-direccion`}
          maxLength={200}
          value={value.direccion}
          onChange={(e) => onChange({ ...value, direccion: e.target.value })}
          placeholder="Calle, número, localidad"
          className="w-full min-h-12 px-4 py-3 border border-slate-200 rounded-xl text-base sm:text-sm bg-white"
        />
      </label>
      <label className="block space-y-1.5" htmlFor={`${idPrefix}-email`}>
        <span className="text-[11px] font-bold text-slate-500 uppercase inline-flex items-center gap-1">
          <Mail className="h-3 w-3" /> Mail
        </span>
        <input
          id={`${idPrefix}-email`}
          required
          type="email"
          inputMode="email"
          autoComplete="email"
          maxLength={160}
          value={value.email}
          onChange={(e) => onChange({ ...value, email: e.target.value })}
          placeholder="correo@proveedor.com"
          className="w-full min-h-12 px-4 py-3 border border-slate-200 rounded-xl text-base sm:text-sm bg-white"
        />
      </label>
      <label className="block space-y-1.5" htmlFor={`${idPrefix}-telefono`}>
        <span className="text-[11px] font-bold text-slate-500 uppercase inline-flex items-center gap-1">
          <Phone className="h-3 w-3" /> Teléfono
        </span>
        <input
          id={`${idPrefix}-telefono`}
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          value={value.telefono}
          onChange={(e) =>
            onChange({ ...value, telefono: sanitizeTelefonoInput(e.target.value) })
          }
          placeholder="Ej. 11 5555-5555"
          className="w-full min-h-12 px-4 py-3 border border-slate-200 rounded-xl text-base sm:text-sm bg-white"
        />
        <span className="text-[10px] font-semibold text-slate-400">
          Solo números; podés usar espacios, guiones o +.
        </span>
      </label>
    </div>
  );
}
