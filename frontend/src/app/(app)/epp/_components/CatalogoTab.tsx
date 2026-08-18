"use client";

import { useState } from "react";
import { Package, Plus, Pencil, Trash2 } from "lucide-react";
import type { EppTipo } from "@/types";
import { useEpp } from "@/hooks/useEpp";
import { useAlert } from "@/context/AlertContext";
import { FileImagePicker } from "@/components/FileImagePicker";

type CatalogoTabProps = {
  tipos: EppTipo[];
  canEdit: boolean;
  onChanged: () => Promise<void>;
};

export function CatalogoTab({ tipos, canEdit, onChanged }: CatalogoTabProps) {
  const { crearTipoEpp, actualizarTipoEpp } = useEpp();
  const { showAlert } = useAlert();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<EppTipo | null>(null);
  const [pendingDelete, setPendingDelete] = useState<EppTipo | null>(null);
  const [nombre, setNombre] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [foto, setFoto] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  const visibles = tipos.filter((tipo) => tipo.activo !== false);

  const reset = () => {
    setOpen(false);
    setEditing(null);
    setNombre("");
    setDescripcion("");
    setFoto(null);
  };

  const openCreate = () => {
    setEditing(null);
    setNombre("");
    setDescripcion("");
    setFoto(null);
    setOpen(true);
  };

  const openEdit = (tipo: EppTipo) => {
    setEditing(tipo);
    setNombre(tipo.nombre);
    setDescripcion(tipo.descripcion || "");
    setFoto(null);
    setOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editing) {
        await actualizarTipoEpp(editing.id, { nombre, descripcion, foto: foto ?? undefined });
        showAlert("success", "Catálogo actualizado", "Los cambios del EPP ya están guardados.");
      } else {
        await crearTipoEpp({ nombre, descripcion, foto: foto ?? undefined });
        showAlert("success", "EPP creado", "Ya aparece en el catálogo y en las entregas.");
      }
      await onChanged();
      reset();
    } catch {
      showAlert("error", "Error", "No se pudo guardar el EPP.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!pendingDelete) return;
    setSaving(true);
    try {
      await actualizarTipoEpp(pendingDelete.id, { activo: false });
      showAlert("success", "EPP eliminado", "Dejó de aparecer en el catálogo y en nuevas entregas.");
      setPendingDelete(null);
      await onChanged();
    } catch {
      showAlert("error", "Error", "No se pudo eliminar el EPP.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      {canEdit && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex items-center justify-center gap-2 w-full sm:w-auto min-h-12 px-5 py-3 bg-slate-900 hover:bg-slate-800 text-white text-sm font-bold rounded-xl cursor-pointer"
          >
            <Plus className="h-5 w-5" />
            Nuevo tipo
          </button>
        </div>
      )}

      {visibles.length === 0 ? (
        <div className="bg-white rounded-3xl border border-slate-100 p-12 text-center">
          <Package className="h-8 w-8 text-slate-300 mx-auto mb-3" />
          <p className="text-sm font-bold text-slate-600">Todavía no hay tipos de EPP</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {visibles.map((tipo) => (
            <div
              key={tipo.id}
              className="bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-xs"
            >
              <div className="aspect-square bg-slate-50 flex items-center justify-center overflow-hidden">
                {tipo.foto_url ? (
                  <img src={tipo.foto_url} alt={tipo.nombre} className="h-full w-full object-cover" />
                ) : (
                  <Package className="h-8 w-8 text-slate-300" />
                )}
              </div>
              <div className="p-3">
                <h3 className="text-sm font-bold text-slate-800 leading-tight">{tipo.nombre}</h3>
                {tipo.descripcion && (
                  <p className="text-[11px] text-slate-400 mt-1 line-clamp-2">{tipo.descripcion}</p>
                )}
                {canEdit && (
                  <div className="mt-3 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => openEdit(tipo)}
                      className="inline-flex items-center justify-center gap-1.5 min-h-11 px-3 text-sm font-bold text-blue-600 cursor-pointer"
                    >
                      <Pencil className="h-4 w-4" /> Editar
                    </button>
                    <button
                      type="button"
                      onClick={() => setPendingDelete(tipo)}
                      className="inline-flex items-center justify-center gap-1.5 min-h-11 px-3 text-sm font-bold text-rose-600 cursor-pointer"
                    >
                      <Trash2 className="h-4 w-4" /> Eliminar
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
          <form
            onSubmit={handleSubmit}
            className="bg-white w-full max-w-md rounded-2xl p-6 space-y-4"
          >
            <h3 className="text-lg font-black text-slate-800">
              {editing ? "Editar EPP" : "Nuevo tipo de EPP"}
            </h3>
            <input
              required
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Nombre"
              className="w-full min-h-12 px-4 py-3 border border-slate-200 rounded-xl text-base sm:text-sm"
            />
            <textarea
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              placeholder="Descripción"
              rows={3}
              className="w-full px-4 py-3 border border-slate-200 rounded-xl text-base sm:text-sm resize-none"
            />
            <FileImagePicker
              file={foto}
              onChange={setFoto}
              previewUrl={editing?.foto_url}
              label="Foto del EPP"
            />
            <div className="flex gap-2">
              <button type="button" onClick={reset} className="flex-1 min-h-12 py-3 border rounded-xl text-sm font-bold cursor-pointer">
                Cancelar
              </button>
              <button
                type="submit"
                disabled={saving}
                className="flex-1 min-h-12 py-3 bg-blue-600 text-white rounded-xl text-sm font-bold cursor-pointer disabled:opacity-50"
              >
                {saving ? "Guardando..." : "Guardar"}
              </button>
            </div>
          </form>
        </div>
      )}

      {pendingDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
          <div className="bg-white w-full max-w-xs rounded-2xl p-6 space-y-4 text-center">
            <h3 className="text-sm font-black text-slate-900">Eliminar {pendingDelete.nombre}?</h3>
            <p className="text-xs text-slate-500 font-semibold">
              Se oculta del catálogo. Las entregas ya registradas no se borran.
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setPendingDelete(null)}
                className="flex-1 min-h-12 py-3 border rounded-xl text-sm font-bold cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={saving}
                className="flex-1 min-h-12 py-3 bg-rose-600 text-white rounded-xl text-sm font-bold cursor-pointer disabled:opacity-50"
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
