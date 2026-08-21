import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';

export function useAdminDashboard(empresaId?: string, fechaDesde?: string, fechaHasta?: string) {
  // Query 1: Dashboard metrics
  const dashboardQuery = useQuery({
    queryKey: ['adminDashboard', empresaId, fechaDesde, fechaHasta],
    queryFn: async () => {
      const response = await api.get('/admin/dashboard', {
        params: {
          ...(empresaId ? { empresaId } : {}),
          ...(fechaDesde ? { fechaDesde } : {}),
          ...(fechaHasta ? { fechaHasta } : {}),
        }
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

  // Query 3: List of reports (respuesta paginada { items, total })
  const informesQuery = useQuery({
    queryKey: ['adminInformes', empresaId],
    queryFn: async () => {
      const response = await api.get('/informes', {
        params: {
          ...(empresaId ? { empresaId } : {}),
          limit: 100,
          offset: 0,
        },
      });
      const data = response.data;
      if (Array.isArray(data)) return data;
      if (data && Array.isArray(data.items)) return data.items;
      return [];
    },
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
