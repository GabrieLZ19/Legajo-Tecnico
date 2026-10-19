"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Building2,
  CheckCircle2,
  ClipboardCheck,
  FileCheck2,
  Info,
  Loader,
  MapPin,
  Plus,
  QrCode,
  Sparkles,
  Tag,
  Wrench,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useAlert } from "@/context/AlertContext";
import { canWriteAppModule } from "@/lib/moduleAccess";
import { checklistsService } from "@/utils/services/checklists.service";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { EquipoQrCard } from "@/components/EquipoQrCard";
import type { ChecklistPlantilla, Equipo } from "@/types";

const UBICACIONES_PRESET = [
  "Nave Central",
  "Depósito Principal",
  "Taller de Mantenimiento",
  "Línea de Producción 1",
  "Patio de Carga y Descarga",
  "Sector Calderas",
];

const PRESETS_EQUIPOS = [
  {
    nombre: "Puente Grúa 4TN Nave Central",
    tipo: "PUENTE DE 4 TN",
    codigo: "PG-01",
    ubicacion: "Nave Central",
    notas: "Capacidad máx: 4.000 kg. Aparejo eléctrico trifásico.",
  },
  {
    nombre: "Autoelevador Toyota 2.5TN",
    tipo: "Autoelevador",
    codigo: "AE-02",
    ubicacion: "Depósito Principal",
    notas: "Combustión GLP. Horquillas de 1.20m.",
  },
  {
    nombre: "Extintor ABC 5kg - Puesto 14",
    tipo: "Extintor",
    codigo: "EXT-14",
    ubicacion: "Taller de Mantenimiento",
    notas: "Matafuegos polvo químico seco ABC.",
  },
];

