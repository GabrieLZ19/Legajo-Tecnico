import { supabaseAdmin } from '../config/supabase';
import { InformeVisita, PeligroDetectado, PuntoMejora, AccionMejora } from '../types/database';

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
        acciones?: Array<{ descripcion: string }>;
      }>;
    }
  ) {
    // 1. Obtener o generar número de informe
    let numero_informe: number | null = null;
    try {
      // Intentar usar la función almacenada next_numero_informe de la base de datos
      const { data: rpcNum, error: rpcError } = await supabaseAdmin
        .rpc('next_numero_informe', { p_empresa_id: data.empresa_id });
      
      if (!rpcError && typeof rpcNum === 'number') {
        numero_informe = rpcNum;
      } else if (rpcError) {
        console.error('RPC error fetching next_numero_informe, falling back to query:', rpcError);
      }
    } catch (e) {
      console.error('Error calling next_numero_informe RPC, falling back to query:', e);
    }

    // Fallback robusto si el RPC no está disponible o falla:
    // Buscamos el valor máximo actual de numero_informe para esta empresa y sumamos 1
    if (numero_informe === null) {
      const { data: maxInforme, error: maxError } = await supabaseAdmin
        .from('informes_visita')
        .select('numero_informe')
        .eq('empresa_id', data.empresa_id)
        .order('numero_informe', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (maxError) {
        console.error('Error fetching max numero_informe:', maxError);
      }
      
      numero_informe = (maxInforme?.numero_informe || 0) + 1;
    }

    // 2. Insertar cabecera
    const { data: informe, error: errInforme } = await supabaseAdmin
      .from('informes_visita')
      .insert({
        empresa_id: data.empresa_id,
        preventor_id: preventorId,
        numero_informe,
        actividad: data.actividad,
        fecha_hora_visita: data.fecha_hora_visita,
        lugar_visita: data.lugar_visita,
        contacto_visita: data.contacto_visita,
        declaracion_legal: data.declaracion_legal,
        observaciones: data.observaciones,
        estado_firma: 'borrador',
      })
      .select()
      .single();

    if (errInforme || !informe) {
      throw new Error(`Error al crear cabecera del informe: ${errInforme?.message}`);
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
        const { error: errPeligros } = await supabaseAdmin.from('peligros_detectados').insert(peligrosToInsert);
        if (errPeligros) throw errPeligros;
      }

      // 4. Insertar puntos de mejora y acciones
      if (data.puntos_mejora && data.puntos_mejora.length > 0) {
        for (let i = 0; i < data.puntos_mejora.length; i++) {
          const pm = data.puntos_mejora[i];
          const { data: puntoInsertado, error: errPunto } = await supabaseAdmin
            .from('puntos_mejora')
            .insert({
              informe_id: informe.id,
              numero_item: i + 1,
              detalle: pm.detalle,
              orden: i,
            })
            .select()
            .single();
          
          if (errPunto) throw errPunto;

          if (pm.acciones && pm.acciones.length > 0) {
            const accionesToInsert = pm.acciones.map((acc) => ({
              informe_id: informe.id,
              empresa_id: data.empresa_id,
              punto_mejora_id: puntoInsertado.id,
              numero_item: i + 1,
              descripcion: acc.descripcion,
              estado: 'pendiente',
            }));
            const { error: errAcc } = await supabaseAdmin.from('acciones_mejora').insert(accionesToInsert);
            if (errAcc) throw errAcc;
          }
        }
      }

      // 5. Sincronizar observaciones de texto plano con puntos y acciones de mejora
      if (data.observaciones) {
        await syncObservacionesToAcciones(informe.id, data.empresa_id, data.observaciones);
      }

      return await informeService.obtenerPorId(informe.id);

    } catch (error: any) {
      // Compensación manual si algo falla en cascada
      await supabaseAdmin.from('informes_visita').delete().eq('id', informe.id);
      throw new Error(`Error al insertar detalles del informe. Rolled back. Detalles: ${error.message}`);
    }
  },

  async listarPorEmpresa(empresaId: string) {
    const { data, error } = await supabaseAdmin
      .from('informes_visita')
      .select('*')
      .eq('empresa_id', empresaId)
      .order('fecha_hora_visita', { ascending: false });

    if (error) throw error;
    return data;
  },

  async listarPorEmpresas(empresaIds: string[]) {
    const { data, error } = await supabaseAdmin
      .from('informes_visita')
      .select('*, empresas(razon_social)')
      .in('empresa_id', empresaIds)
      .order('fecha_hora_visita', { ascending: false });

    if (error) throw error;
    return data;
  },

  async obtenerPorId(id: string) {
    const { data: informe, error: errInf } = await supabaseAdmin
      .from('informes_visita')
      .select('*, peligros_detectados(*), puntos_mejora(*), acciones_mejora(*), firmas_informe(*)')
      .eq('id', id)
      .single();

    if (errInf) throw errInf;
    return informe;
  },

  async editarBorrador(id: string, updateData: Partial<InformeVisita> & { puntos_mejora?: any[] }) {
    // Validar estado
    const { data: current } = await supabaseAdmin
      .from('informes_visita')
      .select('estado_firma, empresa_id')
      .eq('id', id)
      .single();

    if (!current || current.estado_firma !== 'borrador') {
      throw new Error('Solo se pueden editar informes en estado borrador');
    }

    // Separar puntos_mejora del resto de las columnas para evitar error en el update de la tabla informes_visita
    const { puntos_mejora, ...restData } = updateData;

    const { error } = await supabaseAdmin
      .from('informes_visita')
      .update(restData)
      .eq('id', id);

    if (error) throw error;

    // Sincronizar puntos de mejora estructurados si se enviaron
    if (puntos_mejora) {
      // 1. Obtener puntos de mejora existentes
      const { data: pmExistentes, error: errPm } = await supabaseAdmin
        .from('puntos_mejora')
        .select('id, evidencia_url')
        .eq('informe_id', id);
        
      if (errPm) throw errPm;
      
      const payloadIds = puntos_mejora.map((pm: any) => pm.id).filter(Boolean) as string[];
      
      // 2. Borrar puntos de mejora que ya no están en el payload
      const aEliminar = pmExistentes?.filter(pm => !payloadIds.includes(pm.id)) || [];
      if (aEliminar.length > 0) {
        const idsEliminar = aEliminar.map(pm => pm.id);
        // Borrar acciones correspondientes
        await supabaseAdmin.from('acciones_mejora').delete().in('punto_mejora_id', idsEliminar);
        // Borrar puntos
        await supabaseAdmin.from('puntos_mejora').delete().in('id', idsEliminar);
      }
      
      // 3. Procesar el payload (insertar nuevos o actualizar existentes)
      for (let i = 0; i < puntos_mejora.length; i++) {
        const pm = puntos_mejora[i];
        
        if (pm.id) {
          // Actualizar existente
          const { error: errUpdatePm } = await supabaseAdmin
            .from('puntos_mejora')
            .update({
              numero_item: i + 1,
              detalle: pm.detalle,
              evidencia_url: pm.evidencia_url,
              orden: i
            })
            .eq('id', pm.id);
            
          if (errUpdatePm) throw errUpdatePm;
          
          // Actualizar o insertar sus acciones
          if (pm.acciones && pm.acciones.length > 0) {
            const { data: accExistentes } = await supabaseAdmin
              .from('acciones_mejora')
              .select('id')
              .eq('punto_mejora_id', pm.id);
              
            const payloadAccIds = pm.acciones.map((a: any) => a.id).filter(Boolean) as string[];
            
            // Borrar acciones no incluidas
            const accEliminar = accExistentes?.filter(a => !payloadAccIds.includes(a.id)) || [];
            if (accEliminar.length > 0) {
              await supabaseAdmin.from('acciones_mejora').delete().in('id', accEliminar.map(a => a.id));
            }
            
            // Procesar acciones
            for (const acc of pm.acciones) {
              if (acc.id) {
                await supabaseAdmin
                  .from('acciones_mejora')
                  .update({
                    numero_item: i + 1,
                    descripcion: acc.descripcion
                  })
                  .eq('id', acc.id);
              } else {
                await supabaseAdmin
                  .from('acciones_mejora')
                  .insert({
                    informe_id: id,
                    empresa_id: current.empresa_id,
                    punto_mejora_id: pm.id,
                    numero_item: i + 1,
                    descripcion: acc.descripcion,
                    estado: 'pendiente'
                  });
              }
            }
          } else {
            await supabaseAdmin.from('acciones_mejora').delete().eq('punto_mejora_id', pm.id);
          }
        } else {
          // Crear nuevo punto
          const { data: nuevoPunto, error: errNewPm } = await supabaseAdmin
            .from('puntos_mejora')
            .insert({
              informe_id: id,
              numero_item: i + 1,
              detalle: pm.detalle,
              orden: i,
              evidencia_url: pm.evidencia_url
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
              estado: 'pendiente'
            }));
            await supabaseAdmin.from('acciones_mejora').insert(accionesToInsert);
          }
        }
      }
    }

    // Sincronizar observaciones si se enviaron (para compatibilidad hacia atrás si la hay)
    if ('observaciones' in updateData && !puntos_mejora) {
      await syncObservacionesToAcciones(id, current.empresa_id, updateData.observaciones as string | undefined);
    }

    return await informeService.obtenerPorId(id);
  }
};

