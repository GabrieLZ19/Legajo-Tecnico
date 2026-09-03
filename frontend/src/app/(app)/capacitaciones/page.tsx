"use client";

import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Capacitacion } from "@/types";
import Link from "next/link";
import {
  GraduationCap,
  Plus,
  Users,
  HelpCircle,
  ChevronRight,
  Calendar,
  BookOpen,
  CalendarRange,
  FileUp,
  Download,
  Database,
  CheckCircle2,
} from "lucide-react";

import { useCapacitaciones } from "@/hooks/useCapacitaciones";
import { canWriteAppModule } from "@/lib/moduleAccess";
import { useAlert } from "@/context/AlertContext";
import { VisibleEnteToggle } from "@/components/VisibleEnteToggle";
import { actualizarVisibilidadCapacitacion } from "@/lib/visibilidadEnte";

export default function CapacitacionesPage() {
  const { user, empresa } = useAuth();
  const { showAlert } = useAlert();
  const { getCapacitaciones, adjuntarRegistroManualCapacitacion, descargarPlantillaRegistroCapacitacion } =
    useCapacitaciones();
  const [capacitaciones, setCapacitaciones] = useState<Capacitacion[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroEstado, setFiltroEstado] = useState<string>("todas");
  const [uploadingRegistroId, setUploadingRegistroId] = useState<string | null>(
    null,
  );
  const [downloadingPlantillaId, setDownloadingPlantillaId] = useState<
    string | null
  >(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadTargetIdRef = useRef<string | null>(null);

  const canCreate = canWriteAppModule(user, "capacitaciones");
  const canEdit = canCreate;
  const canViewPlan = !!user;

  useEffect(() => {
    if (empresa?.id) {
      fetchCapacitaciones();
    }
  }, [empresa?.id]);

  const fetchCapacitaciones = async () => {
    setLoading(true);
    try {
      const data = await getCapacitaciones(empresa!.id);
      setCapacitaciones(data || []);
    } catch (err) {
      console.error("Error cargando capacitaciones:", err);
    } finally {
      setLoading(false);
    }
  };

  const estadoColor = (estado: string) => {
    switch (estado) {
      case "activa":
        return "bg-emerald-50 text-emerald-700 border-emerald-100";
      case "borrador":
        return "bg-amber-50 text-amber-700 border-amber-100";
      case "cerrada":
        return "bg-slate-100 text-slate-600 border-slate-200";
      default:
        return "bg-slate-100 text-slate-600 border-slate-200";
    }
  };

  const filtered = (
    filtroEstado === "todas"
      ? capacitaciones
      : capacitaciones.filter((c) => c.estado === filtroEstado)
  ).filter((c) => user?.rol !== "ente_regulador" || Boolean(c.visible_ente_regulador));

  const handleInsertarRegistro = (capId: string) => {
    uploadTargetIdRef.current = capId;
    fileInputRef.current?.click();
  };

  const handleDescargarPlantilla = async (cap: Capacitacion) => {
    setDownloadingPlantillaId(cap.id);
    try {
      const blob = await descargarPlantillaRegistroCapacitacion(cap.id);
      const url = window.URL.createObjectURL(
        new Blob([blob], { type: "application/pdf" }),
      );
      const link = document.createElement("a");
      link.href = url;
      link.download = `plantilla_registro_${cap.titulo.replace(/[^\w.\-]+/g, "_").slice(0, 60)}.pdf`;
      link.click();
      window.URL.revokeObjectURL(url);
      showAlert(
        "success",
        "Plantilla lista",
        "Imprimila, completá las firmas en papel y después subí el escaneo con «Insertar registro».",
      );
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: string } } };
      showAlert(
        "error",
        "Error al descargar",
        axiosErr.response?.data?.error ||
          "No se pudo descargar la plantilla del registro.",
      );
    } finally {
      setDownloadingPlantillaId(null);
    }
  };

  const handleRegistroFileSelected = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    const capId = uploadTargetIdRef.current;
    e.target.value = "";
    uploadTargetIdRef.current = null;

    if (!file || !capId) return;

    setUploadingRegistroId(capId);
    try {
      const updated = await adjuntarRegistroManualCapacitacion(capId, file);
      setCapacitaciones((prev) =>
        prev.map((c) =>
          c.id === capId
            ? {
                ...c,
                registro_manual_url: updated.registro_manual_url,
                registro_manual_nombre: updated.registro_manual_nombre,
              }
            : c,
        ),
      );
      showAlert(
        "success",
        "Registro cargado",
        "El registro en papel quedó adjunto a la capacitación.",
      );
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: string } } };
      showAlert(
        "error",
        "Error al cargar",
        axiosErr.response?.data?.error ||
          "No se pudo adjuntar el registro manual.",
      );
    } finally {
      setUploadingRegistroId(null);
    }
  };

  const handleVisibilidadChange = async (id: string, visible: boolean) => {
    try {
      await actualizarVisibilidadCapacitacion(id, visible);
      setCapacitaciones((prev) =>
        prev.map((c) =>
          c.id === id ? { ...c, visible_ente_regulador: visible } : c,
        ),
      );
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: string } } };
      showAlert(
        "error",
        "Error",
        axiosErr.response?.data?.error ||
          "No se pudo actualizar la visibilidad ante el ente regulador.",
      );
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <span className="text-sm font-semibold text-slate-500 flex items-center gap-1.5">
            <GraduationCap className="h-4 w-4" /> Módulo de Capacitaciones
          </span>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight mt-1">
            Capacitaciones
          </h1>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
            {canViewPlan && (
              <Link
                href="/capacitaciones/plan-anual"
                className="inline-flex items-center justify-center gap-2 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 font-bold px-5 py-3 rounded-xl text-sm cursor-pointer"
              >
                <CalendarRange className="h-4 w-4 text-blue-600" />
                Plan anual
              </Link>
            )}
            {canCreate && (
              <>
                <Link
                  href="/capacitaciones/biblioteca"
                  className="inline-flex items-center justify-center gap-2 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 font-bold px-5 py-3 rounded-xl text-sm cursor-pointer"
                >
                  <BookOpen className="h-4 w-4" />
                  Biblioteca
                </Link>
                <Link
                  href="/capacitaciones/registro-manual"
                  className="inline-flex items-center justify-center gap-2 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 font-bold px-5 py-3 rounded-xl text-sm cursor-pointer"
                >
                  <FileUp className="h-4 w-4 text-indigo-600" />
                  Registro manual
                </Link>
                <Link
                  href="/capacitaciones/nuevo"
                  className="inline-flex items-center justify-center gap-2 bg-brand-primary hover:bg-brand-primary/95 text-white font-bold px-5 py-3 rounded-xl shadow-md shadow-blue-900/10 hover:shadow-lg transition-all text-sm cursor-pointer"
                >
                  <Plus className="h-4 w-4 stroke-3" />
                  Nueva Capacitación
                </Link>
              </>
            )}
          </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex gap-2 flex-wrap">
        {[
          { key: "todas", label: "Todas" },
          { key: "activa", label: "Activas" },
          { key: "borrador", label: "Borradores" },
          { key: "cerrada", label: "Cerradas" },
        ].map((f) => (
          <button
            key={f.key}
            onClick={() => setFiltroEstado(f.key)}
            className={`px-4 py-2 rounded-full text-xs font-bold transition-all cursor-pointer ${
              filtroEstado === f.key
                ? "bg-blue-600 text-white shadow-md"
                : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
            }`}
          >
            {f.label}
          </button>
        ))}
        </div>

        {canViewPlan && (
          <Link
            href="/capacitaciones/base-datos"
            className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 font-bold text-xs cursor-pointer shrink-0"
          >
            <Database className="h-4 w-4 text-indigo-600" />
            Base de datos
          </Link>
        )}
      </div>

      {/* Lista */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-20 bg-white border border-slate-200 rounded-2xl animate-pulse"
            />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center">
          <GraduationCap className="h-12 w-12 text-slate-300 mx-auto mb-4" />
          <p className="text-sm text-slate-500 font-semibold">
            No hay capacitaciones registradas.
          </p>
          {canCreate && (
            <Link
              href="/capacitaciones/nuevo"
              className="inline-flex items-center gap-2 text-sm font-bold text-blue-600 mt-3 hover:underline"
            >
              <Plus className="h-4 w-4" />
              Crear la primera capacitación
            </Link>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,application/pdf,.jpg,.jpeg,.png,.webp,.pdf"
            className="hidden"
            onChange={(e) => void handleRegistroFileSelected(e)}
          />
          {filtered.map((cap) => (
            <div
              key={cap.id}
              className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs hover:border-slate-300 hover:shadow-md transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 group"
            >
              <Link
                href={`/capacitaciones/${cap.id}`}
                className="flex items-start sm:items-center gap-4 min-w-0 flex-1 cursor-pointer"
              >
                <div
                  className={`h-11 w-11 rounded-xl flex items-center justify-center shrink-0 ${
                    cap.origen === "manual"
                      ? "bg-indigo-50"
                      : "bg-purple-50"
                  }`}
                >
                  {cap.origen === "manual" ? (
                    <FileUp className="h-6 w-6 text-indigo-600" />
                  ) : (
                    <GraduationCap className="h-6 w-6 text-purple-600" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm font-bold text-slate-800 group-hover:text-blue-600 transition-colors truncate">
                    {cap.titulo}
                  </h3>
                  <div className="flex flex-wrap items-center gap-y-1.5 gap-x-3 mt-1.5">
                    <span className="text-[11px] text-slate-400 font-semibold flex items-center gap-1 shrink-0">
                      <Calendar className="h-3.5 w-3.5" />
                      {cap.fecha
                        ? new Date(cap.fecha).toLocaleString("es-AR", {
                            day: "2-digit",
                            month: "2-digit",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : ""}
                    </span>
                    {cap.origen === "manual" ? (
                      <span className="text-[11px] text-indigo-600 font-bold shrink-0">
                        Registro en papel
                      </span>
                    ) : (
                      <>
                        <span className="text-[11px] text-slate-400 font-semibold flex items-center gap-1 shrink-0">
                          <HelpCircle className="h-3.5 w-3.5" />
                          {cap.con_evaluacion === false
                            ? "Sin evaluación"
                            : `${cap.total_preguntas || 0} preguntas`}
                        </span>
                        <span className="text-[11px] text-slate-400 font-semibold flex items-center gap-1 shrink-0">
                          <Users className="h-3.5 w-3.5" />
                          {cap.total_asistencias || 0} asistencias
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </Link>
              <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 border-t border-slate-100 sm:border-t-0 pt-3 sm:pt-0 flex-wrap">
                {user?.rol === "ente_regulador" ? (
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full">
                    <CheckCircle2 className="h-3 w-3" /> Habilitado
                  </span>
                ) : (
                  <VisibleEnteToggle
                    checked={Boolean(cap.visible_ente_regulador)}
                    disabled={!canEdit}
                    onChange={(v) => void handleVisibilidadChange(cap.id, v)}
                  />
                )}
                {canCreate && cap.origen !== "manual" && (
                  cap.registro_manual_url ? (
                    <a
                      href={cap.registro_manual_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 text-[11px] font-bold whitespace-nowrap"
                    >
                      <Download className="h-3.5 w-3.5 text-indigo-600" />
                      Descargar registro manual
                    </a>
                  ) : (
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        disabled={downloadingPlantillaId === cap.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          void handleDescargarPlantilla(cap);
                        }}
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 text-[11px] font-bold whitespace-nowrap disabled:opacity-50 cursor-pointer"
                      >
                        <Download className="h-3.5 w-3.5 text-blue-600" />
                        {downloadingPlantillaId === cap.id
                          ? "Generando..."
                          : "Descargar plantilla"}
                      </button>
                      <button
                        type="button"
                        disabled={uploadingRegistroId === cap.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleInsertarRegistro(cap.id);
                        }}
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 text-[11px] font-bold whitespace-nowrap disabled:opacity-50 cursor-pointer"
                      >
                        <FileUp className="h-3.5 w-3.5" />
                        {uploadingRegistroId === cap.id
                          ? "Subiendo..."
                          : "Insertar registro"}
                      </button>
                    </div>
                  )
                )}
                <Link
                  href={`/capacitaciones/${cap.id}`}
                  className="flex items-center gap-3"
                >
                <span
                  className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider border ${estadoColor(
                    cap.estado,
                  )}`}
                >
                  {cap.estado}
                </span>
                <ChevronRight className="h-5 w-5 text-slate-300 group-hover:text-slate-500 transition-colors hidden sm:block" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
