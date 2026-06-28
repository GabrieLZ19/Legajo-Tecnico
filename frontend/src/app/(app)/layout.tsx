"use client";

import React, { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useRouter, usePathname } from "next/navigation";
import BottomNav from "@/components/BottomNav.FC";
import Link from "next/link";
import { api } from "@/lib/api";
import {
  LogOut,
  User,
  Briefcase,
  Bell,
  ShieldCheck,
  Building2,
  Home,
} from "lucide-react";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, empresa, loading, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const [localEmpresa, setLocalEmpresa] = useState<any>(null);

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
    { name: "EPP", href: "#", disabled: true },
    { name: "Capacitaciones", href: "#", disabled: true },
  ];

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
              const isActive = pathname === item.href;
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
            {/* Company Pill */}
            {localEmpresa && (
              <div className="hidden lg:flex items-center gap-2 bg-slate-100 border border-slate-200 px-3.5 py-1.5 rounded-full text-xs font-semibold text-slate-700">
                <Building2 className="h-3.5 w-3.5 text-blue-600" />
                <span>{localEmpresa.razon_social}</span>
                <span className="text-slate-300">•</span>
                <span className="text-slate-500">{localEmpresa.cuit}</span>
              </div>
            )}

            {/* Notification Bell */}
            <button className="p-2 text-slate-400 hover:text-slate-600 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-full transition-all cursor-pointer">
              <Bell className="h-4 w-4" />
            </button>

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
