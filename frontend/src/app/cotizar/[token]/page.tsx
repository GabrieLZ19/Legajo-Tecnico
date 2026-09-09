"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import {
  HardHat,
  CheckCircle2,
  Loader2,
  User,
  Mail,
  Phone,
  FileText,
  Upload,
  X,
} from "lucide-react";
import {
  eppCotizarService,
  type CotizarItemSolicitado,
  type CotizarPublicaInfo,
} from "@/utils/services/eppCotizar.service";

function nombreItem(item: CotizarItemSolicitado): string {
  return item.epp_tipos?.nombre || item.nombre_manual || "EPP";
}

export default function CotizarPublicoPage() {
  const params = useParams<{ token: string }>();
  const token = params.token;
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [cotizacion, setCotizacion] = useState<CotizarPublicaInfo | null>(null);
  const [monto, setMonto] = useState("");
  const [nombre, setNombre] = useState("");
  const [pdf, setPdf] = useState<File | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const data = await eppCotizarService.obtener(token);
        setCotizacion(data);
        setNombre(data.proveedor_nombre || "");
        if (data.estado === "cargada") setDone(true);
      } catch (err: unknown) {
        const axiosErr = err as { response?: { data?: { error?: string } } };
        setError(
          axiosErr.response?.data?.error ||
            (err instanceof Error ? err.message : "No se pudo abrir el enlace"),
        );
      } finally {
        setLoading(false);
      }
    };
    if (token) void load();
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!pdf) {
      setError("Adjuntá el presupuesto formal en PDF.");
      return;
    }
    if (!pdf.type.includes("pdf") && !pdf.name.toLowerCase().endsWith(".pdf")) {
      setError("El archivo debe ser un PDF.");
      return;
    }
    const montoNum = Number(monto);
    if (!Number.isFinite(montoNum) || montoNum <= 0) {
      setError("Ingresá un monto total válido.");
      return;
    }

    setSaving(true);
    try {
      const items = (cotizacion?.epp_licitaciones?.epp_licitacion_items ?? []).map(
        (item) => ({
          epp_tipo_id: item.epp_tipos?.id ?? null,
          nombre: nombreItem(item),
          cantidad: item.cantidad,
          precio_unitario: 0,
        }),
      );
      await eppCotizarService.enviar(token, {
        proveedor_nombre: nombre.trim(),
        monto: montoNum,
        items_ofertados: items,
        presupuesto: pdf,
      });
      setDone(true);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: string } } };
      setError(
        axiosErr.response?.data?.error ||
          (err instanceof Error ? err.message : "Error al enviar cotización"),
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100">
        <Loader2 className="h-8 w-8 animate-spin text-slate-700" />
      </div>
    );
  }

  if (error && !cotizacion) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-6">
        <div className="w-full max-w-lg text-center space-y-3">
          <HardHat className="h-10 w-10 text-slate-300 mx-auto" />
          <p className="text-base font-bold text-rose-600">{error}</p>
        </div>
      </div>
    );
  }

  const lic = cotizacion?.epp_licitaciones;

  return (
    <div className="min-h-screen bg-slate-100">
      <header className="bg-slate-900 text-white">
        <div className="max-w-3xl mx-auto px-5 py-8 sm:py-10">
          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-blue-200">
            Licitación de EPP · Legajo Técnico
          </p>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight mt-2">
            {lic?.titulo || "Cotización"}
          </h1>
          {lic?.empresas?.razon_social && (
            <p className="text-sm text-slate-300 mt-2">{lic.empresas.razon_social}</p>
          )}
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-5 -mt-4 pb-12 space-y-4">
        {(lic?.comprador_nombre || lic?.comprador_email || lic?.comprador_telefono) && (
          <section className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 shadow-sm">
            <p className="text-[11px] font-black uppercase tracking-wider text-slate-400">
              Responsable de la compra
            </p>
            <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-3">
              {lic.comprador_nombre && (
                <p className="text-sm font-bold text-slate-800 inline-flex items-center gap-2">
                  <User className="h-4 w-4 text-slate-400 shrink-0" />
                  {lic.comprador_nombre}
                </p>
              )}
              {lic.comprador_email && (
                <p className="text-sm font-semibold text-slate-600 inline-flex items-center gap-2">
                  <Mail className="h-4 w-4 text-slate-400 shrink-0" />
                  {lic.comprador_email}
                </p>
              )}
              {lic.comprador_telefono && (
                <p className="text-sm font-semibold text-slate-600 inline-flex items-center gap-2">
                  <Phone className="h-4 w-4 text-slate-400 shrink-0" />
                  {lic.comprador_telefono}
                </p>
              )}
            </div>
          </section>
        )}

        <section className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 shadow-sm space-y-4">
          {done ? (
            <div className="text-center py-10 space-y-3">
              <CheckCircle2 className="h-12 w-12 text-emerald-600 mx-auto" />
              <h2 className="text-lg font-black text-slate-900">Cotización recibida</h2>
              <p className="text-sm text-slate-500 max-w-md mx-auto">
                El presupuesto PDF y el monto quedaron registrados. Ya podés cerrar esta
                página.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              {error && (
                <p className="text-sm font-bold text-rose-600 bg-rose-50 border border-rose-100 rounded-xl px-4 py-3">
                  {error}
                </p>
              )}

              {lic?.descripcion && (
                <div>
                  <p className="text-[11px] font-black uppercase tracking-wider text-slate-400">
                    Detalle de la solicitud
                  </p>
                  <p className="text-sm text-slate-600 mt-2 leading-relaxed">{lic.descripcion}</p>
                </div>
              )}

              <div>
                <p className="text-[11px] font-black uppercase tracking-wider text-slate-400">
                  Ítems a cotizar
                </p>
                <ul className="mt-2 divide-y divide-slate-100 border border-slate-100 rounded-xl overflow-hidden">
                  {(lic?.epp_licitacion_items ?? []).map((item, idx) => (
                    <li
                      key={idx}
                      className="flex items-center justify-between gap-3 px-4 py-3 bg-slate-50/60"
                    >
                      <span className="text-sm font-semibold text-slate-800">
                        {nombreItem(item)}
                        {item.nombre_manual ? (
                          <span className="ml-2 text-[10px] font-bold uppercase text-amber-700">
                            Manual
                          </span>
                        ) : null}
                      </span>
                      <span className="text-sm font-black text-slate-900 tabular-nums">
                        × {item.cantidad}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <label className="block space-y-1.5 sm:col-span-2">
                  <span className="text-[11px] font-bold text-slate-500 uppercase">
                    Nombre del proveedor
                  </span>
                  <input
                    value={nombre}
                    onChange={(e) => setNombre(e.target.value)}
                    className="w-full min-h-12 px-4 py-3 border border-slate-200 rounded-xl text-base sm:text-sm font-semibold"
                    required
                  />
                </label>

                <label className="block space-y-1.5 sm:col-span-2">
                  <span className="text-[11px] font-bold text-slate-500 uppercase">
                    Monto total de la oferta
                  </span>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400">
                      $
                    </span>
                    <input
                      type="number"
                      min="1"
                      step="0.01"
                      value={monto}
                      onChange={(e) => setMonto(e.target.value)}
                      placeholder="0,00"
                      className="w-full min-h-12 pl-8 pr-4 py-3 border border-slate-200 rounded-xl text-base sm:text-sm font-semibold"
                      required
                    />
                  </div>
                  <span className="text-[11px] font-semibold text-slate-400">
                    Monto total de tu presupuesto formal (sin IVA si corresponde).
                  </span>
                </label>
              </div>

              <div className="space-y-2">
                <p className="text-[11px] font-bold text-slate-500 uppercase">
                  Presupuesto formal (PDF)
                </p>
                {!pdf ? (
                  <label className="flex flex-col sm:flex-row sm:items-center gap-3 w-full cursor-pointer rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 hover:border-blue-400 hover:bg-blue-50/40 transition-colors p-4">
                    <div className="h-12 w-12 rounded-xl bg-white border border-slate-200 flex items-center justify-center shrink-0">
                      <Upload className="h-5 w-5 text-blue-600" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-slate-800">
                        Insertar cotización (PDF)
                      </p>
                      <p className="text-[11px] text-slate-400 font-semibold">
                        Obligatorio · PDF hasta 10 MB
                      </p>
                    </div>
                    <input
                      type="file"
                      accept="application/pdf,.pdf"
                      className="sr-only"
                      onChange={(e) => setPdf(e.target.files?.[0] ?? null)}
                    />
                  </label>
                ) : (
                  <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4">
                    <div className="h-12 w-12 rounded-xl bg-rose-50 text-rose-700 flex items-center justify-center shrink-0">
                      <FileText className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-slate-800 truncate">{pdf.name}</p>
                      <p className="text-[11px] text-slate-400 font-semibold">
                        {(pdf.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setPdf(null)}
                      className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-400 hover:text-rose-600 cursor-pointer"
                    >
                      <X className="h-3.5 w-3.5" />
                      Quitar
                    </button>
                  </div>
                )}
              </div>

              <button
                type="submit"
                disabled={saving}
                className="w-full min-h-13 px-5 py-4 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-sm font-black cursor-pointer disabled:opacity-50 inline-flex items-center justify-center gap-2"
              >
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Enviando…
                  </>
                ) : (
                  "Enviar cotización"
                )}
              </button>
            </form>
          )}
        </section>
      </main>
    </div>
  );
}
