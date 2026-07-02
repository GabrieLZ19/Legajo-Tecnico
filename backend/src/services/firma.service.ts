import { supabaseAdmin } from '../config/supabase';
import { TipoFirma } from '../types/database';
import { pdfService } from './pdf.service';

export const firmaService = {
  async firmarInforme(
    informeId: string,
    firmanteId: string,
    tipo: TipoFirma,
    firmaBase64: string,
    ipAddress?: string
  ) {
    // 1. Subir la firma a Supabase Storage
    const buffer = Buffer.from(firmaBase64.replace(/^data:image\/\w+;base64,/, ''), 'base64');
    const filePath = `${informeId}_${tipo}_${Date.now()}.png`;
    
    const { error: uploadError } = await supabaseAdmin.storage
      .from('firmas_digitales')
      .upload(filePath, buffer, {
        contentType: 'image/png',
        upsert: true
      });
      
    if (uploadError) throw uploadError;
    
    const { data: publicUrlData } = supabaseAdmin.storage
      .from('firmas_digitales')
      .getPublicUrl(filePath);
      
    const firmaUrl = publicUrlData.publicUrl;

    // 2. Insertar/Actualizar en tabla firmas_informe (idempotente)
    const { error: errFirma } = await supabaseAdmin
      .from('firmas_informe')
      .upsert({
        informe_id: informeId,
        firmante_id: firmanteId,
        tipo,
        firma_url: firmaUrl,
        firmado_at: new Date().toISOString(),
        ip_address: ipAddress,
      }, {
        onConflict: 'informe_id,tipo'
      });

    if (errFirma) throw errFirma;

    // 3. Actualizar estado del informe
    const nuevoEstado = tipo === 'preventor' ? 'pendiente_dueno' : 'firmado';
    const { error: errEstado } = await supabaseAdmin
      .from('informes_visita')
      .update({ estado_firma: nuevoEstado })
      .eq('id', informeId);

    if (errEstado) throw errEstado;

    // 4. Si es firmado, disparar la generación de PDF
    if (nuevoEstado === 'firmado') {
      try {
        await pdfService.generarPdf(informeId);
      } catch (pdfError) {
        console.error(`🚨 Error al generar el PDF para el informe ${informeId}:`, pdfError);
        // No arrojamos el error para no romper la respuesta exitosa de la firma
      }
    }

    return { success: true, estado: nuevoEstado };
  }
};
