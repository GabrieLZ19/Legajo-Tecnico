import { api } from "@/lib/api";
import type {
  ChecklistPlantilla,
  Equipo,
  Inspeccion,
  InspeccionAccion,
  CriticidadChecklist,
  CalificacionChecklist,
} from "@/types";

export type ItemPlantillaInput = {
  texto: string;
  criticidad: CriticidadChecklist;
  orden?: number;
};

export type ItemInspeccionInput = {
  texto: string;
  criticidad: CriticidadChecklist;
  calificacion: CalificacionChecklist;
  orden?: number;
};

export type AccionInspeccionInput = {
  descripcion: string;
  responsable?: string | null;
  fecha_vencimiento?: string | null;
};

export const checklistsService = {
  // Plantillas
  async listarPlantillas(params: {
    ambito: "empresa" | "global";
    empresaId?: string;
    estado?: string;
    tipo_equipo?: string;
  }) {
    const { data } = await api.get<ChecklistPlantilla[]>(
      "/checklists/plantillas",
      {
        params: {
          ambito: params.ambito,
          empresaId: params.empresaId,
          estado: params.estado,
          tipo_equipo: params.tipo_equipo,
        },
      },
    );
    return data;
  },

  async obtenerPlantilla(id: string) {
    const { data } = await api.get<ChecklistPlantilla>(
      `/checklists/plantillas/${id}`,
    );
    return data;
  },

  async crearPlantilla(payload: {
    titulo: string;
    tipo_equipo: string;
    ambito: "empresa" | "global";
    empresa_id?: string | null;
    publicar_directo?: boolean;
    items: ItemPlantillaInput[];
  }) {
    const { data } = await api.post<ChecklistPlantilla>(
      "/checklists/plantillas",
      payload,
    );
    return data;
  },

  async actualizarPlantilla(
    id: string,
    payload: {
      titulo?: string;
      tipo_equipo?: string;
      items?: ItemPlantillaInput[];
    },
  ) {
    const { data } = await api.patch<ChecklistPlantilla>(
      `/checklists/plantillas/${id}`,
      payload,
    );
    return data;
  },

  async actualizarPublicacion(
    id: string,
    payload: { estado: "aprobada" | "rechazada"; rechazo_motivo?: string | null },
  ) {
    const { data } = await api.patch<ChecklistPlantilla>(
      `/checklists/plantillas/${id}/publicacion`,
      payload,
    );
    return data;
  },

  async eliminarPlantilla(id: string) {
    await api.delete(`/checklists/plantillas/${id}`);
  },

  // Equipos
  async listarEquipos(empresaId: string, todos = false) {
    const { data } = await api.get<Equipo[]>("/checklists/equipos", {
      params: { empresaId, todos: todos ? "1" : undefined },
    });
    return data;
  },

  async obtenerEquipo(id: string) {
    const { data } = await api.get<Equipo & { historial: Inspeccion[] }>(
      `/checklists/equipos/${id}`,
    );
    return data;
  },

  async crearEquipo(payload: {
    empresa_id: string;
    nombre: string;
    tipo_equipo: string;
    codigo_interno?: string | null;
    ubicacion?: string | null;
    notas?: string | null;
  }) {
    const { data } = await api.post<Equipo>("/checklists/equipos", payload);
    return data;
  },

  async actualizarEquipo(
    id: string,
    payload: Partial<{
      nombre: string;
      tipo_equipo: string;
      codigo_interno: string | null;
      ubicacion: string | null;
      notas: string | null;
      activo: boolean;
    }>,
  ) {
    const { data } = await api.patch<Equipo>(
      `/checklists/equipos/${id}`,
      payload,
    );
    return data;
  },

  // Inspecciones
  async listarInspecciones(params: {
    empresaId: string;
    equipoId?: string;
    limit?: number;
    offset?: number;
  }) {
    const { data } = await api.get<{
      inspecciones: Inspeccion[];
      total: number;
    }>("/checklists/inspecciones", { params });
    return data;
  },

  async obtenerInspeccion(id: string) {
    const { data } = await api.get<Inspeccion>(
      `/checklists/inspecciones/${id}`,
    );
    return data;
  },

  async crearInspeccion(payload: {
    empresa_id: string;
    equipo_id: string;
    plantilla_id?: string | null;
    plantilla_titulo: string;
    observaciones?: string | null;
    inspector_nombre?: string | null;
    items: ItemInspeccionInput[];
    acciones?: AccionInspeccionInput[];
  }) {
    const { data } = await api.post<Inspeccion>(
      "/checklists/inspecciones",
      payload,
    );
    return data;
  },

  async actualizarAccion(
    id: string,
    estado: "pendiente" | "en_curso" | "cumplida",
  ) {
    const { data } = await api.patch<InspeccionAccion>(
      `/checklists/acciones/${id}`,
      { estado },
    );
    return data;
  },

  // Público QR
  async equipoPorQr(token: string) {
    const { data } = await api.get<{
      equipo: {
        id: string;
        nombre: string;
        tipo_equipo: string;
        codigo_interno: string | null;
        ubicacion: string | null;
        empresa_id: string;
        empresa_nombre: string | null;
      };
      plantillas: ChecklistPlantilla[];
    }>(`/checklists/qr/${token}`);
    return data;
  },

  async crearInspeccionPublica(
    token: string,
    payload: {
      plantilla_id?: string | null;
      plantilla_titulo: string;
      observaciones?: string | null;
      inspector_nombre: string;
      items: ItemInspeccionInput[];
      acciones?: AccionInspeccionInput[];
      idempotency_key: string;
    },
  ) {
    const { data } = await api.post<{
      id: string;
      resultado: string;
      mensaje: string;
      idempotent?: boolean;
    }>(`/checklists/qr/${token}/inspecciones`, payload);
    return data;
  },
};
