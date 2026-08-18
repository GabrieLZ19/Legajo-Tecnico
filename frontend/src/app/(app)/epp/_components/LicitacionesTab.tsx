"use client";

import { useMemo, useState } from "react";
import { Copy, Layers, Plus, Send } from "lucide-react";
import type { EppLicitacion, EppProveedor, EppTipo } from "@/types";
import { useEpp } from "@/hooks/useEpp";
import { useAlert } from "@/context/AlertContext";

type LicitacionesTabProps = {
  licitaciones: EppLicitacion[];
  proveedores: EppProveedor[];
  tipos: EppTipo[];
  empresaId: string;
  canEdit: boolean;
  onChanged: () => Promise<void>;
};

export function LicitacionesTab({
  licitaciones,
  proveedores,
  tipos,
  empresaId,
  canEdit,
  onChanged,
}: LicitacionesTabProps) {
  const { crearProveedor, crearLicitacion } = useEpp();
  const { showAlert } = useAlert();
  const [showForm, setShowForm] = useState(false);
  const [titulo, setTitulo] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [itemIds, setItemIds] = useState<Record<string, number>>({});
  const [provIds, setProvIds] = useState<string[]>([]);
  const [nuevoProv, setNuevoProv] = useState({ nombre: "", email: "" });
  const [saving, setSaving] = useState(false);
  const [savingProv, setSavingProv] = useState(false);

  const activos = useMemo(() => proveedores.filter((p) => p.activo), [proveedores]);

  const toggleProv = (id: string) => {
    setProvIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const handleCreateProv = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nuevoProv.nombre.trim() || !nuevoProv.email.trim()) {
      showAlert("warning", "Faltan datos", "Completá nombre y correo del proveedor.");
      return;
    }
    setSavingProv(true);
    try {
      const created = await crearProveedor(nuevoProv);
      setProvIds((prev) => (prev.includes(created.id) ? prev : [...prev, created.id]));
      setNuevoProv({ nombre: "", email: "" });
      await onChanged();
      showAlert("success", "Proveedor guardado", "Quedó seleccionado para esta licitación.");
    } catch {
      showAlert("error", "Error", "No se pudo crear el proveedor.");
    } finally {
      setSavingProv(false);
    }
  };

  const handleCreateLic = async (e: React.FormEvent) => {
    e.preventDefault();
    const items = Object.entries(itemIds)
      .filter(([, qty]) => qty > 0)
      .map(([epp_tipo_id, cantidad]) => ({ epp_tipo_id, cantidad }));

    if (items.length === 0) {
      showAlert(
        "warning",
        "Falta el EPP",
        "Indicá una cantidad mayor a 0 en al menos un elemento del catálogo.",
      );
      return;
    }

    let selectedProveedores = [...provIds];
    if (
      selectedProveedores.length === 0 &&
      nuevoProv.nombre.trim() &&
      nuevoProv.email.trim()
    ) {
      try {
        const created = await crearProveedor(nuevoProv);
        selectedProveedores = [created.id];
        setNuevoProv({ nombre: "", email: "" });
      } catch {
        showAlert("error", "Error", "No se pudo guardar el proveedor antes de crear la licitación.");
        return;
      }
    }

    if (selectedProveedores.length === 0) {
      showAlert(
        "warning",
        "Falta el proveedor",
        "Completá nombre y correo, o tocá un proveedor guardado para marcarlo en azul.",
      );
      return;
    }

    setSaving(true);
    try {
      await crearLicitacion({
        empresa_id: empresaId,
        titulo,
        descripcion,
        proveedor_ids: selectedProveedores,
        items,
      });
      setTitulo("");
      setDescripcion("");
      setItemIds({});
      setProvIds([]);
      setShowForm(false);
      await onChanged();
      showAlert("success", "Licitación creada", "Ya podés copiar o enviar los enlaces de cotización.");
    } catch {
      showAlert("error", "Error", "No se pudo crear la licitación.");
    } finally {
      setSaving(false);
    }
  };

  const copyLink = async (url: string) => {
    await navigator.clipboard.writeText(url);
    showAlert("success", "Enlace copiado", "Pegalo en el mail o WhatsApp del proveedor.");
  };

  return (
    <div className="space-y-6">
      {canEdit && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => setShowForm((v) => !v)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-slate-900 text-white text-xs font-bold rounded-xl cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            Nueva licitación
          </button>
        </div>
      )}

      {showForm && (
        <div className="bg-white rounded-3xl border border-slate-100 p-6 space-y-6">
          <form onSubmit={handleCreateProv} className="space-y-2">
            <p className="text-[11px] font-black uppercase tracking-wider text-slate-400">
              1. Proveedores a invitar
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <input
                value={nuevoProv.nombre}
                onChange={(e) => setNuevoProv((p) => ({ ...p, nombre: e.target.value }))}
                placeholder="Nombre del proveedor"
                className="px-3 py-2.5 border border-slate-200 rounded-xl text-sm"
              />
              <input
                type="email"
                value={nuevoProv.email}
                onChange={(e) => setNuevoProv((p) => ({ ...p, email: e.target.value }))}
                placeholder="correo@proveedor.com"
                className="px-3 py-2.5 border border-slate-200 rounded-xl text-sm"
              />
              <button
                type="submit"
                disabled={savingProv}
                className="bg-slate-900 text-white rounded-xl text-xs font-bold cursor-pointer disabled:opacity-50"
              >
                {savingProv ? "Guardando..." : "Guardar y seleccionar"}
              </button>
            </div>
          </form>

          {activos.length > 0 ? (
            <div className="space-y-2">
              <p className="text-[11px] font-semibold text-slate-500">
                Tocá un proveedor para invitarlo. Los seleccionados quedan en azul.
              </p>
              <div className="flex flex-wrap gap-2">
                {activos.map((prov) => (
                  <button
                    type="button"
                    key={prov.id}
                    onClick={() => toggleProv(prov.id)}
                    className={`px-3 py-1.5 rounded-full text-xs font-bold cursor-pointer ${
                      provIds.includes(prov.id)
                        ? "bg-blue-600 text-white"
                        : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {prov.nombre}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-xs text-slate-400 font-semibold">
              Todavía no hay proveedores. Completá nombre y correo y pulsá Guardar.
            </p>
          )}

          <form onSubmit={handleCreateLic} className="space-y-4">
            <p className="text-[11px] font-black uppercase tracking-wider text-slate-400">
              2. Pedido de cotización
            </p>
            <input
              required
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Título de la solicitud"
              className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm font-bold"
            />
            <textarea
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              placeholder="Detalle o cantidades estimadas"
              rows={2}
              className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm resize-none"
            />

            <p className="text-[11px] font-semibold text-slate-500">
              Cantidad de cada EPP a cotizar (poné 1 o más en los que apliquen).
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {tipos.map((tipo) => (
                <label key={tipo.id} className="flex items-center gap-3 border border-slate-200 rounded-xl p-3">
                  <input
                    type="number"
                    min={0}
                    value={itemIds[tipo.id] ?? 0}
                    onChange={(e) =>
                      setItemIds((prev) => ({ ...prev, [tipo.id]: parseInt(e.target.value, 10) || 0 }))
                    }
                    className="w-16 px-2 py-1 border rounded-lg text-sm"
                  />
                  <span className="text-sm font-semibold text-slate-700">{tipo.nombre}</span>
                </label>
              ))}
            </div>

            <button
              type="submit"
              disabled={saving}
              className="w-full py-3 bg-blue-600 text-white rounded-xl text-sm font-bold cursor-pointer disabled:opacity-50"
            >
              {saving ? "Creando..." : "Crear solicitud y generar enlaces"}
            </button>
          </form>
        </div>
      )}

      {licitaciones.length === 0 && !showForm ? (
        <div className="bg-white rounded-3xl border border-slate-100 p-12 text-center">
          <Layers className="h-8 w-8 text-amber-500 mx-auto mb-3" />
          <h3 className="text-sm font-bold text-slate-800">Sin licitaciones</h3>
          <p className="text-xs text-slate-400 mt-2 max-w-sm mx-auto">
            Pedí cotizaciones a proveedores homologados. El sistema calcula la comisión
            configurada; el cobro online queda fuera de alcance.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {licitaciones.map((lic) => (
            <article key={lic.id} className="bg-white rounded-3xl border border-slate-100 p-5 space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-sm font-black text-slate-900">{lic.titulo}</h3>
                  <p className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider">
                    {lic.estado} · comisión {lic.comision_porcentaje ?? 0}%
                  </p>
                </div>
              </div>
              <ul className="space-y-2">
                {(lic.epp_licitacion_cotizaciones ?? []).map((cot) => {
                  const mailto = `mailto:${cot.proveedor_email ?? ""}?subject=${encodeURIComponent(
                    `Cotización EPP: ${lic.titulo}`,
                  )}&body=${encodeURIComponent(
                    `Hola ${cot.proveedor_nombre},\n\nCargá tu cotización en: ${cot.url_carga ?? ""}`,
                  )}`;
                  const wa = `https://wa.me/?text=${encodeURIComponent(
                    `Cotización EPP ${lic.titulo}: ${cot.url_carga ?? ""}`,
                  )}`;
                  return (
                    <li
                      key={cot.id}
                      className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border border-slate-100 rounded-xl p-3"
                    >
                      <div>
                        <p className="text-sm font-bold text-slate-800">{cot.proveedor_nombre}</p>
                        <p className="text-[11px] text-slate-400">
                          {cot.estado === "cargada"
                            ? `$${cot.monto ?? 0} · comisión $${cot.comision_calculada ?? 0}`
                            : "Pendiente de carga"}
                        </p>
                      </div>
                      {cot.url_carga && (
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => copyLink(cot.url_carga!)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-slate-100 rounded-lg text-[11px] font-bold cursor-pointer"
                          >
                            <Copy className="h-3 w-3" /> Copiar
                          </button>
                          <a
                            href={mailto}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-blue-50 text-blue-700 rounded-lg text-[11px] font-bold"
                          >
                            <Send className="h-3 w-3" /> Mail
                          </a>
                          <a
                            href={wa}
                            target="_blank"
                            rel="noreferrer"
                            className="px-2.5 py-1.5 bg-emerald-50 text-emerald-700 rounded-lg text-[11px] font-bold"
                          >
                            WhatsApp
                          </a>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
