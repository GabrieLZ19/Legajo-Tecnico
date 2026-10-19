import React from "react";
import { QrCode } from "lucide-react";

export interface EquipoQrCardProps {
  nombre: string;
  tipoEquipo?: string | null;
  codigoInterno?: string | null;
  ubicacion?: string | null;
  qrUrl?: string | null;
  placeholderQr?: boolean;
}

/**
 * Representación visual física 1:1 de la chapa / etiqueta QR industrial
 * que se imprime y pega en la maquinaria o equipo de planta.
 */
export function EquipoQrCard({
  nombre,
  tipoEquipo,
  codigoInterno,
  ubicacion,
  qrUrl,
  placeholderQr = false,
}: EquipoQrCardProps) {
  const qrImg = qrUrl
    ? `https://api.qrserver.com/v1/create-qr-code/?size=260x260&data=${encodeURIComponent(qrUrl)}`
    : null;

  return (
    <div className="w-[320px] max-w-full rounded-2xl border-2 border-slate-900 bg-white p-5 text-center shadow-md flex flex-col items-center gap-3">
      {/* Header institucional */}
      <div className="text-[10px] uppercase font-mono tracking-wider text-slate-400 font-bold">
        LEGAJO TÉCNICO DIGITAL · QR INSPECCIÓN
      </div>

      {/* Nombre y tipo */}
      <div className="flex flex-col items-center gap-1.5 w-full">
        <h3 className="text-lg font-black text-slate-900 leading-tight break-words max-w-full">
          {nombre.trim() || "Nombre del equipo"}
        </h3>
        {tipoEquipo?.trim() && (
          <span className="inline-block px-2.5 py-0.5 rounded-md bg-blue-100 text-blue-900 text-xs font-bold leading-normal">
            {tipoEquipo.trim()}
          </span>
        )}
      </div>

      {/* QR container */}
      <div className="inline-flex p-3 bg-white rounded-xl border border-slate-200 shadow-2xs">
        {!placeholderQr && qrImg ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={qrImg}
            alt="Código QR de Inspección"
            width={180}
            height={180}
            className="rounded-lg block"
          />
        ) : (
          <div className="w-[180px] h-[180px] bg-slate-50 rounded-lg flex items-center justify-center">
            <QrCode className="h-28 w-28 text-slate-800" />
          </div>
        )}
      </div>

      {/* Footer y metadatos */}
      <div className="flex flex-col items-center gap-1 w-full">
        <p className="text-xs font-bold text-slate-800 tracking-tight">
          ESCANEAR PARA AUDITORÍA / INSPECCIÓN
        </p>
        <p className="text-[11px] font-mono text-slate-500">
          {[
            codigoInterno?.trim() ? `TAG: ${codigoInterno.trim()}` : null,
            ubicacion?.trim() || null,
          ]
            .filter(Boolean)
            .join(" · ") || "Sin ubicación asignada"}
        </p>
      </div>
    </div>
  );
}
