import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import type { AdminEmpresaOption, AdminUsuario } from "@/types";

export type AdminUsuarioFormValues = {
  nombre_completo: string;
  username: string;
  email: string;
  password: string;
  rol: AdminUsuario["rol"];
  empresa_id: string | null;
  activo: boolean;
};

export type AdminUsuarioUpdateValues = Omit<
  AdminUsuarioFormValues,
  "email" | "password"
>;

export function useAdminUsuarios() {
  const queryClient = useQueryClient();

  const usuariosQuery = useQuery({
    queryKey: ["adminUsuarios"],
    queryFn: async () => {
      const response = await api.get("/admin/usuarios");
      return response.data as AdminUsuario[];
    },
  });

  const empresasQuery = useQuery({
    queryKey: ["adminEmpresasForUsers"],
    queryFn: async () => {
      const response = await api.get("/admin/empresas");
      return response.data as AdminEmpresaOption[];
    },
  });

  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: ["adminUsuarios"] });
  };

  const createUsuarioMutation = useMutation({
    mutationFn: async (payload: AdminUsuarioFormValues) => {
      const response = await api.post("/admin/usuarios", {
        email: payload.email,
        password: payload.password,
        username: payload.username,
        nombre_completo: payload.nombre_completo,
        rol: payload.rol,
        empresa_id: payload.rol === "dueno" ? payload.empresa_id : null,
      });
      return response.data as AdminUsuario;
    },
    onSuccess: invalidate,
  });

  const updateUsuarioMutation = useMutation({
    mutationFn: async ({
      id,
      payload,
    }: {
      id: string;
      payload: AdminUsuarioUpdateValues;
    }) => {
      const response = await api.put(`/admin/usuarios/${id}`, {
        nombre_completo: payload.nombre_completo,
        username: payload.username,
        rol: payload.rol,
        activo: payload.activo,
        empresa_id: payload.rol === "dueno" ? payload.empresa_id : null,
      });
      return response.data as AdminUsuario;
    },
    onSuccess: invalidate,
  });

  const toggleUsuarioActivoMutation = useMutation({
    mutationFn: async ({
      usuario,
      activo,
    }: {
      usuario: AdminUsuario;
      activo: boolean;
    }) => {
      const response = await api.put(`/admin/usuarios/${usuario.id}`, {
        nombre_completo: usuario.nombre_completo,
        username: usuario.username,
        rol: usuario.rol,
        activo,
        empresa_id: usuario.rol === "dueno" ? usuario.empresa_id : null,
      });
      return response.data as AdminUsuario;
    },
    onSuccess: invalidate,
  });

  return {
    usuarios: usuariosQuery.data || [],
    empresas: empresasQuery.data || [],
    isLoading: usuariosQuery.isLoading || empresasQuery.isLoading,
    isRefetching: usuariosQuery.isRefetching || empresasQuery.isRefetching,
    error: usuariosQuery.error || empresasQuery.error,
    refetch: () => {
      usuariosQuery.refetch();
      empresasQuery.refetch();
    },
    createUsuario: createUsuarioMutation.mutateAsync,
    updateUsuario: updateUsuarioMutation.mutateAsync,
    toggleUsuarioActivo: toggleUsuarioActivoMutation.mutateAsync,
    isSaving:
      createUsuarioMutation.isPending || updateUsuarioMutation.isPending,
    isToggling: toggleUsuarioActivoMutation.isPending,
  };
}
