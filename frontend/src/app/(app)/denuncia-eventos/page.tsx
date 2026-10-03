"use client";

import { AlertTriangle, Construction, ShieldAlert } from "lucide-react";

export default function DenunciaEventosPage() {
  return (
    <div className="w-full space-y-6">
      <div>
        <span className="text-sm font-semibold text-slate-500 flex items-center gap-1.5">
          <ShieldAlert className="h-4 w-4 text-brand-primary" />
          Módulo de Denuncia de Eventos
        </span>
        <h1 className="text-3xl font-black text-slate-900 tracking-tight mt-1">
          Denuncia de Eventos
        </h1>
        <p className="text-sm text-brand-text-muted mt-1 max-w-2xl">
          Acceso reservado en el menú final. La funcionalidad operativa se
          habilitará en una etapa posterior.
        </p>
      </div>

      <div className="relative overflow-hidden rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 via-white to-blue-50 p-10 md:p-14 text-center shadow-2xs">
        <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-amber-100/60 blur-2xl" />
        <div className="absolute -left-8 bottom-0 h-32 w-32 rounded-full bg-blue-100/50 blur-2xl" />
        <div className="relative">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-amber-100 text-amber-700 border border-amber-200 mb-5">
            <Construction className="h-8 w-8" />
          </div>
          <h2 className="text-2xl font-black text-slate-900 mb-2">
            Etapa en desarrollo
          </h2>
          <p className="text-base font-semibold text-amber-800 mb-2">
            Próximamente
          </p>
          <p className="text-sm text-slate-600 max-w-lg mx-auto leading-relaxed">
            Este módulo ya forma parte del menú para que puedas ver la
            estructura final de la plataforma. Cuando se active, vas a poder
            registrar y dar seguimiento a denuncias de eventos.
          </p>
          <div className="mt-6 inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-500 bg-white/80 border border-slate-200 px-3 py-1.5 rounded-full">
            <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
            Placeholder de menú · sin carga operativa
          </div>
        </div>
      </div>
    </div>
  );
}
