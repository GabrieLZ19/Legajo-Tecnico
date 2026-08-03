"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  BookOpen,
  Plus,
  Trash2,
  Edit2,
  HelpCircle,
  Loader2,
} from "lucide-react";
import { CapacitacionPlantilla } from "@/types";
import { useAuth } from "@/hooks/useAuth";
import { useCapacitacionPlantillas } from "@/hooks/useCapacitacionPlantillas";

export default function BibliotecaEmpresaPage() {
  const { empresa, user } = useAuth();
  const { listarPlantillas, eliminarPlantilla } = useCapacitacionPlantillas();
  const [plantillas, setPlantillas] = useState<CapacitacionPlantilla[]>([]);
  const [loading, setLoading] = useState(true);
  const canManage = user?.rol === "preventor" || user?.rol === "admin";

  const load = async () => {
    if (!empresa?.id) return;
    setLoading(true);
    try {
      const data = await listarPlantillas("empresa", empresa.id);
      setPlantillas(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [empresa?.id]);

  const handleDelete = async (id: string) => {
    if (!window.confirm("¿Eliminar esta plantilla de la biblioteca?")) return;
    try {
      await eliminarPlantilla(id);
      setPlantillas((prev) => prev.filter((p) => p.id !== id));
    } catch {
      alert("No se pudo eliminar la plantilla");
    }
  };

  return (
    <div className="space-y-6 w-full">
      <div className="flex items-center gap-4">
        <Link
          href="/capacitaciones"
          className="h-10 w-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center hover:bg-slate-50 shrink-0"
        >
          <ArrowLeft className="h-5 w-5 text-slate-600" />
        </Link>
        <div className="flex-1 min-w-0">
          <span className="text-sm font-semibold text-slate-500 flex items-center gap-1.5">
            <BookOpen className="h-4 w-4" /> Capacitaciones
          </span>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">
            Biblioteca de la empresa
          </h1>
          <p className="text-sm text-slate-500 mt-1 truncate">
            Plantillas propias de {empresa?.razon_social || "esta empresa"}
          </p>
        </div>
        {canManage && (
          <Link
            href="/capacitaciones/biblioteca/nueva"
            className="inline-flex items-center gap-2 bg-brand-primary text-white font-bold px-4 py-2.5 rounded-xl text-sm shrink-0"
          >
            <Plus className="h-4 w-4" />
            Nueva
          </Link>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-slate-500 gap-2">
          <Loader2 className="h-5 w-5 animate-spin" />
          Cargando...
        </div>
      ) : plantillas.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center">
          <BookOpen className="h-10 w-10 text-slate-300 mx-auto mb-3" />
          <p className="text-sm font-bold text-slate-700">
            La biblioteca de la empresa está vacía
          </p>
          {canManage && (
            <Link
              href="/capacitaciones/biblioteca/nueva"
              className="inline-flex items-center gap-2 text-sm font-bold text-blue-600 mt-3"
            >
              <Plus className="h-4 w-4" />
              Crear primera plantilla
            </Link>
          )}
        </div>
      ) : (
        <div className="grid gap-3">
          {plantillas.map((p) => (
            <div
              key={p.id}
              className="bg-white border border-slate-200 rounded-2xl p-5 flex items-center justify-between gap-4"
            >
              <div className="min-w-0">
                <h3 className="font-bold text-slate-900 truncate">{p.titulo}</h3>
                <p className="text-xs text-slate-500 mt-1 flex items-center gap-1.5">
                  <HelpCircle className="h-3.5 w-3.5" />
                  {p.total_preguntas || 0} preguntas
                </p>
              </div>
              {canManage && (
                <div className="flex items-center gap-2 shrink-0">
                  <Link
                    href={`/capacitaciones/biblioteca/${p.id}`}
                    className="p-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50"
                  >
                    <Edit2 className="h-4 w-4" />
                  </Link>
                  <button
                    type="button"
                    onClick={() => handleDelete(p.id)}
                    className="p-2.5 rounded-xl border border-red-100 text-red-500 hover:bg-red-50"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
