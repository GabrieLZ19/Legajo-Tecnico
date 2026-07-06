"use client";

import React from "react";
import {
  Edit2,
  MoreHorizontal,
  ShieldCheck,
  UserCheck,
  UserX,
} from "lucide-react";
import type { AdminUsuario } from "@/types";
import { getRoleBadgeClasses, getRoleLabel } from "@/lib/adminUsuarios";

type UsersTableProps = {
  usuarios: AdminUsuario[];
  selectedUsuarioId: string | null;
  onSelectUsuario: (usuarioId: string) => void;
  onEditUsuario: (usuario: AdminUsuario) => void;
  onToggleActivo: (usuario: AdminUsuario) => void;
  isToggling: boolean;
};

function getCompanyCount(usuario: AdminUsuario) {
  if (usuario.rol === "dueno") {
    return usuario.empresa_id ? 1 : 0;
  }

  return usuario.preventor_empresas?.length || 0;
}

function getStatusLabel(activo: boolean) {
  return activo ? "Activo" : "Inactivo";
}

export function UsersTable({
  usuarios,
  selectedUsuarioId,
  onSelectUsuario,
  onEditUsuario,
  onToggleActivo,
  isToggling,
}: UsersTableProps) {
  if (usuarios.length === 0) {
    return (
      <div className="rounded-3xl border border-dashed border-blue-200 bg-blue-50/40 px-6 py-14 text-center">
        <ShieldCheck className="mx-auto h-10 w-10 text-blue-300" />
        <h3 className="mt-4 text-base font-black text-blue-950">
          No hay usuarios cargados
        </h3>
        <p className="mt-2 text-sm text-slate-500">
          Creá el primer usuario para empezar a asignar roles y accesos.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-3xl border border-blue-100 bg-white shadow-[0_12px_40px_rgba(15,23,42,0.06)]">
      <div className="overflow-x-auto">
        <table className="min-w-[980px] divide-y divide-slate-100 text-left xl:min-w-full">
          <thead className="bg-slate-50/80">
            <tr>
              <th className="px-6 py-4 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
                Usuario
              </th>
              <th className="px-6 py-4 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 w-40">
                Rol
              </th>
              <th className="px-6 py-4 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 w-24 text-center">
                Empresas
              </th>
              <th className="px-6 py-4 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 w-28 text-center">
                Estado
              </th>
              <th className="px-6 py-4 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 w-40 text-right">
                Acciones
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {usuarios.map((usuario) => {
              const isSelected = selectedUsuarioId === usuario.id;
              const companyCount = getCompanyCount(usuario);

              return (
                <tr
                  key={usuario.id}
                  onClick={() => onSelectUsuario(usuario.id)}
                  className={`cursor-pointer transition-colors ${
                    isSelected ? "bg-blue-50/50" : "hover:bg-blue-50/30"
                  }`}
                >
                  <td className="px-6 py-4">
                    <div className="min-w-0">
                      <span className="block text-sm font-black text-slate-900">
                        {usuario.nombre_completo || "Sin nombre"}
                      </span>
                      <span className="block text-xs font-medium text-slate-500">
                        @{usuario.username}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`inline-flex items-center rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-[0.14em] ${getRoleBadgeClasses(usuario.rol)}`}
                    >
                      {getRoleLabel(usuario.rol)}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center text-sm font-bold text-slate-700">
                    {companyCount}
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span
                      className={`inline-flex items-center rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-[0.14em] ${usuario.activo ? "bg-emerald-50 text-emerald-700 border border-emerald-100" : "bg-rose-50 text-rose-700 border border-rose-100"}`}
                    >
                      {getStatusLabel(usuario.activo)}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          onToggleActivo(usuario);
                        }}
                        disabled={isToggling}
                        className={`inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-[10px] font-black uppercase tracking-[0.14em] transition-colors ${
                          usuario.activo
                            ? "border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100"
                            : "border border-sky-200 bg-sky-50 text-sky-700 hover:bg-sky-100"
                        } disabled:opacity-60`}
                      >
                        {usuario.activo ? (
                          <UserX className="h-3.5 w-3.5" />
                        ) : (
                          <UserCheck className="h-3.5 w-3.5" />
                        )}
                        {usuario.activo ? "Dar baja" : "Activar"}
                      </button>
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          onEditUsuario(usuario);
                        }}
                        className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-2 text-[10px] font-black uppercase tracking-[0.14em] text-slate-700 transition-colors hover:border-slate-300 hover:bg-slate-50"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                        Editar
                      </button>
                      <button
                        type="button"
                        className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 text-slate-400 transition-colors hover:bg-slate-50 hover:text-slate-700"
                        onClick={(event) => {
                          event.stopPropagation();
                          onEditUsuario(usuario);
                        }}
                        title="Más acciones"
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="xl:hidden divide-y divide-slate-100">
        {usuarios.map((usuario) => {
          const companyCount = getCompanyCount(usuario);
          const isSelected = selectedUsuarioId === usuario.id;

          return (
            <button
              key={usuario.id}
              type="button"
              onClick={() => onSelectUsuario(usuario.id)}
              className={`w-full px-5 py-4 text-left transition-colors ${
                isSelected ? "bg-blue-50/50" : "hover:bg-blue-50/30"
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <span className="block text-sm font-black text-slate-900">
                    {usuario.nombre_completo || "Sin nombre"}
                  </span>
                  <span className="mt-0.5 block text-xs font-medium text-slate-500">
                    @{usuario.username}
                  </span>
                </div>
                <span
                  className={`inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em] ${getRoleBadgeClasses(usuario.rol)}`}
                >
                  {getRoleLabel(usuario.rol)}
                </span>
              </div>

              <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3">
                <span
                  className={`inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em] ${usuario.activo ? "bg-emerald-50 text-emerald-700 border border-emerald-100" : "bg-rose-50 text-rose-700 border border-rose-100"}`}
                >
                  {getStatusLabel(usuario.activo)}
                </span>
                <span className="text-xs font-bold text-slate-500">
                  {companyCount} empresas
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
