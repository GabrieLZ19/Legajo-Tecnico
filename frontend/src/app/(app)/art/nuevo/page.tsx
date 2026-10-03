"use client";

import { DocumentoFormPage } from "@/components/documentos-vencimiento/DocumentoFormPage";

export default function NuevoArtPage() {
  return (
    <DocumentoFormPage
      categoria="art"
      basePath="/art"
      tituloPagina="Nuevo informe ART"
    />
  );
}
