"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { useAdminUsuarios } from "@/hooks/useAdminUsuarios";
import {
  Building2,
  Lock,
  Save,
  Shield,
  ShieldCheck,
  Search,
  FileText,
  GraduationCap,
  HardHat,
  BarChart3,
  Check,
  CheckCheck,
  X,
  GitBranch,
  MapPin,
  Info,
  Loader2,
  UserPlus,
  ChevronRight,
  Sparkles,
} from "lucide-react";
import type { AdminEmpresaOption } from "@/types";
import { useAlert } from "@/context/AlertContext";
import { getSucursalLabel, getBaseCuit, formatCuitDisplay } from "@/lib/cuit";

type PermisosEnte = {
  informes: boolean;
  capacitaciones: boolean;
  epp: boolean;
  metricas: boolean;
};

type Asignacion = {
  empresa_id: string;
  permisos: PermisosEnte;
};

const DEFAULT_PERMISOS: PermisosEnte = {
  informes: true,
  capacitaciones: true,
  epp: true,
  metricas: true,
};

const MODULOS_INFO: Array<{
  key: keyof PermisosEnte;
  label: string;
  desc: string;
  icon: typeof FileText;
}> = [
  {
    key: "informes",
    label: "Informes",
    desc: "Visitas técnicas e inspecciones",
    icon: FileText,
  },
  {
    key: "capacitaciones",
    label: "Capacitaciones",
    desc: "Cursos y asistencias del personal",
    icon: GraduationCap,
  },
  {
    key: "epp",
    label: "EPP",
    desc: "Entregas oficiales de protección",
    icon: HardHat,
  },
  {
    key: "metricas",
    label: "Métricas",
    desc: "Estadísticas e indicadores",
    icon: BarChart3,
  },
];

type FilterTab = "todas" | "habilitadas" | "sin_habilitar";

