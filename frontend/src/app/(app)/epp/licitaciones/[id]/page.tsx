"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle2,
  Copy,
  FileText,
  Loader2,
  MessageCircle,
  Package,
  Plus,
  Send,
  Trophy,
  UserRound,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useEpp } from "@/hooks/useEpp";
import { useAlert } from "@/context/AlertContext";
import { canWriteAppModule } from "@/lib/moduleAccess";
import type { EppCotizacion, EppLicitacion, EppProveedor } from "@/types";
import type { LicitacionEstado } from "@/utils/services/eppLicitacion.service";

const ESTADOS: Array<{
  id: LicitacionEstado;
  label: string;
  hint: string;
  active: string;
}> = [
  {
    id: "abierta",
    label: "Abierta",
    hint: "Recibe cotizaciones",
    active: "bg-sky-600 text-white ring-sky-600",
  },
  {
    id: "adjudicacion",
    label: "Adjudicación",
    hint: "Elegí ganador",
    active: "bg-amber-500 text-slate-950 ring-amber-500",
  },
  {
    id: "cerrada",
    label: "Cerrada",
    hint: "Proceso finalizado",
    active: "bg-slate-800 text-white ring-slate-800",
  },
];

function labelEstado(estado: string): string {
  return ESTADOS.find((e) => e.id === estado)?.label ?? estado;
}

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

