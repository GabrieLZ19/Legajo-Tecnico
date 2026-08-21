import { supabaseAdmin } from "../config/supabase";
import { recalcularCumplimientoEmpresa } from "../utils/compliance";
import { sanitizeRichHtml } from "../utils/sanitizeHtml";
import { storageService } from "./storage.service";
import { HttpError } from "../utils/httpError";
import {
  InformeVisita,
  PeligroDetectado,
  PuntoMejora,
  AccionMejora,
} from "../types/database";

function pathFromEvidenciaUrl(url: string | null | undefined): string | null {
  const parsed = storageService.parseStorageUrl(url);
  if (!parsed || parsed.bucket !== "evidencia_visitas") return null;
  return parsed.path;
}

async function firmarUrlsInforme<T extends Record<string, any>>(informe: T): Promise<T> {
  const puntos = await Promise.all(
    (informe.puntos_mejora || []).map(async (pm: any) => ({
      ...pm,
      evidencia_url: await storageService.signUrl(pm.evidencia_url),
    })),
  );

  const firmas = await Promise.all(
    (informe.firmas_informe || []).map(async (f: any) => ({
      ...f,
      firma_url: await storageService.signUrl(f.firma_url),
    })),
  );

  const evidencias = await storageService.signUrls(informe.evidencias_urls || []);

  return {
    ...informe,
    puntos_mejora: puntos,
    firmas_informe: firmas,
    evidencias_urls: evidencias.filter(Boolean) as string[],
    evidencia_url: await storageService.signUrl(informe.evidencia_url),
    url_pdf_generado: await storageService.signUrl(informe.url_pdf_generado),
  };
}

