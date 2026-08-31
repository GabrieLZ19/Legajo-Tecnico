import { api } from '../lib/api';

export async function actualizarVisibilidadInforme(
  id: string,
  visible: boolean,
) {
  const { data } = await api.patch(`/informes/${id}/visibilidad-ente`, {
    visible_ente_regulador: visible,
  });
  return data;
}

export async function actualizarVisibilidadCapacitacion(
  id: string,
  visible: boolean,
) {
  const { data } = await api.patch(`/capacitaciones/${id}/visibilidad-ente`, {
    visible_ente_regulador: visible,
  });
  return data;
}

export async function actualizarVisibilidadEppEntrega(
  id: string,
  visible: boolean,
) {
  const { data } = await api.patch(`/epp/entregas/${id}/visibilidad-ente`, {
    visible_ente_regulador: visible,
  });
  return data;
}

export async function actualizarVisibilidadAccion(
  id: string,
  visible: boolean,
) {
  const { data } = await api.patch(`/plan-accion/${id}`, {
    visible_ente_regulador: visible,
  });
  return data;
}
