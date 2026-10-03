"use client";

import { DocumentosVencimientoPage } from "@/components/documentos-vencimiento/DocumentosVencimientoPage";

export default function ArtPage() {
  return (
    <DocumentosVencimientoPage
      categoria="art"
      moduleKey="art"
      titulo="ART"
      basePath="/art"
      nuevoLabel="Nuevo informe"
      descripcion="Documentación ART separada de Mediciones: misma metodología de carga, vencimientos y alertas en el panel de inicio."
    />
  );
}
