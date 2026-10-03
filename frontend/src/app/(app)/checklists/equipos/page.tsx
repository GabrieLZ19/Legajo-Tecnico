"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  ChevronRight,
  Loader,
  Plus,
  QrCode,
  Search,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { canWriteAppModule } from "@/lib/moduleAccess";
import { checklistsService } from "@/utils/services/checklists.service";

export default function EquiposPage() {
  const { user, empresa } = useAuth();
  const canWrite = canWriteAppModule(user, "checklists");
  const [q, setQ] = useState("");
  const [soloActivos, setSoloActivos] = useState(false);

  const { data: equipos = [], isLoading } = useQuery({
    queryKey: ["checklists-equipos", empresa?.id, "todos"],
    queryFn: () => checklistsService.listarEquipos(empresa!.id, true),
    enabled: !!empresa?.id,
  });

  const filtrados = useMemo(() => {
    return equipos.filter((eq) => {
      if (soloActivos && !eq.activo) return false;
      if (!q.trim()) return true;
      const needle = q.trim().toLowerCase();
      return (
        eq.nombre.toLowerCase().includes(needle) ||
        eq.tipo_equipo.toLowerCase().includes(needle) ||
        (eq.codigo_interno || "").toLowerCase().includes(needle) ||
        (eq.ubicacion || "").toLowerCase().includes(needle)
      );
    });
  }, [equipos, q, soloActivos]);

  return (
    <div className="w-full space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <Link
            href="/checklists"
            className="inline-flex items-center gap-1 text-sm font-semibold text-slate-500 hover:text-brand-primary mb-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Checklists
          </Link>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">
            Equipos
          </h1>
          <p className="text-sm text-brand-text-muted mt-1">
            Alta con código QR identificatorio para inspección móvil.
          </p>
        </div>
        {canWrite && (
          <Link
            href="/checklists/equipos/nuevo"
            className="inline-flex items-center justify-center gap-2 bg-brand-primary hover:bg-brand-primary/95 text-white font-bold px-5 py-3 rounded-xl shadow-md text-sm cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            Nuevo equipo
          </Link>
        )}
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por nombre, tipo, código o ubicación…"
            className="w-full pl-10 pr-3 py-2.5 rounded-xl border border-slate-200 bg-brand-input-bg text-sm"
          />
        </div>
        <button
          type="button"
          onClick={() => setSoloActivos((v) => !v)}
          className={`px-4 py-2 rounded-xl text-xs font-bold border cursor-pointer ${
            soloActivos
              ? "bg-brand-primary text-white border-brand-primary"
              : "bg-white text-slate-600 border-slate-200"
          }`}
        >
          Solo activos
        </button>
      </div>

      <section className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-2xs">
        {isLoading ? (
          <div className="flex justify-center py-16 text-slate-400">
            <Loader className="h-6 w-6 animate-spin" />
          </div>
        ) : filtrados.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <QrCode className="h-10 w-10 text-slate-300 mx-auto mb-3" />
            <p className="text-sm font-bold text-slate-700">
              No hay equipos para mostrar
            </p>
            {canWrite && (
              <Link
                href="/checklists/equipos/nuevo"
                className="inline-flex mt-3 text-sm font-bold text-brand-secondary hover:underline"
              >
                Crear el primero
              </Link>
            )}
          </div>
        ) : (
          <ul className="divide-y divide-slate-50">
            {filtrados.map((eq) => (
              <li key={eq.id}>
                <Link
                  href={`/checklists/equipos/${eq.id}`}
                  className="flex items-center justify-between px-5 py-4 hover:bg-slate-50 group"
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="h-10 w-10 rounded-xl bg-orange-50 border border-orange-100 text-orange-600 flex items-center justify-center shrink-0">
                      <QrCode className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-slate-900 group-hover:text-brand-secondary">
                        {eq.nombre}
                        {!eq.activo && (
                          <span className="ml-2 text-[10px] font-bold text-slate-400 uppercase">
                            Inactivo
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {eq.tipo_equipo}
                        {eq.codigo_interno ? ` · ${eq.codigo_interno}` : ""}
                        {eq.ubicacion ? ` · ${eq.ubicacion}` : ""}
                      </p>
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-slate-300" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
