"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Loader } from "lucide-react";
import { checklistsService } from "@/utils/services/checklists.service";

export default function PlantillaDetallePage() {
  const params = useParams();
  const id = params.id as string;

  const { data, isLoading } = useQuery({
    queryKey: ["checklist-plantilla", id],
    queryFn: () => checklistsService.obtenerPlantilla(id),
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
      <p className="text-center py-16 text-slate-500">Plantilla no encontrada.</p>
    );
  }

  const items = data.items || data.checklist_plantilla_items || [];

  return (
    <div className="w-full space-y-6">
      <Link
        href="/checklists/plantillas"
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-brand-primary"
      >
        <ArrowLeft className="h-4 w-4" />
        Plantillas
      </Link>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-2xs">
        <h1 className="text-3xl font-black text-slate-900 tracking-tight">
          {data.titulo}
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Tipo: {data.tipo_equipo} · Ámbito: {data.ambito}
          {data.estado_publicacion
            ? ` · ${data.estado_publicacion}`
            : ""}
        </p>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 font-semibold text-slate-900">
          Ítems ({items.length})
        </div>
        <ul className="divide-y divide-slate-50">
          {items.map((item, idx) => (
            <li
              key={item.id || idx}
              className="px-5 py-3 flex items-center justify-between gap-3"
            >
              <span className="text-sm text-slate-800">
                {idx + 1}. {item.texto}
              </span>
              <span className="text-xs font-bold uppercase text-slate-500">
                {item.criticidad}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
