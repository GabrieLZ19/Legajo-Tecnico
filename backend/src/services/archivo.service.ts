import { supabaseAdmin } from "../config/supabase";

export type TipoDocumentoArchivo = "informe" | "capacitacion" | "epp" | "accion";

export interface DocumentoArchivo {
  id: string;
  tipo: TipoDocumentoArchivo;
  titulo: string;
  fecha: string;
  empresa_id: string;
  empresa_razon_social: string;
  pdf_disponible: boolean;
  extra?: Record<string, string | number | boolean | null>;
}

export const archivoService = {
  async listar(filters: {
    empresaIds: string[];
    incluir: TipoDocumentoArchivo[];
    soloVisibleEnte?: boolean;
  }): Promise<{ documentos: DocumentoArchivo[] }> {
    if (filters.empresaIds.length === 0) {
      return { documentos: [] };
    }

    const documentos: DocumentoArchivo[] = [];
    const incluir = new Set(filters.incluir);
    const soloVisible = filters.soloVisibleEnte === true;

    if (incluir.has("informe")) {
      let query = supabaseAdmin
        .from("informes_visita")
        .select("id, numero_informe, fecha_hora_visita, estado_firma, url_pdf_generado, empresa_id, visible_ente_regulador, empresas(razon_social)")
        .in("empresa_id", filters.empresaIds)
        .order("fecha_hora_visita", { ascending: false });
      if (soloVisible) {
        query = query.eq("visible_ente_regulador", true);
      }
      const { data, error } = await query;
      if (error) throw error;

      for (const row of data ?? []) {
        const empresa = row.empresas as { razon_social?: string } | null;
        documentos.push({
          id: row.id,
          tipo: "informe",
          titulo: `Informe N° ${row.numero_informe}`,
          fecha: row.fecha_hora_visita,
          empresa_id: row.empresa_id,
          empresa_razon_social: empresa?.razon_social ?? "",
          pdf_disponible: Boolean(row.url_pdf_generado),
          extra: { estado_firma: row.estado_firma },
        });
      }
    }

    if (incluir.has("capacitacion")) {
      let query = supabaseAdmin
        .from("capacitaciones")
        .select("id, titulo, fecha, estado, empresa_id, visible_ente_regulador, empresas(razon_social)")
        .in("empresa_id", filters.empresaIds)
        .order("fecha", { ascending: false });
      if (soloVisible) {
        query = query.eq("visible_ente_regulador", true);
      }
      const { data, error } = await query;
      if (error) throw error;

      for (const row of data ?? []) {
        const empresa = row.empresas as { razon_social?: string } | null;
        documentos.push({
          id: row.id,
          tipo: "capacitacion",
          titulo: row.titulo,
          fecha: row.fecha,
          empresa_id: row.empresa_id,
          empresa_razon_social: empresa?.razon_social ?? "",
          pdf_disponible: true,
          extra: { estado: row.estado },
        });
      }
    }

    if (incluir.has("epp")) {
      let query = supabaseAdmin
        .from("epp_entregas")
        .select(
          "id, empleado_nombre, empleado_documento, entregado_at, url_registro_oficial, empresa_id, visible_ente_regulador, empresas(razon_social)",
        )
        .in("empresa_id", filters.empresaIds)
        .order("entregado_at", { ascending: false });
      if (soloVisible) {
        query = query.eq("visible_ente_regulador", true);
      }
      const { data, error } = await query;
      if (error) throw error;

      const seen = new Set<string>();
      for (const row of data ?? []) {
        const key = row.url_registro_oficial || row.id;
        if (seen.has(key)) continue;
        seen.add(key);
        const empresa = row.empresas as { razon_social?: string } | null;
        documentos.push({
          id: row.id,
          tipo: "epp",
          titulo: `EPP · ${row.empleado_nombre} (DNI ${row.empleado_documento})`,
          fecha: row.entregado_at,
          empresa_id: row.empresa_id,
          empresa_razon_social: empresa?.razon_social ?? "",
          pdf_disponible: Boolean(row.url_registro_oficial),
        });
      }
    }

    if (incluir.has("accion")) {
      let query = supabaseAdmin
        .from("acciones_mejora")
        .select(
          "id, descripcion, responsable, estado, sector, es_manual, created_at, empresa_id, visible_ente_regulador, informes_visita(lugar_visita, fecha_hora_visita), empresas(razon_social)",
        )
        .in("empresa_id", filters.empresaIds)
        .order("created_at", { ascending: false });
      if (soloVisible) {
        query = query.eq("visible_ente_regulador", true);
      }
      const { data, error } = await query;
      if (error) throw error;

      for (const row of data ?? []) {
        const empresa = row.empresas as { razon_social?: string } | null;
        const informe = row.informes_visita as {
          lugar_visita?: string;
          fecha_hora_visita?: string;
        } | null;
        documentos.push({
          id: row.id,
          tipo: "accion",
          titulo: row.descripcion,
          fecha: informe?.fecha_hora_visita || row.created_at,
          empresa_id: row.empresa_id,
          empresa_razon_social: empresa?.razon_social ?? "",
          pdf_disponible: false,
          extra: {
            estado: row.estado,
            responsable: row.responsable,
            sector: row.sector || informe?.lugar_visita || "Planta",
            es_manual: row.es_manual,
          },
        });
      }
    }

    documentos.sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());
    return { documentos };
  },
};
