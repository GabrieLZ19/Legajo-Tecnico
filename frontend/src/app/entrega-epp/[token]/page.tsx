"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import type SignatureCanvas from "react-signature-canvas";
import {
  HardHat,
  CheckCircle2,
  Loader2,
  Plus,
  Minus,
  Trash2,
} from "lucide-react";
import SignaturePad, { readSignatureOrThrow } from "@/components/SignaturePad";
import SignatureImageImport from "@/components/SignatureImageImport";
import { eppService } from "@/utils/services/epp.service";
import type { EppTipo } from "@/types";

const STORAGE_PREFIX = "entrega_epp_state_";

type LineaItem = {
  epp_tipo_id: string;
  cantidad: number;
  marca: string;
  modelo: string;
  certificacion: string;
};

type PersistedState = {
  nombre?: string;
  dni?: string;
  sector?: string;
  puesto?: string;
  eppNecesarios?: string;
  fromPadron?: boolean;
  items?: LineaItem[];
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

function emptyLinea(tipoId = "", tipo?: EppTipo | null): LineaItem {
  return {
    epp_tipo_id: tipoId,
    cantidad: 1,
    marca: tipo?.marca?.trim() || "",
    modelo: tipo?.modelo?.trim() || "",
    certificacion: tipo?.certificacion?.trim() || "",
  };
}

const fieldClass =
  "w-full min-h-11 sm:min-h-12 px-3 py-2.5 border border-slate-300 bg-white rounded-lg text-[16px] sm:text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-blue-600/25 focus:border-blue-600";

const fieldReadonlyClass =
  "w-full min-h-11 sm:min-h-12 px-3 py-2.5 border border-slate-300 bg-slate-200/80 rounded-lg text-[16px] sm:text-sm font-medium text-slate-700";

const labelClass =
  "block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1";

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
  const [puesto, setPuesto] = useState("");
  const [eppNecesarios, setEppNecesarios] = useState("");
  const [fromPadron, setFromPadron] = useState(false);
  const [lookupStatus, setLookupStatus] = useState<
    "idle" | "loading" | "found" | "not_found"
  >("idle");
  const [sugeridosIds, setSugeridosIds] = useState<string[]>([]);
  const [items, setItems] = useState<LineaItem[]>([]);

  const puestoBloqueado = fromPadron && Boolean(puesto.trim());

  useEffect(() => {
    if (!token) return;
    const saved = loadPersisted(token);
    if (saved) {
      setNombre(saved.nombre || "");
      setDni(saved.dni || "");
      setSector(saved.sector || "");
      setPuesto(saved.puesto || "");
      setEppNecesarios(saved.eppNecesarios || "");
      setFromPadron(Boolean(saved.fromPadron));
      if (saved.items?.length) setItems(saved.items);
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
      puesto,
      eppNecesarios,
      fromPadron,
      items,
    });
  }, [token, nombre, dni, sector, puesto, eppNecesarios, fromPadron, items, done]);

  useEffect(() => {
    if (!token || dni.length < 7) {
      setLookupStatus("idle");
      return;
    }

    const handle = window.setTimeout(() => {
      void (async () => {
        setLookupStatus("loading");
        try {
          const data = await eppService.buscarEmpleadoEntregaPublica(token, dni);
          if (!data.found) {
            setLookupStatus("not_found");
            setFromPadron(false);
            setPuesto("");
            setEppNecesarios("");
            setSugeridosIds([]);
            return;
          }

          setLookupStatus("found");
          setFromPadron(true);
          setNombre(data.nombre);
          setSector(data.sector || "");
          setPuesto(data.puesto || "");
          setEppNecesarios(data.epp_necesarios || "");
          const ids = data.epp_tipos.map((t) => t.id);
          setSugeridosIds(ids);
          setItems(
            ids.length === 0
              ? []
              : ids.map((id) => {
                  const tipo = tipos.find((t) => t.id === id) ?? null;
                  return emptyLinea(id, tipo);
                }),
          );
        } catch (err: unknown) {
          const axiosErr = err as {
            response?: { status?: number; data?: { error?: string } };
          };
          if (axiosErr.response?.status === 429) {
            setError(
              "Hay mucha demanda en este momento. Esperá unos segundos y reintentá sin recargar; tus datos se conservan.",
            );
          }
          setLookupStatus("idle");
        }
      })();
    }, 400);

    return () => window.clearTimeout(handle);
  }, [token, dni]);

  // Completa marca/modelo/certificación cuando el catálogo ya está disponible.
  useEffect(() => {
    if (tipos.length === 0) return;
    setItems((prev) => {
      let changed = false;
      const next = prev.map((item) => {
        if (!item.epp_tipo_id) return item;
        if (item.marca || item.modelo || item.certificacion) return item;
        const tipo = tipos.find((t) => t.id === item.epp_tipo_id);
        if (!tipo) return item;
        changed = true;
        return {
          ...item,
          marca: tipo.marca?.trim() || "",
          modelo: tipo.modelo?.trim() || "",
          certificacion: tipo.certificacion?.trim() || "",
        };
      });
      return changed ? next : prev;
    });
  }, [tipos]);

  const toggleSugerido = (tipoId: string) => {
    setItems((prev) => {
      const exists = prev.find((item) => item.epp_tipo_id === tipoId);
      if (exists) {
        return prev.filter((item) => item.epp_tipo_id !== tipoId);
      }
      const tipo = tipos.find((t) => t.id === tipoId) ?? null;
      return [...prev, emptyLinea(tipoId, tipo)];
    });
  };

  const updateItem = (index: number, patch: Partial<LineaItem>) => {
    setItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, ...patch } : item)),
    );
  };

  const addExtraItem = () => {
    const unused = tipos.find(
      (t) => !items.some((item) => item.epp_tipo_id === t.id),
    );
    setItems((prev) => [...prev, emptyLinea(unused?.id || "", unused ?? null)]);
  };

  const removeItem = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setError(null);

    const puestoTrim = puesto.trim();
    const nombreTrim = nombre.trim();
    const dniDigits = dni.replace(/\D/g, "");

    if (!/^\d{7,8}$/.test(dniDigits)) {
      setError("Ingresá un DNI válido (7 u 8 números).");
      return;
    }
    if (nombreTrim.length < 3) {
      setError("Ingresá el nombre y apellido.");
      return;
    }
    if (puestoTrim.length < 2) {
      setError("El puesto de trabajo es obligatorio para el Anexo I.");
      return;
    }

    const validItems = items.filter((item) => item.epp_tipo_id);
    if (validItems.length === 0) {
      setError("Seleccioná al menos un EPP a retirar.");
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
        nombre_empleado: nombreTrim,
        dni_empleado: dniDigits,
        puesto: puestoTrim,
        sector: sector.trim() || undefined,
        items: validItems.map((item) => ({
          epp_tipo_id: item.epp_tipo_id,
          cantidad: Math.max(1, item.cantidad || 1),
          marca: item.marca.trim() || undefined,
          modelo: item.modelo.trim() || undefined,
          certificacion: item.certificacion.trim() || undefined,
        })),
        firma,
      });
      clearPersisted(token);
      setDone(true);
    } catch (err: unknown) {
      const axiosErr = err as {
        response?: { status?: number; data?: { error?: string } };
      };
      if (axiosErr.response?.status === 429) {
        setError(
          "Hay mucha demanda en este momento. Esperá unos segundos y reintentá sin recargar; tus datos se conservan.",
        );
      } else {
        setError(
          axiosErr.response?.data?.error ||
            "No se pudo registrar. Esperá unos segundos y reintentá sin recargar.",
        );
      }
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-200">
        <Loader2 className="h-8 w-8 animate-spin text-blue-700" />
      </div>
    );
  }

  if (error && !empresaNombre) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-200 p-6">
        <div className="max-w-md w-full bg-white border border-slate-300 rounded-2xl p-6 text-center space-y-3">
          <HardHat className="h-10 w-10 text-slate-400 mx-auto" />
          <p className="text-sm font-bold text-rose-600">{error}</p>
        </div>
      </div>
    );
  }

  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-200 p-6">
        <div className="max-w-md w-full bg-white border border-slate-300 rounded-2xl p-6 text-center space-y-3">
          <CheckCircle2 className="h-12 w-12 text-emerald-600 mx-auto" />
          <h1 className="text-xl font-black text-slate-900">Entrega registrada</h1>
          <p className="text-sm text-slate-600 leading-relaxed">
            Se generó el registro oficial Anexo I (Res. SRT 299/11).
          </p>
        </div>
      </div>
    );
  }

  const selectedIds = new Set(items.map((item) => item.epp_tipo_id).filter(Boolean));

  return (
    <div className="min-h-dvh bg-slate-200 flex flex-col">
      <header className="sticky top-0 z-20 bg-slate-900 text-white shadow-md">
        <div className="w-full max-w-6xl mx-auto px-3 sm:px-5 lg:px-8 py-3.5 sm:py-4">
          <p className="text-[10px] font-bold uppercase tracking-wider text-blue-300">
            Res. SRT 299/11 · Anexo I
          </p>
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-1 sm:gap-4 mt-0.5">
            <h1 className="text-lg sm:text-2xl font-black tracking-tight">
              Entrega de EPP
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 font-medium truncate">
              {empresaNombre}
            </p>
          </div>
        </div>
      </header>

      <form onSubmit={handleSubmit} className="flex-1 flex flex-col w-full">
        <div className="flex-1 w-full max-w-6xl mx-auto px-3 sm:px-5 lg:px-8 py-4 sm:py-6 pb-28">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-6">
            {/* Columna identificación */}
            <section className="lg:col-span-4 bg-white border border-slate-300 rounded-xl p-4 sm:p-5 space-y-3.5 h-fit lg:sticky lg:top-24">
              <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-200">
                <h2 className="text-xs font-black text-slate-800 uppercase tracking-wider">
                  Identificación
                </h2>
                {lookupStatus === "loading" && (
                  <span className="text-[10px] font-semibold text-slate-500 inline-flex items-center gap-1">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Buscando
                  </span>
                )}
                {lookupStatus === "found" && (
                  <span className="text-[10px] font-bold uppercase tracking-wide text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded">
                    Padrón
                  </span>
                )}
                {lookupStatus === "not_found" && dni.length >= 7 && (
                  <span className="text-[10px] font-bold uppercase tracking-wide text-amber-800 bg-amber-100 px-2 py-0.5 rounded">
                    Manual
                  </span>
                )}
              </div>

              <label className="block">
                <span className={labelClass}>DNI *</span>
                <input
                  required
                  inputMode="numeric"
                  maxLength={8}
                  value={dni}
                  onChange={(e) =>
                    setDni(e.target.value.replace(/\D/g, "").slice(0, 8))
                  }
                  className={fieldClass}
                  autoComplete="off"
                />
              </label>

              <label className="block">
                <span className={labelClass}>Nombre y apellido *</span>
                <input
                  required
                  minLength={3}
                  value={nombre}
                  onChange={(e) =>
                    setNombre(
                      e.target.value.replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑ\s]/g, ""),
                    )
                  }
                  readOnly={fromPadron}
                  className={fromPadron ? fieldReadonlyClass : fieldClass}
                  autoComplete="name"
                />
              </label>

              <label className="block">
                <span className={labelClass}>Puesto de trabajo *</span>
                <input
                  required
                  minLength={2}
                  value={puesto}
                  onChange={(e) => setPuesto(e.target.value)}
                  readOnly={puestoBloqueado}
                  placeholder="Ej. Embolsado"
                  className={puestoBloqueado ? fieldReadonlyClass : fieldClass}
                />
                {fromPadron && !puesto.trim() && (
                  <p className="mt-1 text-[11px] font-semibold text-amber-800">
                    Completá el puesto (Anexo I).
                  </p>
                )}
              </label>

              <label className="block">
                <span className={labelClass}>Sector (opcional)</span>
                <input
                  value={sector}
                  onChange={(e) => setSector(e.target.value)}
                  readOnly={fromPadron && Boolean(sector.trim())}
                  className={
                    fromPadron && sector.trim()
                      ? fieldReadonlyClass
                      : fieldClass
                  }
                />
              </label>

              {eppNecesarios ? (
                <div className="rounded-lg bg-slate-100 border border-slate-300 px-3 py-2.5">
                  <p className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">
                    EPP del puesto
                  </p>
                  <p className="text-sm font-semibold text-slate-800 leading-snug">
                    {eppNecesarios}
                  </p>
                </div>
              ) : null}
            </section>

            {/* Columna entrega + firma */}
            <div className="lg:col-span-8 space-y-4">
              <section className="bg-white border border-slate-300 rounded-xl p-4 sm:p-5 space-y-3.5">
                <div className="pb-2 border-b border-slate-200">
                  <h2 className="text-xs font-black text-slate-800 uppercase tracking-wider">
                    Elementos a retirar
                  </h2>
                  <p className="mt-1 text-xs text-slate-500">
                    Misma pieza = cantidad · Distintas = renglones
                  </p>
                </div>

                {sugeridosIds.length > 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2">
                    {sugeridosIds.map((id) => {
                      const tipo = tipos.find((t) => t.id === id);
                      if (!tipo) return null;
                      const checked = selectedIds.has(id);
                      return (
                        <label
                          key={id}
                          className={`flex items-center gap-2.5 min-h-11 px-3 py-2 rounded-lg border cursor-pointer ${
                            checked
                              ? "border-blue-600 bg-blue-50"
                              : "border-slate-300 bg-slate-50 hover:bg-white"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleSugerido(id)}
                            className="h-4 w-4 rounded border-slate-400 text-blue-700"
                          />
                          <span className="text-sm font-semibold text-slate-800 leading-snug">
                            {tipo.nombre}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                )}

                {items.length === 0 ? (
                  <p className="text-sm text-slate-500 py-3">
                    Marcá los EPP sugeridos o agregá uno del catálogo.
                  </p>
                ) : (
                  <ul className="space-y-3">
                    {items.map((item, index) => {
                      const tipo = tipos.find((t) => t.id === item.epp_tipo_id);
                      return (
                        <li
                          key={`${item.epp_tipo_id}-${index}`}
                          className="rounded-lg border border-slate-300 bg-slate-50 p-3 sm:p-4 space-y-3"
                        >
                          <div className="flex gap-3">
                            {tipo?.foto_url ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={tipo.foto_url}
                                alt=""
                                className="hidden sm:block h-16 w-16 rounded-lg object-cover border border-slate-300 bg-white shrink-0"
                              />
                            ) : null}
                            <div className="flex-1 min-w-0 space-y-3">
                              <div className="flex flex-col sm:flex-row gap-3">
                                <label className="block flex-1 min-w-0">
                                  <span className={labelClass}>Tipo de EPP *</span>
                                  <select
                                    required
                                    value={item.epp_tipo_id}
                                    onChange={(e) => {
                                      const tipoId = e.target.value;
                                      const tipo =
                                        tipos.find((t) => t.id === tipoId) ?? null;
                                      updateItem(index, {
                                        epp_tipo_id: tipoId,
                                        marca: tipo?.marca?.trim() || "",
                                        modelo: tipo?.modelo?.trim() || "",
                                        certificacion:
                                          tipo?.certificacion?.trim() || "",
                                      });
                                    }}
                                    className={`${fieldClass} bg-white`}
                                  >
                                    <option value="">Seleccionar…</option>
                                    {tipos.map((t) => (
                                      <option key={t.id} value={t.id}>
                                        {t.nombre}
                                      </option>
                                    ))}
                                  </select>
                                </label>
                                <div className="flex items-end gap-2 shrink-0">
                                  <div>
                                    <span className={labelClass}>Cant.</span>
                                    <div className="inline-flex items-center rounded-lg border border-slate-300 bg-white">
                                      <button
                                        type="button"
                                        onClick={() =>
                                          updateItem(index, {
                                            cantidad: Math.max(
                                              1,
                                              item.cantidad - 1,
                                            ),
                                          })
                                        }
                                        className="min-h-11 min-w-10 inline-flex items-center justify-center cursor-pointer"
                                        aria-label="Restar"
                                      >
                                        <Minus className="h-4 w-4" />
                                      </button>
                                      <span className="min-w-7 text-center text-sm font-bold tabular-nums">
                                        {item.cantidad}
                                      </span>
                                      <button
                                        type="button"
                                        onClick={() =>
                                          updateItem(index, {
                                            cantidad: Math.min(
                                              99,
                                              item.cantidad + 1,
                                            ),
                                          })
                                        }
                                        className="min-h-11 min-w-10 inline-flex items-center justify-center cursor-pointer"
                                        aria-label="Sumar"
                                      >
                                        <Plus className="h-4 w-4" />
                                      </button>
                                    </div>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => removeItem(index)}
                                    className="min-h-11 min-w-11 inline-flex items-center justify-center text-rose-600 hover:bg-rose-50 rounded-lg border border-slate-300 bg-white cursor-pointer"
                                    aria-label="Quitar ítem"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </button>
                                </div>
                              </div>

                              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                                <label className="block">
                                  <span className={labelClass}>Marca</span>
                                  <input
                                    value={item.marca}
                                    onChange={(e) =>
                                      updateItem(index, {
                                        marca: e.target.value,
                                      })
                                    }
                                    className={fieldClass}
                                  />
                                </label>
                                <label className="block">
                                  <span className={labelClass}>Modelo</span>
                                  <input
                                    value={item.modelo}
                                    onChange={(e) =>
                                      updateItem(index, {
                                        modelo: e.target.value,
                                      })
                                    }
                                    className={fieldClass}
                                  />
                                </label>
                                <label className="block">
                                  <span className={labelClass}>Certificación</span>
                                  <input
                                    value={item.certificacion}
                                    onChange={(e) =>
                                      updateItem(index, {
                                        certificacion: e.target.value,
                                      })
                                    }
                                    placeholder="IRAM / N"
                                    className={fieldClass}
                                  />
                                </label>
                              </div>
                            </div>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}

                <button
                  type="button"
                  onClick={addExtraItem}
                  className="inline-flex items-center gap-2 min-h-10 px-2 text-sm font-bold text-blue-800 hover:text-blue-900 cursor-pointer"
                >
                  <Plus className="h-4 w-4" />
                  Agregar EPP
                </button>
              </section>

              <section className="bg-white border border-slate-300 rounded-xl p-4 sm:p-5 space-y-3">
                <div className="pb-2 border-b border-slate-200">
                  <h2 className="text-xs font-black text-slate-800 uppercase tracking-wider">
                    Firma del trabajador
                  </h2>
                  <p className="mt-1 text-xs text-slate-500">
                    Una firma confirma todos los elementos seleccionados.
                  </p>
                </div>
                <SignaturePad
                  ref={sigRef}
                  heightClassName="h-40 sm:h-48"
                  className="!rounded-lg !border-slate-300 !bg-white"
                />
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => sigRef.current?.clear()}
                    className="inline-flex items-center justify-center px-3 py-2 border border-slate-300 hover:bg-slate-100 text-slate-700 rounded-lg text-xs font-bold cursor-pointer"
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
                <p className="text-sm font-bold text-rose-800 bg-rose-100 border border-rose-200 rounded-lg px-4 py-3">
                  {error}
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="sticky bottom-0 z-20 border-t border-slate-400 bg-slate-900 px-3 sm:px-5 lg:px-8 py-3">
          <div className="w-full max-w-6xl mx-auto">
            <button
              type="submit"
              disabled={saving}
              className="w-full min-h-12 sm:min-h-14 px-5 py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl text-base cursor-pointer disabled:opacity-50 inline-flex items-center justify-center gap-2 shadow-lg"
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
          </div>
        </div>
      </form>
    </div>
  );
}
