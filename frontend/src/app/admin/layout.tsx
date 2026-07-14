"use client";

import React, { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import {
  ShieldCheck,
  Shield,
  LayoutDashboard,
  Building2,
  Users,
  Archive,
  BarChart3,
  LogOut,
  Menu,
  X,
  FileText,
  Settings,
  History,
} from "lucide-react";
import { NotificationBell } from "@/components/notification-bell";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    if (!loading) {
      if (!user) {
        router.push("/login");
      } else if (user.rol !== "admin") {
        router.push("/dashboard");
      }
    }
  }, [user, loading, router]);

  if (loading || !user || user.rol !== "admin") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-brand-secondary"></div>
        <p className="mt-4 text-xs text-brand-text-muted font-bold">
          Cargando panel de administración...
        </p>
      </div>
    );
  }

  const menuItems = [
    { name: "Dashboard", href: "/admin/dashboard", icon: LayoutDashboard },
    { name: "Empresas", href: "/admin/empresas", icon: Building2 },
    { name: "Usuarios", href: "/admin/usuarios", icon: Users },
    { name: "Plantillas", href: "/admin/plantillas", icon: FileText },
    { name: "Auditoría", href: "/admin/auditoria", icon: History },
    { name: "Archivo Histórico", href: "/admin/archivo", icon: Archive },
    { name: "Métricas", href: "/admin/metricas", icon: BarChart3 },
    { name: "Ente Regulador", href: "/admin/ente-regulador", icon: Shield },
    { name: "Configuración", href: "/admin/configuracion", icon: Settings },
  ];

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div className="min-h-screen flex bg-slate-50">
      {/* Sidebar Desktop */}
      <aside className="hidden md:flex flex-col w-64 bg-brand-dark text-white shrink-0 border-r border-slate-900">
        {/* Header Logo */}
        <div className="h-20 flex items-center gap-3 px-6 border-b border-slate-900">
          <div className="h-10 w-10 rounded-xl overflow-hidden flex items-center justify-center shadow-md shrink-0 bg-slate-100">
            <img src="/login.jpg" alt="Logo" className="h-full w-full object-cover" />
          </div>
          <div>
            <span className="font-extrabold text-sm text-white block leading-tight">
              Legajo Técnico
            </span>
            <span className="text-[10px] font-bold text-brand-text-light block mt-0.5">
              Panel Administrativo
            </span>
          </div>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 px-4 py-6 space-y-1">
          {menuItems.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-4 py-3.5 rounded-xl text-xs font-bold transition-all ${
                  isActive
                    ? "bg-brand-secondary text-white shadow-lg shadow-brand-secondary/20"
                    : "text-brand-text-light hover:text-white hover:bg-slate-900/50"
                }`}
              >
                <Icon className="h-4.5 w-4.5 shrink-0" />
                {item.name}
              </Link>
            );
          })}
        </nav>

        {/* User profile / Footer */}
        <div className="p-4 border-t border-slate-900 flex items-center justify-between gap-3 bg-slate-950/20">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="h-9 w-9 rounded-full bg-brand-secondary text-white flex items-center justify-center text-xs font-bold shrink-0">
              {getInitials(user.nombre_completo || "Admin")}
            </div>
            <div className="min-w-0">
              <span className="text-xs font-bold text-slate-200 block truncate leading-tight">
                {user.nombre_completo}
              </span>
              <span className="text-[10px] font-semibold text-brand-text-light block mt-0.5 leading-tight truncate">
                Administrador
              </span>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <NotificationBell />
            <button
              onClick={logout}
              className="p-2 text-brand-text-light hover:text-red-400 hover:bg-slate-900/50 rounded-lg transition-colors cursor-pointer shrink-0"
              title="Cerrar sesión"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile Top Header */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-16 bg-brand-dark text-white flex items-center justify-between px-4 z-40 border-b border-slate-900">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg overflow-hidden flex items-center justify-center bg-slate-100">
            <img src="/login.jpg" alt="Logo" className="h-full w-full object-cover" />
          </div>
          <span className="font-bold text-xs uppercase tracking-wider">
            CRM
          </span>
        </div>

        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="p-2 text-brand-text-light hover:text-white transition-colors"
        >
          {mobileMenuOpen ? (
            <X className="h-6 w-6" />
          ) : (
            <Menu className="h-6 w-6" />
          )}
        </button>
      </div>

      {/* Mobile Sidebar Backdrop */}
      {mobileMenuOpen && (
        <div
          className="md:hidden fixed inset-0 bg-black/50 z-40 transition-opacity"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Mobile Drawer */}
      <aside
        className={`md:hidden fixed top-0 bottom-0 left-0 w-64 bg-brand-dark text-white z-50 transform transition-transform duration-300 ease-in-out border-r border-slate-900 ${
          mobileMenuOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="h-16 flex items-center gap-2 px-6 border-b border-slate-900">
          <div className="h-8 w-8 rounded-lg overflow-hidden flex items-center justify-center bg-slate-100">
            <img src="/login.jpg" alt="Logo" className="h-full w-full object-cover" />
          </div>
          <span className="font-bold text-sm text-blue-100 uppercase">
            Legajo Técnico
          </span>
        </div>

        <nav className="flex-1 px-4 py-6 space-y-1.5 overflow-y-auto h-[calc(100vh-140px)]">
          {menuItems.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold transition-all ${
                  isActive
                    ? "bg-brand-secondary text-white shadow-md"
                    : "text-brand-text-light hover:text-white hover:bg-slate-900"
                }`}
                onClick={() => setMobileMenuOpen(false)}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {item.name}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-900 flex items-center justify-between gap-3 absolute bottom-0 left-0 right-0 bg-slate-950">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="h-8 w-8 rounded-full bg-brand-secondary text-white flex items-center justify-center text-xs font-bold shrink-0">
              {getInitials(user.nombre_completo || "Admin")}
            </div>
            <div className="min-w-0">
              <span className="text-xs font-bold text-slate-200 block truncate leading-tight">
                {user.nombre_completo}
              </span>
            </div>
          </div>
          <button
            onClick={logout}
            className="p-2 text-brand-text-light hover:text-red-400 rounded-lg transition-colors cursor-pointer shrink-0"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 pt-16 md:pt-0 overflow-y-auto">
        <div className="flex-1 p-6 md:p-8 max-w-7xl w-full mx-auto pb-12">
          {children}
        </div>
      </main>
    </div>
  );
}
