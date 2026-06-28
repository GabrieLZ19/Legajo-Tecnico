import { Request, Response, NextFunction } from "express";
import { planAccionService } from "../services/planAccion.service";
import { EstadoAccion } from "../types/database";
import { supabaseAdmin } from "../config/supabase";

export const planAccionController = {
  async listar(req: Request, res: Response, next: NextFunction) {
    try {
      const { empresaId, estado } = req.query;
      if (!empresaId) {
        return res.status(400).json({ error: "empresaId es requerido" });
      }

      const acciones = await planAccionService.listarAcciones(
        empresaId as string,
        estado as EstadoAccion | undefined,
      );
      res.json(acciones);
    } catch (error) {
      next(error);
    }
  },

  async actualizar(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { estado } = req.body;

      if (!estado || !["pendiente", "cumplida", "atendida"].includes(estado)) {
        return res.status(400).json({ error: "Estado inválido o no provisto" });
      }

      const accion = await planAccionService.actualizarEstado(
        id as string,
        estado as EstadoAccion,
      );
      res.json(accion);
    } catch (error) {
      next(error);
    }
  },

  async exportar(req: Request, res: Response, next: NextFunction) {
    try {
      const { empresaId, format } = req.query;
      if (!empresaId) {
        return res.status(400).json({ error: "empresaId es requerido" });
      }

      const acciones = await planAccionService.listarAcciones(
        empresaId as string,
      );

      // Obtener datos de la empresa para personalizar el reporte
      const { data: empresa } = await supabaseAdmin
        .from("empresas")
        .select("razon_social, cuit")
        .eq("id", empresaId)
        .single();

      if (format === "csv") {
        res.setHeader("Content-Type", "text/csv; charset=utf-8");
        res.setHeader(
          "Content-Disposition",
          `attachment; filename=plan_de_accion_${empresa?.cuit || "empresa"}.csv`,
        );

        // Agregar BOM para Excel en español
        let csvContent = "\uFEFF";
        csvContent +=
          "N°,Acción de Mejora,Origen / Sector,Fecha Origen,Estado,Fecha Cumplimiento\n";
        acciones.forEach((a: any, idx: number) => {
          const sector = a.informes_visita?.lugar_visita || "Planta";
          const fechaOrigen = a.informes_visita?.fecha_hora_visita
            ? new Date(a.informes_visita.fecha_hora_visita).toLocaleDateString(
                "es-AR",
              )
            : "";
          const fechaCumplimiento = a.fecha_cumplimiento
            ? new Date(a.fecha_cumplimiento).toLocaleDateString("es-AR")
            : "";
          csvContent += `"${idx + 1}","${a.descripcion}","${sector}","${fechaOrigen}","${a.estado.toUpperCase()}","${fechaCumplimiento}"\n`;
        });

        return res.send(csvContent);
      }

      if (format === "pdf") {
        const PDFDocument = require("pdfkit");
        const doc = new PDFDocument({
          size: "A4",
          margin: 40,
          bufferPages: true,
        });

        res.setHeader("Content-Type", "application/pdf");
        res.setHeader(
          "Content-Disposition",
          `attachment; filename=plan_de_accion_${empresa?.cuit || "empresa"}.pdf`,
        );
        doc.pipe(res);

        // --- DISEÑO ---
        // Cabecera Principal
        doc
          .fillColor("#1B365D")
          .fontSize(22)
          .text("Plan de Acción", { bold: true });
        doc
          .fillColor("#4B5563")
          .fontSize(9)
          .text(
            `Empresa: ${empresa?.razon_social || "N/A"}  |  CUIT: ${empresa?.cuit || "N/A"}  |  Generado: ${new Date().toLocaleDateString("es-AR")}`,
          );
        doc.moveDown(1.5);

        // Tarjetas de Resumen (Stats)
        const total = acciones.length;
        const cumplidas = acciones.filter(
          (a: any) => a.estado === "cumplida",
        ).length;
        const pendientes = total - cumplidas;

        const startY = doc.y;

        // Dibujar 3 rectángulos de estadísticas
        const cardWidth = 160;
        const cardHeight = 50;
        const cardGap = 15;

        // Tarjeta 1: Pendientes
        doc
          .roundedRect(40, startY, cardWidth, cardHeight, 8)
          .fillColor("#FEF3C7")
          .fill();
        doc
          .fillColor("#D97706")
          .fontSize(16)
          .text(String(pendientes), 50, startY + 10, { bold: true });
        doc
          .fillColor("#92400E")
          .fontSize(8)
          .text("Pendientes / Atendidas", 50, startY + 28);

        // Tarjeta 2: Cumplidas
        doc
          .roundedRect(
            40 + cardWidth + cardGap,
            startY,
            cardWidth,
            cardHeight,
            8,
          )
          .fillColor("#D1FAE5")
          .fill();
        doc
          .fillColor("#059669")
          .fontSize(16)
          .text(String(cumplidas), 40 + cardWidth + cardGap + 10, startY + 10, {
            bold: true,
          });
        doc
          .fillColor("#065F46")
          .fontSize(8)
          .text("Cumplidas", 40 + cardWidth + cardGap + 10, startY + 28);

        // Tarjeta 3: Total
        doc
          .roundedRect(
            40 + (cardWidth + cardGap) * 2,
            startY,
            cardWidth,
            cardHeight,
            8,
          )
          .fillColor("#F3F4F6")
          .fill();
        doc
          .fillColor("#1F2937")
          .fontSize(16)
          .text(
            String(total),
            40 + (cardWidth + cardGap) * 2 + 10,
            startY + 10,
            { bold: true },
          );
        doc
          .fillColor("#374151")
          .fontSize(8)
          .text(
            "Total de acciones",
            40 + (cardWidth + cardGap) * 2 + 10,
            startY + 28,
          );

        doc.moveDown(4);

        // Título de la Tabla
        doc
          .fillColor("#1B365D")
          .fontSize(12)
          .text("Listado de Medidas Correctivas", { bold: true });
        doc.moveDown(0.5);

        // Tabla de Acciones
        let currentY = doc.y;

        // Dibujar Cabecera de Tabla
        doc.rect(40, currentY, 515, 20).fillColor("#F1F5F9").fill();
        doc.fillColor("#4B5563").fontSize(8);
        doc.text("#", 48, currentY + 6, { bold: true });
        doc.text("ACCIÓN DE MEJORA", 70, currentY + 6, { bold: true });
        doc.text("ORIGEN / SECTOR / FECHA", 320, currentY + 6, { bold: true });
        doc.text("ESTADO", 480, currentY + 6, { bold: true });

        currentY += 20;

        acciones.forEach((a: any, idx: number) => {
          // Verificar si necesitamos añadir página
          if (currentY > 730) {
            doc.addPage();
            currentY = 40;
            // Redibujar cabecera en la nueva página
            doc.rect(40, currentY, 515, 20).fillColor("#F1F5F9").fill();
            doc.fillColor("#4B5563").fontSize(8);
            doc.text("#", 48, currentY + 6, { bold: true });
            doc.text("ACCIÓN DE MEJORA", 70, currentY + 6, { bold: true });
            doc.text("ORIGEN / SECTOR / FECHA", 320, currentY + 6, {
              bold: true,
            });
            doc.text("ESTADO", 480, currentY + 6, { bold: true });
            currentY += 20;
          }

          const sector = a.informes_visita?.lugar_visita || "Planta";
          const fechaOrigen = a.informes_visita?.fecha_hora_visita
            ? new Date(a.informes_visita.fecha_hora_visita).toLocaleDateString(
                "es-AR",
              )
            : "";

          // Fila alternada de fondo
          if (idx % 2 === 1) {
            doc.rect(40, currentY, 515, 28).fillColor("#F9FAFB").fill();
          }

          // Dibujar línea divisoria inferior
          doc
            .moveTo(40, currentY + 28)
            .lineTo(555, currentY + 28)
            .strokeColor("#F3F4F6")
            .lineWidth(0.5)
            .stroke();

          doc.fillColor("#1F2937").fontSize(8);
          doc.text(String(idx + 1), 48, currentY + 10);

          // Descripción (con ancho máximo para envolver texto)
          doc.text(a.descripcion, 70, currentY + 6, {
            width: 240,
            height: 20,
            ellipsis: true,
          });

          // Origen
          doc
            .fillColor("#6B7280")
            .text(`${sector} · ${fechaOrigen}`, 320, currentY + 10, {
              width: 150,
              ellipsis: true,
            });

          // Estado
          const esCumplida = a.estado === "cumplida";
          const esAtendida = a.estado === "atendida";
          const colorEstado = esCumplida
            ? "#10B981"
            : esAtendida
              ? "#3B82F6"
              : "#F59E0B";

          doc
            .fillColor(colorEstado)
            .text(a.estado.toUpperCase(), 480, currentY + 10, { bold: true });

          currentY += 28;
        });

        // Numerar páginas
        const pages = doc.bufferedPageRange();
        for (let i = 0; i < pages.count; i++) {
          doc.switchToPage(i);
          doc
            .fillColor("#9CA3AF")
            .fontSize(8)
            .text(`Página ${i + 1} de ${pages.count}`, 40, 800, {
              align: "center",
              width: 515,
            });
        }

        doc.end();
        return;
      }

      res.status(500).json({ error: "Formato no soportado" });
    } catch (error) {
      next(error);
    }
  },
};
