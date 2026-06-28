import PDFDocument from 'pdfkit';
import { supabaseAdmin } from '../config/supabase';

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

export const pdfService = {
  async generarPdf(informeId: string): Promise<string> {
    // 1. Obtener informe completo con relaciones
    const { data: informe, error } = await supabaseAdmin
      .from('informes_visita')
      .select('*, empresas(*, consultoras(*)), peligros_detectados(*), puntos_mejora(*), acciones_mejora(*), firmas_informe(*)')
      .eq('id', informeId)
      .single();

    if (error || !informe) {
      throw new Error(`No se pudo obtener el informe para generar el PDF: ${error?.message}`);
    }

    const doc = new PDFDocument({
      size: 'A4',
      margin: 50,
      bufferPages: true, // Permite numeración de páginas al final
    });

    const buffers: Buffer[] = [];
    doc.on('data', buffers.push.bind(buffers));

    return new Promise(async (resolve, reject) => {
      doc.on('end', async () => {
        try {
          const pdfBuffer = Buffer.concat(buffers);
          const filePath = `${informe.empresa_id}/informe_${informe.numero_informe}_${Date.now()}.pdf`;

          // Subir a Supabase Storage
          const { error: uploadError } = await supabaseAdmin.storage
            .from('informes_pdf')
            .upload(filePath, pdfBuffer, {
              contentType: 'application/pdf',
              upsert: true,
            });

          if (uploadError) throw uploadError;

          // Actualizar el informe con la URL pública
          const { data: publicUrlData } = supabaseAdmin.storage
            .from('informes_pdf')
            .getPublicUrl(filePath);

          await supabaseAdmin
            .from('informes_visita')
            .update({ url_pdf_generado: publicUrlData.publicUrl })
            .eq('id', informeId);

          resolve(publicUrlData.publicUrl);
        } catch (err) {
          reject(err);
        }
      });

      try {
        // --- DISEÑO VISUAL DEL PDF ---
        const primaryColor = '#1E3A8A'; // Azul Marino
        const secondaryColor = '#4B5563'; // Gris Slate
        const lightGray = '#F3F4F6';
        const darkText = '#1F2937';

        // 1. Encabezado con Logos
        let yPos = 50;

        // Logo Consultora (Izquierda)
        if (informe.empresas?.consultoras?.logo_url) {
          const logoBuffer = await descargarImagenBuffer(informe.empresas.consultoras.logo_url);
          if (logoBuffer) {
            doc.image(logoBuffer, 50, yPos, { width: 100 });
          }
        } else {
          doc.fontSize(10).fillColor(secondaryColor).text(informe.empresas?.consultoras?.nombre || 'CONSULTORA', 50, yPos, { width: 100 });
        }

        // Logo Empresa (Derecha)
        if (informe.empresas?.logo_url) {
          const logoBuffer = await descargarImagenBuffer(informe.empresas.logo_url);
          if (logoBuffer) {
            doc.image(logoBuffer, 445, yPos, { width: 100 });
          }
        } else {
          doc.fontSize(10).fillColor(secondaryColor).text(informe.empresas?.razon_social || 'EMPRESA', 445, yPos, { width: 100, align: 'right' });
        }

        doc.moveDown(4);
        yPos = doc.y;

        // Título Principal
        doc.rect(50, yPos, 495, 25).fill(primaryColor);
        doc.fillColor('#FFFFFF').fontSize(12).text('CONSTANCIA DE VISITA DE HIGIENE Y SEGURIDAD', 55, yPos + 7, { align: 'center', width: 485 });
        
        doc.moveDown(1.5);
        yPos = doc.y;

        // 2. Datos Generales de la Visita
        doc.fillColor(darkText).fontSize(10);
        
        // Fila 1
        doc.text(`Informe N°: ${informe.numero_informe}`, 50, yPos);
        doc.text(`Fecha/Hora: ${new Date(informe.fecha_hora_visita).toLocaleString('es-AR')}`, 250, yPos);
        
        // Fila 2
        doc.text(`Cliente: ${informe.empresas?.razon_social}`, 50, yPos + 20);
        doc.text(`CUIT: ${informe.empresas?.cuit}`, 250, yPos + 20);

        // Fila 3
        doc.text(`Actividad: ${informe.actividad || 'N/A'}`, 50, yPos + 40);
        doc.text(`Lugar: ${informe.lugar_visita || 'N/A'}`, 250, yPos + 40);

        // Fila 4
        doc.text(`Contacto: ${informe.contacto_visita || 'N/A'}`, 50, yPos + 60);

        doc.moveDown(5);
        yPos = doc.y;

        // 3. Peligros Detectados
        doc.rect(50, yPos, 495, 20).fill(secondaryColor);
        doc.fillColor('#FFFFFF').fontSize(10).text('PELIGROS DETECTADOS Y MEDIDAS DE CONTROL', 55, yPos + 5);
        
        doc.moveDown(0.5);
        yPos = doc.y;

        if (informe.peligros_detectados && informe.peligros_detectados.length > 0) {
          informe.peligros_detectados.forEach((p: any, idx: number) => {
            doc.fillColor(darkText).fontSize(9);
            doc.text(`${idx + 1}. Peligro: ${p.descripcion}`, 60, doc.y + 5, { width: 475 });
            if (p.medida_control) {
              doc.fillColor(secondaryColor).text(`   Medida de Control: ${p.medida_control}`, { width: 475 });
            }
            doc.moveDown(0.5);
          });
        } else {
          doc.fillColor(darkText).fontSize(9).text('No se registraron peligros en esta visita.', 60, yPos + 10);
          doc.moveDown(1.5);
        }

        doc.moveDown(1);
        yPos = doc.y;

        // 4. Puntos a Mejorar y Acciones
        doc.rect(50, yPos, 495, 20).fill(secondaryColor);
        doc.fillColor('#FFFFFF').fontSize(10).text('PUNTOS A MEJORAR Y PLAN DE ACCIÓN', 55, yPos + 5);

        doc.moveDown(0.5);
        yPos = doc.y;

        if (informe.puntos_mejora && informe.puntos_mejora.length > 0) {
          informe.puntos_mejora.forEach((pm: any) => {
            doc.fillColor(darkText).fontSize(9);
            doc.text(`ITEM ${pm.numero_item}: ${pm.detalle}`, 60, doc.y + 5, { width: 475 });
            
            // Buscar acciones asociadas a este punto
            const accionesAsociadas = informe.acciones_mejora?.filter((a: any) => a.punto_mejora_id === pm.id) || [];
            if (accionesAsociadas.length > 0) {
              accionesAsociadas.forEach((acc: any) => {
                doc.fillColor(secondaryColor).text(`   - Acción: ${acc.descripcion} [Estado: ${acc.estado.toUpperCase()}]`, { width: 475 });
              });
            }
            doc.moveDown(0.5);
          });
        } else {
          doc.fillColor(darkText).fontSize(9).text('No se registraron puntos a mejorar.', 60, yPos + 10);
          doc.moveDown(1.5);
        }

        // 5. Firmas
        doc.moveDown(3);
        yPos = doc.y;

        // Evitar que las firmas queden huérfanas al final de la página
        if (yPos > 650) {
          doc.addPage();
          yPos = 50;
        }

        const firmaPreventor = informe.firmas_informe?.find((f: any) => f.tipo === 'preventor');
        const firmaDueno = informe.firmas_informe?.find((f: any) => f.tipo === 'dueno');

        // Dibujar líneas de firmas
        doc.strokeColor(secondaryColor).lineWidth(1);
        
        // Firma Preventor
        doc.moveTo(70, yPos + 80).lineTo(220, yPos + 80).stroke();
        doc.fillColor(darkText).fontSize(9).text('Prof. Seguridad e Higiene', 70, yPos + 85, { width: 150, align: 'center' });
        if (firmaPreventor) {
          doc.fontSize(8).fillColor(secondaryColor).text(`Firmado digitalmente`, 70, yPos + 97, { width: 150, align: 'center' });
          doc.text(`Fecha: ${new Date(firmaPreventor.firmado_at).toLocaleDateString()}`, 70, yPos + 107, { width: 150, align: 'center' });
        }

        // Firma Dueño
        doc.moveTo(325, yPos + 80).lineTo(475, yPos + 80).stroke();
        doc.fillColor(darkText).fontSize(9).text('Responsable de la Empresa', 325, yPos + 85, { width: 150, align: 'center' });
        if (firmaDueno) {
          doc.fontSize(8).fillColor(secondaryColor).text(`Firmado digitalmente`, 325, yPos + 97, { width: 150, align: 'center' });
          doc.text(`Fecha: ${new Date(firmaDueno.firmado_at).toLocaleDateString()}`, 325, yPos + 107, { width: 150, align: 'center' });
        }

        // 6. Numeración de Páginas
        const range = doc.bufferedPageRange();
        for (let i = range.start; i < range.start + range.count; i++) {
          doc.switchToPage(i);
          doc.fillColor(secondaryColor).fontSize(8).text(
            `Página ${i + 1} de ${range.count}`,
            50,
            doc.page.height - 50,
            { align: 'center', width: doc.page.width - 100 }
          );
        }

        doc.end();
      } catch (err) {
        reject(err);
      }
    });
  }
};
