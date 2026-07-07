"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { useInformeDetalle } from "@/hooks/useInformes";
import { usePlantillas } from "@/hooks/usePlantillas";
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
  ChevronDown,
  Save,
  FileText,
  AlertCircle,
} from "lucide-react";
import { useAlert } from "@/context/AlertContext";

export default function EditarInformePage() {
  const { empresa } = useAuth();
  const router = useRouter();
  const { id } = useParams();
  const { showAlert } = useAlert();

  const { data: informe, isLoading: loadingInforme } = useInformeDetalle(
    id as string,
  );

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Campos del formulario principal
  const [lugar, setLugar] = useState("");
  const [actividad, setActividad] = useState("");
  const [fecha, setFecha] = useState("");
  const [hora, setHora] = useState("");

  interface AccionLocal {
    id?: string;
    descripcion: string;
    responsable: string;
  }

  // Estructura de Observaciones locales
  interface ObservacionLocal {
    id_temp: string;
    id?: string;
    detalle: string;
    acciones: AccionLocal[];
    evidencia_url?: string;
    imagenFile?: File;
    previewUrl?: string;
  }
  const [observacionesCargadas, setObservacionesCargadas] = useState<
    ObservacionLocal[]
  >([]);

  // Estados del modal de Observaciones
  const [showObsModal, setShowObsModal] = useState(false);
  const [editingObs, setEditingObs] = useState<ObservacionLocal | null>(null);
  const [obsDetalle, setObsDetalle] = useState("");
  const [obsAcciones, setObsAcciones] = useState<AccionLocal[]>([{ descripcion: "", responsable: "" }]);
  const [obsImagenFile, setObsImagenFile] = useState<File | null>(null);
  const [obsPreviewUrl, setObsPreviewUrl] = useState<string | null>(null);
  const [obsEvidenciaUrl, setObsEvidenciaUrl] = useState<string | null>(null);

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

  // Estados de plantillas de Declaración Legal
  const DEFAULT_TEMPLATES = [
    {
      name: "Visita General",
      content:
        "Se realizó visita en campo en la fecha y hora indicadas a fin de verificar las condiciones de seguridad e higiene en el establecimiento, de acuerdo con la normativa vigente (Ley 19.587 y Dec. 351/79).",
    },
    {
      name: "Relevamiento de Riesgos",
      content:
        "Se procedió a efectuar el relevamiento técnico de riesgos laborales en los puestos de trabajo del establecimiento, constatando el cumplimiento de las normas de prevención de accidentes.",
    },
    {
      name: "Auditoría de EPP",
      content:
        "Se constató la entrega, uso efectivo y estado de conservación de los Elementos de Protección Personal (EPP) asignados al personal de planta, según Res. SRT 299/11.",
    },
  ];

  const {
    plantillas: customTemplates,
    crearPlantilla,
    eliminarPlantilla,
  } = usePlantillas();
  const [showTemplatesDropdown, setShowTemplatesDropdown] = useState(false);
  const [showSaveTemplateModal, setShowSaveTemplateModal] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState("");
  const [templateToDelete, setTemplateToDelete] = useState<{
    id: string;
    nombre: string;
  } | null>(null);

  const openSaveTemplateModal = () => {
    if (!editorRef.current) return;
    const content = editorRef.current.innerHTML.trim();
    if (!content || content === "<br>") {
      showAlert(
        "error",
        "Editor Vacío",
        "El editor está vacío. Escribe algo antes de guardarlo como plantilla.",
      );
      return;
    }
    setNewTemplateName("");
    setShowSaveTemplateModal(true);
    setShowTemplatesDropdown(false);
  };

  const handleSaveTemplateSubmit = async () => {
    if (!newTemplateName.trim()) return;
    if (!editorRef.current) return;
    const content = editorRef.current.innerHTML.trim();

    try {
      await crearPlantilla({
        nombre: newTemplateName.trim(),
        contenido: content,
      });
      setNewTemplateName("");
      setShowSaveTemplateModal(false);
      showAlert(
        "success",
        "Plantilla Guardada",
        "La plantilla se ha guardado correctamente en la base de datos.",
      );
    } catch (err: any) {
      showAlert("error", "Error", err.response?.data?.error || err.message);
    }
  };

  const handleDeleteTemplateConfirm = async () => {
    if (!templateToDelete) return;
    try {
      await eliminarPlantilla(templateToDelete.id);
      setTemplateToDelete(null);
      showAlert(
        "success",
        "Plantilla Eliminada",
        "La plantilla fue eliminada de la base de datos.",
      );
    } catch (err: any) {
      showAlert("error", "Error", err.response?.data?.error || err.message);
    }
  };

  // Cargar datos del informe
  useEffect(() => {
    if (informe) {
      // Validar si ya está firmado para impedir edición
      const preventorFirmado = informe.firmas_informe?.some(
        (f) => f.tipo === "preventor",
      );
      if (preventorFirmado) {
        showAlert(
          "warning",
          "Acceso denegado",
          "No se pueden editar informes que ya han sido firmados.",
        );
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

      // Inicializar observaciones cargadas estructuradas
      if (informe.puntos_mejora) {
        const loadedObs = informe.puntos_mejora.map((pm: any) => {
          const matchingAccs = informe.acciones_mejora?.filter(
            (acc: any) => acc.punto_mejora_id === pm.id,
          ) || [];
          return {
            id_temp: pm.id,
            id: pm.id,
            detalle: pm.detalle,
            acciones: matchingAccs.map((acc: any) => ({
              id: acc.id,
              descripcion: acc.descripcion,
              responsable: acc.responsable || "",
            })),
            evidencia_url: pm.evidencia_url || undefined,
          };
        });
        setObservacionesCargadas(loadedObs);
      }

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

    const formattedUrl = linkUrl.startsWith("http")
      ? linkUrl
      : `https://${linkUrl}`;
    const textToInsert = linkText || formattedUrl;
    const htmlLink = `<a href="${formattedUrl}" target="_blank" rel="noopener noreferrer" style="color: #2563eb; text-decoration: underline; font-weight: 600;">${textToInsert}</a>`;

    document.execCommand("insertHTML", false, htmlLink);

    setShowLinkModal(false);
    setLinkUrl("");
    setLinkText("");
    setSavedRange(null);
    updateToolbarState();
  };

  // Handlers para observaciones
  const openAddModal = () => {
    setEditingObs(null);
    setObsDetalle("");
    setObsAcciones([{ descripcion: "", responsable: "" }]);
    setObsImagenFile(null);
    setObsPreviewUrl(null);
    setObsEvidenciaUrl(null);
    setShowObsModal(true);
  };

  const openEditModal = (obs: ObservacionLocal) => {
    setEditingObs(obs);
    setObsDetalle(obs.detalle);
    setObsAcciones(
      obs.acciones && obs.acciones.length > 0
        ? obs.acciones.map((a) => ({ ...a }))
        : [{ descripcion: "", responsable: "" }]
    );
    setObsImagenFile(obs.imagenFile || null);
    setObsPreviewUrl(obs.previewUrl || null);
    setObsEvidenciaUrl(obs.evidencia_url || null);
    setShowObsModal(true);
  };

  const removeObservacion = (id_temp: string) => {
    setObservacionesCargadas((prev) => {
      const target = prev.find((item) => item.id_temp === id_temp);
      if (target?.previewUrl) {
        URL.revokeObjectURL(target.previewUrl);
      }
      return prev.filter((item) => item.id_temp !== id_temp);
    });
  };

  const handleSaveObservacion = () => {
    if (!obsDetalle.trim()) return;

    // Filtrar acciones vacías
    const filteredAcciones = obsAcciones.filter((a) => a.descripcion.trim().length > 0);

    if (editingObs) {
      setObservacionesCargadas((prev) =>
        prev.map((item) =>
          item.id_temp === editingObs.id_temp
            ? {
                ...item,
                detalle: obsDetalle,
                acciones: filteredAcciones,
                imagenFile: obsImagenFile || undefined,
                previewUrl: obsPreviewUrl || undefined,
                evidencia_url: obsEvidenciaUrl || undefined,
              }
            : item,
        ),
      );
    } else {
      const newObs: ObservacionLocal = {
        id_temp: Math.random().toString(36).substring(7),
        detalle: obsDetalle,
        acciones: filteredAcciones,
        imagenFile: obsImagenFile || undefined,
        previewUrl: obsPreviewUrl || undefined,
      };
      setObservacionesCargadas((prev) => [...prev, newObs]);
    }

    setShowObsModal(false);
    setEditingObs(null);
    setObsDetalle("");
    setObsAcciones([{ descripcion: "", responsable: "" }]);
    setObsImagenFile(null);
    setObsPreviewUrl(null);
    setObsEvidenciaUrl(null);
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

      // 2. Armar el payload de actualización con desvíos/puntos de mejora
      const payload = {
        actividad: actividad,
        fecha_hora_visita: dateObj.toISOString(),
        lugar_visita: lugar,
        declaracion_legal: finalDeclaracion,
        observaciones: "", // ya no se usa texto plano, pero enviamos vacío
        puntos_mejora: observacionesCargadas.map((obs) => ({
          id: obs.id, // ID en base de datos si ya existía
          detalle: obs.detalle,
          evidencia_url: obs.evidencia_url, // conservar URL existente si ya tenía
          acciones: obs.acciones.map((a) => ({
            id: a.id,
            descripcion: a.descripcion,
            responsable: a.responsable || undefined,
          })),
        })),
      };

      // 3. Guardar cambios
      const { data: updatedInforme } = await api.patch(
        `/informes/${id}`,
        payload,
      );

      // 4. Si hay imágenes nuevas seleccionadas durante la edición, subirlas
      const obsConImagenNueva = observacionesCargadas.filter(
        (obs) => obs.imagenFile,
      );
      for (const obs of obsConImagenNueva) {
        const pmCreado = updatedInforme.puntos_mejora?.find(
          (pm: any) => pm.id === obs.id || pm.detalle === obs.detalle,
        );
        if (pmCreado) {
          const formData = new FormData();
          formData.append("evidencia", obs.imagenFile!);
          formData.append("punto_mejora_id", pmCreado.id);

          await api.post(`/informes/${id}/evidencia`, formData, {
            headers: { "Content-Type": "multipart/form-data" },
          });
        }
      }

      showAlert(
        "success",
        "Informe actualizado",
        "Los cambios se guardaron correctamente.",
      );
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

      <form onSubmit={handleSave} className="max-w-4xl mx-auto space-y-6">
        {/* Panel Principal */}
        <div className="space-y-6">
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

            <div className="border border-slate-200 rounded-xl focus-within:ring-2 focus-within:ring-blue-600/25 focus-within:border-blue-600 transition-all bg-white">
              {/* Barra de Herramientas */}
              <div className="bg-slate-50/50 border-b border-slate-200 p-2 flex items-center gap-1 select-none rounded-t-xl">
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
                <div className="h-4 w-px bg-slate-200 mx-1" />
                <div className="relative">
                  <button
                    type="button"
                    onClick={() =>
                      setShowTemplatesDropdown(!showTemplatesDropdown)
                    }
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[10px] font-black text-blue-650 hover:bg-blue-50 rounded-md transition-colors cursor-pointer uppercase tracking-wider"
                  >
                    <FileText className="h-3 w-3 shrink-0" />
                    Plantillas
                    <ChevronDown
                      className={`h-3 w-3 shrink-0 transition-transform ${showTemplatesDropdown ? "rotate-180" : ""}`}
                    />
                  </button>

                  {showTemplatesDropdown && (
                    <>
                      {/* overlay to close dropdown */}
                      <div
                        className="fixed inset-0 z-10"
                        onClick={() => setShowTemplatesDropdown(false)}
                      />

                      <div className="absolute left-0 mt-1 w-64 rounded-xl bg-white border border-slate-200 shadow-lg py-2 z-20 animate-fadeIn text-xs">
                        <div className="px-3 py-1 text-[9px] font-black text-slate-400 uppercase tracking-wider">
                          Predeterminadas
                        </div>
                        {DEFAULT_TEMPLATES.map((tmpl) => (
                          <button
                            key={tmpl.name}
                            type="button"
                            onClick={() => {
                              if (editorRef.current) {
                                editorRef.current.innerHTML = tmpl.content;
                                updateToolbarState();
                              }
                              setShowTemplatesDropdown(false);
                            }}
                            className="w-full text-left px-3 py-2 text-slate-700 hover:bg-slate-50 font-bold block truncate cursor-pointer"
                            title={tmpl.content}
                          >
                            {tmpl.name}
                          </button>
                        ))}

                        <div className="h-px bg-slate-100 my-1" />
                        <div className="px-3 py-1 text-[9px] font-black text-slate-400 uppercase tracking-wider flex items-center justify-between">
                          <span>Mis Plantillas</span>
                          <button
                            type="button"
                            onClick={openSaveTemplateModal}
                            className="text-[9px] font-black text-blue-655 hover:underline lowercase tracking-normal cursor-pointer"
                          >
                            + guardar actual
                          </button>
                        </div>

                        {customTemplates.length > 0 ? (
                          customTemplates.map((tmpl) => (
                            <div key={tmpl.id} className="relative group/tmpl">
                              <button
                                type="button"
                                onClick={() => {
                                  if (editorRef.current) {
                                    editorRef.current.innerHTML =
                                      tmpl.contenido;
                                    updateToolbarState();
                                  }
                                  setShowTemplatesDropdown(false);
                                }}
                                className="w-full text-left px-3 py-2 text-slate-700 hover:bg-slate-50 font-bold block truncate pr-8 cursor-pointer"
                                title={tmpl.contenido}
                              >
                                {tmpl.nombre}
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setTemplateToDelete({
                                    id: tmpl.id,
                                    nombre: tmpl.nombre,
                                  });
                                  setShowTemplatesDropdown(false);
                                }}
                                className="absolute right-2 top-2 p-1 text-slate-400 hover:text-red-650 opacity-0 group-hover/tmpl:opacity-100 transition-opacity cursor-pointer rounded-full hover:bg-slate-100"
                                title="Eliminar plantilla"
                              >
                                <X className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          ))
                        ) : (
                          <div className="px-3 py-2 text-slate-400 italic">
                            No tienes plantillas guardadas.
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>
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
                className="block w-full p-4 text-sm text-slate-700 bg-slate-50/40 border-0 focus:ring-0 focus:outline-hidden min-h-[120px] font-medium leading-relaxed overflow-y-auto rounded-b-xl"
              />
            </div>
          </div>

          {/* Observaciones y desvíos estructurados */}
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Observaciones y Hallazgos
              </label>
              <button
                type="button"
                onClick={openAddModal}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-655 font-bold rounded-xl text-xs transition-colors cursor-pointer"
              >
                + Agregar nueva observación
              </button>
            </div>

            {/* Listado de Previsualización */}
            {observacionesCargadas.length > 0 ? (
              <div className="space-y-3">
                {observacionesCargadas.map((obs, idx) => (
                  <div
                    key={obs.id_temp}
                    className="border border-slate-200 rounded-2xl p-4 bg-slate-50/20 flex items-start gap-4 shadow-2xs"
                  >
                    {/* Miniatura de imagen */}
                    <div className="h-16 w-16 rounded-xl bg-slate-100 border border-slate-200 shrink-0 overflow-hidden relative">
                      {obs.previewUrl ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img
                          src={obs.previewUrl}
                          alt={`Obs ${idx + 1}`}
                          className="w-full h-full object-cover"
                        />
                      ) : obs.evidencia_url ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img
                          src={obs.evidencia_url}
                          alt={`Obs ${idx + 1}`}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-slate-450 bg-slate-100">
                          <Camera className="h-5 w-5" />
                        </div>
                      )}
                    </div>
                    {/* Detalles */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-[9px] font-black text-blue-600 uppercase tracking-wider">
                          Observación #{idx + 1}
                        </span>
                        <div className="flex gap-2.5">
                          <button
                            type="button"
                            onClick={() => openEditModal(obs)}
                            className="text-[10px] font-bold text-slate-500 hover:text-slate-800 cursor-pointer"
                          >
                            Editar
                          </button>
                          <button
                            type="button"
                            onClick={() => removeObservacion(obs.id_temp)}
                            className="text-[10px] font-bold text-red-500 hover:text-red-700 cursor-pointer"
                          >
                            Eliminar
                          </button>
                        </div>
                      </div>
                      <h4 className="text-xs font-bold text-slate-850 mt-1 leading-normal wrap-break-word">
                        {obs.detalle}
                      </h4>
                      {obs.acciones && obs.acciones.length > 0 && (
                        <div className="space-y-1.5 mt-1.5">
                          {obs.acciones.map((acc, accIdx) => (
                            <div key={accIdx} className="text-xs text-slate-500 font-semibold bg-white border border-slate-100 rounded-lg p-2 leading-relaxed flex items-center justify-between">
                              <span>
                                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wide mr-1.5">
                                  Acción {obs.acciones.length > 1 ? `#${accIdx + 1}` : ""}:
                                </span>{" "}
                                {acc.descripcion}
                              </span>
                              {acc.responsable && (
                                <span className="text-[9px] px-2 py-0.5 bg-blue-50 text-blue-650 font-bold rounded-md">
                                  Resp: {acc.responsable}
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="border-2 border-dashed border-slate-200 rounded-2xl p-8 text-center text-xs font-bold text-slate-400 bg-slate-50/10">
                No se han cargado observaciones para esta visita.
              </div>
            )}
          </div>

          {/* Botones de Acción al final del formulario principal */}
          <div className="flex flex-col sm:flex-row justify-end gap-3 pt-6 ">
            <button
              type="button"
              onClick={() => router.push(`/informes/${id}`)}
              className="px-5 py-2.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-600 text-sm font-bold rounded-xl flex items-center justify-center transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-xl flex items-center justify-center gap-2 shadow-md shadow-blue-900/10 hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              <Check className="h-4 w-4 stroke-3" />
              {loading ? "Guardando..." : "Guardar Cambios"}
            </button>
          </div>
        </div>
      </form>

      {/* Modal de Observaciones (Carga / Edición) */}
      {showObsModal && (
        <div className="fixed inset-0 bg-slate-900/45 backdrop-blur-xs flex items-center justify-center z-50 animate-fadeIn">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl border border-slate-100 space-y-4 mx-4">
            <div>
              <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wide">
                {editingObs ? "Editar Observación" : "Agregar Observación"}
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Completa los datos del desvío detectado.
              </p>
            </div>

            <div className="space-y-4">
              {/* Imagen */}
              <div className="space-y-2">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Evidencia Fotográfica
                </label>
                <div className="flex items-center gap-4">
                  {obsPreviewUrl ? (
                    <div className="relative h-20 w-20 rounded-xl overflow-hidden border border-slate-200 bg-slate-50 shrink-0">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={obsPreviewUrl}
                        alt="Preview"
                        className="w-full h-full object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setObsImagenFile(null);
                          setObsPreviewUrl(null);
                        }}
                        className="absolute top-1 right-1 p-1 bg-slate-900/60 hover:bg-red-650 text-white rounded-full transition-colors cursor-pointer"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ) : obsEvidenciaUrl ? (
                    <div className="relative h-20 w-20 rounded-xl overflow-hidden border border-slate-200 bg-slate-50 shrink-0">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={obsEvidenciaUrl}
                        alt="Evidencia Guardada"
                        className="w-full h-full object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setObsEvidenciaUrl(null);
                        }}
                        className="absolute top-1 right-1 p-1 bg-slate-900/60 hover:bg-red-650 text-white rounded-full transition-colors cursor-pointer"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ) : (
                    <label className="border-2 border-dashed border-slate-200 hover:border-blue-500 hover:bg-blue-50/25 rounded-xl h-20 w-20 flex flex-col items-center justify-center gap-1 transition-all cursor-pointer relative shrink-0">
                      <Camera className="h-5 w-5 text-slate-400" />
                      <span className="text-[8px] font-bold text-slate-400">
                        Subir
                      </span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            setObsImagenFile(file);
                            setObsPreviewUrl(URL.createObjectURL(file));
                          }
                        }}
                        className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                      />
                    </label>
                  )}
                  <div className="text-xs text-slate-400">
                    Sube una foto que evidencie el desvío.
                  </div>
                </div>
              </div>

              {/* Descripción */}
              <div className="space-y-2">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Descripción del Hallazgo
                </label>
                <textarea
                  placeholder="Detalla lo observado..."
                  value={obsDetalle}
                  onChange={(e) => setObsDetalle(e.target.value)}
                  rows={3}
                  className="block w-full border border-slate-200 rounded-xl px-3.5 py-3 text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-600/25 focus:border-blue-600 transition-all font-bold text-slate-700 bg-brand-input-bg resize-none"
                />
              </div>

              {/* Acciones de Mejora */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Acciones de Mejora Sugeridas
                  </label>
                  <button
                    type="button"
                    onClick={() => setObsAcciones(prev => [...prev, { descripcion: "", responsable: "" }])}
                    className="inline-flex items-center text-[10px] font-bold text-blue-655 hover:underline cursor-pointer"
                  >
                    + Nueva acción
                  </button>
                </div>
                
                <div className="space-y-3 max-h-52 overflow-y-auto pr-1">
                  {obsAcciones.map((acc, index) => (
                    <div key={index} className="space-y-2 p-3 bg-slate-50/50 rounded-xl border border-slate-100 relative">
                      <div className="flex items-center justify-between">
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-wide">
                          Acción #{index + 1}
                        </span>
                        {obsAcciones.length > 1 && (
                          <button
                            type="button"
                            onClick={() => setObsAcciones(prev => prev.filter((_, i) => i !== index))}
                            className="text-[9px] font-bold text-red-500 hover:underline cursor-pointer"
                          >
                            Eliminar
                          </button>
                        )}
                      </div>
                      
                      <div className="grid grid-cols-1 gap-2">
                        <div>
                          <input
                            type="text"
                            placeholder="Descripción de la acción..."
                            value={acc.descripcion}
                            required
                            onChange={(e) => {
                              const newDesc = e.target.value;
                              setObsAcciones(prev => prev.map((item, i) => i === index ? { ...item, descripcion: newDesc } : item));
                            }}
                            className="block w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-hidden focus:ring-2 focus:ring-blue-600/25 focus:border-blue-600 transition-all font-bold text-slate-700 bg-white"
                          />
                        </div>
                        <div>
                          <input
                            type="text"
                            placeholder="Responsable (Ej. Hig. y Seg.)"
                            value={acc.responsable}
                            onChange={(e) => {
                              const newResp = e.target.value;
                              setObsAcciones(prev => prev.map((item, i) => i === index ? { ...item, responsable: newResp } : item));
                            }}
                            className="block w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-hidden focus:ring-2 focus:ring-blue-600/25 focus:border-blue-600 transition-all font-bold text-slate-700 bg-white"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex gap-2 justify-end pt-2">
              <button
                type="button"
                onClick={() => {
                  setShowObsModal(false);
                  setEditingObs(null);
                }}
                className="px-4 py-2.5 text-xs font-bold text-slate-500 hover:bg-slate-50 rounded-xl border border-slate-200 cursor-pointer transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSaveObservacion}
                disabled={!obsDetalle.trim() || obsAcciones.some(a => !a.descripcion.trim())}
                className="px-4 py-2.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {editingObs ? "Guardar Cambios" : "Guardar Observación"}
              </button>
            </div>
          </div>
        </div>
      )}

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

      {/* Modal para Guardar Plantilla */}
      {showSaveTemplateModal && (
        <div className="fixed inset-0 bg-slate-900/45 backdrop-blur-xs flex items-center justify-center z-50 animate-fadeIn">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl border border-slate-100 space-y-4 mx-4">
            <div>
              <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wide">
                Guardar Plantilla
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Escribe un nombre para guardar el texto actual de la
                declaración.
              </p>
            </div>

            <div className="space-y-2">
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Nombre de la Plantilla
              </label>
              <input
                type="text"
                placeholder="Ej. Visita Planta Industrial"
                value={newTemplateName}
                onChange={(e) => setNewTemplateName(e.target.value)}
                className="block w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-600/25 focus:border-blue-600 transition-all font-bold text-slate-700 bg-brand-input-bg"
                autoFocus
              />
            </div>

            <div className="flex gap-2 justify-end pt-2">
              <button
                type="button"
                onClick={() => setShowSaveTemplateModal(false)}
                className="px-4 py-2.5 text-xs font-bold text-slate-500 hover:bg-slate-50 rounded-xl border border-slate-200 cursor-pointer transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSaveTemplateSubmit}
                disabled={!newTemplateName.trim()}
                className="px-4 py-2.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Guardar Plantilla
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Confirmación para Eliminar Plantilla */}
      {templateToDelete && (
        <div className="fixed inset-0 bg-slate-900/45 backdrop-blur-xs flex items-center justify-center z-50 animate-fadeIn">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl border border-slate-100 space-y-4 mx-4 text-center flex flex-col items-center">
            <div className="h-12 w-12 rounded-2xl bg-red-50 text-red-650 flex items-center justify-center shrink-0">
              <AlertCircle className="h-6 w-6" />
            </div>

            <div className="space-y-1.5 w-full">
              <h3 className="font-black text-slate-900 text-sm">
                ¿Eliminar plantilla?
              </h3>
              <p className="text-xs text-slate-500 font-bold leading-relaxed">
                ¿Estás seguro de que deseas eliminar la plantilla &quot;
                {templateToDelete.nombre}&quot;? Esta acción no se puede
                deshacer.
              </p>
            </div>

            <div className="flex gap-2 w-full pt-2">
              <button
                type="button"
                onClick={() => setTemplateToDelete(null)}
                className="flex-1 py-2.5 px-4 text-xs font-bold text-slate-500 hover:bg-slate-50 rounded-xl border border-slate-200 cursor-pointer transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleDeleteTemplateConfirm}
                className="flex-1 py-2.5 px-4 text-xs font-bold text-white bg-red-600 hover:bg-red-755 rounded-xl cursor-pointer transition-colors"
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
