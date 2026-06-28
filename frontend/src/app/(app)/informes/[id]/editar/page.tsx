"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { useInformeDetalle } from "@/hooks/useInformes";
import { api } from "@/lib/api";
import {
  Calendar,
  Clock,
  Bold,
  Italic,
  List,
  Link as LinkIcon,
  Camera,
  Check,
  X,
  Building2,
  ArrowLeft,
} from "lucide-react";
import { useAlert } from "@/context/AlertContext";

export default function EditarInformePage() {
  const { empresa } = useAuth();
  const router = useRouter();
  const { id } = useParams();
  const { showAlert } = useAlert();

  const { data: informe, isLoading: loadingInforme } = useInformeDetalle(id as string);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Campos del formulario principal
  const [lugar, setLugar] = useState("");
  const [actividad, setActividad] = useState("");
  const [fecha, setFecha] = useState("");
  const [hora, setHora] = useState("");
  const [observaciones, setObservaciones] = useState("");

  // Imágenes existentes y nuevas
  const [existingUrls, setExistingUrls] = useState<string[]>([]);
  const [imagenesEvidencia, setImagenesEvidencia] = useState<File[]>([]);
  const [previewsUrls, setPreviewsUrls] = useState<string[]>([]);

  // Declaración Legal (Funcional con ContentEditable)
  const editorRef = useRef<HTMLDivElement>(null);

  // Estados de formato activo en la barra de herramientas
  const [isBold, setIsBold] = useState(false);
  const [isItalic, setIsItalic] = useState(false);
  const [isList, setIsList] = useState(false);

  // Estados del modal de enlace personalizado
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [linkText, setLinkText] = useState("");
  const [savedRange, setSavedRange] = useState<Range | null>(null);

  // Cargar datos del informe
  useEffect(() => {
    if (informe) {
      // Validar si ya está firmado para impedir edición
      const preventorFirmado = informe.firmas_informe?.some((f) => f.tipo === "preventor");
      if (preventorFirmado) {
        showAlert("warning", "Acceso denegado", "No se pueden editar informes que ya han sido firmados.");
        router.push(`/informes/${id}`);
        return;
      }

      setLugar(informe.lugar_visita || "");
      setActividad(informe.actividad || "");
      
      const dateObj = new Date(informe.fecha_hora_visita);
      setFecha(dateObj.toISOString().split("T")[0]);
      
      const hours = String(dateObj.getHours()).padStart(2, "0");
      const minutes = String(dateObj.getMinutes()).padStart(2, "0");
      setHora(`${hours}:${minutes}`);
      
      setObservaciones(informe.observaciones || "");
      setExistingUrls(informe.evidencias_urls || []);

      if (editorRef.current) {
        editorRef.current.innerHTML = informe.declaracion_legal || "";
      }
    }
  }, [informe, id, router, showAlert]);

  // Actualizar los estados activos de la barra de herramientas
  const updateToolbarState = () => {
    if (typeof document !== "undefined") {
      setIsBold(document.queryCommandState("bold"));
      setIsItalic(document.queryCommandState("italic"));
      setIsList(document.queryCommandState("insertUnorderedList"));
    }
  };

  // Formatear texto de la declaración
  const handleEditorCommand = (command: string, value: string = "") => {
    document.execCommand(command, false, value);
    updateToolbarState();
  };

  const handleLinkClick = () => {
    if (typeof window !== "undefined") {
      const sel = window.getSelection();
      if (sel && sel.rangeCount > 0) {
        const range = sel.getRangeAt(0);
        setSavedRange(range);
        setLinkText(range.toString());
      } else {
        setLinkText("");
      }
    }
    setShowLinkModal(true);
  };

  const handleInsertLink = () => {
    if (!linkUrl) return;
    if (savedRange && typeof window !== "undefined") {
      const sel = window.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(savedRange);
    }
    
    const formattedUrl = linkUrl.startsWith("http") ? linkUrl : `https://${linkUrl}`;
    const textToInsert = linkText || formattedUrl;
    const htmlLink = `<a href="${formattedUrl}" target="_blank" rel="noopener noreferrer" style="color: #2563eb; text-decoration: underline; font-weight: 600;">${textToInsert}</a>`;
    
    document.execCommand("insertHTML", false, htmlLink);
    
    setShowLinkModal(false);
    setLinkUrl("");
    setLinkText("");
    setSavedRange(null);
    updateToolbarState();
  };

  // Manejo de nuevas imágenes de evidencia
  const handleImagesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const filesArray = Array.from(e.target.files);
      setImagenesEvidencia((prev) => [...prev, ...filesArray]);

      const urlsArray = filesArray.map((file) => URL.createObjectURL(file));
      setPreviewsUrls((prev) => [...prev, ...urlsArray]);
    }
  };

  const removeNewImage = (index: number) => {
    setImagenesEvidencia((prev) => prev.filter((_, i) => i !== index));
    setPreviewsUrls((prev) => {
      URL.revokeObjectURL(prev[index]);
      return prev.filter((_, i) => i !== index);
    });
  };

  const removeExistingImage = (index: number) => {
    setExistingUrls((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!empresa?.id) {
      setError("No hay ninguna empresa asociada a la sesión.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // 1. Combinar fecha y hora
      const dateObj = new Date(`${fecha}T${hora}:00`);

      // Obtener el texto editado de la declaración legal
      const finalDeclaracion = editorRef.current?.innerHTML || "";

      // 2. Si hay imágenes nuevas, subirlas primero
      let finalEvidenciasUrls = [...existingUrls];
      if (imagenesEvidencia.length > 0) {
        const formData = new FormData();
        imagenesEvidencia.forEach((file) => {
          formData.append("evidencia", file);
        });

        const uploadRes = await api.post(`/informes/${id}/evidencia`, formData, {
          headers: { "Content-Type": "multipart/form-data" },
        });

        if (uploadRes.data?.evidencias_urls) {
          finalEvidenciasUrls = [...finalEvidenciasUrls, ...uploadRes.data.evidencias_urls];
        }
      }

      // 3. Armar el payload de actualización
      const payload = {
        actividad: actividad,
        fecha_hora_visita: dateObj.toISOString(),
        lugar_visita: lugar,
        declaracion_legal: finalDeclaracion,
        observaciones: observaciones || null,
        evidencias_urls: finalEvidenciasUrls,
      };

      // 4. Guardar cambios
      await api.patch(`/informes/${id}`, payload);

      showAlert("success", "Informe actualizado", "Los cambios se guardaron correctamente.");
      router.push(`/informes/${id}`);
    } catch (err: any) {
      setError(
        err.response?.data?.error ||
          err.message ||
          "Error al guardar los cambios del informe técnico.",
      );
    } finally {
      setLoading(false);
    }
  };

  if (loadingInforme) {
    return (
      <div className="space-y-6">
        <div className="h-24 bg-white border border-slate-200 rounded-2xl animate-pulse"></div>
        <div className="h-96 bg-white border border-slate-200 rounded-2xl animate-pulse"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Encabezado */}
      <div className="flex items-center gap-3.5">
        <button
          onClick={() => router.push(`/informes/${id}`)}
          className="h-10 w-10 bg-white border border-slate-200 rounded-xl flex items-center justify-center text-slate-600 hover:bg-slate-50 transition-colors shadow-2xs cursor-pointer"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">
            Editar Informe N° {String(informe?.numero_informe).padStart(6, "0")}
          </h1>
          <p className="text-sm font-semibold text-slate-400 mt-1">
            Modificá los datos del informe técnico y guardá los cambios.
          </p>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-100 rounded-2xl p-4 flex items-start gap-3 text-red-800">
          <X className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
          <div className="text-xs font-bold leading-relaxed">{error}</div>
        </div>
      )}

      <form onSubmit={handleSave} className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Panel Principal (2/3 de ancho) */}
        <div className="lg:col-span-2 space-y-6">
          {/* Información General */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-2xs space-y-4">
            <h2 className="text-xs font-black text-slate-400 uppercase tracking-wider">
              Información de la Visita
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Establecimiento / Lugar
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400">
                    <Building2 className="h-4 w-4" />
                  </span>
                  <input
                    type="text"
                    required
                    value={lugar}
                    onChange={(e) => setLugar(e.target.value)}
                    className="block w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl bg-brand-input-bg text-slate-700 placeholder-slate-450 focus:outline-hidden focus:ring-2 focus:ring-blue-600/25 focus:border-blue-600 text-xs font-bold transition-all"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Actividad / Título
                </label>
                <input
                  type="text"
                  required
                  value={actividad}
                  onChange={(e) => setActividad(e.target.value)}
                  className="block w-full px-4 py-3 border border-slate-200 rounded-xl bg-brand-input-bg text-slate-700 placeholder-slate-450 focus:outline-hidden focus:ring-2 focus:ring-blue-600/25 focus:border-blue-600 text-xs font-bold transition-all"
                />
              </div>

              <div className="space-y-2">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Fecha de Visita
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400">
                    <Calendar className="h-4 w-4" />
                  </span>
                  <input
                    type="date"
                    required
                    value={fecha}
                    onChange={(e) => setFecha(e.target.value)}
                    className="block w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl bg-brand-input-bg text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-blue-600/25 focus:border-blue-600 text-xs font-bold transition-all"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Hora de Visita
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400">
                    <Clock className="h-4 w-4" />
                  </span>
                  <input
                    type="time"
                    required
                    value={hora}
                    onChange={(e) => setHora(e.target.value)}
                    className="block w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl bg-brand-input-bg text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-blue-600/25 focus:border-blue-600 text-xs font-bold transition-all"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Declaración Jurada (Rich Text Editor) */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-2xs space-y-4">
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              Declaración Jurada / Requerimiento Legal
            </label>

            <div className="border border-slate-200 rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-blue-600/25 focus-within:border-blue-600 transition-all">
              {/* Barra de Herramientas */}
              <div className="bg-slate-50/50 border-b border-slate-200 p-2 flex items-center gap-1 select-none">
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => handleEditorCommand("bold")}
                  className={`p-1.5 rounded-md transition-colors cursor-pointer ${
                    isBold
                      ? "text-blue-600 bg-blue-50"
                      : "text-slate-500 hover:text-slate-800 hover:bg-slate-100"
                  }`}
                  title="Negrita"
                >
                  <Bold className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => handleEditorCommand("italic")}
                  className={`p-1.5 rounded-md transition-colors cursor-pointer ${
                    isItalic
                      ? "text-blue-600 bg-blue-50"
                      : "text-slate-500 hover:text-slate-800 hover:bg-slate-100"
                  }`}
                  title="Cursiva"
                >
                  <Italic className="h-4 w-4" />
                </button>
                <div className="h-4 w-px bg-slate-200 mx-1" />
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => handleEditorCommand("insertUnorderedList")}
                  className={`p-1.5 rounded-md transition-colors cursor-pointer ${
                    isList
                      ? "text-blue-600 bg-blue-50"
                      : "text-slate-500 hover:text-slate-800 hover:bg-slate-100"
                  }`}
                  title="Lista"
                >
                  <List className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={handleLinkClick}
                  className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-md transition-colors cursor-pointer"
                  title="Enlace"
                >
                  <LinkIcon className="h-4 w-4" />
                </button>
              </div>

              {/* Editor contentEditable */}
              <div
                ref={editorRef}
                contentEditable
                suppressContentEditableWarning
                onKeyUp={updateToolbarState}
                onMouseUp={updateToolbarState}
                onFocus={updateToolbarState}
                onClick={updateToolbarState}
                className="block w-full p-4 text-sm text-slate-700 bg-slate-50/40 border-0 focus:ring-0 focus:outline-hidden min-h-[120px] font-medium leading-relaxed overflow-y-auto"
              />
            </div>
          </div>

          {/* Observaciones */}
          <div className="space-y-2">
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              Observaciones (Se transforman en plan de acción)
            </label>
            <textarea
              placeholder="Describí los hallazgos de la visita..."
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
              rows={5}
              className="block w-full p-4 border border-slate-200 rounded-xl bg-brand-input-bg text-slate-700 placeholder-slate-450 focus:outline-hidden focus:ring-2 focus:ring-blue-600/25 focus:border-blue-600 text-sm font-semibold transition-all resize-none"
            />
          </div>
        </div>

        {/* Panel Lateral (1/3 de ancho) */}
        <div className="space-y-6">
          {/* Evidencia Fotográfica */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4 shadow-2xs">
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              Evidencia Fotográfica
            </label>

            {/* Fotos Existentes */}
            {existingUrls.length > 0 && (
              <div className="space-y-2">
                <span className="block text-[9px] font-black text-slate-400 uppercase tracking-wider">
                  Fotos Guardadas ({existingUrls.length})
                </span>
                <div className="grid grid-cols-2 gap-3">
                  {existingUrls.map((url, idx) => (
                    <div
                      key={url}
                      className="relative group rounded-xl overflow-hidden border border-slate-200 h-24 bg-slate-50"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={url}
                        alt={`Existente ${idx + 1}`}
                        className="w-full h-full object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => removeExistingImage(idx)}
                        className="absolute top-1.5 right-1.5 p-1 bg-slate-900/60 hover:bg-red-600 text-white rounded-full transition-colors cursor-pointer"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Nuevas Fotos a Subir */}
            <div className="space-y-2">
              <span className="block text-[9px] font-black text-slate-400 uppercase tracking-wider">
                Nuevas Fotos ({imagenesEvidencia.length})
              </span>
              <div className="grid grid-cols-2 gap-3">
                {previewsUrls.map((url, index) => (
                  <div
                    key={url}
                    className="relative group rounded-xl overflow-hidden border border-slate-200 h-24 bg-slate-50"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={url}
                      alt={`Vista previa ${index + 1}`}
                      className="w-full h-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => removeNewImage(index)}
                      className="absolute top-1.5 right-1.5 p-1 bg-slate-900/60 hover:bg-red-600 text-white rounded-full transition-colors cursor-pointer"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}

                {/* Botón para añadir más fotos */}
                <label className="border-2 border-dashed border-slate-200 hover:border-blue-500 hover:bg-blue-50/25 rounded-xl h-24 flex flex-col items-center justify-center gap-1.5 transition-all cursor-pointer relative">
                  <div className="h-6 w-6 rounded-full bg-blue-50 flex items-center justify-center text-blue-600">
                    <Camera className="h-3.5 w-3.5" />
                  </div>
                  <span className="text-[9px] font-bold text-slate-500">
                    Añadir foto
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleImagesChange}
                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                  />
                </label>
              </div>
            </div>
          </div>

          {/* Botones de Acción */}
          <div className="space-y-3">
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 px-4 bg-blue-650 hover:bg-blue-700 text-white text-sm font-bold rounded-xl flex items-center justify-center gap-2 shadow-md shadow-blue-900/10 hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              <Check className="h-4 w-4 stroke-3" />
              {loading ? "Guardando..." : "Guardar Cambios"}
            </button>

            <button
              type="button"
              onClick={() => router.push(`/informes/${id}`)}
              className="w-full py-3.5 px-4 bg-white hover:bg-slate-50 border border-slate-200 text-slate-600 text-sm font-bold rounded-xl flex items-center justify-center transition-colors cursor-pointer"
            >
              Cancelar
            </button>
          </div>
        </div>
      </form>

      {/* Modal Personalizado de Enlace */}
      {showLinkModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 animate-fadeIn">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl border border-slate-100 space-y-4 mx-4">
            <div>
              <h3 className="font-bold text-slate-800 text-sm">
                Insertar Enlace
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Ingresa el texto a mostrar y la dirección web de destino.
              </p>
            </div>

            <div className="space-y-3">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Texto a mostrar
                </label>
                <input
                  type="text"
                  placeholder="Ej: Ley 19587"
                  value={linkText}
                  onChange={(e) => setLinkText(e.target.value)}
                  className="block w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-semibold focus:outline-hidden focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 bg-slate-50"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  URL de enlace (Enlace web)
                </label>
                <input
                  type="text"
                  placeholder="Ej: www.argentina.gob.ar"
                  value={linkUrl}
                  onChange={(e) => setLinkUrl(e.target.value)}
                  className="block w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-semibold focus:outline-hidden focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 bg-slate-50"
                />
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleInsertLink}
                className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg transition-colors cursor-pointer"
              >
                Insertar
              </button>
              <button
                onClick={() => {
                  setShowLinkModal(false);
                  setLinkUrl("");
                  setLinkText("");
                  setSavedRange(null);
                }}
                className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-bold rounded-lg transition-colors cursor-pointer"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
