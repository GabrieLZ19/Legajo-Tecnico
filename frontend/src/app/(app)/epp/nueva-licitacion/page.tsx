"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Layers,
  Package,
  Plus,
  Sparkles,
  User,
  Users,
  X,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useEpp } from "@/hooks/useEpp";
import { useAlert } from "@/context/AlertContext";
import type { EppProveedor, EppProveedorSugerido, EppTipo } from "@/types";
import {
  emptyProveedorFicha,
  ProveedorFichaFields,
  type ProveedorFichaForm,
} from "../_components/ProveedorFichaFields";
import {
  isValidEmail,
  isValidTelefono,
  sanitizeTelefonoInput,
  validateProveedorFicha,
} from "@/lib/proveedorValidation";
import { canWriteAppModule } from "@/lib/moduleAccess";
import { eppProveedoresSugeridosService } from "@/utils/services/eppProveedoresSugeridos.service";

type Step = 1 | 2 | 3 | 4;

const STEPS: Array<{ id: Step; label: string; hint: string }> = [
  { id: 1, label: "Proveedores", hint: "A quién invitás" },
  { id: 2, label: "Comprador", hint: "Quién compra" },
  { id: 3, label: "Pedido", hint: "Qué cotizar" },
  { id: 4, label: "Revisar", hint: "Confirmar" },
];

type ManualItem = { id: string; nombre: string; cantidad: number };

