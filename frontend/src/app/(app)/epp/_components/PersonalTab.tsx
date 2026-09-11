"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  QrCode,
  UserPlus,
  Download,
  Pencil,
  AlertCircle,
  Check,
  Users,
  X,
} from "lucide-react";
import type { Empleado, EppTipo } from "@/types";
import { useEpp } from "@/hooks/useEpp";
import { useAlert } from "@/context/AlertContext";
import { PaginationBar } from "@/components/PaginationBar";

const PAGE_SIZE = 10;

type PersonalTabProps = {
  tipos: EppTipo[];
  empresaId: string;
  canEdit: boolean;
};

type EmpleadoFormState = {
  nombre: string;
  documento: string;
  sector: string;
  puesto: string;
  eppTipoIds: string[];
};

const emptyForm = (): EmpleadoFormState => ({
  nombre: "",
  documento: "",
  sector: "",
  puesto: "",
  eppTipoIds: [],
});

function normalizeName(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function parseEppNecesariosToIds(
  text: string | null | undefined,
  tipos: EppTipo[],
): string[] {
  if (!text?.trim()) return [];
  const parts = text
    .split(",")
    .map((part) => normalizeName(part))
    .filter(Boolean);
  if (parts.length === 0) return [];

  return tipos
    .filter((tipo) => parts.includes(normalizeName(tipo.nombre)))
    .map((tipo) => tipo.id);
}

function serializeEppNecesarios(
  tipos: EppTipo[],
  ids: string[],
): string | undefined {
  const selected = tipos
    .filter((tipo) => ids.includes(tipo.id))
    .map((tipo) => tipo.nombre.trim())
    .filter(Boolean);
  if (selected.length === 0) return undefined;
  return selected.join(", ");
}

function incompletoAnexoI(emp: Empleado): boolean {
  return !emp.puesto?.trim() || !emp.epp_necesarios?.trim();
}

function apiErrorMessage(err: unknown, fallback: string): string {
  if (
    typeof err === "object" &&
    err !== null &&
    "response" in err &&
    typeof (err as { response?: { data?: { error?: string } } }).response?.data
      ?.error === "string"
  ) {
    return (err as { response: { data: { error: string } } }).response.data.error;
  }
  return fallback;
}

function EppNecesariosPicker({
  tipos,
  selectedIds,
  onChange,
}: {
  tipos: EppTipo[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
}) {
  const visibles = useMemo(
    () =>
      [...tipos]
        .filter((tipo) => tipo.activo !== false)
        .sort((a, b) => a.nombre.localeCompare(b.nombre, "es")),
    [tipos],
  );

  const toggle = (id: string) => {
    if (selectedIds.includes(id)) {
      onChange(selectedIds.filter((item) => item !== id));
      return;
    }
    onChange([...selectedIds, id]);
  };

  if (visibles.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-center">
        <p className="text-sm font-bold text-slate-600">No hay EPP en el catálogo</p>
        <p className="mt-1 text-xs font-medium text-slate-400">
          Cargalos primero en la pestaña Catálogo.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="max-h-48 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50/70 p-2 grid grid-cols-1 sm:grid-cols-2 gap-1.5">
        {visibles.map((tipo) => {
          const checked = selectedIds.includes(tipo.id);
          return (
            <button
              key={tipo.id}
              type="button"
              onClick={() => toggle(tipo.id)}
              className={`flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm font-semibold transition-colors cursor-pointer ${
                checked
                  ? "bg-blue-600 text-white shadow-sm"
                  : "bg-white text-slate-700 hover:bg-slate-100 border border-slate-100"
              }`}
            >
              <span
                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${
                  checked ? "border-white/30 bg-white/15" : "border-slate-300 bg-white"
                }`}
              >
                {checked ? <Check className="h-3.5 w-3.5" /> : null}
              </span>
              <span className="truncate leading-tight">{tipo.nombre}</span>
            </button>
          );
        })}
      </div>
      <p className="text-[11px] font-semibold text-slate-400">
        {selectedIds.length > 0
          ? `${selectedIds.length} seleccionado${selectedIds.length === 1 ? "" : "s"}`
          : "Seleccioná los EPP que usa este puesto"}
      </p>
    </div>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
      {children}
    </label>
  );
}

function TrabajadorFormFields({
  form,
  setForm,
  tipos,
}: {
  form: EmpleadoFormState;
  setForm: React.Dispatch<React.SetStateAction<EmpleadoFormState>>;
  tipos: EppTipo[];
}) {
  return (
    <div className="space-y-5">
      <section className="space-y-3">
        <p className="text-[11px] font-black uppercase tracking-wider text-slate-400">
          Datos del trabajador
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="sm:col-span-2">
            <FieldLabel>Nombre y apellido</FieldLabel>
            <input
              required
              minLength={3}
              value={form.nombre}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  nombre: e.target.value.replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑ\s]/g, ""),
                }))
              }
              placeholder="Ej. Víctor Ariel Notario"
              className="w-full min-h-12 px-4 py-3 border border-slate-200 rounded-xl text-base sm:text-sm font-medium focus:outline-hidden focus:ring-2 focus:ring-blue-500/25 focus:border-blue-500"
            />
          </div>
          <div>
            <FieldLabel>DNI</FieldLabel>
            <input
              required
              inputMode="numeric"
              maxLength={8}
              value={form.documento}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  documento: e.target.value.replace(/\D/g, "").slice(0, 8),
                }))
              }
              placeholder="Solo números"
              className="w-full min-h-12 px-4 py-3 border border-slate-200 rounded-xl text-base sm:text-sm font-medium focus:outline-hidden focus:ring-2 focus:ring-blue-500/25 focus:border-blue-500"
            />
          </div>
          <div>
            <FieldLabel>Sector (opcional)</FieldLabel>
            <input
              value={form.sector}
              onChange={(e) => setForm((f) => ({ ...f, sector: e.target.value }))}
              placeholder="Ej. Planta / Administración"
              className="w-full min-h-12 px-4 py-3 border border-slate-200 rounded-xl text-base sm:text-sm font-medium focus:outline-hidden focus:ring-2 focus:ring-blue-500/25 focus:border-blue-500"
            />
          </div>
        </div>
      </section>

      <section className="space-y-3 border-t border-slate-100 pt-5">
        <div>
          <p className="text-[11px] font-black uppercase tracking-wider text-slate-400">
            Anexo I — Planilla oficial
          </p>
          <p className="mt-1 text-xs font-medium text-slate-400 leading-relaxed">
            Se imprimen solos al registrar una entrega de EPP.
          </p>
        </div>
        <div>
          <FieldLabel>Puesto de trabajo</FieldLabel>
          <textarea
            value={form.puesto}
            onChange={(e) => setForm((f) => ({ ...f, puesto: e.target.value }))}
            placeholder="Ej. Operario de embolse"
            maxLength={500}
            rows={2}
            className="w-full px-4 py-3 border border-slate-200 rounded-xl text-base sm:text-sm font-medium resize-none focus:outline-hidden focus:ring-2 focus:ring-blue-500/25 focus:border-blue-500"
          />
        </div>
        <div>
          <FieldLabel>EPP necesarios según el puesto</FieldLabel>
          <EppNecesariosPicker
            tipos={tipos}
            selectedIds={form.eppTipoIds}
            onChange={(ids) => setForm((f) => ({ ...f, eppTipoIds: ids }))}
          />
        </div>
      </section>
    </div>
  );
}

export function PersonalTab({
  tipos,
  empresaId,
  canEdit,
}: PersonalTabProps) {
  const { getEmpleados, crearEmpleado, actualizarEmpleado, generarQrEmpleado } =
    useEpp();
  const { showAlert } = useAlert();
  const [empleados, setEmpleados] = useState<Empleado[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<"create" | "edit" | null>(null);
  const [editing, setEditing] = useState<Empleado | null>(null);
  const [form, setForm] = useState<EmpleadoFormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [qrPreview, setQrPreview] = useState<{ nombre: string; qr: string } | null>(null);
  const [busqueda, setBusqueda] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [page, setPage] = useState(0);

  const tiposActivos = useMemo(
    () => tipos.filter((tipo) => tipo.activo !== false),
    [tipos],
  );

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedQ(busqueda.trim()), 300);
    return () => window.clearTimeout(t);
  }, [busqueda]);

  useEffect(() => {
    setPage(0);
  }, [debouncedQ]);

  const fetchEmpleados = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getEmpleados(empresaId, {
        limit: PAGE_SIZE,
        offset: page * PAGE_SIZE,
        q: debouncedQ || undefined,
      });
      setEmpleados(data.empleados || []);
      setTotal(data.total ?? 0);
    } catch (err) {
      console.error("Error cargando personal:", err);
      setEmpleados([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [empresaId, getEmpleados, page, debouncedQ]);

  useEffect(() => {
    void fetchEmpleados();
  }, [fetchEmpleados]);

  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    if (page > totalPages - 1) setPage(Math.max(0, totalPages - 1));
  }, [total, page]);

  const incompletos = empleados.filter(incompletoAnexoI).length;

  const closeModal = () => {
    setModal(null);
    setEditing(null);
    setForm(emptyForm());
  };

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm());
    setModal("create");
  };

  const openEdit = (emp: Empleado) => {
    setEditing(emp);
    setForm({
      nombre: emp.nombre,
      documento: emp.documento,
      sector: emp.sector || "",
      puesto: emp.puesto || "",
      eppTipoIds: parseEppNecesariosToIds(emp.epp_necesarios, tiposActivos),
    });
    setModal("edit");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const eppNecesarios = serializeEppNecesarios(tiposActivos, form.eppTipoIds);

      if (modal === "edit" && editing) {
        await actualizarEmpleado(editing.id, {
          nombre: form.nombre,
          documento: form.documento,
          sector: form.sector || null,
          puesto: form.puesto || null,
          epp_necesarios: eppNecesarios ?? null,
        });
        showAlert(
          "success",
          "Trabajador actualizado",
          "Los datos de Anexo I se usan al generar la planilla oficial.",
        );
      } else {
        await crearEmpleado({
          empresa_id: empresaId,
          nombre: form.nombre,
          documento: form.documento,
          sector: form.sector || undefined,
          puesto: form.puesto || undefined,
          epp_necesarios: eppNecesarios,
        });
        showAlert(
          "success",
          "Trabajador dado de alta",
          form.puesto && eppNecesarios
            ? "Al entregar EPP, el puesto y los EPP necesarios se completan solos en la planilla."
            : "Completá puesto y EPP necesarios para que salgan en la planilla oficial.",
        );
      }

      closeModal();
      await fetchEmpleados();
    } catch (err: unknown) {
      showAlert(
        "error",
        "Error",
        apiErrorMessage(
          err,
          modal === "edit"
            ? "No se pudo actualizar el trabajador."
            : "No se pudo dar de alta al trabajador.",
        ),
      );
    } finally {
      setSaving(false);
    }
  };

  const handleQr = async (empleado: Empleado) => {
    try {
      const data = await generarQrEmpleado(empleado.id);
      setQrPreview({ nombre: empleado.nombre, qr: data.qr });
    } catch {
      showAlert("error", "Error", "No se pudo generar el QR.");
    }
  };

  const downloadQr = () => {
    if (!qrPreview) return;
    const link = document.createElement("a");
    link.href = qrPreview.qr;
    link.download = `QR_${qrPreview.nombre.replace(/\s+/g, "_")}.png`;
    link.click();
  };

  const editOrphanText =
    modal === "edit" &&
    editing?.epp_necesarios?.trim() &&
    parseEppNecesariosToIds(editing.epp_necesarios, tiposActivos).length === 0
      ? editing.epp_necesarios.trim()
      : null;

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h2 className="text-base font-black text-slate-800 tracking-tight">
            Padrón de personal
          </h2>
          <p className="mt-1 text-xs font-medium text-slate-500 max-w-xl leading-relaxed">
            Cada trabajador tiene su puesto y EPP del catálogo para completar solos la
            planilla Res. 299/11.
          </p>
          {!loading && total > 0 && (
            <p className="mt-2 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              {total} trabajador{total === 1 ? "" : "es"}
              {incompletos > 0
                ? ` · ${incompletos} sin Anexo I en esta página`
                : ""}
            </p>
          )}
        </div>
        {canEdit && (
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex items-center justify-center gap-2 w-full sm:w-auto min-h-12 px-5 py-3 bg-slate-900 hover:bg-slate-800 text-white text-sm font-bold rounded-xl cursor-pointer"
          >
            <UserPlus className="h-5 w-5" />
            Nuevo trabajador
          </button>
        )}
      </div>

      {!loading && (total > 0 || debouncedQ) && (
        <div className="relative">
          <input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por nombre, DNI, sector o puesto…"
            className="w-full min-h-12 pl-4 pr-10 py-3 bg-white border border-slate-200 rounded-2xl text-sm font-medium focus:outline-hidden focus:ring-2 focus:ring-blue-500/25 focus:border-blue-500"
          />
          {busqueda && (
            <button
              type="button"
              onClick={() => setBusqueda("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-slate-600 cursor-pointer"
              aria-label="Limpiar búsqueda"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      )}

      <div className="bg-white rounded-3xl border border-slate-100 overflow-hidden shadow-xs">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-14">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-600" />
            <p className="text-xs text-slate-400 mt-3 font-semibold">
              Cargando personal…
            </p>
          </div>
        ) : total === 0 && !debouncedQ ? (
          <div className="px-6 py-14 text-center">
            <Users className="h-9 w-9 text-slate-300 mx-auto mb-3" />
            <p className="text-sm font-bold text-slate-600">Todavía no hay trabajadores</p>
            <p className="mt-1 text-xs font-medium text-slate-400 max-w-sm mx-auto">
              Dalos de alta acá para emitir QR y completar el Anexo I en las entregas.
            </p>
            {canEdit && (
              <button
                type="button"
                onClick={openCreate}
                className="mt-5 inline-flex items-center justify-center gap-2 min-h-11 px-4 py-2.5 bg-slate-900 text-white text-sm font-bold rounded-xl cursor-pointer"
              >
                <UserPlus className="h-4 w-4" />
                Nuevo trabajador
              </button>
            )}
          </div>
        ) : empleados.length === 0 ? (
          <p className="px-6 py-12 text-center text-sm font-semibold text-slate-400">
            Ningún trabajador coincide con “{busqueda}”.
          </p>
        ) : (
          <>
            <div className="hidden md:grid grid-cols-[minmax(0,1.4fr)_7rem_minmax(0,1fr)_minmax(0,1.3fr)_auto] gap-3 px-5 py-3 bg-slate-50/80 border-b border-slate-100 text-[10px] font-black uppercase tracking-wider text-slate-400">
              <span>Trabajador</span>
              <span>DNI</span>
              <span>Puesto</span>
              <span>EPP necesarios</span>
              <span className="text-right">Acciones</span>
            </div>
            <ul className="divide-y divide-slate-100">
              {empleados.map((emp) => {
                const incomplete = incompletoAnexoI(emp);
                return (
                  <li
                    key={emp.id}
                    className="px-4 sm:px-5 py-4 grid grid-cols-1 md:grid-cols-[minmax(0,1.4fr)_7rem_minmax(0,1fr)_minmax(0,1.3fr)_auto] gap-2 md:gap-3 md:items-center"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-bold text-slate-800 truncate">
                          {emp.nombre}
                        </p>
                        {incomplete && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-2 py-0.5">
                            <AlertCircle className="h-3 w-3" />
                            Falta Anexo I
                          </span>
                        )}
                        {!emp.activo && (
                          <span className="text-[10px] font-bold uppercase text-slate-400">
                            Inactivo
                          </span>
                        )}
                      </div>
                      {emp.sector && (
                        <p className="text-[11px] font-semibold text-slate-400 mt-0.5 md:hidden">
                          Sector: {emp.sector}
                        </p>
                      )}
                      {emp.sector && (
                        <p className="hidden md:block text-[11px] font-semibold text-slate-400 mt-0.5 truncate">
                          {emp.sector}
                        </p>
                      )}
                    </div>
                    <p className="text-xs font-semibold text-slate-500 tabular-nums">
                      <span className="md:hidden text-slate-400">DNI </span>
                      {emp.documento}
                    </p>
                    <p className="text-xs font-medium text-slate-600 truncate">
                      <span className="md:hidden text-slate-400 font-semibold">Puesto: </span>
                      {emp.puesto?.trim() || "—"}
                    </p>
                    <p className="text-xs font-medium text-slate-600 line-clamp-2">
                      <span className="md:hidden text-slate-400 font-semibold">
                        EPP necesarios:{" "}
                      </span>
                      {emp.epp_necesarios?.trim() || "—"}
                    </p>
                    <div className="flex items-center gap-2 md:justify-end pt-1 md:pt-0">
                      {canEdit && (
                        <button
                          type="button"
                          onClick={() => openEdit(emp)}
                          className="inline-flex items-center justify-center gap-1.5 min-h-11 px-3.5 py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 text-sm font-bold rounded-xl cursor-pointer"
                        >
                          <Pencil className="h-4 w-4" />
                          Editar
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => handleQr(emp)}
                        className="inline-flex items-center justify-center gap-1.5 min-h-11 px-3.5 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 text-sm font-bold rounded-xl cursor-pointer"
                      >
                        <QrCode className="h-4 w-4" />
                        QR
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
            <div className="p-3 border-t border-slate-100">
              <PaginationBar
                page={page}
                pageSize={PAGE_SIZE}
                total={total}
                onPageChange={setPage}
                disabled={loading}
              />
            </div>
          </>
        )}
      </div>

      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
          <form
            onSubmit={handleSubmit}
            className="bg-white w-full max-w-xl rounded-2xl shadow-xl max-h-[90vh] overflow-y-auto"
          >
            <div className="sticky top-0 z-10 flex items-start justify-between gap-3 bg-white border-b border-slate-100 px-6 py-4 rounded-t-2xl">
              <div>
                <h3 className="text-lg font-black text-slate-800">
                  {modal === "edit" ? "Editar trabajador" : "Nuevo trabajador"}
                </h3>
                <p className="mt-0.5 text-xs font-medium text-slate-400">
                  Los EPP se eligen del catálogo existente.
                </p>
              </div>
              <button
                type="button"
                onClick={closeModal}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-50 cursor-pointer"
                aria-label="Cerrar"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="px-6 py-5">
              <TrabajadorFormFields form={form} setForm={setForm} tipos={tiposActivos} />
              {editOrphanText && form.eppTipoIds.length === 0 && (
                <p className="mt-3 text-[11px] font-semibold text-amber-700 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2">
                  Había un texto libre (“{editOrphanText}”) que no coincide con el catálogo.
                  Marcá los EPP correctos.
                </p>
              )}
            </div>

            <div className="sticky bottom-0 flex gap-2 bg-white border-t border-slate-100 px-6 py-4 rounded-b-2xl">
              <button
                type="button"
                onClick={closeModal}
                className="flex-1 min-h-12 py-3 border border-slate-200 rounded-xl text-sm font-bold cursor-pointer hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={saving}
                className="flex-1 min-h-12 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-bold cursor-pointer disabled:opacity-50"
              >
                {saving ? "Guardando..." : modal === "edit" ? "Guardar cambios" : "Dar de alta"}
              </button>
            </div>
          </form>
        </div>
      )}

      {qrPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
          <div className="bg-white rounded-3xl p-6 w-full max-w-sm text-center space-y-4">
            <h3 className="text-sm font-black uppercase tracking-wider text-slate-800">
              QR de {qrPreview.nombre}
            </h3>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qrPreview.qr} alt="QR trabajador" className="mx-auto w-56 h-56" />
            <p className="text-[11px] text-slate-400">
              Imprimí o mostrá este código para registrar entregas en campo.
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setQrPreview(null)}
                className="flex-1 min-h-12 py-3 border rounded-xl text-sm font-bold cursor-pointer"
              >
                Cerrar
              </button>
              <button
                type="button"
                onClick={downloadQr}
                className="flex-1 min-h-12 py-3 bg-blue-600 text-white rounded-xl text-sm font-bold inline-flex items-center justify-center gap-2 cursor-pointer"
              >
                <Download className="h-4 w-4" />
                Descargar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
