import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';

export interface PlantillaDeclaracion {
  id: string;
  nombre: string;
  contenido: string;
  creado_por: string;
  consultora_id: string;
  created_at: string;
}

export const usePlantillas = () => {
  const queryClient = useQueryClient();

  const query = useQuery<PlantillaDeclaracion[]>({
    queryKey: ['plantillas'],
    queryFn: async () => {
      const { data } = await api.get('/plantillas-declaracion');
      return data;
    },
  });

  const crearMutation = useMutation({
    mutationFn: async (nueva: { nombre: string; contenido: string }) => {
      const { data } = await api.post('/plantillas-declaracion', nueva);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plantillas'] });
    },
  });

  const eliminarMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/plantillas-declaracion/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plantillas'] });
    },
  });

  return {
    ...query,
    plantillas: query.data || [],
    crearPlantilla: crearMutation.mutateAsync,
    isCreating: crearMutation.isPending,
    eliminarPlantilla: eliminarMutation.mutateAsync,
    isDeleting: eliminarMutation.isPending,
  };
};
