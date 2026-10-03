"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  ChevronRight,
  ClipboardCheck,
  Loader,
  Plus,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { canWriteAppModule } from "@/lib/moduleAccess";
import { checklistsService } from "@/utils/services/checklists.service";

type Filtro = "todas" | "aprobada" | "observada" | "rechazada";

export default function InspeccionesPage() {
  const { user, empresa } = useAuth();
  const canWrite = canWriteAppModule(user, "checklists");
  const [filtro, setFiltro] = useState<Filtro>("todas");

  const { data, isLoading } = useQuery({
    queryKey: ["checklists-inspecciones", empresa?.id, "all"],
    queryFn: () =>
      checklistsService.listarInspecciones({
        empresaId: empresa!.id,
        limit: 100,
      }),
    enabled: !!empresa?.id,
  });

  const inspecciones = data?.inspecciones || [];
  const filtradas = useMemo(
    () =>
      filtro === "todas"
        ? inspecciones
        : inspecciones.filter((i) => i.resultado === filtro),
    [inspecciones, filtro],
  );

  return (
    <div className="w-full space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <Link
            href="/checklists"
            className="inline-flex items-center gap-1 text-sm font-semibold text-slate-500 hover:text-brand-primary mb-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Checklists
          </Link>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">
            Inspecciones
          </h1>
          <p className="text-sm text-brand-text-muted mt-1">
            Historial con resultado automático y plan de acción por inspección.
          </p>
        </div>
        {canWrite && (
          <Link
            href="/checklists/inspecciones/nueva"
            className="inline-flex items-center justify-center gap-2 bg-brand-primary hover:bg-brand-primary/95 text-white font-bold px-5 py-3 rounded-xl shadow-md text-sm cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            Nueva inspección
          </Link>
        )}
      </div>

      <div className="flex gap-2 flex-wrap">
        {(
          [
            ["todas", "Todas"],
            ["aprobada", "Aprobadas"],
            ["observada", "Observadas"],
            ["rechazada", "Rechazadas"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setFiltro(key)}
            className={`px-4 py-2 rounded-full text-xs font-bold transition-all cursor-pointer ${
              filtro === key
                ? "bg-brand-primary text-white shadow-md"
                : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <section className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-2xs">
        {isLoading ? (
          <div className="flex justify-center py-16 text-slate-400">
            <Loader className="h-6 w-6 animate-spin" />
          </div>
        ) : filtradas.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <ClipboardCheck className="h-10 w-10 text-slate-300 mx-auto mb-3" />
            <p className="text-sm font-bold text-slate-700">
              No hay inspecciones
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-slate-50">
            {filtradas.map((insp) => (
              <li key={insp.id}>
                <Link
                  href={`/checklists/inspecciones/${insp.id}`}
                  className="flex items-center justify-between px-5 py-4 hover:bg-slate-50 group"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-slate-900 group-hover:text-brand-secondary">
                      {insp.equipos?.nombre || "Equipo"} · {insp.plantilla_titulo}
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {new Date(insp.fecha).toLocaleString("es-AR")}
                      {typeof insp.acciones_pendientes === "number"
                        ? ` · ${insp.acciones_pendientes} acciones pend.`
                        : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span
                      className={`text-xs font-bold px-2.5 py-1 rounded-md border capitalize ${
                        insp.resultado === "aprobada"
                          ? "bg-emerald-50 text-emerald-700 border-emerald-100"
                          : insp.resultado === "observada"
                            ? "bg-amber-50 text-amber-800 border-amber-200"
                            : "bg-rose-50 text-rose-700 border-rose-100"
                      }`}
                    >
                      {insp.resultado}
                    </span>
                    <ChevronRight className="h-4 w-4 text-slate-300" />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
