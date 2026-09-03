"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import {
  Building2,
  FileText,
  GraduationCap,
  HardHat,
  AlertTriangle,
  Search,
  ArrowRight,
  ExternalLink,
  ShieldCheck,
  GitBranch,
  MapPin,
  Lock,
  CheckCircle2,
  Loader2,
  FolderOpen,
} from "lucide-react";
import { getSucursalLabel, getBaseCuit, formatCuitDisplay } from "@/lib/cuit";
import type { Empresa } from "@/types";

type EmpresaEnteRow = {
  empresa_id: string;
  permisos: {
    informes?: boolean;
    capacitaciones?: boolean;
    epp?: boolean;
    metricas?: boolean;
  };
  conteos?: {
    informes: number;
    capacitaciones: number;
    epp: number;
    observaciones: number;
  };
  empresa: {
    id: string;
    razon_social: string;
    cuit: string;
    logo_url?: string | null;
    actividad?: string | null;
    localidad?: string | null;
    domicilio?: string | null;
    estado?: string | null;
  } | null;
};

type DashboardEnte = {
  totalEmpresas: number;
  totalInformes: number;
  totalCapacitaciones: number;
  totalEntregasEpp: number;
  observacionesAbiertas: number;
  empresas: EmpresaEnteRow[];
};

