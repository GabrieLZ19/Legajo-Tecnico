"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  BookOpen,
  Plus,
  Search,
  Trash2,
  Edit2,
  HelpCircle,
  Loader2,
} from "lucide-react";
import { CapacitacionPlantilla } from "@/types";
import { useCapacitacionPlantillas } from "@/hooks/useCapacitacionPlantillas";

export default function AdminCapacitacionesBibliotecaPage() {
  const { listarPlantillas, eliminarPlantilla } = useCapacitacionPlantillas();
  const [plantillas, setPlantillas] = useState<CapacitacionPlantilla[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const data = await listarPlantillas("global");
      setPlantillas(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleDelete = async (id: string) => {
    if (
      !window.confirm(
        "¿Eliminar esta plantilla de la biblioteca de Legajo Técnico?",
      )
    ) {
      return;
    }
    try {
      await eliminarPlantilla(id);
      setPlantillas((prev) => prev.filter((p) => p.id !== id));
    } catch (err) {
      console.error(err);
      alert("No se pudo eliminar la plantilla");
    }
  };

  const filtered = plantillas.filter((p) =>
    p.titulo.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  return (
    <div className="space-y-8 w-full">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <span className="text-sm font-semibold text-slate-500 flex items-center gap-1.5">
            <BookOpen className="h-4 w-4" /> Capacitaciones
          </span>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight mt-1">
            Biblioteca Legajo Técnico
          </h1>
          <p className="text-sm font-medium text-slate-500 mt-1">
            Plantillas generales disponibles para todos los preventores.
          </p>
        </div>
        <Link
          href="/admin/capacitaciones-biblioteca/nueva"
          className="inline-flex items-center justify-center gap-2 bg-brand-secondary hover:bg-brand-secondary/95 text-white font-bold px-5 py-3 rounded-xl shadow-md text-sm shrink-0"
        >
          <Plus className="h-4 w-4" />
          Nueva plantilla
        </Link>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Buscar por título..."
          className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-sm"
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-slate-500 gap-2">
          <Loader2 className="h-5 w-5 animate-spin" />
          Cargando biblioteca...
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center">
          <BookOpen className="h-10 w-10 text-slate-300 mx-auto mb-3" />
          <p className="text-sm font-bold text-slate-700">
            No hay plantillas globales todavía
          </p>
          <p className="text-xs text-slate-500 mt-1">
            Cargá capacitaciones base una por una para que los preventores las
            usen.
          </p>
        </div>
      ) : (
        <div className="grid gap-3">
          {filtered.map((p) => (
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
              <div className="flex items-center gap-2 shrink-0">
                <Link
                  href={`/admin/capacitaciones-biblioteca/${p.id}`}
                  className="p-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50"
                  title="Editar"
                >
                  <Edit2 className="h-4 w-4" />
                </Link>
                <button
                  type="button"
                  onClick={() => handleDelete(p.id)}
                  className="p-2.5 rounded-xl border border-red-100 text-red-500 hover:bg-red-50"
                  title="Eliminar"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
