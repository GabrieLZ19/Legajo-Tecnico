"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  Calendar,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  Clock,
  Copy,
  ExternalLink,
  FileCheck2,
  FileStack,
  Info,
  Loader,
  MapPin,
  Pencil,
  Plus,
  Printer,
  QrCode,
  ShieldAlert,
  Tag,
  Trash2,
  User,
  Wrench,
  X,
} from "lucide-react";
import { checklistsService } from "@/utils/services/checklists.service";
import { canWriteAppModule } from "@/lib/moduleAccess";
import { useAuth } from "@/hooks/useAuth";
import { useAlert } from "@/context/AlertContext";
import { EquipoQrCard } from "@/components/EquipoQrCard";
import { printEquipoQrLabel } from "@/lib/printEquipoQr";
import type { ChecklistPlantilla, Inspeccion } from "@/types";

export default function EquipoDetallePage() {
  const params = useParams();
  const id = params.id as string;
  const router = useRouter();
  const { user, empresa } = useAuth();
  const { showAlert } = useAlert();
  const queryClient = useQueryClient();
  const canWrite = canWriteAppModule(user, "checklists");

  // Estados de modales
  const [isEditing, setIsEditing] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Formulario de edición
  const [nombre, setNombre] = useState("");
  const [tipoEquipo, setTipoEquipo] = useState("");
  const [codigoInterno, setCodigoInterno] = useState("");
  const [ubicacion, setUbicacion] = useState("");
  const [notas, setNotas] = useState("");
  const [activo, setActivo] = useState(true);

  // Obtener datos del equipo
  const { data, isLoading } = useQuery({
    queryKey: ["checklist-equipo", id],
    queryFn: () => checklistsService.obtenerEquipo(id),
    enabled: !!id,
  });

  // Consultar todas las plantillas para ver compatibles
  const { data: plantillasEmpresa = [] } = useQuery({
    queryKey: ["checklist-plantillas-empresa", empresa?.id],
    queryFn: () =>
      checklistsService.listarPlantillas({
        ambito: "empresa",
        empresaId: empresa!.id,
      }),
    enabled: !!empresa?.id,
  });

  const { data: plantillasLt = [] } = useQuery({
    queryKey: ["checklist-plantillas-lt"],
    queryFn: () => checklistsService.listarPlantillas({ ambito: "global" }),
  });

  const todasPlantillas = useMemo(() => {
    return [...plantillasEmpresa, ...plantillasLt];
  }, [plantillasEmpresa, plantillasLt]);

  // Plantillas sugeridas para el tipo de este equipo
  const plantillasCompatibles = useMemo(() => {
    if (!data?.tipo_equipo) return [];
    const eqType = data.tipo_equipo.toLowerCase().trim();
    return todasPlantillas.filter((p: ChecklistPlantilla) => {
      const pType = (p.tipo_equipo || "").toLowerCase().trim();
      return (
        pType === eqType ||
        (eqType.length > 2 && pType.includes(eqType)) ||
        (pType.length > 2 && eqType.includes(pType))
      );
    });
  }, [todasPlantillas, data?.tipo_equipo]);

  // Cargar datos en el formulario de edición cuando se obtienen
  useState(() => {
    if (data) {
      setNombre(data.nombre || "");
      setTipoEquipo(data.tipo_equipo || "");
      setCodigoInterno(data.codigo_interno || "");
      setUbicacion(data.ubicacion || "");
      setNotas(data.notas || "");
      setActivo(data.activo ?? true);
    }
  });

  const handleOpenEdit = () => {
    if (data) {
      setNombre(data.nombre || "");
      setTipoEquipo(data.tipo_equipo || "");
      setCodigoInterno(data.codigo_interno || "");
      setUbicacion(data.ubicacion || "");
      setNotas(data.notas || "");
      setActivo(data.activo ?? true);
      setIsEditing(true);
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingEdit(true);
    try {
      await checklistsService.actualizarEquipo(id, {
        nombre: nombre.trim(),
        tipo_equipo: tipoEquipo.trim(),
        codigo_interno: codigoInterno.trim() || null,
        ubicacion: ubicacion.trim() || null,
        notas: notas.trim() || null,
        activo,
      });
      await queryClient.invalidateQueries({
        queryKey: ["checklist-equipo", id],
      });
      await queryClient.invalidateQueries({
        queryKey: ["checklists-equipos"],
      });
      showAlert("success", "Equipo actualizado", "Los datos se guardaron correctamente.");
      setIsEditing(false);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: string } } };
      showAlert(
        "error",
        "Error",
        axiosErr.response?.data?.error ||
          (err instanceof Error ? err.message : "No se pudo actualizar"),
      );
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const res = await checklistsService.eliminarEquipo(id);
      await queryClient.invalidateQueries({
        queryKey: ["checklists-equipos"],
      });
      if (res?.softDeleted) {
        showAlert(
          "info",
          "Equipo archivado",
          "Como tenía historial de inspecciones, fue marcado como inactivo.",
        );
        router.push("/checklists/equipos");
      } else {
        showAlert("success", "Equipo eliminado", "Se eliminó permanentemente.");
        router.push("/checklists/equipos");
      }
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: string } } };
      showAlert(
        "error",
        "Error",
        axiosErr.response?.data?.error ||
          (err instanceof Error ? err.message : "No se pudo eliminar"),
      );
    } finally {
      setDeleting(false);
      setShowDeleteModal(false);
    }
  };

  const handlePrintLabel = () => {
    if (!data) return;
    const ok = printEquipoQrLabel({
      nombre: data.nombre,
      tipo_equipo: data.tipo_equipo,
      codigo_interno: data.codigo_interno,
      ubicacion: data.ubicacion,
      qr_url: data.qr_url,
    });
    if (!ok) {
      showAlert("warning", "Pop-up bloqueado", "Habilitá ventanas emergentes para imprimir la etiqueta.");
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-24 text-slate-400">
        <Loader className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center space-y-4">
        <Wrench className="h-10 w-10 text-slate-300 mx-auto" />
        <h2 className="text-lg font-bold text-slate-900">Equipo no encontrado</h2>
        <Link
          href="/checklists/equipos"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-primary"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver a equipos
        </Link>
      </div>
    );
  }

  const qrUrl = data.qr_url || "";
  const qrImg = qrUrl
    ? `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(qrUrl)}`
    : null;

  const historial = data.historial || [];

  return (
    <div className="w-full space-y-6">
      {/* Navegación y Acciones Superiores */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <Link
          href="/checklists/equipos"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-brand-primary transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Equipos y maquinarias
        </Link>

        {canWrite && (
          <div className="flex flex-wrap items-center gap-2">
            {data.activo && (
              <Link
                href={`/checklists/inspecciones/nueva?equipoId=${data.id}`}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-brand-primary text-white text-sm font-bold hover:bg-brand-primary/95 shadow-xs transition-all cursor-pointer"
              >
                <ClipboardCheck className="h-4 w-4" />
                Nueva inspección
              </Link>
            )}

            <button
              type="button"
              onClick={handlePrintLabel}
              className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 text-sm font-semibold shadow-2xs transition-all cursor-pointer"
            >
              <Printer className="h-4 w-4" />
              Imprimir etiqueta
            </button>

            <button
              type="button"
              onClick={handleOpenEdit}
              className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 text-sm font-semibold shadow-2xs transition-all cursor-pointer"
            >
              <Pencil className="h-4 w-4" />
              Editar equipo
            </button>

            <button
              type="button"
              onClick={() => setShowDeleteModal(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-rose-200 bg-white text-rose-600 hover:bg-rose-50 text-sm font-semibold shadow-2xs transition-all cursor-pointer"
            >
              <Trash2 className="h-4 w-4" />
              Eliminar
            </button>
          </div>
        )}
      </div>

      {/* Hero Card del Equipo */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-2xs space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-full border ${
              data.activo
                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                : "bg-slate-100 text-slate-500 border-slate-200"
            }`}
          >
            <span
              className={`h-2 w-2 rounded-full ${
                data.activo ? "bg-emerald-500" : "bg-slate-400"
              }`}
            />
            {data.activo ? "Operativo / Activo" : "Inactivo / Fuera de servicio"}
          </span>

          <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
            <Wrench className="h-3.5 w-3.5 text-blue-600" />
            Tipo: <strong>{data.tipo_equipo}</strong>
          </span>

          {data.codigo_interno && (
            <span className="inline-flex items-center gap-1.5 text-xs font-mono font-bold px-2.5 py-1 rounded-md bg-slate-100 text-slate-700">
              <Tag className="h-3.5 w-3.5 text-slate-400" />
              {data.codigo_interno}
            </span>
          )}
        </div>

        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
            {data.nombre}
          </h1>

          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-brand-text-muted mt-2">
            {data.ubicacion && (
              <span className="flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5 text-slate-400" />
                Ubicación: <strong className="text-slate-700">{data.ubicacion}</strong>
              </span>
            )}
            {data.created_at && (
              <span className="flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5 text-slate-400" />
                Alta: {new Date(data.created_at).toLocaleDateString("es-AR")}
              </span>
            )}
            <span className="flex items-center gap-1.5">
              <FileCheck2 className="h-3.5 w-3.5 text-slate-400" />
              {historial.length} {historial.length === 1 ? "inspección realizada" : "inspecciones realizadas"}
            </span>
          </div>

          {data.notas && (
            <div className="mt-3 p-3 rounded-xl bg-slate-50 border border-slate-100 text-xs text-slate-600">
              <strong className="text-slate-700">Notas técnicas:</strong> {data.notas}
            </div>
          )}
        </div>
      </div>

      {/* Grid de 2 Columnas: Checklists + Historial (7 cols) y Etiqueta QR (5 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Columna Izquierda: Checklists Compatibles e Historial */}
        <div className="lg:col-span-7 space-y-6">
          {/* Checklists disponibles para este equipo */}
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <ClipboardCheck className="h-4 w-4 text-brand-primary" />
                Checklists compatibles ({plantillasCompatibles.length})
              </h2>
              {canWrite && (
                <Link
                  href="/checklists/plantillas/nueva"
                  className="text-xs font-bold text-blue-600 hover:text-blue-800"
                >
                  + Nueva plantilla
                </Link>
              )}
            </div>

            {plantillasCompatibles.length === 0 ? (
              <div className="p-4 rounded-xl border border-dashed border-slate-200 text-center space-y-2 bg-slate-50/50">
                <p className="text-xs text-slate-500">
                  No tenés un checklist creado específicamente para &quot;{data.tipo_equipo}&quot;.
                </p>
                {canWrite && (
                  <Link
                    href={`/checklists/inspecciones/nueva?equipoId=${data.id}`}
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-brand-primary hover:underline"
                  >
                    Podés seleccionar cualquier otra plantilla al iniciar una inspección →
                  </Link>
                )}
              </div>
            ) : (
              <div className="space-y-2.5">
                {plantillasCompatibles.map((p: ChecklistPlantilla) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between p-3.5 rounded-xl border border-slate-100 bg-slate-50/50 hover:bg-slate-100/60 transition-colors"
                  >
                    <div>
                      <Link
                        href={`/checklists/plantillas/${p.id}`}
                        className="text-xs font-bold text-slate-900 hover:text-brand-primary block"
                      >
                        {p.titulo}
                      </Link>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        {p.total_items ?? 0} ítems de control · {p.ambito === "empresa" ? "Empresa" : "LT Global"}
                      </p>
                    </div>

                    {canWrite && data.activo && (
                      <Link
                        href={`/checklists/inspecciones/nueva?equipoId=${data.id}&plantillaId=${p.id}`}
                        className="px-3 py-1.5 rounded-xl bg-brand-primary text-white text-xs font-bold hover:bg-brand-primary/95 transition-colors shrink-0 shadow-2xs"
                      >
                        Inspeccionar
                      </Link>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Historial de Inspecciones */}
          <section className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-2xs">
            <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/60 flex items-center justify-between">
              <h2 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <FileCheck2 className="h-4 w-4 text-brand-primary" />
                Historial de inspecciones realizadas ({historial.length})
              </h2>
            </div>

            {historial.length === 0 ? (
              <div className="px-5 py-12 text-center space-y-2">
                <ClipboardCheck className="h-8 w-8 text-slate-300 mx-auto" />
                <p className="text-sm font-semibold text-slate-600">
                  Sin inspecciones registradas todavía
                </p>
                <p className="text-xs text-slate-400 max-w-sm mx-auto">
                  Escaneá el código QR del equipo desde un celular o iniciá una inspección desde esta pantalla.
                </p>
                {canWrite && data.activo && (
                  <Link
                    href={`/checklists/inspecciones/nueva?equipoId=${data.id}`}
                    className="inline-flex mt-2 items-center gap-1.5 px-4 py-2 rounded-xl bg-brand-primary text-white text-xs font-bold hover:bg-brand-primary/95"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Cargar primera inspección
                  </Link>
                )}
              </div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {historial.map((insp: Inspeccion) => {
                  const esAprobada = insp.resultado === "aprobada";
                  const esObservada = insp.resultado === "observada";
                  return (
                    <li key={insp.id}>
                      <Link
                        href={`/checklists/inspecciones/${insp.id}`}
                        className="flex items-center justify-between px-5 py-3.5 hover:bg-slate-50 transition-colors group"
                      >
                        <div>
                          <p className="text-sm font-bold text-slate-900 group-hover:text-brand-secondary">
                            {insp.plantilla_titulo}
                          </p>
                          <div className="flex items-center gap-3 text-xs text-slate-500 mt-1">
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3 text-slate-400" />
                              {new Date(insp.fecha).toLocaleString("es-AR")}
                            </span>
                            {insp.inspector_nombre && (
                              <span className="flex items-center gap-1">
                                <User className="h-3 w-3 text-slate-400" />
                                {insp.inspector_nombre}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <span
                            className={`inline-flex items-center gap-1 text-xs font-bold capitalize px-2.5 py-1 rounded-full border ${
                              esAprobada
                                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                : esObservada
                                  ? "bg-amber-50 text-amber-700 border-amber-200"
                                  : "bg-rose-50 text-rose-700 border-rose-200"
                            }`}
                          >
                            {esAprobada && <CheckCircle2 className="h-3.5 w-3.5" />}
                            {esObservada && <AlertTriangle className="h-3.5 w-3.5" />}
                            {!esAprobada && !esObservada && (
                              <ShieldAlert className="h-3.5 w-3.5" />
                            )}
                            {insp.resultado}
                          </span>
                          <ChevronRight className="h-4 w-4 text-slate-300" />
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>

        {/* Columna Derecha: Etiqueta QR Industrial (5 cols - Sticky) */}
        <div className="lg:col-span-5 sticky top-6 space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-linear-to-b from-slate-50 to-white p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <QrCode className="h-4 w-4 text-brand-primary" />
                Etiqueta QR identificatoria
              </span>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 bg-slate-200/60 px-2 py-0.5 rounded">
                Para imprimir
              </span>
            </div>

            {/* Simulación física de la etiqueta lista para pegar en la máquina */}
            <div className="flex justify-center">
              <EquipoQrCard
                nombre={data.nombre}
                tipoEquipo={data.tipo_equipo}
                codigoInterno={data.codigo_interno}
                ubicacion={data.ubicacion}
                qrUrl={data.qr_url}
              />
            </div>

            {/* Acciones del QR */}
            <div className="space-y-2 pt-1">
              <button
                type="button"
                onClick={handlePrintLabel}
                className="w-full inline-flex items-center justify-center gap-2 py-3 rounded-xl bg-brand-primary hover:bg-brand-primary/95 text-white text-xs font-bold shadow-xs cursor-pointer transition-colors"
              >
                <Printer className="h-4 w-4" />
                Imprimir etiqueta industrial
              </button>

              {qrUrl && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(qrUrl);
                      showAlert("success", "Copiado", "Enlace de inspección copiado al portapapeles.");
                    }}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 text-xs font-semibold cursor-pointer"
                  >
                    <Copy className="h-3.5 w-3.5" />
                    Copiar link móvil
                  </button>
                  <a
                    href={qrUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 text-xs font-semibold"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    Probar QR
                  </a>
                </div>
              )}
            </div>

            <div className="p-3 bg-blue-50/60 rounded-xl border border-blue-100 text-xs text-blue-900 flex items-start gap-2">
              <Info className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
              <p className="text-[11px] leading-relaxed">
                Pegá esta etiqueta en un sector visible y accesible del equipo. Cualquier persona autorizada puede escanearla sin requerir contraseña.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Modal de Edición Completa */}
      {isEditing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-slate-900">Editar equipo</h2>
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleUpdate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Nombre descriptivo <span className="text-rose-500">*</span>
                </label>
                <input
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  required
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Tipo de equipo <span className="text-rose-500">*</span>
                </label>
                <input
                  value={tipoEquipo}
                  onChange={(e) => setTipoEquipo(e.target.value)}
                  required
                  placeholder="Ej. PUENTE DE 4 TN"
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Código interno / Tag
                  </label>
                  <input
                    value={codigoInterno}
                    onChange={(e) => setCodigoInterno(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Ubicación en planta
                  </label>
                  <input
                    value={ubicacion}
                    onChange={(e) => setUbicacion(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Notas u Observaciones
                </label>
                <textarea
                  value={notas}
                  onChange={(e) => setNotas(e.target.value)}
                  rows={2}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="activo-check-edit-page"
                  checked={activo}
                  onChange={(e) => setActivo(e.target.checked)}
                />
                <label htmlFor="activo-check-edit-page" className="text-sm text-slate-700 font-medium">
                  Equipo operativo y activo
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 text-sm font-semibold hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingEdit}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-brand-primary hover:bg-brand-primary/95 text-white text-sm font-bold disabled:opacity-60"
                >
                  {savingEdit && <Loader className="h-4 w-4 animate-spin" />}
                  Guardar cambios
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Confirmación para Eliminar */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 rounded-xl bg-rose-50 border border-rose-100 flex items-center justify-center shrink-0 text-rose-600">
                <AlertCircle className="h-5 w-5" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-slate-900">
                  ¿Dar de baja o eliminar equipo?
                </h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Estás a punto de dar de baja a <strong>&quot;{data.nombre}&quot;</strong>. Si tiene inspecciones registradas, se archivará como inactivo para resguardar la validez de los reportes históricos.
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowDeleteModal(false)}
                disabled={deleting}
                className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 text-xs font-semibold hover:bg-slate-50 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold disabled:opacity-60 cursor-pointer shadow-xs"
              >
                {deleting && <Loader className="h-3.5 w-3.5 animate-spin" />}
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
