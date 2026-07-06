"use client";

import React, { useEffect, useState, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { EppTipo } from "@/types";
import Link from "next/link";
import SignatureCanvas from "react-signature-canvas";
import { Html5Qrcode } from "html5-qrcode";
import {
  HardHat,
  ArrowLeft,
  Plus,
  Trash2,
  Save,
  User,
  Hash,
  Calendar,
} from "lucide-react";

interface ItemEntrega {
  epp_tipo_id: string;
  cantidad: number;
  marca: string;
  modelo: string;
  certificacion: string;
}

export default function NuevaEntregaEppPage() {
  const { empresa } = useAuth();
  const router = useRouter();
  const sigRef = useRef<SignatureCanvas>(null);

  const [tipos, setTipos] = useState<EppTipo[]>([]);
  const [nombreEmpleado, setNombreEmpleado] = useState("");
  const [dniEmpleado, setDniEmpleado] = useState("");
  const [fechaEntrega, setFechaEntrega] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [items, setItems] = useState<ItemEntrega[]>([
    { epp_tipo_id: "", cantidad: 1, marca: "", modelo: "", certificacion: "" },
  ]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Estados para modal de agregar nuevo EPP
  const [showModalEpp, setShowModalEpp] = useState(false);
  const [nuevoEppNombre, setNuevoEppNombre] = useState("");
  const [nuevoEppDescripcion, setNuevoEppDescripcion] = useState("");
  const [guardandoNuevoEpp, setGuardandoNuevoEpp] = useState(false);
  const [creandoEppParaIndex, setCreandoEppParaIndex] = useState<number | null>(null);

  // Estados para lector QR
  const [showQrScanner, setShowQrScanner] = useState(false);
  const [escaneadoPorQr, setEscaneadoPorQr] = useState(false);
  const [qrScanningError, setQrScanningError] = useState<string | null>(null);
  const qrInstanceRef = useRef<any>(null);

  useEffect(() => {
    fetchTipos();
  }, []);

  const fetchTipos = async () => {
    try {
      const { data } = await api.get("/epp/tipos");
      setTipos(data.tipos || []);
    } catch (err) {
      console.error("Error cargando tipos:", err);
    }
  };

  const agregarItem = () => {
    setItems([
      ...items,
      { epp_tipo_id: "", cantidad: 1, marca: "", modelo: "", certificacion: "" },
    ]);
  };

  const eliminarItem = (idx: number) => {
    if (items.length <= 1) return;
    setItems(items.filter((_, i) => i !== idx));
  };

  const actualizarItem = (idx: number, field: keyof ItemEntrega, value: any) => {
    const updated = [...items];
    (updated[idx] as any)[field] = value;
    setItems(updated);
  };

  const handleCrearEpp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nuevoEppNombre.trim()) return;

    setGuardandoNuevoEpp(true);
    try {
      const { data } = await api.post("/epp/tipos", {
        nombre: nuevoEppNombre,
        descripcion: nuevoEppDescripcion,
      });

      const nuevoTipo: EppTipo = data;
      setTipos((prev) => [...prev, nuevoTipo].sort((a, b) => a.nombre.localeCompare(b.nombre)));

      if (creandoEppParaIndex !== null) {
        const updated = [...items];
        updated[creandoEppParaIndex].epp_tipo_id = nuevoTipo.id;
        setItems(updated);
      }

      setNuevoEppNombre("");
      setNuevoEppDescripcion("");
      setShowModalEpp(false);
      setCreandoEppParaIndex(null);
    } catch (err: any) {
      alert(err.response?.data?.error || "Error al crear el EPP");
    } finally {
      setGuardandoNuevoEpp(false);
    }
  };

  const startScanner = async () => {
    try {
      setQrScanningError(null);
      setTimeout(async () => {
        try {
          const html5QrCode = new Html5Qrcode("qr-reader");
          qrInstanceRef.current = html5QrCode;
          
          await html5QrCode.start(
            { facingMode: "environment" },
            {
              fps: 10,
              qrbox: { width: 250, height: 250 },
            },
            (decodedText) => {
              handleQrScanSuccess(decodedText);
            },
            (errorMessage) => {
              // Ignorar escaneos fallidos continuos
            }
          );
        } catch (err: any) {
          console.error("Error al iniciar scanner:", err);
          setQrScanningError("No se pudo acceder a la cámara. Verifique los permisos.");
        }
      }, 300);
    } catch (err: any) {
      setQrScanningError("Error al iniciar el scanner.");
    }
  };

  const stopScanner = async () => {
    if (qrInstanceRef.current && qrInstanceRef.current.isScanning) {
      try {
        await qrInstanceRef.current.stop();
      } catch (err) {
        console.error("Error al detener scanner:", err);
      }
    }
    qrInstanceRef.current = null;
  };

  const handleQrScanSuccess = (decodedText: string) => {
    try {
      if (decodedText.startsWith("{")) {
        const data = JSON.parse(decodedText);
        if (data.nombre) setNombreEmpleado(data.nombre);
        if (data.dni) setDniEmpleado(data.dni);
      } else if (decodedText.includes(",")) {
        const [nombre, dni] = decodedText.split(",");
        if (nombre) setNombreEmpleado(nombre.trim());
        if (dni) setDniEmpleado(dni.trim());
      } else {
        const cleanDni = decodedText.replace(/\D/g, "").slice(0, 8);
        setDniEmpleado(cleanDni);
        setNombreEmpleado("Trabajador Escaneado");
      }
      setEscaneadoPorQr(true);
      setShowQrScanner(false);
      stopScanner();
    } catch (err) {
      console.error("Error al procesar QR:", err);
      setDniEmpleado(decodedText.trim().slice(0, 8));
      setEscaneadoPorQr(true);
      setShowQrScanner(false);
      stopScanner();
    }
  };

  const handleSimulateScan = () => {
    setNombreEmpleado("Juan Pérez");
    setDniEmpleado("28456789");
    setEscaneadoPorQr(true);
    setShowQrScanner(false);
    stopScanner();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!nombreEmpleado.trim() || !dniEmpleado.trim()) {
      setError("Nombre y DNI del empleado son obligatorios.");
      return;
    }

    if (nombreEmpleado.trim().length < 3) {
      setError("El nombre del empleado debe tener al menos 3 caracteres.");
      return;
    }

    if (dniEmpleado.length < 7 || dniEmpleado.length > 8) {
      setError("El DNI debe tener 7 u 8 números.");
      return;
    }

    const itemsValidos = items.filter((item) => item.epp_tipo_id);
    if (itemsValidos.length === 0) {
      setError("Seleccioná al menos un elemento de EPP.");
      return;
    }

    if (!sigRef.current || sigRef.current.isEmpty()) {
      setError("La firma del empleado es obligatoria.");
      return;
    }

    setSaving(true);
    try {
      const firmaBase64 = sigRef.current
        .getTrimmedCanvas()
        .toDataURL("image/png");

      await api.post("/epp/entregas", {
        empresa_id: empresa!.id,
        nombre_empleado: nombreEmpleado,
        dni_empleado: dniEmpleado,
        fecha_entrega: fechaEntrega,
        items: itemsValidos,
        firma: firmaBase64,
      });

      router.push("/epp");
    } catch (err: any) {
      setError(err.response?.data?.error || "Error al registrar la entrega.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-8 max-w-3xl mx-auto">
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
            <div className="flex items-center gap-2">
              {escaneadoPorQr && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-100 uppercase tracking-wider">
                  Escaneado por QR
                </span>
              )}
              <button
                type="button"
                onClick={() => {
                  setShowQrScanner(true);
                  startScanner();
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-600 font-bold rounded-lg text-xs transition-colors cursor-pointer"
              >
                <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2" strokeLinecap="round" strokeLinejoin="round"/>
                  <rect x="7" y="7" width="3" height="3" />
                  <rect x="14" y="7" width="3" height="3" />
                  <rect x="7" y="14" width="3" height="3" />
                  <rect x="14" y="14" width="3" height="3" />
                </svg>
                Escanear QR
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                <User className="h-3 w-3" /> Nombre y Apellido *
              </label>
              <input
                type="text"
                value={nombreEmpleado}
                onChange={(e) => setNombreEmpleado(e.target.value.replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑ\s]/g, ""))}
                placeholder="Juan Pérez"
                className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm font-medium focus:outline-hidden focus:ring-2 focus:ring-blue-500/25 focus:border-blue-500 transition-all"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                <Hash className="h-3 w-3" /> DNI *
              </label>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={8}
                value={dniEmpleado}
                onChange={(e) => setDniEmpleado(e.target.value.replace(/\D/g, "").slice(0, 8))}
                placeholder="12345678"
                className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm font-medium focus:outline-hidden focus:ring-2 focus:ring-blue-500/25 focus:border-blue-500 transition-all"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
              <Calendar className="h-3 w-3" /> Fecha de Entrega
            </label>
            <div 
              onClick={(e) => {
                const input = e.currentTarget.querySelector('input[type="date"]');
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
              Elementos Entregados
            </h2>
            <span className="text-[11px] text-slate-400 font-semibold">
              {items.length} item{items.length !== 1 ? "s" : ""}
            </span>
          </div>

          {items.map((item, idx) => (
            <div
              key={idx}
              className="bg-slate-50 rounded-xl p-5 space-y-3 border border-slate-100"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-600">
                  Item {idx + 1}
                </span>
                {items.length > 1 && (
                  <button
                    type="button"
                    onClick={() => eliminarItem(idx)}
                    className="text-red-400 hover:text-red-600 transition-colors cursor-pointer shrink-0"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1 sm:col-span-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase">
                    Tipo de EPP *
                  </label>
                  <select
                    value={item.epp_tipo_id}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === "crear_nuevo_epp") {
                        setCreandoEppParaIndex(idx);
                        setShowModalEpp(true);
                        // Resetear selección en el dropdown
                        actualizarItem(idx, "epp_tipo_id", "");
                      } else {
                        actualizarItem(idx, "epp_tipo_id", val);
                      }
                    }}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-lg text-sm bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500/25 focus:border-blue-500 cursor-pointer"
                  >
                    <option value="">Seleccionar EPP...</option>
                    {tipos.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.nombre}
                        {t.descripcion ? ` (${t.descripcion})` : ""}
                      </option>
                    ))}
                    <option value="crear_nuevo_epp" className="font-bold text-blue-600 bg-blue-50">
                      + Agregar nuevo EPP...
                    </option>
                  </select>
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
                      actualizarItem(idx, "cantidad", parseInt(e.target.value) || 1)
                    }
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500/25 focus:border-blue-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase">
                    Marca / Modelo
                  </label>
                  <input
                    type="text"
                    value={item.marca}
                    onChange={(e) =>
                      actualizarItem(idx, "marca", e.target.value)
                    }
                    placeholder="Ej: 3M N95"
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

          <button
            type="button"
            onClick={agregarItem}
            className="w-full py-3 border-2 border-dashed border-slate-300 rounded-xl text-sm font-bold text-slate-500 hover:border-emerald-400 hover:text-emerald-600 transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            Agregar otro EPP
          </button>
        </div>

        {/* Firma Digital */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
          <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
            Firma del Trabajador *
          </h2>
          <p className="text-xs text-slate-500">
            El empleado debe firmar en el recuadro para confirmar la recepción.
          </p>

          <div className="border-2 border-dashed border-slate-300 rounded-xl overflow-hidden bg-white">
            <SignatureCanvas
              ref={sigRef}
              penColor="#1e293b"
              canvasProps={{
                className: "w-full",
                style: { width: "100%", height: "180px" },
              }}
            />
          </div>

          <button
            type="button"
            onClick={() => sigRef.current?.clear()}
            className="text-xs font-bold text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
          >
            Borrar firma
          </button>
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
              <h3 className="text-lg font-black text-slate-800">Agregar Nuevo EPP</h3>
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
                  placeholder="Detalle o norma de certificación (opcional)..."
                  rows={3}
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm font-medium focus:outline-hidden focus:ring-2 focus:ring-blue-500/25 focus:border-blue-500 resize-none"
                />
              </div>

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

      {showQrScanner && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl border border-slate-100 flex flex-col space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider">Escanear QR del Trabajador</h3>
              <button
                type="button"
                onClick={() => {
                  setShowQrScanner(false);
                  stopScanner();
                }}
                className="text-slate-400 hover:text-slate-600 font-bold text-lg cursor-pointer"
              >
                &times;
              </button>
            </div>

            <div className="relative bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl overflow-hidden aspect-square flex flex-col items-center justify-center">
              {qrScanningError ? (
                <p className="text-xs text-red-600 font-semibold p-4 text-center">{qrScanningError}</p>
              ) : (
                <div id="qr-reader" className="w-full h-full" />
              )}
            </div>

            <div className="flex flex-col gap-2 pt-2">
              <button
                type="button"
                onClick={handleSimulateScan}
                className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs transition-colors cursor-pointer"
              >
                Simular Escaneo (Juan Pérez - DNI 28456789)
              </button>
              <p className="text-[10px] text-slate-400 text-center">
                Permita el acceso a la cámara o use la simulación rápida para pruebas de demostración.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
