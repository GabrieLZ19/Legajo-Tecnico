"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  CalendarRange,
  Download,
  FileSpreadsheet,
  FileText,
  Upload,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useAlert } from "@/context/AlertContext";
import {
  listarAniosPlanAnual,
  obtenerPlanAnual,
  PlanAnualAnioItem,
  PlanAnualResponse,
  subirPlanAnual,
  descargarPlantillaPlanAnual,
} from "@/lib/planAnual";

const currentYear = new Date().getFullYear();

export default function PlanAnualPage() {
  const { user, empresa } = useAuth();
  const { showAlert } = useAlert();
  const fileRef = useRef<HTMLInputElement>(null);

  const canUpload = user?.rol === "preventor" || user?.rol === "admin";

  const [anio, setAnio] = useState(currentYear);
  const [aniosDisponibles, setAniosDisponibles] = useState<PlanAnualAnioItem[]>(
    [],
  );
  const [data, setData] = useState<PlanAnualResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  const aniosSelect = useMemo(() => {
    const set = new Set<number>([currentYear, anio]);
    aniosDisponibles.forEach((a) => set.add(a.anio));
    // Incluir algunos años anteriores para poder subir/ver
    for (let y = currentYear; y >= currentYear - 8; y -= 1) set.add(y);
    return Array.from(set).sort((a, b) => b - a);
  }, [aniosDisponibles, anio]);

  const esPdf = useMemo(() => {
    if (data?.tipo === "pdf") return true;
    const nombre = data?.plan?.archivo_nombre?.toLowerCase() || "";
    const mime = data?.plan?.archivo_mime?.toLowerCase() || "";
    return nombre.endsWith(".pdf") || mime.includes("pdf");
  }, [data]);

  const load = async (year: number) => {
    if (!empresa?.id) return;
    setLoading(true);
    try {
      const [plan, anios] = await Promise.all([
        obtenerPlanAnual(empresa.id, year),
        listarAniosPlanAnual(empresa.id),
      ]);
      setData(plan);
      setAniosDisponibles(anios);
    } catch (err) {
      console.error(err);
      showAlert("error", "Error", "No se pudo cargar el plan anual.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (empresa?.id) load(anio);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empresa?.id, anio]);

  const handleUpload = async (file: File | null) => {
    if (!file || !empresa?.id) return;

    const name = file.name.toLowerCase();
    const isExcel = name.endsWith(".xls") || name.endsWith(".xlsx");
    const isPdf = name.endsWith(".pdf") || file.type === "application/pdf";
    if (!isExcel && !isPdf) {
      showAlert(
        "warning",
        "Archivo inválido",
        "Solo se permiten archivos Excel (.xls o .xlsx) o PDF.",
      );
      return;
    }

    if (data?.plan) {
      const ok = window.confirm(
        `Ya existe un plan para ${anio}. ¿Querés reemplazarlo? (Se sube una vez por año)`,
      );
      if (!ok) {
        if (fileRef.current) fileRef.current.value = "";
        return;
      }
    }

    setUploading(true);
    try {
      await subirPlanAnual({
        empresaId: empresa.id,
        anio,
        archivo: file,
      });
      showAlert(
        "success",
        "Plan cargado",
        `El plan anual ${anio} se guardó correctamente.`,
      );
      await load(anio);
    } catch (err: any) {
      showAlert(
        "error",
        "Error al subir",
        err.response?.data?.error || "No se pudo subir el archivo.",
      );
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href="/capacitaciones"
            className="h-10 w-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center hover:bg-slate-50"
          >
            <ArrowLeft className="h-5 w-5 text-slate-600" />
          </Link>
          <div>
            <span className="text-sm font-semibold text-slate-500 flex items-center gap-1.5">
              <CalendarRange className="h-4 w-4" /> Capacitaciones
            </span>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">
              Plan anual
            </h1>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
            Año
          </label>
          <select
            value={anio}
            onChange={(e) => setAnio(Number(e.target.value))}
            className="px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-800"
          >
            {aniosSelect.map((y) => (
              <option key={y} value={y}>
                {y}
                {y === currentYear ? " (en curso)" : ""}
                {aniosDisponibles.some((a) => a.anio === y) ? "" : " — sin plan"}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
              Plan {anio}
            </h2>
            <p className="text-xs text-slate-500 font-semibold mt-1">
              Registro anual en Excel o PDF. Se carga una vez por año (podés
              reemplazarlo si hace falta).
            </p>
            {data?.plan && (
              <p className="text-xs text-slate-600 font-semibold mt-2">
                Archivo:{" "}
                <span className="text-slate-900">{data.plan.archivo_nombre}</span>
                {" · "}
                Actualizado{" "}
                {new Date(data.plan.updated_at).toLocaleDateString("es-AR")}
              </p>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={async () => {
                try {
                  await descargarPlantillaPlanAnual(anio);
                } catch (err) {
                  console.error(err);
                  showAlert(
                    "error",
                    "Error",
                    "No se pudo descargar la plantilla.",
                  );
                }
              }}
              className="inline-flex items-center gap-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-bold px-4 py-2.5 rounded-xl text-xs"
            >
              <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" />
              Descargar plantilla
            </button>
            {data?.downloadUrl && (
              <a
                href={data.downloadUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 font-bold px-4 py-2.5 rounded-xl text-xs"
              >
                <Download className="h-3.5 w-3.5" />
                {esPdf ? "Descargar PDF" : "Descargar Excel"}
              </a>
            )}
            {canUpload && (
              <>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".xls,.xlsx,.pdf,application/pdf,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                  className="hidden"
                  onChange={(e) => handleUpload(e.target.files?.[0] || null)}
                />
                <button
                  type="button"
                  disabled={uploading}
                  onClick={() => fileRef.current?.click()}
                  className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold px-4 py-2.5 rounded-xl text-xs disabled:opacity-50"
                >
                  <Upload className="h-3.5 w-3.5" />
                  {uploading
                    ? "Subiendo..."
                    : data?.plan
                      ? "Reemplazar archivo"
                      : "Subir Excel o PDF"}
                </button>
              </>
            )}
          </div>
        </div>

        {!data?.plan && !loading && (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center space-y-3">
            <FileSpreadsheet className="h-8 w-8 text-slate-400 mx-auto" />
            <p className="text-sm font-bold text-slate-700">
              Todavía no hay plan cargado para {anio}
            </p>
            <p className="text-xs text-slate-500 font-semibold max-w-md mx-auto">
              Podés subir el Excel (columnas N°, Peligro, TEMA, PROPUESTA, REAL)
              o un PDF del plan anual.
            </p>
          </div>
        )}
      </div>

      {loading ? (
        <div className="h-48 bg-white border border-slate-200 rounded-2xl animate-pulse" />
      ) : esPdf && data?.downloadUrl ? (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-2">
            <FileText className="h-4 w-4 text-rose-600" />
            <h3 className="text-sm font-bold text-slate-900">
              {data.plan?.archivo_nombre || `Plan anual ${anio}`}
            </h3>
          </div>
          <iframe
            title={`Plan anual ${anio}`}
            src={data.downloadUrl}
            className="w-full h-[70vh] bg-slate-50"
          />
        </div>
      ) : data?.preview?.filas?.length ? (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100">
            <h3 className="text-sm font-bold text-slate-900">
              {data.preview.titulo || `Plan anual de capacitación — ${anio}`}
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  <th className="px-4 py-3 w-14">N°</th>
                  <th className="px-4 py-3">Peligro</th>
                  <th className="px-4 py-3">Tema</th>
                  <th className="px-4 py-3">Propuesta</th>
                  <th className="px-4 py-3">Real</th>
                </tr>
              </thead>
              <tbody>
                {data.preview.filas.map((fila, idx) => (
                  <tr
                    key={idx}
                    className="border-t border-slate-100 text-slate-700"
                  >
                    <td className="px-4 py-3 font-bold text-slate-500">
                      {fila.n || idx + 1}
                    </td>
                    <td className="px-4 py-3 font-semibold">{fila.peligro || "—"}</td>
                    <td className="px-4 py-3 font-semibold">{fila.tema || "—"}</td>
                    <td className="px-4 py-3">{fila.propuesta || "—"}</td>
                    <td className="px-4 py-3">{fila.real || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : data?.plan ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center space-y-2">
          <p className="text-sm font-bold text-slate-700">
            El archivo quedó guardado
          </p>
          <p className="text-xs text-slate-500 font-semibold">
            Descargalo para verlo. Si es un Excel con otro formato, la tabla
            previa puede no mostrarse.
          </p>
        </div>
      ) : null}

      {aniosDisponibles.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-3">
            Años cargados
          </h3>
          <div className="flex flex-wrap gap-2">
            {aniosDisponibles.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setAnio(item.anio)}
                className={`px-4 py-2 rounded-full text-xs font-bold border transition-all ${
                  anio === item.anio
                    ? "bg-blue-600 text-white border-blue-600"
                    : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                }`}
              >
                {item.anio}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
