import { supabaseAdmin } from "../config/supabase";
import { archivoService, TipoDocumentoArchivo } from "./archivo.service";
import { HttpError } from "../utils/httpError";

export type PermisosEnte = {
  informes: boolean;
  capacitaciones: boolean;
  epp: boolean;
  metricas: boolean;
};

const DEFAULT_PERMISOS: PermisosEnte = {
  informes: true,
  capacitaciones: true,
  epp: true,
  metricas: true,
};

function parsePermisos(raw: unknown): PermisosEnte {
  if (!raw || typeof raw !== "object") return DEFAULT_PERMISOS;
  const value = raw as Record<string, unknown>;
  return {
    informes: value.informes !== false,
    capacitaciones: value.capacitaciones !== false,
    epp: value.epp !== false,
    metricas: value.metricas !== false,
  };
}

export const enteService = {
  async listarEmpresasAsignadas(enteId: string) {
    const { data, error } = await supabaseAdmin
      .from("ente_regulador_empresas")
      .select("empresa_id, permisos, empresas(id, razon_social, cuit, logo_url, actividad, localidad, domicilio, estado)")
      .eq("ente_id", enteId);
    if (error) throw error;

    return (data ?? []).map((row) => ({
      empresa_id: row.empresa_id,
      permisos: parsePermisos(row.permisos),
      empresa: Array.isArray(row.empresas) ? row.empresas[0] ?? null : row.empresas,
    }));
  },

  async guardarAsignaciones(
    enteId: string,
    asignaciones: Array<{ empresa_id: string; permisos?: Partial<PermisosEnte> }>,
  ) {
    const { data: perfil, error: perfilError } = await supabaseAdmin
      .from("perfiles")
      .select("id, rol")
      .eq("id", enteId)
      .single();
    if (perfilError || !perfil || perfil.rol !== "ente_regulador") {
      throw new HttpError(404, "Ente regulador no encontrado");
    }

    const { error: delError } = await supabaseAdmin
      .from("ente_regulador_empresas")
      .delete()
      .eq("ente_id", enteId);
    if (delError) throw delError;

    if (asignaciones.length === 0) {
      return { asignaciones: [] };
    }

    const rows = asignaciones.map((a) => ({
      ente_id: enteId,
      empresa_id: a.empresa_id,
      permisos: { ...DEFAULT_PERMISOS, ...a.permisos },
    }));

    const { error: insertError } = await supabaseAdmin
      .from("ente_regulador_empresas")
      .insert(rows);
    if (insertError) throw insertError;

    return this.listarEmpresasAsignadas(enteId);
  },

  async obtenerDashboard(enteId: string) {
    const asignadas = await this.listarEmpresasAsignadas(enteId);
    const conMetricas = asignadas.filter((a) => a.permisos.metricas);
    const empresaIdsMetricas = conMetricas.map((a) => a.empresa_id);

    const informeEmpresaIds = asignadas
      .filter((a) => a.permisos.informes)
      .map((a) => a.empresa_id);
    const capEmpresaIds = asignadas
      .filter((a) => a.permisos.capacitaciones)
      .map((a) => a.empresa_id);
    const eppEmpresaIds = asignadas
      .filter((a) => a.permisos.epp)
      .map((a) => a.empresa_id);

    if (asignadas.length === 0) {
      return {
        empresas: [],
        totalEmpresas: 0,
        totalInformes: 0,
        totalCapacitaciones: 0,
        totalEntregasEpp: 0,
        observacionesAbiertas: 0,
      };
    }

    const [infRows, capRows, eppRows, accRows] = await Promise.all([
      informeEmpresaIds.length > 0
        ? supabaseAdmin
            .from("informes_visita")
            .select("empresa_id")
            .in("empresa_id", informeEmpresaIds)
            .eq("visible_ente_regulador", true)
        : Promise.resolve({ data: [] }),
      capEmpresaIds.length > 0
        ? supabaseAdmin
            .from("capacitaciones")
            .select("empresa_id")
            .in("empresa_id", capEmpresaIds)
            .eq("visible_ente_regulador", true)
        : Promise.resolve({ data: [] }),
      eppEmpresaIds.length > 0
        ? supabaseAdmin
            .from("epp_entregas")
            .select("empresa_id")
            .in("empresa_id", eppEmpresaIds)
            .eq("visible_ente_regulador", true)
        : Promise.resolve({ data: [] }),
      empresaIdsMetricas.length > 0
        ? supabaseAdmin
            .from("acciones_mejora")
            .select("empresa_id")
            .in("empresa_id", empresaIdsMetricas)
            .eq("visible_ente_regulador", true)
            .eq("estado", "pendiente")
        : Promise.resolve({ data: [] }),
    ]);

    const infData = (infRows as any).data ?? [];
    const capData = (capRows as any).data ?? [];
    const eppData = (eppRows as any).data ?? [];
    const accData = (accRows as any).data ?? [];

    const empresasConConteos = asignadas.map((a) => ({
      ...a,
      conteos: {
        informes: infData.filter((i: any) => i.empresa_id === a.empresa_id).length,
        capacitaciones: capData.filter((c: any) => c.empresa_id === a.empresa_id).length,
        epp: eppData.filter((e: any) => e.empresa_id === a.empresa_id).length,
        observaciones: accData.filter((o: any) => o.empresa_id === a.empresa_id).length,
      },
    }));

    return {
      empresas: empresasConConteos,
      totalEmpresas: asignadas.length,
      totalInformes: infData.length,
      totalCapacitaciones: capData.length,
      totalEntregasEpp: eppData.length,
      observacionesAbiertas: accData.length,
    };
  },

  async obtenerArchivo(enteId: string) {
    const asignadas = await this.listarEmpresasAsignadas(enteId);
    const tipos = new Set<TipoDocumentoArchivo>();
    const empresaIdsByTipo: Record<TipoDocumentoArchivo, string[]> = {
      informe: [],
      capacitacion: [],
      epp: [],
      accion: [],
    };

    for (const row of asignadas) {
      if (row.permisos.informes) empresaIdsByTipo.informe.push(row.empresa_id);
      if (row.permisos.capacitaciones) {
        empresaIdsByTipo.capacitacion.push(row.empresa_id);
      }
      if (row.permisos.epp) empresaIdsByTipo.epp.push(row.empresa_id);
      if (row.permisos.metricas) empresaIdsByTipo.accion.push(row.empresa_id);
    }

    const incluir: TipoDocumentoArchivo[] = [];
    if (empresaIdsByTipo.informe.length) incluir.push("informe");
    if (empresaIdsByTipo.capacitacion.length) incluir.push("capacitacion");
    if (empresaIdsByTipo.epp.length) incluir.push("epp");
    if (empresaIdsByTipo.accion.length) incluir.push("accion");

    const empresaIds = Array.from(
      new Set([
        ...empresaIdsByTipo.informe,
        ...empresaIdsByTipo.capacitacion,
        ...empresaIdsByTipo.epp,
        ...empresaIdsByTipo.accion,
      ]),
    );

    const { documentos } = await archivoService.listar({
      empresaIds,
      incluir,
      soloVisibleEnte: true,
    });
    return {
      documentos: documentos.filter((doc) =>
        empresaIdsByTipo[doc.tipo].includes(doc.empresa_id),
      ),
      empresas: asignadas,
    };
  },
};
