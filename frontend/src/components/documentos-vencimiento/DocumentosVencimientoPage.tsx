"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  CalendarClock,
  ChevronRight,
  FilePlus2,
  FileText,
  Loader,
  Paperclip,
  Ruler,
  Search,
  Shield,
  Trash2,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useAlert } from "@/context/AlertContext";
import { canWriteAppModule, type AppModuleKey } from "@/lib/moduleAccess";
import { documentosVencimientoService } from "@/utils/services/documentosVencimiento.service";
import type { CategoriaDocumento, DocumentoVencimiento } from "@/types";

type Props = {
  categoria: CategoriaDocumento;
  moduleKey: AppModuleKey;
  titulo: string;
  basePath: string;
  nuevoLabel: string;
  descripcion: string;
};

const TIPOS_SUGERIDOS_MEDICION = [
  "Iluminación",
  "Ruido",
  "Vibraciones",
  "Calor / Estrés térmico",
  "Polvo / Partículas",
  "Gases / Vapores",
  "Otro",
];

const TIPOS_SUGERIDOS_ART = [
  "Plan de evacuación",
  "Programa de seguridad",
  "Relevamiento de riesgos",
  "Constancia ART",
  "Otro",
];

function diasHasta(fecha: string) {
  const hoy = new Date();
  hoy.setHours(12, 0, 0, 0);
  const target = new Date(fecha + "T12:00:00");
  return Math.round((target.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24));
}

function badgeVencimiento(fecha: string) {
  const dias = diasHasta(fecha);
  if (dias < 0) {
    return {
      label: `Vencido hace ${Math.abs(dias)}d`,
      className: "bg-rose-50 text-rose-700 border-rose-200",
      tone: "vencido" as const,
    };
  }
  if (dias <= 30) {
    return {
      label: `${dias} días`,
      className: "bg-amber-50 text-amber-800 border-amber-200",
      tone: "urgente" as const,
    };
  }
  if (dias <= 60) {
    return {
      label: `${dias} días`,
      className: "bg-sky-50 text-sky-700 border-sky-100",
      tone: "proximo" as const,
    };
  }
  return {
    label: `${dias} días`,
    className: "bg-emerald-50 text-emerald-700 border-emerald-100",
    tone: "ok" as const,
  };
}

type FiltroEstado = "todos" | "vencido" | "30" | "60" | "ok";

