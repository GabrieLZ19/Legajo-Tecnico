"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import type SignatureCanvas from "react-signature-canvas";
import {
  HardHat,
  CheckCircle2,
  Loader2,
  User,
  Hash,
  Briefcase,
  Package,
} from "lucide-react";
import SignaturePad, { readSignatureOrThrow } from "@/components/SignaturePad";
import SignatureImageImport from "@/components/SignatureImageImport";
import { eppService } from "@/utils/services/epp.service";
import type { EppTipo } from "@/types";

const STORAGE_PREFIX = "entrega_epp_state_";

type PersistedState = {
  nombre?: string;
  dni?: string;
  sector?: string;
  eppTipoId?: string;
  cantidad?: number;
  marca?: string;
  modelo?: string;
  certificacion?: string;
};

function loadPersisted(token: string): PersistedState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${token}`);
    return raw ? (JSON.parse(raw) as PersistedState) : null;
  } catch {
    return null;
  }
}

function persist(token: string, state: PersistedState) {
  if (typeof window === "undefined") return;
  localStorage.setItem(`${STORAGE_PREFIX}${token}`, JSON.stringify(state));
}

function clearPersisted(token: string) {
  if (typeof window === "undefined") return;
  localStorage.removeItem(`${STORAGE_PREFIX}${token}`);
}

export default function EntregaEppPublicaPage() {
  const params = useParams<{ token: string }>();
  const token = params.token;
  const sigRef = useRef<SignatureCanvas | null>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [empresaNombre, setEmpresaNombre] = useState("");
  const [tipos, setTipos] = useState<EppTipo[]>([]);

  const [nombre, setNombre] = useState("");
  const [dni, setDni] = useState("");
  const [sector, setSector] = useState("");
  const [eppTipoId, setEppTipoId] = useState("");
  const [cantidad, setCantidad] = useState(1);
  const [marca, setMarca] = useState("");
  const [modelo, setModelo] = useState("");
  const [certificacion, setCertificacion] = useState("");

  const tipoSeleccionado = tipos.find((t) => t.id === eppTipoId) ?? null;

  useEffect(() => {
    if (!token) return;
    const saved = loadPersisted(token);
    if (saved) {
      setNombre(saved.nombre || "");
      setDni(saved.dni || "");
      setSector(saved.sector || "");
      setEppTipoId(saved.eppTipoId || "");
      setCantidad(saved.cantidad || 1);
      setMarca(saved.marca || "");
      setModelo(saved.modelo || "");
      setCertificacion(saved.certificacion || "");
    }

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await eppService.obtenerEntregaPublica(token);
        setEmpresaNombre(data.empresa.razon_social);
        setTipos(data.tipos || []);
      } catch (err: unknown) {
        const axiosErr = err as { response?: { data?: { error?: string } } };
        setError(
          axiosErr.response?.data?.error ||
            "QR inválido o no disponible. Pedile un código nuevo al área de seguridad.",
        );
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [token]);

  useEffect(() => {
    if (!token || done) return;
    persist(token, {
      nombre,
      dni,
      sector,
      eppTipoId,
      cantidad,
      marca,
      modelo,
      certificacion,
    });
  }, [token, nombre, dni, sector, eppTipoId, cantidad, marca, modelo, certificacion, done]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setError(null);

    if (!eppTipoId) {
      setError("Seleccioná el tipo de EPP.");
      return;
    }

    let firma: string;
    try {
      firma = readSignatureOrThrow(sigRef.current);
    } catch {
      setError("Firmá en el recuadro para confirmar la recepción.");
      return;
    }

    setSaving(true);
    try {
      await eppService.registrarEntregaPublica(token, {
        nombre_empleado: nombre.trim(),
        dni_empleado: dni.replace(/\D/g, ""),
        sector: sector.trim() || undefined,
        epp_tipo_id: eppTipoId,
        cantidad,
        marca: marca.trim() || undefined,
        modelo: modelo.trim() || undefined,
        certificacion: certificacion.trim() || undefined,
        firma,
      });
      clearPersisted(token);
      setDone(true);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: string } } };
      setError(
        axiosErr.response?.data?.error ||
          "No se pudo registrar. Esperá unos segundos y reintentá sin recargar.",
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="h-8 w-8 animate-spin text-blue-700" />
      </div>
    );
  }

  if (error && !empresaNombre) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
        <div className="bg-white rounded-3xl p-8 max-w-md text-center border border-slate-100 shadow-sm">
          <HardHat className="h-10 w-10 text-slate-300 mx-auto mb-3" />
          <p className="text-sm font-bold text-rose-600">{error}</p>
        </div>
      </div>
    );
  }

  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
        <div className="bg-white rounded-3xl p-8 max-w-md text-center border border-slate-100 shadow-sm space-y-3">
          <CheckCircle2 className="h-12 w-12 text-emerald-600 mx-auto" />
          <h1 className="text-lg font-black text-slate-900">Entrega registrada</h1>
          <p className="text-sm text-slate-500 leading-relaxed">
            Se generó el registro oficial Anexo I (Res. SRT 299/11).
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-10">
      <header className="bg-slate-900 text-white px-5 py-6">
        <div className="max-w-lg mx-auto">
          <p className="text-[11px] font-bold uppercase tracking-wider text-blue-200">
            Res. SRT 299/11
          </p>
          <h1 className="text-xl font-black mt-1">Registro de entrega de EPP</h1>
          <p className="text-sm text-slate-300 mt-1">{empresaNombre}</p>
        </div>
      </header>

      <form
        onSubmit={handleSubmit}
        className="max-w-lg mx-auto px-4 -mt-3 space-y-4"
      >
        <section className="bg-white rounded-3xl border border-slate-100 p-5 shadow-sm space-y-4">
          <h2 className="text-xs font-black uppercase tracking-wider text-slate-500 flex items-center gap-2">
            <User className="h-4 w-4" /> Tus datos
          </h2>
          <label className="block space-y-1.5">
            <span className="text-[11px] font-bold text-slate-500 uppercase">
              Nombre y apellido
            </span>
            <input
              required
              minLength={3}
              value={nombre}
              onChange={(e) =>
                setNombre(e.target.value.replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑ\s]/g, ""))
              }
              className="w-full min-h-12 px-4 py-3 border border-slate-200 rounded-xl text-base font-medium"
              autoComplete="name"
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-[11px] font-bold text-slate-500 uppercase flex items-center gap-1">
              <Hash className="h-3 w-3" /> DNI
            </span>
            <input
              required
              inputMode="numeric"
              maxLength={8}
              value={dni}
              onChange={(e) => setDni(e.target.value.replace(/\D/g, "").slice(0, 8))}
              className="w-full min-h-12 px-4 py-3 border border-slate-200 rounded-xl text-base font-medium"
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-[11px] font-bold text-slate-500 uppercase flex items-center gap-1">
              <Briefcase className="h-3 w-3" /> Sector (opcional)
            </span>
            <input
              value={sector}
              onChange={(e) => setSector(e.target.value)}
              className="w-full min-h-12 px-4 py-3 border border-slate-200 rounded-xl text-base font-medium"
            />
          </label>
        </section>

        <section className="bg-white rounded-3xl border border-slate-100 p-5 shadow-sm space-y-4">
          <h2 className="text-xs font-black uppercase tracking-wider text-slate-500 flex items-center gap-2">
            <Package className="h-4 w-4" /> Elemento entregado
          </h2>
          <label className="block space-y-1.5">
            <span className="text-[11px] font-bold text-slate-500 uppercase">
              Tipo de EPP
            </span>
            <select
              required
              value={eppTipoId}
              onChange={(e) => setEppTipoId(e.target.value)}
              className="w-full min-h-12 px-4 py-3 border border-slate-200 rounded-xl text-base font-medium bg-white"
            >
              <option value="">Seleccionar…</option>
              {tipos.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.nombre}
                </option>
              ))}
            </select>
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block space-y-1.5">
              <span className="text-[11px] font-bold text-slate-500 uppercase">
                Cantidad
              </span>
              <input
                type="number"
                min={1}
                max={99}
                required
                value={cantidad}
                onChange={(e) => setCantidad(Math.max(1, Number(e.target.value) || 1))}
                className="w-full min-h-12 px-4 py-3 border border-slate-200 rounded-xl text-base font-medium"
              />
            </label>
            <label className="block space-y-1.5">
              <span className="text-[11px] font-bold text-slate-500 uppercase">
                Certificación
              </span>
              <input
                value={certificacion}
                onChange={(e) => setCertificacion(e.target.value)}
                placeholder="Ej. IRAM / N"
                className="w-full min-h-12 px-4 py-3 border border-slate-200 rounded-xl text-base font-medium"
              />
            </label>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="block space-y-1.5">
              <span className="text-[11px] font-bold text-slate-500 uppercase">Marca</span>
              <input
                value={marca}
                onChange={(e) => setMarca(e.target.value)}
                className="w-full min-h-12 px-4 py-3 border border-slate-200 rounded-xl text-base font-medium"
              />
            </label>
            <label className="block space-y-1.5">
              <span className="text-[11px] font-bold text-slate-500 uppercase">Modelo</span>
              <input
                value={modelo}
                onChange={(e) => setModelo(e.target.value)}
                className="w-full min-h-12 px-4 py-3 border border-slate-200 rounded-xl text-base font-medium"
              />
            </label>
          </div>
          {tipoSeleccionado?.foto_url ? (
            <div className="space-y-1.5">
              <span className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                Foto del EPP (catálogo)
              </span>
              <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={tipoSeleccionado.foto_url}
                  alt={tipoSeleccionado.nombre}
                  className="h-16 w-16 rounded-xl object-cover border border-slate-100 bg-white"
                />
                <p className="text-sm font-semibold text-slate-600 leading-snug">
                  {tipoSeleccionado.nombre}
                </p>
              </div>
            </div>
          ) : null}
        </section>

        <section className="bg-white rounded-3xl border border-slate-100 p-5 shadow-sm space-y-3">
          <h2 className="text-xs font-black uppercase tracking-wider text-slate-500">
            Firma del trabajador
          </h2>
          <p className="text-[11px] text-slate-400">
            Con esta firma confirmás la recepción del EPP. Podés dibujar, subir
            una imagen o pegar un recorte (Ctrl+V). No se solicita firma del
            responsable de la empresa.
          </p>
          <SignaturePad ref={sigRef} />
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => sigRef.current?.clear()}
              className="inline-flex items-center justify-center px-3.5 py-2.5 border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-xl text-xs font-bold cursor-pointer"
            >
              Limpiar firma
            </button>
            <SignatureImageImport
              canvasRef={sigRef}
              onError={(msg) => setError(msg)}
              label="Insertar imagen"
            />
          </div>
        </section>

        {error && (
          <p className="text-sm font-bold text-rose-600 bg-rose-50 border border-rose-100 rounded-2xl px-4 py-3">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={saving}
          className="w-full min-h-14 px-5 py-4 bg-blue-700 hover:bg-blue-800 text-white font-bold rounded-2xl text-base cursor-pointer disabled:opacity-50 inline-flex items-center justify-center gap-2"
        >
          {saving ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" />
              Registrando…
            </>
          ) : (
            "Confirmar entrega"
          )}
        </button>
      </form>
    </div>
  );
}
