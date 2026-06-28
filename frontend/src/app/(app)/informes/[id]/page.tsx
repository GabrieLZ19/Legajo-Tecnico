"use client";

import React, { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useInformeDetalle } from "@/hooks/useInformes";
import { api } from "@/lib/api";
import { useQueryClient } from "@tanstack/react-query";
import { useAlert } from "@/context/AlertContext";
import {
  Calendar,
  User,
  MapPin,
  ShieldAlert,
  FileDown,
  CheckCircle2,
  Upload,
  PenTool,
  Scale,
  ArrowLeft,
  Building2,
  Clock,
  Camera,
  X,
} from "lucide-react";

export default function InformeDetallePage() {
  const { id } = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { showAlert } = useAlert();
  const { data: informe, isLoading, error } = useInformeDetalle(id as string);

  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-24 bg-white border border-slate-200 rounded-2xl animate-pulse"></div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="h-28 bg-white border border-slate-200 rounded-2xl animate-pulse"></div>
            <div className="h-48 bg-white border border-slate-200 rounded-2xl animate-pulse"></div>
          </div>
          <div className="h-80 bg-white border border-slate-200 rounded-2xl animate-pulse"></div>
        </div>
      </div>
    );
  }

  if (error || !informe) {
    return (
      <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center space-y-4 max-w-md mx-auto">
        <ShieldAlert className="h-12 w-12 text-red-500 mx-auto" />
        <h2 className="text-lg font-bold text-slate-800">
          Error al cargar el informe
        </h2>
        <p className="text-sm text-slate-500">
          No se pudo encontrar el informe solicitado o no tienes permisos para
          verlo.
        </p>
        <button
          onClick={() => router.push("/informes")}
          className="px-4 py-2 bg-blue-600 text-white text-sm font-bold rounded-xl"
        >
          Volver a Informes
        </button>
      </div>
    );
  }

  const handleFileChange = async (
    puntoMejoraId: string,
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingId(puntoMejoraId);
    const formData = new FormData();
    formData.append("evidencia", file);
    formData.append("punto_mejora_id", puntoMejoraId);

    try {
      await api.post(`/informes/${id}/evidencia`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      queryClient.invalidateQueries({ queryKey: ["informe", id] });
    } catch (err: any) {
      showAlert(
        "error",
        "Error de subida",
        err.response?.data?.error || "Error al subir la evidencia",
      );
    } finally {
      setUploadingId(null);
    }
  };

  const preventorFirmado = informe.firmas_informe?.some(
    (f) => f.tipo === "preventor",
  );
  const duenoFirmado = informe.firmas_informe?.some((f) => f.tipo === "dueno");
  const informeCerrado = preventorFirmado && duenoFirmado;

  // Formatear la fecha para los títulos
  const fechaVisita = new Date(informe.fecha_hora_visita);
  const fechaFormateada = fechaVisita.toLocaleDateString("es-AR");
  const horaFormateada = fechaVisita.toLocaleTimeString("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
  });

  // Buscar nombres de firmantes si existen
  const firmaP = informe.firmas_informe?.find((f) => f.tipo === "preventor");
  const firmaD = informe.firmas_informe?.find((f) => f.tipo === "dueno");

  return (
    <div className="space-y-6">
      {/* Botón Volver y Título Principal */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <button
            onClick={() => router.push("/informes")}
            className="h-10 w-10 bg-white border border-slate-200 rounded-xl flex items-center justify-center text-slate-600 hover:bg-slate-50 transition-colors shadow-2xs cursor-pointer"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl md:text-2xl font-black text-slate-900">
                Informe N° {String(informe.numero_informe).padStart(6, "0")}
              </h1>
            </div>
            <p className="text-xs text-slate-500 font-bold mt-0.5">
              {informe.lugar_visita || "Planta"} — {fechaFormateada} ·{" "}
              {horaFormateada}
            </p>
          </div>
        </div>

        {/* Acciones Rápidas */}
        <div className="flex gap-2">
          {!preventorFirmado && (
            <>
              <button
                onClick={() => router.push(`/informes/${id}/editar`)}
                className="inline-flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-4 py-2.5 rounded-xl text-xs transition-all border border-slate-200 cursor-pointer"
              >
                <PenTool className="h-3.5 w-3.5 text-slate-500" />
                Editar Informe
              </button>
              <button
                onClick={() => router.push(`/informes/${id}/firma`)}
                className="inline-flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold px-4 py-2.5 rounded-xl text-xs transition-all shadow-md shadow-blue-900/10 cursor-pointer"
              >
                <PenTool className="h-3.5 w-3.5" />
                Firmar Preventor
              </button>
            </>
          )}
          {preventorFirmado && !duenoFirmado && (
            <button
              onClick={() => router.push(`/informes/${id}/firma`)}
              className="inline-flex items-center gap-1.5 bg-amber-500 hover:bg-amber-600 text-white font-bold px-4 py-2.5 rounded-xl text-xs transition-all shadow-md shadow-amber-900/10 cursor-pointer"
            >
              <PenTool className="h-3.5 w-3.5" />
              Firmar Dueño
            </button>
          )}
        </div>
      </div>

      {/* Grid Principal - 2 Columnas */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Columna Izquierda (2/3) */}
        <div className="lg:col-span-2 space-y-6">
          {/* Fila de 3 Tarjetas Informativas */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white border border-slate-200 rounded-2xl p-4 flex items-center gap-3 shadow-2xs">
              <div className="h-9 w-9 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600 shrink-0">
                <Calendar className="h-4 w-4" />
              </div>
              <div>
                <span className="block text-[9px] font-black text-slate-400 uppercase tracking-wider">
                  Fecha y Hora
                </span>
                <span className="text-xs font-bold text-slate-700">
                  {fechaFormateada} · {horaFormateada}
                </span>
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl p-4 flex items-center gap-3 shadow-2xs">
              <div className="h-9 w-9 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600 shrink-0">
                <MapPin className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <span className="block text-[9px] font-black text-slate-400 uppercase tracking-wider">
                  Lugar de Visita
                </span>
                <span className="text-xs font-bold text-slate-700 block truncate">
                  {informe.lugar_visita || "N/A"}
                </span>
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl p-4 flex items-center gap-3 shadow-2xs">
              <div className="h-9 w-9 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600 shrink-0">
                <User className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <span className="block text-[9px] font-black text-slate-400 uppercase tracking-wider">
                  Contacto
                </span>
                <span className="text-xs font-bold text-slate-700 block truncate">
                  {informe.contacto_visita || "Responsable"}
                </span>
              </div>
            </div>
          </div>

          {/* Declaración Legal */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-2xs space-y-4">
            <div className="flex items-center gap-2 text-slate-900 font-bold text-sm border-b border-slate-100 pb-2.5">
              <Scale className="h-4.5 w-4.5 text-blue-600" />
              <h2>Declaración legal</h2>
            </div>
            <div
              className="text-xs text-slate-600 leading-relaxed font-semibold"
              dangerouslySetInnerHTML={{
                __html:
                  informe.declaracion_legal ||
                  "Se deja constancia de que se verificaron las condiciones de higiene y seguridad del establecimiento conforme a la normativa vigente (Ley 19.587 y Dec. 351/79).",
              }}
            />
          </div>

          {/* Evidencia Fotográfica (Múltiple) */}
          {informe.evidencias_urls && informe.evidencias_urls.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-2xs space-y-4">
              <h2 className="text-xs font-black text-slate-400 uppercase tracking-wider">
                Evidencia fotográfica
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {informe.evidencias_urls.map((url, idx) => {
                  const isRealUrl =
                    url.startsWith("http") || url.startsWith("/");
                  return (
                    <div
                      key={url}
                      className="border border-slate-200 rounded-xl p-2 bg-slate-50/50 flex flex-col items-center justify-center gap-2 group hover:shadow-2xs transition-all"
                    >
                      {isRealUrl ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img
                          src={url}
                          alt={`Evidencia ${idx + 1}`}
                          onClick={() => setSelectedImage(url)}
                          className="h-24 w-full object-cover rounded-lg border border-slate-200 cursor-pointer hover:opacity-90 transition-opacity"
                        />
                      ) : (
                        <div className="h-24 w-full rounded-lg border border-slate-200 bg-slate-100 flex flex-col items-center justify-center gap-1.5 text-slate-400">
                          <Camera className="h-5 w-5" />
                          <span className="text-[9px] font-bold text-slate-400">
                            Sin foto física
                          </span>
                        </div>
                      )}
                      <span className="text-[10px] font-bold text-slate-500">
                        {isRealUrl ? `Imagen ${idx + 1}` : url}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Peligros Detectados Banner */}
          {informe.peligros_detectados &&
            informe.peligros_detectados.length > 0 && (
              <div className="bg-amber-50/70 border border-amber-100 rounded-2xl p-5 flex items-start gap-3 text-amber-900">
                <ShieldAlert className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <h3 className="text-xs font-black uppercase tracking-wider text-amber-800">
                    Peligros detectados / Medida de control
                  </h3>
                  <div className="mt-1 space-y-1.5 text-xs font-bold leading-relaxed">
                    {informe.peligros_detectados.map((p) => (
                      <p key={p.id}>
                        • {p.descripcion}{" "}
                        {p.medida_control && (
                          <span className="text-amber-700 font-semibold">
                            (Medida: {p.medida_control})
                          </span>
                        )}
                      </p>
                    ))}
                  </div>
                </div>
              </div>
            )}

          {/* Observaciones (Puntos a Mejorar / Desvíos) */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-2xs space-y-4">
            <h2 className="text-sm font-bold text-slate-950">Observaciones</h2>

            {/* Párrafo de observaciones generales si existe */}
            {informe.observaciones && (
              <p className="text-xs text-slate-600 font-semibold leading-relaxed border-b border-slate-100 pb-4 whitespace-pre-wrap">
                {informe.observaciones}
              </p>
            )}

            {/* Listado de Puntos a Mejorar */}
            {informe.puntos_mejora && informe.puntos_mejora.length > 0 ? (
              <div className="space-y-4">
                {informe.puntos_mejora.map((pm) => {
                  const acciones =
                    informe.acciones_mejora?.filter(
                      (a) => a.punto_mejora_id === pm.id,
                    ) || [];
                  const todasCumplidas =
                    acciones.length > 0 &&
                    acciones.every((a) => a.estado === "cumplida");
                  const algunaAtendida = acciones.some(
                    (a) => a.estado === "atendida",
                  );
                  const estadoLabel = todasCumplidas
                    ? "Cumplida"
                    : algunaAtendida
                      ? "Atendida"
                      : "Pendiente";

                  return (
                    <div
                      key={pm.id}
                      className="border border-slate-100 rounded-xl p-4 bg-slate-50/30 space-y-3"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="space-y-1">
                          <h3 className="text-xs font-bold text-slate-900">
                            {pm.detalle}
                          </h3>
                          <p className="text-[11px] text-slate-400 font-bold">
                            Desvío detectado en la visita · Ítem{" "}
                            {pm.numero_item}
                          </p>
                        </div>
                        <span
                          className={`text-[10px] font-black px-2.5 py-0.5 rounded-full shrink-0 ${
                            estadoLabel === "Cumplida"
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-100"
                              : estadoLabel === "Atendida"
                                ? "bg-blue-50 text-blue-700 border border-blue-100"
                                : "bg-amber-50 text-amber-700 border border-amber-100"
                          }`}
                        >
                          {estadoLabel}
                        </span>
                      </div>

                      {/* Imagen de evidencia del desvío si existe */}
                      {pm.evidencia_url && (
                        <div className="max-w-xs">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={pm.evidencia_url}
                            alt="Evidencia desvío"
                            onClick={() => setSelectedImage(pm.evidencia_url!)}
                            className="h-20 rounded-lg object-cover border border-slate-200 cursor-pointer hover:opacity-90 transition-opacity"
                          />
                        </div>
                      )}

                      {/* Acciones */}
                      {acciones.length > 0 && (
                        <div className="bg-white border border-slate-100 rounded-lg p-3 space-y-2">
                          <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider">
                            Acciones de Mejora
                          </span>
                          {acciones.map((acc) => (
                            <div
                              key={acc.id}
                              className="flex items-center justify-between text-xs border-t border-slate-50 pt-2 first:border-0 first:pt-0"
                            >
                              <span className="text-slate-600 font-semibold">
                                {acc.descripcion}
                              </span>
                              <select
                                value={acc.estado}
                                onChange={async (e) => {
                                  const nuevoEstado = e.target.value as any;
                                  try {
                                    await api.patch(`/plan-accion/${acc.id}`, {
                                      estado: nuevoEstado,
                                    });
                                    queryClient.invalidateQueries({
                                      queryKey: ["informe", id],
                                    });
                                    showAlert(
                                      "success",
                                      "Estado actualizado",
                                      "El estado de la acción se ha actualizado correctamente.",
                                    );
                                  } catch (err: any) {
                                    showAlert(
                                      "error",
                                      "Error al actualizar",
                                      err.response?.data?.error ||
                                        "No se pudo actualizar el estado.",
                                    );
                                  }
                                }}
                                className={`text-[9px] font-black px-2.5 py-1 rounded-md border border-transparent outline-hidden cursor-pointer transition-all ${
                                  acc.estado === "cumplida"
                                    ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100/70 hover:border-emerald-200"
                                    : acc.estado === "atendida"
                                      ? "bg-blue-50 text-blue-700 hover:bg-blue-100/70 hover:border-blue-200"
                                      : "bg-amber-50 text-amber-700 hover:bg-amber-100/70 hover:border-amber-200"
                                }`}
                              >
                                <option
                                  value="pendiente"
                                  className="bg-white text-slate-800 font-semibold"
                                >
                                  PENDIENTE
                                </option>
                                <option
                                  value="atendida"
                                  className="bg-white text-slate-800 font-semibold"
                                >
                                  ATENDIDA
                                </option>
                                <option
                                  value="cumplida"
                                  className="bg-white text-slate-800 font-semibold"
                                >
                                  CUMPLIDA
                                </option>
                              </select>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              !informe.observaciones && (
                <p className="text-xs text-slate-500 font-bold">
                  No se registraron desvíos ni observaciones particulares.
                </p>
              )
            )}
          </div>
        </div>

        {/* Columna Derecha (1/3) */}
        <div className="space-y-6">
          {/* Tarjeta de Estado General */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-2xs flex items-center justify-between">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider font-sans">
              Estado General
            </span>
            <span
              className={`text-xs font-black px-3 py-1 rounded-full flex items-center gap-1.5 ${
                informeCerrado
                  ? "bg-emerald-50 text-emerald-700 border border-emerald-100"
                  : "bg-amber-50 text-amber-700 border border-amber-100"
              }`}
            >
              <span
                className={`h-2 w-2 rounded-full ${informeCerrado ? "bg-emerald-500" : "bg-amber-500"}`}
              />
              {informeCerrado ? "Cerrado" : "Pendiente"}
            </span>
          </div>

          {/* Estado del Informe (Línea de Tiempo) */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-2xs space-y-5">
            <h2 className="text-xs font-black text-slate-400 uppercase tracking-wider">
              Estado del informe
            </h2>

            <div className="relative border-l-2 border-slate-100 pl-5 ml-2 space-y-6 text-xs font-bold">
              {/* Creado */}
              <div className="relative">
                <div className="absolute left-[-27px] top-0.5 h-3.5 w-3.5 rounded-full bg-emerald-500 border-2 border-white flex items-center justify-center" />
                <div>
                  <span className="block text-slate-800">Creado</span>
                  <span className="text-[10px] text-slate-400 font-bold">
                    {fechaFormateada} · {horaFormateada}
                  </span>
                </div>
              </div>

              {/* Firmado por empresa */}
              <div className="relative">
                <div
                  className={`absolute left-[-27px] top-0.5 h-3.5 w-3.5 rounded-full border-2 border-white flex items-center justify-center ${
                    duenoFirmado ? "bg-emerald-500" : "bg-slate-200"
                  }`}
                />
                <div>
                  <span
                    className={`block ${duenoFirmado ? "text-slate-800" : "text-slate-400"}`}
                  >
                    Firmado por empresa
                  </span>
                  {firmaD && (
                    <span className="text-[10px] text-slate-400 font-bold">
                      {new Date(firmaD.firmado_at).toLocaleDateString("es-AR")}{" "}
                      ·{" "}
                      {new Date(firmaD.firmado_at).toLocaleTimeString("es-AR", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  )}
                </div>
              </div>

              {/* Firmado por preventor */}
              <div className="relative">
                <div
                  className={`absolute left-[-27px] top-0.5 h-3.5 w-3.5 rounded-full border-2 border-white flex items-center justify-center ${
                    preventorFirmado ? "bg-emerald-500" : "bg-slate-200"
                  }`}
                />
                <div>
                  <span
                    className={`block ${preventorFirmado ? "text-slate-800" : "text-slate-400"}`}
                  >
                    Firmado por preventor
                  </span>
                  {firmaP && (
                    <span className="text-[10px] text-slate-400 font-bold">
                      {new Date(firmaP.firmado_at).toLocaleDateString("es-AR")}{" "}
                      ·{" "}
                      {new Date(firmaP.firmado_at).toLocaleTimeString("es-AR", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  )}
                </div>
              </div>

              {/* Informe Cerrado */}
              <div className="relative">
                <div
                  className={`absolute left-[-27px] top-0.5 h-3.5 w-3.5 rounded-full border-2 border-white flex items-center justify-center ${
                    informeCerrado ? "bg-emerald-500" : "bg-slate-200"
                  }`}
                />
                <div>
                  <span
                    className={`block ${informeCerrado ? "text-slate-800" : "text-slate-400"}`}
                  >
                    Informe cerrado
                  </span>
                  {informeCerrado && (
                    <span className="text-[10px] text-slate-400 font-bold">
                      {new Date(firmaP!.firmado_at).toLocaleDateString("es-AR")}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Firmas */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-2xs space-y-4">
            <h2 className="text-xs font-black text-slate-400 uppercase tracking-wider">
              Firmas
            </h2>

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-slate-50 border border-slate-100 rounded-xl p-3.5 text-center flex flex-col items-center justify-center gap-1.5">
                <div
                  className={`h-8 w-8 rounded-full flex items-center justify-center ${
                    duenoFirmado
                      ? "bg-emerald-50 text-emerald-600"
                      : "bg-slate-100 text-slate-400"
                  }`}
                >
                  <PenTool className="h-4 w-4" />
                </div>
                <span className="text-xs font-black text-slate-800">
                  {duenoFirmado ? "M. Ríos" : "Pendiente"}
                </span>
                <span className="text-[9px] text-slate-400 font-bold">
                  Responsable Empresa
                </span>
              </div>

              <div className="bg-slate-50 border border-slate-100 rounded-xl p-3.5 text-center flex flex-col items-center justify-center gap-1.5">
                <div
                  className={`h-8 w-8 rounded-full flex items-center justify-center ${
                    preventorFirmado
                      ? "bg-emerald-50 text-emerald-600"
                      : "bg-slate-100 text-slate-400"
                  }`}
                >
                  <PenTool className="h-4 w-4" />
                </div>
                <span className="text-xs font-black text-slate-800">
                  {preventorFirmado ? "D. Ludueña" : "Pendiente"}
                </span>
                <span className="text-[9px] text-slate-400 font-bold">
                  Prof. Seguridad
                </span>
              </div>
            </div>
          </div>

          {/* Descargar Constancia (PDF) */}
          {informe.url_pdf_generado ? (
            <a
              href={informe.url_pdf_generado}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full py-3.5 bg-slate-900 hover:bg-slate-850 text-white rounded-xl flex items-center justify-center gap-2 text-xs font-black transition-colors shadow-md shadow-slate-900/10 cursor-pointer"
            >
              <FileDown className="h-4 w-4" />
              Descargar Constancia (PDF)
            </a>
          ) : (
            <button
              disabled
              className="w-full py-3.5 bg-slate-100 text-slate-400 rounded-xl flex items-center justify-center gap-2 text-xs font-black cursor-not-allowed border border-slate-200"
            >
              <FileDown className="h-4 w-4" />
              Descargar Constancia (PDF)
            </button>
          )}
        </div>
      </div>

      {/* Lightbox para ver imágenes en tamaño completo */}
      {selectedImage && (
        <div
          className="fixed inset-0 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center z-50 p-4 select-none cursor-pointer animate-fadeIn"
          onClick={() => setSelectedImage(null)}
        >
          <div className="relative max-w-4xl max-h-[90vh] w-full h-full flex items-center justify-center">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setSelectedImage(null);
              }}
              className="absolute top-4 right-4 p-2 bg-slate-900/60 hover:bg-red-600 text-white rounded-full transition-colors cursor-pointer z-10"
            >
              <X className="h-5 w-5" />
            </button>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={selectedImage}
              alt="Evidencia a tamaño completo"
              className="max-w-full max-h-full object-contain rounded-2xl shadow-2xl border border-slate-800/30"
            />
          </div>
        </div>
      )}
    </div>
  );
}

// Icono simple
function BriefcaseIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M16 20V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
      <rect width="20" height="14" x="2" y="6" rx="2" />
    </svg>
  );
}