/**
 * Sincroniza el texto de observaciones del informe con la tabla de puntos_mejora y acciones_mejora.
 * Parsea el texto línea por línea (detectando viñetas) y crea/actualiza los registros individuales.
 */
async function syncObservacionesToAcciones(informeId: string, empresaId: string, observacionesText: string | undefined) {
  if (!observacionesText) {
    // Si no hay observaciones, eliminar todos los puntos y acciones previos
    await supabaseAdmin.from('acciones_mejora').delete().eq('informe_id', informeId);
    await supabaseAdmin.from('puntos_mejora').delete().eq('informe_id', informeId);
    return;
  }

  // 1. Parsear el texto por líneas/viñetas
  const lineas = observacionesText
    .split(/\r?\n/)
    .map(line => {
      // Limpiar viñetas comunes: -, *, •, ·, números como 1., 2)
      let clean = line.trim();
      clean = clean.replace(/^[\s\-\*•·]+/, ''); // viñetas de símbolos
      clean = clean.replace(/^\d+[\.\)]\s*/, ''); // viñetas numéricas tipo 1. o 1)
      return clean.trim();
    })
    .filter(line => line.length > 0);

  if (lineas.length === 0) {
    await supabaseAdmin.from('acciones_mejora').delete().eq('informe_id', informeId);
    await supabaseAdmin.from('puntos_mejora').delete().eq('informe_id', informeId);
    return;
  }

  // 2. Obtener puntos y acciones existentes para este informe
  const { data: existentes } = await supabaseAdmin
    .from('puntos_mejora')
    .select('id, detalle')
    .eq('informe_id', informeId);

  const existentesMap = new Map<string, string>(); // detalle -> id
  existentes?.forEach(p => existentesMap.set(p.detalle, p.id));

  const nuevasLineasSet = new Set(lineas);
  
  // Eliminar los puntos de mejora que ya no están en las nuevas observaciones
  const aEliminar = existentes?.filter(p => !nuevasLineasSet.has(p.detalle)) || [];
  if (aEliminar.length > 0) {
    const idsEliminar = aEliminar.map(p => p.id);
    await supabaseAdmin.from('acciones_mejora').delete().in('punto_mejora_id', idsEliminar);
    await supabaseAdmin.from('puntos_mejora').delete().in('id', idsEliminar);
  }

  // Insertar o actualizar los puntos de mejora y acciones
  for (let i = 0; i < lineas.length; i++) {
    const detalle = lineas[i];
    let puntoId = existentesMap.get(detalle);

    if (!puntoId) {
      // Crear punto de mejora
      const { data: nuevoPunto, error: errPunto } = await supabaseAdmin
        .from('puntos_mejora')
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
      await supabaseAdmin.from('acciones_mejora').insert({
        informe_id: informeId,
        empresa_id: empresaId,
        punto_mejora_id: puntoId,
        numero_item: i + 1,
        descripcion: detalle,
        estado: 'pendiente',
      });
    } else {
      // Si ya existe, actualizamos su número de ítem y orden para que coincida con el nuevo orden
      await supabaseAdmin
        .from('puntos_mejora')
        .update({ numero_item: i + 1, orden: i })
        .eq('id', puntoId);

      await supabaseAdmin
        .from('acciones_mejora')
        .update({ numero_item: i + 1 })
        .eq('punto_mejora_id', puntoId);
    }
  }
}
