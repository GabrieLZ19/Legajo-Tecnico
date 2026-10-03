"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  BookOpen,
  Building2,
  ChevronRight,
  FileStack,
  Loader,
  Plus,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { canPublishToBibliotecaLt, canWriteAppModule } from "@/lib/moduleAccess";
import { checklistsService } from "@/utils/services/checklists.service";

export default function PlantillasChecklistPage() {
  const { user, empresa } = useAuth();
  const canWrite = canWriteAppModule(user, "checklists");

  const { data: empresaPlantillas = [], isLoading: loadingEmpresa } = useQuery({
    queryKey: ["checklist-plantillas-empresa", empresa?.id],
    queryFn: () =>
      checklistsService.listarPlantillas({
        ambito: "empresa",
        empresaId: empresa!.id,
      }),
    enabled: !!empresa?.id,
  });

  const { data: ltPlantillas = [], isLoading: loadingLt } = useQuery({
    queryKey: ["checklist-plantillas-lt"],
    queryFn: () => checklistsService.listarPlantillas({ ambito: "global" }),
  });

  const loading = loadingEmpresa || loadingLt;

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
            Plantillas de checklist
          </h1>
          <p className="text-sm text-brand-text-muted mt-1">
            Constructor por tipo de equipo (ítems y criticidad). Reutilizá desde
            la biblioteca de la empresa o LT.
          </p>
        </div>
        {canWrite && (
          <Link
            href="/checklists/plantillas/nueva"
            className="inline-flex items-center justify-center gap-2 bg-brand-primary hover:bg-brand-primary/95 text-white font-bold px-5 py-3 rounded-xl shadow-md text-sm cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            Nueva plantilla
          </Link>
        )}
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <div
              key={i}
              className="h-32 bg-white border border-slate-200 rounded-2xl animate-pulse"
            />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <PlantillaSection
            title="Biblioteca de la empresa"
            icon={Building2}
            empty="No hay plantillas de empresa."
            items={empresaPlantillas}
          />
          <PlantillaSection
            title="Biblioteca Legajo Técnico"
            icon={BookOpen}
            empty="No hay plantillas aprobadas en LT."
            items={ltPlantillas}
            hint={
              canPublishToBibliotecaLt(user)
                ? "Al crear podés enviar plantillas a aprobación CRM."
                : "Solo plantillas aprobadas por la consultora."
            }
          />
        </div>
      )}
    </div>
  );
}

function PlantillaSection({
  title,
  icon: Icon,
  empty,
  items,
  hint,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  empty: string;
  items: Array<{
    id: string;
    titulo: string;
    tipo_equipo: string;
    total_items?: number;
    estado_publicacion?: string | null;
  }>;
  hint?: string;
}) {
  return (
    <section className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-2xs">
      <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/60">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-brand-primary" />
          <h2 className="font-bold text-slate-900">{title}</h2>
        </div>
        {hint && <p className="text-xs text-slate-500 mt-1">{hint}</p>}
      </div>
      {items.length === 0 ? (
        <div className="px-5 py-10 text-center">
          <FileStack className="h-8 w-8 text-slate-300 mx-auto mb-2" />
          <p className="text-sm text-slate-500 font-semibold">{empty}</p>
        </div>
      ) : (
        <ul className="divide-y divide-slate-50">
          {items.map((p) => (
            <li key={p.id}>
              <Link
                href={`/checklists/plantillas/${p.id}`}
                className="flex items-center justify-between px-5 py-3.5 hover:bg-slate-50 group"
              >
                <div>
                  <p className="text-sm font-bold text-slate-900 group-hover:text-brand-secondary">
                    {p.titulo}
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {p.tipo_equipo} · {p.total_items ?? 0} ítems
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {p.estado_publicacion && (
                    <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-md border border-slate-200 text-slate-600">
                      {p.estado_publicacion}
                    </span>
                  )}
                  <ChevronRight className="h-4 w-4 text-slate-300" />
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
