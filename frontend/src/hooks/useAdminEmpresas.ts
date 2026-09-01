import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import type { Empresa, Perfil } from "@/types";

export type EmpresaDetalle = Empresa & {
  domicilio?: string | null;
  localidad?: string | null;
  codigo_postal?: string | null;
  provincia?: string | null;
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
  perfiles?: Array<{
    id: string;
    nombre_completo?: string | null;
    username?: string | null;
    activo?: boolean;
    rol?: string;
  }>;
};

export type PreventorActivo = Perfil;

export const getEmpresaDetalle = async (id: string) => {
  const { data } = await api.get(`/empresas/${id}`);
  return data;
};

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

  // Solo preventores activos (queryKey propio: no mezclar con adminUsuarios)
  const preventoresQuery = useQuery({
    queryKey: ["adminPreventores"],
    queryFn: async () => {
      const response = await api.get("/admin/usuarios");
      return (response.data as Perfil[]).filter(
        (u) => u.rol === "preventor" && u.activo !== false,
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

  const crearEmpresasSucursalesMutation = useMutation({
    mutationFn: async (payload: {
      cuit_base: string;
      razon_social: string;
      actividad?: string;
      domicilio?: string;
      localidad?: string;
      codigo_postal?: string;
      provincia?: string;
      telefono?: string;
      contacto?: string;
      sucursales: Array<{
        codigo: string;
        domicilio?: string;
        localidad?: string;
        codigo_postal?: string;
        provincia?: string;
        telefono?: string;
        contacto?: string;
      }>;
    }) => {
      const response = await api.post("/admin/empresas/sucursales", payload);
      return response.data as { empresas: EmpresaDetalle[]; count: number };
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

  const cambiarEstadoEmpresaMutation = useMutation({
    mutationFn: async ({
      id,
      estado,
    }: {
      id: string;
      estado: "activa" | "aviso_deuda" | "pausada" | "eliminada";
    }) => {
      const response = await api.patch(`/admin/empresas/${id}/estado`, {
        estado,
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["adminEmpresas"] });
      queryClient.invalidateQueries({ queryKey: ["adminDashboard"] });
    },
  });

  const crearDuenoEmpresaMutation = useMutation({
    mutationFn: async (payload: {
      empresa_id: string;
      nombre_completo: string;
      username: string;
      password: string;
    }) => {
      const response = await api.post("/admin/usuarios", {
        email: `${payload.username}@placeholder.local`,
        password: payload.password,
        username: payload.username,
        nombre_completo: payload.nombre_completo,
        rol: "dueno",
        empresa_id: payload.empresa_id,
      });
      return response.data as Perfil;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["adminEmpresas"] });
      queryClient.invalidateQueries({ queryKey: ["adminUsuarios"] });
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
    crearEmpresasSucursales: crearEmpresasSucursalesMutation.mutateAsync,
    editarEmpresa: editarEmpresaMutation.mutateAsync,
    cambiarEstadoEmpresa: cambiarEstadoEmpresaMutation.mutateAsync,
    crearDuenoEmpresa: crearDuenoEmpresaMutation.mutateAsync,
    subirLogoEmpresa: subirLogoEmpresaMutation.mutateAsync,
    subirLogoConsultora: subirLogoConsultoraMutation.mutateAsync,
    asignarPreventor: asignarPreventorMutation.mutateAsync,
    desasignarPreventor: desasignarPreventorMutation.mutateAsync,
    buscarCuit: buscarCuitMutation.mutateAsync,
    isSaving:
      crearEmpresaMutation.isPending ||
      crearEmpresasSucursalesMutation.isPending ||
      editarEmpresaMutation.isPending,
    isChangingEstado: cambiarEstadoEmpresaMutation.isPending,
    isSavingDueno: crearDuenoEmpresaMutation.isPending,
    isUploading:
      subirLogoEmpresaMutation.isPending ||
      subirLogoConsultoraMutation.isPending,
    isAssigning:
      asignarPreventorMutation.isPending ||
      desasignarPreventorMutation.isPending,
    isLookingUpCuit: buscarCuitMutation.isPending,
  };
}
