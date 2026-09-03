"use client";

import { useEffect, useMemo, useState } from "react";
import type { AdminUsuario } from "@/types";
import {
  ACCESS_LEVELS,
  getAccessLabel,
  getRoleLabel,
  permissionsAreEqual,
  resolveModulePermissions,
  type AccessLevel,
  type RoleModulePermission,
} from "@/lib/adminUsuarios";
import {
  CheckCircle2,
  Loader2,
  RotateCcw,
  Save,
  ShieldCheck,
} from "lucide-react";
import { useAdminUsuarios } from "@/hooks/useAdminUsuarios";

type PermissionsPanelProps = {
  usuario: AdminUsuario | null;
  onSaved?: (usuario: AdminUsuario) => void;
  onError?: (message: string) => void;
};

const ACCESS_OPTIONS: Array<{
  value: AccessLevel;
  label: string;
  activeClass: string;
}> = [
  {
    value: "total",
    label: "Total",
    activeClass: "bg-blue-700 text-white shadow-sm",
  },
  {
    value: "lectura",
    label: "Lectura",
    activeClass: "bg-sky-600 text-white shadow-sm",
  },
  {
    value: "oculto",
    label: "Oculto",
    activeClass: "bg-slate-500 text-white shadow-sm",
  },
];

export function PermissionsPanel({
  usuario,
  onSaved,
  onError,
}: PermissionsPanelProps) {
  const { updateUsuario } = useAdminUsuarios();
  const [customPermissions, setCustomPermissions] = useState<
    RoleModulePermission[]
  >([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const baseline = useMemo(
    () =>
      usuario
        ? resolveModulePermissions(
            usuario.rol,
            usuario.permisos_personalizados as
              | RoleModulePermission[]
              | null
              | undefined,
          )
        : [],
    [usuario],
  );

  useEffect(() => {
    setCustomPermissions(baseline.map((item) => ({ ...item })));
    setSaved(false);
  }, [baseline]);

  const isDirty = useMemo(
    () => !permissionsAreEqual(customPermissions, baseline),
    [baseline, customPermissions],
  );

  const handleSetAccess = (moduleName: string, access: AccessLevel) => {
    if (!usuario) return;
    setCustomPermissions((prev) =>
      prev.map((item) =>
        item.module === moduleName ? { ...item, access } : item,
      ),
    );
    setSaved(false);
  };

  const handleResetDefaults = () => {
    if (!usuario) return;
    setCustomPermissions(
      resolveModulePermissions(usuario.rol, null).map((item) => ({ ...item })),
    );
    setSaved(false);
  };

  const handleSave = async () => {
    if (!usuario || !isDirty) return;

    try {
      setSaving(true);
      const updated = await updateUsuario({
        id: usuario.id,
        payload: {
          nombre_completo: usuario.nombre_completo || "",
          username: usuario.username,
          rol: usuario.rol,
          activo: usuario.activo,
          empresa_id: usuario.empresa_id || null,
          permisos_personalizados: customPermissions,
        },
      });
      setSaved(true);
      onSaved?.(updated);
      window.setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      console.error("Error saving permissions:", err);
      onError?.("No se pudieron guardar los permisos. Intentá de nuevo.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <aside className="rounded-[28px] border border-blue-100 bg-white shadow-[0_12px_40px_rgba(15,23,42,0.06)] overflow-hidden">
      <div className="border-b border-blue-100 bg-linear-to-r from-blue-50 to-white px-6 py-5">
        <div className="flex items-start gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-700 text-white shadow-sm">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h3 className="text-base font-black text-slate-900">
              Gestión de Permisos
            </h3>
            {usuario ? (
              <p className="mt-1 text-sm text-slate-500">
                <span className="font-bold text-slate-700">
                  {usuario.nombre_completo || usuario.username}
                </span>
                <span className="mx-1.5 text-slate-300">·</span>
                {getRoleLabel(usuario.rol)}
              </p>
            ) : (
              <p className="mt-1 text-sm text-slate-500">
                Seleccioná un usuario de la tabla para editar su alcance.
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="space-y-5 px-6 py-5">
        <div className="rounded-[22px] border border-blue-100 bg-blue-50/60 p-3">
          <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 border-b border-blue-100 px-3 py-3 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
            <span>Módulo</span>
            <span className="text-right">Nivel de acceso</span>
          </div>

          <div className="divide-y divide-blue-100/80 max-h-105 overflow-y-auto">
            {customPermissions.length > 0 ? (
              customPermissions.map((module) => (
                <div
                  key={module.module}
                  className="grid grid-cols-1 gap-3 px-3 py-3.5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
                >
                  <div className="min-w-0">
                    <span className="block font-semibold text-slate-800">
                      {module.module}
                    </span>
                    <span className="mt-1 block text-xs text-slate-500">
                      {module.description}
                    </span>
                  </div>

                  <div
                    className="inline-flex rounded-full border border-slate-200 bg-white p-1 shadow-sm"
                    role="group"
                    aria-label={`Acceso de ${module.module}`}
                  >
                    {ACCESS_OPTIONS.map((option) => {
                      if (
                        usuario?.rol === "ente_regulador" &&
                        option.value === "total"
                      ) {
                        return null;
                      }
                      const active = module.access === option.value;
                      return (
                        <button
                          key={option.value}
                          type="button"
                          disabled={!usuario || saving}
                          onClick={() =>
                            handleSetAccess(module.module, option.value)
                          }
                          className={`rounded-full px-2.5 py-1.5 text-[10px] font-black uppercase tracking-[0.12em] transition-all disabled:opacity-50 ${
                            active
                              ? option.activeClass
                              : "text-slate-500 hover:bg-slate-50"
                          }`}
                          aria-pressed={active}
                          title={getAccessLabel(option.value)}
                        >
                          {option.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))
            ) : (
              <div className="p-8 text-center text-xs font-bold text-slate-400 uppercase tracking-widest">
                Sin usuario seleccionado
              </div>
            )}
          </div>
        </div>

        {usuario ? (
          <div className="space-y-3">
            <div className="flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                onClick={handleSave}
                disabled={saving || !isDirty}
                className={`flex flex-1 items-center justify-center gap-2 rounded-2xl py-3.5 text-sm font-black transition-all active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50 ${
                  saved
                    ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/20"
                    : "bg-blue-700 text-white shadow-lg shadow-blue-700/20 hover:bg-blue-800"
                }`}
              >
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : saved ? (
                  <CheckCircle2 className="h-4 w-4" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                {saving
                  ? "Guardando..."
                  : saved
                    ? "Permisos guardados"
                    : isDirty
                      ? "Guardar cambios"
                      : "Sin cambios"}
              </button>

              <button
                type="button"
                onClick={handleResetDefaults}
                disabled={saving}
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3.5 text-xs font-black uppercase tracking-[0.14em] text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-50"
                title="Volver a los permisos por defecto del rol"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Por defecto
              </button>
            </div>

            {isDirty ? (
              <p className="text-center text-[11px] font-semibold text-amber-600">
                Hay cambios sin guardar
              </p>
            ) : null}
          </div>
        ) : null}

        <div className="flex flex-wrap gap-3 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">
          {ACCESS_LEVELS.map((level) => (
            <span key={level} className="inline-flex items-center gap-1.5">
              <span
                className={`h-2.5 w-2.5 rounded-full ${
                  level === "total"
                    ? "bg-blue-700"
                    : level === "lectura"
                      ? "bg-sky-600"
                      : "bg-slate-400"
                }`}
              />
              {getAccessLabel(level)}
            </span>
          ))}
        </div>
      </div>
    </aside>
  );
}
