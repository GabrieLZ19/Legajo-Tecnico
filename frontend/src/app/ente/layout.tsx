"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { Archive, LayoutDashboard, LogOut, Shield } from "lucide-react";

export default function EnteLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading) {
      if (!user) router.push("/login-admin");
      else if (user.rol !== "ente_regulador") router.push("/dashboard");
    }
  }, [user, loading, router]);

  if (loading || !user || user.rol !== "ente_regulador") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-blue-600" />
      </div>
    );
  }

  const items = [
    { href: "/ente/dashboard", label: "Tablero", icon: LayoutDashboard },
    { href: "/ente/archivo", label: "Archivo", icon: Archive },
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-40 bg-white border-b border-slate-200">
        <div className="max-w-6xl mx-auto h-16 px-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-blue-700" />
            <span className="font-black text-slate-900 text-sm">Ente regulador</span>
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
              Solo lectura
            </span>
          </div>
          <nav className="flex items-center gap-1">
            {items.map((item) => {
              const Icon = item.icon;
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`inline-flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold ${
                    active ? "bg-slate-900 text-white" : "text-slate-500 hover:bg-slate-100"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
            <button
              type="button"
              onClick={logout}
              className="ml-2 p-2 text-slate-400 hover:text-rose-500 cursor-pointer"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </nav>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-4 py-8">{children}</main>
    </div>
  );
}
