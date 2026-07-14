"use client";

import React, { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { api } from "@/lib/api";
import { Capacitacion } from "@/types";
import Link from "next/link";
import {
  GraduationCap,
  ArrowLeft,
  QrCode,
  Users,
  CheckCircle2,
  XCircle,
  Download,
  Play,
  Square,
  Calendar,
  HelpCircle,
  Trash2,
  Pencil,
  Share2,
  Copy,
  Check,
  Mail,
  FileSpreadsheet,
  FileText,
  Search,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useRouter } from "next/navigation";
import { useAlert } from "@/context/AlertContext";

export default function DetalleCapacitacionPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const router = useRouter();
  const { showAlert } = useAlert();

  const [cap, setCap] = useState<Capacitacion | null>(null);
  const [loading, setLoading] = useState(true);
  const [qrData, setQrData] = useState<{ qr: string; url: string } | null>(null);
  const [loadingQr, setLoadingQr] = useState(false);
  const [updatingEstado, setUpdatingEstado] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);

  // Compartir
  const [showShareModal, setShowShareModal] = useState(false);
  const [copied, setCopied] = useState(false);

  // Filtros
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSector, setSelectedSector] = useState("todos");
  const [selectedEstado, setSelectedEstado] = useState("todos");

  // Exportación
  const [exportingExcel, setExportingExcel] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);

  const canDelete = user?.rol === "preventor" || user?.rol === "admin";
  const canManage = user?.rol === "preventor" || user?.rol === "admin";

  useEffect(() => {
    fetchCapacitacion();
  }, [id]);

  const fetchCapacitacion = async () => {
    setLoading(true);
    try {
      const { data } = await api.get(`/capacitaciones/${id}`);
      setCap(data);
    } catch (err) {
      console.error("Error:", err);
    } finally {
      setLoading(false);
    }
  };

  const generarQR = async () => {
    setLoadingQr(true);
    try {
      const { data } = await api.get(`/capacitaciones/${id}/qr`);
      setQrData(data);
    } catch (err) {
      console.error("Error generando QR:", err);
    } finally {
      setLoadingQr(false);
    }
  };

  const cambiarEstado = async (nuevoEstado: string) => {
    setUpdatingEstado(true);
    try {
      await api.patch(`/capacitaciones/${id}`, { estado: nuevoEstado });
      await fetchCapacitacion();
    } catch (err) {
      console.error("Error cambiando estado:", err);
    } finally {
      setUpdatingEstado(false);
    }
  };

  const eliminarCapacitacion = async () => {
    setDeleting(true);
    try {
      await api.delete(`/capacitaciones/${id}`);
      showAlert("success", "Eliminada", "La capacitación fue eliminada correctamente.");
      router.push("/capacitaciones");
    } catch (err) {
      console.error("Error eliminando capacitación:", err);
      showAlert("error", "Error", "No se pudo eliminar la capacitación.");
    } finally {
      setDeleting(false);
      setShowConfirmDelete(false);
    }
  };

  const descargarQR = () => {
    if (!qrData) return;
    const link = document.createElement("a");
    link.href = qrData.qr;
    link.download = `qr-capacitacion-${id}.png`;
    link.click();
  };

  const handleExportExcel = async () => {
    setExportingExcel(true);
    try {
      const response = await api.get(`/capacitaciones/${id}/exportar?format=csv&search=${searchQuery}&sector=${selectedSector !== "todos" ? selectedSector : ""}&estado=${selectedEstado !== "todos" ? selectedEstado : ""}`, {
        responseType: "blob",
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `asistencias_capacitacion_${id}.csv`);
      document.body.appendChild(link);
      link.click();
      link.parentNode?.removeChild(link);
      showAlert("success", "Exportación exitosa", "Las asistencias se han exportado correctamente a Excel.");
    } catch (err) {
      showAlert("error", "Error al exportar", "No se pudo exportar las asistencias a Excel.");
    } finally {
      setExportingExcel(false);
    }
  };

  const handleExportPDF = async () => {
    setExportingPdf(true);
    try {
      const response = await api.get(`/capacitaciones/${id}/exportar?format=pdf&search=${searchQuery}&sector=${selectedSector !== "todos" ? selectedSector : ""}&estado=${selectedEstado !== "todos" ? selectedEstado : ""}`, {
        responseType: "blob",
      });

      const url = window.URL.createObjectURL(new Blob([response.data], { type: "application/pdf" }));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `asistencias_capacitacion_${id}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.parentNode?.removeChild(link);
      showAlert("success", "Exportación exitosa", "El documento PDF se ha descargado correctamente.");
    } catch (err) {
      showAlert("error", "Error al exportar", "No se pudo exportar las asistencias a PDF.");
    } finally {
      setExportingPdf(false);
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

  if (loading) {
    return (
      <div className="space-y-4 max-w-4xl mx-auto">
        <div className="h-12 bg-white border border-slate-200 rounded-2xl animate-pulse" />
        <div className="h-64 bg-white border border-slate-200 rounded-2xl animate-pulse" />
      </div>
    );
  }

  if (!cap) {
    return (
      <div className="text-center py-20">
        <p className="text-slate-500">Capacitación no encontrada.</p>
      </div>
    );
  }

  const sectors = Array.from(
    new Set(
      (cap?.capacitacion_asistencias || [])
        .map((a) => a.sector)
        .filter((s): s is string => !!s)
    )
  );

  const filteredAsistencias = (cap?.capacitacion_asistencias || []).filter((a) => {
    const matchesSearch =
      a.nombre_empleado?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.dni_empleado?.includes(searchQuery);

    const matchesSector =
      selectedSector === "todos" || a.sector === selectedSector;

    const matchesEstado =
      selectedEstado === "todos" ||
      (selectedEstado === "aprobado" && a.aprobado) ||
      (selectedEstado === "desaprobado" && !a.aprobado);

    return matchesSearch && matchesSector && matchesEstado;
  });

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 pb-5">
        <div className="flex items-center gap-3">
          <Link
            href="/capacitaciones"
            className="h-10 w-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center hover:bg-slate-50 transition-colors cursor-pointer shrink-0"
          >
            <ArrowLeft className="h-5 w-5 text-slate-600" />
          </Link>
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight line-clamp-2">
              {cap.titulo}
            </h1>
            <div className="flex flex-wrap items-center gap-3 mt-1.5">
              <span className="text-xs text-slate-400 font-semibold flex items-center gap-1 shrink-0">
                <Calendar className="h-3.5 w-3.5" />
                {new Date(cap.fecha).toLocaleDateString("es-AR")}
              </span>
              <span
                className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider border shrink-0 ${estadoColor(
                  cap.estado
                )}`}
              >
                {cap.estado}
              </span>
            </div>
          </div>
        </div>

        {/* Botones de acción */}
        <div className="flex flex-wrap gap-2 w-full sm:w-auto items-center">
          {cap.estado === "borrador" && canManage && (
            <>
              <button
                onClick={() => cambiarEstado("activa")}
                disabled={updatingEstado}
                className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-4 py-2.5 rounded-xl text-sm transition-all cursor-pointer disabled:opacity-50"
              >
                <Play className="h-4 w-4" />
                Activar
              </button>
              <Link
                href={`/capacitaciones/${id}/editar`}
                className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 bg-white hover:bg-slate-50 text-slate-700 font-bold px-4 py-2.5 rounded-xl text-sm transition-all cursor-pointer border border-slate-200 shadow-2xs"
              >
                <Pencil className="h-4 w-4" />
                Editar
              </Link>
            </>
          )}
          {cap.estado === "activa" && (
            <>
              <button
                onClick={() => setShowShareModal(true)}
                className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold px-4 py-2.5 rounded-xl text-sm transition-all cursor-pointer border border-blue-200"
              >
                <Share2 className="h-4 w-4" />
                Compartir
              </button>
              {canManage && (
                <button
                  onClick={() => cambiarEstado("cerrada")}
                  disabled={updatingEstado}
                  className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 bg-slate-600 hover:bg-slate-700 text-white font-bold px-4 py-2.5 rounded-xl text-sm transition-all cursor-pointer disabled:opacity-50"
                >
                  <Square className="h-4 w-4" />
                  Cerrar
                </button>
              )}
            </>
          )}
          {canDelete && (
            <button
              onClick={() => setShowConfirmDelete(true)}
              disabled={deleting}
              className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 bg-red-50 hover:bg-red-100 text-red-700 font-bold px-4 py-2.5 rounded-xl text-sm transition-all cursor-pointer disabled:opacity-50 border border-red-200"
            >
              <Trash2 className="h-4 w-4" />
              Eliminar
            </button>
          )}
        </div>
      </div>

      {/* Temario */}
      {cap.temario && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-3">
            Temario
          </h2>
          <p className="text-sm text-slate-600 whitespace-pre-line">
            {cap.temario}
          </p>
        </div>
      )}

      {/* QR Code */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
            <QrCode className="h-4 w-4 text-blue-600" />
            Código QR de Evaluación
          </h2>
          {!qrData && (
            <button
              onClick={generarQR}
              disabled={loadingQr}
              className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold px-4 py-2 rounded-xl text-xs transition-all cursor-pointer disabled:opacity-50"
            >
              <QrCode className="h-3.5 w-3.5" />
              {loadingQr ? "Generando..." : "Generar QR"}
            </button>
          )}
        </div>

        {qrData ? (
          <div className="flex flex-col items-center gap-4 py-4">
            <div className="bg-white p-4 rounded-2xl border-2 border-blue-100 shadow-lg">
              <img
                src={qrData.qr}
                alt="QR de evaluación"
                className="w-64 h-64"
              />
            </div>
            <p className="text-xs text-slate-500 font-medium text-center max-w-sm">
              Los empleados deben escanear este código QR con su teléfono para
              completar la evaluación y registrar su asistencia.
            </p>
            <div className="flex gap-2">
              <button
                onClick={descargarQR}
                className="inline-flex items-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-4 py-2 rounded-xl text-xs transition-all cursor-pointer"
              >
                <Download className="h-3.5 w-3.5" />
                Descargar QR
              </button>
            </div>
            <div className="mt-2 text-[11px] text-slate-400 font-mono bg-slate-50 px-3 py-1.5 rounded-lg">
              {qrData.url}
            </div>
          </div>
        ) : (
          <div className="text-center py-8">
            <QrCode className="h-12 w-12 text-slate-300 mx-auto mb-3" />
            <p className="text-sm text-slate-500">
              Generá el código QR para proyectar en la capacitación.
            </p>
          </div>
        )}
      </div>

      {/* Preguntas */}
      {cap.capacitacion_preguntas && cap.capacitacion_preguntas.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2 mb-4">
            <HelpCircle className="h-4 w-4 text-purple-500" />
            Preguntas ({cap.capacitacion_preguntas.length})
          </h2>
          <div className="space-y-3">
            {cap.capacitacion_preguntas.map((p, idx) => (
              <div
                key={p.id}
                className="bg-slate-50 rounded-xl p-4 border border-slate-100"
              >
                <p className="text-sm font-bold text-slate-800">
                  {idx + 1}. {p.pregunta}
                </p>
                <div className="mt-2 space-y-1">
                  {p.opciones.map((opt: string, optIdx: number) => (
                    <div
                      key={optIdx}
                      className={`text-xs px-3 py-1.5 rounded-lg flex items-center gap-2 ${
                        optIdx === p.respuesta_correcta
                          ? "bg-emerald-50 text-emerald-700 font-bold"
                          : "text-slate-600"
                      }`}
                    >
                      {optIdx === p.respuesta_correcta ? (
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                      ) : (
                        <div className="h-3.5 w-3.5 rounded-full border border-slate-300 shrink-0" />
                      )}
                      {opt}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Asistencias */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
            <Users className="h-4 w-4 text-blue-600" />
            Asistencias y Evaluaciones ({cap.capacitacion_asistencias?.length || 0})
          </h2>

          <div className="flex gap-2">
            <button
              onClick={handleExportExcel}
              disabled={exportingExcel || filteredAsistencias.length === 0}
              className="inline-flex items-center justify-center gap-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 font-bold px-3 py-2 rounded-xl text-xs transition-all cursor-pointer border border-slate-200 disabled:opacity-50"
            >
              <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" />
              {exportingExcel ? "Exportando..." : "Excel (CSV)"}
            </button>
            <button
              onClick={handleExportPDF}
              disabled={exportingPdf || filteredAsistencias.length === 0}
              className="inline-flex items-center justify-center gap-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 font-bold px-3 py-2 rounded-xl text-xs transition-all cursor-pointer border border-slate-200 disabled:opacity-50"
            >
              <FileText className="h-3.5 w-3.5 text-blue-600" />
              {exportingPdf ? "Exportando..." : "PDF"}
            </button>
          </div>
        </div>

        {/* Barra de Filtros */}
        {cap.capacitacion_asistencias && cap.capacitacion_asistencias.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-100">
            {/* Búsqueda */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar por empleado o DNI..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold focus:outline-hidden focus:ring-2 focus:ring-blue-500/25 focus:border-blue-500"
              />
            </div>

            {/* Sector */}
            <div>
              <select
                value={selectedSector}
                onChange={(e) => setSelectedSector(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold focus:outline-hidden focus:ring-2 focus:ring-blue-500/25 focus:border-blue-500"
              >
                <option value="todos">Todos los sectores</option>
                {sectors.map((sec) => (
                  <option key={sec} value={sec}>
                    {sec}
                  </option>
                ))}
              </select>
            </div>

            {/* Estado */}
            <div>
              <select
                value={selectedEstado}
                onChange={(e) => setSelectedEstado(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold focus:outline-hidden focus:ring-2 focus:ring-blue-500/25 focus:border-blue-500"
              >
                <option value="todos">Todos los estados</option>
                <option value="aprobado">Aprobados</option>
                <option value="desaprobado">Reprobados</option>
              </select>
            </div>
          </div>
        )}

        {!cap.capacitacion_asistencias || cap.capacitacion_asistencias.length === 0 ? (
          <div className="text-center py-8">
            <Users className="h-10 w-10 text-slate-300 mx-auto mb-3" />
            <p className="text-sm text-slate-500">
              Aún no se registraron asistencias.
            </p>
          </div>
        ) : filteredAsistencias.length === 0 ? (
          <div className="text-center py-8 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
            <Search className="h-8 w-8 text-slate-300 mx-auto mb-2" />
            <p className="text-xs text-slate-500 font-semibold">
              No se encontraron asistencias que coincidan con los filtros aplicados.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredAsistencias.map((a) => (
              <div
                key={a.id}
                className="flex items-center justify-between bg-slate-50 rounded-xl p-4 border border-slate-100"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={`h-9 w-9 rounded-full flex items-center justify-center shrink-0 ${
                      a.aprobado
                        ? "bg-emerald-100 text-emerald-600"
                        : "bg-red-100 text-red-600"
                    }`}
                  >
                    {a.aprobado ? (
                      <CheckCircle2 className="h-5 w-5" />
                    ) : (
                      <XCircle className="h-5 w-5" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-slate-800 truncate">
                      {a.nombre_empleado}
                    </p>
                    <p className="text-[11px] text-slate-400 font-semibold">
                      DNI: {a.dni_empleado}
                      {a.sector && ` • ${a.sector}`}
                    </p>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <span
                    className={`text-lg font-black ${
                      a.aprobado ? "text-emerald-600" : "text-red-600"
                    }`}
                  >
                    {a.puntaje}%
                  </span>
                  <p className="text-[10px] font-bold text-slate-400">
                    {new Date(a.created_at).toLocaleTimeString("es-AR", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal de confirmación de eliminación */}
      {showConfirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl border border-slate-100 flex flex-col space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider">Eliminar Capacitación</h3>
              <button
                type="button"
                onClick={() => setShowConfirmDelete(false)}
                className="text-slate-400 hover:text-slate-600 font-bold text-lg cursor-pointer"
              >
                &times;
              </button>
            </div>

            <p className="text-sm text-slate-600 font-medium">
              ¿Estás seguro de que deseas eliminar esta capacitación? Esta acción no se puede deshacer y borrará permanentemente todas las preguntas y asistencias registradas.
            </p>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowConfirmDelete(false)}
                className="flex-1 py-2.5 border border-slate-200 text-slate-600 font-bold rounded-xl text-sm hover:bg-slate-50 transition-all cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={eliminarCapacitacion}
                disabled={deleting}
                className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl text-sm transition-all cursor-pointer disabled:opacity-50"
              >
                {deleting ? "Eliminando..." : "Eliminar"}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Modal de Compartir */}
      {showShareModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl border border-slate-100 flex flex-col space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider">
                Compartir Evaluación
              </h3>
              <button
                type="button"
                onClick={() => setShowShareModal(false)}
                className="text-slate-400 hover:text-slate-600 font-bold text-lg cursor-pointer"
              >
                &times;
              </button>
            </div>

            <p className="text-xs text-slate-500 font-medium">
              Compartí el enlace de evaluación pública con los empleados que asistieron a la capacitación.
            </p>

            <div className="space-y-2 pt-2">
              {/* WhatsApp */}
              <a
                href={`https://api.whatsapp.com/send?text=${encodeURIComponent(
                  `Hola, te comparto el link para completar la evaluación de la capacitación "${cap.titulo}":\n\n${
                    typeof window !== "undefined"
                      ? `${window.location.origin}/evaluacion/${id}`
                      : ""
                  }`
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-3 px-4 bg-emerald-50 hover:bg-emerald-100 border border-emerald-250 rounded-xl flex items-center justify-between text-emerald-850 transition-all cursor-pointer font-bold text-xs"
              >
                <span className="flex items-center gap-2">
                  <svg
                    className="h-5 w-5 text-emerald-600 fill-emerald-600 shrink-0"
                    viewBox="0 0 24 24"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L0 24l6.335-1.662c1.746.953 3.71 1.454 5.709 1.455h.008c6.56 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
                  </svg>
                  Compartir por WhatsApp
                </span>
                <span className="text-[10px] text-emerald-600 font-black">ABRIR</span>
              </a>

              {/* Email */}
              <a
                href={`mailto:?subject=${encodeURIComponent(
                  `Evaluación de Capacitación: ${cap.titulo}`
                )}&body=${encodeURIComponent(
                  `Hola,\n\nTe comparto el link para completar la evaluación de la capacitación "${
                    cap.titulo
                  }":\n\n${
                    typeof window !== "undefined"
                      ? `${window.location.origin}/evaluacion/${id}`
                      : ""
                  }\n\nSaludos.`
                )}`}
                className="w-full py-3 px-4 bg-blue-50 hover:bg-blue-100 border border-blue-250 rounded-xl flex items-center justify-between text-blue-800 transition-all cursor-pointer font-bold text-xs"
              >
                <span className="flex items-center gap-2">
                  <Mail className="h-5 w-5 text-blue-600" />
                  Compartir por Email
                </span>
                <span className="text-[10px] text-blue-600 font-black">ABRIR</span>
              </a>

              {/* Copiar Enlace */}
              <button
                onClick={() => {
                  if (typeof window !== "undefined") {
                    navigator.clipboard.writeText(
                      `${window.location.origin}/evaluacion/${id}`
                    );
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  }
                }}
                className="w-full py-3 px-4 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl flex items-center justify-between text-slate-800 transition-all cursor-pointer font-bold text-xs"
              >
                <span className="flex items-center gap-2">
                  {copied ? (
                    <Check className="h-5 w-5 text-emerald-600" />
                  ) : (
                    <Copy className="h-5 w-5 text-slate-600" />
                  )}
                  {copied ? "¡Enlace copiado!" : "Copiar enlace al portapapeles"}
                </span>
                <span className="text-[10px] text-slate-500 font-black">
                  {copied ? "HECHO" : "COPIAR"}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
