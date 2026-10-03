import { api } from "@/lib/api";
import type {
  CategoriaDocumento,
  DocumentoVencimiento,
  DocumentoVencimientoProximo,
} from "@/types";

export type ListarDocumentosParams = {
  empresaId: string;
  categoria: CategoriaDocumento;
  tipo?: string;
  q?: string;
  limit?: number;
  offset?: number;
};

export const documentosVencimientoService = {
  async listar(params: ListarDocumentosParams) {
    const { data } = await api.get<{
      documentos: DocumentoVencimiento[];
      total: number;
      limit: number;
      offset: number;
    }>("/documentos-vencimiento", {
      params: {
        empresaId: params.empresaId,
        categoria: params.categoria,
        tipo: params.tipo,
        q: params.q,
        limit: params.limit,
        offset: params.offset,
      },
    });
    return data;
  },

  async listarTipos(empresaId: string, categoria: CategoriaDocumento) {
    const { data } = await api.get<{ tipos: string[] }>(
      "/documentos-vencimiento/tipos",
      { params: { empresaId, categoria } },
    );
    return data.tipos;
  },

  async proximos(empresaId: string, dias = 60, limit = 6) {
    const { data } = await api.get<{ items: DocumentoVencimientoProximo[] }>(
      "/documentos-vencimiento/proximos",
      { params: { empresaId, dias, limit } },
    );
    return data.items;
  },

  async obtener(id: string, categoria?: CategoriaDocumento) {
    const { data } = await api.get<DocumentoVencimiento>(
      `/documentos-vencimiento/${id}`,
      { params: categoria ? { categoria } : undefined },
    );
    return data;
  },

  async crear(params: {
    empresa_id: string;
    categoria: CategoriaDocumento;
    titulo: string;
    tipo?: string | null;
    fecha_vencimiento: string;
    notas?: string | null;
    files?: File[];
  }) {
    const form = new FormData();
    form.append("empresa_id", params.empresa_id);
    form.append("categoria", params.categoria);
    form.append("titulo", params.titulo);
    if (params.tipo) form.append("tipo", params.tipo);
    form.append("fecha_vencimiento", params.fecha_vencimiento);
    if (params.notas) form.append("notas", params.notas);
    for (const file of params.files || []) {
      form.append("adjuntos", file);
    }
    const { data } = await api.post<DocumentoVencimiento>(
      "/documentos-vencimiento",
      form,
      { headers: { "Content-Type": "multipart/form-data" }, timeout: 120_000 },
    );
    return data;
  },

  async actualizar(
    id: string,
    patch: {
      titulo?: string;
      tipo?: string | null;
      fecha_vencimiento?: string;
      notas?: string | null;
    },
  ) {
    const { data } = await api.patch<DocumentoVencimiento>(
      `/documentos-vencimiento/${id}`,
      patch,
    );
    return data;
  },

  async eliminar(id: string) {
    await api.delete(`/documentos-vencimiento/${id}`);
  },

  async subirAdjuntos(id: string, files: File[]) {
    const form = new FormData();
    for (const file of files) form.append("adjuntos", file);
    const { data } = await api.post<{ adjuntos: unknown[] }>(
      `/documentos-vencimiento/${id}/adjuntos`,
      form,
      { headers: { "Content-Type": "multipart/form-data" }, timeout: 120_000 },
    );
    return data;
  },

  async eliminarAdjunto(documentoId: string, adjuntoId: string) {
    await api.delete(
      `/documentos-vencimiento/${documentoId}/adjuntos/${adjuntoId}`,
    );
  },
};
