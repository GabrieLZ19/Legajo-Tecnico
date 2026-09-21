"use client";

import { useMemo, useState } from "react";
import { Package, Plus, Pencil, Trash2, Search, X, ImageIcon } from "lucide-react";
import type { EppTipo } from "@/types";
import { useEpp } from "@/hooks/useEpp";
import { useAlert } from "@/context/AlertContext";
import { FileImagePicker } from "@/components/FileImagePicker";

type CatalogoTabProps = {
  tipos: EppTipo[];
  empresaId: string;
  canEdit: boolean;
  onChanged: () => Promise<void>;
};

function apiErrorMessage(err: unknown, fallback: string): string {
  if (
    typeof err === "object" &&
    err !== null &&
    "response" in err &&
    typeof (err as { response?: { data?: { error?: string } } }).response?.data
      ?.error === "string"
  ) {
    return (err as { response: { data: { error: string } } }).response.data.error;
  }
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}

export function CatalogoTab({ tipos, empresaId, canEdit, onChanged }: CatalogoTabProps) {
  const { crearTipoEpp, actualizarTipoEpp } = useEpp();
  const { showAlert } = useAlert();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<EppTipo | null>(null);
  const [pendingDelete, setPendingDelete] = useState<EppTipo | null>(null);
  const [nombre, setNombre] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [marca, setMarca] = useState("");
  const [modelo, setModelo] = useState("");
  const [certificacion, setCertificacion] = useState("");
  const [foto, setFoto] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [busqueda, setBusqueda] = useState("");

  const visibles = useMemo(
    () =>
      tipos
        .filter((tipo) => tipo.activo !== false)
        .sort((a, b) => a.nombre.localeCompare(b.nombre, "es")),
    [tipos],
  );

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return visibles;
    return visibles.filter(
      (tipo) =>
        tipo.nombre.toLowerCase().includes(q) ||
        (tipo.descripcion || "").toLowerCase().includes(q) ||
        (tipo.marca || "").toLowerCase().includes(q) ||
        (tipo.modelo || "").toLowerCase().includes(q) ||
        (tipo.certificacion || "").toLowerCase().includes(q),
    );
  }, [visibles, busqueda]);

  const conFoto = visibles.filter((t) => Boolean(t.foto_url)).length;

  const reset = () => {
    setOpen(false);
    setEditing(null);
    setNombre("");
    setDescripcion("");
    setMarca("");
    setModelo("");
    setCertificacion("");
    setFoto(null);
  };

  const openCreate = () => {
    setEditing(null);
    setNombre("");
    setDescripcion("");
    setMarca("");
    setModelo("");
    setCertificacion("");
    setFoto(null);
    setOpen(true);
  };

  const openEdit = (tipo: EppTipo) => {
    setEditing(tipo);
    setNombre(tipo.nombre);
    setDescripcion(tipo.descripcion || "");
    setMarca(tipo.marca || "");
    setModelo(tipo.modelo || "");
    setCertificacion(tipo.certificacion || "");
    setFoto(null);
    setOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editing) {
        await actualizarTipoEpp(editing.id, {
          empresa_id: empresaId,
          nombre,
          descripcion,
          marca,
          modelo,
          certificacion,
          foto: foto ?? undefined,
        });
        showAlert("success", "Catálogo actualizado", "Los cambios del EPP ya están guardados.");
      } else {
        await crearTipoEpp({
          empresa_id: empresaId,
          nombre,
          descripcion,
          marca,
          modelo,
          certificacion,
          foto: foto ?? undefined,
        });
        showAlert("success", "EPP creado", "Ya aparece en el catálogo y en las entregas.");
      }
      await onChanged();
      reset();
    } catch (err: unknown) {
      showAlert("error", "Error", apiErrorMessage(err, "No se pudo guardar el EPP."));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!pendingDelete) return;
    setSaving(true);
    try {
      await actualizarTipoEpp(pendingDelete.id, {
        empresa_id: empresaId,
        activo: false,
      });
      showAlert(
        "success",
        "EPP eliminado",
        "Dejó de aparecer en el catálogo y en nuevas entregas.",
      );
      setPendingDelete(null);
      await onChanged();
    } catch {
      showAlert("error", "Error", "No se pudo eliminar el EPP.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h2 className="text-base font-black text-slate-800 tracking-tight">
            Catálogo de EPP
          </h2>
          <p className="mt-1 text-xs font-medium text-slate-500 max-w-xl leading-relaxed">
            Tipos disponibles para entregas, planilla Anexo I y puntos de QR. La foto se
            usa en el registro de entrega.
          </p>
          {visibles.length > 0 && (
            <p className="mt-2 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              {visibles.length} tipo{visibles.length === 1 ? "" : "s"}
              {conFoto > 0 ? ` · ${conFoto} con foto` : ""}
            </p>
          )}
        </div>
        {canEdit && (
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex items-center justify-center gap-2 w-full sm:w-auto min-h-12 px-5 py-3 bg-slate-900 hover:bg-slate-800 text-white text-sm font-bold rounded-xl cursor-pointer"
          >
            <Plus className="h-5 w-5" />
            Nuevo EPP
          </button>
        )}
      </div>

      {visibles.length > 0 && (
        <div className="relative">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por nombre o descripción…"
            className="w-full min-h-12 pl-11 pr-10 py-3 bg-white border border-slate-200 rounded-2xl text-sm font-medium focus:outline-hidden focus:ring-2 focus:ring-blue-500/25 focus:border-blue-500"
          />
          {busqueda && (
            <button
              type="button"
              onClick={() => setBusqueda("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-slate-600 cursor-pointer"
              aria-label="Limpiar búsqueda"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      )}

      {visibles.length === 0 ? (
        <div className="bg-white rounded-3xl border border-slate-100 px-6 py-14 text-center shadow-xs">
          <Package className="h-9 w-9 text-slate-300 mx-auto mb-3" />
          <p className="text-sm font-bold text-slate-600">Todavía no hay tipos de EPP</p>
          <p className="mt-1 text-xs font-medium text-slate-400 max-w-sm mx-auto">
            Creá el catálogo con nombre, descripción y foto para usarlo en entregas.
          </p>
          {canEdit && (
            <button
              type="button"
              onClick={openCreate}
              className="mt-5 inline-flex items-center justify-center gap-2 min-h-11 px-4 py-2.5 bg-slate-900 text-white text-sm font-bold rounded-xl cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              Nuevo EPP
            </button>
          )}
        </div>
      ) : filtrados.length === 0 ? (
        <div className="bg-white rounded-3xl border border-slate-100 px-6 py-12 text-center">
          <p className="text-sm font-semibold text-slate-400">
            Ningún EPP coincide con “{busqueda}”.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          {filtrados.map((tipo) => (
            <article
              key={tipo.id}
              className="group bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-xs hover:border-slate-200 hover:shadow-sm transition-all"
            >
              <div className="relative h-24 sm:h-28 bg-slate-50 flex items-center justify-center overflow-hidden">
                {tipo.foto_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={tipo.foto_url}
                    alt={tipo.nombre}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex flex-col items-center gap-1 text-slate-300">
                    <ImageIcon className="h-5 w-5" />
                    <span className="text-[9px] font-bold uppercase tracking-wider">
                      Sin foto
                    </span>
                  </div>
                )}
              </div>
              <div className="p-2.5 sm:p-3 space-y-2">
                <div>
                  <h3 className="text-xs sm:text-sm font-bold text-slate-800 leading-snug line-clamp-2">
                    {tipo.nombre}
                  </h3>
                  {(tipo.marca || tipo.modelo) && (
                    <p className="text-[10px] sm:text-[11px] text-slate-500 font-semibold mt-0.5 line-clamp-1">
                      {[tipo.marca, tipo.modelo].filter(Boolean).join(" · ")}
                    </p>
                  )}
                  {tipo.descripcion ? (
                    <p className="text-[10px] sm:text-[11px] text-slate-400 font-medium mt-0.5 line-clamp-1 leading-relaxed">
                      {tipo.descripcion}
                    </p>
                  ) : null}
                </div>
                {canEdit && (
                  <div className="flex items-center gap-1.5 pt-1.5 border-t border-slate-50">
                    <button
                      type="button"
                      onClick={() => openEdit(tipo)}
                      className="inline-flex flex-1 items-center justify-center gap-1 min-h-9 px-2 text-[11px] sm:text-xs font-bold text-slate-700 bg-slate-50 hover:bg-slate-100 rounded-lg cursor-pointer"
                    >
                      <Pencil className="h-3 w-3" />
                      Editar
                    </button>
                    <button
                      type="button"
                      onClick={() => setPendingDelete(tipo)}
                      className="inline-flex items-center justify-center min-h-9 w-9 text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer"
                      aria-label={`Eliminar ${tipo.nombre}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
              </div>
            </article>
          ))}
        </div>
      )}

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
          <form
            onSubmit={handleSubmit}
            className="bg-white w-full max-w-md rounded-2xl shadow-xl max-h-[90vh] overflow-y-auto"
          >
            <div className="sticky top-0 z-10 flex items-start justify-between gap-3 bg-white border-b border-slate-100 px-6 py-4 rounded-t-2xl">
              <div>
                <h3 className="text-lg font-black text-slate-800">
                  {editing ? "Editar EPP" : "Nuevo EPP"}
                </h3>
                <p className="mt-0.5 text-xs font-medium text-slate-400">
                  Nombre, marca, modelo, certificación y foto para el catálogo.
                </p>
              </div>
              <button
                type="button"
                onClick={reset}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-50 cursor-pointer"
                aria-label="Cerrar"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="px-6 py-5 space-y-4">
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                  Nombre *
                </label>
                <input
                  required
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  placeholder="Ej. Casco de seguridad"
                  className="w-full min-h-12 px-4 py-3 border border-slate-200 rounded-xl text-base sm:text-sm font-medium focus:outline-hidden focus:ring-2 focus:ring-blue-500/25 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                  Descripción
                </label>
                <textarea
                  value={descripcion}
                  onChange={(e) => setDescripcion(e.target.value)}
                  placeholder="Detalle o uso (opcional)"
                  rows={2}
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl text-base sm:text-sm font-medium resize-none focus:outline-hidden focus:ring-2 focus:ring-blue-500/25 focus:border-blue-500"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                    Marca
                  </label>
                  <input
                    value={marca}
                    onChange={(e) => setMarca(e.target.value)}
                    placeholder="Ej: Libus"
                    className="w-full min-h-12 px-4 py-3 border border-slate-200 rounded-xl text-base sm:text-sm font-medium focus:outline-hidden focus:ring-2 focus:ring-blue-500/25 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                    Modelo
                  </label>
                  <input
                    value={modelo}
                    onChange={(e) => setModelo(e.target.value)}
                    placeholder="Ej: Argon"
                    className="w-full min-h-12 px-4 py-3 border border-slate-200 rounded-xl text-base sm:text-sm font-medium focus:outline-hidden focus:ring-2 focus:ring-blue-500/25 focus:border-blue-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                  Certificación / Norma
                </label>
                <input
                  value={certificacion}
                  onChange={(e) => setCertificacion(e.target.value)}
                  placeholder="Ej: IRAM 3610"
                  className="w-full min-h-12 px-4 py-3 border border-slate-200 rounded-xl text-base sm:text-sm font-medium focus:outline-hidden focus:ring-2 focus:ring-blue-500/25 focus:border-blue-500"
                />
              </div>
              <FileImagePicker
                file={foto}
                onChange={setFoto}
                previewUrl={editing?.foto_url}
                label="Foto del EPP"
              />
            </div>

            <div className="sticky bottom-0 flex gap-2 bg-white border-t border-slate-100 px-6 py-4 rounded-b-2xl">
              <button
                type="button"
                onClick={reset}
                className="flex-1 min-h-12 py-3 border border-slate-200 rounded-xl text-sm font-bold cursor-pointer hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={saving}
                className="flex-1 min-h-12 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-bold cursor-pointer disabled:opacity-50"
              >
                {saving ? "Guardando..." : editing ? "Guardar cambios" : "Crear EPP"}
              </button>
            </div>
          </form>
        </div>
      )}

      {pendingDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
          <div className="bg-white w-full max-w-sm rounded-2xl p-6 space-y-4 text-center shadow-xl">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-50 text-rose-600">
              <Trash2 className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-900">
                ¿Eliminar {pendingDelete.nombre}?
              </h3>
              <p className="mt-1.5 text-xs text-slate-500 font-semibold leading-relaxed">
                Se oculta del catálogo. Las entregas ya registradas no se borran.
              </p>
            </div>
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => setPendingDelete(null)}
                className="flex-1 min-h-12 py-3 border border-slate-200 rounded-xl text-sm font-bold cursor-pointer hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={saving}
                className="flex-1 min-h-12 py-3 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-sm font-bold cursor-pointer disabled:opacity-50"
              >
                {saving ? "Eliminando..." : "Eliminar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
