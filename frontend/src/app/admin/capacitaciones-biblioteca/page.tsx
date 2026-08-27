"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  BookOpen,
  Plus,
  Search,
  Trash2,
  Edit2,
  Eye,
  HelpCircle,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock3,
  User,
} from "lucide-react";
import { CapacitacionPlantilla, EstadoPublicacionPlantilla } from "@/types";
import { useCapacitacionPlantillas } from "@/hooks/useCapacitacionPlantillas";
import { useAlert } from "@/context/AlertContext";

type TabKey = "pendiente" | "aprobada" | "rechazada" | "todas";

const TABS: Array<{ key: TabKey; label: string }> = [
  { key: "pendiente", label: "Pendientes" },
  { key: "aprobada", label: "Publicadas" },
  { key: "rechazada", label: "Rechazadas" },
  { key: "todas", label: "Todas" },
];

function estadoBadge(estado?: EstadoPublicacionPlantilla | null) {
  if (estado === "pendiente") {
    return {
      label: "Pendiente de aprobación",
      className: "bg-amber-50 text-amber-700 border-amber-100",
      icon: Clock3,
    };
  }
  if (estado === "rechazada") {
    return {
      label: "Rechazada",
      className: "bg-red-50 text-red-700 border-red-100",
      icon: XCircle,
    };
  }
  return {
    label: "Publicada",
    className: "bg-emerald-50 text-emerald-700 border-emerald-100",
    icon: CheckCircle2,
  };
}

