import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import type { Empresa, Perfil } from "@/types";

export type EmpresaDetalle = Empresa & {
  domicilio?: string | null;
  localidad?: string | null;
  codigo_postal?: string | null;
  telefono?: string | null;
  contacto?: string | null;
  consultoras?: {
    id?: string;
    nombre?: string | null;
    logo_url?: string | null;
  } | null;
  preventor_empresas?: Array<{
    preventor_id: string;
    perfiles?: {
      nombre_completo?: string | null;
    } | null;
  }>;
};

export type PreventorActivo = Perfil;

export function useAdminEmpresas() {
  const queryClient = useQueryClient();

  // Query: list of all companies
  const empresasQuery = useQuery({
    queryKey: ["adminEmpresas"],
    queryFn: async () => {
      const response = await api.get("/admin/empresas");
      return response.data as EmpresaDetalle[];
    },
  });

  // Query: list of all preventores (users with role 'preventor' and active)
  const preventoresQuery = useQuery({
    queryKey: ["adminUsuarios"],
    queryFn: async () => {
      const response = await api.get("/admin/usuarios");
      return (response.data as Perfil[]).filter(
        (u) => u.rol === "preventor" && u.activo,
      );
    },
  });

  // Mutation: create company
  const crearEmpresaMutation = useMutation({
    mutationFn: async (newEmpresa: any) => {
      const response = await api.post("/admin/empresas", newEmpresa);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["adminEmpresas"] });
    },
  });

  // Mutation: edit company
  const editarEmpresaMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const response = await api.put(`/admin/empresas/${id}`, data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["adminEmpresas"] });
    },
  });

  // Mutation: upload company logo
  const subirLogoEmpresaMutation = useMutation({
    mutationFn: async ({
      id,
      formData,
    }: {
      id: string;
      formData: FormData;
    }) => {
      const response = await api.post(`/admin/empresas/${id}/logo`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["adminEmpresas"] });
    },
  });

  // Mutation: upload consultora logo
  const subirLogoConsultoraMutation = useMutation({
    mutationFn: async ({
      id,
      formData,
    }: {
      id: string;
      formData: FormData;
    }) => {
      const response = await api.post(
        `/admin/consultoras/${id}/logo`,
        formData,
        {
          headers: { "Content-Type": "multipart/form-data" },
        },
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["adminEmpresas"] });
    },
  });

  // Mutation: assign preventor to company
  const asignarPreventorMutation = useMutation({
    mutationFn: async ({
      preventorId,
      empresaId,
    }: {
      preventorId: string;
      empresaId: string;
    }) => {
      const response = await api.post("/admin/preventores/asignar", {
        preventor_id: preventorId,
        empresa_id: empresaId,
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["adminEmpresas"] });
    },
  });

  // Mutation: unassign preventor from company
  const desasignarPreventorMutation = useMutation({
    mutationFn: async ({
      preventorId,
      empresaId,
    }: {
      preventorId: string;
      empresaId: string;
    }) => {
      const response = await api.post("/admin/preventores/desasignar", {
        preventor_id: preventorId,
        empresa_id: empresaId,
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["adminEmpresas"] });
    },
  });

  // Mutation: lookup CUIT from AFIP (via backend)
  const buscarCuitMutation = useMutation({
    mutationFn: async (cuit: string) => {
      const response = await api.get(`/admin/empresas/buscar-cuit/${cuit}`);
      return response.data;
    },
  });

  return {
    empresas: empresasQuery.data || [],
    preventores: preventoresQuery.data || [],
    isLoading: empresasQuery.isLoading || preventoresQuery.isLoading,
    isError: empresasQuery.isError || preventoresQuery.isError,
    refetch: () => {
      empresasQuery.refetch();
      preventoresQuery.refetch();
    },
    crearEmpresa: crearEmpresaMutation.mutateAsync,
    editarEmpresa: editarEmpresaMutation.mutateAsync,
    subirLogoEmpresa: subirLogoEmpresaMutation.mutateAsync,
    subirLogoConsultora: subirLogoConsultoraMutation.mutateAsync,
    asignarPreventor: asignarPreventorMutation.mutateAsync,
    desasignarPreventor: desasignarPreventorMutation.mutateAsync,
    buscarCuit: buscarCuitMutation.mutateAsync,
    isSaving: crearEmpresaMutation.isPending || editarEmpresaMutation.isPending,
    isUploading:
      subirLogoEmpresaMutation.isPending ||
      subirLogoConsultoraMutation.isPending,
    isAssigning:
      asignarPreventorMutation.isPending ||
      desasignarPreventorMutation.isPending,
    isLookingUpCuit: buscarCuitMutation.isPending,
  };
}
