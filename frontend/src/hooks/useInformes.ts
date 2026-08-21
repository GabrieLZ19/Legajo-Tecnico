import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { InformeVisita } from '../types';

export const useInformes = (empresaId?: string) => {
  const queryClient = useQueryClient();

  const query = useQuery<InformeVisita[]>({
    queryKey: ['informes', empresaId],
    queryFn: async () => {
      const { data } = await api.get(`/informes?empresaId=${empresaId}`);
      return data;
    },
    enabled: !!empresaId,
  });

  const crearMutation = useMutation({
    mutationFn: async (nuevoInforme: any) => {
      const { data } = await api.post('/informes', nuevoInforme, {
        // Informes con muchas observaciones pueden demorar en redes móviles
        timeout: 60000,
      });
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['informes'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      if (data?.id) {
        queryClient.setQueryData(['informe', data.id], data);
      }
    },
  });

  const editarMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<InformeVisita> }) => {
      const { data: resData } = await api.patch(`/informes/${id}`, data, {
        timeout: 60000,
      });
      return resData as InformeVisita;
    },
    onSuccess: async (data, variables) => {
      // Cancelar fetches en vuelo para que no pisen el resultado fresco del PATCH
      await queryClient.cancelQueries({ queryKey: ['informe', variables.id] });
      if (data) {
        queryClient.setQueryData(['informe', variables.id], data);
      }
      queryClient.invalidateQueries({ queryKey: ['informes'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });

  const eliminarMutation = useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.delete(`/informes/${id}`);
      return data;
    },
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: ['informes'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.removeQueries({ queryKey: ['informe', id] });
    },
  });

  return {
    ...query,
    crearInforme: crearMutation.mutateAsync,
    isCreating: crearMutation.isPending,
    editarInforme: editarMutation.mutateAsync,
    isEditing: editarMutation.isPending,
    eliminarInforme: eliminarMutation.mutateAsync,
    isDeleting: eliminarMutation.isPending,
  };
};

export const useInformeDetalle = (
  id: string,
  options?: { refetchOnWindowFocus?: boolean },
) => {
  return useQuery<InformeVisita>({
    queryKey: ['informe', id],
    queryFn: async () => {
      const { data } = await api.get(`/informes/${id}`);
      return data;
    },
    enabled: !!id,
    refetchOnWindowFocus: options?.refetchOnWindowFocus ?? true,
  });
};

export const descargarInformePdf = async (id: string) => {
  const response = await api.get(`/informes/${id}/pdf`, {
    responseType: "blob",
    timeout: 60000,
  });
  return response.data as Blob;
};

export const subirEvidenciaInforme = async (id: string, formData: FormData) => {
  const { data } = await api.post(`/informes/${id}/evidencia`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    // Fotos desde celular suelen ser pesadas; evitar timeout 20s default
    timeout: 120000,
  });
  return data;
};

export const firmarInforme = async (
  endpoint: string,
  payload: { firma_base64: string },
) => {
  const { data } = await api.post(endpoint, payload, {
    // Generación de PDF post-firma puede demorar
    timeout: 120000,
  });
  return data;
};
