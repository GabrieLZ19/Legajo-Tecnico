"use client";

import { DocumentoDetallePage } from "@/components/documentos-vencimiento/DocumentoDetallePage";

export default function MedicionDetallePage() {
  return (
    <DocumentoDetallePage
      categoria="medicion"
      moduleKey="mediciones"
      basePath="/mediciones"
    />
  );
}
