"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Copy,
  FileText,
  Layers,
  MessageCircle,
  Plus,
  Send,
  Trophy,
  Users,
  Pencil,
  Trash2,
  X,
  UserRound,
} from "lucide-react";
import type { EppCotizacion, EppLicitacion, EppProveedor } from "@/types";
import { useEpp } from "@/hooks/useEpp";
import { useAlert } from "@/context/AlertContext";
import { validateProveedorFicha } from "@/lib/proveedorValidation";
import {
  emptyProveedorFicha,
  ProveedorFichaFields,
  type ProveedorFichaForm,
} from "./ProveedorFichaFields";

type LicitacionesTabProps = {
  licitaciones: EppLicitacion[];
  proveedores: EppProveedor[];
  canEdit: boolean;
  onChanged: () => Promise<void>;
};

function money(value: number | null | undefined): string {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(Number(value ?? 0));
}

function formatLicNumero(numero: number | null | undefined): string | null {
  if (numero == null || Number.isNaN(Number(numero))) return null;
  return `LIC-${String(numero).padStart(4, "0")}`;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

function estadoMeta(estado: string) {
  if (estado === "adjudicacion") {
    return {
      label: "Adjudicación",
      text: "text-amber-800",
      mark: "bg-amber-500",
      chip: "bg-amber-100 text-amber-900",
      row: "bg-amber-50/40 hover:bg-amber-50/70",
      table: "bg-amber-50/50 border-amber-100",
    };
  }
  if (estado === "cerrada") {
    return {
      label: "Cerrada",
      text: "text-slate-600",
      mark: "bg-slate-400",
      chip: "bg-slate-200/80 text-slate-700",
      row: "bg-slate-50/80 hover:bg-slate-100/70",
      table: "bg-slate-50 border-slate-200",
    };
  }
  return {
    label: "Abierta",
    text: "text-teal-800",
    mark: "bg-teal-500",
    chip: "bg-teal-100 text-teal-900",
    row: "bg-teal-50/30 hover:bg-teal-50/55",
    table: "bg-white border-teal-100",
  };
}

function shareLinks(lic: EppLicitacion, cot: EppCotizacion) {
  const compradorLineas = [
    lic.comprador_nombre ? `Comprador: ${lic.comprador_nombre}` : null,
    lic.comprador_email ? `Mail: ${lic.comprador_email}` : null,
    lic.comprador_telefono ? `Tel: ${lic.comprador_telefono}` : null,
  ]
    .filter(Boolean)
    .join("\n");
  const mailto = `mailto:${cot.proveedor_email ?? ""}?subject=${encodeURIComponent(
    `Cotización EPP: ${lic.titulo}`,
  )}&body=${encodeURIComponent(
    `Hola ${cot.proveedor_nombre},\n\n${
      compradorLineas ? `${compradorLineas}\n\n` : ""
    }Cargá tu cotización en: ${cot.url_carga ?? ""}`,
  )}`;
  const wa = `https://wa.me/?text=${encodeURIComponent(
    `Cotización EPP ${lic.titulo}${
      lic.comprador_nombre ? ` (comprador: ${lic.comprador_nombre})` : ""
    }: ${cot.url_carga ?? ""}`,
  )}`;
  return { mailto, wa };
}

export function LicitacionesTab({
  licitaciones,
  proveedores,
  canEdit,
  onChanged,
}: LicitacionesTabProps) {
  const { crearProveedor, actualizarProveedor, eliminarProveedor } = useEpp();
  const { showAlert, showConfirm } = useAlert();
  const [showGestion, setShowGestion] = useState(false);
  const [fichaId, setFichaId] = useState<string | null>(null);
  const [ficha, setFicha] = useState<ProveedorFichaForm>(emptyProveedorFicha());
  const [savingFicha, setSavingFicha] = useState(false);

  const activos = useMemo(() => proveedores.filter((p) => p.activo), [proveedores]);
  const fichaAbierta = fichaId !== null;
  const esAltaFicha = fichaId === "nuevo";

  const stats = useMemo(() => {
    const abiertas = licitaciones.filter((l) => l.estado === "abierta").length;
    const adjudicacion = licitaciones.filter((l) => l.estado === "adjudicacion").length;
    const cerradas = licitaciones.filter((l) => l.estado === "cerrada").length;
    const cotizaciones = licitaciones.reduce(
      (acc, l) => acc + (l.epp_licitacion_cotizaciones?.length ?? 0),
      0,
    );
    return { abiertas, adjudicacion, cerradas, cotizaciones };
  }, [licitaciones]);

  useEffect(() => {
    if (!fichaId || fichaId === "nuevo") return;
    const prov = proveedores.find((p) => p.id === fichaId);
    if (!prov) return;
    setFicha({
      nombre: prov.nombre,
      email: prov.email,
      direccion: prov.direccion || "",
      telefono: prov.telefono || "",
    });
  }, [fichaId, proveedores]);

  const openNuevaFicha = () => {
    setFicha(emptyProveedorFicha());
    setFichaId("nuevo");
  };

  const openFicha = (prov: EppProveedor) => {
    setFicha({
      nombre: prov.nombre,
      email: prov.email,
      direccion: prov.direccion || "",
      telefono: prov.telefono || "",
    });
    setFichaId(prov.id);
  };

  const closeFicha = () => {
    setFichaId(null);
    setFicha(emptyProveedorFicha());
  };

  const handleSaveFicha = async (e: React.FormEvent) => {
    e.preventDefault();
    const validationError = validateProveedorFicha(ficha);
    if (validationError) {
      showAlert("warning", "Datos inválidos", validationError);
      return;
    }
    setSavingFicha(true);
    try {
      if (esAltaFicha) {
        await crearProveedor({
          nombre: ficha.nombre.trim(),
          email: ficha.email.trim(),
          direccion: ficha.direccion.trim() || undefined,
          telefono: ficha.telefono.trim() || undefined,
        });
        await onChanged();
        closeFicha();
        showAlert("success", "Proveedor creado", "Ya figura en el listado.");
      } else if (fichaId) {
        await actualizarProveedor(fichaId, {
          nombre: ficha.nombre.trim(),
          email: ficha.email.trim(),
          direccion: ficha.direccion.trim() || null,
          telefono: ficha.telefono.trim() || null,
        });
        await onChanged();
        showAlert("success", "Ficha actualizada", "Los datos del proveedor se guardaron.");
      }
    } catch {
      showAlert("error", "Error", "No se pudo guardar la ficha del proveedor.");
    } finally {
      setSavingFicha(false);
    }
  };

  const handleEliminarProveedor = async () => {
    if (!fichaId || esAltaFicha) return;
    const ok = await showConfirm(
      "Eliminar proveedor",
      `¿Eliminar a ${ficha.nombre || "este proveedor"}? Dejará de aparecer en nuevas licitaciones.`,
      {
        type: "error",
        confirmLabel: "Eliminar",
        cancelLabel: "Cancelar",
      },
    );
    if (!ok) return;

    setSavingFicha(true);
    try {
      await eliminarProveedor(fichaId);
      closeFicha();
      await onChanged();
      showAlert("success", "Proveedor eliminado", "Ya no figura en el listado activo.");
    } catch {
      showAlert("error", "Error", "No se pudo eliminar el proveedor.");
    } finally {
      setSavingFicha(false);
    }
  };

  const copyLink = async (url: string) => {
    await navigator.clipboard.writeText(url);
    showAlert("success", "Enlace copiado", "Pegalo en el mail o WhatsApp del proveedor.");
  };

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-teal-200/70 bg-gradient-to-r from-teal-50 via-white to-amber-50/60 px-4 sm:px-5 py-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-2xl font-black tracking-tight text-slate-900">
              Licitaciones
            </h2>
            <div className="mt-2 flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-md bg-teal-100 px-2 py-1 text-[11px] font-bold text-teal-800">
                <span className="h-1.5 w-1.5 rounded-full bg-teal-500" />
                {stats.abiertas} abiertas
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-md bg-amber-100 px-2 py-1 text-[11px] font-bold text-amber-900">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                {stats.adjudicacion} adjudicación
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-md bg-slate-200/80 px-2 py-1 text-[11px] font-bold text-slate-700">
                <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
                {stats.cerradas} cerradas
              </span>
              <span className="inline-flex items-center rounded-md bg-white/80 px-2 py-1 text-[11px] font-bold text-slate-600 ring-1 ring-slate-200">
                {activos.length} proveedores
              </span>
            </div>
          </div>
          {canEdit && (
            <div className="flex flex-col sm:flex-row gap-2 shrink-0">
              <button
                type="button"
                onClick={() => {
                  setShowGestion(true);
                  closeFicha();
                }}
                className="inline-flex items-center justify-center gap-2 min-h-11 px-4 py-2.5 rounded-lg border border-teal-200 bg-white hover:bg-teal-50 text-teal-900 text-sm font-bold cursor-pointer"
              >
                <Users className="h-4 w-4" />
                Proveedores
              </button>
              <Link
                href="/epp/nueva-licitacion"
                className="inline-flex items-center justify-center gap-2 min-h-11 px-4 py-2.5 rounded-lg bg-teal-700 hover:bg-teal-600 text-white text-sm font-bold shadow-sm shadow-teal-700/20"
              >
                <Plus className="h-4 w-4" />
                Nueva licitación
              </Link>
            </div>
          )}
        </div>
      </div>

      {licitaciones.length === 0 ? (
        <div className="bg-gradient-to-b from-teal-50/80 to-white rounded-2xl border border-teal-100 px-6 py-14 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-teal-100 text-teal-700">
            <Layers className="h-6 w-6" />
          </div>
          <h3 className="text-base font-bold text-slate-800">Sin licitaciones aún</h3>
          <p className="text-sm text-slate-500 mt-2 max-w-md mx-auto">
            Armá el pedido, invitá proveedores y seguí cada cotización hasta la
            adjudicación.
          </p>
          {canEdit && (
            <Link
              href="/epp/nueva-licitacion"
              className="inline-flex items-center justify-center gap-2 mt-6 min-h-11 px-5 py-2.5 bg-teal-700 hover:bg-teal-600 text-white text-sm font-bold rounded-lg"
            >
              <Plus className="h-4 w-4" />
              Crear primera licitación
            </Link>
          )}
        </div>
      ) : (
        <div className="rounded-2xl border border-slate-200 overflow-hidden divide-y divide-slate-200/80 shadow-sm shadow-slate-200/40">
          {licitaciones.map((lic) => {
            const meta = estadoMeta(lic.estado);
            const cots = lic.epp_licitacion_cotizaciones ?? [];
            const cargadas = cots.filter((c) => c.estado === "cargada").length;
            const ganador = cots.find((c) => c.id === lic.ganador_cotizacion_id);
            const codigo = formatLicNumero(lic.numero);
            const detalleHref = `/epp/licitaciones/${lic.id}`;

            return (
              <article key={lic.id} className={`transition-colors ${meta.row}`}>
                <div className="px-4 sm:px-5 py-4 sm:py-5">
                  <div className="flex flex-col lg:flex-row lg:items-start gap-4">
                    <div className="hidden sm:flex w-16 shrink-0 pt-1">
                      <span
                        className={`text-xs font-black tabular-nums tracking-wide ${meta.text}`}
                      >
                        {codigo ?? "—"}
                      </span>
                    </div>

                    <div className="min-w-0 flex-1 space-y-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="sm:hidden text-[11px] font-black tabular-nums text-slate-500">
                          {codigo}
                        </span>
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-bold uppercase tracking-[0.12em] ${meta.chip}`}
                        >
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${meta.mark}`}
                            aria-hidden
                          />
                          {meta.label}
                        </span>
                        {ganador && (
                          <span className="inline-flex items-center gap-1 rounded-md bg-emerald-100 px-2 py-1 text-[11px] font-bold text-emerald-800">
                            <Trophy className="h-3 w-3" />
                            Adjudicado: {ganador.proveedor_nombre}
                          </span>
                        )}
                      </div>

                      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                        <div className="min-w-0">
                          <Link
                            href={detalleHref}
                            className="text-lg font-bold text-slate-900 leading-snug hover:text-teal-800 hover:underline decoration-teal-300 underline-offset-2"
                          >
                            {lic.titulo}
                          </Link>
                          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-600">
                            {lic.comprador_nombre && (
                              <span className="inline-flex items-center gap-1.5 font-medium">
                                <UserRound className="h-3.5 w-3.5 text-teal-600/70" />
                                {lic.comprador_nombre}
                                {lic.comprador_telefono
                                  ? ` · ${lic.comprador_telefono}`
                                  : ""}
                              </span>
                            )}
                            <span className="text-xs font-semibold text-slate-500">
                              {cargadas}/{cots.length || 0} cotizaciones
                              {(lic.epp_licitacion_items?.length ?? 0) > 0
                                ? ` · ${lic.epp_licitacion_items!.length} ítems`
                                : ""}
                            </span>
                          </div>
                        </div>

                        <Link
                          href={detalleHref}
                          className="shrink-0 inline-flex items-center justify-center gap-1.5 min-h-10 px-3.5 rounded-lg bg-teal-700 hover:bg-teal-600 text-white text-sm font-bold shadow-sm shadow-teal-700/15"
                        >
                          Ver detalle
                          <ArrowRight className="h-4 w-4" />
                        </Link>
                      </div>

                      {cots.length > 0 && (
                        <div
                          className={`mt-1 overflow-x-auto rounded-xl border px-3 ${meta.table}`}
                        >
                          <table className="w-full min-w-[32rem] text-left">
                            <thead>
                              <tr className="text-[10px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200/70">
                                <th className="py-2.5 pr-3 font-bold">Proveedor</th>
                                <th className="py-2.5 pr-3 font-bold">Oferta</th>
                                <th className="py-2.5 pr-3 font-bold">Presupuesto</th>
                                <th className="py-2.5 font-bold text-right">
                                  {lic.estado === "abierta" ? "Enviar" : ""}
                                </th>
                              </tr>
                            </thead>
                            <tbody>
                              {cots.map((cot) => {
                                const { mailto, wa } = shareLinks(lic, cot);
                                const esGanador =
                                  cot.id === lic.ganador_cotizacion_id;
                                const cargada = cot.estado === "cargada";
                                return (
                                  <tr
                                    key={cot.id}
                                    className={`border-b border-slate-200/50 last:border-0 ${
                                      esGanador ? "bg-emerald-50/80" : ""
                                    }`}
                                  >
                                    <td className="py-2.5 pr-3 align-middle">
                                      <div className="flex items-center gap-2 min-w-0">
                                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-teal-100 text-[10px] font-black text-teal-800">
                                          {initials(cot.proveedor_nombre)}
                                        </span>
                                        <div className="min-w-0">
                                          <p className="text-sm font-semibold text-slate-800 truncate">
                                            {cot.proveedor_nombre}
                                          </p>
                                          {esGanador && (
                                            <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wide text-emerald-700">
                                              <Trophy className="h-3 w-3" />
                                              Adjudicado
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                    </td>
                                    <td className="py-2.5 pr-3 align-middle">
                                      {cargada ? (
                                        <span className="text-sm font-bold tabular-nums text-slate-900">
                                          {money(cot.monto)}
                                        </span>
                                      ) : (
                                        <span className="inline-flex rounded-md bg-amber-100/80 px-1.5 py-0.5 text-[11px] font-semibold text-amber-800">
                                          Pendiente
                                        </span>
                                      )}
                                    </td>
                                    <td className="py-2.5 pr-3 align-middle">
                                      {cot.presupuesto_pdf_url ? (
                                        <a
                                          href={cot.presupuesto_pdf_url}
                                          target="_blank"
                                          rel="noreferrer"
                                          className="inline-flex items-center gap-1.5 min-h-8 px-2.5 rounded-md bg-white text-[11px] font-bold text-teal-800 ring-1 ring-teal-200 hover:bg-teal-50"
                                        >
                                          <FileText className="h-3.5 w-3.5" />
                                          Presu. formal
                                        </a>
                                      ) : (
                                        <span className="text-[11px] font-semibold text-slate-400">
                                          —
                                        </span>
                                      )}
                                    </td>
                                    <td className="py-2.5 align-middle">
                                      {cot.url_carga &&
                                        lic.estado === "abierta" && (
                                          <div className="flex items-center justify-end gap-1">
                                            <button
                                              type="button"
                                              title="Copiar enlace"
                                              onClick={() =>
                                                void copyLink(cot.url_carga!)
                                              }
                                              className="inline-flex items-center justify-center h-8 w-8 rounded-md bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50 cursor-pointer"
                                            >
                                              <Copy className="h-3.5 w-3.5" />
                                            </button>
                                            <a
                                              href={mailto}
                                              title="Mail"
                                              className="inline-flex items-center justify-center h-8 w-8 rounded-md bg-sky-50 text-sky-700 ring-1 ring-sky-100 hover:bg-sky-100"
                                            >
                                              <Send className="h-3.5 w-3.5" />
                                            </a>
                                            <a
                                              href={wa}
                                              target="_blank"
                                              rel="noreferrer"
                                              title="WhatsApp"
                                              className="inline-flex items-center justify-center h-8 w-8 rounded-md bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100 hover:bg-emerald-100"
                                            >
                                              <MessageCircle className="h-3.5 w-3.5" />
                                            </a>
                                          </div>
                                        )}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {showGestion && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/60 p-0 sm:p-4">
          <div className="bg-white w-full sm:max-w-lg sm:rounded-3xl rounded-t-3xl max-h-[92vh] overflow-y-auto p-5 sm:p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-black uppercase tracking-wider text-slate-800">
                  Proveedores
                </h3>
                <p className="text-[11px] text-slate-400 font-semibold mt-0.5">
                  Abrí la ficha para ver o editar los datos de contacto.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowGestion(false);
                  closeFicha();
                }}
                className="min-h-11 min-w-11 inline-flex items-center justify-center rounded-xl border border-slate-200 cursor-pointer"
                aria-label="Cerrar"
              >
                <X className="h-5 w-5 text-slate-500" />
              </button>
            </div>

            {!fichaAbierta ? (
              <>
                <button
                  type="button"
                  onClick={openNuevaFicha}
                  className="w-full min-h-12 inline-flex items-center justify-center gap-2 px-4 py-3 bg-slate-900 text-white rounded-xl text-sm font-bold cursor-pointer"
                >
                  <Plus className="h-4 w-4" />
                  Nuevo proveedor
                </button>

                {activos.length === 0 ? (
                  <p className="text-center text-sm text-slate-400 font-semibold py-8">
                    No hay proveedores cargados.
                  </p>
                ) : (
                  <ul className="divide-y divide-slate-100 border border-slate-100 rounded-2xl overflow-hidden">
                    {activos.map((prov) => (
                      <li key={prov.id}>
                        <button
                          type="button"
                          onClick={() => openFicha(prov)}
                          className="w-full text-left px-4 py-3.5 hover:bg-slate-50 flex items-center justify-between gap-3 cursor-pointer"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="shrink-0 flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-[11px] font-black text-slate-600">
                              {initials(prov.nombre)}
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-bold text-slate-800 truncate">
                                {prov.nombre}
                              </p>
                              <p className="text-[11px] text-slate-400 font-semibold truncate">
                                {prov.email}
                                {prov.telefono ? ` · ${prov.telefono}` : ""}
                              </p>
                            </div>
                          </div>
                          <Pencil className="h-4 w-4 text-slate-400 shrink-0" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            ) : (
              <form onSubmit={handleSaveFicha} className="space-y-3">
                <p className="text-[11px] font-black uppercase tracking-wider text-slate-400">
                  {esAltaFicha ? "Nueva ficha de proveedor" : "Ficha del proveedor"}
                </p>
                <ProveedorFichaFields
                  value={ficha}
                  onChange={setFicha}
                  idPrefix={esAltaFicha ? "alta-gestion" : "edit-gestion"}
                />

                <div className="flex flex-col gap-2 pt-2">
                  <button
                    type="submit"
                    disabled={savingFicha}
                    className="w-full min-h-12 py-3 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-sm font-bold cursor-pointer disabled:opacity-50"
                  >
                    {savingFicha
                      ? "Guardando…"
                      : esAltaFicha
                        ? "Crear proveedor"
                        : "Guardar cambios"}
                  </button>
                  <button
                    type="button"
                    onClick={closeFicha}
                    className="w-full min-h-12 py-3 border border-slate-200 rounded-xl text-sm font-bold cursor-pointer"
                  >
                    Volver al listado
                  </button>
                  {!esAltaFicha && (
                    <button
                      type="button"
                      onClick={() => void handleEliminarProveedor()}
                      disabled={savingFicha}
                      className="w-full min-h-12 py-3 bg-rose-50 text-rose-700 rounded-xl text-sm font-bold inline-flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                    >
                      <Trash2 className="h-4 w-4" />
                      Eliminar proveedor
                    </button>
                  )}
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
