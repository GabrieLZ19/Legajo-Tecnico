"use client";

import { useCallback, useEffect, useState } from "react";
import {
  HardHat,
  Download,
  FileText,
  CheckCircle2,
  Search,
  X,
  QrCode,
  Trash2,
} from "lucide-react";
import type { EppEntrega, Perfil } from "@/types";
import { VisibleEnteToggle } from "@/components/VisibleEnteToggle";
import { PaginationBar } from "@/components/PaginationBar";
import { useEpp } from "@/hooks/useEpp";
import { useAlert } from "@/context/AlertContext";

const PAGE_SIZE = 10;

type EntregasTabProps = {
  empresaId: string;
  user: Perfil | null;
  canEdit: boolean;
  downloadingId: string | null;
  onDownloadPdf: (id: string, dni: string) => void;
  onVisibilidadChange: (id: string, visible: boolean) => Promise<void> | void;
};

const formatLocalDate = (dateStr: string | Date | null | undefined): string => {
  if (!dateStr) return "";
  const isoStr =
    typeof dateStr === "string" ? dateStr : new Date(dateStr).toISOString();
  const datePart = isoStr.split("T")[0];
  const parts = datePart.split("-");
  if (parts.length === 3) {
    const [year, month, day] = parts;
    return `${parseInt(day, 10)}/${parseInt(month, 10)}/${year}`;
  }
  return new Date(dateStr).toLocaleDateString("es-AR");
};

function OrigenBadge({ origen }: { origen?: "panel" | "qr_publico" }) {
  if (origen === "qr_publico") {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-blue-700 bg-blue-50 border border-blue-100 rounded-md px-1.5 py-0.5 whitespace-nowrap">
        <QrCode className="h-3 w-3" />
        QR
      </span>
    );
  }
  return (
    <span className="inline-flex items-center text-[10px] font-bold uppercase tracking-wide text-slate-500 bg-slate-50 border border-slate-100 rounded-md px-1.5 py-0.5 whitespace-nowrap">
      Panel
    </span>
  );
}

