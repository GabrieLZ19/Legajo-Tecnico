"use client";

import React, { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { api } from "@/lib/api";
import { Capacitacion } from "@/types";
import Link from "next/link";
import {
  GraduationCap,
  Plus,
  Users,
  HelpCircle,
  ChevronRight,
  Calendar,
} from "lucide-react";

export default function CapacitacionesPage() {
  const { user, empresa } = useAuth();
  const [capacitaciones, setCapacitaciones] = useState<Capacitacion[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroEstado, setFiltroEstado] = useState<string>("todas");

  const canCreate = user?.rol === "preventor" || user?.rol === "admin";

  useEffect(() => {
    if (empresa?.id) {
      fetchCapacitaciones();
    }
  }, [empresa?.id]);

  const fetchCapacitaciones = async () => {
    setLoading(true);
    try {
      const { data } = await api.get(`/capacitaciones?empresa_id=${empresa!.id}`);
      setCapacitaciones(data.capacitaciones || []);
    } catch (err) {
      console.error("Error cargando capacitaciones:", err);
    } finally {
      setLoading(false);
    }
  };

  const estadoColor = (estado: string) => {
    switch (estado) {
      case "activa":
        return "bg-emerald-50 text-emerald-700 border-emerald-100";
      case "borrador":
        return "bg-amber-50 text-amber-700 border-amber-100";
      case "cerrada":
        return "bg-slate-100 text-slate-600 border-slate-200";
      default:
        return "bg-slate-100 text-slate-600 border-slate-200";
    }
  };

  const filtered = filtroEstado === "todas"
    ? capacitaciones
    : capacitaciones.filter((c) => c.estado === filtroEstado);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <span className="text-sm font-semibold text-slate-500 flex items-center gap-1.5">
            <GraduationCap className="h-4 w-4" /> Módulo de Capacitaciones
          </span>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight mt-1">
            Capacitaciones
          </h1>
        </div>
        {canCreate && (
          <Link
            href="/capacitaciones/nuevo"
            className="inline-flex items-center justify-center gap-2 bg-brand-primary hover:bg-brand-primary/95 text-white font-bold px-5 py-3 rounded-xl shadow-md shadow-blue-900/10 hover:shadow-lg transition-all text-sm cursor-pointer"
          >
            <Plus className="h-4 w-4 stroke-3" />
            Nueva Capacitación
          </Link>
        )}
      </div>

      {/* Filtros */}
      <div className="flex gap-2 flex-wrap">
        {[
          { key: "todas", label: "Todas" },
          { key: "activa", label: "Activas" },
          { key: "borrador", label: "Borradores" },
          { key: "cerrada", label: "Cerradas" },
        ].map((f) => (
          <button
            key={f.key}
            onClick={() => setFiltroEstado(f.key)}
            className={`px-4 py-2 rounded-full text-xs font-bold transition-all cursor-pointer ${
              filtroEstado === f.key
                ? "bg-blue-600 text-white shadow-md"
                : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Lista */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 bg-white border border-slate-200 rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center">
          <GraduationCap className="h-12 w-12 text-slate-300 mx-auto mb-4" />
          <p className="text-sm text-slate-500 font-semibold">
            No hay capacitaciones registradas.
          </p>
          {canCreate && (
            <Link
              href="/capacitaciones/nuevo"
              className="inline-flex items-center gap-2 text-sm font-bold text-blue-600 mt-3 hover:underline"
            >
              <Plus className="h-4 w-4" />
              Crear la primera capacitación
            </Link>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((cap) => (
            <Link
              key={cap.id}
              href={`/capacitaciones/${cap.id}`}
              className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs hover:border-slate-300 hover:shadow-md transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 group cursor-pointer"
            >
              <div className="flex items-start sm:items-center gap-4 min-w-0">
                <div className="h-11 w-11 rounded-xl bg-purple-50 flex items-center justify-center shrink-0">
                  <GraduationCap className="h-6 w-6 text-purple-600" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm font-bold text-slate-800 group-hover:text-blue-600 transition-colors truncate">
                    {cap.titulo}
                  </h3>
                  <div className="flex flex-wrap items-center gap-y-1.5 gap-x-3 mt-1.5">
                    <span className="text-[11px] text-slate-400 font-semibold flex items-center gap-1 shrink-0">
                      <Calendar className="h-3.5 w-3.5" />
                      {new Date(cap.fecha).toLocaleDateString("es-AR")}
                    </span>
                    <span className="text-[11px] text-slate-400 font-semibold flex items-center gap-1 shrink-0">
                      <HelpCircle className="h-3.5 w-3.5" />
                      {cap.total_preguntas || 0} preguntas
                    </span>
                    <span className="text-[11px] text-slate-400 font-semibold flex items-center gap-1 shrink-0">
                      <Users className="h-3.5 w-3.5" />
                      {cap.total_asistencias || 0} asistencias
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 border-t border-slate-100 sm:border-t-0 pt-3 sm:pt-0">
                <span
                  className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider border ${estadoColor(
                    cap.estado
                  )}`}
                >
                  {cap.estado}
                </span>
                <ChevronRight className="h-5 w-5 text-slate-300 group-hover:text-slate-500 transition-colors hidden sm:block" />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