export default function EnteDashboardPage() {
  const { user, cambiarEmpresaContexto } = useAuth();
  const router = useRouter();
  const [data, setData] = useState<DashboardEnte | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api
      .get("/ente/dashboard")
      .then((res) => {
        if (!cancelled) {
          setData(res.data);
          setLoading(false);
        }
      })
      .catch((err) => {
        console.error("Error loading ente dashboard:", err);
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const handleEntrarLegajo = (emp: EmpresaEnteRow["empresa"], destination = "/dashboard") => {
    if (!emp) return;
    const empresaObj: Empresa = {
      id: emp.id,
      razon_social: emp.razon_social,
      cuit: emp.cuit,
      logo_url: emp.logo_url || undefined,
      actividad: emp.actividad || undefined,
      localidad: emp.localidad || undefined,
      domicilio: emp.domicilio || undefined,
      estado: (emp.estado as Empresa["estado"]) || "activa",
      consultora_id: "",
      created_at: new Date().toISOString(),
    };
    cambiarEmpresaContexto(empresaObj);
    router.push(destination);
  };

  const filteredEmpresas = useMemo(() => {
    if (!data?.empresas) return [];
    const term = searchTerm.toLowerCase().trim();
    if (!term) return data.empresas;

    return data.empresas.filter((row) => {
      const emp = row.empresa;
      if (!emp) return false;
      const sucursal = emp.cuit ? getSucursalLabel(emp.cuit) || "" : "";
      const baseCuit = emp.cuit ? getBaseCuit(emp.cuit) : "";
      const matchName = emp.razon_social?.toLowerCase().includes(term);
      const matchCuit = emp.cuit?.toLowerCase().includes(term) || baseCuit.includes(term);
      const matchSucursal = sucursal.toLowerCase().includes(term);
      const matchLocalidad = emp.localidad?.toLowerCase().includes(term);

      return matchName || matchCuit || matchSucursal || matchLocalidad;
    });
  }, [data, searchTerm]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-3">
        <Loader2 className="h-8 w-8 text-blue-600 animate-spin" />
        <p className="text-sm font-bold text-slate-500">Cargando tablero de auditoría...</p>
      </div>
    );
  }

  const metricCards = [
    {
      label: "Empresas Asignadas",
      value: data?.totalEmpresas ?? 0,
      icon: Building2,
      color: "from-blue-500/15 to-blue-600/5 text-blue-700 border-blue-200/80",
      iconBg: "bg-blue-600 text-white",
    },
    {
      label: "Informes de Visita",
      value: data?.totalInformes ?? 0,
      icon: FileText,
      color: "from-emerald-500/15 to-emerald-600/5 text-emerald-700 border-emerald-200/80",
      iconBg: "bg-emerald-600 text-white",
    },
    {
      label: "Capacitaciones",
      value: data?.totalCapacitaciones ?? 0,
      icon: GraduationCap,
      color: "from-violet-500/15 to-violet-600/5 text-violet-700 border-violet-200/80",
      iconBg: "bg-violet-600 text-white",
    },
    {
      label: "Entregas de EPP",
      value: data?.totalEntregasEpp ?? 0,
      icon: HardHat,
      color: "from-amber-500/15 to-amber-600/5 text-amber-700 border-amber-200/80",
      iconBg: "bg-amber-600 text-white",
    },
    {
      label: "Observaciones Pendientes",
      value: data?.observacionesAbiertas ?? 0,
      icon: AlertTriangle,
      color: "from-rose-500/15 to-rose-600/5 text-rose-700 border-rose-200/80",
      iconBg: "bg-rose-600 text-white",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Bienvenida y Encabezado */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 bg-blue-100 text-blue-700 rounded-lg">
              <ShieldCheck className="h-5 w-5" />
            </span>
            <span className="text-xs font-black uppercase tracking-wider text-slate-400">
              Organismo: {user?.nombre_completo || "Ente Regulador"}
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight mt-1">
            Panel General de Auditoría y Control
          </h1>
          <p className="text-sm text-slate-500 mt-1 max-w-2xl">
            Accedé en modo <strong>solo lectura</strong> al legajo técnico oficial, informes firmados, capacitaciones y entregas de EPP de las empresas autorizadas.
          </p>
        </div>

        <Link
          href="/ente/archivo"
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-slate-900/10 shrink-0"
        >
          <FolderOpen className="h-4 w-4" />
          Ver Archivo Global de Documentos
        </Link>
      </div>

      {/* Grid de Métricas Generales */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3.5">
        {metricCards.map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.label}
              className={`bg-white rounded-2xl border p-4 shadow-2xs flex flex-col justify-between min-h-[110px] ${card.color}`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-black uppercase tracking-wider text-slate-500">
                  {card.label}
                </span>
                <div className={`h-7 w-7 rounded-lg flex items-center justify-center shadow-2xs ${card.iconBg}`}>
                  <Icon className="h-3.5 w-3.5" />
                </div>
              </div>
              <p className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight mt-2">
                {card.value}
              </p>
            </div>
          );
        })}
      </div>

      {/* Sección: Directorio de Empresas Asignadas */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div>
            <h2 className="text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
              <Building2 className="h-5 w-5 text-blue-600" />
              Empresas y Sedes Habilitadas ({filteredEmpresas.length})
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Hacé clic en cualquier empresa para abrir su legajo técnico o consultar sus documentos específicos.
            </p>
          </div>

          {/* Buscador */}
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por empresa o CUIT..."
              className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition-all"
            />
          </div>
        </div>

        {filteredEmpresas.length === 0 ? (
          <div className="py-12 text-center text-slate-400">
            <Building2 className="h-10 w-10 mx-auto text-slate-300 mb-2" />
            <p className="text-sm font-bold text-slate-600">No se encontraron empresas habilitadas</p>
            <p className="text-xs text-slate-400 mt-0.5">
              El administrador aún no habilitó empresas para tu usuario o el filtro no arrojó resultados.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredEmpresas.map((row) => {
              const emp = row.empresa;
              if (!emp) return null;

              const sucursal = emp.cuit ? getSucursalLabel(emp.cuit) : null;
              const conteos = row.conteos || {
                informes: 0,
                capacitaciones: 0,
                epp: 0,
                observaciones: 0,
              };

              return (
                <div
                  key={row.empresa_id}
                  className="bg-slate-50/70 hover:bg-white border border-slate-200/90 hover:border-blue-300 hover:shadow-md rounded-2xl p-5 transition-all flex flex-col justify-between gap-4 group"
                >
                  {/* Info Superior de la Empresa */}
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <h3 className="text-base font-black text-slate-900 group-hover:text-blue-700 transition-colors">
                            {emp.razon_social}
                          </h3>
                          {sucursal ? (
                            <span className="inline-flex items-center gap-1 bg-blue-600 text-white font-black text-[10px] px-2 py-0.5 rounded-md shadow-2xs tracking-wide">
                              <GitBranch className="h-2.5 w-2.5" />
                              {sucursal}
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold text-slate-500 bg-slate-200/70 border border-slate-300/60 px-1.5 py-0.2 rounded">
                              Sede Principal
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2 text-xs text-slate-500 font-medium mt-1">
                          {emp.localidad && (
                            <span className="flex items-center gap-0.5 text-slate-600 font-semibold truncate">
                              <MapPin className="h-3 w-3 text-slate-400 shrink-0" />
                              {emp.localidad}
                            </span>
                          )}
                          {emp.localidad && <span className="text-slate-300">•</span>}
                          <span className="font-mono text-slate-400 text-[11px]">
                            CUIT {formatCuitDisplay(getBaseCuit(emp.cuit))}
                          </span>
                        </div>
                      </div>

                      <div className="h-9 w-9 rounded-xl bg-white border border-slate-200 text-slate-600 flex items-center justify-center shrink-0 shadow-2xs group-hover:border-blue-300 group-hover:text-blue-600 transition-colors">
                        <Building2 className="h-4.5 w-4.5" />
                      </div>
                    </div>

                    {/* Resumen de Documentos Disponibles */}
                    <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-200/60">
                      <div className="bg-white/80 border border-slate-200/80 rounded-xl p-2 text-center">
                        <span className="text-[10px] font-bold uppercase text-slate-400 block">
                          Informes
                        </span>
                        <span className="text-sm font-black text-slate-800">
                          {conteos.informes}
                        </span>
                      </div>
                      <div className="bg-white/80 border border-slate-200/80 rounded-xl p-2 text-center">
                        <span className="text-[10px] font-bold uppercase text-slate-400 block">
                          Capacitac.
                        </span>
                        <span className="text-sm font-black text-slate-800">
                          {conteos.capacitaciones}
                        </span>
                      </div>
                      <div className="bg-white/80 border border-slate-200/80 rounded-xl p-2 text-center">
                        <span className="text-[10px] font-bold uppercase text-slate-400 block">
                          EPP
                        </span>
                        <span className="text-sm font-black text-slate-800">
                          {conteos.epp}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Botones de Acción */}
                  <div className="pt-2 border-t border-slate-200/60 flex flex-wrap items-center justify-between gap-2">
                    {/* Botones rápidos de módulos */}
                    <div className="flex items-center gap-1">
                      {row.permisos.informes && (
                        <button
                          type="button"
                          onClick={() => handleEntrarLegajo(emp, "/informes")}
                          className="px-2 py-1 text-[11px] font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors cursor-pointer"
                          title="Ver informes de visita de esta empresa"
                        >
                          Informes
                        </button>
                      )}
                      {row.permisos.capacitaciones && (
                        <button
                          type="button"
                          onClick={() => handleEntrarLegajo(emp, "/capacitaciones")}
                          className="px-2 py-1 text-[11px] font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors cursor-pointer"
                          title="Ver capacitaciones de esta empresa"
                        >
                          Cursos
                        </button>
                      )}
                      {row.permisos.epp && (
                        <button
                          type="button"
                          onClick={() => handleEntrarLegajo(emp, "/epp")}
                          className="px-2 py-1 text-[11px] font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors cursor-pointer"
                          title="Ver entregas de EPP de esta empresa"
                        >
                          EPP
                        </button>
                      )}
                    </div>

                    {/* Botón Principal: Abrir Legajo Completo */}
                    <button
                      type="button"
                      onClick={() => handleEntrarLegajo(emp, "/dashboard")}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs shadow-blue-500/25 cursor-pointer ml-auto"
                    >
                      <span>Abrir Legajo Técnico</span>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Nota de pie */}
      <div className="bg-slate-100/70 border border-slate-200 rounded-2xl p-3.5 flex items-center justify-between text-xs text-slate-500">
        <div className="flex items-center gap-2">
          <Lock className="h-3.5 w-3.5 text-slate-400 shrink-0" />
          <span>
            Tu cuenta tiene permisos de <strong>solo lectura</strong>. Los documentos visualizados cuentan con validez legal y certificación digital de firmas.
          </span>
        </div>
        <span className="font-mono text-[10px] text-slate-400">
          ID: {user?.id?.slice(0, 8)}
        </span>
      </div>
    </div>
  );
}
