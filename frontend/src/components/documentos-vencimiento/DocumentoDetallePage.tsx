"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Calendar,
  ExternalLink,
  Loader,
  Paperclip,
  Save,
  Trash2,
  Upload,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useAlert } from "@/context/AlertContext";
import { canWriteAppModule, type AppModuleKey } from "@/lib/moduleAccess";
import { documentosVencimientoService } from "@/utils/services/documentosVencimiento.service";
import type { CategoriaDocumento } from "@/types";

const ACCEPT =
  ".jpg,.jpeg,.png,.webp,.pdf,.doc,.docx,image/jpeg,image/png,image/webp,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document";

type Props = {
  categoria: CategoriaDocumento;
  moduleKey: AppModuleKey;
  basePath: string;
};

export function DocumentoDetallePage({
  categoria,
  moduleKey,
  basePath,
}: Props) {
  const params = useParams();
  const id = params.id as string;
  const { user, empresa } = useAuth();
  const { showAlert, showConfirm } = useAlert();
  const router = useRouter();
  const queryClient = useQueryClient();
  const canWrite = canWriteAppModule(user, moduleKey);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [titulo, setTitulo] = useState("");
  const [tipo, setTipo] = useState("");
  const [fecha, setFecha] = useState("");
  const [sinVencimiento, setSinVencimiento] = useState(false);
  const [notas, setNotas] = useState("");

  const { data: doc, isLoading, refetch } = useQuery({
    queryKey: ["documento-vencimiento", id, categoria],
    queryFn: () => documentosVencimientoService.obtener(id, categoria),
    enabled: !!id,
  });

  useEffect(() => {
    if (!doc) return;
    setTitulo(doc.titulo);
    setTipo(doc.tipo || "");
    setSinVencimiento(Boolean(doc.sin_vencimiento || !doc.fecha_vencimiento));
    setFecha(doc.fecha_vencimiento || "");
    setNotas(doc.notas || "");
  }, [doc]);

  const handleSave = async () => {
    if (!canWrite) return;
    if (!sinVencimiento && !fecha) {
      showAlert(
        "warning",
        "Datos incompletos",
        "Indicá la fecha de vencimiento o marcá Sin vencimiento.",
      );
      return;
    }
    setSaving(true);
    try {
      await documentosVencimientoService.actualizar(id, {
        titulo: titulo.trim(),
        tipo: tipo.trim() || null,
        sin_vencimiento: sinVencimiento,
        fecha_vencimiento: sinVencimiento ? null : fecha,
        notas: notas.trim() || null,
      });
      await refetch();
      await queryClient.invalidateQueries({
        queryKey: ["documentos-vencimiento", empresa?.id, categoria],
      });
      await queryClient.invalidateQueries({
        queryKey: ["documentos-proximos", empresa?.id],
      });
      showAlert("success", "Guardado", "Cambios actualizados.");
    } catch (err: unknown) {
      showAlert(
        "error",
        "Error",
        err instanceof Error ? err.message : "No se pudo guardar",
      );
    } finally {
      setSaving(false);
    }
  };

  const handleUpload = async (files: FileList | null) => {
    if (!files?.length || !canWrite) return;
    setUploading(true);
    try {
      await documentosVencimientoService.subirAdjuntos(id, Array.from(files));
      await refetch();
      showAlert("success", "Adjuntos", "Archivos subidos correctamente.");
    } catch (err: unknown) {
      showAlert(
        "error",
        "Error",
        err instanceof Error ? err.message : "No se pudieron subir los archivos",
      );
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteAdjunto = async (adjuntoId: string) => {
    const ok = await showConfirm(
      "Eliminar adjunto",
      "¿Eliminar este archivo?",
      { type: "error", confirmLabel: "Eliminar", cancelLabel: "Cancelar" },
    );
    if (!ok) return;
    try {
      await documentosVencimientoService.eliminarAdjunto(id, adjuntoId);
      await refetch();
    } catch (err: unknown) {
      showAlert(
        "error",
        "Error",
        err instanceof Error ? err.message : "No se pudo eliminar",
      );
    }
  };

  const handleDeleteDoc = async () => {
    if (!doc) return;
    const ok = await showConfirm(
      "Eliminar documento",
      `¿Eliminar «${doc.titulo}»?`,
      { type: "error", confirmLabel: "Eliminar", cancelLabel: "Cancelar" },
    );
    if (!ok) return;
    try {
      await documentosVencimientoService.eliminar(id);
      await queryClient.invalidateQueries({
        queryKey: ["documentos-vencimiento", empresa?.id, categoria],
      });
      showAlert("success", "Eliminado", "Documento eliminado.");
      router.push(basePath);
    } catch (err: unknown) {
      showAlert(
        "error",
        "Error",
        err instanceof Error ? err.message : "No se pudo eliminar",
      );
    }
  };

  if (isLoading) {
    return (
      <div className="w-full space-y-3">
        {[1, 2].map((i) => (
          <div
            key={i}
            className="h-40 bg-white border border-slate-200 rounded-2xl animate-pulse"
          />
        ))}
      </div>
    );
  }

  if (!doc || doc.categoria !== categoria) {
    return (
      <div className="w-full text-center py-16 bg-white border border-slate-200 rounded-2xl">
        <p className="text-slate-600 font-semibold">Documento no encontrado.</p>
        <Link
          href={basePath}
          className="inline-flex mt-4 text-sm font-bold text-brand-secondary hover:underline"
        >
          Volver al listado
        </Link>
      </div>
    );
  }

  const sinVenceDoc = Boolean(doc.sin_vencimiento || !doc.fecha_vencimiento);
  const dias = (() => {
    if (sinVenceDoc || !doc.fecha_vencimiento) return null;
    const hoy = new Date();
    hoy.setHours(12, 0, 0, 0);
    const target = new Date(doc.fecha_vencimiento + "T12:00:00");
    return Math.round((target.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24));
  })();

  return (
    <div className="w-full space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <Link
          href={basePath}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-brand-primary"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver al listado
        </Link>
        {canWrite && (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={saving}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-brand-primary text-white text-sm font-bold hover:bg-brand-primary/95 disabled:opacity-60 cursor-pointer"
            >
              {saving ? (
                <Loader className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Guardar cambios
            </button>
            <button
              type="button"
              onClick={() => void handleDeleteDoc()}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-rose-200 text-rose-700 text-sm font-bold hover:bg-rose-50 cursor-pointer"
            >
              <Trash2 className="h-4 w-4" />
              Eliminar
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-5">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-2xs space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h1 className="text-2xl font-black text-slate-900">
                  {canWrite ? (
                    <input
                      value={titulo}
                      onChange={(e) => setTitulo(e.target.value)}
                      className="w-full bg-transparent border-b border-transparent focus:border-brand-secondary outline-none font-black"
                    />
                  ) : (
                    doc.titulo
                  )}
                </h1>
                <p className="mt-2 inline-flex items-center gap-1.5 text-sm text-slate-600">
                  <Calendar className="h-4 w-4 text-brand-primary" />
                  {dias === null
                    ? "Sin vencimiento"
                    : dias < 0
                      ? `Vencido hace ${Math.abs(dias)} días`
                      : `Vence en ${dias} días`}
                </p>
              </div>
              <span
                className={`text-xs font-bold px-2.5 py-1 rounded-lg border ${
                  dias === null
                    ? "bg-slate-50 text-slate-600 border-slate-200"
                    : dias <= 30
                      ? "bg-amber-50 text-amber-800 border-amber-200"
                      : "bg-sky-50 text-sky-700 border-sky-100"
                }`}
              >
                {dias === null
                  ? "Sin vencimiento"
                  : dias <= 30
                    ? "Prioritario"
                    : "En seguimiento"}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-100">
              <div>
                <label className="block text-xs font-bold uppercase text-slate-500 mb-1">
                  Tipo
                </label>
                {canWrite ? (
                  <input
                    value={tipo}
                    onChange={(e) => setTipo(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-brand-input-bg px-3 py-2 text-sm"
                  />
                ) : (
                  <p className="text-sm font-semibold text-slate-800">
                    {doc.tipo || "—"}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <label className="block text-xs font-bold uppercase text-slate-500">
                  Fecha de vencimiento
                </label>
                {canWrite ? (
                  <>
                    <label className="inline-flex items-center gap-2 select-none cursor-pointer">
                      <input
                        type="checkbox"
                        checked={sinVencimiento}
                        onChange={(e) => {
                          setSinVencimiento(e.target.checked);
                          if (e.target.checked) setFecha("");
                        }}
                        className="h-4 w-4 rounded border-slate-300 text-brand-primary focus:ring-brand-secondary/30 cursor-pointer"
                      />
                      <span className="text-sm font-semibold text-slate-700">
                        Sin vencimiento
                      </span>
                    </label>
                    <input
                      type="date"
                      value={fecha}
                      onChange={(e) => setFecha(e.target.value)}
                      disabled={sinVencimiento}
                      className="w-full rounded-xl border border-slate-200 bg-brand-input-bg px-3 py-2 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                    />
                  </>
                ) : (
                  <p className="text-sm font-semibold text-slate-800">
                    {sinVenceDoc || !doc.fecha_vencimiento
                      ? "Sin vencimiento"
                      : new Date(
                          doc.fecha_vencimiento + "T12:00:00",
                        ).toLocaleDateString("es-AR")}
                  </p>
                )}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase text-slate-500 mb-1">
                Notas
              </label>
              {canWrite ? (
                <textarea
                  value={notas}
                  onChange={(e) => setNotas(e.target.value)}
                  rows={4}
                  className="w-full rounded-xl border border-slate-200 bg-brand-input-bg px-3 py-2.5 text-sm"
                />
              ) : (
                <p className="text-sm text-slate-600 whitespace-pre-wrap">
                  {doc.notas || "Sin notas"}
                </p>
              )}
            </div>
          </div>
        </div>

        <section className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-2xs h-fit">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
            <div className="flex items-center gap-2">
              <Paperclip className="h-4 w-4 text-brand-primary" />
              <h2 className="font-bold text-slate-900">Adjuntos</h2>
            </div>
            {canWrite && (
              <label className="inline-flex items-center gap-1.5 text-sm font-bold text-brand-secondary cursor-pointer hover:text-brand-primary">
                {uploading ? (
                  <Loader className="h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4" />
                )}
                Subir
                <input
                  type="file"
                  accept={ACCEPT}
                  multiple
                  className="hidden"
                  disabled={uploading}
                  onChange={(e) => void handleUpload(e.target.files)}
                />
              </label>
            )}
          </div>
          {(doc.adjuntos || []).length === 0 ? (
            <p className="px-5 py-10 text-sm text-slate-500 text-center">
              Sin archivos adjuntos. Subí el PDF o informe de respaldo.
            </p>
          ) : (
            <ul className="divide-y divide-slate-50">
              {(doc.adjuntos || []).map((adj) => (
                <li
                  key={adj.id}
                  className="px-5 py-3.5 flex items-center justify-between gap-3 hover:bg-slate-50/80"
                >
                  <a
                    href={adj.url_firmada || adj.url || "#"}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-sm font-semibold text-slate-800 hover:text-brand-secondary min-w-0"
                  >
                    <ExternalLink className="h-4 w-4 shrink-0 text-brand-primary" />
                    <span className="truncate">{adj.nombre_original}</span>
                  </a>
                  {canWrite && (
                    <button
                      type="button"
                      onClick={() => void handleDeleteAdjunto(adj.id)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer"
                      aria-label="Eliminar adjunto"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
