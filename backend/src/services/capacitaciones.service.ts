import { supabaseAdmin } from "../config/supabase";
import QRCode from "qrcode";

export const capacitacionesService = {
  /**
   * Listar capacitaciones de la empresa
   */
  async listar(empresaId: string) {
    const { data, error } = await supabaseAdmin
      .from("capacitaciones")
      .select(
        `
        *,
        capacitacion_preguntas(id),
        capacitacion_asistencias(id)
      `,
      )
      .eq("empresa_id", empresaId)
      .order("created_at", { ascending: false });

    if (error) throw error;

    return (data || []).map((cap: any) => ({
      ...cap,
      total_preguntas: cap.capacitacion_preguntas?.length || 0,
      total_asistencias: cap.capacitacion_asistencias?.length || 0,
      capacitacion_preguntas: undefined,
      capacitacion_asistencias: undefined,
    }));
  },

  /**
   * Crear nueva capacitación o clonar desde biblioteca
   */
  async crear(params: {
    empresa_id: string;
    preventor_id: string;
    titulo: string;
    temario?: string;
    fecha?: string;
    preguntas?: any[];
    copiar_de_id?: string; // Si se clona desde la biblioteca
  }) {
    let preguntasAInsertar = params.preguntas || [];

    // Si viene desde una capacitación existente en la biblioteca, traemos sus preguntas
    if (params.copiar_de_id) {
      const { data: capOrigen } = await supabaseAdmin
        .from("capacitaciones")
        .select(
          `
          titulo, temario,
          capacitacion_preguntas(enunciado, opciones, respuesta_correcta, orden)
        `,
        )
        .eq("id", params.copiar_de_id)
        .single();

      if (capOrigen) {
        if (!params.titulo) params.titulo = capOrigen.titulo;
        if (!params.temario) params.temario = capOrigen.temario;
        if (
          capOrigen.capacitacion_preguntas &&
          preguntasAInsertar.length === 0
        ) {
          preguntasAInsertar = capOrigen.capacitacion_preguntas.map(
            (p: any) => ({
              pregunta: p.enunciado,
              opciones: p.opciones,
              respuesta_correcta: p.respuesta_correcta,
            }),
          );
        }
      }
    }

    // Insertar en la tabla 'capacitaciones' sin columnas inexistentes
    const { data: cap, error: capError } = await supabaseAdmin
      .from("capacitaciones")
      .insert({
        empresa_id: params.empresa_id,
        preventor_id: params.preventor_id,
        titulo: params.titulo,
        temario: params.temario || null,
        fecha: params.fecha || new Date().toISOString(),
        estado: "borrador",
      })
      .select()
      .single();

    if (capError) throw capError;

    if (preguntasAInsertar.length > 0) {
      const preguntasData = preguntasAInsertar.map((p: any, idx: number) => ({
        capacitacion_id: cap.id,
        enunciado: p.pregunta || p.enunciado,
        opciones: p.opciones,
        respuesta_correcta: p.respuesta_correcta,
        orden: idx + 1,
      }));

      const { error: pregError } = await supabaseAdmin
        .from("capacitacion_preguntas")
        .insert(preguntasData);

      if (pregError) throw pregError;
    }

    return cap;
  },

  /**
   * Obtener detalle completo de una capacitación
   */
  async obtenerPorId(id: string) {
    const { data, error } = await supabaseAdmin
      .from("capacitaciones")
      .select(
        `
        *,
        capacitacion_preguntas(id, enunciado, opciones, respuesta_correcta, orden),
        capacitacion_asistencias(id, nombre_empleado, documento, sector, puntaje, firma_url, firmado_at)
      `,
      )
      .eq("id", id)
      .single();

    if (error || !data) return null;

    if (data.capacitacion_preguntas) {
      data.capacitacion_preguntas = data.capacitacion_preguntas.map(
        (p: any) => ({
          ...p,
          pregunta: p.enunciado,
        }),
      );
    }

    if (data.capacitacion_asistencias) {
      data.capacitacion_asistencias = data.capacitacion_asistencias.map(
        (a: any) => ({
          ...a,
          dni_empleado: a.documento,
          created_at: a.firmado_at,
          aprobado: a.puntaje >= 60,
        }),
      );
    }

    return data;
  },

  /**
   * Obtener detalle público para evaluación
   */
  async obtenerDetallePublico(id: string) {
    const { data, error } = await supabaseAdmin
      .from("capacitaciones")
      .select(
        `
        id, titulo, temario, estado, fecha,
        capacitacion_preguntas(id, enunciado, opciones, orden)
      `,
      )
      .eq("id", id)
      .single();

    if (error || !data)
      return { error: "Capacitación no encontrada", code: 404 };
    if (data.estado !== "activa")
      return { error: "La capacitación no está activa", code: 400 };

    if (data.capacitacion_preguntas) {
      data.capacitacion_preguntas = data.capacitacion_preguntas.map(
        (p: any) => ({
          ...p,
          pregunta: p.enunciado,
        }),
      );
    }

    return { data };
  },

  /**
   * Cambiar estado
   */
  async cambiarEstado(id: string, estado: string) {
    const { data, error } = await supabaseAdmin
      .from("capacitaciones")
      .update({ estado })
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * Generar QR
   */
  async generarQR(id: string) {
    const { data: cap, error } = await supabaseAdmin
      .from("capacitaciones")
      .select("id, titulo, estado")
      .eq("id", id)
      .single();

    if (error || !cap) return null;

    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
    const evaluacionUrl = `${frontendUrl}/evaluacion/${id}`;

    const qrBase64 = await QRCode.toDataURL(evaluacionUrl, {
      width: 400,
      margin: 2,
      color: { dark: "#1e3a8a", light: "#ffffff" },
    });

    return { qr: qrBase64, url: evaluacionUrl, capacitacion: cap };
  },

  /**
   * Evaluar empleado y registrar asistencia con devolución de revisión
   */
  async evaluarEmpleado(id: string, body: any) {
    const { nombre_empleado, dni_empleado, sector, respuestas, firma } = body;

    const { data: cap, error: capError } = await supabaseAdmin
      .from("capacitaciones")
      .select(
        `
        id, titulo, estado,
        capacitacion_preguntas(id, enunciado, opciones, respuesta_correcta, orden)
      `,
      )
      .eq("id", id)
      .single();

    if (capError || !cap) throw new Error("Capacitación no encontrada");
    if (cap.estado !== "activa")
      throw new Error("La capacitación no está activa");

    const preguntas = (cap as any).capacitacion_preguntas || [];
    let correctas = 0;
    const totalPreguntas = preguntas.length;

    // Arreglo para la revisión del alumno tipo Google Forms
    const revision: Array<{
      pregunta_id: string;
      enunciado: string;
      opciones: string[];
      seleccion: number | number[];
      respuesta_correcta: number | number[];
      es_correcta: boolean;
    }> = [];

    if (totalPreguntas > 0 && respuestas && Array.isArray(respuestas)) {
      for (const pregunta of preguntas) {
        const respuesta = respuestas.find(
          (r: any) => r.pregunta_id === pregunta.id,
        );
        const correctStr = pregunta.respuesta_correcta;
        const userSelection = respuesta ? respuesta.seleccion : null;

        let esCorrecta = false;
        let correctParsed: number | number[] = 0;

        if (correctStr && correctStr.startsWith("[")) {
          try {
            correctParsed = JSON.parse(correctStr) as number[];
            const userIndices = Array.isArray(userSelection)
              ? userSelection
              : [userSelection];

            esCorrecta =
              correctParsed.length === userIndices.length &&
              correctParsed.every((idx) => userIndices.includes(idx));
          } catch (e) {
            correctParsed = Number(correctStr) || 0;
            esCorrecta = String(userSelection) === correctStr;
          }
        } else {
          correctParsed = Number(correctStr) || 0;
          esCorrecta = String(userSelection) === correctStr;
        }

        if (esCorrecta) correctas++;

        revision.push({
          pregunta_id: pregunta.id,
          enunciado: pregunta.enunciado,
          opciones: pregunta.opciones,
          seleccion: userSelection,
          respuesta_correcta: correctParsed,
          es_correcta: esCorrecta,
        });
      }
    }

    const puntaje =
      totalPreguntas > 0 ? Math.round((correctas / totalPreguntas) * 100) : 100;
    const aprobado = puntaje >= 60;

    let firmaUrl: string | null = null;
    if (firma) {
      const base64Data = firma.replace(/^data:image\/\w+;base64,/, "");
      const buffer = Buffer.from(base64Data, "base64");
      const firmaPath = `capacitaciones/${id}/${dni_empleado}_${Date.now()}.png`;

      const { error: storageError } = await supabaseAdmin.storage
        .from("firmas_digitales")
        .upload(firmaPath, buffer, { contentType: "image/png", upsert: true });

      if (!storageError) {
        const { data: urlData } = supabaseAdmin.storage
          .from("firmas_digitales")
          .getPublicUrl(firmaPath);
        firmaUrl = urlData.publicUrl;
      }
    }

    const { data: asistencia, error: asistError } = await supabaseAdmin
      .from("capacitacion_asistencias")
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

    return {
      success: true,
      puntaje,
      aprobado,
      asistencia,
      revision, // Retornamos la revisión detallada
    };
  },

  /**
   * Actualizar capacitación
   */
  async actualizar(id: string, body: any) {
    const { titulo, temario, fecha, preguntas } = body;

    const { data: cap, error: capError } = await supabaseAdmin
      .from("capacitaciones")
      .select("estado")
      .eq("id", id)
      .single();

    if (capError || !cap)
      return { error: "Capacitación no encontrada", code: 404 };
    if (cap.estado !== "borrador")
      return {
        error: "Solo se pueden editar capacitaciones en estado borrador.",
        code: 400,
      };

    const { error: updateError } = await supabaseAdmin
      .from("capacitaciones")
      .update({
        titulo: titulo || undefined,
        temario: temario !== undefined ? temario : null,
        fecha: fecha || undefined,
      })
      .eq("id", id);

    if (updateError) throw updateError;

    if (preguntas && Array.isArray(preguntas)) {
      await supabaseAdmin
        .from("capacitacion_preguntas")
        .delete()
        .eq("capacitacion_id", id);

      if (preguntas.length > 0) {
        const preguntasData = preguntas.map((p: any, idx: number) => ({
          capacitacion_id: id,
          enunciado: p.pregunta,
          opciones: p.opciones,
          respuesta_correcta: p.respuesta_correcta,
          orden: idx + 1,
        }));

        await supabaseAdmin
          .from("capacitacion_preguntas")
          .insert(preguntasData);
      }
    }

    return { success: true };
  },

  /**
   * Eliminar capacitación
   */
  async eliminar(id: string) {
    await supabaseAdmin
      .from("capacitacion_asistencias")
      .delete()
      .eq("capacitacion_id", id);
    await supabaseAdmin
      .from("capacitacion_preguntas")
      .delete()
      .eq("capacitacion_id", id);
    const { error } = await supabaseAdmin
      .from("capacitaciones")
      .delete()
      .eq("id", id);
    if (error) throw error;
    return true;
  },

  /**
   * Generar contenido para exportar asistencias (CSV o PDF)
   */
  async exportarAsistencias(
    id: string,
    format: string,
    search?: string,
    sector?: string,
    estado?: string,
  ) {
    const { data: cap, error: capError } = await supabaseAdmin
      .from("capacitaciones")
      .select(
        `
        *,
        empresas(razon_social, cuit),
        capacitacion_asistencias(id, nombre_empleado, documento, sector, puntaje, firmado_at)
      `,
      )
      .eq("id", id)
      .single();

    if (capError || !cap)
      return { error: "Capacitación no encontrada", code: 404 };

    let asistencias = cap.capacitacion_asistencias || [];

    if (search) {
      const q = search.toLowerCase();
      asistencias = asistencias.filter(
        (a: any) =>
          a.nombre_empleado?.toLowerCase().includes(q) ||
          a.documento?.includes(q),
      );
    }

    if (sector) {
      const sec = sector.toLowerCase();
      asistencias = asistencias.filter(
        (a: any) => a.sector?.toLowerCase() === sec,
      );
    }

    if (estado) {
      if (estado === "aprobado")
        asistencias = asistencias.filter((a: any) => a.puntaje >= 60);
      else if (estado === "desaprobado")
        asistencias = asistencias.filter((a: any) => a.puntaje < 60);
    }

    if (format === "csv") {
      let csvContent = "\uFEFF";
      csvContent +=
        "N°,Nombre y Apellido,DNI,Sector,Puntaje,Estado,Fecha de Registro\n";

      asistencias.forEach((a: any, idx: number) => {
        const nombre = a.nombre_empleado || "N/A";
        const dni = a.documento || "N/A";
        const sec = a.sector || "N/A";
        const puntaje = a.puntaje !== undefined ? `${a.puntaje}%` : "N/A";
        const est = a.puntaje >= 60 ? "APROBADO" : "DESAPROBADO";
        const fecha = a.firmado_at
          ? new Date(a.firmado_at).toLocaleDateString("es-AR")
          : "N/A";

        csvContent += `"${idx + 1}","${nombre}","${dni}","${sec}","${puntaje}","${est}","${fecha}"\n`;
      });

      return { type: "csv", content: csvContent };
    }

    if (format === "pdf") {
      const PDFDocument = require("pdfkit");
      const doc = new PDFDocument({
        size: "A4",
        margin: 40,
        bufferPages: true,
        autoPageBreak: false,
      });

      doc
        .fillColor("#1B365D")
        .fontSize(20)
        .text("Registro de Asistencia y Evaluación", { bold: true });
      doc
        .fillColor("#4B5563")
        .fontSize(9)
        .text(
          `Capacitación: ${cap.titulo} | Fecha: ${cap.fecha ? cap.fecha.split("T")[0].split("-").reverse().join("/") : ""}`,
        );
      doc.text(
        `Empresa: ${cap.empresas?.razon_social || "N/A"} | CUIT: ${cap.empresas?.cuit || "N/A"} | Generado: ${new Date().toLocaleDateString("es-AR")}`,
      );
      doc.moveDown(1.5);

      const total = asistencias.length;
      const aprobados = asistencias.filter((a: any) => a.puntaje >= 60).length;
      const desaprobados = total - aprobados;

      const startY = doc.y;
      const cardWidth = 160;
      const cardHeight = 45;
      const cardGap = 15;

      doc
        .roundedRect(40, startY, cardWidth, cardHeight, 6)
        .fillColor("#D1FAE5")
        .fill();
      doc
        .fillColor("#059669")
        .fontSize(14)
        .text(String(aprobados), 50, startY + 8, { bold: true });
      doc
        .fillColor("#065F46")
        .fontSize(8)
        .text("Aprobados (>=60%)", 50, startY + 24);

      doc
        .roundedRect(40 + cardWidth + cardGap, startY, cardWidth, cardHeight, 6)
        .fillColor("#FEE2E2")
        .fill();
      doc
        .fillColor("#DC2626")
        .fontSize(14)
        .text(String(desaprobados), 40 + cardWidth + cardGap + 10, startY + 8, {
          bold: true,
        });
      doc
        .fillColor("#991B1B")
        .fontSize(8)
        .text(
          "Desaprobados (<60%)",
          40 + cardWidth + cardGap + 10,
          startY + 24,
        );

      doc
        .roundedRect(
          40 + (cardWidth + cardGap) * 2,
          startY,
          cardWidth,
          cardHeight,
          6,
        )
        .fillColor("#F3F4F6")
        .fill();
      doc
        .fillColor("#1F2937")
        .fontSize(14)
        .text(String(total), 40 + (cardWidth + cardGap) * 2 + 10, startY + 8, {
          bold: true,
        });
      doc
        .fillColor("#374151")
        .fontSize(8)
        .text(
          "Total Asistencias",
          40 + (cardWidth + cardGap) * 2 + 10,
          startY + 24,
        );

      doc.moveDown(3.5);

      let currentY = doc.y;
      doc.rect(40, currentY, 515, 20).fillColor("#1E3A8A").fill();
      doc.fillColor("#FFFFFF").fontSize(8);
      doc.text("#", 45, currentY + 6, { bold: true });
      doc.text("NOMBRE Y APELLIDO", 65, currentY + 6, { bold: true });
      doc.text("DNI", 240, currentY + 6, { bold: true });
      doc.text("SECTOR", 320, currentY + 6, { bold: true });
      doc.text("PUNTAJE", 420, currentY + 6, { bold: true });
      doc.text("ESTADO", 480, currentY + 6, { bold: true });

      currentY += 20;

      asistencias.forEach((a: any, idx: number) => {
        if (currentY > 730) {
          doc.addPage();
          currentY = 40;
          doc.rect(40, currentY, 515, 20).fillColor("#1E3A8A").fill();
          doc.fillColor("#FFFFFF").fontSize(8);
          doc.text("#", 45, currentY + 6, { bold: true });
          doc.text("NOMBRE Y APELLIDO", 65, currentY + 6, { bold: true });
          doc.text("DNI", 240, currentY + 6, { bold: true });
          doc.text("SECTOR", 320, currentY + 6, { bold: true });
          doc.text("PUNTAJE", 420, currentY + 6, { bold: true });
          doc.text("ESTADO", 480, currentY + 6, { bold: true });
          currentY += 20;
        }

        if (idx % 2 === 1)
          doc.rect(40, currentY, 515, 22).fillColor("#F9FAFB").fill();

        doc.fillColor("#374151").fontSize(8);
        doc.text(String(idx + 1), 45, currentY + 7);
        doc.text(a.nombre_empleado || "N/A", 65, currentY + 7, {
          width: 170,
          ellipsis: true,
        });
        doc.text(a.documento || "N/A", 240, currentY + 7);
        doc.text(a.sector || "N/A", 320, currentY + 7, {
          width: 90,
          ellipsis: true,
        });
        doc.text(`${a.puntaje}%`, 420, currentY + 7);

        const apr = a.puntaje >= 60;
        doc
          .fillColor(apr ? "#059669" : "#DC2626")
          .text(apr ? "APROBADO" : "REPROBADO", 480, currentY + 7);

        currentY += 22;
      });

      return { type: "pdf", doc };
    }

    return { error: "Formato no soportado", code: 400 };
  },
};