export function EntregasTab({
  empresaId,
  user,
  canEdit,
  downloadingId,
  onDownloadPdf,
  onVisibilidadChange,
}: EntregasTabProps) {
  const { getEntregas, eliminarEntregaEpp } = useEpp();
  const { showAlert, showConfirm } = useAlert();
  const [entregas, setEntregas] = useState<EppEntrega[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [page, setPage] = useState(0);

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedQ(busqueda.trim()), 300);
    return () => window.clearTimeout(t);
  }, [busqueda]);

  useEffect(() => {
    setPage(0);
  }, [debouncedQ]);

  const fetchEntregas = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getEntregas(empresaId, {
        limit: PAGE_SIZE,
        offset: page * PAGE_SIZE,
        q: debouncedQ || undefined,
      });
      setEntregas(data.entregas || []);
      setTotal(data.total ?? 0);
    } catch (err) {
      console.error("Error cargando entregas:", err);
      setEntregas([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [empresaId, getEntregas, page, debouncedQ]);

  useEffect(() => {
    void fetchEntregas();
  }, [fetchEntregas]);

  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    if (page > totalPages - 1) setPage(Math.max(0, totalPages - 1));
  }, [total, page]);

  const handleVisibilidad = async (id: string, visible: boolean) => {
    await onVisibilidadChange(id, visible);
    setEntregas((prev) =>
      prev.map((e) =>
        e.id === id ? { ...e, visible_ente_regulador: visible } : e,
      ),
    );
  };

  const handleEliminar = async (entrega: EppEntrega) => {
    const eppNombre = entrega.epp_tipos?.nombre || "EPP";
    const ok = await showConfirm(
      "Eliminar entrega",
      `¿Eliminar la constancia de ${entrega.nombre_empleado} (${eppNombre})? Esta acción no se puede deshacer.`,
      {
        type: "error",
        confirmLabel: "Eliminar",
        cancelLabel: "Cancelar",
      },
    );
    if (!ok) return;

    const prevEntregas = entregas;
    const prevTotal = total;
    setEntregas((prev) => prev.filter((e) => e.id !== entrega.id));
    setTotal((t) => Math.max(0, t - 1));
    setDeletingId(entrega.id);

    try {
      await eliminarEntregaEpp(entrega.id);
      showAlert("success", "Entrega eliminada", "La constancia ya no figura en el listado.");
    } catch {
      setEntregas(prevEntregas);
      setTotal(prevTotal);
      showAlert("error", "Error", "No se pudo eliminar la entrega.");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-base font-black text-slate-800 tracking-tight">
            Constancias de entrega
          </h2>
          <p className="mt-1 text-xs font-medium text-slate-500 leading-relaxed">
            Registro oficial Res. SRT 299/11.
            {!loading && total > 0
              ? ` ${total} entrega${total === 1 ? "" : "s"}.`
              : ""}
          </p>
        </div>
      </div>

      {!loading && (total > 0 || debouncedQ) && (
        <div className="relative">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar trabajador, DNI, EPP…"
            className="w-full min-h-11 pl-10 pr-10 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium focus:outline-hidden focus:ring-2 focus:ring-blue-500/25 focus:border-blue-500"
          />
          {busqueda && (
            <button
              type="button"
              onClick={() => setBusqueda("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-slate-600 cursor-pointer"
              aria-label="Limpiar búsqueda"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      )}

      <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-100 overflow-hidden shadow-xs">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-14">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-600" />
            <p className="text-xs text-slate-400 mt-3 font-semibold">
              Cargando constancias…
            </p>
          </div>
        ) : total === 0 && !debouncedQ ? (
          <div className="px-5 py-12 text-center">
            <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-50">
              <FileText className="h-5 w-5 text-slate-400" />
            </div>
            <h3 className="text-sm font-bold text-slate-800">Sin entregas registradas</h3>
            <p className="mt-1 text-xs font-medium text-slate-400 max-w-sm mx-auto leading-relaxed">
              Registrá desde el panel o generá el QR de punto de entrega.
            </p>
          </div>
        ) : entregas.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm font-semibold text-slate-400">
            Ninguna entrega coincide con “{busqueda}”.
          </p>
        ) : (
          <>
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full min-w-[720px] text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/90 text-[10px] font-black uppercase tracking-wider text-slate-400">
                    <th className="px-4 py-3 font-black w-[28%]">Trabajador</th>
                    <th className="px-3 py-3 font-black w-[32%]">EPP</th>
                    <th className="px-3 py-3 font-black w-[12%]">Fecha</th>
                    <th className="px-3 py-3 font-black w-[10%]">Origen</th>
                    <th className="px-4 py-3 font-black text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {entregas.map((e) => {
                    const foto =
                      e.epp_tipos?.foto_url || e.foto_evidencia_url || null;
                    return (
                      <tr key={e.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="px-4 py-3 align-middle">
                          <div className="min-w-0">
                            <p className="text-sm font-bold text-slate-800 truncate">
                              {e.nombre_empleado}
                            </p>
                            <p className="text-[11px] font-semibold text-slate-400 tabular-nums">
                              DNI {e.dni_empleado}
                            </p>
                          </div>
                        </td>
                        <td className="px-3 py-3 align-middle">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="h-9 w-9 rounded-lg bg-slate-100 overflow-hidden flex items-center justify-center shrink-0 border border-slate-100">
                              {foto ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={foto}
                                  alt=""
                                  className="h-full w-full object-cover"
                                  onError={(event) => {
                                    event.currentTarget.style.display = "none";
                                  }}
                                />
                              ) : (
                                <HardHat className="h-4 w-4 text-slate-400" />
                              )}
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-slate-700 truncate">
                                {e.epp_tipos?.nombre || "EPP"}
                                {e.cantidad > 1 ? (
                                  <span className="text-slate-400 font-bold">
                                    {" "}
                                    ×{e.cantidad}
                                  </span>
                                ) : null}
                              </p>
                              <p className="text-[11px] font-medium text-slate-400 truncate">
                                {[e.marca, e.modelo].filter(Boolean).join(" · ") ||
                                  e.certificacion ||
                                  "—"}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-3 align-middle">
                          <span className="text-xs font-bold text-slate-600 tabular-nums whitespace-nowrap">
                            {formatLocalDate(e.fecha_entrega)}
                          </span>
                        </td>
                        <td className="px-3 py-3 align-middle">
                          <OrigenBadge origen={e.origen} />
                        </td>
                        <td className="px-4 py-3 align-middle">
                          <div className="flex items-center justify-end gap-3">
                            {user?.rol === "ente_regulador" ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                                <CheckCircle2 className="h-3 w-3" />
                                OK
                              </span>
                            ) : (
                              <VisibleEnteToggle
                                checked={Boolean(e.visible_ente_regulador)}
                                disabled={!canEdit}
                                onChange={(v) => void handleVisibilidad(e.id, v)}
                                label="Visible ente"
                                compact={false}
                              />
                            )}
                            <button
                              type="button"
                              onClick={() => onDownloadPdf(e.id, e.dni_empleado)}
                              disabled={downloadingId === e.id || deletingId === e.id}
                              className="inline-flex items-center justify-center gap-1.5 shrink-0 min-h-9 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-lg cursor-pointer disabled:opacity-50"
                              title="Descargar PDF SRT 299/11"
                            >
                              <Download className="h-3.5 w-3.5" />
                              {downloadingId === e.id ? "…" : "PDF"}
                            </button>
                            {canEdit && (
                              <button
                                type="button"
                                onClick={() => void handleEliminar(e)}
                                disabled={deletingId === e.id || downloadingId === e.id}
                                className="inline-flex items-center justify-center shrink-0 min-h-9 min-w-9 px-2 py-1.5 bg-white border border-rose-200 text-rose-600 hover:bg-rose-50 text-xs font-bold rounded-lg cursor-pointer disabled:opacity-50"
                                title="Eliminar entrega"
                                aria-label="Eliminar entrega"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <ul className="md:hidden divide-y divide-slate-100">
              {entregas.map((e) => {
                const foto =
                  e.epp_tipos?.foto_url || e.foto_evidencia_url || null;
                return (
                  <li key={e.id} className="px-3.5 py-3.5 space-y-3">
                    <div className="flex items-start gap-3">
                      <div className="h-12 w-12 rounded-xl bg-slate-100 overflow-hidden flex items-center justify-center shrink-0 border border-slate-100">
                        {foto ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={foto}
                            alt=""
                            className="h-full w-full object-cover"
                            onError={(event) => {
                              event.currentTarget.style.display = "none";
                            }}
                          />
                        ) : (
                          <HardHat className="h-5 w-5 text-slate-400" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-sm font-bold text-slate-800 truncate">
                              {e.nombre_empleado}
                            </p>
                            <p className="text-[11px] font-semibold text-slate-400 tabular-nums">
                              DNI {e.dni_empleado}
                            </p>
                          </div>
                          <OrigenBadge origen={e.origen} />
                        </div>
                        <p className="mt-1.5 text-xs font-semibold text-slate-700 line-clamp-2">
                          {e.epp_tipos?.nombre || "EPP"}
                          {e.cantidad > 1 ? ` ×${e.cantidad}` : ""}
                        </p>
                        <p className="text-[11px] font-medium text-slate-400 truncate">
                          {[e.marca, e.modelo].filter(Boolean).join(" · ") ||
                            e.certificacion ||
                            "Sin marca / modelo"}
                          {" · "}
                          {formatLocalDate(e.fecha_entrega)}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-3 pt-0.5">
                      {user?.rol === "ente_regulador" ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-1 rounded-full">
                          <CheckCircle2 className="h-3 w-3" />
                          Auditoría
                        </span>
                      ) : (
                        <VisibleEnteToggle
                          checked={Boolean(e.visible_ente_regulador)}
                          disabled={!canEdit}
                          onChange={(v) => void handleVisibilidad(e.id, v)}
                          label="Visible ente"
                        />
                      )}
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => onDownloadPdf(e.id, e.dni_empleado)}
                          disabled={downloadingId === e.id || deletingId === e.id}
                          className="inline-flex items-center justify-center gap-1.5 shrink-0 min-h-10 px-4 py-2 bg-slate-900 text-white text-xs font-bold rounded-xl cursor-pointer disabled:opacity-50"
                        >
                          <Download className="h-3.5 w-3.5" />
                          {downloadingId === e.id ? "…" : "PDF"}
                        </button>
                        {canEdit && (
                          <button
                            type="button"
                            onClick={() => void handleEliminar(e)}
                            disabled={deletingId === e.id || downloadingId === e.id}
                            className="inline-flex items-center justify-center shrink-0 min-h-10 min-w-10 px-2.5 py-2 bg-white border border-rose-200 text-rose-600 rounded-xl cursor-pointer disabled:opacity-50"
                            title="Eliminar entrega"
                            aria-label="Eliminar entrega"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>

            <div className="p-3 border-t border-slate-100">
              <PaginationBar
                page={page}
                pageSize={PAGE_SIZE}
                total={total}
                onPageChange={setPage}
                disabled={loading}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
