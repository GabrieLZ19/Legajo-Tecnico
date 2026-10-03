"use client";

import { DocumentosVencimientoPage } from "@/components/documentos-vencimiento/DocumentosVencimientoPage";

export default function MedicionesPage() {
  return (
    <DocumentosVencimientoPage
      categoria="medicion"
      moduleKey="mediciones"
      titulo="Mediciones"
      basePath="/mediciones"
      nuevoLabel="Nueva medición"
      descripcion="Sección por empresa: iluminación, ruido y demás mediciones con archivos de respaldo, vencimiento y alertas en el panel."
    />
  );
}
