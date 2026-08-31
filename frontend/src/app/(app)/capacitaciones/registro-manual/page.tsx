"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Calendar,
  Database,
  Download,
  FileUp,
  GraduationCap,
  Plus,
  Save,
  Trash2,
  Users,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useAlert } from "@/context/AlertContext";
import { useCapacitaciones } from "@/hooks/useCapacitaciones";

type ParticipanteRow = {
  id: string;
  nombre: string;
  dni: string;
  calificacion: string;
  sector: string;
};

const MAX_DNI_LENGTH = 8;
const MAX_NOMBRE_LENGTH = 120;
const MAX_SECTOR_LENGTH = 80;

function sanitizeDni(value: string): string {
  return value.replace(/\D/g, "").slice(0, MAX_DNI_LENGTH);
}

function isDniValid(dni: string): boolean {
  return /^\d{7,8}$/.test(dni);
}

function sanitizeCalificacion(value: string): string {
  if (!value.trim()) return "";
  const n = Number(value.replace(/\D/g, "").slice(0, 3));
  if (Number.isNaN(n)) return "";
  return String(Math.min(100, n));
}

function newParticipanteRow(): ParticipanteRow {
  return {
    id: crypto.randomUUID(),
    nombre: "",
    dni: "",
    calificacion: "",
    sector: "",
  };
}