export default function GestionLicitacionPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const {
    getLicitacion,
    getProveedores,
    agregarProveedorLicitacion,
    actualizarEstadoLicitacion,
  } = useEpp();
  const { showAlert, showConfirm } = useAlert();

  const canEdit = canWriteAppModule(user, "epp");
  const licitacionId = params.id;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [lic, setLic] = useState<EppLicitacion | null>(null);
  const [proveedores, setProveedores] = useState<EppProveedor[]>([]);
  const [proveedorNuevoId, setProveedorNuevoId] = useState("");
  const [ganadorDraft, setGanadorDraft] = useState("");

  const load = useCallback(async () => {
    if (!licitacionId) return;
    setLoading(true);
    try {
      const [licData, provData] = await Promise.all([
        getLicitacion(licitacionId),
        getProveedores(),
      ]);
      setLic(licData);
      setProveedores(
        (provData as { proveedores?: EppProveedor[] })?.proveedores ?? [],
      );
      setGanadorDraft(licData.ganador_cotizacion_id ?? "");
    } catch {
      showAlert("error", "Error", "No se pudo cargar la licitación.");
      router.replace("/epp");
    } finally {
      setLoading(false);
    }
  }, [getLicitacion, getProveedores, licitacionId, router, showAlert]);

  useEffect(() => {
    void load();
  }, [load]);

  const cotizaciones = useMemo(
    () => lic?.epp_licitacion_cotizaciones ?? [],
    [lic],
  );
  const cargadas = useMemo(
    () => cotizaciones.filter((c) => c.estado === "cargada"),
    [cotizaciones],
  );
  const invitadosIds = useMemo(
    () => new Set(cotizaciones.map((c) => c.proveedor_id).filter(Boolean)),
    [cotizaciones],
  );
  const proveedoresDisponibles = useMemo(
    () =>
      proveedores.filter(
        (p) => p.activo && !invitadosIds.has(p.id),
      ),
    [proveedores, invitadosIds],
  );

  const ganador = useMemo(
    () => cotizaciones.find((c) => c.id === lic?.ganador_cotizacion_id) ?? null,
    [cotizaciones, lic?.ganador_cotizacion_id],
  );

  const copyText = async (text: string, okMsg: string) => {
    await navigator.clipboard.writeText(text);
    showAlert("success", "Copiado", okMsg);
  };

  const handleAgregarProveedor = async () => {
    if (!lic || !proveedorNuevoId) return;
    setSaving(true);
    try {
      await agregarProveedorLicitacion(lic.id, proveedorNuevoId);
      setProveedorNuevoId("");
      await load();
      showAlert(
        "success",
        "Proveedor agregado",
        "Ya podés enviarle el enlace para cotizar.",
      );
    } catch (err: unknown) {
      const msg =
        typeof err === "object" &&
        err !== null &&
        "response" in err &&
        typeof (err as { response?: { data?: { error?: string } } }).response?.data
          ?.error === "string"
          ? (err as { response: { data: { error: string } } }).response.data.error
          : "No se pudo agregar el proveedor.";
      showAlert("error", "Error", msg);
    } finally {
      setSaving(false);
    }
  };

  const handleCambiarEstado = async (estado: LicitacionEstado) => {
    if (!lic || !canEdit) return;
    if (estado === lic.estado) return;

    if (lic.estado === "cerrada") {
      showAlert("warning", "Cerrada", "Una licitación cerrada no se puede reabrir.");
      return;
    }

    let ganadorId: string | null | undefined = ganadorDraft || lic.ganador_cotizacion_id || null;

    if (estado === "cerrada" && cargadas.length > 0) {
      if (!ganadorId) {
        showAlert(
          "warning",
          "Falta el ganador",
          "Seleccioná qué cotización ganó antes de cerrar.",
        );
        return;
      }
      const ok = await showConfirm(
        "Cerrar licitación",
        `Se registrará como ganador a ${
          cargadas.find((c) => c.id === ganadorId)?.proveedor_nombre ?? "el proveedor"
        } y se generará el enlace de adjudicación.`,
        {
          type: "warning",
          confirmLabel: "Cerrar y adjudicar",
          cancelLabel: "Cancelar",
        },
      );
      if (!ok) return;
    }

    if (estado === "adjudicacion" && cargadas.length > 0 && ganadorId) {
      // ok — adjudica con ganador
    } else if (estado === "adjudicacion" && !ganadorId) {
      ganadorId = undefined;
    }

    if (estado === "abierta") {
      ganadorId = null;
    }

    setSaving(true);
    try {
      const updated = await actualizarEstadoLicitacion(lic.id, {
        estado,
        ganador_cotizacion_id: ganadorId,
      });
      setLic(updated);
      setGanadorDraft(updated.ganador_cotizacion_id ?? "");
      showAlert(
        "success",
        "Estado actualizado",
        `La licitación quedó en ${labelEstado(updated.estado)}.`,
      );
    } catch (err: unknown) {
      const msg =
        typeof err === "object" &&
        err !== null &&
        "response" in err &&
        typeof (err as { response?: { data?: { error?: string } } }).response?.data
          ?.error === "string"
          ? (err as { response: { data: { error: string } } }).response.data.error
          : "No se pudo actualizar el estado.";
      showAlert("error", "Error", msg);
    } finally {
      setSaving(false);
    }
  };

  const handleGuardarGanador = async () => {
    if (!lic || !ganadorDraft || !canEdit) return;
    const nextEstado: LicitacionEstado =
      lic.estado === "abierta" ? "adjudicacion" : (lic.estado as LicitacionEstado);
    setSaving(true);
    try {
      const updated = await actualizarEstadoLicitacion(lic.id, {
        estado: nextEstado,
        ganador_cotizacion_id: ganadorDraft,
      });
      setLic(updated);
      showAlert(
        "success",
        "Ganador registrado",
        "Ya podés enviar el enlace de adjudicación al proveedor.",
      );
    } catch (err: unknown) {
      const msg =
        typeof err === "object" &&
        err !== null &&
        "response" in err &&
        typeof (err as { response?: { data?: { error?: string } } }).response?.data
          ?.error === "string"
          ? (err as { response: { data: { error: string } } }).response.data.error
          : "No se pudo registrar el ganador.";
      showAlert("error", "Error", msg);
    } finally {
      setSaving(false);
    }
  };

  const shareCotizacion = (cot: EppCotizacion) => {
    const compradorLineas = [
      lic?.comprador_nombre ? `Comprador: ${lic.comprador_nombre}` : null,
      lic?.comprador_email ? `Mail: ${lic.comprador_email}` : null,
      lic?.comprador_telefono ? `Tel: ${lic.comprador_telefono}` : null,
    ]
      .filter(Boolean)
      .join("\n");
    const body = `Hola ${cot.proveedor_nombre},\n\n${
      compradorLineas ? `${compradorLineas}\n\n` : ""
    }Cargá tu cotización en: ${cot.url_carga ?? ""}`;
    return {
      mailto: `mailto:${cot.proveedor_email ?? ""}?subject=${encodeURIComponent(
        `Cotización EPP: ${lic?.titulo ?? ""}`,
      )}&body=${encodeURIComponent(body)}`,
      wa: `https://wa.me/?text=${encodeURIComponent(
        `Cotización EPP ${lic?.titulo ?? ""}${
          lic?.comprador_nombre ? ` (comprador: ${lic.comprador_nombre})` : ""
        }: ${cot.url_carga ?? ""}`,
      )}`,
    };
  };

  const shareAdjudicacion = () => {
    const mensaje =
      lic?.mensaje_adjudicacion ||
      `Ud fue adjudicado con la lic "${lic?.titulo ?? ""}".`;
    const url = lic?.url_adjudicacion ?? "";
    const texto = url ? `${mensaje}\n\nDetalle: ${url}` : mensaje;
    return {
      texto,
      mailto: ganador?.proveedor_email
        ? `mailto:${ganador.proveedor_email}?subject=${encodeURIComponent(
            `Adjudicación: ${lic?.titulo ?? ""}`,
          )}&body=${encodeURIComponent(texto)}`
        : null,
      wa: `https://wa.me/?text=${encodeURIComponent(texto)}`,
    };
  };

  if (loading || !lic) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
      </div>
    );
  }

  const adj = shareAdjudicacion();
  const cerrada = lic.estado === "cerrada";
  const abierta = lic.estado === "abierta";
  const estadoIdx = Math.max(
    0,
    ESTADOS.findIndex((e) => e.id === lic.estado),
  );

  return (
    <div className="max-w-7xl mx-auto space-y-5 pb-16">
      <div className="rounded-3xl border border-slate-200 overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
        <div className="relative p-5 sm:p-6 space-y-5">
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.12]"
            style={{
              backgroundImage:
                "radial-gradient(circle at 15% 10%, #38bdf8 0, transparent 42%), radial-gradient(circle at 90% 0%, #f59e0b 0, transparent 32%)",
            }}
          />
          <div className="relative flex items-start gap-3">
            <Link
              href="/epp?tab=licitaciones"
              className="min-h-11 min-w-11 inline-flex items-center justify-center rounded-xl border border-white/15 bg-white/10 hover:bg-white/15"
              aria-label="Volver"
            >
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-sky-300/90">
                {formatLicNumero(lic.numero) ?? "Licitación"} · Gestión
              </p>
              <h1 className="text-xl sm:text-2xl font-black tracking-tight mt-1">
                {lic.titulo}
              </h1>
              {lic.empresas?.razon_social && (
                <p className="text-sm text-slate-300 font-medium mt-1">
                  {lic.empresas.razon_social}
                </p>
              )}
              {ganador && (
                <p className="mt-2 inline-flex items-center gap-1.5 rounded-md bg-emerald-400/20 px-2.5 py-1 text-xs font-bold text-emerald-200">
                  <Trophy className="h-3.5 w-3.5" />
                  Adjudicado: {ganador.proveedor_nombre}
                </p>
              )}
            </div>
          </div>

          <div className="relative grid grid-cols-3 gap-2">
            {ESTADOS.map((e, idx) => {
              const done = idx < estadoIdx;
              const active = e.id === lic.estado;
              return (
                <div key={e.id} className="space-y-2">
                  <div
                    className={`h-1.5 rounded-full ${
                      active || done ? "bg-sky-400" : "bg-white/15"
                    }`}
                  />
                  <p
                    className={`text-[11px] font-bold ${
                      active ? "text-white" : "text-slate-400"
                    }`}
                  >
                    {e.label}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <section className="bg-white rounded-3xl border border-slate-200 p-5 sm:p-6 space-y-4 shadow-sm">
        <div>
          <h2 className="text-sm font-black text-slate-900">Estado del proceso</h2>
          <p className="text-xs text-slate-500 mt-1 leading-relaxed">
            Abierta → Adjudicación → Cerrada. Al cerrar con cotizaciones, registrá
            el ganador.
          </p>
        </div>
        <div className="grid sm:grid-cols-3 gap-2">
          {ESTADOS.map((e) => {
            const active = lic.estado === e.id;
            return (
              <button
                key={e.id}
                type="button"
                disabled={!canEdit || saving || (cerrada && e.id !== "cerrada")}
                onClick={() => void handleCambiarEstado(e.id)}
                className={`min-h-[4.25rem] px-4 py-3 rounded-2xl text-left ring-1 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                  active
                    ? e.active
                    : "bg-slate-50 text-slate-700 ring-slate-200 hover:bg-slate-100"
                }`}
              >
                <p className="text-sm font-black">{e.label}</p>
                <p
                  className={`text-[11px] font-semibold mt-0.5 ${
                    active ? "opacity-80" : "text-slate-400"
                  }`}
                >
                  {e.hint}
                </p>
              </button>
            );
          })}
        </div>
        {lic.comprador_nombre && (
          <div className="flex items-start gap-3 rounded-2xl bg-slate-50 border border-slate-100 px-4 py-3">
            <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-xl bg-white text-slate-500 ring-1 ring-slate-200">
              <UserRound className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-black uppercase tracking-wider text-slate-400">
                Comprador
              </p>
              <p className="text-sm font-bold text-slate-800">{lic.comprador_nombre}</p>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                {[lic.comprador_telefono, lic.comprador_email].filter(Boolean).join(" · ")}
              </p>
            </div>
          </div>
        )}
      </section>

      <section className="bg-white rounded-3xl border border-slate-200 p-5 sm:p-6 space-y-3 shadow-sm">
        <div className="flex items-center gap-2">
          <Package className="h-4 w-4 text-slate-400" />
          <h2 className="text-sm font-black text-slate-900">Pedido</h2>
        </div>
        <ul className="grid sm:grid-cols-2 gap-2">
          {(lic.epp_licitacion_items ?? []).map((item) => (
            <li
              key={item.id}
              className="flex justify-between gap-3 text-sm rounded-2xl bg-slate-50 border border-slate-100 px-3.5 py-3"
            >
              <span className="font-semibold text-slate-800">
                {item.epp_tipos?.nombre || item.nombre_manual || "EPP"}
              </span>
              <span className="text-slate-500 font-black tabular-nums">
                ×{item.cantidad}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="bg-white rounded-3xl border border-slate-200 p-5 sm:p-6 space-y-4 shadow-sm">
        <div>
          <h2 className="text-sm font-black text-slate-900">Proveedores invitados</h2>
          <p className="text-xs text-slate-500 mt-1">
            Enviá el enlace de cotización o agregá más proveedores.
          </p>
        </div>

        {abierta && canEdit && (
          <div className="flex flex-col sm:flex-row gap-2 rounded-2xl bg-sky-50/60 border border-sky-100 p-3">
            <select
              value={proveedorNuevoId}
              onChange={(e) => setProveedorNuevoId(e.target.value)}
              className="flex-1 min-h-12 rounded-xl border border-slate-200 px-3 text-sm font-semibold bg-white"
            >
              <option value="">Agregar proveedor…</option>
              {proveedoresDisponibles.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre}
                </option>
              ))}
            </select>
            <button
              type="button"
              disabled={!proveedorNuevoId || saving}
              onClick={() => void handleAgregarProveedor()}
              className="inline-flex items-center justify-center gap-2 min-h-12 px-4 rounded-xl bg-slate-900 text-white text-sm font-bold cursor-pointer disabled:opacity-50"
            >
              <Plus className="h-4 w-4" />
              Invitar
            </button>
          </div>
        )}

        <ul className="rounded-2xl border border-slate-200 overflow-hidden divide-y divide-slate-100">
          {cotizaciones.map((cot) => {
            const share = shareCotizacion(cot);
            const esGanador = cot.id === lic.ganador_cotizacion_id;
            const cargada = cot.estado === "cargada";
            return (
              <li
                key={cot.id}
                className={`p-4 ${esGanador ? "bg-emerald-50/60" : "bg-white"}`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`shrink-0 flex h-11 w-11 items-center justify-center rounded-xl text-xs font-black ${
                        esGanador
                          ? "bg-emerald-100 text-emerald-800"
                          : cargada
                            ? "bg-sky-100 text-sky-800"
                            : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      {initials(cot.proveedor_nombre)}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-slate-800 flex items-center gap-2">
                        {cot.proveedor_nombre}
                        {esGanador && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-emerald-800">
                            <Trophy className="h-3 w-3" />
                            Adjudicado
                          </span>
                        )}
                      </p>
                      {cargada ? (
                        <p className="text-sm font-black tabular-nums text-slate-900 mt-0.5">
                          {money(cot.monto)}
                        </p>
                      ) : (
                        <span className="inline-flex mt-1 rounded-md bg-amber-50 px-1.5 py-0.5 text-[11px] font-bold text-amber-700 ring-1 ring-amber-100">
                          Pendiente de carga
                        </span>
                      )}
                      {cot.presupuesto_pdf_url && (
                        <a
                          href={cot.presupuesto_pdf_url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1.5 mt-2 min-h-9 px-3 rounded-lg bg-teal-50 text-[12px] font-bold text-teal-800 ring-1 ring-teal-200 hover:bg-teal-100"
                        >
                          <FileText className="h-3.5 w-3.5" />
                          Ver presupuesto formal
                        </a>
                      )}
                    </div>
                  </div>
                  {abierta && cot.url_carga && (
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        title="Copiar enlace"
                        onClick={() =>
                          void copyText(
                            cot.url_carga!,
                            "Pegalo en el mail o WhatsApp del proveedor.",
                          )
                        }
                        className="inline-flex items-center justify-center min-h-10 min-w-10 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer"
                      >
                        <Copy className="h-4 w-4" />
                      </button>
                      <a
                        href={share.mailto}
                        title="Mail"
                        className="inline-flex items-center justify-center min-h-10 min-w-10 rounded-xl bg-sky-50 hover:bg-sky-100 text-sky-700"
                      >
                        <Send className="h-4 w-4" />
                      </a>
                      <a
                        href={share.wa}
                        target="_blank"
                        rel="noreferrer"
                        title="WhatsApp"
                        className="inline-flex items-center justify-center min-h-10 min-w-10 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700"
                      >
                        <MessageCircle className="h-4 w-4" />
                      </a>
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      {(lic.estado === "adjudicacion" ||
        lic.estado === "cerrada" ||
        cargadas.length > 0) && (
        <section className="bg-white rounded-3xl border border-slate-200 p-5 sm:p-6 space-y-4 shadow-sm">
          <div>
            <h2 className="text-sm font-black text-slate-900">Adjudicación</h2>
            <p className="text-xs text-slate-500 mt-1">
              Registrá quién ganó y enviá el aviso al proveedor adjudicado.
            </p>
          </div>

          {cargadas.length === 0 ? (
            <p className="text-sm text-slate-500 font-semibold rounded-2xl bg-slate-50 border border-slate-100 px-4 py-6 text-center">
              Todavía no hay cotizaciones cargadas para adjudicar.
            </p>
          ) : (
            <>
              <div className="flex flex-col sm:flex-row gap-2">
                <select
                  value={ganadorDraft}
                  onChange={(e) => setGanadorDraft(e.target.value)}
                  disabled={!canEdit || cerrada || saving}
                  className="flex-1 min-h-12 rounded-xl border border-slate-200 px-3 text-sm font-semibold bg-white disabled:opacity-60"
                >
                  <option value="">Seleccionar ganador…</option>
                  {cargadas.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.proveedor_nombre} — {money(c.monto)}
                    </option>
                  ))}
                </select>
                {canEdit && !cerrada && (
                  <button
                    type="button"
                    disabled={!ganadorDraft || saving}
                    onClick={() => void handleGuardarGanador()}
                    className="inline-flex items-center justify-center gap-2 min-h-12 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold cursor-pointer disabled:opacity-50"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    Registrar ganador
                  </button>
                )}
              </div>

              {lic.url_adjudicacion && ganador && (
                <div className="rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-white p-4 space-y-3">
                  <div className="flex items-center gap-2 text-emerald-800">
                    <Trophy className="h-4 w-4" />
                    <p className="text-[11px] font-black uppercase tracking-wider">
                      Mensaje para el adjudicado
                    </p>
                  </div>
                  <p className="text-sm font-semibold text-slate-800 leading-relaxed">
                    {lic.mensaje_adjudicacion}
                  </p>
                  <p className="text-[11px] text-slate-500 break-all font-mono bg-white/70 rounded-lg px-2.5 py-2 border border-emerald-100">
                    {lic.url_adjudicacion}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        void copyText(adj.texto, "Mensaje listo para enviar al ganador.")
                      }
                      className="inline-flex items-center gap-1.5 min-h-11 px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold cursor-pointer"
                    >
                      <Copy className="h-4 w-4" /> Copiar mensaje
                    </button>
                    {adj.mailto && (
                      <a
                        href={adj.mailto}
                        className="inline-flex items-center gap-1.5 min-h-11 px-3 py-2 bg-sky-50 text-sky-700 rounded-xl text-sm font-bold"
                      >
                        <Send className="h-4 w-4" /> Mail
                      </a>
                    )}
                    <a
                      href={adj.wa}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 min-h-11 px-3 py-2 bg-emerald-100 text-emerald-800 rounded-xl text-sm font-bold"
                    >
                      <MessageCircle className="h-4 w-4" /> WhatsApp
                    </a>
                  </div>
                </div>
              )}
            </>
          )}
        </section>
      )}
    </div>
  );
}