export default function AdminCapacitacionesBibliotecaPage() {
  const { showAlert, showConfirm } = useAlert();
  const {
    listarPlantillas,
    eliminarPlantilla,
    cambiarEstadoPublicacion,
  } = useCapacitacionPlantillas();

  const [plantillas, setPlantillas] = useState<CapacitacionPlantilla[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [tab, setTab] = useState<TabKey>("pendiente");
  const [actingId, setActingId] = useState<string | null>(null);

  const load = async (estado: TabKey = tab) => {
    setLoading(true);
    try {
      const data = await listarPlantillas("global", undefined, {
        estado_publicacion: estado,
      });
      setPlantillas(data || []);
    } catch (err) {
      console.error(err);
      showAlert("error", "Error", "No se pudieron cargar las plantillas.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load(tab);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  const countsHint = useMemo(() => {
    const pendientes = plantillas.filter(
      (p) => p.estado_publicacion === "pendiente",
    ).length;
    return pendientes;
  }, [plantillas]);

  const filtered = plantillas.filter((p) =>
    p.titulo.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  const handleDelete = async (id: string) => {
    const ok = await showConfirm(
      "Eliminar plantilla",
      "¿Eliminar esta plantilla de la biblioteca de Legajo Técnico?",
      { type: "error", confirmLabel: "Eliminar", cancelLabel: "Cancelar" },
    );
    if (!ok) return;
    try {
      await eliminarPlantilla(id);
      setPlantillas((prev) => prev.filter((p) => p.id !== id));
      showAlert("success", "Eliminada", "La plantilla fue eliminada.");
    } catch {
      showAlert("error", "Error", "No se pudo eliminar la plantilla.");
    }
  };

  const handleAprobar = async (p: CapacitacionPlantilla) => {
    const ok = await showConfirm(
      "Aprobar publicación",
      `¿Publicar “${p.titulo}” en la biblioteca LT para todos los clientes?`,
      { type: "success", confirmLabel: "Aprobar y publicar", cancelLabel: "Cancelar" },
    );
    if (!ok) return;
    setActingId(p.id);
    try {
      await cambiarEstadoPublicacion(p.id, { estado: "aprobada" });
      showAlert(
        "success",
        "Publicada",
        "La capacitación ya está disponible para los demás clientes.",
      );
      await load(tab);
    } catch {
      showAlert("error", "Error", "No se pudo aprobar la plantilla.");
    } finally {
      setActingId(null);
    }
  };

  const handleRechazar = async (p: CapacitacionPlantilla) => {
    const ok = await showConfirm(
      "Rechazar publicación",
      `¿Rechazar “${p.titulo}”? No aparecerá en la biblioteca LT de los clientes.`,
      { type: "warning", confirmLabel: "Rechazar", cancelLabel: "Cancelar" },
    );
    if (!ok) return;
    setActingId(p.id);
    try {
      await cambiarEstadoPublicacion(p.id, { estado: "rechazada" });
      showAlert("success", "Rechazada", "La plantilla quedó rechazada.");
      await load(tab);
    } catch {
      showAlert("error", "Error", "No se pudo rechazar la plantilla.");
    } finally {
      setActingId(null);
    }
  };

  return (
    <div className="space-y-8 w-full max-w-full">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <span className="text-sm font-semibold text-slate-500 flex items-center gap-1.5">
            <BookOpen className="h-4 w-4" /> Capacitaciones
          </span>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight mt-1">
            Biblioteca Legajo Técnico
          </h1>
          <p className="text-sm font-medium text-slate-500 mt-1">
            Revisá y aprobá las capacitaciones que los preventores envían para
            publicarlas a todos los clientes.
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

      <div className="flex flex-wrap gap-2 bg-slate-100 p-1.5 rounded-2xl border border-slate-200 w-fit">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              tab === t.key
                ? "bg-white text-blue-700 shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            {t.label}
            {t.key === "pendiente" && tab === "pendiente" && countsHint > 0
              ? ` (${countsHint})`
              : ""}
          </button>
        ))}
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
            {tab === "pendiente"
              ? "No hay publicaciones pendientes"
              : "No hay plantillas en este filtro"}
          </p>
          <p className="text-xs text-slate-500 mt-1">
            Cuando un preventor marque “Guardar en biblioteca LT”, aparecerá
            acá para tu revisión.
          </p>
        </div>
      ) : (
        <div className="grid gap-3">
          {filtered.map((p) => {
            const badge = estadoBadge(p.estado_publicacion);
            const BadgeIcon = badge.icon;
            const isPending = p.estado_publicacion === "pendiente";
            const isActing = actingId === p.id;

            return (
              <div
                key={p.id}
                className="bg-white border border-slate-200 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
              >
                <div className="min-w-0 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-bold text-slate-900 truncate">
                      {p.titulo}
                    </h3>
                    <span
                      className={`inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wide px-2 py-1 rounded-lg border ${badge.className}`}
                    >
                      <BadgeIcon className="h-3 w-3" />
                      {badge.label}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span className="inline-flex items-center gap-1.5">
                      <HelpCircle className="h-3.5 w-3.5" />
                      {p.total_preguntas || 0} preguntas
                    </span>
                    {p.autor_nombre && (
                      <span className="inline-flex items-center gap-1.5">
                        <User className="h-3.5 w-3.5" />
                        Enviada por {p.autor_nombre}
                      </span>
                    )}
                    <span>
                      {new Date(p.created_at).toLocaleDateString("es-AR")}
                    </span>
                  </p>
                  {p.estado_publicacion === "rechazada" && p.rechazo_motivo && (
                    <p className="text-xs text-red-600 font-semibold">
                      Motivo: {p.rechazo_motivo}
                    </p>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  {isPending && (
                    <>
                      <button
                        type="button"
                        disabled={isActing}
                        onClick={() => handleAprobar(p)}
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold disabled:opacity-50 cursor-pointer"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        {isActing ? "..." : "Aprobar"}
                      </button>
                      <button
                        type="button"
                        disabled={isActing}
                        onClick={() => handleRechazar(p)}
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-amber-200 bg-amber-50 text-amber-800 text-xs font-bold disabled:opacity-50 cursor-pointer"
                      >
                        <XCircle className="h-3.5 w-3.5" />
                        Rechazar
                      </button>
                    </>
                  )}
                  {p.estado_publicacion === "rechazada" && (
                    <button
                      type="button"
                      disabled={isActing}
                      onClick={() => handleAprobar(p)}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold disabled:opacity-50 cursor-pointer"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Aprobar igual
                    </button>
                  )}
                  <Link
                    href={`/admin/capacitaciones-biblioteca/${p.id}/ver`}
                    className="p-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50"
                    title="Ver plantilla"
                  >
                    <Eye className="h-4 w-4" />
                  </Link>
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
                    className="p-2.5 rounded-xl border border-red-100 text-red-500 hover:bg-red-50 cursor-pointer"
                    title="Eliminar"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
