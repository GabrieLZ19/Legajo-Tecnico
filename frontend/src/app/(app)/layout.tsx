"use client";

import React, { useEffect, useState } from "react";
import { useAuth, getMisEmpresas } from "@/hooks/useAuth";
import { getEmpresaDetalle } from "@/hooks/useAdminEmpresas";
import { useRouter, usePathname } from "next/navigation";
import BottomNav from "@/components/BottomNav.FC";
import Link from "next/link";
import { Empresa } from "@/types";
import { LogOut, Building2, ChevronDown } from "lucide-react";
import { NotificationBell } from "@/components/notification-bell";
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

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
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
            {/* Company Selector / Pill */}
            {localEmpresa && (
              <div className="hidden xl:flex relative max-w-[280px]">
                <button
                  onClick={() =>
                    puedeSeleccionarEmpresa &&
                    setShowEmpresaSelector(!showEmpresaSelector)
                  }
                  className={`flex items-center gap-2 bg-slate-100 border border-slate-200 px-3 py-1.5 rounded-full text-xs font-semibold text-slate-700 transition-all max-w-full ${
                    puedeSeleccionarEmpresa
                      ? "hover:bg-slate-200 hover:border-slate-300 cursor-pointer"
                      : ""
                  }`}
                  title={`${localEmpresa.razon_social} · ${localEmpresa.cuit}`}
                >
                  <Building2 className="h-3.5 w-3.5 text-blue-600 shrink-0" />
                  <span className="truncate">{localEmpresa.razon_social}</span>
                  <span className="text-slate-300 shrink-0">•</span>
                  <span className="text-slate-500 shrink-0 tabular-nums">
                    {localEmpresa.cuit}
                  </span>
                  {puedeSeleccionarEmpresa && (
                    <ChevronDown
                      className={`h-3.5 w-3.5 text-slate-400 shrink-0 transition-transform ${showEmpresaSelector ? "rotate-180" : ""}`}
                    />
                  )}
                </button>

                {/* Dropdown de empresas */}
                {showEmpresaSelector && (
                  <>
                    <div
                      className="fixed inset-0 z-40"
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowEmpresaSelector(false);
                      }}
                    />
                    <div className="absolute top-full right-0 mt-2 w-80 bg-white border border-slate-200 rounded-xl shadow-xl z-50 py-2 max-h-64 overflow-y-auto">
                      <div className="px-3 py-2 border-b border-slate-100">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                          Cambiar empresa activa
                        </p>
                      </div>
                      {misEmpresas.map((emp) => (
                        <button
                          key={emp.id}
                          onClick={() => handleSeleccionarEmpresa(emp)}
                          className={`w-full text-left px-3 py-2.5 flex items-center gap-3 hover:bg-blue-50 transition-colors cursor-pointer ${
                            empresa?.id === emp.id
                              ? "bg-blue-50 border-l-2 border-blue-600"
                              : ""
                          }`}
                        >
                          <div className="h-8 w-8 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                            <Building2 className="h-4 w-4 text-blue-600" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-bold text-slate-800 truncate">
                              {emp.razon_social}
                            </p>
                            <p className="text-[11px] text-slate-500 font-medium">
                              CUIT: {emp.cuit}
                            </p>
                          </div>
                          {empresa?.id === emp.id && (
                            <div className="ml-auto h-2 w-2 rounded-full bg-blue-600 shrink-0" />
                          )}
                        </button>
                      ))}
                    </div>
                  </>
                )}
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

      {/* Main Content Area */}
      <main className="flex-1 w-full px-4 sm:px-6 lg:px-8 xl:px-10 py-6 pb-24 md:pb-8">
        {children}
      </main>

      {/* Navigation Mobile */}
      <BottomNav />
    </div>
  );
}
