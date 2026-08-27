"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Calendar,
  Download,
  FileUp,
  GraduationCap,
  Save,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useAlert } from "@/context/AlertContext";
import { useCapacitaciones } from "@/hooks/useCapacitaciones";

export default function RegistroManualCapacitacionPage() {
  const { empresa } = useAuth();
  const { showAlert } = useAlert();
  const router = useRouter();
  const { crearRegistroManual, descargarPlantillaRegistroManual } =
    useCapacitaciones();

  const today = new Date();
  const defaultFecha = today.toISOString().slice(0, 10);
  const defaultHora = `${String(today.getHours()).padStart(2, "0")}:${String(
    today.getMinutes(),
  ).padStart(2, "0")}`;

  const [titulo, setTitulo] = useState("");
  const [fecha, setFecha] = useState(defaultFecha);
  const [hora, setHora] = useState(defaultHora);
  const [instructor, setInstructor] = useState("");
  const [cantidadHoras, setCantidadHoras] = useState("");
  const [archivo, setArchivo] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const buildFechaIso = () => {
    if (!fecha || !hora) return null;
    const fechaIso = new Date(`${fecha}T${hora}:00`);
    if (Number.isNaN(fechaIso.getTime())) return null;
    return fechaIso;
  };

  const fechasHorarioLabel = () =>
    `${fecha.split("-").reverse().join("/")} ${hora}`;

  const handleDescargarPlantilla = async () => {
    if (!empresa?.id) {
      setError("No hay empresa seleccionada.");
      return;
    }
    const fechaIso = buildFechaIso();
    if (!fechaIso) {
      setError("Completá fecha y hora antes de descargar la plantilla.");
      return;
    }

    setDownloading(true);
    setError(null);
    try {
      const blob = await descargarPlantillaRegistroManual({
        empresa_id: empresa.id,
        titulo: titulo.trim() || undefined,
        fecha: fechaIso.toISOString(),
        instructor: instructor.trim() || undefined,
        fechas_horario: fechasHorarioLabel(),
        cantidad_horas: cantidadHoras.trim() || undefined,
      });
      const url = window.URL.createObjectURL(
        new Blob([blob], { type: "application/pdf" }),
      );
      const link = document.createElement("a");
      link.href = url;
      link.download = "plantilla_registro_capacitacion.pdf";
      link.click();
      window.URL.revokeObjectURL(url);
      showAlert(
        "success",
        "Plantilla lista",
        "Imprimila, completá firmas en papel y después subí el escaneo acá.",
      );
    } catch (err: any) {
      setError(
        err.response?.data?.error ||
          "No se pudo descargar la plantilla del registro.",
      );
    } finally {
      setDownloading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!empresa?.id) {
      setError("No hay empresa seleccionada.");
      return;
    }
    const fechaIso = buildFechaIso();
    if (!fechaIso) {
      setError("Completá la fecha y la hora del registro.");
      return;
    }
    if (!archivo) {
      setError("Adjuntá el registro escaneado (imagen o PDF).");
      return;
    }

    const formData = new FormData();
    formData.append("empresa_id", empresa.id);
    formData.append("fecha", fechaIso.toISOString());
    formData.append("fechas_horario", fechasHorarioLabel());
    if (titulo.trim()) formData.append("titulo", titulo.trim());
    if (instructor.trim()) formData.append("instructor", instructor.trim());
    if (cantidadHoras.trim())
      formData.append("cantidad_horas", cantidadHoras.trim());
    formData.append("archivo", archivo);

    setSaving(true);
    try {
      const cap = await crearRegistroManual(formData);
      showAlert(
        "success",
        "Registro cargado",
        "El registro en papel quedó ingresado en el historial por fecha.",
      );
      router.push(`/capacitaciones/${cap.id}`);
    } catch (err: any) {
      setError(
        err.response?.data?.error || "No se pudo cargar el registro manual.",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      <div className="flex items-center gap-4">
        <Link
          href="/capacitaciones"
          className="h-10 w-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center hover:bg-slate-50 transition-colors"
        >
          <ArrowLeft className="h-5 w-5 text-slate-600" />
        </Link>
        <div>
          <span className="text-sm font-semibold text-slate-500 flex items-center gap-1.5">
            <GraduationCap className="h-4 w-4" /> Capacitaciones
          </span>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">
            Registro manual
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Usá la plantilla tipificada, firmala en papel y subí el escaneo al
            historial.
          </p>
        </div>
      </div>

      <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-5 space-y-2">
        <p className="text-xs font-black text-indigo-900 uppercase tracking-wider">
          Cómo funciona
        </p>
        <ol className="text-sm text-indigo-900/80 font-semibold space-y-1 list-decimal pl-4">
          <li>Completá fecha/hora (y título si querés).</li>
          <li>Descargá la plantilla base del registro e imprimila.</li>
          <li>Dá la charla y hacé firmar el papel.</li>
          <li>Escaneá o fotografiá el registro y subilo acá.</li>
        </ol>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <div className="rounded-xl bg-red-50 border border-red-100 p-4 text-sm text-red-800 font-semibold">
            {error}
          </div>
        )}

        <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
          <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
            <Calendar className="h-4 w-4 text-blue-600" />
            Datos del registro
          </h2>

          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Título (opcional)
            </label>
            <input
              type="text"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Ej: Uso de matafuegos — charla presencial"
              className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm font-semibold"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                Fecha *
              </label>
              <input
                type="date"
                required
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
                className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm font-semibold"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                Hora *
              </label>
              <input
                type="time"
                required
                value={hora}
                onChange={(e) => setHora(e.target.value)}
                className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm font-semibold"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                Instructor (opcional)
              </label>
              <input
                type="text"
                value={instructor}
                onChange={(e) => setInstructor(e.target.value)}
                placeholder="Nombre del capacitador"
                className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm font-semibold"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                Cantidad de horas (opcional)
              </label>
              <input
                type="text"
                value={cantidadHoras}
                onChange={(e) => setCantidadHoras(e.target.value)}
                placeholder="Ej: 1"
                className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm font-semibold"
              />
            </div>
          </div>

          <button
            type="button"
            onClick={() => void handleDescargarPlantilla()}
            disabled={downloading}
            className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-sm flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <Download className="h-4 w-4" />
            {downloading
              ? "Generando plantilla..."
              : "Descargar plantilla base (PDF)"}
          </button>
          <p className="text-[11px] text-slate-500 font-semibold text-center">
            La plantilla usa el mismo formato oficial del registro digital, con
            logo de la empresa y filas en blanco para firmas.
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
          <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
            <FileUp className="h-4 w-4 text-blue-600" />
            Subir registro firmado *
          </h2>
          <p className="text-xs text-slate-500 font-semibold">
            Foto o PDF del registro ya completado en papel (máx. 10 MB).
          </p>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,application/pdf,.jpg,.jpeg,.png,.webp,.pdf"
            onChange={(e) => setArchivo(e.target.files?.[0] || null)}
            className="block w-full text-sm text-slate-600 file:mr-4 file:py-2.5 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer"
          />
          {archivo && (
            <p className="text-xs font-semibold text-slate-600">
              Seleccionado: {archivo.name}
            </p>
          )}
        </div>

        <button
          type="submit"
          disabled={saving}
          className="w-full py-4 bg-brand-primary hover:bg-brand-primary/95 text-white font-bold rounded-xl shadow-md text-sm flex items-center justify-center gap-2 disabled:opacity-50"
        >
          <Save className="h-4 w-4" />
          {saving ? "Cargando..." : "Ingresar registro al historial"}
        </button>
      </form>
    </div>
  );
}
