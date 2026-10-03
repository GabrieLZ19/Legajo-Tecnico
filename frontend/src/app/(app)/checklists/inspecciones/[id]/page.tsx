"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Loader } from "lucide-react";
import { checklistsService } from "@/utils/services/checklists.service";
import { useAlert } from "@/context/AlertContext";
import { canWriteAppModule } from "@/lib/moduleAccess";
import { useAuth } from "@/hooks/useAuth";

export default function InspeccionDetallePage() {
  const params = useParams();
  const id = params.id as string;
  const { user } = useAuth();
  const { showAlert } = useAlert();
  const queryClient = useQueryClient();
  const canWrite = canWriteAppModule(user, "checklists");

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["checklist-inspeccion", id],
    queryFn: () => checklistsService.obtenerInspeccion(id),
    enabled: !!id,
  });

  const updateAccion = async (
    accionId: string,
    estado: "pendiente" | "en_curso" | "cumplida",
  ) => {
    try {
      await checklistsService.actualizarAccion(accionId, estado);
      await refetch();
      await queryClient.invalidateQueries({
        queryKey: ["checklists-inspecciones"],
      });
    } catch (err: unknown) {
      showAlert(
        "error",
        "Error",
        err instanceof Error ? err.message : "No se pudo actualizar",
      );
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-20 text-slate-400">
        <Loader className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (!data) {
    return (
      <p className="text-center py-16 text-slate-500">
        Inspección no encontrada.
      </p>
    );
  }

  const items = data.items || data.inspeccion_items || [];
  const acciones = data.acciones || data.inspeccion_acciones || [];

  return (
    <div className="w-full space-y-6">
      <Link
        href="/checklists/inspecciones"
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-brand-primary"
      >
        <ArrowLeft className="h-4 w-4" />
        Inspecciones
      </Link>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-2xs">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tight">
              {data.plantilla_titulo}
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              {data.equipos?.nombre || "Equipo"} ·{" "}
              {new Date(data.fecha).toLocaleString("es-AR")}
            </p>
            {data.inspector_nombre && (
              <p className="text-sm text-slate-500">
                Inspector: {data.inspector_nombre}
              </p>
            )}
          </div>
          <span className="text-xs font-bold uppercase px-2.5 py-1 rounded-md border border-slate-200 text-slate-700 capitalize">
            {data.resultado}
          </span>
        </div>
        {data.observaciones && (
          <p className="mt-4 text-sm text-slate-600 whitespace-pre-wrap border-t border-slate-100 pt-4">
            {data.observaciones}
          </p>
        )}
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 font-semibold">
          Ítems
        </div>
        <ul className="divide-y divide-slate-50">
          {items.map((item) => (
            <li
              key={item.id}
              className="px-5 py-3 flex items-center justify-between gap-3"
            >
              <div>
                <p className="text-sm text-slate-800">{item.texto}</p>
                <p className="text-[10px] uppercase font-bold text-slate-400">
                  {item.criticidad}
                </p>
              </div>
              <span className="text-xs font-bold capitalize">{item.calificacion}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 font-semibold">
          Plan de acción
        </div>
        {acciones.length === 0 ? (
          <p className="px-5 py-8 text-sm text-slate-500 text-center">
            Sin acciones asociadas.
          </p>
        ) : (
          <ul className="divide-y divide-slate-50">
            {acciones.map((a) => (
              <li key={a.id} className="px-5 py-3 space-y-2">
                <p className="text-sm text-slate-800">{a.descripcion}</p>
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs text-slate-500">
                    {a.responsable || "Sin responsable"}
                    {a.fecha_vencimiento
                      ? ` · vence ${new Date(a.fecha_vencimiento + "T12:00:00").toLocaleDateString("es-AR")}`
                      : ""}
                  </p>
                  {canWrite ? (
                    <select
                      value={a.estado}
                      onChange={(e) =>
                        void updateAccion(
                          a.id,
                          e.target.value as
                            | "pendiente"
                            | "en_curso"
                            | "cumplida",
                        )
                      }
                      className="text-xs rounded-lg border border-slate-200 px-2 py-1"
                    >
                      <option value="pendiente">Pendiente</option>
                      <option value="en_curso">En curso</option>
                      <option value="cumplida">Cumplida</option>
                    </select>
                  ) : (
                    <span className="text-xs font-bold capitalize text-slate-600">
                      {a.estado}
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
