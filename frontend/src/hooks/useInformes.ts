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
      const { data } = await api.post('/informes', nuevoInforme);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['informes', empresaId] });
      queryClient.invalidateQueries({ queryKey: ['dashboard', empresaId] });
    },
  });

  const editarMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<InformeVisita> }) => {
      const { data: resData } = await api.patch(`/informes/${id}`, data);
      return resData;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['informes', empresaId] });
    },
  });

  return {
    ...query,
    crearInforme: crearMutation.mutateAsync,
    isCreating: crearMutation.isPending,
    editarInforme: editarMutation.mutateAsync,
    isEditing: editarMutation.isPending,
  };
};

export const useInformeDetalle = (id: string) => {
  return useQuery<InformeVisita>({
    queryKey: ['informe', id],
    queryFn: async () => {
      const { data } = await api.get(`/informes/${id}`);
      return data;
    },
    enabled: !!id,
  });
};
