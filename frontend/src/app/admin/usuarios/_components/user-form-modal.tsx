"use client";

import React, { useEffect, useState } from "react";
import type { AdminEmpresaOption, AdminUsuario } from "@/types";
import {
  ROLE_OPTIONS,
  getRoleBadgeClasses,
  getRoleLabel,
} from "@/lib/adminUsuarios";
import { Loader2, X } from "lucide-react";
import type { AdminUsuarioFormValues } from "@/hooks/useAdminUsuarios";

type UserFormModalProps = {
  isOpen: boolean;
  editingUsuario: AdminUsuario | null;
  empresas: AdminEmpresaOption[];
  isSaving: boolean;
  onClose: () => void;
  onSubmit: (values: AdminUsuarioFormValues) => Promise<void>;
};

const initialValues: AdminUsuarioFormValues = {
  nombre_completo: "",
  username: "",
  email: "",
  password: "",
  rol: "preventor",
  empresa_id: null,
  activo: true,
};

export function UserFormModal({
  isOpen,
  editingUsuario,
  empresas,
  isSaving,
  onClose,
  onSubmit,
}: UserFormModalProps) {
  const [values, setValues] = useState<AdminUsuarioFormValues>(initialValues);

  useEffect(() => {
    if (!isOpen) return;

    if (editingUsuario) {
      setValues({
        nombre_completo: editingUsuario.nombre_completo || "",
        username: editingUsuario.username || "",
        email: "",
        password: "",
        rol: editingUsuario.rol,
        empresa_id: editingUsuario.empresa_id || null,
        activo: editingUsuario.activo,
      });
      return;
    }

    setValues(initialValues);
  }, [editingUsuario, isOpen]);

  if (!isOpen) return null;

  const isEditing = Boolean(editingUsuario);

  const updateField = <K extends keyof AdminUsuarioFormValues>(
    field: K,
    value: AdminUsuarioFormValues[K],
  ) => {
    setValues((current) => ({ ...current, [field]: value }));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    await onSubmit(values);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-md">
      <div className="w-full max-w-4xl overflow-hidden rounded-[28px] border border-blue-100 bg-white shadow-[0_30px_80px_rgba(15,23,42,0.24)]">
        <div className="border-b border-blue-100 bg-linear-to-r from-blue-50 to-white px-6 py-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <span className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">
                {isEditing ? "Edición de usuario" : "Nuevo usuario"}
              </span>
              <h3 className="mt-2 text-2xl font-black tracking-tight text-slate-900">
                {isEditing
                  ? "Editar acceso y perfil"
                  : "Crear acceso de usuario"}
              </h3>
              <p className="mt-2 max-w-xl text-sm text-slate-500">
                Definí rol, empresa asociada y credenciales iniciales para el
                acceso al sistema.
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-blue-200 bg-white text-blue-600 transition-colors hover:border-blue-300 hover:bg-blue-50 hover:text-blue-800"
              aria-label="Cerrar modal"
            >
              <X className="h-4.5 w-4.5" />
            </button>
          </div>
        </div>

        <form
          onSubmit={handleSubmit}
          className="grid gap-6 px-6 py-6 lg:grid-cols-[minmax(0,1.35fr)_360px]"
        >
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Nombre completo" required>
                <input
                  type="text"
                  required
                  value={values.nombre_completo}
                  onChange={(e) =>
                    updateField("nombre_completo", e.target.value)
                  }
                  placeholder="María López"
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-800 outline-none transition-colors placeholder:text-slate-400 focus:border-slate-400"
                />
              </Field>

              <Field label="Usuario" hint="Se usa para login" required>
                <input
                  type="text"
                  required
                  value={values.username}
                  onChange={(e) =>
                    updateField(
                      "username",
                      e.target.value.toLowerCase().replace(/\s/g, ""),
                    )
                  }
                  placeholder="mlopez"
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-800 outline-none transition-colors placeholder:text-slate-400 focus:border-slate-400"
                />
              </Field>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {!isEditing ? (
                <>
                  <Field label="Correo electrónico" required>
                    <input
                      type="email"
                      required
                      value={values.email}
                      onChange={(e) => updateField("email", e.target.value)}
                      placeholder="maria@cliente.com"
                      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-800 outline-none transition-colors placeholder:text-slate-400 focus:border-slate-400"
                    />
                  </Field>
                  <Field label="Contraseña inicial" required>
                    <input
                      type="password"
                      required
                      value={values.password}
                      onChange={(e) => updateField("password", e.target.value)}
                      placeholder="••••••••"
                      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-800 outline-none transition-colors placeholder:text-slate-400 focus:border-slate-400"
                    />
                  </Field>
                </>
              ) : (
                <div className="rounded-2xl border border-dashed border-blue-200 bg-blue-50/30 px-4 py-4 sm:col-span-2">
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-700">
                    Credenciales
                  </p>
                  <p className="mt-2 text-sm text-slate-600">
                    En edición no se modifica el correo ni la contraseña. Si
                    necesitás reemitir acceso, creá una nueva cuenta.
                  </p>
                </div>
              )}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Rol del usuario" required>
                <select
                  value={values.rol}
                  onChange={(e) =>
                    updateField(
                      "rol",
                      e.target.value as AdminUsuarioFormValues["rol"],
                    )
                  }
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-800 outline-none transition-colors focus:border-slate-400"
                >
                  {ROLE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Estado" required>
                <select
                  value={values.activo ? "activo" : "inactivo"}
                  onChange={(e) =>
                    updateField("activo", e.target.value === "activo")
                  }
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-800 outline-none transition-colors focus:border-slate-400"
                >
                  <option value="activo">Activo</option>
                  <option value="inactivo">Inactivo</option>
                </select>
              </Field>
            </div>

            {values.rol === "dueno" && (
              <Field label="Empresa asociada" required>
                <select
                  required
                  value={values.empresa_id || ""}
                  onChange={(e) =>
                    updateField("empresa_id", e.target.value || null)
                  }
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-800 outline-none transition-colors focus:border-slate-400"
                >
                  <option value="">Seleccioná una empresa</option>
                  {empresas.map((empresa) => (
                    <option key={empresa.id} value={empresa.id}>
                      {empresa.razon_social}
                    </option>
                  ))}
                </select>
              </Field>
            )}
          </div>

          <aside className="space-y-4 rounded-3xl border border-blue-100 bg-linear-to-b from-blue-50/70 to-white p-5 shadow-[0_12px_40px_rgba(59,130,246,0.08)]">
            <div className="space-y-3">
              <span className="block text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">
                Perfil seleccionado
              </span>
              <div
                className={`inline-flex rounded-full px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.18em] ${getRoleBadgeClasses(values.rol)}`}
              >
                {getRoleLabel(values.rol)}
              </div>
            </div>

            <div className="space-y-3 rounded-2xl border border-blue-100 bg-blue-50/50 p-4">
              <span className="block text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">
                Sugerencia
              </span>
              <p className="text-sm font-medium leading-relaxed text-slate-600">
                {values.rol === "preventor" &&
                  "Usá este perfil para asignar empresas y registrar visitas."}
                {values.rol === "dueno" &&
                  "Este perfil queda asociado a una sola empresa y puede consultar su legajo."}
                {values.rol === "admin" &&
                  "Este perfil accede al panel completo de administración."}
                {values.rol === "ente_regulador" &&
                  "Este perfil debe tener acceso restringido de lectura."}
              </p>
            </div>

            <div className="rounded-2xl border border-dashed border-blue-200 bg-white p-4">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-700">
                Distribución
              </p>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">
                El panel lateral agrupa el perfil, la ayuda contextual y la
                intención del acceso para que el formulario principal respire
                mejor.
              </p>
            </div>

            {!isEditing && (
              <div className="rounded-2xl border border-dashed border-blue-200 bg-white p-4">
                <p className="text-xs font-bold text-blue-800">
                  El usuario se crea en Supabase Auth y luego se sincroniza con
                  el perfil interno.
                </p>
              </div>
            )}
          </aside>

          <div className="flex items-center justify-between border-t border-blue-100 pt-2 lg:col-span-2">
            <p className="text-[11px] font-medium text-slate-500">
              {isEditing
                ? "Los cambios se aplican sobre el perfil existente."
                : "La cuenta queda lista para iniciar sesión con las credenciales definidas."}
            </p>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                className="rounded-full border border-blue-200 bg-white px-5 py-2.5 text-xs font-black uppercase tracking-[0.18em] text-blue-700 transition-colors hover:bg-blue-50"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="inline-flex items-center gap-2 rounded-full bg-blue-700 px-5 py-2.5 text-xs font-black uppercase tracking-[0.18em] text-white transition-colors hover:bg-blue-800 disabled:opacity-60"
              >
                {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
                {isEditing ? "Guardar cambios" : "Crear usuario"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({
  label,
  hint,
  required,
  children,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-2">
        <span className="block text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">
          {label}
          {required ? " *" : ""}
        </span>
        {hint ? (
          <span className="text-[10px] font-medium text-slate-500">{hint}</span>
        ) : null}
      </div>
      {children}
    </label>
  );
}
