import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { AccionMejora, EstadoAccion } from '../types';

export type PlanAccionListPage = {
  items: AccionMejora[];
  total: number;
  limit: number;
  offset: number;
  resumen: {
    total: number;
    cumplidas: number;
    pendientes: number;
    atendidas: number;
  };
};

type UsePlanAccionOpts = {
  limit?: number;
  offset?: number;
};

export const usePlanAccion = (
  empresaId?: string,
  estado?: EstadoAccion,
  opts?: UsePlanAccionOpts,
  responsable?: string,
) => {
  const queryClient = useQueryClient();
  const limit = opts?.limit ?? 10;
  const offset = opts?.offset ?? 0;

  const query = useQuery<PlanAccionListPage>({
    queryKey: ['plan-accion', empresaId, estado, responsable, limit, offset],
    queryFn: async () => {
      const { data } = await api.get('/plan-accion', {
        params: {
          empresaId,
          ...(estado ? { estado } : {}),
          ...(responsable ? { responsable } : {}),
          limit,
          offset,
        },
      });
      if (Array.isArray(data)) {
        const items = data as AccionMejora[];
        return {
          items,
          total: items.length,
          limit,
          offset,
          resumen: {
            total: items.length,
            cumplidas: items.filter((a) => a.estado === 'cumplida').length,
            pendientes: items.filter((a) => a.estado === 'pendiente').length,
            atendidas: items.filter((a) => a.estado === 'atendida').length,
          },
        };
      }
      return data as PlanAccionListPage;
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
    data: query.data?.items,
    total: query.data?.total ?? 0,
    limit: query.data?.limit ?? limit,
    offset: query.data?.offset ?? offset,
    resumen: query.data?.resumen,
    actualizarEstado: actualizarMutation.mutateAsync,
    isUpdating: actualizarMutation.isPending,
  };
};

export const usePlanAccionResponsables = (empresaId?: string) => {
  return useQuery<string[]>({
    queryKey: ['plan-accion-responsables', empresaId],
    queryFn: async () => {
      const { data } = await api.get('/plan-accion/responsables', {
        params: { empresaId },
      });
      return data as string[];
    },
    enabled: !!empresaId,
  });
};

export const actualizarEstadoPlanAccion = async (id: string, estado: EstadoAccion) => {
  const { data } = await api.patch(`/plan-accion/${id}`, { estado });
  return data;
};

export const exportarPlanAccion = async (
  empresaId: string,
  format: "csv" | "pdf",
) => {
  const response = await api.get(
    `/plan-accion/export?empresaId=${empresaId}&format=${format}`,
    {
      responseType: "blob",
      timeout: 60000,
    },
  );
  return response.data as Blob;
};
