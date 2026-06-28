import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { AccionMejora, EstadoAccion } from '../types';

export const usePlanAccion = (empresaId?: string, estado?: EstadoAccion) => {
  const queryClient = useQueryClient();

  const query = useQuery<AccionMejora[]>({
    queryKey: ['plan-accion', empresaId, estado],
    queryFn: async () => {
      const url = estado 
        ? `/plan-accion?empresaId=${empresaId}&estado=${estado}`
        : `/plan-accion?empresaId=${empresaId}`;
      const { data } = await api.get(url);
      return data;
    },
    enabled: !!empresaId,
  });

  const actualizarMutation = useMutation({
    mutationFn: async ({ id, estado: nuevoEstado }: { id: string; estado: EstadoAccion }) => {
      const { data } = await api.patch(`/plan-accion/${id}`, { estado: nuevoEstado });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plan-accion', empresaId] });
      queryClient.invalidateQueries({ queryKey: ['dashboard', empresaId] });
    },
  });

  return {
    ...query,
    actualizarEstado: actualizarMutation.mutateAsync,
    isUpdating: actualizarMutation.isPending,
  };
};
