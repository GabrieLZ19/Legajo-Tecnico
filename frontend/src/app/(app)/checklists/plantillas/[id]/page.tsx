"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  BookOpen,
  Building2,
  Calendar,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  Copy,
  Eye,
  FileStack,
  FileText,
  Info,
  Loader,
  Pencil,
  Plus,
  QrCode,
  ShieldAlert,
  Trash2,
  User,
  Wrench,
} from "lucide-react";
import { checklistsService } from "@/utils/services/checklists.service";
import { useAuth } from "@/hooks/useAuth";
import { useAlert } from "@/context/AlertContext";
import { canWriteAppModule } from "@/lib/moduleAccess";
import type { ChecklistPlantilla, Equipo } from "@/types";

export default function PlantillaDetallePage() {
  const params = useParams();
  const id = params.id as string;
  const router = useRouter();
  const { user, empresa } = useAuth();
  const { showAlert } = useAlert();
  const queryClient = useQueryClient();
  const canWrite = canWriteAppModule(user, "checklists");

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [duplicating, setDuplicating] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["checklist-plantilla", id],
    queryFn: () => checklistsService.obtenerPlantilla(id),
    enabled: !!id,
  });

  // Equipos de la empresa para ver cuáles corresponden a esta plantilla
  const { data: equipos = [] } = useQuery({
    queryKey: ["checklists-equipos", empresa?.id],
    queryFn: () => checklistsService.listarEquipos(empresa!.id),
    enabled: !!empresa?.id,
  });

  // Equipos que coinciden con el tipo_equipo de esta plantilla
  const equiposCompatibles = useMemo(() => {
    if (!data?.tipo_equipo) return [];
    const tipoNorm = data.tipo_equipo.toLowerCase().trim();
    return equipos.filter((eq: Equipo) => {
      const eqNorm = (eq.tipo_equipo || "").toLowerCase().trim();
      return (
        eqNorm === tipoNorm ||
        (tipoNorm.length > 2 && eqNorm.includes(tipoNorm)) ||
        (eqNorm.length > 2 && tipoNorm.includes(eqNorm))
      );
    });
  }, [equipos, data?.tipo_equipo]);

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
        <FileStack className="h-10 w-10 text-slate-300 mx-auto" />
        <h2 className="text-lg font-bold text-slate-900">Plantilla no encontrada</h2>
        <Link
          href="/checklists/plantillas"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-primary"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver a plantillas
        </Link>
      </div>
    );
  }

  const items = data.items || data.checklist_plantilla_items || [];
  const esEmpresa = data.ambito === "empresa";

  // Desglose de criticidades
  const conteo = {
    alta: items.filter((i) => i.criticidad === "alta").length,
    media: items.filter((i) => i.criticidad === "media").length,
    baja: items.filter((i) => i.criticidad === "baja").length,
    total: items.length,
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await checklistsService.eliminarPlantilla(id);
      await queryClient.invalidateQueries({
        queryKey: ["checklist-plantillas-empresa"],
      });
      await queryClient.invalidateQueries({
        queryKey: ["checklist-plantillas-lt"],
      });
      showAlert("success", "Plantilla eliminada", "Se eliminó correctamente.");
      router.push("/checklists/plantillas");
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

  const handleDuplicar = async () => {
    if (!empresa?.id) return;
    setDuplicating(true);
    try {
      const copia = await checklistsService.crearPlantilla({
        titulo: `${data.titulo} (Copia)`,
        tipo_equipo: data.tipo_equipo,
        ambito: "empresa",
        empresa_id: empresa.id,
        items: items.map((i, idx) => ({
          texto: i.texto,
          criticidad: i.criticidad,
          orden: idx + 1,
        })),
      });
      await queryClient.invalidateQueries({
        queryKey: ["checklist-plantillas-empresa"],
      });
      showAlert(
        "success",
        "Plantilla duplicada",
        "Se creó una copia en la biblioteca de la empresa.",
      );
      router.push(`/checklists/plantillas/${copia.id}/editar`);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: string } } };
      showAlert(
        "error",
        "Error al duplicar",
        axiosErr.response?.data?.error ||
          (err instanceof Error ? err.message : "No se pudo duplicar"),
      );
    } finally {
      setDuplicating(false);
    }
  };

  return (
    <div className="w-full space-y-6">
      {/* Navegación y Botonera Superior */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <Link
          href="/checklists/plantillas"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-brand-primary transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Plantillas de checklist
        </Link>

        {canWrite && (
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={`/checklists/inspecciones/nueva?plantillaId=${data.id}`}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-brand-primary text-white text-sm font-bold hover:bg-brand-primary/95 shadow-xs transition-all cursor-pointer"
            >
              <ClipboardCheck className="h-4 w-4" />
              Iniciar inspección
            </Link>

            {esEmpresa && (
              <Link
                href={`/checklists/plantillas/${data.id}/editar`}
                className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 text-sm font-semibold shadow-2xs transition-all cursor-pointer"
              >
                <Pencil className="h-4 w-4" />
                Editar
              </Link>
            )}

            <button
              type="button"
              onClick={handleDuplicar}
              disabled={duplicating}
              className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 text-sm font-semibold shadow-2xs transition-all cursor-pointer disabled:opacity-60"
              title="Crear una copia para personalizarla"
            >
              {duplicating ? (
                <Loader className="h-4 w-4 animate-spin text-slate-500" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
              Duplicar
            </button>

            {esEmpresa && (
              <button
                type="button"
                onClick={() => setShowDeleteModal(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-rose-200 bg-white text-rose-600 hover:bg-rose-50 text-sm font-semibold shadow-2xs transition-all cursor-pointer"
              >
                <Trash2 className="h-4 w-4" />
                Eliminar
              </button>
            )}
          </div>
        )}
      </div>

      {/* Hero Card de la Plantilla */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-2xs space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-full border ${
              esEmpresa
                ? "bg-blue-50 text-blue-700 border-blue-200"
                : "bg-emerald-50 text-emerald-700 border-emerald-200"
            }`}
          >
            {esEmpresa ? (
              <>
                <Building2 className="h-3.5 w-3.5" />
                Biblioteca de la empresa
              </>
            ) : (
              <>
                <BookOpen className="h-3.5 w-3.5" />
                Biblioteca Legajo Técnico
              </>
            )}
          </span>

          <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full bg-slate-100 text-slate-700">
            <Wrench className="h-3.5 w-3.5 text-slate-500" />
            Equipo: <strong>{data.tipo_equipo}</strong>
          </span>

          {data.estado_publicacion && !esEmpresa && (
            <span className="text-xs font-bold uppercase px-2.5 py-0.5 rounded-full border border-slate-200 text-slate-600">
              {data.estado_publicacion}
            </span>
          )}
        </div>

        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
            {data.titulo}
          </h1>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-brand-text-muted mt-2">
            {data.created_at && (
              <span className="flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5 text-slate-400" />
                Creado: {new Date(data.created_at).toLocaleDateString("es-AR")}
              </span>
            )}
            {data.autor_nombre && (
              <span className="flex items-center gap-1">
                <User className="h-3.5 w-3.5 text-slate-400" />
                Por: {data.autor_nombre}
              </span>
            )}
            <span className="flex items-center gap-1">
              <ClipboardCheck className="h-3.5 w-3.5 text-slate-400" />
              {items.length} {items.length === 1 ? "ítem a calificar" : "ítems a calificar"}
            </span>
          </div>
        </div>
      </div>

      {/* Grid de 2 Columnas: Lista de Ítems + Equipos y Reglas */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Columna Izquierda: Ítems (7 de 12) */}
        <div className="lg:col-span-7 space-y-5">
          {/* Tarjeta de Resumen de Criticidad */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs space-y-3">
            <h2 className="text-sm font-bold text-slate-900">
              Distribución de criticidad
            </h2>
            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 rounded-xl bg-rose-50/70 border border-rose-100 space-y-0.5">
                <span className="text-[11px] font-bold text-rose-700 flex items-center gap-1">
                  <ShieldAlert className="h-3.5 w-3.5" />
                  Alta (Crítica)
                </span>
                <div className="text-xl font-black text-rose-900">
                  {conteo.alta}
                </div>
                <p className="text-[10px] text-rose-600 leading-tight">
                  Bloquea uso si está &quot;Mal&quot;
                </p>
              </div>

              <div className="p-3 rounded-xl bg-amber-50/70 border border-amber-100 space-y-0.5">
                <span className="text-[11px] font-bold text-amber-700 flex items-center gap-1">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  Media
                </span>
                <div className="text-xl font-black text-amber-900">
                  {conteo.media}
                </div>
                <p className="text-[10px] text-amber-600 leading-tight">
                  Genera plan de acción
                </p>
              </div>

              <div className="p-3 rounded-xl bg-blue-50/70 border border-blue-100 space-y-0.5">
                <span className="text-[11px] font-bold text-blue-700 flex items-center gap-1">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Baja
                </span>
                <div className="text-xl font-black text-blue-900">
                  {conteo.baja}
                </div>
                <p className="text-[10px] text-blue-600 leading-tight">
                  Falla menor / rutina
                </p>
              </div>
            </div>
          </div>

          {/* Tarjeta de Lista de Ítems */}
          <section className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-2xs">
            <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/60 flex items-center justify-between">
              <h2 className="font-bold text-slate-900 flex items-center gap-2 text-sm">
                <ClipboardCheck className="h-4 w-4 text-brand-primary" />
                Puntos de control estructurados ({items.length})
              </h2>
              {esEmpresa && canWrite && (
                <Link
                  href={`/checklists/plantillas/${data.id}/editar`}
                  className="text-xs font-bold text-blue-600 hover:text-blue-800"
                >
                  Modificar ítems →
                </Link>
              )}
            </div>

            {items.length === 0 ? (
              <p className="px-5 py-10 text-sm text-slate-500 text-center">
                Esta plantilla no tiene ítems cargados.
              </p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {items.map((item, idx) => {
                  const esAlta = item.criticidad === "alta";
                  const esMedia = item.criticidad === "media";
                  return (
                    <li
                      key={item.id || idx}
                      className="px-5 py-4 flex items-start justify-between gap-4 hover:bg-slate-50/60 transition-colors"
                    >
                      <div className="flex items-start gap-3">
                        <span className="flex items-center justify-center h-6 w-6 rounded-lg bg-slate-100 text-slate-700 text-xs font-bold shrink-0 mt-0.5">
                          #{idx + 1}
                        </span>
                        <p className="text-sm font-medium text-slate-800 leading-relaxed">
                          {item.texto}
                        </p>
                      </div>

                      <span
                        className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full shrink-0 border ${
                          esAlta
                            ? "bg-rose-50 text-rose-700 border-rose-200"
                            : esMedia
                              ? "bg-amber-50 text-amber-700 border-amber-200"
                              : "bg-blue-50 text-blue-700 border-blue-200"
                        }`}
                      >
                        {item.criticidad}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>

        {/* Columna Derecha: Equipos Compatibles y Consejos (5 de 12) */}
        <div className="lg:col-span-5 space-y-5">
          {/* Equipos de la empresa vinculados a este tipo */}
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <Wrench className="h-4 w-4 text-brand-primary" />
                Equipos compatibles en la empresa ({equiposCompatibles.length})
              </h2>
            </div>
            <p className="text-xs text-brand-text-muted">
              Equipos dados de alta como &quot;{data.tipo_equipo}&quot; listos para ser inspeccionados con esta plantilla.
            </p>

            {equiposCompatibles.length === 0 ? (
              <div className="p-4 rounded-xl border border-dashed border-slate-200 text-center space-y-2 bg-slate-50/50">
                <p className="text-xs text-slate-500">
                  No tenés equipos registrados con el tipo &quot;{data.tipo_equipo}&quot;.
                </p>
                {canWrite && (
                  <Link
                    href="/checklists/equipos/nuevo"
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-brand-primary hover:underline"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Dar de alta un equipo con este tipo
                  </Link>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                {equiposCompatibles.map((eq: Equipo) => (
                  <div
                    key={eq.id}
                    className="flex items-center justify-between p-3 rounded-xl border border-slate-100 bg-slate-50/50 hover:bg-slate-100/60 transition-colors"
                  >
                    <div>
                      <Link
                        href={`/checklists/equipos/${eq.id}`}
                        className="text-xs font-bold text-slate-900 hover:text-brand-primary block"
                      >
                        {eq.nombre}
                      </Link>
                      <p className="text-[11px] text-slate-500">
                        {eq.codigo_interno ? `Cód: ${eq.codigo_interno} · ` : ""}
                        {eq.ubicacion || "Sin ubicación"}
                      </p>
                    </div>

                    <Link
                      href={`/checklists/inspecciones/nueva?equipoId=${eq.id}&plantillaId=${data.id}`}
                      className="px-2.5 py-1 rounded-lg bg-brand-primary text-white text-[11px] font-bold hover:bg-brand-primary/95 transition-colors shrink-0"
                    >
                      Inspeccionar
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Guía Operativa */}
          <div className="rounded-2xl border border-blue-100 bg-linear-to-b from-blue-50/50 to-white p-5 shadow-2xs space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-blue-900 flex items-center gap-1.5">
              <Info className="h-4 w-4 text-blue-600" />
              ¿Cómo calcula el sistema el resultado?
            </h3>
            <ul className="text-xs text-slate-600 space-y-2 leading-relaxed">
              <li className="flex items-start gap-2">
                <span className="h-2 w-2 rounded-full bg-rose-500 mt-1.5 shrink-0" />
                <span>
                  <strong>Rechazada:</strong> Si al menos un ítem con criticidad <strong>Alta</strong> es calificado como <em>Mal</em>. Bloquea el equipo.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="h-2 w-2 rounded-full bg-amber-500 mt-1.5 shrink-0" />
                <span>
                  <strong>Observada:</strong> Si hay fallas en ítems de criticidad <strong>Media</strong> o calificaciones <em>Regular</em>. Requiere plan de acción.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="h-2 w-2 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
                <span>
                  <strong>Aprobada:</strong> Cuando todos los ítems de verificación son calificados como <em>Bien</em>.
                </span>
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Modal de confirmación para eliminar */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 rounded-xl bg-rose-50 border border-rose-100 flex items-center justify-center shrink-0 text-rose-600">
                <AlertCircle className="h-5 w-5" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-slate-900">
                  ¿Eliminar esta plantilla?
                </h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Estás a punto de eliminar <strong>&quot;{data.titulo}&quot;</strong> y sus {items.length} ítems. Esta acción no se puede deshacer.
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
                Confirmar eliminación
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
