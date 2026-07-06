"use client";

import React, { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { api } from "@/lib/api";
import { EppEntrega, EppTipo } from "@/types";
import Link from "next/link";
import {
  HardHat,
  Plus,
  Download,
  Package,
  FileText,
  Layers,
  Calendar,
  ChevronRight,
  User,
} from "lucide-react";

type Tab = "entregas" | "catalogo" | "licitaciones";

const formatLocalDate = (dateStr: string | Date | null | undefined): string => {
  if (!dateStr) return "";
  const isoStr = typeof dateStr === "string" ? dateStr : new Date(dateStr).toISOString();
  const datePart = isoStr.split("T")[0];
  const parts = datePart.split("-");
  if (parts.length === 3) {
    const [year, month, day] = parts;
    return `${parseInt(day)}/${parseInt(month)}/${year}`;
  }
  return new Date(dateStr).toLocaleDateString("es-AR");
};

export default function EppPage() {
  const { user, empresa } = useAuth();
  const [tab, setTab] = useState<Tab>("entregas");
  const [entregas, setEntregas] = useState<EppEntrega[]>([]);
  const [tipos, setTipos] = useState<EppTipo[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const canCreate = user?.rol === "preventor" || user?.rol === "admin";

  useEffect(() => {
    if (empresa?.id) {
      fetchData();
    }
  }, [empresa?.id]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [entregasRes, tiposRes] = await Promise.all([
        api.get(`/epp/entregas?empresa_id=${empresa!.id}`),
        api.get("/epp/tipos"),
      ]);
      setEntregas(entregasRes.data.entregas || []);
      setTipos(tiposRes.data.tipos || []);
    } catch (err) {
      console.error("Error cargando datos:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadPdf = async (id: string, dni: string) => {
    setDownloadingId(id);
    try {
      const res = await api.get(`/epp/entregas/${id}/pdf`, { responseType: "blob" });
      const blob = new Blob([res.data], { type: "application/pdf" });
      const link = document.createElement("a");
      link.href = window.URL.createObjectURL(blob);
      link.download = `Constancia_SRT_299_${dni}.pdf`;
      link.click();
      window.URL.revokeObjectURL(link.href);
    } catch (err) {
      console.error("Error al descargar PDF:", err);
      alert("No se pudo descargar el PDF. Por favor, reintente.");
    } finally {
      setDownloadingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">
            Entrega de EPP (Res. SRT 299/11)
          </h1>
          <p className="text-slate-500 text-xs mt-1">
            Gestión y constancias de entrega de Elementos de Protección Personal
          </p>
        </div>

        {canCreate && tab === "entregas" && (
          <Link
            href="/epp/nueva-entrega"
            className="inline-flex items-center gap-2 px-5 py-3 bg-brand-primary hover:bg-brand-primary/95 text-white font-bold rounded-xl text-sm transition-all shadow-md shadow-blue-900/10 hover:shadow-lg self-start sm:self-auto cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            Registrar Entrega
          </Link>
        )}
      </div>

      {/* Tabs Selector */}
      <div className="flex border-b border-slate-200 gap-6">
        <button
          onClick={() => setTab("entregas")}
          className={`pb-3 text-sm font-bold border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
            tab === "entregas"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-slate-400 hover:text-slate-600"
          }`}
        >
          <FileText className="h-4 w-4" />
          Registro de Entregas
        </button>
        <button
          onClick={() => setTab("catalogo")}
          className={`pb-3 text-sm font-bold border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
            tab === "catalogo"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-slate-400 hover:text-slate-600"
          }`}
        >
          <Package className="h-4 w-4" />
          Catálogo EPP
        </button>
        <button
          onClick={() => setTab("licitaciones")}
          className={`pb-3 text-sm font-bold border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
            tab === "licitaciones"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-slate-400 hover:text-slate-600"
          }`}
        >
          <Layers className="h-4 w-4" />
          Licitación de EPP
        </button>
      </div>

      {/* Tab: Entregas */}
      {tab === "entregas" && (
        <div className="bg-white rounded-3xl border border-slate-100 p-6 shadow-2xs">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-600"></div>
              <p className="text-xs text-slate-400 mt-2 font-semibold">Cargando constancias...</p>
            </div>
          ) : entregas.length === 0 ? (
            <div className="text-center py-12">
              <div className="h-12 w-12 rounded-2xl bg-slate-50 flex items-center justify-center mx-auto mb-4">
                <FileText className="h-6 w-6 text-slate-400" />
              </div>
              <p className="text-slate-500 font-bold text-sm">No hay entregas registradas</p>
              <p className="text-slate-400 text-xs mt-1">Registrá la entrega de EPP para generar la constancia legal.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {entregas.map((e) => (
                <div
                  key={e.id}
                  className="py-4 first:pt-0 last:pb-0 flex items-center justify-between gap-4"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-slate-50 flex items-center justify-center shrink-0">
                      <HardHat className="h-5 w-5 text-slate-400" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-800 truncate">
                        {e.epp_tipos?.nombre || "EPP"}
                        {e.cantidad > 1 ? ` (x${e.cantidad})` : ""}
                      </h3>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-[11px] text-slate-400 font-semibold flex items-center gap-1">
                          <User className="h-3 w-3" />
                          {e.nombre_empleado} • DNI {e.dni_empleado}
                        </span>
                        <span className="text-[11px] text-slate-400 font-semibold flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {formatLocalDate(e.fecha_entrega)}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full uppercase tracking-wider border border-emerald-100">
                      {e.estado}
                    </span>
                    {e.pdf_url && (
                      <button
                        onClick={() => handleDownloadPdf(e.id, e.dni_empleado)}
                        disabled={downloadingId === e.id}
                        className="h-8 w-8 rounded-lg bg-blue-50 flex items-center justify-center hover:bg-blue-100 transition-colors cursor-pointer disabled:opacity-50"
                        title="Descargar PDF SRT 299/11"
                      >
                        <Download className="h-4 w-4 text-blue-600" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab: Catálogo */}
      {tab === "catalogo" && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider">
              Catálogo de EPP Disponibles
            </h2>
          </div>

          {tipos.length === 0 ? (
            <p className="text-sm text-slate-400 font-semibold">No hay tipos de EPP cargados.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {tipos.map((tipo) => (
                <div
                  key={tipo.id}
                  className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs"
                >
                  <div className="h-10 w-10 rounded-xl bg-emerald-50 flex items-center justify-center mb-3">
                    <HardHat className="h-5 w-5 text-emerald-600" />
                  </div>
                  <h3 className="text-sm font-bold text-slate-800">
                    {tipo.nombre}
                  </h3>
                  {tipo.descripcion && (
                    <span className="text-[10px] font-bold text-slate-400 mt-1 block">
                      {tipo.descripcion}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab: Licitaciones */}
      {tab === "licitaciones" && (
        <div className="bg-white rounded-3xl border border-slate-100 p-8 text-center shadow-2xs">
          <div className="h-12 w-12 rounded-2xl bg-amber-50 flex items-center justify-center mx-auto mb-4">
            <Layers className="h-6 w-6 text-amber-500" />
          </div>
          <h3 className="text-slate-800 font-bold text-sm">Licitaciones de Compra</h3>
          <p className="text-slate-400 text-xs max-w-sm mx-auto mt-2 leading-relaxed">
            Módulo para solicitar presupuestos de EPP a proveedores homologados según consumos proyectados.
          </p>
          <div className="mt-6 flex justify-center">
            <span className="px-4 py-1.5 bg-amber-50 border border-amber-100 rounded-full text-xs font-bold text-amber-800 uppercase tracking-wider">
              Feature Próximamente (Fase 4)
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
