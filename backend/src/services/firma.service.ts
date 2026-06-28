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
    // 1. Subir la firma a Supabase Storage (aquí mockeamos la subida de base64 y guardamos un string temporal o real)
    // En una implementación real se extrae el buffer del base64 y se sube a Storage
    // const buffer = Buffer.from(firmaBase64.replace(/^data:image\/\w+;base64,/, ''), 'base64');
    // await supabaseAdmin.storage.from('firmas_digitales').upload(...)
    
    // Asumimos que firmaUrl es el resultado del storage
    const firmaUrl = `firmas_digitales/${informeId}_${tipo}_${Date.now()}.png`;

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
      await pdfService.generarPdf(informeId);
    }

    return { success: true, estado: nuevoEstado };
  }
};
