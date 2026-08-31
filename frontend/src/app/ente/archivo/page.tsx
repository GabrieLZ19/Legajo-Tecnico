"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { descargarInformePdf } from "@/hooks/useInformes";
import type { DocumentoArchivo } from "@/types";
import { Download } from "lucide-react";

const TIPO_LABEL: Record<DocumentoArchivo["tipo"], string> = {
  informe: "Informe de visita",
  capacitacion: "Capacitación",
  epp: "Entrega EPP",
  accion: "Acción de mejora",
};

export default function EnteArchivoPage() {
  const [documentos, setDocumentos] = useState<DocumentoArchivo[]>([]);
  const [downloading, setDownloading] = useState<string | null>(null);

  useEffect(() => {
    api
      .get("/ente/archivo")
      .then((res) => setDocumentos(res.data.documentos || []))
      .catch(console.error);
  }, []);

  const download = async (doc: DocumentoArchivo) => {
    setDownloading(doc.id);
    try {
      let blob: Blob;
      if (doc.tipo === "informe") {
        blob = await descargarInformePdf(doc.id);
      } else {
        const path =
          doc.tipo === "epp"
            ? `/epp/entregas/${doc.id}/pdf`
            : `/capacitaciones/${doc.id}/exportar?formato=pdf`;
        const res = await api.get(path, { responseType: "blob" });
        blob = new Blob([res.data], { type: "application/pdf" });
      }
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${doc.tipo}_${doc.id}.pdf`;
      a.click();
      window.URL.revokeObjectURL(url);
    } finally {
      setDownloading(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black text-slate-900">Archivo histórico</h1>
        <p className="text-sm text-slate-500">
          Informes, capacitaciones, EPP y acciones de mejora habilitados por la empresa.
        </p>
      </div>
      <div className="bg-white rounded-3xl border divide-y">
        {documentos.length === 0 ? (
          <p className="p-8 text-sm text-slate-400 font-semibold">
            Sin documentos habilitados.
          </p>
        ) : (
          documentos.map((doc) => (
            <div
              key={`${doc.tipo}-${doc.id}`}
              className="px-5 py-4 flex items-center justify-between gap-3"
            >
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                  {TIPO_LABEL[doc.tipo]}
                </p>
                <p className="text-sm font-bold text-slate-800">{doc.titulo}</p>
                <p className="text-[11px] text-slate-400">
                  {doc.empresa_razon_social} ·{" "}
                  {new Date(doc.fecha).toLocaleDateString("es-AR")}
                  {doc.tipo === "accion" && doc.extra?.estado
                    ? ` · ${String(doc.extra.estado)}`
                    : ""}
                  {doc.tipo === "accion" && doc.extra?.responsable
                    ? ` · ${String(doc.extra.responsable)}`
                    : ""}
                </p>
              </div>
              {doc.tipo === "accion" ? (
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider shrink-0">
                  Solo consulta
                </span>
              ) : (
                doc.pdf_disponible && (
                  <button
                    type="button"
                    onClick={() => download(doc)}
                    disabled={downloading === doc.id}
                    className="inline-flex items-center gap-1 px-3 py-2 bg-slate-900 text-white rounded-lg text-[11px] font-bold cursor-pointer disabled:opacity-50"
                  >
                    <Download className="h-3.5 w-3.5" />
                    PDF
                  </button>
                )
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
