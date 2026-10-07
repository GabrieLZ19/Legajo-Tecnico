import { supabaseAdmin } from "../config/supabase";
import {
  safeExtensionFromDocsUpload,
} from "../config/multer";
import { storageService } from "./storage.service";
import { notificacionService } from "./notificacion.service";
import { env } from "../config/env";
import {
  addDaysYmd,
  diffDaysYmd,
  todayYmdAR,
} from "../utils/datetime";

const BUCKET = "documentos_vencimiento";

export type CategoriaDocumento = "medicion" | "art";

export type DocumentoAdjunto = {
  id: string;
  documento_id: string;
  nombre_original: string;
  storage_path: string;
  mime_type: string | null;
  url: string | null;
  url_firmada?: string | null;
  created_at: string;
};

async function signAdjuntos(
  adjuntos: DocumentoAdjunto[],
): Promise<DocumentoAdjunto[]> {
  return Promise.all(
    adjuntos.map(async (a) => {
      const ref = a.url || `${BUCKET}/${a.storage_path}`;
      const urlFirmada = await storageService.signUrl(ref);
      return { ...a, url_firmada: urlFirmada };
    }),
  );
}

export const documentosVencimientoService = {
  async listar(params: {
    empresaId: string;
    categoria: CategoriaDocumento;
    tipo?: string;
    q?: string;
    limit?: number;
    offset?: number;
    soloVisibleEnte?: boolean;
  }) {
    const limit = Math.min(Math.max(params.limit ?? 50, 1), 200);
    const offset = Math.max(params.offset ?? 0, 0);

    let query = supabaseAdmin
      .from("documentos_vencimiento")
      .select(
        `
        *,
        adjuntos:documento_vencimiento_adjuntos(id, nombre_original, mime_type, created_at)
      `,
        { count: "exact" },
      )
      .eq("empresa_id", params.empresaId)
      .eq("categoria", params.categoria);

    if (params.soloVisibleEnte) {
      query = query.eq("visible_ente_regulador", true);
    }

    if (params.tipo) {
      query = query.eq("tipo", params.tipo);
    }
    if (params.q?.trim()) {
      const q = params.q
        .trim()
        .replace(/[%_,.()]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
      if (q) {
        query = query.or(
          `titulo.ilike.%${q}%,tipo.ilike.%${q}%,notas.ilike.%${q}%`,
        );
      }
    }

    const { data, error, count } = await query
      .order("fecha_vencimiento", { ascending: true })
      .range(offset, offset + limit - 1);

    if (error) throw error;

    return {
      documentos: data || [],
      total: count ?? 0,
      limit,
      offset,
    };
  },

  async listarTipos(empresaId: string, categoria: CategoriaDocumento) {
    const { data, error } = await supabaseAdmin
      .from("documentos_vencimiento")
      .select("tipo")
      .eq("empresa_id", empresaId)
      .eq("categoria", categoria)
      .not("tipo", "is", null);

    if (error) throw error;
    const set = new Set<string>();
    for (const row of data || []) {
      if (row.tipo?.trim()) set.add(row.tipo.trim());
    }
    return Array.from(set).sort((a, b) =>
      a.localeCompare(b, "es", { sensitivity: "base" }),
    );
  },

  async obtenerPorId(id: string) {
    const { data, error } = await supabaseAdmin
      .from("documentos_vencimiento")
      .select(
        `
        *,
        adjuntos:documento_vencimiento_adjuntos(*)
      `,
      )
      .eq("id", id)
      .single();

    if (error) {
      if (error.code === "PGRST116") return null;
      throw error;
    }

    const adjuntos = await signAdjuntos(
      (data.adjuntos || []) as DocumentoAdjunto[],
    );

    return { ...data, adjuntos };
  },

  async crear(params: {
    empresa_id: string;
    categoria: CategoriaDocumento;
    titulo: string;
    tipo?: string | null;
    fecha_vencimiento?: string | null;
    sin_vencimiento?: boolean;
    notas?: string | null;
    creado_por: string;
    files?: Express.Multer.File[];
  }) {
    const sinVencimiento = Boolean(params.sin_vencimiento);
    const { data: doc, error } = await supabaseAdmin
      .from("documentos_vencimiento")
      .insert({
        empresa_id: params.empresa_id,
        categoria: params.categoria,
        titulo: params.titulo,
        tipo: params.tipo?.trim() || null,
        sin_vencimiento: sinVencimiento,
        fecha_vencimiento: sinVencimiento ? null : params.fecha_vencimiento,
        notas: params.notas ?? null,
        creado_por: params.creado_por,
      })
      .select()
      .single();

    if (error) throw error;

    if (params.files?.length) {
      await this.subirAdjuntos(doc.id, params.files);
    }

    return this.obtenerPorId(doc.id);
  },

  async actualizar(
    id: string,
    patch: {
      titulo?: string;
      tipo?: string | null;
      fecha_vencimiento?: string | null;
      sin_vencimiento?: boolean;
      notas?: string | null;
    },
  ) {
    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if (patch.titulo !== undefined) updateData.titulo = patch.titulo;
    if (patch.tipo !== undefined) updateData.tipo = patch.tipo;
    if (patch.notas !== undefined) updateData.notas = patch.notas;

    if (patch.sin_vencimiento === true) {
      updateData.sin_vencimiento = true;
      updateData.fecha_vencimiento = null;
    } else if (patch.sin_vencimiento === false) {
      updateData.sin_vencimiento = false;
      if (patch.fecha_vencimiento !== undefined) {
        updateData.fecha_vencimiento = patch.fecha_vencimiento;
      }
    } else if (patch.fecha_vencimiento !== undefined) {
      updateData.fecha_vencimiento = patch.fecha_vencimiento;
      if (patch.fecha_vencimiento === null) {
        updateData.sin_vencimiento = true;
      } else {
        updateData.sin_vencimiento = false;
      }
    }

    const { error } = await supabaseAdmin
      .from("documentos_vencimiento")
      .update(updateData)
      .eq("id", id);

    if (error) throw error;
    return this.obtenerPorId(id);
  },

  async eliminar(id: string) {
    const doc = await this.obtenerPorId(id);
    if (!doc) return false;

    for (const adj of (doc.adjuntos || []) as DocumentoAdjunto[]) {
      try {
        await storageService.eliminarArchivo(BUCKET, adj.storage_path);
      } catch {
        /* ignore storage cleanup errors */
      }
    }

    const { error } = await supabaseAdmin
      .from("documentos_vencimiento")
      .delete()
      .eq("id", id);

    if (error) throw error;
    return true;
  },

  async subirAdjuntos(documentoId: string, files: Express.Multer.File[]) {
    const rows = [];
    for (const file of files) {
      const ext = safeExtensionFromDocsUpload(file);
      const path = `${documentoId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      await storageService.subirArchivo(BUCKET, path, file);
      const url = storageService.obtenerUrlPublica(BUCKET, path);
      rows.push({
        documento_id: documentoId,
        nombre_original: file.originalname || `archivo.${ext}`,
        storage_path: path,
        mime_type: file.mimetype,
        url,
      });
    }

    const { data, error } = await supabaseAdmin
      .from("documento_vencimiento_adjuntos")
      .insert(rows)
      .select();

    if (error) throw error;
    return data || [];
  },

  async eliminarAdjunto(adjuntoId: string) {
    const { data, error } = await supabaseAdmin
      .from("documento_vencimiento_adjuntos")
      .select("*")
      .eq("id", adjuntoId)
      .single();

    if (error) {
      if (error.code === "PGRST116") return false;
      throw error;
    }

    try {
      await storageService.eliminarArchivo(BUCKET, data.storage_path);
    } catch {
      /* ignore */
    }

    const { error: delError } = await supabaseAdmin
      .from("documento_vencimiento_adjuntos")
      .delete()
      .eq("id", adjuntoId);

    if (delError) throw delError;
    return true;
  },

  /**
   * Próximos a vencer para el dashboard (ventana 60 días + vencidos recientes).
   */
  async listarProximos(params: {
    empresaId: string;
    dias?: number;
    limit?: number;
  }) {
    const dias = Math.min(Math.max(params.dias ?? 60, 1), 180);
    const limit = Math.min(Math.max(params.limit ?? 6, 1), 20);
    const hoyYmd = todayYmdAR();
    const desde = addDaysYmd(hoyYmd, -7); // vencidos recientes
    const hasta = addDaysYmd(hoyYmd, dias);

    const { data, error } = await supabaseAdmin
      .from("documentos_vencimiento")
      .select("id, empresa_id, categoria, titulo, fecha_vencimiento")
      .eq("empresa_id", params.empresaId)
      .eq("sin_vencimiento", false)
      .not("fecha_vencimiento", "is", null)
      .gte("fecha_vencimiento", desde)
      .lte("fecha_vencimiento", hasta)
      .order("fecha_vencimiento", { ascending: true })
      .limit(limit);

    if (error) throw error;

    return (data || []).map((row) => {
      const diasRestantes = diffDaysYmd(hoyYmd, row.fecha_vencimiento);
      return {
        ...row,
        dias_restantes: diasRestantes,
        urgencia:
          diasRestantes <= 30
            ? ("alta" as const)
            : ("media" as const),
        href:
          row.categoria === "art"
            ? `/art/${row.id}`
            : `/mediciones/${row.id}`,
      };
    });
  },

  /**
   * Job diario: notifica in-app (y email si hay Resend) documentos a ≤30 días
   * que no fueron avisados en las últimas 24h.
   */
  async procesarAvisosVencimiento() {
    const hoyYmd = todayYmdAR();
    const hasta = addDaysYmd(hoyYmd, 30);
    const hace24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const { data: docs, error } = await supabaseAdmin
      .from("documentos_vencimiento")
      .select(
        `
        id, titulo, categoria, fecha_vencimiento, empresa_id, ultimo_aviso_at,
        empresas!inner(id, razon_social, consultora_id)
      `,
      )
      .eq("sin_vencimiento", false)
      .not("fecha_vencimiento", "is", null)
      .gte("fecha_vencimiento", hoyYmd)
      .lte("fecha_vencimiento", hasta);

    if (error) throw error;

    const pendientes = (docs || []).filter((doc) => {
      if (!doc.ultimo_aviso_at) return true;
      return new Date(doc.ultimo_aviso_at).getTime() < new Date(hace24h).getTime();
    });

    let avisados = 0;
    for (const doc of pendientes) {
      const empresa = doc.empresas as unknown as {
        id: string;
        razon_social: string;
        consultora_id: string;
      };
      if (!empresa?.consultora_id) continue;

      const etiqueta = doc.categoria === "art" ? "ART" : "Medición";
      const titulo = `Vencimiento próximo: ${doc.titulo}`;
      const mensaje = `${etiqueta} de ${empresa.razon_social} vence el ${doc.fecha_vencimiento}. Revisá el documento y renovalo a tiempo.`;

      // In-app es el canal principal; email es best-effort.
      await notificacionService.enviarAEquipoEmpresa({
        consultora_id: empresa.consultora_id,
        empresa_id: empresa.id,
        titulo,
        mensaje,
        tipo: "warning",
      });

      await supabaseAdmin
        .from("documentos_vencimiento")
        .update({ ultimo_aviso_at: new Date().toISOString() })
        .eq("id", doc.id);

      await this.enviarEmailVencimiento({
        consultoraId: empresa.consultora_id,
        empresaId: empresa.id,
        subject: titulo,
        body: mensaje,
      });

      avisados += 1;
    }

    return { avisados, revisados: pendientes.length };
  },

  async enviarEmailVencimiento(params: {
    consultoraId: string;
    empresaId: string;
    subject: string;
    body: string;
  }) {
    if (!env.RESEND_API_KEY || !env.EMAIL_FROM) return;

    const [{ data: admins }, { data: links }, { data: duenos }] =
      await Promise.all([
        supabaseAdmin
          .from("perfiles")
          .select("id")
          .eq("consultora_id", params.consultoraId)
          .eq("rol", "admin")
          .eq("activo", true),
        supabaseAdmin
          .from("preventor_empresas")
          .select("preventor_id")
          .eq("empresa_id", params.empresaId),
        supabaseAdmin
          .from("perfiles")
          .select("id")
          .eq("empresa_id", params.empresaId)
          .eq("rol", "dueno")
          .eq("activo", true),
      ]);

    const preventorIds = (links || []).map(
      (l: { preventor_id: string }) => l.preventor_id,
    );
    let preventoresActivos: Array<{ id: string }> = [];
    if (preventorIds.length > 0) {
      const { data } = await supabaseAdmin
        .from("perfiles")
        .select("id")
        .in("id", preventorIds)
        .eq("activo", true);
      preventoresActivos = data || [];
    }

    const userIds = Array.from(
      new Set([
        ...(admins || []).map((a: { id: string }) => a.id),
        ...preventoresActivos.map((p) => p.id),
        ...(duenos || []).map((d: { id: string }) => d.id),
      ]),
    );

    if (userIds.length === 0) return;

    const emails: string[] = [];
    for (const userId of userIds) {
      try {
        const { data, error } =
          await supabaseAdmin.auth.admin.getUserById(userId);
        if (!error && data.user?.email) emails.push(data.user.email);
      } catch {
        /* skip */
      }
    }

    const uniqueEmails = Array.from(new Set(emails));
    if (uniqueEmails.length === 0) return;

    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: env.EMAIL_FROM,
          to: uniqueEmails,
          subject: params.subject,
          text: params.body,
        }),
      });
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        console.error(
          `Error Resend vencimiento (${res.status}):`,
          body.slice(0, 300),
        );
      }
    } catch (err) {
      console.error("Error enviando email de vencimiento:", err);
    }
  },
};
