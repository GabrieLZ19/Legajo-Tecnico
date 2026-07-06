import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';

export function useAdminDashboard(empresaId?: string) {
  // Query 1: Dashboard metrics
  const dashboardQuery = useQuery({
    queryKey: ['adminDashboard', empresaId],
    queryFn: async () => {
      const response = await api.get('/admin/dashboard', {
        params: empresaId ? { empresaId } : {}
      });
      return response.data;
    }
  });

  // Query 2: List of companies
  const empresasQuery = useQuery({
    queryKey: ['adminEmpresas'],
    queryFn: async () => {
      const response = await api.get('/admin/empresas');
      return response.data;
    }
  });

  // Query 3: List of all reports
  const informesQuery = useQuery({
    queryKey: ['adminInformes', empresaId],
    queryFn: async () => {
      const response = await api.get('/informes', {
        params: empresaId ? { empresaId } : {}
      });
      return response.data;
    }
  });

  return {
    metrics: dashboardQuery.data,
    empresas: empresasQuery.data || [],
    informes: informesQuery.data || [],
    isLoading: dashboardQuery.isLoading || empresasQuery.isLoading || informesQuery.isLoading,
    isRefetching: dashboardQuery.isRefetching || empresasQuery.isRefetching || informesQuery.isRefetching,
    error: dashboardQuery.error || empresasQuery.error || informesQuery.error,
    refetch: () => {
      dashboardQuery.refetch();
      empresasQuery.refetch();
      informesQuery.refetch();
    }
  };
}
