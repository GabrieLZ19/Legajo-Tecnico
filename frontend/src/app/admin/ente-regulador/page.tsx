"use client";

import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { useAdminUsuarios } from "@/hooks/useAdminUsuarios";
import { Building2, Lock, Save, Shield } from "lucide-react";
import type { AdminEmpresaOption } from "@/types";
import { useAlert } from "@/context/AlertContext";

type PermisosEnte = {
  informes: boolean;
  capacitaciones: boolean;
  epp: boolean;
  metricas: boolean;
};

type Asignacion = {
  empresa_id: string;
  permisos: PermisosEnte;
};

const DEFAULT_PERMISOS: PermisosEnte = {
  informes: true,
  capacitaciones: true,
  epp: true,
  metricas: true,
};

export default function EnteReguladorAdminPage() {
  const { usuarios, empresas, isLoading } = useAdminUsuarios();
  const entes = useMemo(
    () => (usuarios || []).filter((u) => u.rol === "ente_regulador"),
    [usuarios],
  );
  const [selectedEnteId, setSelectedEnteId] = useState<string>("");
  const [asignaciones, setAsignaciones] = useState<Asignacion[]>([]);
  const [saving, setSaving] = useState(false);
  const { showAlert } = useAlert();

  useEffect(() => {
    if (!selectedEnteId && entes[0]) {
      setSelectedEnteId(entes[0].id);
    }
  }, [entes, selectedEnteId]);

  useEffect(() => {
    if (!selectedEnteId) return;
    const load = async () => {
      const { data } = await api.get(`/admin/entes/${selectedEnteId}/empresas`);
      const rows = (data.asignaciones || []) as Array<{
        empresa_id: string;
        permisos: PermisosEnte;
      }>;
      setAsignaciones(rows);
    };
    void load();
  }, [selectedEnteId]);

  const toggleEmpresa = (empresaId: string) => {
    setAsignaciones((prev) => {
      const exists = prev.find((a) => a.empresa_id === empresaId);
      if (exists) return prev.filter((a) => a.empresa_id !== empresaId);
      return [...prev, { empresa_id: empresaId, permisos: { ...DEFAULT_PERMISOS } }];
    });
  };

  const togglePermiso = (empresaId: string, key: keyof PermisosEnte) => {
    setAsignaciones((prev) =>
      prev.map((a) =>
        a.empresa_id === empresaId
          ? { ...a, permisos: { ...a.permisos, [key]: !a.permisos[key] } }
          : a,
      ),
    );
  };

  const handleSave = async () => {
    if (!selectedEnteId) return;
    setSaving(true);
    try {
      await api.put(`/admin/entes/${selectedEnteId}/empresas`, { asignaciones });
      showAlert("success", "Acceso actualizado", "El ente ya puede ver las empresas habilitadas.");
    } catch {
      showAlert("error", "Error", "No se pudo guardar la asignación.");
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) {
    return <p className="text-sm font-bold text-slate-400">Cargando...</p>;
  }

  return (
    <div className="space-y-6 w-full max-w-full">
      <div>
        <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Ente regulador</h1>
        <p className="text-sm text-slate-500 mt-1">
          Habilitá empresas y módulos de solo lectura para ART / municipio.
        </p>
      </div>

      {entes.length === 0 ? (
        <div className="bg-white rounded-3xl border p-8 text-sm text-slate-500">
          Todavía no hay usuarios con rol Ente Regulador. Creálos en Usuarios.
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <aside className="bg-white rounded-3xl border p-5 space-y-2">
            {entes.map((ente) => (
              <button
                key={ente.id}
                type="button"
                onClick={() => setSelectedEnteId(ente.id)}
                className={`w-full text-left px-4 py-3 rounded-2xl text-sm font-bold cursor-pointer ${
                  selectedEnteId === ente.id
                    ? "bg-slate-900 text-white"
                    : "bg-slate-50 text-slate-700"
                }`}
              >
                {ente.nombre_completo}
              </button>
            ))}
          </aside>

          <section className="lg:col-span-2 bg-white rounded-3xl border p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-blue-700" />
                <h2 className="text-sm font-black uppercase tracking-wider">Empresas habilitadas</h2>
              </div>
              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-400">
                <Lock className="h-3 w-3" /> Solo lectura
              </span>
            </div>

            <ul className="space-y-3">
              {(empresas as AdminEmpresaOption[]).map((empresa) => {
                const assigned = asignaciones.find((a) => a.empresa_id === empresa.id);
                return (
                  <li key={empresa.id} className="border border-slate-100 rounded-2xl p-4">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={Boolean(assigned)}
                        onChange={() => toggleEmpresa(empresa.id)}
                      />
                      <Building2 className="h-4 w-4 text-slate-400" />
                      <span className="text-sm font-bold text-slate-800">{empresa.razon_social}</span>
                    </label>
                    {assigned && (
                      <div className="mt-3 flex flex-wrap gap-2 pl-8">
                        {(Object.keys(DEFAULT_PERMISOS) as Array<keyof PermisosEnte>).map((key) => (
                          <button
                            key={key}
                            type="button"
                            onClick={() => togglePermiso(empresa.id, key)}
                            className={`px-3 py-1 rounded-full text-[11px] font-bold cursor-pointer ${
                              assigned.permisos[key]
                                ? "bg-blue-600 text-white"
                                : "bg-slate-100 text-slate-500"
                            }`}
                          >
                            {key}
                          </button>
                        ))}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>

            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="inline-flex items-center gap-2 px-5 py-3 bg-slate-900 text-white rounded-xl text-sm font-bold cursor-pointer disabled:opacity-50"
            >
              <Save className="h-4 w-4" />
              Guardar habilitación
            </button>
          </section>
        </div>
      )}
    </div>
  );
}