export default function RegistroManualCapacitacionPage() {
  const { empresa } = useAuth();
  const { showAlert } = useAlert();
  const router = useRouter();
  const { crearRegistroManual, descargarPlantillaRegistroManual } =
    useCapacitaciones();

  const today = new Date();
  const defaultFecha = today.toISOString().slice(0, 10);
  const defaultHora = `${String(today.getHours()).padStart(2, "0")}:${String(
    today.getMinutes(),
  ).padStart(2, "0")}`;

  const [titulo, setTitulo] = useState("");
  const [fecha, setFecha] = useState(defaultFecha);
  const [hora, setHora] = useState(defaultHora);
  const [instructor, setInstructor] = useState("");
  const [cantidadHoras, setCantidadHoras] = useState("");
  const [archivo, setArchivo] = useState<File | null>(null);
  const [participantes, setParticipantes] = useState<ParticipanteRow[]>([]);
  const [saving, setSaving] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const errorRef = useRef<HTMLDivElement>(null);

  const showFormError = (message: string) => {
    setError(message);
    requestAnimationFrame(() => {
      errorRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  };

  const buildFechaIso = () => {
    if (!fecha || !hora) return null;
    const fechaIso = new Date(`${fecha}T${hora}:00`);
    if (Number.isNaN(fechaIso.getTime())) return null;
    return fechaIso;
  };

  const fechasHorarioLabel = () =>
    `${fecha.split("-").reverse().join("/")} ${hora}`;

  const capacitacionPreview = useMemo(() => {
    const tema = titulo.trim() || "Charla presencial (sin título)";
    const cuando = fecha && hora ? fechasHorarioLabel() : "Completá fecha y hora";
    return { tema, cuando };
  }, [titulo, fecha, hora]);

  const updateParticipante = (
    id: string,
    field: keyof Omit<ParticipanteRow, "id">,
    value: string,
  ) => {
    setParticipantes((prev) =>
      prev.map((p) => (p.id === id ? { ...p, [field]: value } : p)),
    );
  };

  const participantesParaEnviar = () =>
    participantes
      .map((p) => ({
        nombre_empleado: p.nombre.trim(),
        dni_empleado: p.dni.replace(/\D/g, ""),
        calificacion: p.calificacion.trim()
          ? Number(p.calificacion.trim())
          : undefined,
        sector: p.sector.trim() || undefined,
      }))
      .filter((p) => p.nombre_empleado || p.dni_empleado);

  const handleDescargarPlantilla = async () => {
    if (!empresa?.id) {
      setError("No hay empresa seleccionada.");
      return;
    }
    const fechaIso = buildFechaIso();
    if (!fechaIso) {
      setError("Completá fecha y hora antes de descargar la plantilla.");
      return;
    }

    setDownloading(true);
    setError(null);
    try {
      const blob = await descargarPlantillaRegistroManual({
        empresa_id: empresa.id,
        titulo: titulo.trim() || undefined,
        fecha: fechaIso.toISOString(),
        instructor: instructor.trim() || undefined,
        fechas_horario: fechasHorarioLabel(),
        cantidad_horas: cantidadHoras.trim() || undefined,
      });
      const url = window.URL.createObjectURL(
        new Blob([blob], { type: "application/pdf" }),
      );
      const link = document.createElement("a");
      link.href = url;
      link.download = "plantilla_registro_capacitacion.pdf";
      link.click();
      window.URL.revokeObjectURL(url);
      showAlert(
        "success",
        "Plantilla lista",
        "Imprimila, completá firmas en papel y después subí el escaneo acá.",
      );
    } catch (err: any) {
      setError(
        err.response?.data?.error ||
          "No se pudo descargar la plantilla del registro.",
      );
    } finally {
      setDownloading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!empresa?.id) {
      showFormError("No hay empresa seleccionada.");
      return;
    }
    const fechaIso = buildFechaIso();
    if (!fechaIso) {
      showFormError("Completá la fecha y la hora del registro.");
      return;
    }

    const listaParticipantes = participantesParaEnviar();
    for (const p of listaParticipantes) {
      if (!p.nombre_empleado) {
        showFormError("Completá el nombre de cada participante cargado.");
        return;
      }
      if (!/^\d{7,8}$/.test(p.dni_empleado)) {
        showFormError(
          `DNI inválido para «${p.nombre_empleado}». Debe tener 7 u 8 dígitos.`,
        );
        return;
      }
      if (
        p.calificacion !== undefined &&
        (Number.isNaN(p.calificacion) ||
          p.calificacion < 0 ||
          p.calificacion > 100)
      ) {
        showFormError(
          `Calificación inválida para «${p.nombre_empleado}». Usá un valor entre 0 y 100.`,
        );
        return;
      }
    }

    const dnis = listaParticipantes.map((p) => p.dni_empleado);
    if (new Set(dnis).size !== dnis.length) {
      showFormError("Hay DNI repetidos en la lista de participantes.");
      return;
    }

    if (!archivo && listaParticipantes.length === 0) {
      showFormError(
        "Adjuntá el escaneo en el Paso 2 o cargá al menos un participante en el Paso 3.",
      );
      return;
    }

    const formData = new FormData();
    formData.append("empresa_id", empresa.id);
    formData.append("fecha", fechaIso.toISOString());
    formData.append("fechas_horario", fechasHorarioLabel());
    if (titulo.trim()) formData.append("titulo", titulo.trim());
    if (instructor.trim()) formData.append("instructor", instructor.trim());
    if (cantidadHoras.trim())
      formData.append("cantidad_horas", cantidadHoras.trim());
    if (archivo) formData.append("archivo", archivo);
    if (listaParticipantes.length > 0) {
      formData.append("participantes", JSON.stringify(listaParticipantes));
    }

    setSaving(true);
    try {
      const cap = await crearRegistroManual(formData);
      showAlert(
        "success",
        "Registro cargado",
        listaParticipantes.length > 0 && !archivo
          ? `${listaParticipantes.length} participante${listaParticipantes.length === 1 ? "" : "s"} quedaron en la base histórica.`
          : listaParticipantes.length > 0
            ? `El registro y ${listaParticipantes.length} participante${listaParticipantes.length === 1 ? "" : "s"} quedaron guardados.`
            : "El registro en papel quedó ingresado en el historial por fecha.",
      );
      router.push(`/capacitaciones/${cap.id}`);
    } catch (err: any) {
      showFormError(
        err.response?.data?.error || "No se pudo cargar el registro manual.",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      <div className="flex items-center gap-4">
        <Link
          href="/capacitaciones"
          className="h-10 w-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center hover:bg-slate-50 transition-colors"
        >
          <ArrowLeft className="h-5 w-5 text-slate-600" />
        </Link>
        <div>
          <span className="text-sm font-semibold text-slate-500 flex items-center gap-1.5">
            <GraduationCap className="h-4 w-4" /> Capacitaciones
          </span>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">
            Registro manual
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Ingresá una charla ya realizada en papel: se crea un registro en el
            historial y, si querés, también la lista de asistentes en la base de
            datos.
          </p>
        </div>
      </div>

      <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-5 space-y-3">
        <p className="text-xs font-black text-indigo-900 uppercase tracking-wider">
          Dos cosas en un solo guardado
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
          <div className="rounded-xl bg-white/70 border border-indigo-100 p-3 space-y-1">
            <p className="font-bold text-indigo-900 flex items-center gap-1.5">
              <FileUp className="h-4 w-4" /> Registro en papel
            </p>
            <p className="text-indigo-900/75 font-semibold text-xs leading-relaxed">
              Plantilla + escaneo firmado (opcional si cargás asistentes). Queda
              archivado en el historial de capacitaciones de la empresa.
            </p>
          </div>
          <div className="rounded-xl bg-white/70 border border-indigo-100 p-3 space-y-1">
            <p className="font-bold text-indigo-900 flex items-center gap-1.5">
              <Database className="h-4 w-4" /> Lista de asistentes (opcional)
            </p>
            <p className="text-indigo-900/75 font-semibold text-xs leading-relaxed">
              Cada persona se vincula a la charla del paso 1 y aparece en{" "}
              <Link
                href="/capacitaciones/base-datos"
                className="text-indigo-700 underline underline-offset-2"
              >
                Base de datos
              </Link>
              . No reemplaza el PDF en papel.
            </p>
          </div>
        </div>
        <p className="text-xs font-semibold text-indigo-800/80">
          Necesitás completar al menos uno: escaneo en el Paso 2 o asistentes en
          el Paso 3.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <div
            ref={errorRef}
            className="rounded-xl bg-red-50 border border-red-100 p-4 text-sm text-red-800 font-semibold"
          >
            {error}
          </div>
        )}

        <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
          <div>
            <span className="inline-flex items-center rounded-full bg-blue-50 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-blue-700">
              Paso 1
            </span>
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5 mt-2">
              <Calendar className="h-4 w-4 text-blue-600" />
              Datos de la charla
            </h2>
            <p className="text-xs text-slate-500 font-semibold mt-1">
              Definí qué capacitación estás cargando. Estos datos se usan en el
              historial, en la plantilla PDF y para vincular a los asistentes.
            </p>
          </div>

          <div className="rounded-xl border border-blue-100 bg-blue-50/50 px-4 py-3 text-xs font-semibold text-blue-900">
            <span className="font-black uppercase tracking-wider text-[10px] text-blue-700">
              Vista previa
            </span>
            <p className="mt-1">
              <span className="font-bold">{capacitacionPreview.tema}</span>
              {" · "}
              {capacitacionPreview.cuando}
            </p>
          </div>

          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Título / tema (opcional)
            </label>
            <input
              type="text"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Ej: Uso de matafuegos — charla presencial"
              className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm font-semibold"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                Fecha *
              </label>
              <input
                type="date"
                required
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
                className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm font-semibold"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                Hora *
              </label>
              <input
                type="time"
                required
                value={hora}
                onChange={(e) => setHora(e.target.value)}
                className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm font-semibold"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                Instructor (opcional)
              </label>
              <input
                type="text"
                value={instructor}
                onChange={(e) => setInstructor(e.target.value)}
                placeholder="Nombre del capacitador"
                className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm font-semibold"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                Cantidad de horas (opcional)
              </label>
              <input
                type="text"
                value={cantidadHoras}
                onChange={(e) => setCantidadHoras(e.target.value)}
                placeholder="Ej: 1"
                className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm font-semibold"
              />
            </div>
          </div>

        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
          <div>
            <span className="inline-flex items-center rounded-full bg-indigo-50 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-indigo-700">
              Paso 2
            </span>
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5 mt-2">
              <FileUp className="h-4 w-4 text-indigo-600" />
              Registro en papel
            </h2>
            <p className="text-xs text-slate-500 font-semibold mt-1">
              Descargá la plantilla con los datos del paso 1, imprimila y hacé
              firmar en la planta. Después subí el escaneo o la foto.
            </p>
          </div>

          <button
            type="button"
            onClick={() => void handleDescargarPlantilla()}
            disabled={downloading}
            className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-sm flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <Download className="h-4 w-4" />
            {downloading
              ? "Generando plantilla..."
              : "Descargar plantilla base (PDF)"}
          </button>
          <p className="text-[11px] text-slate-500 font-semibold text-center">
            La plantilla usa el mismo formato oficial del registro digital, con
            logo de la empresa y filas en blanco para firmas.
          </p>

          <div className="border-t border-slate-100 pt-4 space-y-3">
            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Escaneo o foto del registro firmado
              {participantes.length === 0 ? " *" : " (opcional si cargás asistentes)"}
            </label>
            <p className="text-xs text-slate-500 font-semibold -mt-1">
              Foto o PDF del registro ya completado en papel (máx. 10 MB).
            </p>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,application/pdf,.jpg,.jpeg,.png,.webp,.pdf"
            onChange={(e) => setArchivo(e.target.files?.[0] || null)}
            className="block w-full text-sm text-slate-600 file:mr-4 file:py-2.5 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer"
          />
          {archivo && (
            <p className="text-xs font-semibold text-slate-600">
              Seleccionado: {archivo.name}
            </p>
          )}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
            <div>
              <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-emerald-700">
                Paso 3 · Opcional
              </span>
              <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5 mt-2">
                <Users className="h-4 w-4 text-emerald-600" />
                Asistentes en base de datos
              </h2>
              <p className="text-xs text-slate-500 font-semibold mt-1 max-w-2xl">
                Cargá quién asistió a la charla del paso 1. Al guardar, cada
                fila se vincula a{" "}
                <span className="text-slate-700">
                  «{capacitacionPreview.tema}» ({capacitacionPreview.cuando})
                </span>{" "}
                y queda consultable en Base de datos. La calificación es
                opcional; sin ella figura como «Asistió».
              </p>
            </div>
            <button
              type="button"
              onClick={() =>
                setParticipantes((prev) => [...prev, newParticipanteRow()])
              }
              className="inline-flex shrink-0 items-center justify-center gap-1.5 px-3 py-2 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-700 text-xs font-bold hover:bg-emerald-100 cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" />
              Agregar participante
            </button>
          </div>

          {participantes.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/80 px-4 py-6 text-center">
              <p className="text-sm font-semibold text-slate-600">
                Sin asistentes cargados
              </p>
              <p className="text-xs text-slate-500 font-semibold mt-1">
                Podés guardar solo el PDF del paso 2, o agregar la lista para
                consultarla después en Base de datos.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {participantes.map((p, index) => {
                const dniTouched = p.dni.length > 0;
                const dniInvalid = dniTouched && !isDniValid(p.dni);

                return (
                  <div
                    key={p.id}
                    className="grid grid-cols-1 sm:grid-cols-12 gap-2 p-3 rounded-xl border border-slate-100 bg-slate-50/60"
                  >
                    <div className="sm:col-span-4 space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase">
                        Nombre y apellido *
                      </label>
                      <input
                        type="text"
                        value={p.nombre}
                        maxLength={MAX_NOMBRE_LENGTH}
                        onChange={(e) =>
                          updateParticipante(
                            p.id,
                            "nombre",
                            e.target.value.slice(0, MAX_NOMBRE_LENGTH),
                          )
                        }
                        placeholder="Ej: Martín Pérez"
                        className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm font-semibold bg-white"
                      />
                    </div>
                    <div className="sm:col-span-2 space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase">
                        DNI *
                      </label>
                      <input
                        type="text"
                        inputMode="numeric"
                        autoComplete="off"
                        maxLength={MAX_DNI_LENGTH}
                        value={p.dni}
                        onChange={(e) =>
                          updateParticipante(
                            p.id,
                            "dni",
                            sanitizeDni(e.target.value),
                          )
                        }
                        placeholder="12345678"
                        aria-invalid={dniInvalid}
                        className={`w-full px-3 py-2.5 border rounded-xl text-sm font-semibold bg-white ${
                          dniInvalid
                            ? "border-rose-300 ring-1 ring-rose-200"
                            : "border-slate-200"
                        }`}
                      />
                      {dniInvalid && (
                        <p className="text-[10px] font-semibold text-rose-600">
                          7 u 8 dígitos, solo números
                        </p>
                      )}
                    </div>
                    <div className="sm:col-span-2 space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase">
                        Calif. % (opc.)
                      </label>
                      <input
                        type="text"
                        inputMode="numeric"
                        maxLength={3}
                        value={p.calificacion}
                        onChange={(e) =>
                          updateParticipante(
                            p.id,
                            "calificacion",
                            sanitizeCalificacion(e.target.value),
                          )
                        }
                        placeholder="—"
                        className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm font-semibold bg-white"
                      />
                    </div>
                    <div className="sm:col-span-3 space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase">
                        Sector (opc.)
                      </label>
                      <input
                        type="text"
                        value={p.sector}
                        maxLength={MAX_SECTOR_LENGTH}
                        onChange={(e) =>
                          updateParticipante(
                            p.id,
                            "sector",
                            e.target.value.slice(0, MAX_SECTOR_LENGTH),
                          )
                        }
                        placeholder="Ej: Producción"
                        className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm font-semibold bg-white"
                      />
                    </div>
                    <div className="sm:col-span-1 flex items-end justify-end">
                      <button
                        type="button"
                        onClick={() =>
                          setParticipantes((prev) =>
                            prev.filter((row) => row.id !== p.id),
                          )
                        }
                        className="p-2.5 rounded-xl text-rose-600 hover:bg-rose-50 cursor-pointer"
                        title={`Quitar participante ${index + 1}`}
                        aria-label={`Quitar participante ${index + 1}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <button
          type="submit"
          disabled={saving}
          className="w-full py-4 bg-brand-primary hover:bg-brand-primary/95 text-white font-bold rounded-xl shadow-md text-sm flex items-center justify-center gap-2 disabled:opacity-50"
        >
          <Save className="h-4 w-4" />
          {saving
            ? "Cargando..."
            : participantes.some((p) => p.nombre.trim() || p.dni)
              ? archivo
                ? "Guardar registro y asistentes"
                : "Guardar asistentes en base de datos"
              : "Ingresar registro al historial"}
        </button>
      </form>
    </div>
  );
}
