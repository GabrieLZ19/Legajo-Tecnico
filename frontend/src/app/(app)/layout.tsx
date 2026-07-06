"use client";

import React, { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useRouter, usePathname } from "next/navigation";
import BottomNav from "@/components/BottomNav.FC";
import Link from "next/link";
import { api } from "@/lib/api";
import { Empresa } from "@/types";
import {
  LogOut,
  User,
  Briefcase,
  Bell,
  ShieldCheck,
  Building2,
  Home,
  ChevronDown,
} from "lucide-react";
import { NotificationBell } from "@/components/notification-bell";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, empresa, loading, logout, cambiarEmpresaContexto } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const [localEmpresa, setLocalEmpresa] = useState<any>(null);
  const [misEmpresas, setMisEmpresas] = useState<Empresa[]>([]);
  const [showEmpresaSelector, setShowEmpresaSelector] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (empresa) {
      if (!empresa.razon_social) {
        const fetchEmpresa = async () => {
          try {
            const { data } = await api.get(`/empresas/${empresa.id}`);
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
    if (user && (user.rol === 'preventor' || user.rol === 'admin')) {
      const fetchEmpresas = async () => {
        try {
          const { data } = await api.get('/auth/mis-empresas');
          setMisEmpresas(data.empresas || []);
        } catch (err) {
          console.error("Error loading mis-empresas:", err);
        }
      };
      fetchEmpresas();
    }
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
    { name: "Inicio", href: "/dashboard" },
    { name: "Informes", href: "/informes" },
    { name: "Plan de Acción", href: "/plan-accion" },
    { name: "EPP", href: "/epp", disabled: false },
    { name: "Capacitaciones", href: "/capacitaciones", disabled: false },
  ];

  const handleSeleccionarEmpresa = (emp: Empresa) => {
    cambiarEmpresaContexto(emp);
    setLocalEmpresa(emp);
    setShowEmpresaSelector(false);
  };

  const puedeSeleccionarEmpresa = misEmpresas.length > 1;

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      {/* Header Desktop & Mobile */}
      <header className="sticky top-0 bg-white border-b border-slate-200 z-40 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          {/* Logo */}
          <Link
            href="/dashboard"
            className="flex items-center gap-2 shrink-0 hover:opacity-90 transition-opacity cursor-pointer select-none"
          >
            <div className="h-9 w-9 rounded-lg bg-blue-600 flex items-center justify-center shadow-xs">
              <ShieldCheck className="h-5 w-5 text-white" />
            </div>
            <span className="font-bold text-[#1e3a8a] text-sm sm:text-md md:text-lg block">
              Legajo Técnico
            </span>
          </Link>

          {/* Navigation Links (Desktop) */}
          <nav className="hidden md:flex items-center space-x-1 ml-6">
            {navItems.map((item) => {
              const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`px-3 py-2 rounded-md text-sm font-semibold transition-all ${
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
          <div className="flex items-center gap-3 ml-auto">
            {/* Company Selector / Pill */}
            {localEmpresa && (
              <div className="hidden lg:flex relative">
                <button
                  onClick={() => puedeSeleccionarEmpresa && setShowEmpresaSelector(!showEmpresaSelector)}
                  className={`flex items-center gap-2 bg-slate-100 border border-slate-200 px-3.5 py-1.5 rounded-full text-xs font-semibold text-slate-700 transition-all ${
                    puedeSeleccionarEmpresa
                      ? "hover:bg-slate-200 hover:border-slate-300 cursor-pointer"
                      : ""
                  }`}
                >
                  <Building2 className="h-3.5 w-3.5 text-blue-600" />
                  <span>{localEmpresa.razon_social}</span>
                  <span className="text-slate-300">•</span>
                  <span className="text-slate-500">{localEmpresa.cuit}</span>
                  {puedeSeleccionarEmpresa && (
                    <ChevronDown className={`h-3.5 w-3.5 text-slate-400 transition-transform ${showEmpresaSelector ? 'rotate-180' : ''}`} />
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
                            empresa?.id === emp.id ? "bg-blue-50 border-l-2 border-blue-600" : ""
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
              className="flex items-center gap-2 border-l border-slate-200 pl-3 hover:text-blue-600 transition-colors cursor-pointer"
            >
              <div className="h-8 w-8 rounded-full bg-brand-primary text-white flex items-center justify-center text-xs font-bold shrink-0">
                {getInitials(user.nombre_completo || "Usuario")}
              </div>
              <span className="text-sm font-bold text-slate-800 hidden sm:block">
                {user.nombre_completo}
              </span>
            </Link>

            {/* Logout */}
            <button
              onClick={logout}
              className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
              title="Cerrar sesión"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-24 md:pb-8">
        {children}
      </main>

      {/* Navigation Mobile */}
      <BottomNav />
    </div>
  );
}
