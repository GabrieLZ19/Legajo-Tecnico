"use client";

import { useState } from "react";
import { Download, Loader2, Printer, QrCode } from "lucide-react";
import { useEpp } from "@/hooks/useEpp";
import { useAlert } from "@/context/AlertContext";

type GeneracionQrTabProps = {
  empresaId: string;
  razonSocial?: string | null;
  canEdit: boolean;
};

export function GeneracionQrTab({
  empresaId,
  razonSocial,
  canEdit,
}: GeneracionQrTabProps) {
  const { generarQrEntrega } = useEpp();
  const { showAlert } = useAlert();
  const [qrEntrega, setQrEntrega] = useState<{
    qr: string;
    url: string;
    razonSocial: string;
  } | null>(null);
  const [generando, setGenerando] = useState(false);

  const handleGenerar = async () => {
    setGenerando(true);
    try {
      const data = await generarQrEntrega(empresaId);
      setQrEntrega({
        qr: data.qr,
        url: data.url,
        razonSocial: data.empresa.razon_social,
      });
    } catch {
      showAlert(
        "error",
        "Error",
        "No se pudo generar el QR de entrega. Reintentá en un momento.",
      );
    } finally {
      setGenerando(false);
    }
  };

  const downloadQr = () => {
    if (!qrEntrega) return;
    const link = document.createElement("a");
    link.href = qrEntrega.qr;
    link.download = `QR_Entrega_EPP_${qrEntrega.razonSocial.replace(/\s+/g, "_")}.png`;
    link.click();
  };

  const printQr = () => {
    if (!qrEntrega) return;
    const w = window.open("", "_blank", "noopener,noreferrer,width=480,height=640");
    if (!w) {
      showAlert(
        "warning",
        "Impresión",
        "Permití ventanas emergentes para imprimir el QR.",
      );
      return;
    }
    const safeName = qrEntrega.razonSocial.replace(/</g, "");
    const safeUrl = qrEntrega.url.replace(/</g, "");
    w.document.write(`<!DOCTYPE html><html><head><title>QR Entrega EPP</title>
      <style>
        body{font-family:system-ui,sans-serif;text-align:center;padding:24px;color:#0f172a}
        h1{font-size:16px;margin:0 0 8px}
        p{font-size:12px;color:#64748b;margin:0 0 16px}
        img{width:320px;height:320px}
        .url{font-size:10px;word-break:break-all;margin-top:12px}
      </style></head><body>
      <h1>Entrega de EPP — ${safeName}</h1>
      <p>Escaneá para registrar la entrega (Res. SRT 299/11)</p>
      <img src="${qrEntrega.qr}" alt="QR entrega EPP" />
      <p class="url">${safeUrl}</p>
      <script>window.onload=function(){window.print();}</script>
      </body></html>`);
    w.document.close();
  };

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-base font-black text-slate-800 tracking-tight">
          Generación de QR
        </h2>
        <p className="mt-1 text-xs font-medium text-slate-500 max-w-2xl leading-relaxed">
          Generá un QR genérico de la empresa para imprimir y pegar en cada armario o
          punto de entrega. El trabajador lo escanea, ingresa su DNI y el sistema
          completa puesto y EPP necesarios desde la nómina.
        </p>
        {razonSocial && (
          <p className="mt-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">
            {razonSocial}
          </p>
        )}
      </div>

      <div className="bg-white rounded-3xl border border-slate-100 shadow-xs p-6 sm:p-8">
        {!qrEntrega ? (
          <div className="flex flex-col items-center text-center py-8 sm:py-12 space-y-4">
            <div className="h-16 w-16 rounded-2xl bg-blue-50 text-blue-700 flex items-center justify-center">
              <QrCode className="h-8 w-8" />
            </div>
            <div className="max-w-md space-y-2">
              <p className="text-sm font-bold text-slate-700">
                QR de punto de entrega
              </p>
              <p className="text-xs font-medium text-slate-400 leading-relaxed">
                El mismo código sirve para todos. No está atado a un
                trabajador: la identificación se hace al escanear.
              </p>
            </div>
            {canEdit ? (
              <button
                type="button"
                onClick={() => void handleGenerar()}
                disabled={generando}
                className="inline-flex items-center justify-center gap-2 min-h-12 px-6 py-3 bg-blue-700 hover:bg-blue-800 text-white text-sm font-bold rounded-xl cursor-pointer disabled:opacity-50"
              >
                {generando ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Generando…
                  </>
                ) : (
                  <>
                    <QrCode className="h-5 w-5" />
                    Generar QR para imprimir
                  </>
                )}
              </button>
            ) : (
              <p className="text-xs font-semibold text-slate-400">
                No tenés permiso para generar el QR.
              </p>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center text-center space-y-5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={qrEntrega.qr}
              alt="QR punto de entrega"
              className="w-56 h-56 sm:w-64 sm:h-64"
            />
            <div className="max-w-md space-y-2">
              <p className="text-sm font-bold text-slate-800">
                QR genérico — {qrEntrega.razonSocial}
              </p>
              <p className="text-xs font-medium text-slate-400 leading-relaxed">
                Imprimí y pegá el mismo código en cada punto de entrega. El
                trabajador carga nombre y DNI; puesto y EPP salen de la nómina.
              </p>
              <p className="text-[10px] text-slate-300 break-all">{qrEntrega.url}</p>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 w-full max-w-md">
              <button
                type="button"
                onClick={downloadQr}
                className="flex-1 min-h-12 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-bold inline-flex items-center justify-center gap-2 cursor-pointer"
              >
                <Download className="h-4 w-4" />
                Descargar
              </button>
              <button
                type="button"
                onClick={printQr}
                className="flex-1 min-h-12 py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-sm font-bold inline-flex items-center justify-center gap-2 cursor-pointer"
              >
                <Printer className="h-4 w-4" />
                Imprimir
              </button>
            </div>
            {canEdit && (
              <button
                type="button"
                onClick={() => void handleGenerar()}
                disabled={generando}
                className="text-xs font-bold text-blue-700 hover:text-blue-800 cursor-pointer disabled:opacity-50"
              >
                {generando ? "Regenerando…" : "Regenerar QR"}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
