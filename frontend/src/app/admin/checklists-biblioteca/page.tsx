"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ClipboardCheck, Loader } from "lucide-react";
import { useAlert } from "@/context/AlertContext";
import { checklistsService } from "@/utils/services/checklists.service";

export default function AdminChecklistsBibliotecaPage() {
  const { showAlert, showConfirm } = useAlert();
  const queryClient = useQueryClient();
  const [filtro, setFiltro] = useState<"todas" | "pendiente" | "aprobada" | "rechazada">(
    "pendiente",
  );

  const { data: plantillas = [], isLoading } = useQuery({
    queryKey: ["admin-checklist-plantillas", filtro],
    queryFn: () =>
      checklistsService.listarPlantillas({
        ambito: "global",
        estado: filtro,
      }),
  });

  const aprobar = async (id: string, titulo: string) => {
    const ok = await showConfirm(
      "Aprobar plantilla",
      `¿Aprobar «${titulo}» para la biblioteca LT?`,
      { type: "warning", confirmLabel: "Aprobar", cancelLabel: "Cancelar" },
    );
    if (!ok) return;
    try {
      await checklistsService.actualizarPublicacion(id, { estado: "aprobada" });
      await queryClient.invalidateQueries({
        queryKey: ["admin-checklist-plantillas"],
      });
      showAlert("success", "Aprobada", "La plantilla ya está disponible.");
    } catch (err: unknown) {
      showAlert(
        "error",
        "Error",
        err instanceof Error ? err.message : "No se pudo aprobar",
      );
    }
  };

  const rechazar = async (id: string, titulo: string) => {
    const ok = await showConfirm(
      "Rechazar plantilla",
      `¿Rechazar «${titulo}»?`,
      { type: "error", confirmLabel: "Rechazar", cancelLabel: "Cancelar" },
    );
    if (!ok) return;
    try {
      await checklistsService.actualizarPublicacion(id, {
        estado: "rechazada",
        rechazo_motivo: "Rechazada desde CRM",
      });
      await queryClient.invalidateQueries({
        queryKey: ["admin-checklist-plantillas"],
      });
      showAlert("success", "Rechazada", "La plantilla fue rechazada.");
    } catch (err: unknown) {
      showAlert(
        "error",
        "Error",
        err instanceof Error ? err.message : "No se pudo rechazar",
      );
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <ClipboardCheck className="h-6 w-6 text-blue-600" />
            Biblioteca Checklists LT
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Aprobación de plantillas enviadas por preventores
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {(["pendiente", "aprobada", "rechazada", "todas"] as const).map(
            (f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFiltro(f)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold capitalize border ${
                  filtro === f
                    ? "bg-blue-600 text-white border-blue-600"
                    : "bg-white text-slate-600 border-slate-200"
                }`}
              >
                {f}
              </button>
            ),
          )}
        </div>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
        {isLoading ? (
          <div className="flex justify-center py-16 text-slate-400">
            <Loader className="h-6 w-6 animate-spin" />
          </div>
        ) : plantillas.length === 0 ? (
          <p className="px-5 py-10 text-sm text-slate-500 text-center">
            No hay plantillas en este filtro.
          </p>
        ) : (
          <ul className="divide-y divide-slate-50">
            {plantillas.map((p) => (
              <li
                key={p.id}
                className="px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div>
                  <Link
                    href={`/admin/checklists-biblioteca/${p.id}`}
                    className="text-sm font-semibold text-slate-900 hover:text-blue-600"
                  >
                    {p.titulo}
                  </Link>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {p.tipo_equipo} · {p.total_items ?? 0} ítems
                    {p.autor_nombre ? ` · ${p.autor_nombre}` : ""} ·{" "}
                    {p.estado_publicacion}
                  </p>
                </div>
                {p.estado_publicacion === "pendiente" && (
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => void aprobar(p.id, p.titulo)}
                      className="px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-600 text-white"
                    >
                      Aprobar
                    </button>
                    <button
                      type="button"
                      onClick={() => void rechazar(p.id, p.titulo)}
                      className="px-3 py-1.5 rounded-lg text-xs font-bold bg-red-600 text-white"
                    >
                      Rechazar
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
