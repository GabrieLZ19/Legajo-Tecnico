"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  Clock3,
  HardHat,
  Loader2,
  Pencil,
  Plus,
  Search,
  Trash2,
  X,
  XCircle,
} from "lucide-react";
import type {
  EppProveedorSugerido,
  EstadoPublicacionProveedorSugerido,
} from "@/types";
import { eppProveedoresSugeridosService } from "@/utils/services/eppProveedoresSugeridos.service";
import { useAlert } from "@/context/AlertContext";
import { validateProveedorFicha } from "@/lib/proveedorValidation";
import {
  emptyProveedorFicha,
  ProveedorFichaFields,
  type ProveedorFichaForm,
} from "@/app/(app)/epp/_components/ProveedorFichaFields";

type TabKey = EstadoPublicacionProveedorSugerido | "todas";

const TABS: Array<{ key: TabKey; label: string }> = [
  { key: "pendiente", label: "Pendientes" },
  { key: "aprobada", label: "Publicados" },
  { key: "rechazada", label: "Rechazados" },
  { key: "todas", label: "Todos" },
];

function estadoBadge(estado: EstadoPublicacionProveedorSugerido) {
  if (estado === "pendiente") {
    return {
      label: "Pendiente",
      className: "bg-amber-50 text-amber-700 border-amber-100",
      icon: Clock3,
    };
  }
  if (estado === "rechazada") {
    return {
      label: "Rechazado",
      className: "bg-red-50 text-red-700 border-red-100",
      icon: XCircle,
    };
  }
  return {
    label: "Publicado",
    className: "bg-emerald-50 text-emerald-700 border-emerald-100",
    icon: CheckCircle2,
  };
}