export function DocumentosVencimientoPage({
  categoria,
  moduleKey,
  titulo,
  basePath,
  nuevoLabel,
  descripcion,
}: Props) {
  const { user, empresa } = useAuth();
  const { showAlert, showConfirm } = useAlert();
  const queryClient = useQueryClient();
  const canWrite = canWriteAppModule(user, moduleKey);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [filtroTipo, setFiltroTipo] = useState<string>("todos");
  const [filtroEstado, setFiltroEstado] = useState<FiltroEstado>("todos");

  const sugeridos =
    categoria === "medicion" ? TIPOS_SUGERIDOS_MEDICION : TIPOS_SUGERIDOS_ART;
  const Icon = categoria === "art" ? Shield : Ruler;

  const { data, isLoading } = useQuery({
    queryKey: ["documentos-vencimiento", empresa?.id, categoria, filtroTipo, q],
    queryFn: () =>
      documentosVencimientoService.listar({
        empresaId: empresa!.id,
        categoria,
        tipo: filtroTipo === "todos" ? undefined : filtroTipo,
        q: q.trim() || undefined,
        limit: 200,
      }),
    enabled: !!empresa?.id,
  });

  const { data: tiposGuardados = [] } = useQuery({
    queryKey: ["documentos-tipos", empresa?.id, categoria],
    queryFn: () =>
      documentosVencimientoService.listarTipos(empresa!.id, categoria),
    enabled: !!empresa?.id,
  });

  const documentos = data?.documentos || [];

  const tiposFiltro = useMemo(() => {
    const set = new Set([...sugeridos.filter((t) => t !== "Otro"), ...tiposGuardados]);
    return Array.from(set).sort((a, b) =>
      a.localeCompare(b, "es", { sensitivity: "base" }),
    );
  }, [sugeridos, tiposGuardados]);

  const stats = useMemo(() => {
    let vencidos = 0;
    let d30 = 0;
    let d60 = 0;
    let ok = 0;
    for (const doc of documentos) {
      const d = diasHasta(doc.fecha_vencimiento);
      if (d < 0) vencidos += 1;
      else if (d <= 30) d30 += 1;
      else if (d <= 60) d60 += 1;
      else ok += 1;
    }
    return { total: documentos.length, vencidos, d30, d60, ok };
  }, [documentos]);

  const filtrados = useMemo(() => {
    return documentos
      .filter((doc) => {
        const d = diasHasta(doc.fecha_vencimiento);
        if (filtroEstado === "vencido") return d < 0;
        if (filtroEstado === "30") return d >= 0 && d <= 30;
        if (filtroEstado === "60") return d > 30 && d <= 60;
        if (filtroEstado === "ok") return d > 60;
        return true;
      })
      .sort((a, b) => a.fecha_vencimiento.localeCompare(b.fecha_vencimiento));
  }, [documentos, filtroEstado]);

  const handleDelete = async (doc: DocumentoVencimiento) => {
    const ok = await showConfirm(
      "Eliminar documento",
      `¿Eliminar «${doc.titulo}»? Esta acción no se puede deshacer.`,
      { type: "error", confirmLabel: "Eliminar", cancelLabel: "Cancelar" },
    );
    if (!ok) return;
    setDeletingId(doc.id);
    try {
      await documentosVencimientoService.eliminar(doc.id);
      await queryClient.invalidateQueries({
        queryKey: ["documentos-vencimiento", empresa?.id, categoria],
      });
      await queryClient.invalidateQueries({
        queryKey: ["documentos-proximos", empresa?.id],
      });
      await queryClient.invalidateQueries({
        queryKey: ["documentos-tipos", empresa?.id, categoria],
      });
      showAlert("success", "Eliminado", "El documento se eliminó correctamente.");
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "No se pudo eliminar";
      showAlert("error", "Error", message);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="w-full space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <span className="text-sm font-semibold text-slate-500 flex items-center gap-1.5">
            <Icon className="h-4 w-4 text-brand-primary" />
            Módulo de {titulo}
          </span>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight mt-1">
            {titulo}
          </h1>
          <p className="text-sm text-brand-text-muted mt-1 max-w-2xl">
            {descripcion}
          </p>
        </div>
        {canWrite && (
          <Link
            href={`${basePath}/nuevo`}
            className="inline-flex items-center justify-center gap-2 bg-brand-primary hover:bg-brand-primary/95 text-white font-bold px-5 py-3 rounded-xl shadow-md shadow-blue-900/10 hover:shadow-lg transition-all text-sm cursor-pointer shrink-0"
          >
            <FilePlus2 className="h-4 w-4" />
            {nuevoLabel}
          </Link>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          label="Total"
          value={stats.total}
          icon={FileText}
          active={filtroEstado === "todos"}
          onClick={() => setFiltroEstado("todos")}
          tone="neutral"
        />
        <StatCard
          label="Vencidos"
          value={stats.vencidos}
          icon={AlertTriangle}
          active={filtroEstado === "vencido"}
          onClick={() => setFiltroEstado("vencido")}
          tone="danger"
        />
        <StatCard
          label="≤ 30 días"
          value={stats.d30}
          icon={CalendarClock}
          active={filtroEstado === "30"}
          onClick={() => setFiltroEstado("30")}
          tone="warning"
        />
        <StatCard
          label="31–60 días"
          value={stats.d60}
          icon={CalendarClock}
          active={filtroEstado === "60"}
          onClick={() => setFiltroEstado("60")}
          tone="info"
        />
      </div>

      {/* Filtros */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por título, tipo o notas…"
            className="w-full pl-10 pr-3 py-2.5 rounded-xl border border-slate-200 bg-brand-input-bg text-sm focus:outline-none focus:ring-2 focus:ring-brand-secondary/30 focus:border-brand-secondary"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => setFiltroTipo("todos")}
            className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
              filtroTipo === "todos"
                ? "bg-brand-primary text-white shadow-md"
                : "bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100"
            }`}
          >
            Todos los tipos
          </button>
          {tiposFiltro.map((tipo) => (
            <button
              key={tipo}
              type="button"
              onClick={() =>
                setFiltroTipo((prev) => (prev === tipo ? "todos" : tipo))
              }
              className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
                filtroTipo === tipo
                  ? "bg-brand-secondary text-white shadow-md"
                  : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
              }`}
            >
              {tipo}
            </button>
          ))}
        </div>
      </div>

      {/* Listado */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-24 bg-white border border-slate-200 rounded-2xl animate-pulse"
            />
          ))}
        </div>
      ) : filtrados.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center shadow-2xs">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-brand-primary mb-4">
            <Icon className="h-7 w-7" />
          </div>
          <p className="text-base font-bold text-slate-800">
            {documentos.length === 0
              ? `Todavía no hay ${titulo.toLowerCase()} cargadas`
              : "Ningún documento coincide con los filtros"}
          </p>
          <p className="text-sm text-slate-500 mt-1 max-w-md mx-auto">
            {documentos.length === 0
              ? "Cargá un informe con título, tipo, fecha de vencimiento y archivos de respaldo (PDF, Word o imagen)."
              : "Probá limpiar la búsqueda o cambiar el filtro de tipo / vencimiento."}
          </p>
          {canWrite && documentos.length === 0 && (
            <Link
              href={`${basePath}/nuevo`}
              className="inline-flex items-center gap-2 mt-5 text-sm font-bold text-brand-secondary hover:underline"
            >
              <FilePlus2 className="h-4 w-4" />
              {nuevoLabel}
            </Link>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filtrados.map((doc) => {
            const badge = badgeVencimiento(doc.fecha_vencimiento);
            return (
              <div
                key={doc.id}
                className={`bg-white p-5 rounded-2xl border shadow-2xs hover:shadow-md transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 group ${
                  badge.tone === "urgente" || badge.tone === "vencido"
                    ? "border-amber-200 hover:border-amber-300"
                    : "border-slate-200 hover:border-slate-300"
                }`}
              >
                <Link
                  href={`${basePath}/${doc.id}`}
                  className="min-w-0 flex-1 flex items-start gap-3"
                >
                  <div
                    className={`h-11 w-11 rounded-xl flex items-center justify-center shrink-0 border ${
                      badge.tone === "vencido"
                        ? "bg-rose-50 border-rose-100 text-rose-600"
                        : badge.tone === "urgente"
                          ? "bg-amber-50 border-amber-100 text-amber-600"
                          : "bg-blue-50 border-blue-100 text-brand-primary"
                    }`}
                  >
                    <FileText className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-sm font-bold text-slate-900 group-hover:text-brand-secondary transition-colors truncate">
                        {doc.titulo}
                      </h3>
                      {doc.tipo && (
                        <span className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-md border border-slate-200 bg-slate-50 text-slate-600">
                          {doc.tipo}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                      Vence el{" "}
                      {new Date(
                        doc.fecha_vencimiento + "T12:00:00",
                      ).toLocaleDateString("es-AR")}
                      {" · "}
                      <span className="inline-flex items-center gap-1">
                        <Paperclip className="h-3 w-3" />
                        {doc.adjuntos?.length ?? 0} archivo
                        {(doc.adjuntos?.length ?? 0) === 1 ? "" : "s"}
                      </span>
                    </p>
                    {doc.notas && (
                      <p className="text-xs text-slate-400 mt-1 line-clamp-1">
                        {doc.notas}
                      </p>
                    )}
                  </div>
                </Link>

                <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                  <span
                    className={`inline-flex px-2.5 py-1 rounded-lg border text-xs font-bold ${badge.className}`}
                  >
                    {badge.label}
                  </span>
                  <Link
                    href={`${basePath}/${doc.id}`}
                    className="inline-flex items-center gap-1 px-3 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold hover:bg-brand-primary transition-colors"
                  >
                    Ver
                    <ChevronRight className="h-3.5 w-3.5" />
                  </Link>
                  {canWrite && (
                    <button
                      type="button"
                      disabled={deletingId === doc.id}
                      onClick={() => void handleDelete(doc)}
                      className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-100 cursor-pointer"
                      aria-label="Eliminar"
                    >
                      {deletingId === doc.id ? (
                        <Loader className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  active,
  onClick,
  tone,
}: {
  label: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  active: boolean;
  onClick: () => void;
  tone: "neutral" | "danger" | "warning" | "info";
}) {
  const tones = {
    neutral: "text-brand-primary bg-blue-50 border-blue-100",
    danger: "text-rose-600 bg-rose-50 border-rose-100",
    warning: "text-amber-600 bg-amber-50 border-amber-100",
    info: "text-sky-600 bg-sky-50 border-sky-100",
  };
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-left rounded-2xl border p-4 shadow-2xs transition-all cursor-pointer ${
        active
          ? "border-brand-secondary ring-2 ring-brand-secondary/20 bg-white"
          : "border-slate-200 bg-white hover:border-slate-300"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-bold uppercase tracking-wide text-slate-500">
          {label}
        </span>
        <span
          className={`h-8 w-8 rounded-lg border flex items-center justify-center ${tones[tone]}`}
        >
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <p className="text-2xl font-black text-slate-900 mt-2">{value}</p>
    </button>
  );
}
