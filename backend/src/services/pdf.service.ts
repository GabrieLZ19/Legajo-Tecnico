import PDFDocument from "pdfkit";
import { supabaseAdmin } from "../config/supabase";

// Helper para descargar una imagen a Buffer
async function descargarImagenBuffer(url: string): Promise<Buffer | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } catch (error) {
    console.error(`Error descargando imagen desde ${url}:`, error);
    return null;
  }
}

function limpiarHtmlParaPdf(html: string): string {
  if (!html) return "";

  // Reemplazar saltos de línea e items de lista
  let texto = html
    .replace(/<\/p>/gi, "\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<li>/gi, "• ");

  // Eliminar todas las etiquetas HTML restantes
  texto = texto.replace(/<[^>]*>/g, "");

  // Decodificar entidades HTML comunes
  texto = texto
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");

  // Limpiar saltos de línea repetidos
  texto = texto.replace(/\n\s*\n+/g, "\n\n").trim();

  return texto;
}

export const pdfService = {
  async generarPdf(informeId: string): Promise<string> {
    // 1. Obtener informe completo con relaciones
    const { data: informe, error } = await supabaseAdmin
      .from("informes_visita")
      .select(
        "*, empresas(*, consultoras(*)), peligros_detectados(*), puntos_mejora(*), acciones_mejora(*), firmas_informe(*)",
      )
      .eq("id", informeId)
      .single();

    if (error || !informe) {
      throw new Error(
        `No se pudo obtener el informe para generar el PDF: ${error?.message}`,
      );
    }

    const doc = new PDFDocument({
      size: "A4",
      margin: 50,
      bufferPages: true, // Permite numeración de páginas al final
      autoPageBreak: false, // Desactivar saltos de página automáticos para controlarlos manualmente y evitar hojas vacías
    } as any);

    const buffers: Buffer[] = [];
    doc.on("data", buffers.push.bind(buffers));

    return new Promise(async (resolve, reject) => {
      doc.on("end", async () => {
        try {
          const pdfBuffer = Buffer.concat(buffers);
          const filePath = `${informe.empresa_id}/informe_${informe.numero_informe}_${Date.now()}.pdf`;

          // Subir a Supabase Storage
          const { error: uploadError } = await supabaseAdmin.storage
            .from("informes_pdf")
            .upload(filePath, pdfBuffer, {
              contentType: "application/pdf",
              upsert: true,
            });

          if (uploadError) throw uploadError;

          // Actualizar el informe con la URL pública
          const { data: publicUrlData } = supabaseAdmin.storage
            .from("informes_pdf")
            .getPublicUrl(filePath);

          await supabaseAdmin
            .from("informes_visita")
            .update({ url_pdf_generado: publicUrlData.publicUrl })
            .eq("id", informeId);

          resolve(publicUrlData.publicUrl);
        } catch (err) {
          reject(err);
        }
      });

      try {
        // --- DISEÑO VISUAL DEL PDF ---
        const primaryColor = "#1E3A8A"; // Azul Marino
        const secondaryColor = "#4B5563"; // Gris Slate
        const darkText = "#1F2937";

        // 1. Encabezado con Logos
        let yPos = 50;

        // Logo Consultora (Izquierda)
        if (informe.empresas?.consultoras?.logo_url) {
          const logoBuffer = await descargarImagenBuffer(
            informe.empresas.consultoras.logo_url,
          );
          if (logoBuffer) {
            doc.image(logoBuffer, 50, yPos, { width: 100 });
          } else {
            doc
              .fontSize(10)
              .fillColor(secondaryColor)
              .font("Helvetica-Bold")
              .text(
                informe.empresas?.consultoras?.nombre || "CONSULTORA",
                50,
                yPos,
                { width: 200 },
              );
          }
        } else {
          doc
            .fontSize(10)
            .fillColor(secondaryColor)
            .font("Helvetica-Bold")
            .text(
              informe.empresas?.consultoras?.nombre || "CONSULTORA",
              50,
              yPos,
              { width: 200 },
            );
        }

        // Logo Empresa (Derecha)
        if (informe.empresas?.logo_url) {
          const logoBuffer = await descargarImagenBuffer(
            informe.empresas.logo_url,
          );
          if (logoBuffer) {
            doc.image(logoBuffer, 445, yPos, { width: 100 });
          } else {
            doc
              .fontSize(10)
              .fillColor(secondaryColor)
              .font("Helvetica-Bold")
              .text(informe.empresas?.razon_social || "EMPRESA", 345, yPos, {
                width: 200,
                align: "right",
              });
          }
        } else {
          doc
            .fontSize(10)
            .fillColor(secondaryColor)
            .font("Helvetica-Bold")
            .text(informe.empresas?.razon_social || "EMPRESA", 345, yPos, {
              width: 200,
              align: "right",
            });
        }

        doc.moveDown(4);
        yPos = doc.y;

        // Título Principal
        doc.rect(50, yPos, 495, 30).fill(primaryColor);
        doc
          .fillColor("#FFFFFF")
          .font("Helvetica-Bold")
          .fontSize(12)
          .text("CONSTANCIA DE VISITA DE HIGIENE Y SEGURIDAD", 55, yPos + 9, {
            align: "center",
            width: 485,
          });

        doc.moveDown(1.5);
        yPos = doc.y + 10;

        // 2. Datos Generales de la Visita (Grilla Técnica Estilo Excel)
        doc.strokeColor("#E5E7EB").lineWidth(1);
        doc.roundedRect(50, yPos, 495, 75, 4).stroke();

        // Líneas divisoras de la grilla
        doc
          .moveTo(50, yPos + 25)
          .lineTo(545, yPos + 25)
          .stroke();
        doc
          .moveTo(50, yPos + 50)
          .lineTo(545, yPos + 50)
          .stroke();
        doc
          .moveTo(297.5, yPos)
          .lineTo(297.5, yPos + 75)
          .stroke();

        // Escribir los textos de los datos
        doc.fontSize(8).fillColor("#6B7280").font("Helvetica-Bold");
        doc.text("CLIENTE", 60, yPos + 5);
        doc.text("N° DE INFORME", 307.5, yPos + 5);
        doc.text("ACTIVIDAD", 60, yPos + 30);
        doc.text("FECHA Y HORA DE VISITA", 307.5, yPos + 30);
        doc.text("LUGAR DE VISITA", 60, yPos + 55);
        doc.text("CONTACTO DE LA VISITA", 307.5, yPos + 55);

        // Escribir los valores
        doc.fontSize(9).fillColor(darkText).font("Helvetica-Bold");
        doc.text(informe.empresas?.razon_social || "N/A", 60, yPos + 14, {
          width: 220,
          ellipsis: true,
        });
        doc.text(informe.numero_informe || "N/A", 307.5, yPos + 14);
        doc.text(informe.actividad || "N/A", 60, yPos + 39, {
          width: 220,
          ellipsis: true,
        });
        doc.text(
          new Date(informe.fecha_hora_visita).toLocaleString("es-AR"),
          307.5,
          yPos + 39,
        );
        doc.text(informe.lugar_visita || "N/A", 60, yPos + 64, {
          width: 220,
          ellipsis: true,
        });
        doc.text(informe.contacto_visita || "N/A", 307.5, yPos + 64, {
          width: 220,
          ellipsis: true,
        });

        doc.y = yPos + 75 + 15;

        // Declaración Legal / Jurada
        if (informe.declaracion_legal) {
          const textoDeclaracion = limpiarHtmlParaPdf(
            informe.declaracion_legal,
          );
          if (textoDeclaracion) {
            yPos = doc.y;
            if (yPos > 650) {
              doc.addPage();
              yPos = 50;
            }
            // Cabecera de la sección
            doc.rect(50, yPos, 495, 20).fill(secondaryColor);

            // Icono de documento dibujado en vectores blancos
            doc.save();
            doc
              .fillColor("#FFFFFF")
              .rect(58, yPos + 5, 8, 10)
              .fill();
            doc.strokeColor(secondaryColor).lineWidth(0.8);
            doc
              .moveTo(60, yPos + 7)
              .lineTo(64, yPos + 7)
              .stroke();
            doc
              .moveTo(60, yPos + 9)
              .lineTo(64, yPos + 9)
              .stroke();
            doc
              .moveTo(60, yPos + 11)
              .lineTo(63, yPos + 11)
              .stroke();
            doc.restore();

            // Texto del título
            doc
              .fillColor("#FFFFFF")
              .font("Helvetica-Bold")
              .fontSize(9)
              .text("DECLARACIÓN JURADA DE LA VISITA", 72, yPos + 6);

            doc.y = yPos + 20 + 10;
            doc.fillColor(darkText).font("Helvetica-Oblique").fontSize(8.5);
            doc.text(textoDeclaracion, 60, doc.y, {
              width: 475,
              align: "justify",
            });
            doc.moveDown(1.5);
          }
        }

        // 3. Peligros Detectados (Si existen)
        if (
          informe.peligros_detectados &&
          informe.peligros_detectados.length > 0
        ) {
          yPos = doc.y;
          if (yPos > 650) {
            doc.addPage();
            yPos = 50;
          }
          doc.rect(50, yPos, 495, 20).fill(secondaryColor);
          doc
            .fillColor("#FFFFFF")
            .font("Helvetica-Bold")
            .fontSize(9)
            .text("PELIGROS DETECTADOS Y MEDIDAS DE CONTROL", 55, yPos + 6);

          doc.y = yPos + 20 + 8;

          informe.peligros_detectados.forEach((p: any, idx: number) => {
            if (doc.y > 700) {
              doc.addPage();
            }
            doc.fillColor(darkText).font("Helvetica-Bold").fontSize(8.5);
            doc.text(`${idx + 1}. Peligro: `, 60, doc.y, { continued: true });
            doc.font("Helvetica").text(p.descripcion);

            if (p.medida_control) {
              doc.fillColor(secondaryColor).font("Helvetica-Bold");
              doc.text("   Medida de Control: ", 60, doc.y, {
                continued: true,
              });
              doc.font("Helvetica").text(p.medida_control);
            }
            doc.moveDown(0.4);
          });
          doc.moveDown(1);
        }

        // 4. Puntos a Mejorar (Desvíos/Observaciones)
        yPos = doc.y;
        if (yPos > 650) {
          doc.addPage();
          yPos = 50;
        }

        doc.rect(50, yPos, 495, 20).fill(secondaryColor);
        doc
          .fillColor("#FFFFFF")
          .font("Helvetica-Bold")
          .fontSize(9)
          .text("PUNTOS A MEJORAR DETECTADOS EN LA VISITA", 55, yPos + 6);
        doc.y = yPos + 20 + 12;

        if (informe.puntos_mejora && informe.puntos_mejora.length > 0) {
          const puntosOrdenados = [...informe.puntos_mejora].sort(
            (a: any, b: any) =>
              (a.orden ?? a.numero_item) - (b.orden ?? b.numero_item),
          );

          for (let i = 0; i < puntosOrdenados.length; i++) {
            const pm = puntosOrdenados[i];
            const accionesAsociadas =
              informe.acciones_mejora?.filter(
                (a: any) => a.punto_mejora_id === pm.id,
              ) || [];

            // Altura dinámica de la tarjeta según la cantidad de acciones de mejora
            const cardHeight =
              110 + Math.max(0, accionesAsociadas.length - 1) * 16;

            if (doc.y + cardHeight + 15 > 740) {
              doc.addPage();
            }

            const cardY = doc.y;

            // Dibujar tarjeta (rectángulo con borde suave y fondo sutil)
            doc
              .roundedRect(50, cardY, 495, cardHeight, 6)
              .strokeColor("#E5E7EB")
              .lineWidth(1)
              .stroke();

            let textX = 65;
            let textWidth = 465;

            // Descargar imagen si existe evidencia_url
            let fotoBuffer: Buffer | null = null;
            if (pm.evidencia_url) {
              fotoBuffer = await descargarImagenBuffer(pm.evidencia_url);
            }

            if (fotoBuffer) {
              try {
                // Dibujar imagen centrada en el recuadro de la izquierda (x=60, y=cardY+10, width=150, height=95)
                doc.image(fotoBuffer, 60, cardY + 10, {
                  fit: [150, 95],
                  align: "center",
                  valign: "center",
                });
                textX = 225;
                textWidth = 305;
              } catch (imgError) {
                console.error(
                  "Error al renderizar imagen en el PDF:",
                  imgError,
                );
              }
            }

            // Título del Item
            doc.fillColor(primaryColor).font("Helvetica-Bold").fontSize(9);
            doc.text(`ÍTEM ${pm.numero_item || i + 1}`, textX, cardY + 10, {
              width: textWidth,
            });

            // Detalle / Hallazgo
            doc.fillColor("#6B7280").font("Helvetica-Bold").fontSize(8.5);
            doc.text("Detalle / Hallazgo:", textX, cardY + 23, {
              width: textWidth,
            });
            doc.fillColor(darkText).font("Helvetica").fontSize(8.5);
            doc.text(pm.detalle, textX, cardY + 34, {
              width: textWidth,
              height: 40,
              ellipsis: true,
            });

            // Acción de mejora sugerida
            doc.fillColor("#6B7280").font("Helvetica-Bold").fontSize(8.5);
            doc.text("Acción de mejora sugerida:", textX, cardY + 74, {
              width: textWidth,
            });

            if (accionesAsociadas.length > 0) {
              accionesAsociadas.forEach((acc: any, aIdx: number) => {
                const actionY = cardY + 85 + aIdx * 16;
                const estadoLower = acc.estado?.toLowerCase();
                const isCumplida = estadoLower === "cumplida";
                const isAtendida = estadoLower === "atendida";

                const badgeText = isCumplida
                  ? "CUMPLIDA"
                  : isAtendida
                    ? "ATENDIDA"
                    : "PENDIENTE";
                const badgeBg = isCumplida
                  ? "#D1FAE5"
                  : isAtendida
                    ? "#EFF6FF"
                    : "#FEF3C7";
                const badgeColor = isCumplida
                  ? "#065F46"
                  : isAtendida
                    ? "#1E40AF"
                    : "#92400E";

                const badgeWidth = 60;
                const badgeHeight = 12;
                const badgeX = 545 - 15 - badgeWidth; // A la derecha de la tarjeta

                // Dibujar el badge para esta acción
                doc.save();
                doc.fillColor(badgeBg);
                doc
                  .roundedRect(
                    badgeX,
                    actionY - 1.5,
                    badgeWidth,
                    badgeHeight,
                    3,
                  )
                  .fill();
                doc.fillColor(badgeColor).font("Helvetica-Bold").fontSize(7);
                doc.text(badgeText, badgeX, actionY + 1, {
                  width: badgeWidth,
                  align: "center",
                });
                doc.restore();

                // Texto de la acción
                const resp = acc.responsable
                  ? ` (Resp: ${acc.responsable})`
                  : "";
                const actionTextWidth = textWidth - badgeWidth - 10;

                doc.fillColor(darkText).font("Helvetica").fontSize(8.5);
                doc.text(`• ${acc.descripcion}${resp}`, textX, actionY, {
                  width: actionTextWidth,
                  height: 14,
                  ellipsis: true,
                });
              });
            } else {
              doc
                .fillColor("#9CA3AF")
                .font("Helvetica-Oblique")
                .text("Sin acción de mejora asociada", textX, cardY + 85);
            }

            doc.y = cardY + cardHeight + 10;
          }
        } else {
          doc
            .fillColor(darkText)
            .font("Helvetica")
            .fontSize(9)
            .text(
              "No se registraron puntos a mejorar en esta visita.",
              60,
              doc.y + 5,
            );
          doc.moveDown(2);
        }

        // 5. Tabla Resumen Final de Acciones de Mejora
        yPos = doc.y;
        if (yPos + 80 > 740) {
          doc.addPage();
          yPos = 50;
        }

        doc.rect(50, yPos, 495, 20).fill(primaryColor);
        doc
          .fillColor("#FFFFFF")
          .font("Helvetica-Bold")
          .fontSize(9)
          .text("LISTADO DE ACCIONES DE MEJORA DE LA VISITA", 55, yPos + 6, {
            align: "center",
            width: 485,
          });
        doc.y = yPos + 20;

        // Dibujar cabecera de la tabla
        const tableY = doc.y;
        doc.rect(50, tableY, 495, 18).fill("#F3F4F6");

        doc.strokeColor("#E5E7EB").lineWidth(0.5);
        doc.lineJoin("miter");
        doc.rect(50, tableY, 495, 18).stroke();

        doc.fillColor(darkText).font("Helvetica-Bold").fontSize(8);
        doc.text("ITEM", 50, tableY + 5, { width: 40, align: "center" });
        doc.text("ACCIÓN DE MEJORA SUGERIDA", 95, tableY + 5, { width: 245 });
        doc.text("RESPONSABLE", 345, tableY + 5, {
          width: 95,
          align: "center",
        });
        doc.text("ESTADO", 445, tableY + 5, { width: 100, align: "center" });

        doc.y = tableY + 18;

        if (informe.acciones_mejora && informe.acciones_mejora.length > 0) {
          // Crear un mapa para asociar punto_mejora_id -> punto_mejora para acceso rápido
          const mapaPuntos = new Map<string, any>();
          if (informe.puntos_mejora) {
            informe.puntos_mejora.forEach((pm: any) => {
              mapaPuntos.set(pm.id, pm);
            });
          }

          // Ordenar las acciones por el orden/numero_item del punto de mejora padre, y luego por id/creacion de la accion
          const accionesOrdenadas = [...informe.acciones_mejora].sort(
            (a: any, b: any) => {
              const pmA = mapaPuntos.get(a.punto_mejora_id);
              const pmB = mapaPuntos.get(b.punto_mejora_id);
              const ordenA = pmA ? (pmA.orden ?? pmA.numero_item ?? 0) : 0;
              const ordenB = pmB ? (pmB.orden ?? pmB.numero_item ?? 0) : 0;
              if (ordenA !== ordenB) {
                return ordenA - ordenB;
              }
              return a.id.localeCompare(b.id);
            },
          );

          const contadoresAcciones = new Map<string, number>();

          accionesOrdenadas.forEach((acc: any, index: number) => {
            if (doc.y + 25 > 740) {
              doc.addPage();
              const newTableY = doc.y;
              doc.rect(50, newTableY, 495, 18).fill("#F3F4F6");
              doc.rect(50, newTableY, 495, 18).stroke();
              doc.fillColor(darkText).font("Helvetica-Bold").fontSize(8);
              doc.text("ITEM", 50, newTableY + 5, {
                width: 40,
                align: "center",
              });
              doc.text("ACCIÓN DE MEJORA SUGERIDA", 95, newTableY + 5, {
                width: 245,
              });
              doc.text("RESPONSABLE", 345, newTableY + 5, {
                width: 95,
                align: "center",
              });
              doc.text("ESTADO", 445, newTableY + 5, {
                width: 100,
                align: "center",
              });
              doc.y = newTableY + 18;
            }

            const rowY = doc.y;
            const rowHeight = 22;

            // Alternar fondo
            if (index % 2 === 1) {
              doc.rect(50, rowY, 495, rowHeight).fill("#F9FAFB");
            }

            // Bordes de la fila
            doc.strokeColor("#E5E7EB").rect(50, rowY, 495, rowHeight).stroke();
            // Dibujar divisorias de columnas
            doc
              .moveTo(90, rowY)
              .lineTo(90, rowY + rowHeight)
              .stroke();
            doc
              .moveTo(340, rowY)
              .lineTo(340, rowY + rowHeight)
              .stroke();
            doc
              .moveTo(440, rowY)
              .lineTo(440, rowY + rowHeight)
              .stroke();

            // Calcular código de item: numero_item_padre.subindex
            const pmParent = mapaPuntos.get(acc.punto_mejora_id);
            const numeroItemPadre = pmParent ? pmParent.numero_item || 1 : 1;
            const subIndex = contadoresAcciones.get(acc.punto_mejora_id) || 0;
            contadoresAcciones.set(acc.punto_mejora_id, subIndex + 1);
            const codigoItem = `${numeroItemPadre}.${subIndex}`;

            // Textos
            doc.fillColor(darkText).font("Helvetica-Bold").fontSize(8);
            doc.text(codigoItem, 50, rowY + 7, { width: 40, align: "center" });

            doc.font("Helvetica").fontSize(8);
            doc.text(acc.descripcion, 98, rowY + 7, {
              width: 238,
              height: 14,
              ellipsis: true,
            });

            doc.font("Helvetica").fontSize(8);
            doc.text(acc.responsable || "-", 342, rowY + 7, {
              width: 95,
              align: "center",
              height: 14,
              ellipsis: true,
            });

            // Dibujar Píldora/Badge de Estado
            const estadoLower = acc.estado?.toLowerCase();
            const isCumplida = estadoLower === "cumplida";
            const isAtendida = estadoLower === "atendida";

            const badgeText = isCumplida
              ? "CUMPLIDA"
              : isAtendida
                ? "ATENDIDA"
                : "PENDIENTE";
            const badgeBg = isCumplida
              ? "#D1FAE5"
              : isAtendida
                ? "#EFF6FF"
                : "#FEF3C7";
            const badgeColor = isCumplida
              ? "#065F46"
              : isAtendida
                ? "#1E40AF"
                : "#92400E";

            const badgeWidth = 65;
            const badgeHeight = 12;
            const badgeX = 440 + (100 - badgeWidth) / 2;
            const badgeY = rowY + (rowHeight - badgeHeight) / 2;

            doc.save();
            doc.fillColor(badgeBg);
            doc.roundedRect(badgeX, badgeY, badgeWidth, badgeHeight, 3).fill();
            doc.fillColor(badgeColor).font("Helvetica-Bold").fontSize(7);
            doc.text(badgeText, badgeX, badgeY + 2.5, {
              width: badgeWidth,
              align: "center",
            });
            doc.restore();

            doc.y = rowY + rowHeight;
          });
        } else {
          const rowY = doc.y;
          doc.rect(50, rowY, 495, 20).stroke();
          doc
            .fillColor("#9CA3AF")
            .font("Helvetica")
            .fontSize(8.5)
            .text("No hay acciones de mejora registradas.", 60, rowY + 6, {
              align: "center",
              width: 475,
            });
          doc.y = rowY + 20;
        }
        doc.moveDown(2);

        // 6. Firmas
        yPos = doc.y;
        if (yPos + 80 > 740) {
          doc.addPage();
          yPos = 50;
        }

        const firmaPreventor = informe.firmas_informe?.find(
          (f: any) => f.tipo === "preventor",
        );
        const firmaDueno = informe.firmas_informe?.find(
          (f: any) => f.tipo === "dueno",
        );

        // Dibujar las imágenes de firma si existen
        if (firmaPreventor?.firma_url) {
          const buffer = await descargarImagenBuffer(firmaPreventor.firma_url);
          if (buffer) {
            try {
              doc.image(buffer, 95, yPos + 15, { height: 40 });
            } catch (err) {
              console.error("Error al renderizar firma preventor:", err);
            }
          }
        }

        if (firmaDueno?.firma_url) {
          const buffer = await descargarImagenBuffer(firmaDueno.firma_url);
          if (buffer) {
            try {
              doc.image(buffer, 350, yPos + 15, { height: 40 });
            } catch (err) {
              console.error("Error al renderizar firma dueño:", err);
            }
          }
        }

        // Dibujar líneas de firmas
        doc.strokeColor(secondaryColor).lineWidth(1);

        // Firma Preventor
        doc
          .moveTo(70, yPos + 60)
          .lineTo(220, yPos + 60)
          .stroke();
        doc
          .fillColor(darkText)
          .fontSize(8.5)
          .font("Helvetica-Bold")
          .text("Prof. Seguridad e Higiene", 70, yPos + 65, {
            width: 150,
            align: "center",
          });
        if (firmaPreventor) {
          doc
            .fontSize(7.5)
            .fillColor("#059669")
            .font("Helvetica-Bold")
            .text(`Firmado digitalmente`, 70, yPos + 77, {
              width: 150,
              align: "center",
            });
          doc
            .fillColor(secondaryColor)
            .font("Helvetica")
            .text(
              `Fecha: ${new Date(firmaPreventor.firmado_at).toLocaleDateString()}`,
              70,
              yPos + 87,
              { width: 150, align: "center" },
            );
        } else {
          doc
            .fontSize(7.5)
            .fillColor("#9CA3AF")
            .font("Helvetica-Oblique")
            .text(`Pendiente de firma`, 70, yPos + 77, {
              width: 150,
              align: "center",
            });
        }

        // Firma Dueño
        doc
          .moveTo(325, yPos + 60)
          .lineTo(475, yPos + 60)
          .stroke();
        doc
          .fillColor(darkText)
          .fontSize(8.5)
          .font("Helvetica-Bold")
          .text("Responsable de la Empresa", 325, yPos + 65, {
            width: 150,
            align: "center",
          });
        if (firmaDueno) {
          doc
            .fontSize(7.5)
            .fillColor("#059669")
            .font("Helvetica-Bold")
            .text(`Firmado digitalmente`, 325, yPos + 77, {
              width: 150,
              align: "center",
            });
          doc
            .fillColor(secondaryColor)
            .font("Helvetica")
            .text(
              `Fecha: ${new Date(firmaDueno.firmado_at).toLocaleDateString()}`,
              325,
              yPos + 87,
              { width: 150, align: "center" },
            );
        } else {
          doc
            .fontSize(7.5)
            .fillColor("#9CA3AF")
            .font("Helvetica-Oblique")
            .text(`Pendiente de firma`, 325, yPos + 77, {
              width: 150,
              align: "center",
            });
        }

        // 7. Numeración de Páginas
        const range = doc.bufferedPageRange();
        for (let i = range.start; i < range.start + range.count; i++) {
          doc.switchToPage(i);

          // Guardar margen original y establecer margen inferior en 0 de forma temporal
          const oldBottomMargin = doc.page.margins.bottom;
          doc.page.margins.bottom = 0;

          doc
            .fillColor(secondaryColor)
            .fontSize(8)
            .text(
              `Página ${i + 1} de ${range.count}`,
              50,
              doc.page.height - 35, // Un poco más abajo del margen normal
              { align: "center", width: doc.page.width - 100 },
            );

          // Restaurar margen inferior original
          doc.page.margins.bottom = oldBottomMargin;
        }

        doc.end();
      } catch (err) {
        reject(err);
      }
    });
  },
};
