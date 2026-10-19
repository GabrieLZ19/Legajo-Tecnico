"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  Copy,
  ExternalLink,
  Filter,
  Grid,
  LayoutGrid,
  List,
  Loader,
  MapPin,
  Pencil,
  Plus,
  Printer,
  QrCode,
  Search,
  Sparkles,
  Tag,
  Trash2,
  Wrench,
  X,
  XCircle,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useAlert } from "@/context/AlertContext";
import { canWriteAppModule } from "@/lib/moduleAccess";
import { checklistsService } from "@/utils/services/checklists.service";
import { EquipoQrCard } from "@/components/EquipoQrCard";
import { printEquipoQrLabel } from "@/lib/printEquipoQr";
import type { ChecklistPlantilla, Equipo } from "@/types";

export default function EquiposPage() {
  const { user, empresa } = useAuth();
  const { showAlert } = useAlert();
  const queryClient = useQueryClient();
  const canWrite = canWriteAppModule(user, "checklists");

  const [q, setQ] = useState("");
  const [estadoFiltro, setEstadoFiltro] = useState<"todos" | "activos" | "inactivos">("activos");
  const [tipoFiltro, setTipoFiltro] = useState<string>("todos");
  const [ubicacionFiltro, setUbicacionFiltro] = useState<string>("todos");
  const [vista, setVista] = useState<"grid" | "tabla">("grid");

  // Modales
  const [qrModalEquipo, setQrModalEquipo] = useState<Equipo | null>(null);
  const [equipoToEdit, setEquipoToEdit] = useState<Equipo | null>(null);
  const [equipoToDelete, setEquipoToDelete] = useState<Equipo | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Formulario de edición rápida
  const [editNombre, setEditNombre] = useState("");
  const [editTipo, setEditTipo] = useState("");
  const [editCodigo, setEditCodigo] = useState("");
  const [editUbicacion, setEditUbicacion] = useState("");
  const [editNotas, setEditNotas] = useState("");
  const [editActivo, setEditActivo] = useState(true);

  // Consultar equipos
  const { data: equipos = [], isLoading } = useQuery({
    queryKey: ["checklists-equipos", empresa?.id, "todos"],
    queryFn: () => checklistsService.listarEquipos(empresa!.id, true),
    enabled: !!empresa?.id,
  });

  // Consultar plantillas para ver correspondencia
  const { data: plantillas = [] } = useQuery({
    queryKey: ["checklist-plantillas-empresa", empresa?.id],
    queryFn: () =>
      checklistsService.listarPlantillas({
        ambito: "empresa",
        empresaId: empresa!.id,
      }),
    enabled: !!empresa?.id,
  });

  // Mapa de plantillas por tipo_equipo
  const plantillasPorTipo = useMemo(() => {
    const map = new Map<string, number>();
    plantillas.forEach((p) => {
      const t = (p.tipo_equipo || "").trim().toLowerCase();
      if (t) {
        map.set(t, (map.get(t) || 0) + 1);
      }
    });
    return map;
  }, [plantillas]);

  // Tipos únicos
  const tiposDisponibles = useMemo(() => {
    const set = new Set<string>();
    equipos.forEach((e) => {
      if (e.tipo_equipo?.trim()) set.add(e.tipo_equipo.trim());
    });
    return Array.from(set).sort();
  }, [equipos]);

  // Ubicaciones únicas
  const ubicacionesDisponibles = useMemo(() => {
    const set = new Set<string>();
    equipos.forEach((e) => {
      if (e.ubicacion?.trim()) set.add(e.ubicacion.trim());
    });
    return Array.from(set).sort();
  }, [equipos]);

  // Métricas
  const totalEquipos = equipos.length;
  const totalActivos = equipos.filter((e) => e.activo).length;
  const totalInactivos = totalEquipos - totalActivos;
  const totalTipos = tiposDisponibles.length;

  // Filtrado reactivo
  const filtrados = useMemo(() => {
    return equipos.filter((eq) => {
      // Estado
      if (estadoFiltro === "activos" && !eq.activo) return false;
      if (estadoFiltro === "inactivos" && eq.activo) return false;

      // Tipo de equipo
      if (
        tipoFiltro !== "todos" &&
        (eq.tipo_equipo || "").trim().toLowerCase() !== tipoFiltro.toLowerCase()
      ) {
        return false;
      }

      // Ubicación
      if (
        ubicacionFiltro !== "todos" &&
        (eq.ubicacion || "").trim().toLowerCase() !==
          ubicacionFiltro.toLowerCase()
      ) {
        return false;
      }

      // Búsqueda
      if (!q.trim()) return true;
      const needle = q.trim().toLowerCase();
      return (
        eq.nombre.toLowerCase().includes(needle) ||
        eq.tipo_equipo.toLowerCase().includes(needle) ||
        (eq.codigo_interno || "").toLowerCase().includes(needle) ||
        (eq.ubicacion || "").toLowerCase().includes(needle)
      );
    });
  }, [equipos, estadoFiltro, tipoFiltro, ubicacionFiltro, q]);

  const handleOpenEdit = (eq: Equipo) => {
    setEquipoToEdit(eq);
    setEditNombre(eq.nombre || "");
    setEditTipo(eq.tipo_equipo || "");
    setEditCodigo(eq.codigo_interno || "");
    setEditUbicacion(eq.ubicacion || "");
    setEditNotas(eq.notas || "");
    setEditActivo(eq.activo ?? true);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!equipoToEdit) return;
    setSavingEdit(true);
    try {
      await checklistsService.actualizarEquipo(equipoToEdit.id, {
        nombre: editNombre.trim(),
        tipo_equipo: editTipo.trim(),
        codigo_interno: editCodigo.trim() || null,
        ubicacion: editUbicacion.trim() || null,
        notas: editNotas.trim() || null,
        activo: editActivo,
      });
      await queryClient.invalidateQueries({
        queryKey: ["checklists-equipos"],
      });
      showAlert("success", "Equipo actualizado", "Los datos se guardaron correctamente.");
      setEquipoToEdit(null);
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
    if (!equipoToDelete) return;
    setDeleting(true);
    try {
      const res = await checklistsService.eliminarEquipo(equipoToDelete.id);
      await queryClient.invalidateQueries({
        queryKey: ["checklists-equipos"],
      });
      if (res?.softDeleted) {
        showAlert(
          "info",
          "Equipo archivado",
          "Como tenía inspecciones registradas, fue desactivado para preservar su histórico.",
        );
      } else {
        showAlert("success", "Equipo eliminado", "Se eliminó permanentemente.");
      }
      setEquipoToDelete(null);
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
    }
  };

  const handlePrintQr = (eq: Equipo) => {
    const ok = printEquipoQrLabel({
      nombre: eq.nombre,
      tipo_equipo: eq.tipo_equipo,
      codigo_interno: eq.codigo_interno,
      ubicacion: eq.ubicacion,
      qr_url: eq.qr_url,
    });
    if (!ok) {
      showAlert("warning", "Pop-up bloqueado", "Permití pop-ups para imprimir la etiqueta.");
    }
  };

  return (
    <div className="w-full space-y-6">
      {/* Encabezado */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <Link
            href="/checklists"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-brand-primary mb-2 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Módulo Checklists
          </Link>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-black text-slate-900 tracking-tight">
              Equipos y maquinarias
            </h1>
            <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-brand-primary/10 text-brand-primary">
              {totalEquipos} {totalEquipos === 1 ? "equipo" : "equipos"}
            </span>
          </div>
          <p className="text-sm text-brand-text-muted mt-1 max-w-2xl">
            Inventario operativo con código QR identificatorio para auditorías e inspecciones en tiempo real.
          </p>
        </div>
        {canWrite && (
          <Link
            href="/checklists/equipos/nuevo"
            className="inline-flex items-center justify-center gap-2 bg-brand-primary hover:bg-brand-primary/95 text-white font-bold px-5 py-3 rounded-xl shadow-sm text-sm cursor-pointer transition-all hover:shadow-md"
          >
            <Plus className="h-4 w-4" />
            Nuevo equipo
          </Link>
        )}
      </div>

      {/* KPI Cards / Estadísticas */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4.5 shadow-2xs">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-semibold text-slate-500">Total equipos</span>
            <Wrench className="h-4 w-4 text-brand-primary" />
          </div>
          <div className="text-2xl font-black text-slate-900">{totalEquipos}</div>
          <p className="text-[11px] text-slate-400 mt-0.5">Parque registrado en planta</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4.5 shadow-2xs">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-semibold text-slate-500">Equipos activos</span>
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-black text-emerald-700">{totalActivos}</div>
          <p className="text-[11px] text-emerald-600 font-medium mt-0.5">Disponibles para inspección</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4.5 shadow-2xs">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-semibold text-slate-500">Tipos de maquinaria</span>
            <Tag className="h-4 w-4 text-blue-600" />
          </div>
          <div className="text-2xl font-black text-slate-900">{totalTipos}</div>
          <p className="text-[11px] text-slate-400 mt-0.5">Categorías de equipos</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4.5 shadow-2xs">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-semibold text-slate-500">Con código QR</span>
            <QrCode className="h-4 w-4 text-amber-600" />
          </div>
          <div className="text-2xl font-black text-slate-900">{totalEquipos}</div>
          <p className="text-[11px] text-amber-600 font-medium mt-0.5">Listos para imprimir o escanear</p>
        </div>
      </div>

      {/* Barra de Filtros, Búsqueda y Selector de Vista */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs space-y-3">
        <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
          {/* Tabs de Estado */}
          <div className="inline-flex p-1 bg-slate-100 rounded-xl text-xs font-semibold">
            <button
              type="button"
              onClick={() => setEstadoFiltro("activos")}
              className={`px-3.5 py-1.5 rounded-lg transition-all ${
                estadoFiltro === "activos"
                  ? "bg-white text-slate-900 shadow-2xs font-bold"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Solo activos ({totalActivos})
            </button>
            <button
              type="button"
              onClick={() => setEstadoFiltro("todos")}
              className={`px-3.5 py-1.5 rounded-lg transition-all ${
                estadoFiltro === "todos"
                  ? "bg-white text-slate-900 shadow-2xs font-bold"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Todos ({totalEquipos})
            </button>
            {totalInactivos > 0 && (
              <button
                type="button"
                onClick={() => setEstadoFiltro("inactivos")}
                className={`px-3.5 py-1.5 rounded-lg transition-all ${
                  estadoFiltro === "inactivos"
                    ? "bg-white text-slate-900 shadow-2xs font-bold"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Inactivos ({totalInactivos})
              </button>
            )}
          </div>

          {/* Filtros secundarios y Búsqueda */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Filtro por tipo de equipo */}
            {tiposDisponibles.length > 0 && (
              <select
                value={tipoFiltro}
                onChange={(e) => setTipoFiltro(e.target.value)}
                className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold bg-white text-slate-700"
              >
                <option value="todos">Todos los tipos ({tiposDisponibles.length})</option>
                {tiposDisponibles.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            )}

            {/* Filtro por ubicación */}
            {ubicacionesDisponibles.length > 0 && (
              <select
                value={ubicacionFiltro}
                onChange={(e) => setUbicacionFiltro(e.target.value)}
                className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold bg-white text-slate-700"
              >
                <option value="todos">Todas las ubicaciones</option>
                {ubicacionesDisponibles.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>
            )}

            {/* Input de Búsqueda */}
            <div className="relative flex-1 sm:w-60">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Buscar por nombre, código…"
                className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 text-xs bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
              />
            </div>

            {/* Selector de Vista Grid / Tabla */}
            <div className="inline-flex p-1 bg-slate-100 rounded-xl">
              <button
                type="button"
                onClick={() => setVista("grid")}
                className={`p-1.5 rounded-lg transition-all ${
                  vista === "grid"
                    ? "bg-white text-brand-primary shadow-2xs"
                    : "text-slate-400 hover:text-slate-700"
                }`}
                title="Vista en tarjetas"
              >
                <LayoutGrid className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setVista("tabla")}
                className={`p-1.5 rounded-lg transition-all ${
                  vista === "tabla"
                    ? "bg-white text-brand-primary shadow-2xs"
                    : "text-slate-400 hover:text-slate-700"
                }`}
                title="Vista en tabla"
              >
                <List className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Grid o Tabla de Equipos */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div
              key={i}
              className="h-48 bg-white border border-slate-200 rounded-2xl animate-pulse p-5 space-y-3"
            >
              <div className="h-4 bg-slate-100 rounded w-1/3" />
              <div className="h-6 bg-slate-100 rounded w-3/4" />
              <div className="h-4 bg-slate-100 rounded w-1/2" />
            </div>
          ))}
        </div>
      ) : filtrados.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center space-y-4 shadow-2xs">
          <div className="h-16 w-16 mx-auto rounded-2xl bg-slate-50 flex items-center justify-center border border-slate-100">
            <Wrench className="h-8 w-8 text-slate-400" />
          </div>
          <div className="max-w-md mx-auto space-y-1">
            <h3 className="text-lg font-bold text-slate-900">
              {q || tipoFiltro !== "todos" || ubicacionFiltro !== "todos"
                ? "No se encontraron equipos con los filtros seleccionados"
                : "No hay equipos dados de alta aún"}
            </h3>
            <p className="text-sm text-slate-500">
              {q || tipoFiltro !== "todos" || ubicacionFiltro !== "todos"
                ? "Probá restableciendo los filtros o ampliando la búsqueda."
                : "Registrá tu maquinaria o equipos para generar sus etiquetas QR y empezar a inspeccionar en campo."}
            </p>
          </div>
          {q || tipoFiltro !== "todos" || ubicacionFiltro !== "todos" ? (
            <button
              type="button"
              onClick={() => {
                setQ("");
                setTipoFiltro("todos");
                setUbicacionFiltro("todos");
                setEstadoFiltro("activos");
              }}
              className="px-4 py-2 text-xs font-bold text-brand-primary bg-slate-50 rounded-xl hover:bg-slate-100 border border-slate-200 cursor-pointer"
            >
              Limpiar filtros
            </button>
          ) : (
            canWrite && (
              <Link
                href="/checklists/equipos/nuevo"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-brand-primary text-white text-sm font-bold hover:bg-brand-primary/95 shadow-xs cursor-pointer"
              >
                <Plus className="h-4 w-4" />
                Registrar primer equipo
              </Link>
            )
          )}
        </div>
      ) : vista === "grid" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {filtrados.map((eq) => {
            const tipoKey = (eq.tipo_equipo || "").trim().toLowerCase();
            const plantillasCompatibles = plantillasPorTipo.get(tipoKey) || 0;
            const qrUrl = eq.qr_url || "";
            const qrImg = qrUrl
              ? `https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(qrUrl)}`
              : null;

            return (
              <div
                key={eq.id}
                className="group relative rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs hover:shadow-md hover:border-slate-300 transition-all flex flex-col justify-between"
              >
                <div>
                  {/* Fila Superior: Estado + Código Interno */}
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <span
                      className={`inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${
                        eq.activo
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                          : "bg-slate-100 text-slate-500 border-slate-200"
                      }`}
                    >
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${
                          eq.activo ? "bg-emerald-500" : "bg-slate-400"
                        }`}
                      />
                      {eq.activo ? "Activo" : "Inactivo"}
                    </span>

                    {eq.codigo_interno && (
                      <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700">
                        {eq.codigo_interno}
                      </span>
                    )}
                  </div>

                  {/* Nombre y Tipo */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <Link
                        href={`/checklists/equipos/${eq.id}`}
                        className="block group-hover:text-brand-secondary transition-colors"
                      >
                        <h2 className="text-base font-bold text-slate-900 leading-snug line-clamp-1">
                          {eq.nombre}
                        </h2>
                      </Link>

                      <div className="mt-1.5 flex items-center gap-1.5 text-xs text-slate-600 font-semibold">
                        <Wrench className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                        <span className="truncate">{eq.tipo_equipo}</span>
                      </div>

                      {eq.ubicacion && (
                        <div className="mt-1 flex items-center gap-1.5 text-xs text-slate-500">
                          <MapPin className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                          <span className="truncate">{eq.ubicacion}</span>
                        </div>
                      )}
                    </div>

                    {/* QR Thumbnail clickeable */}
                    <button
                      type="button"
                      onClick={() => setQrModalEquipo(eq)}
                      className="shrink-0 p-1.5 rounded-xl border border-slate-200 bg-slate-50/70 hover:bg-slate-100 transition-colors cursor-pointer group/qr"
                      title="Ampliar e imprimir QR"
                    >
                      {qrImg ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={qrImg}
                          alt="QR"
                          width={48}
                          height={48}
                          className="rounded-lg"
                        />
                      ) : (
                        <QrCode className="h-8 w-8 text-slate-400" />
                      )}
                    </button>
                  </div>

                  {/* Indicador de checklists compatibles */}
                  <div className="mt-3.5 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px]">
                    <span className="text-slate-500">
                      {plantillasCompatibles > 0 ? (
                        <span className="text-emerald-700 font-medium">
                          ✓ {plantillasCompatibles} {plantillasCompatibles === 1 ? "checklist compatible" : "checklists compatibles"}
                        </span>
                      ) : (
                        <span className="text-amber-700 font-medium">
                          Sin checklist específico asignado
                        </span>
                      )}
                    </span>
                  </div>
                </div>

                {/* Acciones del Card */}
                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    {canWrite && eq.activo && (
                      <Link
                        href={`/checklists/inspecciones/nueva?equipoId=${eq.id}`}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-brand-primary text-white text-xs font-bold hover:bg-brand-primary/95 transition-colors shadow-2xs"
                        title="Nueva inspección"
                      >
                        <ClipboardCheck className="h-3.5 w-3.5" />
                        Inspeccionar
                      </Link>
                    )}

                    <button
                      type="button"
                      onClick={() => handlePrintQr(eq)}
                      className="p-1.5 rounded-xl border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-colors"
                      title="Imprimir etiqueta QR"
                    >
                      <Printer className="h-4 w-4" />
                    </button>

                    {canWrite && (
                      <button
                        type="button"
                        onClick={() => handleOpenEdit(eq)}
                        className="p-1.5 rounded-xl border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-colors"
                        title="Editar equipo"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                    )}

                    {canWrite && (
                      <button
                        type="button"
                        onClick={() => setEquipoToDelete(eq)}
                        className="p-1.5 rounded-xl border border-slate-200 text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                        title="Eliminar equipo"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>

                  <Link
                    href={`/checklists/equipos/${eq.id}`}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600 hover:text-brand-primary"
                  >
                    Detalles
                    <ChevronRight className="h-4 w-4 text-slate-400" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Vista de Tabla Compacta */
        <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-2xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200 uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="px-5 py-3.5">Equipo</th>
                  <th className="px-4 py-3.5">Tipo</th>
                  <th className="px-4 py-3.5">Código</th>
                  <th className="px-4 py-3.5">Ubicación</th>
                  <th className="px-4 py-3.5">Estado</th>
                  <th className="px-4 py-3.5 text-center">QR</th>
                  <th className="px-5 py-3.5 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtrados.map((eq) => (
                  <tr key={eq.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="px-5 py-3.5 font-bold text-slate-900">
                      <Link
                        href={`/checklists/equipos/${eq.id}`}
                        className="hover:text-brand-secondary"
                      >
                        {eq.nombre}
                      </Link>
                    </td>
                    <td className="px-4 py-3.5 text-slate-700 font-medium">
                      {eq.tipo_equipo}
                    </td>
                    <td className="px-4 py-3.5 font-mono text-slate-500">
                      {eq.codigo_interno || "—"}
                    </td>
                    <td className="px-4 py-3.5 text-slate-600">
                      {eq.ubicacion || "—"}
                    </td>
                    <td className="px-4 py-3.5">
                      <span
                        className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          eq.activo
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-slate-100 text-slate-500"
                        }`}
                      >
                        {eq.activo ? "Activo" : "Inactivo"}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      <button
                        type="button"
                        onClick={() => setQrModalEquipo(eq)}
                        className="p-1 rounded text-slate-500 hover:text-brand-primary"
                        title="Ver QR"
                      >
                        <QrCode className="h-4 w-4 mx-auto" />
                      </button>
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <div className="inline-flex items-center gap-1.5 justify-end">
                        {canWrite && eq.activo && (
                          <Link
                            href={`/checklists/inspecciones/nueva?equipoId=${eq.id}`}
                            className="px-2.5 py-1 rounded-lg bg-brand-primary text-white text-[11px] font-bold hover:bg-brand-primary/95"
                          >
                            Inspeccionar
                          </Link>
                        )}
                        {canWrite && (
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(eq)}
                            className="p-1 rounded text-slate-400 hover:text-slate-700"
                            title="Editar"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal QR Detallado con Opción de Imprimir */}
      {qrModalEquipo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <QrCode className="h-4 w-4 text-brand-primary" />
                Etiqueta QR identificatoria
              </span>
              <button
                type="button"
                onClick={() => setQrModalEquipo(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex justify-center">
              <EquipoQrCard
                nombre={qrModalEquipo.nombre}
                tipoEquipo={qrModalEquipo.tipo_equipo}
                codigoInterno={qrModalEquipo.codigo_interno}
                ubicacion={qrModalEquipo.ubicacion}
                qrUrl={qrModalEquipo.qr_url}
              />
            </div>

            <p className="text-[11px] text-slate-500 text-center px-2">
              Escaneá con la cámara de cualquier teléfono móvil para completar la inspección en campo sin requerir contraseña.
            </p>

            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => handlePrintQr(qrModalEquipo)}
                className="flex-1 inline-flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-brand-primary text-white text-xs font-bold hover:bg-brand-primary/95 cursor-pointer shadow-xs transition-colors"
              >
                <Printer className="h-4 w-4" />
                Imprimir etiqueta industrial
              </button>
              {qrModalEquipo.qr_url && (
                <a
                  href={qrModalEquipo.qr_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2.5 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors"
                  title="Abrir formulario QR en pestaña nueva"
                >
                  <ExternalLink className="h-4 w-4" />
                </a>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal de Edición Rápida */}
      {equipoToEdit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-slate-900">Editar equipo</h2>
              <button
                type="button"
                onClick={() => setEquipoToEdit(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Nombre
                </label>
                <input
                  value={editNombre}
                  onChange={(e) => setEditNombre(e.target.value)}
                  required
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Tipo de equipo
                </label>
                <input
                  list="edit-tipos-list-modal"
                  value={editTipo}
                  onChange={(e) => setEditTipo(e.target.value)}
                  required
                  placeholder="Ej. PUENTE DE 4 TN"
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                />
                <datalist id="edit-tipos-list-modal">
                  {tiposDisponibles.map((t) => (
                    <option key={t} value={t} />
                  ))}
                </datalist>
                {tiposDisponibles.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    <span className="text-[11px] text-slate-400">Sugerencias:</span>
                    {tiposDisponibles.slice(0, 5).map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setEditTipo(t)}
                        className={`text-[11px] px-2 py-0.5 rounded border ${
                          editTipo === t
                            ? "bg-brand-primary text-white border-brand-primary font-bold"
                            : "bg-slate-50 text-slate-600 border-slate-200"
                        }`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Código interno
                  </label>
                  <input
                    value={editCodigo}
                    onChange={(e) => setEditCodigo(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Ubicación
                  </label>
                  <input
                    value={editUbicacion}
                    onChange={(e) => setEditUbicacion(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Notas
                </label>
                <textarea
                  value={editNotas}
                  onChange={(e) => setEditNotas(e.target.value)}
                  rows={2}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="activo-check-modal"
                  checked={editActivo}
                  onChange={(e) => setEditActivo(e.target.checked)}
                />
                <label htmlFor="activo-check-modal" className="text-sm text-slate-700">
                  Equipo operativo y activo
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEquipoToEdit(null)}
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
      {equipoToDelete && (
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
                  Estás a punto de dar de baja a <strong>&quot;{equipoToDelete.nombre}&quot;</strong>. Si tiene inspecciones registradas, se archivará como inactivo para resguardar el historial legal.
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setEquipoToDelete(null)}
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
