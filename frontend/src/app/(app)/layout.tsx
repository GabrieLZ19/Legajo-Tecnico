"use client";

import React, { useEffect, useState } from "react";
import { useAuth, getMisEmpresas } from "@/hooks/useAuth";
import { getEmpresaDetalle } from "@/hooks/useAdminEmpresas";
import { useRouter, usePathname } from "next/navigation";
import BottomNav from "@/components/BottomNav.FC";
import Link from "next/link";
import { Empresa } from "@/types";
import { LogOut, Building2, ChevronDown, AlertTriangle, GitBranch, X, Check, MapPin, ShieldCheck, LayoutDashboard } from "lucide-react";
import { NotificationBell } from "@/components/notification-bell";
import { getSucursalLabel, getBaseCuit, formatCuitDisplay } from "@/lib/cuit";
import {
  canWriteAppModule,
  getVisibleAppNavModules,
  isPathBlockedByPermissions,
  isWritePathBlockedByPermissions,
} from "@/lib/moduleAccess";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, empresa, loading, logout, cambiarEmpresaContexto } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const [localEmpresa, setLocalEmpresa] = useState<Empresa | null>(empresa);
  const [misEmpresas, setMisEmpresas] = useState<Empresa[]>([]);
  const [showEmpresaSelector, setShowEmpresaSelector] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [user, loading, router]);

  // Protección de rutas según permisos personalizados / rol
  useEffect(() => {
    if (loading || !user || !pathname) return;

    if (isPathBlockedByPermissions(user, pathname)) {
      router.replace("/dashboard");
      return;
    }

    if (isWritePathBlockedByPermissions(user, pathname)) {
      router.replace("/dashboard");
      return;
    }

    // Compat: ente sin escritura en informes sigue bloqueado de altas/edición
    if (
      user.rol === "ente_regulador" &&
      !canWriteAppModule(user, "informes")
    ) {
      const isInformeNuevoRoute = pathname.endsWith("/informes/nuevo");
      const isInformeEditarRoute = pathname.endsWith("/editar");
      if (isInformeNuevoRoute || isInformeEditarRoute) {
        router.replace("/dashboard");
      }
    }
  }, [user, loading, pathname, router]);

  useEffect(() => {
    if (empresa) {
      if (!empresa.razon_social) {
        const fetchEmpresa = async () => {
          try {
            const data = await getEmpresaDetalle(empresa.id);
            setLocalEmpresa(data);
          } catch (err) {
            console.error("Error loading company details in layout:", err);
          }
        };
        fetchEmpresa();
      } else {
        setLocalEmpresa(empresa);
      }
    }
  }, [empresa]);

  // Cargar las empresas del usuario para el selector
  useEffect(() => {
    if (
      !user ||
      (user.rol !== "preventor" &&
        user.rol !== "admin" &&
        user.rol !== "ente_regulador")
    ) {
      return;
    }
    const timer = window.setTimeout(() => {
      getMisEmpresas()
        .then(setMisEmpresas)
        .catch((err) => {
          console.error("Error loading mis-empresas:", err);
        });
    }, 1200);
    return () => window.clearTimeout(timer);
  }, [user]);

  if (loading || !user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-blue-600"></div>
        <p className="mt-4 text-sm text-slate-500 font-medium">
          Cargando legajo digital...
        </p>
      </div>
    );
  }

  // Obtener iniciales del usuario
  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const navItems = [
    { name: "Inicio", href: "/dashboard", disabled: false },
    ...getVisibleAppNavModules(user).map((mod) => ({
      name: mod.label,
      href: mod.href,
      disabled: false,
    })),
  ];

  const handleSeleccionarEmpresa = (emp: Empresa) => {
    cambiarEmpresaContexto(emp);
    setLocalEmpresa(emp);
    setShowEmpresaSelector(false);
  };

  const puedeSeleccionarEmpresa = misEmpresas.length > 1;
  const isPresentacion =
    !!pathname && pathname.includes("/capacitaciones/") && pathname.endsWith("/presentar");

  if (isPresentacion) {
    return <>{children}</>;
  }

  const localSucursal = localEmpresa?.cuit ? getSucursalLabel(localEmpresa.cuit) : null;

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      {/* Banner de Auditoría para Ente Regulador */}
      {user?.rol === "ente_regulador" && (
        <div className="bg-slate-900 text-white px-4 sm:px-6 py-2 text-xs flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 z-50">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 font-black text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded border border-amber-400/20">
              <ShieldCheck className="h-3.5 w-3.5" /> MODO AUDITORÍA (SOLO LECTURA)
            </span>
            <span className="text-slate-400 hidden sm:inline">•</span>
            <span className="text-slate-300 font-medium hidden sm:inline">
              Organismo: <strong className="text-white">{user.nombre_completo}</strong>
            </span>
          </div>
          <Link
            href="/ente/dashboard"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-white hover:text-blue-300 bg-white/10 hover:bg-white/20 px-3 py-1 rounded-lg transition-colors ml-auto cursor-pointer"
          >
            <LayoutDashboard className="h-3.5 w-3.5 text-blue-400" />
            <span>Ver todas las empresas asignadas</span>
          </Link>
        </div>
      )}

      {/* Header Desktop & Mobile */}
      <header className="sticky top-0 bg-white border-b border-slate-200 z-40 shadow-xs">
        <div className="w-full px-4 sm:px-6 lg:px-8 xl:px-10 h-16 flex items-center gap-3 lg:gap-5">
          {/* Logo */}
          <Link
            href="/dashboard"
            className="flex items-center gap-2 shrink-0 hover:opacity-90 transition-opacity cursor-pointer select-none"
          >
            <div className="h-9 w-9 rounded-lg overflow-hidden flex items-center justify-center shadow-xs bg-white">
              <img
                src="/login.jpg"
                alt="Logo"
                className="h-full w-full object-contain"
              />
            </div>
            <span className="font-bold text-[#1e3a8a] text-sm lg:text-base whitespace-nowrap">
              Legajo Técnico
            </span>
          </Link>

          {/* Navigation Links (Desktop) */}
          <nav className="hidden md:flex items-center gap-0.5 lg:gap-1 min-w-0 flex-1">
            {navItems.map((item) => {
              const isActive = pathname
                ? pathname === item.href || pathname.startsWith(item.href + "/")
                : false;
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`px-2.5 lg:px-3 py-2 rounded-md text-sm font-semibold whitespace-nowrap transition-all ${
                    item.disabled
                      ? "text-slate-400 cursor-not-allowed"
                      : isActive
                        ? "text-blue-600"
                        : "text-slate-500 hover:text-slate-800"
                  }`}
                  onClick={(e) => item.disabled && e.preventDefault()}
                >
                  {item.name}
                </Link>
              );
            })}
          </nav>

          {/* Right Side Info */}
          <div className="flex items-center gap-2 lg:gap-3 shrink-0 ml-auto">
            {/* Company Selector / Pill (Desktop) */}
            {localEmpresa && (
              <div className="hidden xl:flex relative">
                <button
                  onClick={() =>
                    puedeSeleccionarEmpresa &&
                    setShowEmpresaSelector(!showEmpresaSelector)
                  }
                  className={`flex items-center gap-2 bg-slate-100 border border-slate-200 px-3 py-1.5 rounded-full text-xs font-semibold text-slate-700 transition-all max-w-[340px] ${
                    puedeSeleccionarEmpresa
                      ? "hover:bg-slate-200 hover:border-slate-300 cursor-pointer"
                      : ""
                  }`}
                  title={`${localEmpresa.razon_social}${localSucursal ? ` · Sucursal: ${localSucursal}` : ""} · ${localEmpresa.cuit}`}
                >
                  <Building2 className="h-3.5 w-3.5 text-blue-600 shrink-0" />
                  <span className="truncate font-bold text-slate-900">{localEmpresa.razon_social}</span>
                  {localSucursal ? (
                    <span className="inline-flex items-center gap-0.5 bg-blue-600 text-white font-extrabold text-[10px] px-1.5 py-0.5 rounded shadow-2xs shrink-0">
                      <GitBranch className="h-2.5 w-2.5" />
                      {localSucursal}
                    </span>
                  ) : null}
                  <span className="text-slate-300 shrink-0">•</span>
                  <span className="text-slate-500 shrink-0 tabular-nums text-[11px]">
                    {formatCuitDisplay(getBaseCuit(localEmpresa.cuit))}
                  </span>
                  {puedeSeleccionarEmpresa && (
                    <ChevronDown
                      className={`h-3.5 w-3.5 text-slate-400 shrink-0 transition-transform ${showEmpresaSelector ? "rotate-180" : ""}`}
                    />
                  )}
                </button>
              </div>
            )}

            {/* Notification Bell */}
            <NotificationBell />

            {/* User Avatar & Name */}
            <Link
              href="/configuracion"
              className="flex items-center gap-2 border-l border-slate-200 pl-2.5 lg:pl-3 hover:text-blue-600 transition-colors cursor-pointer min-w-0"
            >
              <div className="h-8 w-8 rounded-full bg-brand-primary text-white flex items-center justify-center text-xs font-bold shrink-0">
                {getInitials(user.nombre_completo || "Usuario")}
              </div>
              <span className="text-sm font-bold text-slate-800 hidden 2xl:block truncate max-w-[160px]">
                {user.nombre_completo}
              </span>
            </Link>

            {/* Logout */}
            <button
              onClick={logout}
              className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors cursor-pointer shrink-0"
              title="Cerrar sesión"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Barra de Sucursal & Empresa Activa en Celular y Tablet */}
      {localEmpresa && (
        <div className="xl:hidden bg-slate-50/80 border-b border-slate-200/70 px-3.5 sm:px-6 py-2">
          <button
            type="button"
            onClick={() => puedeSeleccionarEmpresa && setShowEmpresaSelector(true)}
            disabled={!puedeSeleccionarEmpresa}
            className={`w-full group rounded-xl border transition-all text-left flex items-center justify-between gap-2.5 p-2.5 ${
              puedeSeleccionarEmpresa
                ? "bg-white hover:bg-blue-50/30 border-slate-200 hover:border-blue-300 shadow-2xs active:scale-[0.99] cursor-pointer"
                : "bg-white/95 border-slate-200/80 shadow-2xs"
            }`}
          >
            <div className="flex items-center gap-2.5 min-w-0 flex-1">
              <div className="relative h-9 w-9 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white flex items-center justify-center shrink-0 shadow-xs shadow-blue-500/25">
                <Building2 className="h-4.5 w-4.5" />
                {localSucursal && (
                  <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 bg-emerald-400 rounded-full border-2 border-white" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="text-xs font-black text-slate-900 tracking-tight truncate">
                    {localEmpresa.razon_social}
                  </span>
                  {localSucursal ? (
                    <span className="inline-flex items-center gap-0.5 bg-blue-600 text-white font-black text-[10px] px-1.5 py-0.5 rounded shadow-2xs shrink-0 tracking-wide">
                      <GitBranch className="h-2.5 w-2.5" />
                      {localSucursal}
                    </span>
                  ) : (
                    <span className="inline-flex items-center text-[10px] font-semibold text-slate-500 bg-slate-100 border border-slate-200/80 px-1.5 py-0.2 rounded shrink-0">
                      Sede Principal
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1.5 text-[11px] text-slate-500 font-medium truncate mt-0.5">
                  {localEmpresa.localidad && (
                    <span className="flex items-center gap-0.5 text-slate-600 font-semibold truncate">
                      <MapPin className="h-2.5 w-2.5 text-slate-400 shrink-0" />
                      {localEmpresa.localidad}
                    </span>
                  )}
                  {localEmpresa.localidad && <span className="text-slate-300">•</span>}
                  <span className="text-slate-400 font-mono text-[10px]">
                    {formatCuitDisplay(getBaseCuit(localEmpresa.cuit))}
                  </span>
                </div>
              </div>
            </div>
            {puedeSeleccionarEmpresa && (
              <div className="flex items-center gap-1 text-[11px] font-bold text-blue-700 bg-blue-50 group-hover:bg-blue-100/80 border border-blue-200/60 px-2.5 py-1.5 rounded-lg shrink-0 transition-colors shadow-2xs">
                <span>Cambiar</span>
                <ChevronDown className="h-3 w-3 stroke-2.5 transition-transform group-hover:translate-y-0.5" />
              </div>
            )}
          </button>
        </div>
      )}

      {localEmpresa?.estado === "aviso_deuda" && (
        <div className="border-b border-amber-200 bg-amber-50">
          <div className="w-full px-4 sm:px-6 lg:px-8 xl:px-10 py-3 flex items-start gap-3">
            <div className="h-8 w-8 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
              <AlertTriangle className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-black text-amber-900">
                Aviso de deuda
              </p>
              <p className="text-xs text-amber-800 font-medium leading-relaxed mt-0.5">
                La empresa <strong>{localEmpresa.razon_social}</strong> tiene
                un aviso de deuda pendiente. Por favor contactá a tu consultora
                para regularizar la situación.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 w-full px-4 sm:px-6 lg:px-8 xl:px-10 py-6 pb-24 md:pb-8">
        {children}
      </main>

      {/* Modal / Selector de Empresa o Sucursal (Desktop y Mobile) */}
      {showEmpresaSelector && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/75 backdrop-blur-sm transition-opacity animate-in fade-in duration-200">
          <div
            className="fixed inset-0"
            onClick={() => setShowEmpresaSelector(false)}
          />
          <div className="relative w-full sm:max-w-lg bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl z-10 max-h-[85vh] flex flex-col border border-slate-200 overflow-hidden animate-in slide-in-from-bottom sm:zoom-in-95 duration-200 pb-8 sm:pb-0">
            {/* Grab handle for mobile */}
            <div className="w-12 h-1.5 rounded-full bg-slate-200 mx-auto mt-3 mb-1 sm:hidden shrink-0" />

            <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-base font-black text-slate-900 tracking-tight">
                  Cambiar sucursal / empresa
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Seleccioná la sede sobre la que querés operar
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowEmpresaSelector(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="overflow-y-auto p-4 space-y-2.5 max-h-[60vh]">
              {misEmpresas.map((emp) => {
                const suc = emp.cuit ? getSucursalLabel(emp.cuit) : null;
                const isSelected = (empresa?.id || localEmpresa?.id) === emp.id;
                return (
                  <button
                    key={emp.id}
                    onClick={() => handleSeleccionarEmpresa(emp)}
                    className={`w-full text-left p-3.5 rounded-2xl flex items-center gap-3.5 transition-all cursor-pointer ${
                      isSelected
                        ? "bg-blue-50/90 border-2 border-blue-600 text-blue-950 shadow-xs"
                        : "bg-slate-50/60 hover:bg-slate-100/90 border border-slate-200/80 hover:border-slate-300"
                    }`}
                  >
                    <div
                      className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 shadow-xs ${
                        isSelected
                          ? "bg-blue-600 text-white shadow-blue-500/25"
                          : "bg-white text-slate-600 border border-slate-200"
                      }`}
                    >
                      <Building2 className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <p className="text-sm font-bold text-slate-900 line-clamp-1">
                          {emp.razon_social}
                        </p>
                        {suc ? (
                          <span className="inline-flex items-center gap-1 bg-blue-600 text-white font-extrabold text-[10px] px-1.5 py-0.5 rounded shadow-2xs tracking-wide">
                            <GitBranch className="h-2.5 w-2.5" />
                            {suc}
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold text-slate-500 bg-slate-100 border border-slate-200 px-1.5 py-0.2 rounded">
                            Principal
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium truncate mt-1">
                        {emp.localidad && (
                          <span className="flex items-center gap-0.5 text-slate-600 font-semibold truncate">
                            <MapPin className="h-3 w-3 text-slate-400 shrink-0" />
                            {emp.localidad}
                          </span>
                        )}
                        {emp.localidad && <span className="text-slate-300">•</span>}
                        <span className="text-slate-400 font-mono text-[11px]">
                          CUIT {formatCuitDisplay(getBaseCuit(emp.cuit))}
                        </span>
                      </div>
                    </div>
                    {isSelected ? (
                      <div className="h-6 w-6 rounded-full bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-sm shadow-blue-500/30">
                        <Check className="h-3.5 w-3.5 stroke-3" />
                      </div>
                    ) : (
                      <div className="h-6 w-6 rounded-full border border-slate-300 shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Navigation Mobile */}
      <BottomNav />
    </div>
  );
}
