"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  ArrowLeft,
  BookOpen,
  Building2,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  FileStack,
  FileText,
  Filter,
  Layers,
  Loader,
  Pencil,
  Plus,
  Search,
  Sparkles,
  Trash2,
  Wrench,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useAlert } from "@/context/AlertContext";
import {
  canPublishToBibliotecaLt,
  canWriteAppModule,
} from "@/lib/moduleAccess";
import { checklistsService } from "@/utils/services/checklists.service";
import type { ChecklistPlantilla } from "@/types";

export default function PlantillasChecklistPage() {
  const { user, empresa } = useAuth();
  const { showAlert } = useAlert();
  const queryClient = useQueryClient();
  const canWrite = canWriteAppModule(user, "checklists");
  const canLt = canPublishToBibliotecaLt(user);

  const [q, setQ] = useState("");
  const [tab, setTab] = useState<"todas" | "empresa" | "global">("todas");
  const [tipoFiltro, setTipoFiltro] = useState<string>("todos");
  const [plantillaToDelete, setPlantillaToDelete] = useState<ChecklistPlantilla | null>(null);
  const [deleting, setDeleting] = useState(false);

  const { data: empresaPlantillas = [], isLoading: loadingEmpresa } = useQuery({
    queryKey: ["checklist-plantillas-empresa", empresa?.id],
    queryFn: () =>
      checklistsService.listarPlantillas({
        ambito: "empresa",
        empresaId: empresa!.id,
      }),
    enabled: !!empresa?.id,
  });

  const { data: ltPlantillas = [], isLoading: loadingLt } = useQuery({
    queryKey: ["checklist-plantillas-lt"],
    queryFn: () => checklistsService.listarPlantillas({ ambito: "global" }),
  });

  const { data: equipos = [] } = useQuery({
    queryKey: ["checklists-equipos", empresa?.id],
    queryFn: () => checklistsService.listarEquipos(empresa!.id),
    enabled: !!empresa?.id,
  });

  const loading = loadingEmpresa || loadingLt;

  // Mapa de cantidad de equipos por tipo_equipo
  const equiposPorTipo = useMemo(() => {
    const map = new Map<string, number>();
    equipos.forEach((eq) => {
      const t = (eq.tipo_equipo || "").trim().toLowerCase();
      if (t) {
        map.set(t, (map.get(t) || 0) + 1);
      }
    });
    return map;
  }, [equipos]);

  // Lista combinada de todas las plantillas
  const todas = useMemo(() => {
    return [...empresaPlantillas, ...ltPlantillas];
  }, [empresaPlantillas, ltPlantillas]);

  // Tipos de equipos únicos disponibles para filtrar
  const tiposDisponibles = useMemo(() => {
    const set = new Set<string>();
    todas.forEach((p) => {
      if (p.tipo_equipo?.trim()) set.add(p.tipo_equipo.trim());
    });
    return Array.from(set).sort();
  }, [todas]);

  // Plantillas filtradas por búsqueda, tab y tipo
  const filtradas = useMemo(() => {
    return todas.filter((p) => {
      // Filtro por tab
      if (tab === "empresa" && p.ambito !== "empresa") return false;
      if (tab === "global" && p.ambito !== "global") return false;

      // Filtro por tipo de equipo
      if (
        tipoFiltro !== "todos" &&
        p.tipo_equipo?.trim().toLowerCase() !== tipoFiltro.toLowerCase()
      ) {
        return false;
      }

      // Filtro por texto de búsqueda
      if (!q.trim()) return true;
      const needle = q.trim().toLowerCase();
      return (
        p.titulo.toLowerCase().includes(needle) ||
        (p.tipo_equipo || "").toLowerCase().includes(needle)
      );
    });
  }, [todas, tab, tipoFiltro, q]);

  // Métricas
  const totalEmpresa = empresaPlantillas.length;
  const totalLt = ltPlantillas.length;
  const totalTipos = tiposDisponibles.length;

  const handleDelete = async () => {
    if (!plantillaToDelete) return;
    setDeleting(true);
    try {
      await checklistsService.eliminarPlantilla(plantillaToDelete.id);
      await queryClient.invalidateQueries({
        queryKey: ["checklist-plantillas-empresa"],
      });
      await queryClient.invalidateQueries({
        queryKey: ["checklist-plantillas-lt"],
      });
      showAlert("success", "Plantilla eliminada", "Se eliminó correctamente.");
      setPlantillaToDelete(null);
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
              Plantillas de checklist
            </h1>
            <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-brand-primary/10 text-brand-primary">
              {todas.length} {todas.length === 1 ? "plantilla" : "plantillas"}
            </span>
          </div>
          <p className="text-sm text-brand-text-muted mt-1 max-w-2xl">
            Modelos de inspección por tipo de maquinaria o equipo. Creá checklists propios de la empresa o utilizá los oficiales de Legajo Técnico.
          </p>
        </div>
        {canWrite && (
          <div className="flex items-center gap-3">
            <Link
              href="/checklists/plantillas/nueva"
              className="inline-flex items-center justify-center gap-2 bg-brand-primary hover:bg-brand-primary/95 text-white font-bold px-5 py-3 rounded-xl shadow-sm text-sm cursor-pointer transition-all hover:shadow-md"
            >
              <Plus className="h-4 w-4" />
              Nueva plantilla
            </Link>
          </div>
        )}
      </div>

      {/* KPI Cards / Resumen */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4.5 shadow-2xs">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-semibold text-slate-500">Total plantillas</span>
            <FileStack className="h-4 w-4 text-brand-primary" />
          </div>
          <div className="text-2xl font-black text-slate-900">{todas.length}</div>
          <p className="text-[11px] text-slate-400 mt-0.5">Disponibles para inspección</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4.5 shadow-2xs">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-semibold text-slate-500">De mi empresa</span>
            <Building2 className="h-4 w-4 text-blue-600" />
          </div>
          <div className="text-2xl font-black text-slate-900">{totalEmpresa}</div>
          <p className="text-[11px] text-blue-600 font-medium mt-0.5">Editables y personalizables</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4.5 shadow-2xs">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-semibold text-slate-500">Biblioteca LT</span>
            <BookOpen className="h-4 w-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-black text-slate-900">{totalLt}</div>
          <p className="text-[11px] text-emerald-600 font-medium mt-0.5">Normas y buenas prácticas</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4.5 shadow-2xs">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-semibold text-slate-500">Tipos cubiertos</span>
            <Wrench className="h-4 w-4 text-amber-600" />
          </div>
          <div className="text-2xl font-black text-slate-900">{totalTipos}</div>
          <p className="text-[11px] text-slate-400 mt-0.5">Equipos y maquinarias</p>
        </div>
      </div>

      {/* Barra de Filtros y Búsqueda */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs space-y-3">
        <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
          {/* Tabs de Ámbito */}
          <div className="inline-flex p-1 bg-slate-100 rounded-xl text-xs font-semibold">
            <button
              type="button"
              onClick={() => setTab("todas")}
              className={`px-3.5 py-1.5 rounded-lg transition-all ${
                tab === "todas"
                  ? "bg-white text-slate-900 shadow-2xs font-bold"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Todas ({todas.length})
            </button>
            <button
              type="button"
              onClick={() => setTab("empresa")}
              className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg transition-all ${
                tab === "empresa"
                  ? "bg-white text-slate-900 shadow-2xs font-bold"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Building2 className="h-3.5 w-3.5 text-blue-600" />
              Empresa ({totalEmpresa})
            </button>
            <button
              type="button"
              onClick={() => setTab("global")}
              className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg transition-all ${
                tab === "global"
                  ? "bg-white text-slate-900 shadow-2xs font-bold"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <BookOpen className="h-3.5 w-3.5 text-emerald-600" />
              Biblioteca LT ({totalLt})
            </button>
          </div>

          <div className="flex flex-col sm:flex-row gap-2 items-center">
            {/* Filtro por tipo de equipo */}
            {tiposDisponibles.length > 0 && (
              <div className="relative w-full sm:w-auto">
                <select
                  value={tipoFiltro}
                  onChange={(e) => setTipoFiltro(e.target.value)}
                  className="w-full sm:w-auto rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold bg-white text-slate-700 pr-8"
                >
                  <option value="todos">Todos los tipos de equipo</option>
                  {tiposDisponibles.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Input de búsqueda */}
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Buscar por título o equipo…"
                className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 text-xs bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Grid de Plantillas */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div
              key={i}
              className="h-44 bg-white border border-slate-200 rounded-2xl animate-pulse p-5 space-y-3"
            >
              <div className="h-4 bg-slate-100 rounded w-1/3" />
              <div className="h-6 bg-slate-100 rounded w-3/4" />
              <div className="h-4 bg-slate-100 rounded w-1/2" />
            </div>
          ))}
        </div>
      ) : filtradas.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center space-y-4 shadow-2xs">
          <div className="h-16 w-16 mx-auto rounded-2xl bg-slate-50 flex items-center justify-center border border-slate-100">
            <FileStack className="h-8 w-8 text-slate-400" />
          </div>
          <div className="max-w-md mx-auto space-y-1">
            <h3 className="text-lg font-bold text-slate-900">
              {q || tipoFiltro !== "todos" || tab !== "todas"
                ? "No se encontraron plantillas con los filtros aplicados"
                : "No tenés plantillas creadas todavía"}
            </h3>
            <p className="text-sm text-slate-500">
              {q || tipoFiltro !== "todos" || tab !== "todas"
                ? "Probá limpiando el término de búsqueda o cambiando el filtro seleccionado."
                : "Creá checklists estructurados por tipo de equipo para que tus operarios o inspectores califiquen el estado en segundos."}
            </p>
          </div>
          {q || tipoFiltro !== "todos" || tab !== "todas" ? (
            <button
              type="button"
              onClick={() => {
                setQ("");
                setTipoFiltro("todos");
                setTab("todas");
              }}
              className="px-4 py-2 text-xs font-bold text-brand-primary bg-slate-50 rounded-xl hover:bg-slate-100 border border-slate-200 cursor-pointer"
            >
              Limpiar filtros
            </button>
          ) : (
            canWrite && (
              <Link
                href="/checklists/plantillas/nueva"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-brand-primary text-white text-sm font-bold hover:bg-brand-primary/95 shadow-xs cursor-pointer"
              >
                <Plus className="h-4 w-4" />
                Crear primera plantilla
              </Link>
            )
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {filtradas.map((p) => {
            const esEmpresa = p.ambito === "empresa";
            const tipoKey = (p.tipo_equipo || "").trim().toLowerCase();
            const equiposAsociados = equiposPorTipo.get(tipoKey) || 0;

            return (
              <div
                key={p.id}
                className="group relative rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs hover:shadow-md hover:border-slate-300 transition-all flex flex-col justify-between"
              >
                <div>
                  {/* Fila Superior: Ámbito + Cantidad de Ítems */}
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <span
                      className={`inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${
                        esEmpresa
                          ? "bg-blue-50 text-blue-700 border-blue-200"
                          : "bg-emerald-50 text-emerald-700 border-emerald-200"
                      }`}
                    >
                      {esEmpresa ? (
                        <>
                          <Building2 className="h-3 w-3" />
                          Biblioteca Empresa
                        </>
                      ) : (
                        <>
                          <BookOpen className="h-3 w-3" />
                          Biblioteca LT
                        </>
                      )}
                    </span>

                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-lg">
                      <ClipboardCheck className="h-3 w-3 text-slate-500" />
                      {p.total_items ?? 0} ítems
                    </span>
                  </div>

                  {/* Título de la Plantilla */}
                  <Link
                    href={`/checklists/plantillas/${p.id}`}
                    className="block group-hover:text-brand-secondary transition-colors"
                  >
                    <h2 className="text-base font-bold text-slate-900 leading-snug line-clamp-2">
                      {p.titulo}
                    </h2>
                  </Link>

                  {/* Tipo de equipo & equipos compatibles */}
                  <div className="mt-3 space-y-1.5">
                    <div className="flex items-center gap-1.5 text-xs text-slate-600 font-medium">
                      <Wrench className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                      <span className="truncate">Para: <strong className="text-slate-800">{p.tipo_equipo}</strong></span>
                    </div>

                    {esEmpresa && (
                      <p className="text-[11px] text-slate-500">
                        {equiposAsociados > 0 ? (
                          <span className="text-emerald-700 font-medium">
                            ✓ {equiposAsociados} {equiposAsociados === 1 ? "equipo registrado" : "equipos registrados"} de este tipo
                          </span>
                        ) : (
                          <span className="text-slate-400">
                            Sin equipos dados de alta aún con este tipo
                          </span>
                        )}
                      </p>
                    )}

                    {p.estado_publicacion && !esEmpresa && (
                      <span className="inline-block text-[10px] font-bold uppercase px-2 py-0.5 rounded border border-slate-200 text-slate-600">
                        Estado: {p.estado_publicacion}
                      </span>
                    )}
                  </div>
                </div>

                {/* Acciones del Card */}
                <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    {canWrite && (
                      <Link
                        href={`/checklists/inspecciones/nueva?plantillaId=${p.id}`}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-brand-primary text-white text-xs font-bold hover:bg-brand-primary/95 transition-colors"
                        title="Crear inspección con este checklist"
                      >
                        <ClipboardCheck className="h-3.5 w-3.5" />
                        Inspeccionar
                      </Link>
                    )}
                    {esEmpresa && canWrite && (
                      <Link
                        href={`/checklists/plantillas/${p.id}/editar`}
                        className="p-1.5 rounded-xl border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-colors"
                        title="Editar plantilla"
                      >
                        <Pencil className="h-4 w-4" />
                      </Link>
                    )}
                    {esEmpresa && canWrite && (
                      <button
                        type="button"
                        onClick={() => setPlantillaToDelete(p)}
                        className="p-1.5 rounded-xl border border-slate-200 text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                        title="Eliminar plantilla"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>

                  <Link
                    href={`/checklists/plantillas/${p.id}`}
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
      )}

      {/* Modal de confirmación para eliminar */}
      {plantillaToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 rounded-xl bg-rose-50 border border-rose-100 flex items-center justify-center shrink-0 text-rose-600">
                <AlertCircle className="h-5 w-5" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-slate-900">
                  ¿Eliminar plantilla de checklist?
                </h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Estás a punto de eliminar <strong>&quot;{plantillaToDelete.titulo}&quot;</strong>. Esta acción no se puede deshacer.
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setPlantillaToDelete(null)}
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
