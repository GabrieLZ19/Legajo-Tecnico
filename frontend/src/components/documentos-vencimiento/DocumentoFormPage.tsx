"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, FilePlus2, Loader, Upload, X } from "lucide-react";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import { useAlert } from "@/context/AlertContext";
import { documentosVencimientoService } from "@/utils/services/documentosVencimiento.service";
import type { CategoriaDocumento } from "@/types";
import { useQueryClient } from "@tanstack/react-query";

const ACCEPT =
  ".jpg,.jpeg,.png,.webp,.pdf,.doc,.docx,image/jpeg,image/png,image/webp,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document";

const TIPOS_MEDICION = [
  "Iluminación",
  "Ruido",
  "PT",
  "Vibraciones",
  "Estrés térmico",
  "Mat. Particulado",
  "Ergonomía",
  "Carga de fuego",
  "Informe general",
  "Otro",
];

const TIPOS_ART = [
  "Visita de ART",
  "RAR",
  "RGRL",
  "Programa de seguridad",
  "Aviso de obra",
  "Informe general",
  "Otro",
];

type Props = {
  categoria: CategoriaDocumento;
  basePath: string;
  tituloPagina: string;
};

export function DocumentoFormPage({
  categoria,
  basePath,
  tituloPagina,
}: Props) {
  const { empresa } = useAuth();
  const { showAlert } = useAlert();
  const router = useRouter();
  const queryClient = useQueryClient();

  const tipos = categoria === "medicion" ? TIPOS_MEDICION : TIPOS_ART;
  const [titulo, setTitulo] = useState("");
  const [tipo, setTipo] = useState(tipos[0]);
  const [tipoOtro, setTipoOtro] = useState("");
  const [fecha, setFecha] = useState("");
  const [sinVencimiento, setSinVencimiento] = useState(false);
  const [notas, setNotas] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!empresa?.id) return;
    const tipoFinal = tipo === "Otro" ? tipoOtro.trim() : tipo;
    if (!titulo.trim() || !tipoFinal || (!sinVencimiento && !fecha)) {
      showAlert(
        "warning",
        "Datos incompletos",
        sinVencimiento
          ? "Completá título y tipo."
          : "Completá título, tipo y fecha de vencimiento.",
      );
      return;
    }
    setSaving(true);
    try {
      const doc = await documentosVencimientoService.crear({
        empresa_id: empresa.id,
        categoria,
        titulo: titulo.trim(),
        tipo: tipoFinal,
        sin_vencimiento: sinVencimiento,
        fecha_vencimiento: sinVencimiento ? null : fecha,
        notas: notas.trim() || null,
        files,
      });
      await queryClient.invalidateQueries({
        queryKey: ["documentos-vencimiento", empresa.id, categoria],
      });
      await queryClient.invalidateQueries({
        queryKey: ["documentos-proximos", empresa.id],
      });
      await queryClient.invalidateQueries({
        queryKey: ["documentos-tipos", empresa.id, categoria],
      });
      showAlert("success", "Guardado", "El documento se creó correctamente.");
      router.push(`${basePath}/${doc.id}`);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: string } } };
      showAlert(
        "error",
        "Error",
        axiosErr.response?.data?.error ||
          (err instanceof Error ? err.message : "No se pudo guardar"),
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="w-full space-y-6">
      <Link
        href={basePath}
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-brand-primary"
      >
        <ArrowLeft className="h-4 w-4" />
        Volver al listado
      </Link>

      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <span className="text-sm font-semibold text-slate-500 flex items-center gap-1.5">
            <FilePlus2 className="h-4 w-4 text-brand-primary" />
            Alta de documento
          </span>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight mt-1">
            {tituloPagina}
          </h1>
          <p className="text-sm text-brand-text-muted mt-1">
            Adjuntá PDF, Word o imágenes y asigná tipo. Si tiene vencimiento,
            aparece en la matriz del panel de inicio.
          </p>
        </div>
      </div>

      <form
        onSubmit={(e) => void handleSubmit(e)}
        className="grid grid-cols-1 lg:grid-cols-3 gap-6"
      >
        <div className="lg:col-span-2 space-y-5 bg-white border border-slate-200 rounded-2xl p-6 shadow-2xs">
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1.5">
              Título
            </label>
            <input
              type="text"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-brand-input-bg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-secondary/30 focus:border-brand-secondary"
              placeholder={
                categoria === "medicion"
                  ? "Ej. Medición de ruido — Planta"
                  : "Ej. Plan de evacuación 2026"
              }
              required
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1.5">
              Tipo / sección
            </label>
            <div className="flex flex-wrap gap-2 mb-2">
              {tipos.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTipo(t)}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
                    tipo === t
                      ? "bg-brand-primary text-white shadow-md"
                      : "bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
            {tipo === "Otro" && (
              <input
                type="text"
                value={tipoOtro}
                onChange={(e) => setTipoOtro(e.target.value)}
                placeholder="Indicá el tipo"
                className="w-full rounded-xl border border-slate-200 bg-brand-input-bg px-3 py-2.5 text-sm"
                required
              />
            )}
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-bold text-slate-700">
              Fecha de vencimiento
            </label>
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
              className="w-full rounded-xl border border-slate-200 bg-brand-input-bg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-secondary/30 focus:border-brand-secondary disabled:opacity-50 disabled:cursor-not-allowed"
              required={!sinVencimiento}
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1.5">
              Notas (opcional)
            </label>
            <textarea
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              rows={4}
              className="w-full rounded-xl border border-slate-200 bg-brand-input-bg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-secondary/30 focus:border-brand-secondary"
              placeholder="Observaciones, sector, laboratorio, etc."
            />
          </div>
        </div>

        <div className="space-y-5">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-2xs">
            <label className="block text-sm font-bold text-slate-700 mb-3">
              Archivos de respaldo
            </label>
            <label className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-10 cursor-pointer hover:bg-blue-50/40 hover:border-brand-secondary/40 transition-colors">
              <Upload className="h-7 w-7 text-brand-primary" />
              <span className="text-sm font-semibold text-slate-700 text-center">
                PDF, Word, JPG, PNG o WEBP
              </span>
              <span className="text-xs text-slate-500">Máx. 10 MB por archivo</span>
              <input
                type="file"
                accept={ACCEPT}
                multiple
                className="hidden"
                onChange={(e) =>
                  setFiles((prev) => [
                    ...prev,
                    ...Array.from(e.target.files || []),
                  ])
                }
              />
            </label>
            {files.length > 0 && (
              <ul className="mt-4 space-y-2">
                {files.map((f, idx) => (
                  <li
                    key={f.name + f.size + idx}
                    className="flex items-center justify-between gap-2 text-sm bg-slate-50 border border-slate-100 rounded-xl px-3 py-2"
                  >
                    <span className="truncate text-slate-700">{f.name}</span>
                    <button
                      type="button"
                      onClick={() =>
                        setFiles((prev) => prev.filter((_, i) => i !== idx))
                      }
                      className="p-1 text-slate-400 hover:text-rose-600 cursor-pointer"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="bg-brand-primary text-white rounded-2xl p-5 shadow-lg">
            <p className="text-sm font-bold">Recordatorio</p>
            <p className="text-xs text-blue-100 mt-1 leading-relaxed">
              Los vencimientos próximos (60 / 30 días) aparecen en el panel de
              inicio. La matriz completa vive en este módulo.
            </p>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-brand-primary hover:bg-brand-primary/95 text-white py-3.5 text-sm font-bold shadow-md shadow-blue-900/10 disabled:opacity-60 cursor-pointer"
          >
            {saving && <Loader className="h-4 w-4 animate-spin" />}
            Guardar documento
          </button>
        </div>
      </form>
    </div>
  );
}
