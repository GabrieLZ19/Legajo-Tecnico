"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { useInformes } from "@/hooks/useInformes";
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
  AlertCircle,
  X,
  Building2,
} from "lucide-react";

export default function NuevoInformePage() {
  const { empresa } = useAuth();
  const router = useRouter();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Datos completos de la empresa cargados de la API
  const [empresaData, setEmpresaData] = useState<any>(null);

  // Instanciar el hook de creación
  const { crearInforme } = useInformes(empresa?.id);

  // Campos del formulario principal (según mockup W04)
  const [lugar, setLugar] = useState("Planta 1");
  const [actividad, setActividad] = useState("");
  const [fecha, setFecha] = useState("");
  const [hora, setHora] = useState("");
  const [observaciones, setObservaciones] = useState("");
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

  // Cargar datos de la empresa y establecer fecha/hora actuales
  useEffect(() => {
    if (empresa?.id) {
      const fetchEmpresa = async () => {
        try {
          const { data } = await api.get(`/empresas/${empresa.id}`);
          setEmpresaData(data);
        } catch (err) {
          console.error("Error al cargar datos de la empresa:", err);
        }
      };
      fetchEmpresa();
    }

    // Inicializar la declaración legal en el editor una sola vez para evitar cursor jumping
    if (editorRef.current) {
      editorRef.current.innerHTML = "";
    }

    // Fecha y hora actuales
    const now = new Date();
    setFecha(now.toISOString().split("T")[0]);

    const hours = String(now.getHours()).padStart(2, "0");
    const minutes = String(now.getMinutes()).padStart(2, "0");
    setHora(`${hours}:${minutes}`);
  }, [empresa]);

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
        setLinkText(range.toString()); // Pre-poblar con el texto que el usuario haya seleccionado
      } else {
        setLinkText("");
      }
    }
    setShowLinkModal(true);
  };

  // Manejo de imágenes de evidencia (múltiples)
  const handleImagesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const filesArray = Array.from(e.target.files);
      setImagenesEvidencia((prev) => [...prev, ...filesArray]);

      const urlsArray = filesArray.map((file) => URL.createObjectURL(file));
      setPreviewsUrls((prev) => [...prev, ...urlsArray]);
    }
  };

  const removeImage = (index: number) => {
    setImagenesEvidencia((prev) => prev.filter((_, i) => i !== index));
    setPreviewsUrls((prev) => {
      // Revocar el object URL para evitar pérdidas de memoria
      URL.revokeObjectURL(prev[index]);
      return prev.filter((_, i) => i !== index);
    });
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

      // 2. Armar el informe
      const payload = {
        empresa_id: empresa.id,
        actividad: actividad,
        fecha_hora_visita: dateObj.toISOString(),
        lugar_visita: lugar,
        contacto_visita: "Responsable de Planta",
        declaracion_legal: finalDeclaracion,
        observaciones: observaciones || null,
        peligros: [],
        puntos_mejora: [],
      };

      // 3. Guardar informe
      const res = await crearInforme(payload);

      // 4. Si hay imágenes, subirlas al informe
      if (imagenesEvidencia.length > 0) {
        const formData = new FormData();
        imagenesEvidencia.forEach((file) => {
          formData.append("evidencia", file);
        });

        await api.post(`/informes/${res.id}/evidencia`, formData, {
          headers: { "Content-Type": "multipart/form-data" },
        });
      }

      // 5. Redirigir a la firma
      router.push(`/informes/${res.id}/firma`);
    } catch (err: any) {
      setError(
        err.response?.data?.error ||
          err.message ||
          "Error al guardar el informe técnico.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Encabezado */}
      <div>
        <h1 className="text-3xl font-black text-slate-900 tracking-tight">
          Nuevo Informe de Visita
        </h1>
        <p className="text-sm font-semibold text-slate-400 mt-1">
          Completá los datos de la visita de seguridad e higiene.
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-100 rounded-2xl p-4 text-sm text-red-800 font-bold">
          {error}
        </div>
      )}

      {/* Formulario en Grid */}
      <form
        onSubmit={handleSave}
        className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start"
      >
        {/* Panel Principal (2/3 de ancho) */}
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl p-6 space-y-6 shadow-2xs">
          {/* Empresa / Lugar + Actividad */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Empresa / Lugar
              </label>
              <div className="flex items-center gap-2 pl-3.5 pr-3 py-3 border border-slate-200 rounded-xl bg-brand-input-bg text-slate-755 focus-within:ring-2 focus-within:ring-blue-600/25 focus-within:border-blue-600 transition-all select-none">
                <Building2 className="h-5 w-5 text-blue-600 shrink-0" />

                {/* Razón Social (Fija, no editable) */}
                <span className="text-sm font-bold text-slate-700 shrink-0">
                  {empresaData ? empresaData.razon_social : "Cargando..."}
                </span>

                <span className="text-slate-400 font-bold select-none shrink-0">
                  —
                </span>

                {/* Input de Lugar / Área (Editable) */}
                <input
                  type="text"
                  required
                  placeholder="Planta 1"
                  value={lugar}
                  onChange={(e) => setLugar(e.target.value)}
                  className="block flex-1 bg-transparent border-0 p-0 text-slate-700 placeholder-slate-400 focus:ring-0 focus:outline-hidden text-sm font-bold min-w-0"
                />
              </div>
            </div>

            {/* Actividad / Tipo de Visita */}
            <div className="space-y-2">
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Actividad / Tipo de Visita
              </label>
              <input
                type="text"
                required
                value={actividad}
                onChange={(e) => setActividad(e.target.value)}
                className="block w-full border border-slate-200 rounded-xl px-3.5 py-3 text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-600/25 focus:border-blue-600 transition-all font-bold text-slate-700 bg-brand-input-bg"
              />
            </div>
          </div>

          {/* Fecha y Hora */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Fecha */}
            <div className="space-y-2">
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Fecha
              </label>
              <div
                onClick={(e) => {
                  const input = e.currentTarget.querySelector("input");
                  if (input) {
                    try {
                      input.showPicker();
                    } catch (err) {}
                  }
                }}
                className="flex items-center gap-2 pl-3.5 pr-3 py-3 border border-slate-200 rounded-xl bg-brand-input-bg text-slate-755 focus-within:ring-2 focus-within:ring-blue-600/25 focus-within:border-blue-600 transition-all cursor-pointer select-none"
              >
                <Calendar className="h-5 w-5 text-blue-600 shrink-0" />
                <input
                  type="date"
                  required
                  value={fecha}
                  onChange={(e) => setFecha(e.target.value)}
                  onClick={(e) => {
                    e.stopPropagation();
                    try {
                      e.currentTarget.showPicker();
                    } catch (err) {}
                  }}
                  className="block flex-1 bg-transparent border-0 p-0 text-slate-700 focus:ring-0 focus:outline-hidden text-sm font-bold cursor-pointer"
                />
              </div>
            </div>

            {/* Hora */}
            <div className="space-y-2">
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Hora
              </label>
              <div
                onClick={(e) => {
                  const input = e.currentTarget.querySelector("input");
                  if (input) {
                    try {
                      input.showPicker();
                    } catch (err) {}
                  }
                }}
                className="flex items-center gap-2 pl-3.5 pr-3 py-3 border border-slate-200 rounded-xl bg-brand-input-bg text-slate-755 focus-within:ring-2 focus-within:ring-blue-600/25 focus-within:border-blue-600 transition-all cursor-pointer select-none"
              >
                <Clock className="h-5 w-5 text-blue-600 shrink-0" />
                <input
                  type="time"
                  required
                  value={hora}
                  onChange={(e) => setHora(e.target.value)}
                  onClick={(e) => {
                    e.stopPropagation();
                    try {
                      e.currentTarget.showPicker();
                    } catch (err) {}
                  }}
                  className="block flex-1 bg-transparent border-0 p-0 text-slate-700 focus:ring-0 focus:outline-hidden text-sm font-bold cursor-pointer"
                />
              </div>
            </div>
          </div>

          {/* Declaración Legal (Funcional) */}
          <div className="space-y-2">
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              Declaración Legal
            </label>
            <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
              {/* Barra de herramientas */}
              <div className="flex items-center gap-1.5 px-3 py-2 bg-slate-50 border-b border-slate-200 select-none">
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => handleEditorCommand("bold")}
                  className={`p-1.5 rounded-md transition-colors cursor-pointer ${
                    isBold
                      ? "text-blue-600 bg-blue-50 font-bold"
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
                className="block w-full p-4 text-sm text-slate-700 bg-slate-50/40 border-0 focus:ring-0 focus:outline-hidden min-h-[100px] font-medium leading-relaxed overflow-y-auto"
              />
            </div>
          </div>

          {/* Observaciones */}
          <div className="space-y-2">
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              Observaciones
            </label>
            <textarea
              placeholder="Describí los hallazgos de la visita..."
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
              rows={5}
              className="block w-full p-4 border border-slate-200 rounded-xl bg-brand-input-bg text-slate-700 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-blue-600/25 focus:border-blue-600 text-sm font-semibold transition-all resize-none"
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

            {previewsUrls.length > 0 ? (
              <div className="grid grid-cols-2 gap-3">
                {previewsUrls.map((url, index) => (
                  <div
                    key={url}
                    className="relative group rounded-xl overflow-hidden border border-slate-200 h-28 bg-slate-50"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={url}
                      alt={`Vista previa ${index + 1}`}
                      className="w-full h-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => removeImage(index)}
                      className="absolute top-1.5 right-1.5 p-1 bg-slate-900/60 hover:bg-red-600 text-white rounded-full transition-colors cursor-pointer"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}

                {/* Botón para añadir más fotos */}
                <label className="border-2 border-dashed border-slate-200 hover:border-blue-500 hover:bg-blue-50/25 rounded-xl h-28 flex flex-col items-center justify-center gap-1.5 transition-all cursor-pointer relative">
                  <div className="h-7 w-7 rounded-full bg-blue-50 flex items-center justify-center text-blue-600">
                    <Camera className="h-4 w-4" />
                  </div>
                  <span className="text-[10px] font-bold text-slate-500">
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
            ) : (
              <div className="border-2 border-dashed border-slate-200 hover:border-blue-500 hover:bg-blue-50/25 rounded-xl p-6 text-center flex flex-col items-center justify-center gap-3 transition-all cursor-pointer relative min-h-[160px]">
                <div className="h-10 w-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-600">
                  <Camera className="h-5 w-5" />
                </div>
                <span className="text-xs font-bold text-slate-500">
                  Arrastrá o capturá fotos
                </span>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleImagesChange}
                  className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                />
              </div>
            )}
          </div>

          {/* Botones de Acción */}
          <div className="space-y-3">
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 px-4 bg-brand-primary hover:bg-brand-primary/95 text-white text-sm font-bold rounded-xl flex items-center justify-center gap-2 shadow-md shadow-blue-900/10 hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              <Check className="h-4 w-4 stroke-3" />
              {loading ? "Guardando..." : "Guardar Informe"}
            </button>

            <button
              type="button"
              onClick={() => router.push("/informes")}
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
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Texto a mostrar
                </label>
                <input
                  type="text"
                  placeholder="Ej. enlace al documento"
                  value={linkText}
                  onChange={(e) => setLinkText(e.target.value)}
                  className="block w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 font-semibold text-slate-700"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Dirección Web (URL)
                </label>
                <input
                  type="url"
                  placeholder="https://example.com"
                  value={linkUrl}
                  onChange={(e) => setLinkUrl(e.target.value)}
                  className="block w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 font-semibold text-slate-700"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      if (linkUrl.trim()) {
                        // Restaurar selección e insertar enlace
                        if (savedRange && typeof window !== "undefined") {
                          const sel = window.getSelection();
                          sel?.removeAllRanges();
                          sel?.addRange(savedRange);
                        }
                        const text = linkText.trim() || linkUrl.trim();
                        const url = linkUrl.trim();
                        document.execCommand(
                          "insertHTML",
                          false,
                          `<a href="${url}" class="text-blue-600 underline hover:text-blue-850 font-bold" target="_blank">${text}</a>`,
                        );
                      }
                      setShowLinkModal(false);
                      setLinkUrl("");
                      setLinkText("");
                    }
                  }}
                />
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => {
                  setShowLinkModal(false);
                  setLinkUrl("");
                  setLinkText("");
                }}
                className="px-4 py-2 text-xs font-bold text-slate-500 hover:bg-slate-50 rounded-xl border border-slate-200 cursor-pointer transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  if (linkUrl.trim()) {
                    // Restaurar selección e insertar enlace
                    if (savedRange && typeof window !== "undefined") {
                      const sel = window.getSelection();
                      sel?.removeAllRanges();
                      sel?.addRange(savedRange);
                    }
                    const text = linkText.trim() || linkUrl.trim();
                    const url = linkUrl.trim();
                    document.execCommand(
                      "insertHTML",
                      false,
                      `<a href="${url}" class="text-blue-600 underline hover:text-blue-850 font-bold" target="_blank">${text}</a>`,
                    );
                  }
                  setShowLinkModal(false);
                  setLinkUrl("");
                  setLinkText("");
                }}
                className="px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl cursor-pointer transition-colors"
              >
                Insertar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
