"use client";

import { DocumentoDetallePage } from "@/components/documentos-vencimiento/DocumentoDetallePage";

export default function ArtDetallePage() {
  return (
    <DocumentoDetallePage
      categoria="art"
      moduleKey="art"
      basePath="/art"
    />
  );
}