export default function NuevaLicitacionPage() {
  const router = useRouter();
  const { user, empresa } = useAuth();
  const { getProveedores, getTiposEpp, crearProveedor, crearLicitacion } = useEpp();
  const { showAlert } = useAlert();

  const canCreate = canWriteAppModule(user, "epp");

  const [step, setStep] = useState<Step>(1);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingProv, setSavingProv] = useState(false);

  const [proveedores, setProveedores] = useState<EppProveedor[]>([]);
  const [tipos, setTipos] = useState<EppTipo[]>([]);
  const [provIds, setProvIds] = useState<string[]>([]);
  const [showAltaProv, setShowAltaProv] = useState(false);
  const [nuevoProv, setNuevoProv] = useState<ProveedorFichaForm>(emptyProveedorFicha());
  const [showSugeridosLt, setShowSugeridosLt] = useState(false);
  const [sugeridosLt, setSugeridosLt] = useState<EppProveedorSugerido[]>([]);
  const [loadingSugeridos, setLoadingSugeridos] = useState(false);
  const [adoptingId, setAdoptingId] = useState<string | null>(null);

  const [comprador, setComprador] = useState({
    nombre: "",
    email: "",
    telefono: "",
  });

  const [titulo, setTitulo] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [itemIds, setItemIds] = useState<Record<string, number>>({});
  const [manualItems, setManualItems] = useState<ManualItem[]>([]);
  const [showManualForm, setShowManualForm] = useState(false);
  const [manualNombre, setManualNombre] = useState("");
  const [manualCantidad, setManualCantidad] = useState(1);

  const activos = useMemo(() => proveedores.filter((p) => p.activo), [proveedores]);
  const seleccionados = useMemo(
    () => activos.filter((p) => provIds.includes(p.id)),
    [activos, provIds],
  );

  const catalogItems = useMemo(
    () =>
      Object.entries(itemIds)
        .filter(([, qty]) => qty > 0)
        .map(([id, cantidad]) => ({
          id,
          nombre: tipos.find((t) => t.id === id)?.nombre || "EPP",
          cantidad,
        })),
    [itemIds, tipos],
  );

  const totalItems = catalogItems.length + manualItems.length;

  useEffect(() => {
    if (!canCreate) {
      router.replace("/epp");
      return;
    }
    const load = async () => {
      setLoading(true);
      try {
        const [provRes, tiposRes] = await Promise.all([
          getProveedores(),
          getTiposEpp(false),
        ]);
        setProveedores(provRes.proveedores || []);
        setTipos((tiposRes.tipos || []).filter((t: EppTipo) => t.activo));
      } catch {
        showAlert("error", "Error", "No se pudieron cargar proveedores o catálogo.");
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [canCreate, empresa?.id]);

  const toggleProv = (id: string) => {
    setProvIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const openSugeridosLt = async () => {
    setShowSugeridosLt(true);
    setLoadingSugeridos(true);
    try {
      const data = await eppProveedoresSugeridosService.listar("aprobada");
      setSugeridosLt(data);
    } catch {
      showAlert("error", "Error", "No se pudo cargar la lista sugerida por LT.");
      setShowSugeridosLt(false);
    } finally {
      setLoadingSugeridos(false);
    }
  };

  const adoptarSugerido = async (sugerido: EppProveedorSugerido) => {
    setAdoptingId(sugerido.id);
    try {
      const { proveedor, creado } = await eppProveedoresSugeridosService.adoptar(
        sugerido.id,
      );
      setProveedores((prev) => {
        const without = prev.filter((p) => p.id !== proveedor.id);
        return [...without, proveedor].sort((a, b) =>
          a.nombre.localeCompare(b.nombre),
        );
      });
      setProvIds((prev) =>
        prev.includes(proveedor.id) ? prev : [...prev, proveedor.id],
      );
      showAlert(
        "success",
        creado ? "Proveedor agregado" : "Proveedor seleccionado",
        creado
          ? `${proveedor.nombre} se sumó a tu agenda y quedó invitado.`
          : `${proveedor.nombre} ya estaba en tu agenda; quedó seleccionado.`,
      );
    } catch {
      showAlert("error", "Error", "No se pudo agregar el proveedor sugerido.");
    } finally {
      setAdoptingId(null);
    }
  };

  const handleCreateProv = async (e: React.FormEvent) => {
    e.preventDefault();
    const err = validateProveedorFicha(nuevoProv);
    if (err) {
      showAlert("warning", "Datos inválidos", err);
      return;
    }
    setSavingProv(true);
    try {
      const created = await crearProveedor({
        nombre: nuevoProv.nombre.trim(),
        email: nuevoProv.email.trim(),
        direccion: nuevoProv.direccion.trim() || undefined,
        telefono: nuevoProv.telefono.trim() || undefined,
      });
      setProveedores((prev) =>
        [...prev, created].sort((a, b) => a.nombre.localeCompare(b.nombre)),
      );
      setProvIds((prev) => (prev.includes(created.id) ? prev : [...prev, created.id]));
      setNuevoProv(emptyProveedorFicha());
      setShowAltaProv(false);
      showAlert("success", "Proveedor guardado", "Quedó seleccionado para esta licitación.");
    } catch {
      showAlert("error", "Error", "No se pudo crear el proveedor.");
    } finally {
      setSavingProv(false);
    }
  };

  const addManualItem = () => {
    if (!manualNombre.trim() || manualCantidad < 1) {
      showAlert("warning", "Ítem incompleto", "Indicá nombre y cantidad del EPP manual.");
      return;
    }
    setManualItems((prev) => [
      ...prev,
      {
        id: `manual-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        nombre: manualNombre.trim(),
        cantidad: manualCantidad,
      },
    ]);
    setManualNombre("");
    setManualCantidad(1);
    setShowManualForm(false);
  };

  const validateStep = (s: Step): boolean => {
    if (s === 1) {
      if (provIds.length === 0) {
        showAlert(
          "warning",
          "Elegí proveedores",
          "Seleccioná al menos un proveedor o cargá uno nuevo.",
        );
        return false;
      }
      return true;
    }
    if (s === 2) {
      if (!comprador.nombre.trim() || comprador.nombre.trim().length < 2) {
        showAlert("warning", "Falta el comprador", "Indicá el nombre del responsable.");
        return false;
      }
      if (!isValidEmail(comprador.email)) {
        showAlert("warning", "Mail inválido", "Ingresá un correo válido del comprador.");
        return false;
      }
      if (!isValidTelefono(comprador.telefono, { required: true })) {
        showAlert(
          "warning",
          "Teléfono inválido",
          "El teléfono solo admite números (mínimo 6 dígitos).",
        );
        return false;
      }
      return true;
    }
    if (s === 3) {
      if (titulo.trim().length < 3) {
        showAlert("warning", "Falta el título", "Poné un título de al menos 3 caracteres.");
        return false;
      }
      if (totalItems === 0) {
        showAlert(
          "warning",
          "Falta el EPP",
          "Indicá cantidad en el catálogo o insertá un ítem manual.",
        );
        return false;
      }
      return true;
    }
    return true;
  };

  const goNext = () => {
    if (!validateStep(step)) return;
    setStep((s) => Math.min(4, s + 1) as Step);
  };

  const goBack = () => {
    if (step === 1) {
      router.push("/epp");
      return;
    }
    setStep((s) => Math.max(1, s - 1) as Step);
  };

  const handleSubmit = async () => {
    if (!empresa?.id) return;
    if (!validateStep(1) || !validateStep(2) || !validateStep(3)) return;

    const items = [
      ...catalogItems.map((i) => ({ epp_tipo_id: i.id, cantidad: i.cantidad })),
      ...manualItems.map((m) => ({
        nombre_manual: m.nombre,
        cantidad: m.cantidad,
      })),
    ];

    setSaving(true);
    try {
      await crearLicitacion({
        empresa_id: empresa.id,
        titulo: titulo.trim(),
        descripcion: descripcion.trim() || undefined,
        comprador_nombre: comprador.nombre.trim(),
        comprador_email: comprador.email.trim(),
        comprador_telefono: comprador.telefono.trim(),
        proveedor_ids: provIds,
        items,
      });
      showAlert("success", "Licitación creada", "Ya podés copiar o enviar los enlaces.");
      router.push("/epp");
    } catch {
      showAlert("error", "Error", "No se pudo crear la licitación.");
    } finally {
      setSaving(false);
    }
  };

  if (!canCreate) return null;

  return (
    <div className="mx-auto max-w-7xl space-y-6 pb-10">
      <div className="flex items-start gap-3">
        <Link
          href="/epp"
          className="mt-0.5 inline-flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 cursor-pointer"
          aria-label="Volver a EPP"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="min-w-0">
          <p className="text-[11px] font-black uppercase tracking-wider text-slate-400">
            Licitación EPP
          </p>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            Nueva solicitud de cotización
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Completá cada paso. Al final vas a generar los enlaces para los proveedores.
          </p>
        </div>
      </div>

      <nav aria-label="Progreso" className="bg-white rounded-3xl border border-slate-100 p-3 sm:p-4">
        <ol className="grid grid-cols-4 gap-2">
          {STEPS.map((s) => {
            const active = step === s.id;
            const done = step > s.id;
            return (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => {
                    if (s.id < step) setStep(s.id);
                    else if (s.id === step + 1) goNext();
                  }}
                  className={`w-full rounded-2xl px-2 py-3 text-left transition-colors cursor-pointer ${
                    active
                      ? "bg-blue-600 text-white"
                      : done
                        ? "bg-emerald-50 text-emerald-800"
                        : "bg-slate-50 text-slate-400"
                  }`}
                >
                  <span className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider">
                    {done ? <Check className="h-3 w-3" /> : `0${s.id}`}
                    <span className="hidden sm:inline">{s.label}</span>
                  </span>
                  <span
                    className={`mt-1 block text-xs font-bold truncate sm:hidden ${
                      active ? "text-white" : ""
                    }`}
                  >
                    {s.label}
                  </span>
                  <span
                    className={`mt-0.5 hidden sm:block text-[11px] font-semibold ${
                      active ? "text-blue-100" : done ? "text-emerald-700/80" : "text-slate-400"
                    }`}
                  >
                    {s.hint}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      </nav>

      {loading ? (
        <div className="bg-white rounded-3xl border border-slate-100 p-12 flex flex-col items-center">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-600" />
          <p className="text-xs text-slate-400 mt-3 font-semibold">Cargando…</p>
        </div>
      ) : (
        <section className="bg-white rounded-3xl border border-slate-100 p-5 sm:p-7 shadow-2xs space-y-5">
          {step === 1 && (
            <div className="space-y-5">
              <header className="flex items-start gap-3">
                <div className="h-11 w-11 rounded-2xl bg-blue-50 text-blue-700 flex items-center justify-center shrink-0">
                  <Users className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-base font-black text-slate-900">Proveedores a invitar</h2>
                  <p className="text-sm text-slate-500 mt-0.5">
                    Tocá para seleccionar. Los marcados en azul reciben el enlace.
                  </p>
                </div>
              </header>

              {activos.length === 0 && !showAltaProv ? (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center">
                  <p className="text-sm font-bold text-slate-700">Todavía no hay proveedores</p>
                  <p className="text-xs text-slate-400 mt-1">
                    Usá los sugeridos por LT o cargá uno nuevo.
                  </p>
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {activos.map((prov) => {
                    const selected = provIds.includes(prov.id);
                    return (
                      <button
                        type="button"
                        key={prov.id}
                        onClick={() => toggleProv(prov.id)}
                        className={`min-h-11 px-4 py-2.5 rounded-2xl text-sm font-bold border transition-colors cursor-pointer ${
                          selected
                            ? "bg-blue-600 border-blue-600 text-white"
                            : "bg-white border-slate-200 text-slate-600 hover:border-blue-300"
                        }`}
                      >
                        {prov.nombre}
                      </button>
                    );
                  })}
                </div>
              )}

              {seleccionados.length > 0 && (
                <p className="text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-xl px-3 py-2">
                  {seleccionados.length} proveedor
                  {seleccionados.length === 1 ? "" : "es"} seleccionado
                  {seleccionados.length === 1 ? "" : "s"}
                </p>
              )}

              {!showAltaProv ? (
                <div className="grid sm:grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => void openSugeridosLt()}
                    className="inline-flex items-center justify-center gap-2 w-full min-h-12 px-4 py-3 bg-teal-50 border border-teal-200 hover:bg-teal-100 text-teal-900 rounded-xl text-sm font-bold cursor-pointer"
                  >
                    <Sparkles className="h-4 w-4" />
                    Proveedores sugeridos por LT
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setNuevoProv(emptyProveedorFicha());
                      setShowAltaProv(true);
                    }}
                    className="inline-flex items-center justify-center gap-2 w-full min-h-12 px-4 py-3 border border-dashed border-slate-300 hover:border-blue-400 hover:bg-blue-50/40 text-slate-700 rounded-xl text-sm font-bold cursor-pointer"
                  >
                    <Plus className="h-4 w-4" />
                    Cargar nuevo proveedor
                  </button>
                </div>
              ) : (
                <form
                  onSubmit={handleCreateProv}
                  className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4 space-y-3"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[11px] font-black uppercase tracking-wider text-slate-500">
                      Ficha del nuevo proveedor
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setShowAltaProv(false);
                        setNuevoProv(emptyProveedorFicha());
                      }}
                      className="text-[11px] font-bold text-slate-400 hover:text-slate-700 cursor-pointer"
                    >
                      Cancelar
                    </button>
                  </div>
                  <ProveedorFichaFields
                    value={nuevoProv}
                    onChange={setNuevoProv}
                    idPrefix="nueva-lic-prov"
                  />
                  <button
                    type="submit"
                    disabled={savingProv}
                    className="w-full min-h-12 px-4 py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-sm font-bold cursor-pointer disabled:opacity-50"
                  >
                    {savingProv ? "Guardando..." : "Guardar y seleccionar"}
                  </button>
                </form>
              )}
            </div>
          )}

          {step === 2 && (
            <div className="space-y-5">
              <header className="flex items-start gap-3">
                <div className="h-11 w-11 rounded-2xl bg-blue-50 text-blue-700 flex items-center justify-center shrink-0">
                  <User className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-base font-black text-slate-900">Responsable de la compra</h2>
                  <p className="text-sm text-slate-500 mt-0.5">
                    Estos datos se muestran al proveedor en el enlace de cotización.
                  </p>
                </div>
              </header>
              <div className="grid grid-cols-1 gap-3">
                <label className="block space-y-1.5">
                  <span className="text-[11px] font-bold text-slate-500 uppercase">Nombre</span>
                  <input
                    required
                    minLength={2}
                    value={comprador.nombre}
                    onChange={(e) => setComprador((c) => ({ ...c, nombre: e.target.value }))}
                    placeholder="Nombre y apellido"
                    className="w-full min-h-12 px-4 py-3 border border-slate-200 rounded-xl text-base sm:text-sm font-semibold"
                  />
                </label>
                <label className="block space-y-1.5">
                  <span className="text-[11px] font-bold text-slate-500 uppercase">Mail</span>
                  <input
                    required
                    type="email"
                    inputMode="email"
                    value={comprador.email}
                    onChange={(e) => setComprador((c) => ({ ...c, email: e.target.value }))}
                    placeholder="mail@empresa.com"
                    className="w-full min-h-12 px-4 py-3 border border-slate-200 rounded-xl text-base sm:text-sm font-semibold"
                  />
                </label>
                <label className="block space-y-1.5">
                  <span className="text-[11px] font-bold text-slate-500 uppercase">Teléfono</span>
                  <input
                    required
                    type="tel"
                    inputMode="tel"
                    value={comprador.telefono}
                    onChange={(e) =>
                      setComprador((c) => ({
                        ...c,
                        telefono: sanitizeTelefonoInput(e.target.value),
                      }))
                    }
                    placeholder="11 5555-5555"
                    className="w-full min-h-12 px-4 py-3 border border-slate-200 rounded-xl text-base sm:text-sm font-semibold"
                  />
                </label>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-5">
              <header className="flex items-start gap-3">
                <div className="h-11 w-11 rounded-2xl bg-blue-50 text-blue-700 flex items-center justify-center shrink-0">
                  <Package className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-base font-black text-slate-900">Pedido de cotización</h2>
                  <p className="text-sm text-slate-500 mt-0.5">
                    Título, detalle y cantidades de cada EPP.
                  </p>
                </div>
              </header>

              <label className="block space-y-1.5">
                <span className="text-[11px] font-bold text-slate-500 uppercase">Título</span>
                <input
                  required
                  value={titulo}
                  onChange={(e) => setTitulo(e.target.value)}
                  placeholder="Ej. Compra de ropa de trabajo"
                  className="w-full min-h-12 px-4 py-3 border border-slate-200 rounded-xl text-base sm:text-sm font-bold"
                />
              </label>
              <label className="block space-y-1.5">
                <span className="text-[11px] font-bold text-slate-500 uppercase">
                  Detalle (opcional)
                </span>
                <textarea
                  value={descripcion}
                  onChange={(e) => setDescripcion(e.target.value)}
                  placeholder="Notas o cantidades estimadas"
                  rows={3}
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl text-base sm:text-sm resize-none"
                />
              </label>

              <div className="space-y-2">
                <p className="text-[11px] font-bold text-slate-500 uppercase">
                  Del catálogo
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {tipos.map((tipo) => (
                    <label
                      key={tipo.id}
                      className="flex items-center gap-3 border border-slate-200 rounded-xl p-3 hover:border-blue-200"
                    >
                      <input
                        type="number"
                        min={0}
                        value={itemIds[tipo.id] ?? 0}
                        onChange={(e) =>
                          setItemIds((prev) => ({
                            ...prev,
                            [tipo.id]: parseInt(e.target.value, 10) || 0,
                          }))
                        }
                        className="w-16 min-h-11 px-2 py-2 border rounded-lg text-base sm:text-sm"
                      />
                      <span className="text-sm font-semibold text-slate-700 leading-snug">
                        {tipo.nombre}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              {manualItems.length > 0 && (
                <ul className="space-y-2">
                  {manualItems.map((item) => (
                    <li
                      key={item.id}
                      className="flex items-center justify-between gap-3 border border-amber-200 bg-amber-50/60 rounded-xl px-3 py-2.5"
                    >
                      <p className="text-sm font-semibold text-slate-800 min-w-0 truncate">
                        {item.cantidad} × {item.nombre}
                        <span className="ml-2 text-[10px] font-bold uppercase text-amber-700">
                          Manual
                        </span>
                      </p>
                      <button
                        type="button"
                        onClick={() =>
                          setManualItems((prev) => prev.filter((m) => m.id !== item.id))
                        }
                        className="text-[11px] font-bold text-rose-600 cursor-pointer shrink-0"
                      >
                        Quitar
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              {!showManualForm ? (
                <button
                  type="button"
                  onClick={() => setShowManualForm(true)}
                  className="inline-flex items-center justify-center gap-2 w-full min-h-11 px-4 py-2.5 border border-dashed border-slate-300 hover:border-blue-400 hover:bg-blue-50/40 text-slate-700 rounded-xl text-sm font-bold cursor-pointer"
                >
                  <Plus className="h-4 w-4" />
                  Insertar manual
                </button>
              ) : (
                <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[11px] font-black uppercase tracking-wider text-slate-500">
                      Ítem fuera del catálogo
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setShowManualForm(false);
                        setManualNombre("");
                        setManualCantidad(1);
                      }}
                      className="text-[11px] font-bold text-slate-400 hover:text-slate-700 cursor-pointer"
                    >
                      Cancelar
                    </button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-[1fr_100px_auto] gap-3">
                    <input
                      value={manualNombre}
                      onChange={(e) => setManualNombre(e.target.value)}
                      placeholder="Nombre del EPP / producto"
                      className="min-h-12 px-4 py-3 border border-slate-200 rounded-xl text-base sm:text-sm bg-white"
                    />
                    <input
                      type="number"
                      min={1}
                      value={manualCantidad}
                      onChange={(e) =>
                        setManualCantidad(Math.max(1, parseInt(e.target.value, 10) || 1))
                      }
                      className="min-h-12 px-3 py-3 border border-slate-200 rounded-xl text-base sm:text-sm bg-white"
                      aria-label="Cantidad"
                    />
                    <button
                      type="button"
                      onClick={addManualItem}
                      className="min-h-12 px-4 py-3 bg-slate-900 text-white rounded-xl text-sm font-bold cursor-pointer"
                    >
                      Agregar
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {step === 4 && (
            <div className="space-y-5">
              <header className="flex items-start gap-3">
                <div className="h-11 w-11 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0">
                  <Layers className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-base font-black text-slate-900">Revisá y creá</h2>
                  <p className="text-sm text-slate-500 mt-0.5">
                    Si todo está bien, generamos los enlaces de cotización.
                  </p>
                </div>
              </header>

              <div className="space-y-3">
                <ReviewBlock title="Proveedores">
                  {seleccionados.map((p) => p.nombre).join(", ") || "—"}
                </ReviewBlock>
                <ReviewBlock title="Comprador">
                  {comprador.nombre}
                  <br />
                  <span className="text-slate-500 font-semibold">
                    {comprador.email} · {comprador.telefono}
                  </span>
                </ReviewBlock>
                <ReviewBlock title="Solicitud">
                  <span className="font-black text-slate-900">{titulo}</span>
                  {descripcion ? (
                    <>
                      <br />
                      <span className="text-slate-500 font-semibold">{descripcion}</span>
                    </>
                  ) : null}
                </ReviewBlock>
                <ReviewBlock title="Ítems">
                  <ul className="space-y-1 mt-1">
                    {catalogItems.map((i) => (
                      <li key={i.id}>
                        {i.cantidad} × {i.nombre}
                      </li>
                    ))}
                    {manualItems.map((i) => (
                      <li key={i.id}>
                        {i.cantidad} × {i.nombre}{" "}
                        <span className="text-[10px] font-bold uppercase text-amber-700">
                          Manual
                        </span>
                      </li>
                    ))}
                  </ul>
                </ReviewBlock>
              </div>
            </div>
          )}

          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={goBack}
              className="inline-flex items-center justify-center gap-2 w-full sm:w-auto min-h-12 px-5 py-3 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 cursor-pointer"
            >
              <ArrowLeft className="h-4 w-4" />
              {step === 1 ? "Cancelar" : "Anterior"}
            </button>
            {step < 4 ? (
              <button
                type="button"
                onClick={goNext}
                className="inline-flex items-center justify-center gap-2 w-full sm:w-auto min-h-12 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-bold cursor-pointer"
              >
                Continuar
                <ArrowRight className="h-4 w-4" />
              </button>
            ) : (
              <button
                type="button"
                disabled={saving}
                onClick={() => void handleSubmit()}
                className="inline-flex items-center justify-center gap-2 w-full sm:w-auto min-h-12 px-6 py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-sm font-bold cursor-pointer disabled:opacity-50"
              >
                {saving ? "Creando…" : "Crear solicitud"}
              </button>
            )}
          </div>
        </section>
      )}

      {showSugeridosLt && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/50 p-0 sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="sugeridos-lt-title"
          onClick={() => setShowSugeridosLt(false)}
        >
          <div
            className="w-full sm:max-w-lg max-h-[85vh] overflow-hidden rounded-t-3xl sm:rounded-3xl bg-white shadow-xl flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-3 border-b border-slate-100">
              <div className="flex items-start gap-3 min-w-0">
                <div className="h-10 w-10 rounded-2xl bg-teal-50 text-teal-700 flex items-center justify-center shrink-0">
                  <Sparkles className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <h3
                    id="sugeridos-lt-title"
                    className="text-base font-black text-slate-900"
                  >
                    Proveedores sugeridos por LT
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Elegí uno para sumarlo a tu agenda e invitarlo.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowSugeridosLt(false)}
                className="p-2 rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-700 cursor-pointer"
                aria-label="Cerrar"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-2">
              {loadingSugeridos ? (
                <p className="text-sm text-slate-500 py-8 text-center">Cargando…</p>
              ) : sugeridosLt.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center">
                  <p className="text-sm font-bold text-slate-700">
                    Todavía no hay sugeridos publicados
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    Cuando LT apruebe proveedores, van a aparecer acá.
                  </p>
                </div>
              ) : (
                sugeridosLt.map((s) => {
                  const yaInvitado = proveedores.some(
                    (p) =>
                      p.email.trim().toLowerCase() === s.email.trim().toLowerCase() &&
                      provIds.includes(p.id),
                  );
                  return (
                    <button
                      key={s.id}
                      type="button"
                      disabled={adoptingId === s.id}
                      onClick={() => void adoptarSugerido(s)}
                      className="w-full text-left rounded-2xl border border-slate-200 hover:border-teal-300 hover:bg-teal-50/40 px-4 py-3 transition-colors cursor-pointer disabled:opacity-60"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-black text-slate-900 truncate">
                            {s.nombre}
                          </p>
                          <p className="text-xs text-slate-500 truncate mt-0.5">
                            {s.email}
                            {s.telefono ? ` · ${s.telefono}` : ""}
                          </p>
                          {s.direccion ? (
                            <p className="text-[11px] text-slate-400 mt-1 line-clamp-2">
                              {s.direccion}
                            </p>
                          ) : null}
                        </div>
                        <span className="shrink-0 text-[10px] font-black uppercase tracking-wide text-teal-700 bg-teal-50 border border-teal-100 rounded-lg px-2 py-1">
                          {adoptingId === s.id
                            ? "Agregando…"
                            : yaInvitado
                              ? "Ya invitado"
                              : "Agregar"}
                        </span>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ReviewBlock({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
      <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">{title}</p>
      <div className="text-sm font-bold text-slate-800 mt-1">{children}</div>
    </div>
  );
}
