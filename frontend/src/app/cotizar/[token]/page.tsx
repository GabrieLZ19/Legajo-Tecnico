"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { HardHat, CheckCircle2, Loader2 } from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "/api";

type ItemSolicitado = {
  cantidad: number;
  epp_tipos?: { id: string; nombre: string; descripcion?: string | null } | null;
};

type CotizacionPublica = {
  proveedor_nombre: string;
  estado: string;
  epp_licitaciones?: {
    titulo: string;
    descripcion?: string | null;
    empresas?: { razon_social?: string } | null;
    epp_licitacion_items?: ItemSolicitado[];
  } | null;
};

export default function CotizarPublicoPage() {
  const params = useParams<{ token: string }>();
  const token = params.token;
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [cotizacion, setCotizacion] = useState<CotizacionPublica | null>(null);
  const [monto, setMonto] = useState("");
  const [nombre, setNombre] = useState("");

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(`${API_URL}/epp/cotizar/${token}`);
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Enlace inválido");
        setCotizacion(json.cotizacion);
        setNombre(json.cotizacion.proveedor_nombre || "");
        if (json.cotizacion.estado === "cargada") setDone(true);
      } catch (err) {
        setError(err instanceof Error ? err.message : "No se pudo abrir el enlace");
      } finally {
        setLoading(false);
      }
    };
    if (token) load();
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const items = (cotizacion?.epp_licitaciones?.epp_licitacion_items ?? []).map((item) => ({
        epp_tipo_id: item.epp_tipos?.id,
        cantidad: item.cantidad,
        precio_unitario: 0,
      }));
      const res = await fetch(`${API_URL}/epp/cotizar/${token}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Requested-With": "XMLHttpRequest",
        },
        body: JSON.stringify({
          proveedor_nombre: nombre,
          monto: Number(monto),
          items_ofertados: items.filter((i) => i.epp_tipo_id),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "No se pudo guardar");
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al enviar cotización");
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

  if (error && !cotizacion) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
        <div className="bg-white rounded-3xl p-8 max-w-md text-center border">
          <p className="text-sm font-bold text-rose-600">{error}</p>
        </div>
      </div>
    );
  }

  const lic = cotizacion?.epp_licitaciones;

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-lg mx-auto bg-white rounded-3xl border border-slate-100 p-8 space-y-6">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-2xl bg-blue-50 text-blue-700 flex items-center justify-center">
            <HardHat className="h-6 w-6" />
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
              Licitación de EPP
            </p>
            <h1 className="text-xl font-black text-slate-900">{lic?.titulo}</h1>
            {lic?.empresas?.razon_social && (
              <p className="text-xs text-slate-500">{lic.empresas.razon_social}</p>
            )}
          </div>
        </div>

        {done ? (
          <div className="text-center py-8 space-y-3">
            <CheckCircle2 className="h-10 w-10 text-emerald-500 mx-auto" />
            <p className="text-sm font-bold text-slate-800">Cotización recibida</p>
            <p className="text-xs text-slate-400">Ya podés cerrar esta ventana.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <p className="text-xs font-bold text-rose-600 bg-rose-50 p-3 rounded-xl">{error}</p>
            )}
            <ul className="text-sm text-slate-600 space-y-1 bg-slate-50 rounded-2xl p-4">
              {(lic?.epp_licitacion_items ?? []).map((item, idx) => (
                <li key={idx}>
                  {item.cantidad} × {item.epp_tipos?.nombre ?? "EPP"}
                </li>
              ))}
            </ul>
            <input
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Nombre del proveedor"
              className="w-full px-4 py-3 border rounded-xl text-sm font-semibold"
              required
            />
            <input
              type="number"
              min="1"
              step="0.01"
              value={monto}
              onChange={(e) => setMonto(e.target.value)}
              placeholder="Monto total de la oferta"
              className="w-full px-4 py-3 border rounded-xl text-sm font-semibold"
              required
            />
            <button
              type="submit"
              disabled={saving}
              className="w-full py-3 bg-slate-900 text-white rounded-xl text-sm font-black disabled:opacity-50"
            >
              {saving ? "Enviando..." : "Enviar cotización"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
