"use client";

import React, { useEffect, useState } from "react";
import type { AdminUsuario } from "@/types";
import { api } from "@/lib/api";
import {
  MODULE_PERMISSIONS,
  getAccessBadgeClasses,
  getAccessLabel,
  AccessLevel
} from "@/lib/adminUsuarios";
import { ClipboardCheck, ListChecks, ShieldCheck, Users, Save, Loader2, CheckCircle2 } from "lucide-react";

type PermissionsPanelProps = {
  usuario: AdminUsuario | null;
  onUpdate?: () => void;
};

const roleIcons = {
  preventor: Users,
  dueno: ShieldCheck,
  admin: ClipboardCheck,
  ente_regulador: ListChecks,
} as const;

const ACCESS_LEVELS: AccessLevel[] = ["total", "lectura", "oculto"];

export function PermissionsPanel({ usuario, onUpdate }: PermissionsPanelProps) {
  const [activeRole, setActiveRole] = useState<AdminUsuario["rol"]>(
    usuario?.rol || "preventor",
  );
  const [customPermissions, setCustomPermissions] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (usuario) {
      setActiveRole(usuario.rol);
      // Si el usuario ya tiene permisos guardados, usarlos. Si no, usar los defaults del rol.
      setCustomPermissions(usuario.permisos_personalizados || MODULE_PERMISSIONS[usuario.rol]);
    } else {
      setCustomPermissions([]);
      setSaved(false);
    }
  }, [usuario]);

  const handleToggleAccess = (moduleName: string) => {
    if (!usuario) return;
    
    setCustomPermissions(prev => prev.map(m => {
      if (m.module === moduleName) {
        const currentIndex = ACCESS_LEVELS.indexOf(m.access);
        const nextIndex = (currentIndex + 1) % ACCESS_LEVELS.length;
        return { ...m, access: ACCESS_LEVELS[nextIndex] };
      }
      return m;
    }));
    setSaved(false);
  };

  const handleSave = async () => {
    if (!usuario) return;
    
    try {
      setSaving(true);
      await api.put(`/admin/usuarios/${usuario.id}`, {
        ...usuario,
        permisos_personalizados: customPermissions
      });
      setSaved(true);
      if (onUpdate) onUpdate();
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      console.error("Error saving permissions:", err);
      alert("No se pudieron guardar los permisos.");
    } finally {
      setSaving(false);
    }
  };

  const RoleIcon = roleIcons[activeRole];

  return (
    <aside className="rounded-[28px] border border-blue-100 bg-white shadow-[0_12px_40px_rgba(15,23,42,0.06)] overflow-hidden">
      <div className="border-b border-blue-100 bg-linear-to-r from-blue-50 to-white px-6 py-5">
        <div className="flex items-start gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-700 text-white shadow-sm">
            <RoleIcon className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h3 className="text-base font-black text-slate-900">
              Gestión de Permisos
            </h3>
            <p className="mt-1 text-sm text-slate-500">
              {usuario
                ? "Personalizá el alcance de este usuario."
                : "Seleccioná un usuario para editar."}
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-5 px-6 py-5">
        <div className="rounded-[22px] border border-blue-100 bg-blue-50/60 p-3">
          <div className="grid grid-cols-[1fr_auto] gap-3 border-b border-blue-100 px-3 py-3 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
            <span>Módulo</span>
            <span>Acceso (Click para cambiar)</span>
          </div>
          <div className="divide-y divide-blue-100/80 max-h-[400px] overflow-y-auto custom-scrollbar">
            {customPermissions.length > 0 ? (
              customPermissions.map((module) => (
                <div
                  key={module.module}
                  className="grid grid-cols-[1fr_auto] items-center gap-3 px-3 py-3.5 text-sm hover:bg-white/50 transition-colors cursor-pointer group"
                  onClick={() => handleToggleAccess(module.module)}
                >
                  <div className="min-w-0">
                    <span className="block font-medium text-slate-800">
                      {module.module}
                    </span>
                    <span className="mt-1 block text-xs text-slate-500 line-clamp-1">
                      {module.description}
                    </span>
                  </div>
                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.16em] transition-all group-active:scale-90 ${getAccessBadgeClasses(module.access)}`}
                  >
                    {getAccessLabel(module.access)}
                  </span>
                </div>
              ))
            ) : (
              <div className="p-8 text-center text-xs font-bold text-slate-400 uppercase tracking-widest">
                Sin usuario seleccionado
              </div>
            )}
          </div>
        </div>

        {usuario && (
          <button 
            onClick={handleSave}
            disabled={saving}
            className={`w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl text-sm font-black transition-all active:scale-95 ${
              saved 
                ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20' 
                : 'bg-blue-700 hover:bg-blue-800 text-white shadow-lg shadow-blue-700/20'
            }`}
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : saved ? (
              <CheckCircle2 className="h-4 w-4" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            {saving ? 'Guardando...' : saved ? 'Permisos Guardados' : 'Guardar Permisos Personalizados'}
          </button>
        )}

        <div className="flex flex-wrap gap-3 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-blue-500" /> Total
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-sky-500" /> Solo lectura
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-slate-300" /> Oculto
          </span>
        </div>
      </div>
    </aside>
  );
}
