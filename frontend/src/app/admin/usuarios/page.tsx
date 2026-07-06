"use client";

import React, { useMemo, useState } from "react";
import { useAlert } from "@/context/AlertContext";
import {
  useAdminUsuarios,
  type AdminUsuarioFormValues,
} from "@/hooks/useAdminUsuarios";
import type { AdminUsuario } from "@/types";
import { PermissionsPanel } from "./_components/permissions-panel";
import { UserFormModal } from "./_components/user-form-modal";
import { UsersTable } from "./_components/users-table";
import {
  AlertTriangle,
  Building2,
  Clock3,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  UserCheck,
  Users,
} from "lucide-react";

type RoleFilter = "all" | AdminUsuario["rol"];

export default function AdminUsuariosPage() {
  const { showAlert } = useAlert();
  const {
    usuarios,
    empresas,
    isLoading,
    isRefetching,
    error,
    refetch,
    createUsuario,
    updateUsuario,
    toggleUsuarioActivo,
    isSaving,
    isToggling,
  } = useAdminUsuarios();

  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");
  const [selectedUsuarioId, setSelectedUsuarioId] = useState<string | null>(
    null,
  );
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUsuario, setEditingUsuario] = useState<AdminUsuario | null>(
    null,
  );

  const selectedUsuario =
    (selectedUsuarioId
      ? usuarios.find((usuario) => usuario.id === selectedUsuarioId) || null
      : null) ||
    usuarios[0] ||
    null;

  const selectedRowId = selectedUsuario?.id || null;

  const filteredUsuarios = useMemo(() => {
    const query = searchTerm.toLowerCase().trim();

    return usuarios.filter((usuario) => {
      const matchesSearch =
        !query ||
        usuario.nombre_completo?.toLowerCase().includes(query) ||
        usuario.username?.toLowerCase().includes(query) ||
        usuario.rol.toLowerCase().includes(query);

      const matchesRole = roleFilter === "all" || usuario.rol === roleFilter;

      return matchesSearch && matchesRole;
    });
  }, [roleFilter, searchTerm, usuarios]);

  const totalUsuarios = usuarios.length;
  const activos = usuarios.filter((usuario) => usuario.activo).length;
  const preventores = usuarios.filter(
    (usuario) => usuario.rol === "preventor",
  ).length;
  const duenos = usuarios.filter((usuario) => usuario.rol === "dueno").length;

  const handleOpenCreate = () => {
    setEditingUsuario(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (usuario: AdminUsuario) => {
    setEditingUsuario(usuario);
    setSelectedUsuarioId(usuario.id);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingUsuario(null);
  };

  const getErrorMessage = (value: unknown, fallback: string) => {
    if (typeof value === "object" && value !== null && "response" in value) {
      const response = value as {
        response?: { data?: { error?: string } };
      };

      return response.response?.data?.error || fallback;
    }

    if (value instanceof Error && value.message) {
      return value.message;
    }

    return fallback;
  };

  const handleSubmitUsuario = async (values: AdminUsuarioFormValues) => {
    try {
      if (editingUsuario) {
        const updated = await updateUsuario({
          id: editingUsuario.id,
          payload: {
            nombre_completo: values.nombre_completo,
            username: values.username,
            rol: values.rol,
            activo: values.activo,
            empresa_id: values.rol === "dueno" ? values.empresa_id : null,
          },
        });

        setSelectedUsuarioId(updated.id);
        showAlert(
          "success",
          "Usuario actualizado",
          "Los cambios se guardaron correctamente.",
        );
        return;
      }

      const created = await createUsuario(values);
      setSelectedUsuarioId(created.id);
      showAlert(
        "success",
        "Usuario creado",
        "La cuenta quedó lista para iniciar sesión.",
      );
    } catch (value) {
      showAlert(
        "error",
        "No se pudo guardar",
        getErrorMessage(value, "Verificá los datos e intentá nuevamente."),
      );
      throw value;
    }
  };

  const handleToggleActivo = async (usuario: AdminUsuario) => {
    try {
      const updated = await toggleUsuarioActivo({
        usuario,
        activo: !usuario.activo,
      });

      if (updated.id === selectedUsuarioId) {
        setSelectedUsuarioId(updated.id);
      }

      showAlert(
        "success",
        updated.activo ? "Usuario activado" : "Usuario dado de baja",
        updated.activo
          ? "El usuario volvió a estar disponible para iniciar sesión."
          : "El usuario quedó inactivo y no podrá acceder al sistema.",
      );
    } catch (value) {
      showAlert(
        "error",
        "No se pudo cambiar el estado",
        getErrorMessage(value, "Intentá nuevamente en unos segundos."),
      );
    }
  };

  const roleFilters: Array<{ value: RoleFilter; label: string }> = [
    { value: "all", label: "Todos" },
    { value: "preventor", label: "Preventores" },
    { value: "dueno", label: "Dueños" },
    { value: "admin", label: "Admins" },
    { value: "ente_regulador", label: "ART / Ente" },
  ];

  if (isLoading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="flex items-center justify-between gap-4">
          <div className="h-10 w-1/3 rounded-lg bg-slate-200" />
          <div className="h-11 w-40 rounded-xl bg-slate-200" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[...Array(4)].map((_, index) => (
            <div key={index} className="h-28 rounded-3xl bg-slate-200" />
          ))}
        </div>
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_360px]">
          <div className="h-180 rounded-3xl bg-slate-200" />
          <div className="h-180 rounded-3xl bg-slate-200" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 border-b border-slate-200/60 pb-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900">
            Gestión de Usuarios
          </h1>
          <p className="mt-1 text-xs font-semibold text-slate-500">
            Altas, bajas y asignación de roles dentro del CUIT.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar..."
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              className="w-60 rounded-2xl border border-slate-200 bg-white py-3 pl-10 pr-4 text-sm font-medium text-slate-700 outline-none transition-colors placeholder:text-slate-400 focus:border-slate-400"
            />
          </div>

          <button
            type="button"
            onClick={handleOpenCreate}
            className="inline-flex items-center gap-2 rounded-2xl bg-blue-700 px-5 py-3 text-xs font-black uppercase tracking-[0.18em] text-white transition-colors hover:bg-blue-800"
          >
            <Plus className="h-4 w-4" />
            Nuevo usuario
          </button>
        </div>
      </div>

      <div className="rounded-3xl border border-blue-100 bg-gradient-to-r from-blue-50 to-sky-50 px-4 py-4 text-sm text-slate-600">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm">
            <ShieldCheck className="h-4 w-4" />
          </div>
          <p className="font-medium leading-relaxed">
            Definí qué módulos visualiza cada perfil dentro del CUIT. El panel
            derecho se actualiza según el usuario seleccionado.
          </p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={<Users className="h-5 w-5" />}
          label="Usuarios totales"
          value={totalUsuarios}
          hint="Registros activos en el sistema"
        />
        <StatCard
          icon={<UserCheck className="h-5 w-5" />}
          label="Usuarios activos"
          value={activos}
          hint="Con acceso habilitado"
        />
        <StatCard
          icon={<Building2 className="h-5 w-5" />}
          label="Preventores"
          value={preventores}
          hint="Asignables a empresas"
        />
        <StatCard
          icon={<Clock3 className="h-5 w-5" />}
          label="Dueños"
          value={duenos}
          hint="Usuarios asociados a una empresa"
        />
      </div>

      {error ? (
        <div className="rounded-3xl border border-blue-200 bg-blue-50 p-6">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 text-blue-700" />
            <div className="min-w-0">
              <h2 className="text-sm font-black text-blue-950">
                No se pudieron cargar los usuarios
              </h2>
              <p className="mt-1 text-sm text-blue-800">
                {getErrorMessage(
                  error,
                  "Ocurrió un error al cargar el listado.",
                )}
              </p>
              <button
                type="button"
                onClick={() => refetch()}
                className="mt-4 inline-flex items-center gap-2 rounded-full bg-blue-700 px-4 py-2.5 text-xs font-black uppercase tracking-[0.18em] text-white transition-colors hover:bg-blue-800"
              >
                <RefreshCw className="h-4 w-4" />
                Reintentar
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_360px]">
        <div className="space-y-5">
          <div className="flex flex-wrap gap-2">
            {roleFilters.map((filter) => (
              <button
                key={filter.value}
                type="button"
                onClick={() => setRoleFilter(filter.value)}
                className={`rounded-full px-4 py-2 text-xs font-black uppercase tracking-[0.18em] transition-colors ${
                  roleFilter === filter.value
                    ? "bg-blue-700 text-white shadow-sm"
                    : "border border-slate-200 bg-white text-slate-500 hover:border-blue-200 hover:bg-blue-50"
                }`}
              >
                {filter.label}
              </button>
            ))}
          </div>

          <UsersTable
            usuarios={filteredUsuarios}
            selectedUsuarioId={selectedRowId}
            onSelectUsuario={(usuarioId) => setSelectedUsuarioId(usuarioId)}
            onEditUsuario={handleOpenEdit}
            onToggleActivo={handleToggleActivo}
            isToggling={isToggling}
          />
        </div>

        <PermissionsPanel usuario={selectedUsuario} />
      </div>


      <UserFormModal
        isOpen={isModalOpen}
        editingUsuario={editingUsuario}
        empresas={empresas}
        isSaving={isSaving}
        onClose={handleCloseModal}
        onSubmit={handleSubmitUsuario}
      />

      {isRefetching ? (
        <div className="pointer-events-none fixed bottom-6 right-6 rounded-full border border-slate-200 bg-white px-4 py-3 text-xs font-black uppercase tracking-[0.18em] text-slate-600 shadow-xl">
          Sincronizando datos...
        </div>
      ) : null}
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  hint,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  hint: string;
}) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-[0_12px_40px_rgba(15,23,42,0.06)]">
      <div className="flex items-center justify-between gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-950 text-white shadow-sm">
          {icon}
        </div>
        <span className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">
          {label}
        </span>
      </div>
      <div className="mt-5">
        <span className="block text-3xl font-black tracking-tight text-slate-900">
          {value}
        </span>
        <span className="mt-2 block text-xs font-medium text-slate-500">
          {hint}
        </span>
      </div>
    </div>
  );
}
