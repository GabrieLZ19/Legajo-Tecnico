import { Request, Response, NextFunction } from 'express';
import { supabaseAdmin } from '../config/supabase';
import QRCode from 'qrcode';

export const capacitacionesController = {
  /**
   * GET / - Listar capacitaciones de una empresa
   * Query param: empresa_id
   */
  async listar(req: Request, res: Response, next: NextFunction) {
    try {
      const empresaId = req.query.empresa_id as string;
      if (!empresaId) {
        return res.status(400).json({ error: 'empresa_id es requerido' });
      }

      const { data, error } = await supabaseAdmin
        .from('capacitaciones')
        .select(`
          *,
          capacitacion_preguntas(id),
          capacitacion_asistencias(id)
        `)
        .eq('empresa_id', empresaId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Enriquecer con contadores
      const capacitaciones = (data || []).map((cap: any) => ({
        ...cap,
        total_preguntas: cap.capacitacion_preguntas?.length || 0,
        total_asistencias: cap.capacitacion_asistencias?.length || 0,
        capacitacion_preguntas: undefined,
        capacitacion_asistencias: undefined,
      }));

      res.json({ capacitaciones });
    } catch (error) {
      next(error);
    }
  },

  /**
   * POST / - Crear una capacitación con sus preguntas
   */
  async crear(req: Request, res: Response, next: NextFunction) {
    try {
      const { empresa_id, titulo, temario, fecha, preguntas } = req.body;
      const preventorId = req.user!.id;

      if (!empresa_id || !titulo) {
        return res.status(400).json({ error: 'empresa_id y titulo son requeridos' });
      }

      // Insertar capacitación
      const { data: cap, error: capError } = await supabaseAdmin
        .from('capacitaciones')
        .insert({
          empresa_id,
          preventor_id: preventorId,
          titulo,
          temario: temario || null,
          fecha: fecha || new Date().toISOString(),
          estado: 'borrador',
        })
        .select()
        .single();

      if (capError) throw capError;

      // Insertar preguntas si las hay
      if (preguntas && Array.isArray(preguntas) && preguntas.length > 0) {
        const preguntasData = preguntas.map((p: any, idx: number) => ({
          capacitacion_id: cap.id,
          enunciado: p.pregunta,
          opciones: p.opciones, // JSON array de strings
          respuesta_correcta: p.respuesta_correcta,
          orden: idx + 1,
        }));

        const { error: pregError } = await supabaseAdmin
          .from('capacitacion_preguntas')
          .insert(preguntasData);

        if (pregError) throw pregError;
      }

      res.status(201).json(cap);
    } catch (error) {
      next(error);
    }
  },

  /**
   * GET /:id - Detalle de una capacitación con preguntas y asistencias
   */
  async detalle(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;

      const { data, error } = await supabaseAdmin
        .from('capacitaciones')
        .select(`
          *,
          capacitacion_preguntas(id, enunciado, opciones, respuesta_correcta, orden),
          capacitacion_asistencias(id, nombre_empleado, documento, sector, puntaje, firma_url, firmado_at)
        `)
        .eq('id', id)
        .single();

      if (error || !data) {
        return res.status(404).json({ error: 'Capacitación no encontrada' });
      }

      // Mapear enunciado a pregunta para mantener compatibilidad con frontend
      if (data.capacitacion_preguntas) {
        data.capacitacion_preguntas = data.capacitacion_preguntas.map((p: any) => ({
          ...p,
          pregunta: p.enunciado,
        }));
      }

      // Mapear asistencias a los nombres esperados por el frontend
      if (data.capacitacion_asistencias) {
        data.capacitacion_asistencias = data.capacitacion_asistencias.map((a: any) => ({
          ...a,
          dni_empleado: a.documento,
          created_at: a.firmado_at,
          aprobado: a.puntaje >= 60,
        }));
      }

      res.json(data);
    } catch (error) {
      next(error);
    }
  },

  /**
   * PATCH /:id - Actualizar estado de la capacitación (borrador -> activa -> cerrada)
   */
  async actualizarEstado(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { estado } = req.body;

      if (!['borrador', 'activa', 'cerrada'].includes(estado)) {
        return res.status(400).json({ error: 'Estado inválido' });
      }

      const { data, error } = await supabaseAdmin
        .from('capacitaciones')
        .update({ estado })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      res.json(data);
    } catch (error) {
      next(error);
    }
  },

  /**
   * GET /:id/qr - Generar código QR para la evaluación pública
   */
  async generarQR(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;

      // Verificar que existe
      const { data: cap, error } = await supabaseAdmin
        .from('capacitaciones')
        .select('id, titulo, estado')
        .eq('id', id)
        .single();

      if (error || !cap) {
        return res.status(404).json({ error: 'Capacitación no encontrada' });
      }

      // Generar URL pública de evaluación
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
      const evaluacionUrl = `${frontendUrl}/evaluacion/${id}`;

      // Generar QR en base64
      const qrBase64 = await QRCode.toDataURL(evaluacionUrl, {
        width: 400,
        margin: 2,
        color: {
          dark: '#1e3a8a',
          light: '#ffffff',
        },
      });

      res.json({
        qr: qrBase64,
        url: evaluacionUrl,
        capacitacion: cap,
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * POST /:id/evaluar - Endpoint PÚBLICO (sin auth) para que el empleado complete su evaluación
   * Recibe: nombre_empleado, dni_empleado, sector, respuestas (array), firma (base64)
   */
  async evaluar(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { nombre_empleado, dni_empleado, sector, respuestas, firma } = req.body;

      if (!nombre_empleado || !dni_empleado) {
        return res.status(400).json({ error: 'Nombre y DNI del empleado son requeridos' });
      }

      // Obtener capacitación con preguntas
      const { data: cap, error: capError } = await supabaseAdmin
        .from('capacitaciones')
        .select(`
          id, titulo, estado,
          capacitacion_preguntas(id, respuesta_correcta, orden)
        `)
        .eq('id', id)
        .single();

      if (capError || !cap) {
        return res.status(404).json({ error: 'Capacitación no encontrada' });
      }

      if (cap.estado !== 'activa') {
        return res.status(400).json({ error: 'La capacitación no está activa para evaluaciones' });
      }

      // Calcular puntaje
      const preguntas = (cap as any).capacitacion_preguntas || [];
      let correctas = 0;
      const totalPreguntas = preguntas.length;

      if (totalPreguntas > 0 && respuestas && Array.isArray(respuestas)) {
        for (const pregunta of preguntas) {
          const respuesta = respuestas.find((r: any) => r.pregunta_id === pregunta.id);
          if (respuesta) {
            const correctStr = pregunta.respuesta_correcta;
            const userSelection = respuesta.seleccion; // Puede ser un número o un array de números

            if (correctStr && correctStr.startsWith("[")) {
              try {
                const correctIndices = JSON.parse(correctStr) as number[];
                const userIndices = Array.isArray(userSelection) ? userSelection : [userSelection];

                const match = correctIndices.length === userIndices.length &&
                  correctIndices.every(idx => userIndices.includes(idx));

                if (match) correctas++;
              } catch (e) {
                if (String(userSelection) === correctStr) correctas++;
              }
            } else {
              if (String(userSelection) === correctStr) correctas++;
            }
          }
        }
      }

      const puntaje = totalPreguntas > 0 ? Math.round((correctas / totalPreguntas) * 100) : 100;
      const aprobado = puntaje >= 60; // Aprueba con 60% o más

      // Subir firma si la hay (base64 -> buffer)
      let firmaUrl: string | null = null;
      if (firma) {
        const base64Data = firma.replace(/^data:image\/\w+;base64,/, '');
        const buffer = Buffer.from(base64Data, 'base64');
        const firmaPath = `capacitaciones/${id}/${dni_empleado}_${Date.now()}.png`;

        const { error: storageError } = await supabaseAdmin.storage
          .from('firmas_digitales')
          .upload(firmaPath, buffer, {
            contentType: 'image/png',
            upsert: true,
          });

        if (!storageError) {
          const { data: urlData } = supabaseAdmin.storage
            .from('firmas_digitales')
            .getPublicUrl(firmaPath);
          firmaUrl = urlData.publicUrl;
        }
      }

      // Registrar asistencia
      const { data: asistencia, error: asistError } = await supabaseAdmin
        .from('capacitacion_asistencias')
        .insert({
          capacitacion_id: id,
          nombre_empleado,
          documento: dni_empleado,
          sector: sector || null,
          puntaje,
          firma_url: firmaUrl,
        })
        .select()
        .single();

      if (asistError) throw asistError;

      res.status(201).json({
        success: true,
        puntaje,
        aprobado,
        asistencia,
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * DELETE /:id - Eliminar una capacitación
   */
  async eliminar(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;

      // 1. Eliminar asistencias relacionadas
      const { error: asistError } = await supabaseAdmin
        .from('capacitacion_asistencias')
        .delete()
        .eq('capacitacion_id', id);

      if (asistError) throw asistError;

      // 2. Eliminar preguntas relacionadas
      const { error: pregError } = await supabaseAdmin
        .from('capacitacion_preguntas')
        .delete()
        .eq('capacitacion_id', id);

      if (pregError) throw pregError;

      // 3. Eliminar la capacitación
      const { error: capError } = await supabaseAdmin
        .from('capacitaciones')
        .delete()
        .eq('id', id);

      if (capError) throw capError;

      res.json({ success: true, message: 'Capacitación eliminada con éxito' });
    } catch (error) {
      next(error);
    }
  },

  /**
   * PUT /:id - Actualizar detalles y preguntas de una capacitación
   */
  async actualizar(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { titulo, temario, fecha, preguntas } = req.body;

      // 1. Verificar si la capacitación está en borrador
      const { data: cap, error: capError } = await supabaseAdmin
        .from('capacitaciones')
        .select('estado')
        .eq('id', id)
        .single();

      if (capError || !cap) {
        return res.status(404).json({ error: 'Capacitación no encontrada' });
      }

      if (cap.estado !== 'borrador') {
        return res.status(400).json({ error: 'Solo se pueden editar capacitaciones en estado borrador.' });
      }

      // 2. Actualizar capacitación
      const { error: updateError } = await supabaseAdmin
        .from('capacitaciones')
        .update({
          titulo: titulo || undefined,
          temario: temario !== undefined ? temario : null,
          fecha: fecha || undefined,
        })
        .eq('id', id);

      if (updateError) throw updateError;

      // 3. Actualizar preguntas si se enviaron
      if (preguntas && Array.isArray(preguntas)) {
        // Eliminar preguntas viejas
        const { error: deleteError } = await supabaseAdmin
          .from('capacitacion_preguntas')
          .delete()
          .eq('capacitacion_id', id);

        if (deleteError) throw deleteError;

        // Insertar nuevas preguntas si hay
        if (preguntas.length > 0) {
          const preguntasData = preguntas.map((p: any, idx: number) => ({
            capacitacion_id: id,
            enunciado: p.pregunta,
            opciones: p.opciones,
            respuesta_correcta: p.respuesta_correcta,
            orden: idx + 1,
          }));

          const { error: insertError } = await supabaseAdmin
            .from('capacitacion_preguntas')
            .insert(preguntasData);

          if (insertError) throw insertError;
        }
      }

      res.json({ success: true, message: 'Capacitación actualizada correctamente' });
    } catch (error) {
      next(error);
    }
  }
};
