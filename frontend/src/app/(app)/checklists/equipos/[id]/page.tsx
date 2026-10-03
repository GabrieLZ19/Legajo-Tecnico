"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ExternalLink, Loader, QrCode } from "lucide-react";
import { checklistsService } from "@/utils/services/checklists.service";
import { canWriteAppModule } from "@/lib/moduleAccess";
import { useAuth } from "@/hooks/useAuth";

export default function EquipoDetallePage() {
  const params = useParams();
  const id = params.id as string;
  const { user } = useAuth();
  const canWrite = canWriteAppModule(user, "checklists");

  const { data, isLoading } = useQuery({
    queryKey: ["checklist-equipo", id],
    queryFn: () => checklistsService.obtenerEquipo(id),
    enabled: !!id,
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-20 text-slate-400">
        <Loader className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (!data) {
    return (
      <p className="text-center py-16 text-slate-500">Equipo no encontrado.</p>
    );
  }

  const qrUrl = data.qr_url || "";
  const qrImg = qrUrl
    ? `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(qrUrl)}`
    : null;

  return (
    <div className="w-full space-y-6">
      <Link
        href="/checklists/equipos"
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-brand-primary"
      >
        <ArrowLeft className="h-4 w-4" />
        Equipos
      </Link>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-6 shadow-2xs">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">
            {data.nombre}
          </h1>
          <p className="text-sm text-brand-text-muted mt-1">{data.tipo_equipo}</p>
          {data.codigo_interno && (
            <p className="text-sm text-slate-600 mt-2">
              Código: {data.codigo_interno}
            </p>
          )}
          {data.ubicacion && (
            <p className="text-sm text-slate-600">Ubicación: {data.ubicacion}</p>
          )}
          {canWrite && (
            <Link
              href={`/checklists/inspecciones/nueva?equipoId=${data.id}`}
              className="inline-flex mt-4 items-center gap-2 px-4 py-2.5 rounded-xl bg-brand-primary text-white text-sm font-bold hover:bg-brand-primary/95"
            >
              Nueva inspección
            </Link>
          )}
        </div>
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white p-3">
            {qrImg ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={qrImg} alt="QR del equipo" width={180} height={180} />
            ) : (
              <QrCode className="h-24 w-24 text-slate-300" />
            )}
          </div>
          {qrUrl && (
            <a
              href={qrUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-blue-600"
            >
              Abrir enlace QR
              <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 font-semibold text-slate-900">
          Historial de inspecciones
        </div>
        {(data.historial || []).length === 0 ? (
          <p className="px-5 py-8 text-sm text-slate-500 text-center">
            Sin inspecciones aún.
          </p>
        ) : (
          <ul className="divide-y divide-slate-50">
            {(data.historial || []).map((insp) => (
              <li key={insp.id}>
                <Link
                  href={`/checklists/inspecciones/${insp.id}`}
                  className="flex items-center justify-between px-5 py-3.5 hover:bg-slate-50"
                >
                  <div>
                    <p className="text-sm font-medium text-slate-900">
                      {insp.plantilla_titulo}
                    </p>
                    <p className="text-xs text-slate-500">
                      {new Date(insp.fecha).toLocaleString("es-AR")}
                    </p>
                  </div>
                  <span className="text-xs font-bold capitalize text-slate-600">
                    {insp.resultado}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
