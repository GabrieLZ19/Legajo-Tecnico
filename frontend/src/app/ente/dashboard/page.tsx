"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Building2, FileText, GraduationCap, HardHat, AlertTriangle } from "lucide-react";

type DashboardEnte = {
  totalEmpresas: number;
  totalInformes: number;
  totalCapacitaciones: number;
  totalEntregasEpp: number;
  observacionesAbiertas: number;
  empresas: Array<{
    empresa_id: string;
    permisos: Record<string, boolean>;
    empresa: { razon_social?: string; cuit?: string } | null;
  }>;
};

export default function EnteDashboardPage() {
  const [data, setData] = useState<DashboardEnte | null>(null);

  useEffect(() => {
    api.get("/ente/dashboard").then((res) => setData(res.data)).catch(console.error);
  }, []);

  if (!data) {
    return <p className="text-sm font-bold text-slate-400">Cargando tablero...</p>;
  }

  const cards = [
    { label: "Empresas", value: data.totalEmpresas, icon: Building2 },
    { label: "Informes", value: data.totalInformes, icon: FileText },
    { label: "Capacitaciones", value: data.totalCapacitaciones, icon: GraduationCap },
    { label: "Entregas EPP", value: data.totalEntregasEpp, icon: HardHat },
    { label: "Obs. abiertas", value: data.observacionesAbiertas, icon: AlertTriangle },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black text-slate-900">Estado de seguridad e higiene</h1>
        <p className="text-sm text-slate-500">Información habilitada por el administrador.</p>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.label} className="bg-white rounded-3xl border p-5">
              <Icon className="h-4 w-4 text-blue-700 mb-3" />
              <p className="text-2xl font-black text-slate-900">{card.value}</p>
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                {card.label}
              </p>
            </div>
          );
        })}
      </div>
      <div className="bg-white rounded-3xl border divide-y">
        {data.empresas.map((row) => (
          <div key={row.empresa_id} className="px-5 py-4">
            <p className="text-sm font-bold text-slate-800">
              {row.empresa?.razon_social || row.empresa_id}
            </p>
            <p className="text-[11px] text-slate-400">
              Módulos: {Object.entries(row.permisos)
                .filter(([, v]) => v)
                .map(([k]) => k)
                .join(" · ") || "ninguno"}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
