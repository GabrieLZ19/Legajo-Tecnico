import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { MetricasDashboard } from '../types';

export const useDashboard = (empresaId: string | undefined) => {
  return useQuery<MetricasDashboard>({
    queryKey: ['dashboard', empresaId],
    queryFn: async () => {
      const { data } = await api.get(`/dashboard/${empresaId}`);
      return data;
    },
    enabled: !!empresaId,
  });
};