export default function NuevoEquipoPage() {
  const { user, empresa } = useAuth();
  const { showAlert } = useAlert();
  const router = useRouter();
  const queryClient = useQueryClient();
  const canWrite = canWriteAppModule(user, "checklists");

  const [nombre, setNombre] = useState("");
  const [tipoEquipo, setTipoEquipo] = useState("");
  const [codigo, setCodigo] = useState("");
  const [ubicacion, setUbicacion] = useState("");
  const [notas, setNotas] = useState("");
  const [saving, setSaving] = useState(false);

  // Plantillas existentes de la empresa para sincronizar el tipo
  const { data: plantillas = [] } = useQuery({
    queryKey: ["checklist-plantillas-empresa", empresa?.id],
    queryFn: () =>
      checklistsService.listarPlantillas({
        ambito: "empresa",
        empresaId: empresa!.id,
      }),
    enabled: !!empresa?.id,
  });

  // Equipos existentes
  const { data: equipos = [] } = useQuery({
    queryKey: ["checklists-equipos", empresa?.id],
    queryFn: () => checklistsService.listarEquipos(empresa!.id),
    enabled: !!empresa?.id,
  });

  // Tipos sugeridos de las plantillas y equipos existentes
  const tiposSugeridos = useMemo<string[]>(() => {
    const set = new Set<string>();
    plantillas.forEach((p: ChecklistPlantilla) => {
      if (p.tipo_equipo?.trim()) set.add(p.tipo_equipo.trim());
    });
    equipos.forEach((e: Equipo) => {
      if (e.tipo_equipo?.trim()) set.add(e.tipo_equipo.trim());
    });
    return Array.from(set);
  }, [plantillas, equipos]);

  // Plantillas compatibles con el tipo de equipo tipeado
  const plantillasCompatibles = useMemo(() => {
    if (!tipoEquipo.trim()) return [];
    const t = tipoEquipo.toLowerCase().trim();
    return plantillas.filter((p: ChecklistPlantilla) => {
      const pt = (p.tipo_equipo || "").toLowerCase().trim();
      return pt === t || pt.includes(t) || t.includes(pt);
    });
  }, [plantillas, tipoEquipo]);

  if (!canWrite) {
    return (
      <div className="p-12 text-center text-slate-500">
        No tenés permiso para crear equipos.
      </div>
    );
  }

  const handleCargarPreset = (p: (typeof PRESETS_EQUIPOS)[number]) => {
    setNombre(p.nombre);
    setTipoEquipo(p.tipo);
    setCodigo(p.codigo);
    setUbicacion(p.ubicacion);
    setNotas(p.notas);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!empresa?.id) return;
    setSaving(true);
    try {
      const eq = await checklistsService.crearEquipo({
        empresa_id: empresa.id,
        nombre: nombre.trim(),
        tipo_equipo: tipoEquipo.trim(),
        codigo_interno: codigo.trim() || null,
        ubicacion: ubicacion.trim() || null,
        notas: notas.trim() || null,
      });
      await queryClient.invalidateQueries({
        queryKey: ["checklists-equipos"],
      });
      showAlert("success", "Equipo registrado", "Código QR generado y listo para inspeccionar.");
      router.push(`/checklists/equipos/${eq.id}`);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: string } } };
      showAlert(
        "error",
        "Error",
        axiosErr.response?.data?.error ||
          (err instanceof Error ? err.message : "No se pudo registrar el equipo"),
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="w-full space-y-6">
      {/* Encabezado */}
      <div>
        <Link
          href="/checklists/equipos"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-brand-primary mb-2 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver a equipos
        </Link>
        <h1 className="text-3xl font-black text-slate-900 tracking-tight">
          Alta de equipo o maquinaria
        </h1>
        <p className="text-sm text-brand-text-muted mt-1">
          Completá la ficha técnica para generar su etiqueta QR de inspección móvil y vincularlo con sus checklists correspondientes.
        </p>
      </div>

      {/* Presets Rápidos */}
      <div className="rounded-2xl border border-blue-100 bg-linear-to-r from-blue-50/70 via-indigo-50/40 to-slate-50 p-4 shadow-2xs">
        <div className="flex items-center gap-2 mb-2 text-xs font-bold text-blue-900">
          <Sparkles className="h-4 w-4 text-blue-600" />
          Ejemplos rápidos para probar en 1 clic:
        </div>
        <div className="flex flex-wrap gap-2">
          {PRESETS_EQUIPOS.map((p) => (
            <button
              key={p.codigo}
              type="button"
              onClick={() => handleCargarPreset(p)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-blue-200 text-xs font-semibold text-slate-700 hover:border-blue-400 hover:text-blue-700 shadow-2xs transition-all cursor-pointer"
            >
              <Wrench className="h-3.5 w-3.5 text-blue-600" />
              {p.nombre}
            </button>
          ))}
        </div>
      </div>

      {/* Layout Split: Formulario (7 cols) + Vista Previa de Etiqueta QR (5 cols) */}
      <form onSubmit={(e) => void handleSubmit(e)}>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Formulario */}
          <div className="lg:col-span-7 space-y-5">
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-2xs space-y-4.5">
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Wrench className="h-4.5 w-4.5 text-brand-primary" />
                Ficha del equipo
              </h2>

              {/* Nombre */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                  Nombre descriptivo <span className="text-rose-500">*</span>
                </label>
                <input
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  required
                  placeholder="Ej. Puente Grúa 4TN, Autoelevador Yale, Extintor N° 12…"
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/10"
                />
              </div>

              {/* Tipo de equipo */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-sm font-semibold text-slate-700">
                    Tipo de equipo o maquinaria <span className="text-rose-500">*</span>
                  </label>
                  {plantillasCompatibles.length > 0 && (
                    <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                      ✓ {plantillasCompatibles.length} plantilla(s) compatible(s)
                    </span>
                  )}
                </div>
                <input
                  list="tipos-equipos-nuevo-list"
                  value={tipoEquipo}
                  onChange={(e) => setTipoEquipo(e.target.value)}
                  required
                  placeholder="Ej. PUENTE DE 4 TN, Extintor, Autoelevador…"
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/10"
                />
                <datalist id="tipos-equipos-nuevo-list">
                  {tiposSugeridos.map((t) => (
                    <option key={t} value={t} />
                  ))}
                </datalist>

                {tiposSugeridos.length > 0 && (
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <span className="text-xs text-slate-400">Sugerencias de tus plantillas:</span>
                    {tiposSugeridos.map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setTipoEquipo(t)}
                        className={`text-xs px-2.5 py-1 rounded-lg border transition-colors cursor-pointer ${
                          tipoEquipo === t
                            ? "bg-brand-primary text-white border-brand-primary font-bold"
                            : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                        }`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Código interno y Ubicación */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                    Código interno / Tag
                  </label>
                  <input
                    value={codigo}
                    onChange={(e) => setCodigo(e.target.value)}
                    placeholder="Ej. APA-01, PG-04, CLK-02"
                    className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm font-mono focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/10"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">Identificador en planta</p>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                    Ubicación en planta
                  </label>
                  <input
                    list="ubicaciones-preset-list"
                    value={ubicacion}
                    onChange={(e) => setUbicacion(e.target.value)}
                    placeholder="Ej. Nave Central, Depósito…"
                    className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/10"
                  />
                  <datalist id="ubicaciones-preset-list">
                    {UBICACIONES_PRESET.map((u) => (
                      <option key={u} value={u} />
                    ))}
                  </datalist>
                </div>
              </div>

              {/* Notas u Observaciones */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                  Notas técnicas / Especificaciones
                </label>
                <textarea
                  value={notas}
                  onChange={(e) => setNotas(e.target.value)}
                  rows={3}
                  placeholder="Detalles de marca, modelo, capacidad nominal de carga, número de serie o recomendaciones…"
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/10 resize-none"
                />
              </div>
            </div>

            {/* Botones de acción */}
            <div className="flex items-center gap-3">
              <Link
                href="/checklists/equipos"
                className="flex-1 text-center py-3 rounded-xl border border-slate-200 bg-white text-slate-700 text-sm font-bold hover:bg-slate-50 transition-colors"
              >
                Cancelar
              </Link>
              <button
                type="submit"
                disabled={saving}
                className="flex-[2] inline-flex items-center justify-center gap-2 rounded-xl bg-brand-primary hover:bg-brand-primary/95 text-white py-3 text-sm font-bold shadow-sm hover:shadow-md transition-all disabled:opacity-60 cursor-pointer"
              >
                {saving && <Loader className="h-4 w-4 animate-spin" />}
                Registrar equipo y generar QR
              </button>
            </div>
          </div>

          {/* Columna Derecha: Vista Previa de Etiqueta QR Industrial (Sticky) */}
          <div className="lg:col-span-5 sticky top-6 space-y-4">
            <div className="rounded-2xl border border-slate-200 bg-linear-to-b from-slate-50 to-white p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <QrCode className="h-4 w-4 text-brand-primary" />
                  Vista previa de la etiqueta QR
                </span>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 bg-slate-200/60 px-2 py-0.5 rounded">
                  Etiqueta física
                </span>
              </div>

              {/* Simulación de la etiqueta industrial que se pegará en el equipo */}
              <div className="flex justify-center">
                <EquipoQrCard
                  nombre={nombre.trim() || "Nombre del equipo…"}
                  tipoEquipo={tipoEquipo.trim() || "Tipo de equipo"}
                  codigoInterno={codigo.trim()}
                  ubicacion={ubicacion.trim()}
                  placeholderQr={true}
                />
              </div>

              {/* Plantillas que se habilitarán para este equipo */}
              <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-2">
                <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                  <ClipboardCheck className="h-4 w-4 text-brand-primary" />
                  Checklists vinculados a este tipo:
                </span>
                {plantillasCompatibles.length > 0 ? (
                  <div className="space-y-1.5">
                    {plantillasCompatibles.map((p) => (
                      <div
                        key={p.id}
                        className="text-xs p-2 rounded-lg bg-emerald-50 text-emerald-800 font-medium flex items-center justify-between"
                      >
                        <span className="truncate">{p.titulo}</span>
                        <span className="text-[10px] font-bold text-emerald-600 shrink-0">
                          {p.total_items ?? 0} ítems
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-500 leading-relaxed">
                    {tipoEquipo.trim()
                      ? `No tenés plantillas creadas para "${tipoEquipo}". Podrás crear una plantilla específica luego.`
                      : "Elegí un tipo de equipo para ver qué checklists estarán disponibles."}
                  </p>
                )}
              </div>

              <div className="p-3 bg-blue-50/60 rounded-xl border border-blue-100 text-xs text-blue-900 flex items-start gap-2">
                <Info className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
                <p className="text-[11px] leading-relaxed">
                  Al guardar, se generará el token QR definitivo que podrás imprimir en vinilo autoadhesivo o papel plastificado para pegar en el equipo.
                </p>
              </div>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