export default function EnteReguladorAdminPage() {
  const { usuarios, empresas, isLoading } = useAdminUsuarios();
  const entes = useMemo(
    () => (usuarios || []).filter((u) => u.rol === "ente_regulador"),
    [usuarios],
  );

  const [selectedEnteId, setSelectedEnteId] = useState<string>("");
  const [asignaciones, setAsignaciones] = useState<Asignacion[]>([]);
  const [initialAsignaciones, setInitialAsignaciones] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [loadingAsignaciones, setLoadingAsignaciones] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterTab, setFilterTab] = useState<FilterTab>("todas");
  const [showGuia, setShowGuia] = useState(true);
  const { showAlert } = useAlert();

  useEffect(() => {
    if (!selectedEnteId && entes[0]) {
      setSelectedEnteId(entes[0].id);
    }
  }, [entes, selectedEnteId]);

  useEffect(() => {
    if (!selectedEnteId) return;
    const load = async () => {
      setLoadingAsignaciones(true);
      try {
        const { data } = await api.get(`/admin/entes/${selectedEnteId}/empresas`);
        const rows = (data.asignaciones || []) as Array<{
          empresa_id: string;
          permisos: PermisosEnte;
        }>;
        setAsignaciones(rows);
        setInitialAsignaciones(JSON.stringify(rows));
      } catch (err) {
        console.error("Error loading ente empresas:", err);
      } finally {
        setLoadingAsignaciones(false);
      }
    };
    void load();
  }, [selectedEnteId]);

  const selectedEnte = useMemo(
    () => entes.find((e) => e.id === selectedEnteId),
    [entes, selectedEnteId],
  );

  const isDirty = useMemo(() => {
    return JSON.stringify(asignaciones) !== initialAsignaciones;
  }, [asignaciones, initialAsignaciones]);

  const toggleEmpresa = (empresaId: string) => {
    setAsignaciones((prev) => {
      const exists = prev.find((a) => a.empresa_id === empresaId);
      if (exists) return prev.filter((a) => a.empresa_id !== empresaId);
      return [
        ...prev,
        { empresa_id: empresaId, permisos: { ...DEFAULT_PERMISOS } },
      ];
    });
  };

  const togglePermiso = (empresaId: string, key: keyof PermisosEnte) => {
    setAsignaciones((prev) =>
      prev.map((a) =>
        a.empresa_id === empresaId
          ? { ...a, permisos: { ...a.permisos, [key]: !a.permisos[key] } }
          : a,
      ),
    );
  };

  const handleToggleAll = (enable: boolean) => {
    if (enable) {
      const all: Asignacion[] = (empresas as AdminEmpresaOption[]).map((e) => ({
        empresa_id: e.id,
        permisos: { ...DEFAULT_PERMISOS },
      }));
      setAsignaciones(all);
    } else {
      setAsignaciones([]);
    }
  };

  const handleSetAllModules = (key: keyof PermisosEnte, value: boolean) => {
    setAsignaciones((prev) =>
      prev.map((a) => ({
        ...a,
        permisos: { ...a.permisos, [key]: value },
      })),
    );
  };

  const handleSave = async () => {
    if (!selectedEnteId) return;
    setSaving(true);
    try {
      await api.put(`/admin/entes/${selectedEnteId}/empresas`, { asignaciones });
      setInitialAsignaciones(JSON.stringify(asignaciones));
      showAlert(
        "success",
        "Acceso actualizado",
        `Se guardaron los permisos para ${selectedEnte?.nombre_completo || "el ente"}.`,
      );
    } catch {
      showAlert("error", "Error", "No se pudo guardar la asignación.");
    } finally {
      setSaving(false);
    }
  };

  // Filtrado de empresas
  const filteredEmpresas = useMemo(() => {
    const list = (empresas as AdminEmpresaOption[]) || [];
    const term = searchTerm.toLowerCase().trim();

    return list.filter((emp) => {
      const isAssigned = asignaciones.some((a) => a.empresa_id === emp.id);

      // Filtro de tab
      if (filterTab === "habilitadas" && !isAssigned) return false;
      if (filterTab === "sin_habilitar" && isAssigned) return false;

      // Filtro de búsqueda
      if (!term) return true;
      const sucursal = emp.cuit ? getSucursalLabel(emp.cuit) || "" : "";
      const baseCuit = emp.cuit ? getBaseCuit(emp.cuit) : "";
      const matchName = emp.razon_social?.toLowerCase().includes(term);
      const matchCuit = emp.cuit?.toLowerCase().includes(term) || baseCuit.includes(term);
      const matchSucursal = sucursal.toLowerCase().includes(term);
      const matchLocalidad = emp.localidad?.toLowerCase().includes(term);

      return matchName || matchCuit || matchSucursal || matchLocalidad;
    });
  }, [empresas, asignaciones, searchTerm, filterTab]);

  const counts = useMemo(() => {
    const total = (empresas || []).length;
    const habilitadas = asignaciones.length;
    const sinHabilitar = Math.max(0, total - habilitadas);
    return { total, habilitadas, sinHabilitar };
  }, [empresas, asignaciones]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-3">
        <Loader2 className="h-8 w-8 text-blue-600 animate-spin" />
        <p className="text-sm font-bold text-slate-500">Cargando entes reguladores y empresas...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 w-full max-w-full">
      {/* Header Principal */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 bg-blue-100/70 text-blue-700 rounded-xl">
              <ShieldCheck className="h-5 w-5" />
            </span>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
              Ente Regulador y Auditorías
            </h1>
          </div>
          <p className="text-sm text-slate-500 mt-1 max-w-2xl">
            Gestioná qué empresas y módulos de solo lectura (Informes, Capacitaciones, EPP y Métricas) puede auditar cada organismo externo (ART, Ministerios, Municipios).
          </p>
        </div>

        <Link
          href="/admin/usuarios"
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors shadow-2xs shrink-0"
        >
          <UserPlus className="h-4 w-4 text-blue-600" />
          Crear Ente Regulador en Usuarios
        </Link>
      </div>

      {/* Guía Explicativa de Funcionamiento */}
      {showGuia && (
        <div className="bg-gradient-to-r from-blue-50 via-indigo-50/50 to-white border border-blue-200/80 rounded-2xl p-4 sm:p-5 relative shadow-xs">
          <button
            type="button"
            onClick={() => setShowGuia(false)}
            className="absolute top-3.5 right-3.5 text-slate-400 hover:text-slate-600 p-1 rounded-lg"
            title="Cerrar guía"
          >
            <X className="h-4 w-4" />
          </button>
          <div className="flex items-start gap-3.5 pr-8">
            <div className="h-9 w-9 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-xs mt-0.5">
              <Info className="h-5 w-5" />
            </div>
            <div className="space-y-2">
              <h3 className="text-sm font-black text-slate-900">
                ¿Cómo funciona el acceso para un Ente Regulador?
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1 text-xs text-slate-600">
                <div className="bg-white/80 border border-blue-100 rounded-xl p-3">
                  <span className="font-extrabold text-blue-700 block mb-1">
                    1. Creación de Cuenta
                  </span>
                  Se crea el usuario en <strong className="text-slate-800">Usuarios</strong> con rol <em>"Ente Regulador / ART"</em>. Tiene su propio usuario y contraseña.
                </div>
                <div className="bg-white/80 border border-blue-100 rounded-xl p-3">
                  <span className="font-extrabold text-blue-700 block mb-1">
                    2. Habilitación de Sedes
                  </span>
                  En esta pantalla elegís qué empresas/sucursales puede ver y qué módulos específicos tiene permitidos para auditar.
                </div>
                <div className="bg-white/80 border border-blue-100 rounded-xl p-3">
                  <span className="font-extrabold text-blue-700 block mb-1">
                    3. Ingreso del Auditor
                  </span>
                  El inspector ingresa en el login general indicando el <strong className="text-slate-800">CUIT de la empresa</strong> habilitada y su usuario. Solo tendrá acceso de lectura.
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {entes.length === 0 ? (
        /* Empty state si no hay entes */
        <div className="bg-white rounded-3xl border border-slate-200 p-8 sm:p-12 text-center max-w-xl mx-auto space-y-4 shadow-xs">
          <div className="h-16 w-16 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mx-auto">
            <Shield className="h-8 w-8" />
          </div>
          <div>
            <h2 className="text-lg font-black text-slate-900">
              Todavía no creaste ningún Ente Regulador
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-md mx-auto">
              Para habilitar auditorías de ART, Ministerios o Municipios, primero creá un usuario con rol <strong>Ente Regulador</strong>.
            </p>
          </div>
          <Link
            href="/admin/usuarios"
            className="inline-flex items-center gap-2 px-5 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-bold shadow-md shadow-blue-500/25 transition-all"
          >
            <UserPlus className="h-4 w-4" />
            Ir a Usuarios y Crear Ente
          </Link>
        </div>
      ) : (
        /* Layout de 2 columnas: Lista de Entes a la Izq, Empresas a la Der */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Columna Izquierda: Selector de Entes (4 cols) */}
          <aside className="lg:col-span-4 bg-white rounded-3xl border border-slate-200 p-4 sm:p-5 space-y-3 shadow-2xs">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <span className="text-xs font-black uppercase tracking-wider text-slate-400">
                Organismos ({entes.length})
              </span>
              <span className="text-[11px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md">
                Auditores
              </span>
            </div>

            <div className="space-y-2">
              {entes.map((ente) => {
                const isSelected = selectedEnteId === ente.id;
                return (
                  <button
                    key={ente.id}
                    type="button"
                    onClick={() => setSelectedEnteId(ente.id)}
                    className={`w-full text-left p-3.5 rounded-2xl transition-all cursor-pointer border ${
                      isSelected
                        ? "bg-slate-900 text-white border-slate-900 shadow-md shadow-slate-900/15 ring-2 ring-blue-600/30"
                        : "bg-slate-50/70 hover:bg-slate-100/80 text-slate-800 border-slate-200/80"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-black truncate">
                          {ente.nombre_completo}
                        </p>
                        <p
                          className={`text-xs font-mono font-medium truncate mt-0.5 ${
                            isSelected ? "text-slate-300" : "text-slate-500"
                          }`}
                        >
                          @{ente.username}
                        </p>
                      </div>
                      <div
                        className={`h-7 w-7 rounded-xl flex items-center justify-center shrink-0 ${
                          isSelected
                            ? "bg-white/10 text-white"
                            : "bg-white text-slate-400 border border-slate-200"
                        }`}
                      >
                        <ChevronRight className="h-4 w-4" />
                      </div>
                    </div>

                    {isSelected && (
                      <div className="mt-3 pt-2.5 border-t border-white/10 flex items-center justify-between text-[11px]">
                        <span className="text-slate-300 font-medium">
                          Empresas habilitadas:
                        </span>
                        <span className="font-extrabold bg-blue-600 text-white px-2 py-0.5 rounded-md shadow-2xs">
                          {asignaciones.length}
                        </span>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            <div className="pt-3 border-t border-slate-100">
              <Link
                href="/admin/usuarios"
                className="w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border border-dashed border-slate-300 text-slate-600 hover:text-blue-600 hover:border-blue-300 text-xs font-bold transition-colors"
              >
                <UserPlus className="h-3.5 w-3.5" />
                Agregar otro ente / auditor
              </Link>
            </div>
          </aside>

          {/* Columna Derecha: Empresas y Módulos (8 cols) */}
          <section className="lg:col-span-8 bg-white rounded-3xl border border-slate-200 p-5 sm:p-6 space-y-5 shadow-2xs relative">
            {/* Header del Ente Seleccionado */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">
                    {selectedEnte?.nombre_completo || "Ente Seleccionado"}
                  </h2>
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md">
                    <Lock className="h-3 w-3" /> Solo lectura
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Seleccioná las empresas y los módulos que este organismo tiene permiso para auditar.
                </p>
              </div>

              {/* Botón Guardar Superior */}
              <button
                type="button"
                onClick={handleSave}
                disabled={saving || !isDirty}
                className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
                  isDirty
                    ? "bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-500/25 animate-pulse"
                    : "bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200"
                }`}
              >
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                {isDirty ? "Guardar cambios *" : "Sin cambios"}
              </button>
            </div>

            {/* Barra de Búsqueda y Filtros de Tabs */}
            <div className="space-y-3">
              <div className="relative">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Buscar empresa por razón social, CUIT o sucursal..."
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition-all"
                />
                {searchTerm && (
                  <button
                    type="button"
                    onClick={() => setSearchTerm("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2">
                {/* Tabs de estado */}
                <div className="inline-flex p-1 bg-slate-100 rounded-xl border border-slate-200 text-xs font-bold">
                  <button
                    type="button"
                    onClick={() => setFilterTab("todas")}
                    className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                      filterTab === "todas"
                        ? "bg-white text-slate-900 shadow-2xs"
                        : "text-slate-500 hover:text-slate-800"
                    }`}
                  >
                    Todas ({counts.total})
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterTab("habilitadas")}
                    className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                      filterTab === "habilitadas"
                        ? "bg-blue-600 text-white shadow-2xs"
                        : "text-slate-500 hover:text-slate-800"
                    }`}
                  >
                    Habilitadas ({counts.habilitadas})
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterTab("sin_habilitar")}
                    className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                      filterTab === "sin_habilitar"
                        ? "bg-white text-slate-900 shadow-2xs"
                        : "text-slate-500 hover:text-slate-800"
                    }`}
                  >
                    Sin habilitar ({counts.sinHabilitar})
                  </button>
                </div>

                {/* Acciones Masivas */}
                <div className="flex items-center gap-1.5 text-xs">
                  <button
                    type="button"
                    onClick={() => handleToggleAll(true)}
                    className="px-2.5 py-1.5 text-slate-600 hover:text-blue-700 hover:bg-blue-50 border border-slate-200 rounded-lg font-bold transition-colors cursor-pointer"
                  >
                    Habilitar todas
                  </button>
                  <button
                    type="button"
                    onClick={() => handleToggleAll(false)}
                    className="px-2.5 py-1.5 text-slate-500 hover:text-rose-700 hover:bg-rose-50 border border-slate-200 rounded-lg font-bold transition-colors cursor-pointer"
                  >
                    Deshabilitar todas
                  </button>
                </div>
              </div>
            </div>

            {/* Listado de Empresas */}
            {loadingAsignaciones ? (
              <div className="py-12 flex flex-col items-center justify-center text-slate-400 gap-2">
                <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
                <span className="text-xs font-bold">Cargando asignaciones...</span>
              </div>
            ) : filteredEmpresas.length === 0 ? (
              <div className="py-12 text-center border-2 border-dashed border-slate-200 rounded-2xl p-6">
                <p className="text-sm font-bold text-slate-600">
                  No se encontraron empresas con el filtro actual
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  Probá cambiando el texto de búsqueda o la pestaña seleccionada.
                </p>
              </div>
            ) : (
              <div className="space-y-3 max-h-[58vh] overflow-y-auto pr-1">
                {filteredEmpresas.map((empresa) => {
                  const assigned = asignaciones.find(
                    (a) => a.empresa_id === empresa.id,
                  );
                  const sucursal = empresa.cuit
                    ? getSucursalLabel(empresa.cuit)
                    : null;
                  const isChecked = Boolean(assigned);

                  return (
                    <div
                      key={empresa.id}
                      className={`border rounded-2xl p-4 transition-all ${
                        isChecked
                          ? "bg-blue-50/40 border-blue-200/90 shadow-2xs"
                          : "bg-slate-50/50 border-slate-200/80 hover:border-slate-300"
                      }`}
                    >
                      {/* Cabecera de Empresa */}
                      <div className="flex items-start justify-between gap-3">
                        <label className="flex items-start gap-3 cursor-pointer select-none flex-1 min-w-0">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => toggleEmpresa(empresa.id)}
                            className="h-4.5 w-4.5 mt-0.5 rounded-md border-slate-300 text-blue-600 focus:ring-blue-600 cursor-pointer accent-blue-600"
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-black text-slate-900 tracking-tight">
                                {empresa.razon_social}
                              </span>

                              {sucursal ? (
                                <span className="inline-flex items-center gap-1 bg-blue-600 text-white font-black text-[10px] px-1.5 py-0.5 rounded shadow-2xs tracking-wide shrink-0">
                                  <GitBranch className="h-2.5 w-2.5" />
                                  {sucursal}
                                </span>
                              ) : (
                                <span className="text-[10px] font-bold text-slate-500 bg-slate-200/70 border border-slate-200 px-1.5 py-0.2 rounded shrink-0">
                                  Sede Principal
                                </span>
                              )}

                              {empresa.estado === "aviso_deuda" && (
                                <span className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.2 rounded shrink-0">
                                  Aviso deuda
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-2 text-xs text-slate-500 font-medium truncate mt-1">
                              {empresa.localidad && (
                                <span className="flex items-center gap-0.5 text-slate-600 font-semibold truncate">
                                  <MapPin className="h-3 w-3 text-slate-400 shrink-0" />
                                  {empresa.localidad}
                                </span>
                              )}
                              {empresa.localidad && (
                                <span className="text-slate-300">•</span>
                              )}
                              <span className="font-mono text-slate-400 text-[11px]">
                                CUIT{" "}
                                {formatCuitDisplay(getBaseCuit(empresa.cuit))}
                              </span>
                            </div>
                          </div>
                        </label>

                        <div className="shrink-0">
                          <button
                            type="button"
                            onClick={() => toggleEmpresa(empresa.id)}
                            className={`px-2.5 py-1 rounded-lg text-xs font-bold cursor-pointer transition-colors ${
                              isChecked
                                ? "bg-blue-600 text-white"
                                : "bg-white text-slate-500 border border-slate-200 hover:bg-slate-100"
                            }`}
                          >
                            {isChecked ? "Habilitada" : "Habilitar"}
                          </button>
                        </div>
                      </div>

                      {/* Selector de Módulos (Solo visible si está habilitada) */}
                      {assigned && (
                        <div className="mt-3 pt-3 border-t border-blue-100 pl-7 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-black uppercase tracking-wider text-slate-500">
                              Módulos con acceso de solo lectura:
                            </span>
                            <span className="text-[10px] text-slate-400">
                              (Pulsá cada módulo para activar o desactivar)
                            </span>
                          </div>

                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                            {MODULOS_INFO.map((mod) => {
                              const active = assigned.permisos[mod.key];
                              const Icon = mod.icon;
                              return (
                                <button
                                  key={mod.key}
                                  type="button"
                                  onClick={() =>
                                    togglePermiso(empresa.id, mod.key)
                                  }
                                  className={`p-2.5 rounded-xl text-left border transition-all cursor-pointer flex flex-col justify-between min-h-[56px] ${
                                    active
                                      ? "bg-white border-blue-500 text-blue-950 shadow-2xs ring-1 ring-blue-500/20"
                                      : "bg-slate-100/70 border-slate-200 text-slate-400 opacity-70"
                                  }`}
                                  title={`${mod.label}: ${mod.desc}`}
                                >
                                  <div className="flex items-center justify-between w-full">
                                    <div className="flex items-center gap-1.5">
                                      <Icon
                                        className={`h-3.5 w-3.5 ${
                                          active
                                            ? "text-blue-600"
                                            : "text-slate-400"
                                        }`}
                                      />
                                      <span className="text-xs font-extrabold">
                                        {mod.label}
                                      </span>
                                    </div>
                                    {active ? (
                                      <span className="h-4 w-4 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px]">
                                        <Check className="h-2.5 w-2.5 stroke-3" />
                                      </span>
                                    ) : (
                                      <span className="h-4 w-4 rounded-full border border-slate-300 flex items-center justify-center text-[9px] text-slate-400">
                                        <Lock className="h-2 w-2" />
                                      </span>
                                    )}
                                  </div>
                                  <span className="text-[10px] text-slate-400 font-medium line-clamp-1 mt-1">
                                    {mod.desc}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Barra Inferior Flotante de Guardar Cambios */}
            <div className="pt-4 border-t border-slate-100 flex items-center justify-between gap-4">
              <div className="flex items-center gap-2 text-xs">
                {isDirty ? (
                  <span className="inline-flex items-center gap-1.5 font-bold text-amber-700 bg-amber-50 border border-amber-200 px-3 py-1 rounded-lg">
                    <span className="h-2 w-2 rounded-full bg-amber-500 animate-ping" />
                    Hay cambios sin guardar
                  </span>
                ) : (
                  <span className="text-slate-400 font-medium">
                    Todas las asignaciones están sincronizadas
                  </span>
                )}
              </div>

              <button
                type="button"
                onClick={handleSave}
                disabled={saving || !isDirty}
                className={`inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-black transition-all cursor-pointer ${
                  isDirty
                    ? "bg-slate-900 hover:bg-slate-800 text-white shadow-lg shadow-slate-900/20"
                    : "bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200"
                }`}
              >
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                Guardar habilitación
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
