"use client";

import { DocumentoFormPage } from "@/components/documentos-vencimiento/DocumentoFormPage";

export default function NuevaMedicionPage() {
  return (
    <DocumentoFormPage
      categoria="medicion"
      basePath="/mediciones"
      tituloPagina="Nueva medición"
    />
  );
}