export const informeService = {
  async crearInforme(
    preventorId: string,
    data: {
      empresa_id: string;
      actividad?: string;
      fecha_hora_visita: string;
      lugar_visita?: string;
      contacto_visita?: string;
      declaracion_legal?: string;
      observaciones?: string;
      peligros?: Array<{ descripcion: string; medida_control?: string }>;
      puntos_mejora?: Array<{
        detalle: string;
        acciones?: Array<{ descripcion: string; responsable?: string }>;
      }>;
    },
  ) {
    // 1. Obtener o generar número de informe
    let numero_informe: number | null = null;
    try {
      // Intentar usar la función almacenada next_numero_informe de la base de datos
      const { data: rpcNum, error: rpcError } = await supabaseAdmin.rpc(
        "next_numero_informe",
        { p_empresa_id: data.empresa_id },
      );

      if (!rpcError && typeof rpcNum === "number") {
        numero_informe = rpcNum;
      } else if (rpcError) {
        console.error(
          "RPC error fetching next_numero_informe, falling back to query:",
          rpcError,
        );
      }
    } catch (e) {
      console.error(
        "Error calling next_numero_informe RPC, falling back to query:",
        e,
      );
    }

    // Fallback robusto si el RPC no está disponible o falla:
    // Buscamos el valor máximo actual de numero_informe para esta empresa y sumamos 1
    if (numero_informe === null) {
      const { data: maxInforme, error: maxError } = await supabaseAdmin
        .from("informes_visita")
        .select("numero_informe")
        .eq("empresa_id", data.empresa_id)
        .order("numero_informe", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (maxError) {
        console.error("Error fetching max numero_informe:", maxError);
      }

      numero_informe = (maxInforme?.numero_informe || 0) + 1;
    }

    // 2. Insertar cabecera
    const { data: informe, error: errInforme } = await supabaseAdmin
      .from("informes_visita")
      .insert({
        empresa_id: data.empresa_id,
        preventor_id: preventorId,
        numero_informe,
        actividad: data.actividad,
        fecha_hora_visita: data.fecha_hora_visita,
        lugar_visita: data.lugar_visita,
        contacto_visita: data.contacto_visita,
        declaracion_legal: data.declaracion_legal
          ? sanitizeRichHtml(data.declaracion_legal)
          : data.declaracion_legal,
        observaciones: data.observaciones,
        estado_firma: "borrador",
      })
      .select()
      .single();

    if (errInforme || !informe) {
      throw new Error(
        `Error al crear cabecera del informe: ${errInforme?.message}`,
      );
    }

    try {
      // 3. Insertar peligros
      if (data.peligros && data.peligros.length > 0) {
        const peligrosToInsert = data.peligros.map((p, i) => ({
          informe_id: informe.id,
          descripcion: p.descripcion,
          medida_control: p.medida_control,
          orden: i,
        }));
        const { error: errPeligros } = await supabaseAdmin
          .from("peligros_detectados")
          .insert(peligrosToInsert);
        if (errPeligros) throw errPeligros;
      }

      // 4. Insertar puntos de mejora y acciones (batch)
      if (data.puntos_mejora && data.puntos_mejora.length > 0) {
        const puntosToInsert = data.puntos_mejora.map((pm, i) => ({
          informe_id: informe.id,
          numero_item: i + 1,
          detalle: pm.detalle,
          orden: i,
        }));

        const { data: puntosInsertados, error: errPuntos } = await supabaseAdmin
          .from("puntos_mejora")
          .insert(puntosToInsert)
          .select("id, orden");

        if (errPuntos || !puntosInsertados) throw errPuntos;

        const porOrden = new Map(
          puntosInsertados.map((p) => [p.orden, p.id] as const),
        );

        const accionesToInsert = data.puntos_mejora.flatMap((pm, i) => {
          const puntoId = porOrden.get(i);
          if (!puntoId || !pm.acciones?.length) return [];
          return pm.acciones.map((acc) => ({
            informe_id: informe.id,
            empresa_id: data.empresa_id,
            punto_mejora_id: puntoId,
            numero_item: i + 1,
            descripcion: acc.descripcion,
            responsable: acc.responsable || null,
            estado: "pendiente" as const,
          }));
        });

        if (accionesToInsert.length > 0) {
          const { error: errAcc } = await supabaseAdmin
            .from("acciones_mejora")
            .insert(accionesToInsert);
          if (errAcc) throw errAcc;
        }
      }

      // 5. Sincronizar observaciones de texto plano con puntos y acciones de mejora
      if (data.observaciones) {
        await syncObservacionesToAcciones(
          informe.id,
          data.empresa_id,
          data.observaciones,
        );
      }

      // Recalcular el porcentaje de cumplimiento
      await recalcularCumplimientoEmpresa(data.empresa_id);

      return await informeService.obtenerPorId(informe.id);
    } catch (error: any) {
      // Compensación manual si algo falla en cascada
      await supabaseAdmin.from("informes_visita").delete().eq("id", informe.id);
      throw new Error(
        `Error al insertar detalles del informe. Rolled back. Detalles: ${error.message}`,
      );
    }
  },

  async eliminar(id: string) {
    const informe = await informeService.obtenerPorId(id);
    if (!informe) {
      throw new HttpError(404, "Informe no encontrado");
    }

    // Limpiar evidencias en Storage (carpeta del informe + URLs conocidas)
    const paths = new Set<string>();
    for (const url of informe.evidencias_urls || []) {
      const p = pathFromEvidenciaUrl(url);
      if (p) paths.add(p);
    }
    for (const pm of informe.puntos_mejora || []) {
      const p = pathFromEvidenciaUrl(pm.evidencia_url);
      if (p) paths.add(p);
    }

    try {
      const { data: listed } = await supabaseAdmin.storage
        .from("evidencia_visitas")
        .list(id, { limit: 100 });
      for (const file of listed || []) {
        if (file.name) paths.add(`${id}/${file.name}`);
      }
    } catch (err) {
      console.error("No se pudo listar evidencias al eliminar informe:", err);
    }

    await Promise.all(
      [...paths].map(async (path) => {
        try {
          await storageService.eliminarArchivo("evidencia_visitas", path);
        } catch (err) {
          console.error(`Error limpiando evidencia ${path}:`, err);
        }
      }),
    );

    const { error } = await supabaseAdmin
      .from("informes_visita")
      .delete()
      .eq("id", id);

    if (error) {
      throw new Error(`Error al eliminar el informe: ${error.message}`);
    }

    await recalcularCumplimientoEmpresa(informe.empresa_id);
    return { success: true };
  },

  async listarPorEmpresa(
    empresaId: string,
    opts?: { limit?: number; offset?: number },
  ) {
    const limit = Math.min(Math.max(opts?.limit ?? 50, 1), 200);
    const offset = Math.max(opts?.offset ?? 0, 0);

    const { data, error, count } = await supabaseAdmin
      .from("informes_visita")
      .select("*", { count: "exact" })
      .eq("empresa_id", empresaId)
      .order("numero_informe", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;

    const items = await Promise.all(
      (data || []).map(async (inf) => ({
        ...inf,
        url_pdf_generado: await storageService.signUrl(inf.url_pdf_generado),
      })),
    );

    return { items, total: count ?? items.length, limit, offset };
  },

  async listarPorEmpresas(
    empresaIds: string[],
    opts?: { limit?: number; offset?: number },
  ) {
    const limit = Math.min(Math.max(opts?.limit ?? 50, 1), 200);
    const offset = Math.max(opts?.offset ?? 0, 0);

    const { data, error, count } = await supabaseAdmin
      .from("informes_visita")
      .select("*, empresas(razon_social)", { count: "exact" })
      .in("empresa_id", empresaIds)
      .order("fecha_hora_visita", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;

    const items = await Promise.all(
      (data || []).map(async (inf) => ({
        ...inf,
        url_pdf_generado: await storageService.signUrl(inf.url_pdf_generado),
      })),
    );

    return { items, total: count ?? items.length, limit, offset };
  },

  async obtenerPorId(id: string) {
    const { data: informe, error: errInf } = await supabaseAdmin
      .from("informes_visita")
      .select(
        `
        *,
        peligros_detectados(*),
        puntos_mejora(*),
        acciones_mejora(*),
        firmas_informe(*),
        empresas(id, razon_social, contacto),
        preventor:perfiles!informes_visita_preventor_id_fkey(id, nombre_completo, rol)
      `,
      )
      .eq("id", id)
      .single();

    if (errInf) throw errInf;

    const firmanteIds = (informe.firmas_informe || [])
      .map((f: { firmante_id: string }) => f.firmante_id)
      .filter(Boolean);

    const firmantesById = new Map<
      string,
      { id: string; nombre_completo: string; rol: string }
    >();

    if (firmanteIds.length > 0) {
      const { data: firmantes } = await supabaseAdmin
        .from("perfiles")
        .select("id, nombre_completo, rol")
        .in("id", firmanteIds);
      for (const p of firmantes || []) {
        firmantesById.set(p.id, p);
      }
    }

    const { data: duenoEmpresa } = await supabaseAdmin
      .from("perfiles")
      .select("id, nombre_completo, rol")
      .eq("empresa_id", informe.empresa_id)
      .eq("rol", "dueno")
      .eq("activo", true)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    const firmasEnriquecidas = (informe.firmas_informe || []).map(
      (f: { firmante_id: string }) => ({
        ...f,
        firmante: firmantesById.get(f.firmante_id) || null,
      }),
    );

    return firmarUrlsInforme({
      ...informe,
      firmas_informe: firmasEnriquecidas,
      dueno_empresa: duenoEmpresa || null,
    });
  },

  async editarBorrador(
    id: string,
    updateData: Partial<InformeVisita> & { puntos_mejora?: any[] },
  ) {
    // Validar estado
    const { data: current } = await supabaseAdmin
      .from("informes_visita")
      .select("estado_firma, empresa_id")
      .eq("id", id)
      .single();

    if (!current || current.estado_firma !== "borrador") {
      throw new Error("Solo se pueden editar informes en estado borrador");
    }

    // Separar puntos_mejora del resto de las columnas para evitar error en el update de la tabla informes_visita
    const { puntos_mejora, ...restData } = updateData;
    if (typeof restData.declaracion_legal === "string") {
      restData.declaracion_legal = sanitizeRichHtml(restData.declaracion_legal);
    }

    const { error } = await supabaseAdmin
      .from("informes_visita")
      .update(restData)
      .eq("id", id);

    if (error) throw error;

    // Sincronizar puntos de mejora estructurados si se enviaron
    if (puntos_mejora) {
      // 1. Obtener puntos de mejora existentes
      const { data: pmExistentes, error: errPm } = await supabaseAdmin
        .from("puntos_mejora")
        .select("id, evidencia_url")
        .eq("informe_id", id);

      if (errPm) throw errPm;

      const payloadIds = puntos_mejora
        .map((pm: any) => pm.id)
        .filter(Boolean) as string[];

      // 2. Borrar puntos de mejora que ya no están en el payload
      const aEliminar =
        pmExistentes?.filter((pm) => !payloadIds.includes(pm.id)) || [];
      if (aEliminar.length > 0) {
        const idsEliminar = aEliminar.map((pm) => pm.id);
        // Borrar acciones correspondientes
        await supabaseAdmin
          .from("acciones_mejora")
          .delete()
          .in("punto_mejora_id", idsEliminar);
        // Borrar puntos
        await supabaseAdmin
          .from("puntos_mejora")
          .delete()
          .in("id", idsEliminar);
      }

      // 3. Procesar el payload (insertar nuevos o actualizar existentes)
      for (let i = 0; i < puntos_mejora.length; i++) {
        const pm = puntos_mejora[i];

        if (pm.id) {
          // Actualizar existente
          const { error: errUpdatePm } = await supabaseAdmin
            .from("puntos_mejora")
            .update({
              numero_item: i + 1,
              detalle: pm.detalle,
              evidencia_url: pm.evidencia_url,
              orden: i,
            })
            .eq("id", pm.id);

          if (errUpdatePm) throw errUpdatePm;

          // Actualizar o insertar sus acciones
          if (pm.acciones && pm.acciones.length > 0) {
            const { data: accExistentes } = await supabaseAdmin
              .from("acciones_mejora")
              .select("id")
              .eq("punto_mejora_id", pm.id);

            const payloadAccIds = pm.acciones
              .map((a: any) => a.id)
              .filter(Boolean) as string[];

            // Borrar acciones no incluidas
            const accEliminar =
              accExistentes?.filter((a) => !payloadAccIds.includes(a.id)) || [];
            if (accEliminar.length > 0) {
              await supabaseAdmin
                .from("acciones_mejora")
                .delete()
                .in(
                  "id",
                  accEliminar.map((a) => a.id),
                );
            }

            // Procesar acciones
            for (const acc of pm.acciones) {
              if (acc.id) {
                await supabaseAdmin
                  .from("acciones_mejora")
                  .update({
                    numero_item: i + 1,
                    descripcion: acc.descripcion,
                    responsable: acc.responsable || null,
                  })
                  .eq("id", acc.id);
              } else {
                await supabaseAdmin.from("acciones_mejora").insert({
                  informe_id: id,
                  empresa_id: current.empresa_id,
                  punto_mejora_id: pm.id,
                  numero_item: i + 1,
                  descripcion: acc.descripcion,
                  responsable: acc.responsable || null,
                  estado: "pendiente",
                });
              }
            }
          } else {
            await supabaseAdmin
              .from("acciones_mejora")
              .delete()
              .eq("punto_mejora_id", pm.id);
          }
        } else {
          // Crear nuevo punto
          const { data: nuevoPunto, error: errNewPm } = await supabaseAdmin
            .from("puntos_mejora")
            .insert({
              informe_id: id,
              numero_item: i + 1,
              detalle: pm.detalle,
              orden: i,
              evidencia_url: pm.evidencia_url,
            })
            .select()
            .single();

          if (errNewPm) throw errNewPm;

          // Crear acciones
          if (pm.acciones && pm.acciones.length > 0) {
            const accionesToInsert = pm.acciones.map((acc: any) => ({
              informe_id: id,
              empresa_id: current.empresa_id,
              punto_mejora_id: nuevoPunto.id,
              numero_item: i + 1,
              descripcion: acc.descripcion,
              responsable: acc.responsable || null,
              estado: "pendiente",
            }));
            await supabaseAdmin
              .from("acciones_mejora")
              .insert(accionesToInsert);
          }
        }
      }
    }

    // Sincronizar observaciones si se enviaron (para compatibilidad hacia atrás si la hay)
    if ("observaciones" in updateData && !puntos_mejora) {
      await syncObservacionesToAcciones(
        id,
        current.empresa_id,
        updateData.observaciones as string | undefined,
      );
    }

    // Recalcular el porcentaje de cumplimiento
    await recalcularCumplimientoEmpresa(current.empresa_id);

    return await informeService.obtenerPorId(id);
  },
};

/**
 * Sincroniza el texto de observaciones del informe con la tabla de puntos_mejora y acciones_mejora.
 * Parsea el texto línea por línea (detectando viñetas) y crea/actualiza los registros individuales.
 */
async function syncObservacionesToAcciones(
  informeId: string,
  empresaId: string,
  observacionesText: string | undefined,
) {
  if (!observacionesText) {
    // Si no hay observaciones, eliminar todos los puntos y acciones previos
    await supabaseAdmin
      .from("acciones_mejora")
      .delete()
      .eq("informe_id", informeId);
    await supabaseAdmin
      .from("puntos_mejora")
      .delete()
      .eq("informe_id", informeId);
    return;
  }

  // 1. Parsear el texto por líneas/viñetas
  const lineas = observacionesText
    .split(/\r?\n/)
    .map((line) => {
      // Limpiar viñetas comunes: -, *, •, ·, números como 1., 2)
      let clean = line.trim();
      clean = clean.replace(/^[\s\-\*•·]+/, ""); // viñetas de símbolos
      clean = clean.replace(/^\d+[\.\)]\s*/, ""); // viñetas numéricas tipo 1. o 1)
      return clean.trim();
    })
    .filter((line) => line.length > 0);

  if (lineas.length === 0) {
    await supabaseAdmin
      .from("acciones_mejora")
      .delete()
      .eq("informe_id", informeId);
    await supabaseAdmin
      .from("puntos_mejora")
      .delete()
      .eq("informe_id", informeId);
    return;
  }

  // 2. Obtener puntos y acciones existentes para este informe
  const { data: existentes } = await supabaseAdmin
    .from("puntos_mejora")
    .select("id, detalle")
    .eq("informe_id", informeId);

  const existentesMap = new Map<string, string>(); // detalle -> id
  existentes?.forEach((p) => existentesMap.set(p.detalle, p.id));

  const nuevasLineasSet = new Set(lineas);

  // Eliminar los puntos de mejora que ya no están en las nuevas observaciones
  const aEliminar =
    existentes?.filter((p) => !nuevasLineasSet.has(p.detalle)) || [];
  if (aEliminar.length > 0) {
    const idsEliminar = aEliminar.map((p) => p.id);
    await supabaseAdmin
      .from("acciones_mejora")
      .delete()
      .in("punto_mejora_id", idsEliminar);
    await supabaseAdmin.from("puntos_mejora").delete().in("id", idsEliminar);
  }

  // Insertar o actualizar los puntos de mejora y acciones
  for (let i = 0; i < lineas.length; i++) {
    const detalle = lineas[i];
    let puntoId = existentesMap.get(detalle);

    if (!puntoId) {
      // Crear punto de mejora
      const { data: nuevoPunto, error: errPunto } = await supabaseAdmin
        .from("puntos_mejora")
        .insert({
          informe_id: informeId,
          numero_item: i + 1,
          detalle,
          orden: i,
        })
        .select()
        .single();

      if (errPunto || !nuevoPunto) continue;
      puntoId = nuevoPunto.id;

      // Crear acción de mejora correspondiente en estado pendiente
      await supabaseAdmin.from("acciones_mejora").insert({
        informe_id: informeId,
        empresa_id: empresaId,
        punto_mejora_id: puntoId,
        numero_item: i + 1,
        descripcion: detalle,
        estado: "pendiente",
      });
    } else {
      // Si ya existe, actualizamos su número de ítem y orden para que coincida con el nuevo orden
      await supabaseAdmin
        .from("puntos_mejora")
        .update({ numero_item: i + 1, orden: i })
        .eq("id", puntoId);

      await supabaseAdmin
        .from("acciones_mejora")
        .update({ numero_item: i + 1 })
        .eq("punto_mejora_id", puntoId);
    }
  }
}