export default function AdminProveedoresEppLtPage() {
  const { showAlert, showConfirm } = useAlert();
  const [items, setItems] = useState<EppProveedorSugerido[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<TabKey>("pendiente");
  const [searchTerm, setSearchTerm] = useState("");
  const [actingId, setActingId] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<EppProveedorSugerido | null>(null);
  const [ficha, setFicha] = useState<ProveedorFichaForm>(emptyProveedorFicha());
  const [notas, setNotas] = useState("");
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectMotivo, setRejectMotivo] = useState("");
  const [saving, setSaving] = useState(false);

  const load = async (estado: TabKey = tab) => {
    setLoading(true);
    try {
      const data = await eppProveedoresSugeridosService.listar(estado);
      setItems(data);
    } catch {
      showAlert("error", "Error", "No se pudieron cargar los proveedores sugeridos.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load(tab);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  const filtered = useMemo(
    () =>
      items.filter((p) => {
        const q = searchTerm.trim().toLowerCase();
        if (!q) return true;
        return (
          p.nombre.toLowerCase().includes(q) ||
          p.email.toLowerCase().includes(q) ||
          (p.telefono || "").includes(q)
        );
      }),
    [items, searchTerm],
  );

  const openCreate = () => {
    setEditing(null);
    setFicha(emptyProveedorFicha());
    setNotas("");
    setModalOpen(true);
  };

  const openEdit = (p: EppProveedorSugerido) => {
    setEditing(p);
    setFicha({
      nombre: p.nombre,
      email: p.email,
      direccion: p.direccion || "",
      telefono: p.telefono || "",
    });
    setNotas(p.notas || "");
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const err = validateProveedorFicha(ficha);
    if (err) {
      showAlert("warning", "Datos inválidos", err);
      return;
    }
    setSaving(true);
    try {
      const payload = {
        nombre: ficha.nombre.trim(),
        email: ficha.email.trim(),
        direccion: ficha.direccion.trim() || null,
        telefono: ficha.telefono.trim() || null,
        notas: notas.trim() || null,
      };
      if (editing) {
        await eppProveedoresSugeridosService.actualizar(editing.id, payload);
        showAlert("success", "Actualizado", "Los datos del proveedor se guardaron.");
      } else {
        await eppProveedoresSugeridosService.crear(payload);
        showAlert(
          "success",
          "Proveedor publicado",
          "Ya está disponible para los clientes en licitaciones EPP.",
        );
      }
      setModalOpen(false);
      await load(tab);
    } catch {
      showAlert("error", "Error", "No se pudo guardar el proveedor sugerido.");
    } finally {
      setSaving(false);
    }
  };

  const handleAprobar = async (p: EppProveedorSugerido) => {
    const ok = await showConfirm(
      "Publicar proveedor",
      `¿Publicar “${p.nombre}” como sugerido LT para todos los clientes?`,
      { type: "success", confirmLabel: "Publicar", cancelLabel: "Cancelar" },
    );
    if (!ok) return;
    setActingId(p.id);
    try {
      await eppProveedoresSugeridosService.cambiarPublicacion(p.id, {
        estado: "aprobada",
      });
      showAlert("success", "Publicado", "El proveedor ya figura en la lista sugerida.");
      await load(tab);
    } catch {
      showAlert("error", "Error", "No se pudo publicar.");
    } finally {
      setActingId(null);
    }
  };

  const handleRechazar = (p: EppProveedorSugerido) => {
    setRejectId(p.id);
    setRejectMotivo("");
  };

  const confirmRechazar = async () => {
    if (!rejectId) return;
    if (!rejectMotivo.trim()) {
      showAlert("warning", "Falta el motivo", "Indicá por qué se rechaza.");
      return;
    }
    setActingId(rejectId);
    try {
      await eppProveedoresSugeridosService.cambiarPublicacion(rejectId, {
        estado: "rechazada",
        rechazo_motivo: rejectMotivo.trim(),
      });
      setRejectId(null);
      showAlert("success", "Rechazado", "El proveedor quedó marcado como rechazado.");
      await load(tab);
    } catch {
      showAlert("error", "Error", "No se pudo rechazar.");
    } finally {
      setActingId(null);
    }
  };

  const handleDelete = async (p: EppProveedorSugerido) => {
    const ok = await showConfirm(
      "Eliminar proveedor",
      `¿Eliminar “${p.nombre}” de la lista sugerida por LT?`,
      { type: "error", confirmLabel: "Eliminar", cancelLabel: "Cancelar" },
    );
    if (!ok) return;
    try {
      await eppProveedoresSugeridosService.eliminar(p.id);
      setItems((prev) => prev.filter((x) => x.id !== p.id));
      showAlert("success", "Eliminado", "Se quitó de la biblioteca LT.");
    } catch {
      showAlert("error", "Error", "No se pudo eliminar.");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-black uppercase tracking-wider text-slate-400">
            Legajo Técnico
          </p>
          <h1 className="text-2xl font-black text-slate-900 mt-1">
            Proveedores EPP sugeridos
          </h1>
          <p className="text-sm text-slate-500 mt-1 max-w-xl">
            Lista global que los clientes pueden adoptar al armar una licitación.
            La comisión especial por proveedor se definirá más adelante.
          </p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex items-center justify-center gap-2 min-h-11 px-4 rounded-xl bg-brand-secondary text-white text-sm font-bold cursor-pointer"
        >
          <Plus className="h-4 w-4" />
          Nuevo proveedor LT
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`min-h-10 px-3 rounded-lg text-xs font-bold cursor-pointer ${
              tab === t.key
                ? "bg-slate-900 text-white"
                : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <input
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Buscar por nombre, mail o teléfono…"
          className="w-full min-h-11 pl-10 pr-3 rounded-xl border border-slate-200 text-sm font-semibold"
        />
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-7 w-7 animate-spin text-slate-400" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-14 text-center">
          <HardHat className="h-8 w-8 text-slate-300 mx-auto mb-3" />
          <p className="text-sm font-bold text-slate-700">Sin proveedores en esta vista</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {filtered.map((p) => {
            const badge = estadoBadge(p.estado_publicacion);
            const Icon = badge.icon;
            return (
              <li
                key={p.id}
                className="rounded-2xl border border-slate-200 bg-white p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-bold text-slate-900">{p.nombre}</p>
                    <span
                      className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-bold ${badge.className}`}
                    >
                      <Icon className="h-3 w-3" />
                      {badge.label}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 font-semibold mt-1 truncate">
                    {p.email}
                    {p.telefono ? ` · ${p.telefono}` : ""}
                  </p>
                  {p.notas && (
                    <p className="text-xs text-slate-400 mt-1">{p.notas}</p>
                  )}
                  {p.rechazo_motivo && (
                    <p className="text-xs text-rose-600 mt-1">
                      Motivo: {p.rechazo_motivo}
                    </p>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  {p.estado_publicacion === "pendiente" && (
                    <>
                      <button
                        type="button"
                        disabled={actingId === p.id}
                        onClick={() => void handleAprobar(p)}
                        className="min-h-10 px-3 rounded-lg bg-emerald-600 text-white text-xs font-bold cursor-pointer disabled:opacity-50"
                      >
                        Aprobar
                      </button>
                      <button
                        type="button"
                        disabled={actingId === p.id}
                        onClick={() => handleRechazar(p)}
                        className="min-h-10 px-3 rounded-lg bg-rose-50 text-rose-700 text-xs font-bold cursor-pointer disabled:opacity-50"
                      >
                        Rechazar
                      </button>
                    </>
                  )}
                  <button
                    type="button"
                    onClick={() => openEdit(p)}
                    className="min-h-10 min-w-10 inline-flex items-center justify-center rounded-lg border border-slate-200 cursor-pointer"
                    aria-label="Editar"
                  >
                    <Pencil className="h-4 w-4 text-slate-500" />
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleDelete(p)}
                    className="min-h-10 min-w-10 inline-flex items-center justify-center rounded-lg border border-rose-100 bg-rose-50 cursor-pointer"
                    aria-label="Eliminar"
                  >
                    <Trash2 className="h-4 w-4 text-rose-600" />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/60 p-0 sm:p-4">
          <div className="bg-white w-full sm:max-w-lg sm:rounded-3xl rounded-t-3xl max-h-[92vh] overflow-y-auto p-5 sm:p-6 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-black uppercase tracking-wider text-slate-800">
                {editing ? "Editar proveedor LT" : "Nuevo proveedor LT"}
              </h3>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="min-h-11 min-w-11 inline-flex items-center justify-center rounded-xl border border-slate-200 cursor-pointer"
                aria-label="Cerrar"
              >
                <X className="h-5 w-5 text-slate-500" />
              </button>
            </div>
            <form onSubmit={handleSave} className="space-y-3">
              <ProveedorFichaFields
                value={ficha}
                onChange={setFicha}
                idPrefix="admin-sugerido"
              />
              <label className="block space-y-1.5">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Notas internas (opcional)
                </span>
                <textarea
                  value={notas}
                  onChange={(e) => setNotas(e.target.value)}
                  rows={3}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold"
                  placeholder="Rubro, zona, condiciones…"
                />
              </label>
              <button
                type="submit"
                disabled={saving}
                className="w-full min-h-12 rounded-xl bg-brand-secondary text-white text-sm font-bold cursor-pointer disabled:opacity-50"
              >
                {saving ? "Guardando…" : editing ? "Guardar cambios" : "Crear y publicar"}
              </button>
            </form>
          </div>
        </div>
      )}

      {rejectId && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/60 p-0 sm:p-4">
          <div className="bg-white w-full sm:max-w-md sm:rounded-3xl rounded-t-3xl p-5 sm:p-6 space-y-4">
            <h3 className="text-sm font-black uppercase tracking-wider text-slate-800">
              Rechazar proveedor
            </h3>
            <textarea
              value={rejectMotivo}
              onChange={(e) => setRejectMotivo(e.target.value)}
              rows={3}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold"
              placeholder="Motivo del rechazo…"
            />
            <div className="flex flex-col gap-2">
              <button
                type="button"
                disabled={actingId === rejectId}
                onClick={() => void confirmRechazar()}
                className="w-full min-h-11 rounded-xl bg-rose-600 text-white text-sm font-bold cursor-pointer disabled:opacity-50"
              >
                Confirmar rechazo
              </button>
              <button
                type="button"
                onClick={() => setRejectId(null)}
                className="w-full min-h-11 rounded-xl border border-slate-200 text-sm font-bold cursor-pointer"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
