"use client";

import React, { useEffect, useMemo, useState, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useRouter } from "next/navigation";
import { EppTipo, Empleado } from "@/types";
import Link from "next/link";
import type SignatureCanvas from "react-signature-canvas";
import {
  HardHat,
  ArrowLeft,
  Save,
  User,
  Hash,
  Calendar,
  Search,
} from "lucide-react";
import { useEpp } from "@/hooks/useEpp";
import { useAlert } from "@/context/AlertContext";
import { EppTipoPicker } from "@/components/EppTipoPicker";
import { FileImagePicker } from "@/components/FileImagePicker";
import SignaturePad, { readSignatureOrThrow } from "@/components/SignaturePad";
import SignatureImageImport from "@/components/SignatureImageImport";
import UsarMiSelloButton from "@/components/UsarMiSelloButton";
import { isSignatureEmpty } from "@/lib/signature";

interface ItemEntrega {
  epp_tipo_id: string;
  cantidad: number;
  marca: string;
  modelo: string;
  certificacion: string;
}

export default function NuevaEntregaEppPage() {
  const router = useRouter();
  const { user, empresa } = useAuth();
  const { getTiposEpp, crearTipoEpp, crearEntregaEpp, getEmpleados } =
    useEpp();
  const { showAlert } = useAlert();

  const [empleados, setEmpleados] = useState<Empleado[]>([]);
  const [busquedaPadron, setBusquedaPadron] = useState("");
  const [nombreEmpleado, setNombreEmpleado] = useState("");
  const [dniEmpleado, setDniEmpleado] = useState("");
  const [empleadoId, setEmpleadoId] = useState<string | null>(null);
  const [fechaEntrega, setFechaEntrega] = useState(
    new Date().toISOString().split("T")[0],
  );
  const [items, setItems] = useState<ItemEntrega[]>([
    { epp_tipo_id: "", cantidad: 1, marca: "", modelo: "", certificacion: "" },
  ]);

  const [tipos, setTipos] = useState<EppTipo[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activePad, setActivePad] = useState<"empleado" | "empleador">("empleado");

  const [showModalEpp, setShowModalEpp] = useState(false);
  const [nuevoEppNombre, setNuevoEppNombre] = useState("");
  const [nuevoEppDescripcion, setNuevoEppDescripcion] = useState("");
  const [nuevoEppMarca, setNuevoEppMarca] = useState("");
  const [nuevoEppModelo, setNuevoEppModelo] = useState("");
  const [nuevoEppCertificacion, setNuevoEppCertificacion] = useState("");
  const [nuevoEppFoto, setNuevoEppFoto] = useState<File | null>(null);
  const [guardandoNuevoEpp, setGuardandoNuevoEpp] = useState(false);
  const [creandoEppParaIndex, setCreandoEppParaIndex] = useState<number | null>(null);

  const sigRef = useRef<SignatureCanvas | null>(null);
  const sigEmpleadorRef = useRef<SignatureCanvas | null>(null);

  const empleadosFiltrados = useMemo(
    () => empleados.filter((e) => e.activo).slice(0, 12),
    [empleados],
  );

  useEffect(() => {
    fetchTipos();
  }, []);

  useEffect(() => {
    if (!empresa?.id) return;
    const q = busquedaPadron.trim();
    const timer = window.setTimeout(() => {
      void getEmpleados(empresa.id, {
        limit: 20,
        offset: 0,
        q: q || undefined,
      }).then((data) => {
        setEmpleados(data.empleados || []);
      });
    }, q ? 300 : 0);
    return () => window.clearTimeout(timer);
  }, [empresa?.id, busquedaPadron, getEmpleados]);

  const fetchTipos = async () => {
    if (!empresa?.id) return;
    try {
      const data = await getTiposEpp(empresa.id);
      setTipos(data.tipos || []);
    } catch (err) {
      console.error("Error cargando tipos:", err);
    }
  };

  const seleccionarEmpleado = (empleado: Empleado) => {
    setEmpleadoId(empleado.id);
    setNombreEmpleado(empleado.nombre);
    setDniEmpleado(empleado.documento);
    setBusquedaPadron(empleado.nombre);
  };

  const limpiarEmpleado = () => {
    setEmpleadoId(null);
    setNombreEmpleado("");
    setDniEmpleado("");
    setBusquedaPadron("");
  };

  const actualizarItem = (
    idx: number,
    field: keyof ItemEntrega,
    value: string | number,
  ) => {
    setItems((prev) =>
      prev.map((item, i) => (i === idx ? { ...item, [field]: value } : item)),
    );
  };

  const seleccionarTipo = (idx: number, tipoId: string) => {
    const tipo = tipos.find((t) => t.id === tipoId);
    setItems((prev) =>
      prev.map((item, i) =>
        i === idx
          ? {
              ...item,
              epp_tipo_id: tipoId,
              marca: tipo?.marca?.trim() || "",
              modelo: tipo?.modelo?.trim() || "",
              certificacion: tipo?.certificacion?.trim() || "",
            }
          : item,
      ),
    );
  };

  const handleCrearEpp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nuevoEppNombre.trim() || !empresa?.id) return;

    setGuardandoNuevoEpp(true);
    try {
      const data = await crearTipoEpp({
        empresa_id: empresa.id,
        nombre: nuevoEppNombre,
        descripcion: nuevoEppDescripcion,
        marca: nuevoEppMarca,
        modelo: nuevoEppModelo,
        certificacion: nuevoEppCertificacion,
        foto: nuevoEppFoto ?? undefined,
      });

      const nuevoTipo: EppTipo = data;
      setTipos((prev) =>
        [...prev, nuevoTipo].sort((a, b) => a.nombre.localeCompare(b.nombre)),
      );

      if (creandoEppParaIndex !== null) {
        setItems((prev) =>
          prev.map((item, i) =>
            i === creandoEppParaIndex
              ? {
                  ...item,
                  epp_tipo_id: nuevoTipo.id,
                  marca: nuevoTipo.marca?.trim() || nuevoEppMarca.trim() || "",
                  modelo: nuevoTipo.modelo?.trim() || nuevoEppModelo.trim() || "",
                  certificacion:
                    nuevoTipo.certificacion?.trim() ||
                    nuevoEppCertificacion.trim() ||
                    "",
                }
              : item,
          ),
        );
      }

      setNuevoEppNombre("");
      setNuevoEppDescripcion("");
      setNuevoEppMarca("");
      setNuevoEppModelo("");
      setNuevoEppCertificacion("");
      setNuevoEppFoto(null);
      setShowModalEpp(false);
      setCreandoEppParaIndex(null);
      showAlert("success", "EPP creado", "Ya quedó seleccionado en la entrega.");
    } catch (err: unknown) {
      const message =
        typeof err === "object" &&
        err !== null &&
        "response" in err &&
        typeof (err as { response?: { data?: { error?: string } } }).response?.data?.error ===
          "string"
          ? (err as { response: { data: { error: string } } }).response.data.error
          : "Error al crear el EPP";
      showAlert("error", "Error", message);
    } finally {
      setGuardandoNuevoEpp(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!empleadoId) {
      setError("Seleccioná un trabajador del padrón.");
      return;
    }

    if (!nombreEmpleado.trim() || !dniEmpleado.trim()) {
      setError("El trabajador seleccionado no tiene datos válidos.");
      return;
    }

    const itemsValidos = items.filter((item) => item.epp_tipo_id);
    if (itemsValidos.length === 0) {
      setError("Seleccioná al menos un elemento de EPP.");
      return;
    }

    if (isSignatureEmpty(sigRef.current)) {
      setError("La firma del empleado es obligatoria.");
      return;
    }

    setSaving(true);
    try {
      const firmaBase64 = readSignatureOrThrow(sigRef.current);
      const firmaEmpleador = !isSignatureEmpty(sigEmpleadorRef.current)
        ? readSignatureOrThrow(sigEmpleadorRef.current)
        : null;

      await crearEntregaEpp({
        empresa_id: empresa!.id,
        empleado_id: empleadoId,
        nombre_empleado: nombreEmpleado,
        dni_empleado: dniEmpleado,
        fecha_entrega: fechaEntrega,
        items: itemsValidos,
        firma: firmaBase64,
        firma_empleador: firmaEmpleador,
      });

      router.push("/epp");
    } catch (err: any) {
      setError(err.response?.data?.error || "Error al registrar la entrega.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href="/epp"
          className="h-10 w-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center hover:bg-slate-50 transition-colors cursor-pointer"
        >
          <ArrowLeft className="h-5 w-5 text-slate-600" />
        </Link>
        <div>
          <span className="text-sm font-semibold text-slate-500 flex items-center gap-1.5">
            <HardHat className="h-4 w-4" /> EPP
          </span>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">
            Registrar Entrega de EPP
          </h1>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <div className="rounded-xl bg-red-50 border border-red-100 p-4 text-sm text-red-800 font-semibold">
            {error}
          </div>
        )}

        {/* Datos del empleado */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-5">
          <div className="flex items-center justify-between border-b border-slate-50 pb-3 mb-2">
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
              Datos del Trabajador
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2 sm:col-span-2">
              <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                <Search className="h-3 w-3" /> Buscar en el padrón *
              </label>
              <input
                type="text"
                value={busquedaPadron}
                onChange={(e) => {
                  setBusquedaPadron(e.target.value);
                  if (empleadoId) limpiarEmpleado();
                }}
                placeholder="Nombre o DNI del trabajador..."
                className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm font-medium focus:outline-hidden focus:ring-2 focus:ring-blue-500/25 focus:border-blue-500 transition-all"
              />
              {busquedaPadron.trim() && !empleadoId && empleadosFiltrados.length > 0 && (
                <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-sm">
                  {empleadosFiltrados.map((emp) => (
                    <button
                      key={emp.id}
                      type="button"
                      onClick={() => seleccionarEmpleado(emp)}
                      className="w-full text-left px-4 py-3 hover:bg-blue-50 border-b border-slate-50 last:border-0 cursor-pointer"
                    >
                      <span className="font-semibold text-slate-800">{emp.nombre}</span>
                      <span className="text-slate-500 text-sm ml-2">DNI {emp.documento}</span>
                      {emp.puesto && (
                        <span className="text-slate-400 text-xs ml-2">· {emp.puesto}</span>
                      )}
                      {!emp.puesto && emp.sector && (
                        <span className="text-slate-400 text-xs ml-2">· {emp.sector}</span>
                      )}
                    </button>
                  ))}
                </div>
              )}
              {busquedaPadron.trim() && !empleadoId && empleadosFiltrados.length === 0 && (
                <p className="text-xs text-slate-500">
                  No hay trabajadores que coincidan. Agregalos en{" "}
                  <Link href="/epp?tab=personal" className="font-bold text-blue-600 underline">
                    Personal
                  </Link>
                  .
                </p>
              )}
            </div>

            {empleadoId && (
              <>
                <div className="space-y-2">
                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                    <User className="h-3 w-3" /> Nombre y Apellido
                  </label>
                  <input
                    type="text"
                    value={nombreEmpleado}
                    readOnly
                    className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm font-medium bg-slate-50 text-slate-700"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                    <Hash className="h-3 w-3" /> DNI
                  </label>
                  <input
                    type="text"
                    value={dniEmpleado}
                    readOnly
                    className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm font-medium bg-slate-50 text-slate-700"
                  />
                </div>
                <div className="sm:col-span-2">
                  <button
                    type="button"
                    onClick={limpiarEmpleado}
                    className="text-xs font-bold text-slate-500 hover:text-slate-700 cursor-pointer"
                  >
                    Cambiar trabajador
                  </button>
                </div>
              </>
            )}
          </div>

          <div className="space-y-2">
            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
              <Calendar className="h-3 w-3" /> Fecha de Entrega
            </label>
            <div
              onClick={(e) => {
                const input =
                  e.currentTarget.querySelector('input[type="date"]');
                if (input) {
                  try {
                    (input as any).showPicker();
                  } catch (err) {}
                }
              }}
              className="flex items-center gap-2 pl-3.5 pr-3 py-3 border border-slate-200 rounded-xl bg-brand-input-bg text-slate-700 focus-within:ring-2 focus-within:ring-blue-600/25 focus-within:border-blue-600 transition-all cursor-pointer select-none"
            >
              <Calendar className="h-5 w-5 text-blue-600 shrink-0" />
              <input
                type="date"
                required
                value={fechaEntrega}
                onChange={(e) => setFechaEntrega(e.target.value)}
                onClick={(e) => {
                  e.stopPropagation();
                  try {
                    e.currentTarget.showPicker();
                  } catch (err) {}
                }}
                className="block flex-1 bg-transparent border-0 p-0 text-slate-700 focus:ring-0 focus:outline-hidden text-sm font-bold cursor-pointer"
              />
            </div>
          </div>
        </div>

        {/* Items de EPP */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <HardHat className="h-4 w-4 text-emerald-500" />
              Elemento Entregado
            </h2>
            <span className="text-[11px] text-slate-400 font-semibold">
              1 por registro
            </span>
          </div>

          {items.map((item, idx) => (
            <div
              key={idx}
              className="bg-slate-50 rounded-xl p-5 space-y-3 border border-slate-100"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-600">EPP</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1 sm:col-span-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase">
                    Tipo de EPP *
                  </label>
                  <EppTipoPicker
                    tipos={tipos}
                    value={item.epp_tipo_id}
                    onChange={(tipoId) => seleccionarTipo(idx, tipoId)}
                    onCreateNew={() => {
                      setCreandoEppParaIndex(idx);
                      setShowModalEpp(true);
                    }}
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase">
                    Cantidad
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={item.cantidad}
                    onChange={(e) =>
                      actualizarItem(
                        idx,
                        "cantidad",
                        parseInt(e.target.value) || 1,
                      )
                    }
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500/25 focus:border-blue-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase">
                    Marca
                  </label>
                  <input
                    type="text"
                    value={item.marca}
                    onChange={(e) =>
                      actualizarItem(idx, "marca", e.target.value)
                    }
                    placeholder="Ej: 3M"
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500/25 focus:border-blue-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase">
                    Modelo
                  </label>
                  <input
                    type="text"
                    value={item.modelo}
                    onChange={(e) =>
                      actualizarItem(idx, "modelo", e.target.value)
                    }
                    placeholder="Ej: N95 8210"
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500/25 focus:border-blue-500"
                  />
                </div>

                <div className="space-y-1 sm:col-span-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase">
                    Certificación / Norma
                  </label>
                  <input
                    type="text"
                    value={item.certificacion}
                    onChange={(e) =>
                      actualizarItem(idx, "certificacion", e.target.value)
                    }
                    placeholder="Ej: IRAM 3610"
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500/25 focus:border-blue-500"
                  />
                </div>
              </div>
            </div>
          ))}

        </div>

        {/* Firma Digital */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
          <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
            Firma del Trabajador *
          </h2>
          <p className="text-xs text-slate-500">
            Dibujá, subí una imagen o pegá un recorte (Ctrl+V) para confirmar la
            recepción.
          </p>

          <div onPointerDown={() => setActivePad("empleado")}>
            <SignaturePad ref={sigRef} heightClassName="h-44" />
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => sigRef.current?.clear()}
              className="inline-flex items-center justify-center px-3.5 py-2.5 border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-xl text-xs font-bold cursor-pointer"
            >
              Limpiar
            </button>
            <SignatureImageImport
              canvasRef={sigRef}
              enablePaste={activePad === "empleado"}
              onError={(msg) => showAlert("error", "Imagen de firma", msg)}
              label="Insertar imagen"
            />
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
          <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
            Firma del Responsable / Empleador
          </h2>
          <p className="text-xs text-slate-500">
            Opcional. Usá tu sello precargado, dibujá, subí imagen o pegá un
            recorte. Queda en la constancia SRT 299/11.
          </p>
          <div onPointerDown={() => setActivePad("empleador")}>
            <SignaturePad ref={sigEmpleadorRef} heightClassName="h-36" />
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => sigEmpleadorRef.current?.clear()}
              className="inline-flex items-center justify-center px-3.5 py-2.5 border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-xl text-xs font-bold cursor-pointer"
            >
              Limpiar
            </button>
            <UsarMiSelloButton
              canvasRef={sigEmpleadorRef}
              selloUrl={user?.sello_url}
              onError={(msg) => showAlert("error", "Sello", msg)}
            />
            <SignatureImageImport
              canvasRef={sigEmpleadorRef}
              enablePaste={activePad === "empleador"}
              onError={(msg) => showAlert("error", "Imagen de firma", msg)}
              label="Insertar imagen"
            />
          </div>
        </div>

        {/* Botón guardar */}
        <button
          type="submit"
          disabled={saving}
          className="w-full py-4 bg-brand-primary hover:bg-brand-primary/95 text-white font-bold rounded-xl shadow-md shadow-blue-900/10 hover:shadow-lg transition-all text-sm flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
        >
          <Save className="h-4 w-4" />
          {saving
            ? "Registrando entrega..."
            : "Registrar Entrega y Generar PDF SRT 299/11"}
        </button>
      </form>

      {/* Modal interactivo de creación de EPP */}
      {showModalEpp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white w-full max-w-md rounded-2xl border border-slate-200 p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-lg font-black text-slate-800">
                Agregar Nuevo EPP
              </h3>
              <button
                type="button"
                onClick={() => {
                  setShowModalEpp(false);
                  setCreandoEppParaIndex(null);
                }}
                className="text-slate-400 hover:text-slate-600 font-bold text-xl cursor-pointer"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleCrearEpp} className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  Nombre del EPP *
                </label>
                <input
                  type="text"
                  required
                  value={nuevoEppNombre}
                  onChange={(e) => setNuevoEppNombre(e.target.value)}
                  placeholder="Ej: Protectores Auditivos de Inserción"
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm font-medium focus:outline-hidden focus:ring-2 focus:ring-blue-500/25 focus:border-blue-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  Descripción
                </label>
                <textarea
                  value={nuevoEppDescripcion}
                  onChange={(e) => setNuevoEppDescripcion(e.target.value)}
                  placeholder="Detalle o uso (opcional)..."
                  rows={2}
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm font-medium focus:outline-hidden focus:ring-2 focus:ring-blue-500/25 focus:border-blue-500 resize-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    Marca
                  </label>
                  <input
                    type="text"
                    value={nuevoEppMarca}
                    onChange={(e) => setNuevoEppMarca(e.target.value)}
                    placeholder="Ej: Libus"
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm font-medium focus:outline-hidden focus:ring-2 focus:ring-blue-500/25 focus:border-blue-500"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    Modelo
                  </label>
                  <input
                    type="text"
                    value={nuevoEppModelo}
                    onChange={(e) => setNuevoEppModelo(e.target.value)}
                    placeholder="Ej: Argon"
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm font-medium focus:outline-hidden focus:ring-2 focus:ring-blue-500/25 focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  Certificación / Norma
                </label>
                <input
                  type="text"
                  value={nuevoEppCertificacion}
                  onChange={(e) => setNuevoEppCertificacion(e.target.value)}
                  placeholder="Ej: IRAM 3610"
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm font-medium focus:outline-hidden focus:ring-2 focus:ring-blue-500/25 focus:border-blue-500"
                />
              </div>

              <FileImagePicker
                file={nuevoEppFoto}
                onChange={setNuevoEppFoto}
                label="Foto del EPP"
              />

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowModalEpp(false);
                    setCreandoEppParaIndex(null);
                  }}
                  className="flex-1 py-2.5 border border-slate-200 text-slate-600 font-bold rounded-xl text-sm hover:bg-slate-50 transition-all cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={guardandoNuevoEpp}
                  className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-sm transition-all disabled:opacity-50 cursor-pointer"
                >
                  {guardandoNuevoEpp ? "Guardando..." : "Guardar EPP"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
