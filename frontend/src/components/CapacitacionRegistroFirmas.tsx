"use client";

import { useEffect, useRef, useState } from "react";
import type SignatureCanvas from "react-signature-canvas";
import { Capacitacion } from "@/types";
import { PenLine, Save } from "lucide-react";
import SignaturePad, { readSignatureOrThrow } from "@/components/SignaturePad";
import { isSignatureEmpty } from "@/lib/signature";
import CapacitacionAgendaFields from "@/components/CapacitacionAgendaFields";
import {
  CapAgendaErrors,
  CapAgendaValue,
  agendaFromStored,
  buildFechasHorario,
  hasAgendaErrors,
  validateAgenda,
} from "@/lib/cap-agenda";

interface Props {
  cap: Capacitacion;
  canEdit: boolean;
  onSaved: (updated: Capacitacion) => void;
  onSave: (payload: {
    instructor?: string;
    fecha?: string;
    fechas_horario?: string;
    cantidad_horas?: string;
    aclaracion_capacitador?: string;
    aclaracion_empresa?: string;
    firma_capacitador?: string;
    firma_empresa?: string;
  }) => Promise<Capacitacion>;
  onAlert: (
    type: "success" | "error" | "warning" | "info",
    title: string,
    message: string,
  ) => void;
}

export default function CapacitacionRegistroFirmas({
  cap,
  canEdit,
  onSaved,
  onSave,
  onAlert,
}: Props) {
  const [instructor, setInstructor] = useState(cap.instructor || "");
  const [agenda, setAgenda] = useState<CapAgendaValue>(() =>
    agendaFromStored({
      fecha: cap.fecha,
      fechas_horario: cap.fechas_horario,
      cantidad_horas: cap.cantidad_horas,
    }),
  );
  const [agendaErrors, setAgendaErrors] = useState<CapAgendaErrors>({});
  const [aclaracionCap, setAclaracionCap] = useState(
    cap.aclaracion_capacitador || "",
  );
  const [aclaracionEmp, setAclaracionEmp] = useState(
    cap.aclaracion_empresa || "",
  );
  const [saving, setSaving] = useState(false);
  const [firmando, setFirmando] = useState<"capacitador" | "empresa" | null>(
    null,
  );

  const sigCapRef = useRef<SignatureCanvas>(null);
  const sigEmpRef = useRef<SignatureCanvas>(null);

  useEffect(() => {
    setInstructor(cap.instructor || "");
    setAgenda(
      agendaFromStored({
        fecha: cap.fecha,
        fechas_horario: cap.fechas_horario,
        cantidad_horas: cap.cantidad_horas,
      }),
    );
    setAclaracionCap(cap.aclaracion_capacitador || "");
    setAclaracionEmp(cap.aclaracion_empresa || "");
  }, [
    cap.id,
    cap.instructor,
    cap.fecha,
    cap.fechas_horario,
    cap.cantidad_horas,
    cap.aclaracion_capacitador,
    cap.aclaracion_empresa,
  ]);

  const guardarDatos = async () => {
    const nextErrors = validateAgenda(agenda, {
      requireFecha: true,
      requireHorario: true,
    });
    setAgendaErrors(nextErrors);
    if (hasAgendaErrors(nextErrors)) {
      onAlert(
        "warning",
        "Datos incompletos",
        "Revisá la fecha, el horario y la cantidad de horas.",
      );
      return;
    }

    setSaving(true);
    try {
      const updated = await onSave({
        instructor: instructor.trim(),
        fecha: agenda.fecha,
        fechas_horario: buildFechasHorario(agenda),
        cantidad_horas: agenda.cantidadHoras.trim(),
        aclaracion_capacitador: aclaracionCap.trim(),
        aclaracion_empresa: aclaracionEmp.trim(),
      });
      onSaved({ ...cap, ...updated });
      onAlert("success", "Guardado", "Datos del registro actualizados.");
    } catch {
      onAlert("error", "Error", "No se pudieron guardar los datos del registro.");
    } finally {
      setSaving(false);
    }
  };

  const guardarFirma = async (tipo: "capacitador" | "empresa") => {
    const ref = tipo === "capacitador" ? sigCapRef : sigEmpRef;
    if (isSignatureEmpty(ref.current)) {
      onAlert("warning", "Firma vacía", "Firmá en el recuadro antes de confirmar.");
      return;
    }

    setFirmando(tipo);
    try {
      const firma = readSignatureOrThrow(ref.current);
      const payload =
        tipo === "capacitador"
          ? {
              firma_capacitador: firma,
              aclaracion_capacitador: aclaracionCap.trim(),
            }
          : {
              firma_empresa: firma,
              aclaracion_empresa: aclaracionEmp.trim(),
            };

      const updated = await onSave(payload);
      onSaved({ ...cap, ...updated });
      ref.current?.clear();
      onAlert(
        "success",
        "Firma registrada",
        tipo === "capacitador"
          ? "Se guardó la firma del capacitador / HYS."
          : "Se guardó la firma del responsable de la empresa.",
      );
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "No se pudo guardar la firma.";
      onAlert("error", "Error", message);
    } finally {
      setFirmando(null);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-6">
      <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
        <PenLine className="h-4 w-4 text-blue-600" />
        Registro de capacitación (cierre)
      </h2>

      <div className="space-y-4">
        <div className="space-y-1.5">
          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
            Instructor
          </label>
          <input
            type="text"
            disabled={!canEdit}
            value={instructor}
            onChange={(e) => setInstructor(e.target.value)}
            placeholder="Nombre del capacitador"
            className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm font-semibold disabled:bg-slate-50"
          />
        </div>

        <CapacitacionAgendaFields
          value={agenda}
          onChange={(next) => {
            setAgenda(next);
            setAgendaErrors({});
          }}
          errors={agendaErrors}
          disabled={!canEdit}
        />
      </div>

      {canEdit && (
        <button
          type="button"
          onClick={guardarDatos}
          disabled={saving}
          className="inline-flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white font-bold px-4 py-2.5 rounded-xl text-xs disabled:opacity-50"
        >
          <Save className="h-3.5 w-3.5" />
          {saving ? "Guardando..." : "Guardar datos del registro"}
        </button>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2 border-t border-slate-100">
        <div className="space-y-3">
          <p className="text-xs font-black text-slate-800 uppercase tracking-wider">
            Firma del responsable de HYS
          </p>
          {cap.firma_capacitador_url ? (
            <div className="rounded-xl border border-emerald-100 bg-emerald-50/40 p-3">
              <img
                src={cap.firma_capacitador_url}
                alt="Firma capacitador"
                className="h-16 object-contain mx-auto"
              />
              <p className="text-[11px] text-slate-600 mt-2 text-center font-semibold">
                Aclaración: {cap.aclaracion_capacitador || "—"}
              </p>
            </div>
          ) : canEdit ? (
            <>
              <SignaturePad ref={sigCapRef} heightClassName="h-36" />
              <input
                type="text"
                value={aclaracionCap}
                onChange={(e) => setAclaracionCap(e.target.value)}
                placeholder="Aclaración"
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-semibold"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => sigCapRef.current?.clear()}
                  className="flex-1 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-600"
                >
                  Limpiar
                </button>
                <button
                  type="button"
                  disabled={firmando === "capacitador"}
                  onClick={() => guardarFirma("capacitador")}
                  className="flex-1 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold disabled:opacity-50"
                >
                  {firmando === "capacitador" ? "Guardando..." : "Confirmar firma"}
                </button>
              </div>
            </>
          ) : (
            <p className="text-xs text-slate-400 font-semibold">
              Pendiente de firma
            </p>
          )}
        </div>

        <div className="space-y-3">
          <p className="text-xs font-black text-slate-800 uppercase tracking-wider">
            Responsable por la empresa
          </p>
          {cap.firma_empresa_url ? (
            <div className="rounded-xl border border-emerald-100 bg-emerald-50/40 p-3">
              <img
                src={cap.firma_empresa_url}
                alt="Firma empresa"
                className="h-16 object-contain mx-auto"
              />
              <p className="text-[11px] text-slate-600 mt-2 text-center font-semibold">
                Aclaración: {cap.aclaracion_empresa || "—"}
              </p>
            </div>
          ) : canEdit ? (
            <>
              <SignaturePad ref={sigEmpRef} heightClassName="h-36" />
              <input
                type="text"
                value={aclaracionEmp}
                onChange={(e) => setAclaracionEmp(e.target.value)}
                placeholder="Aclaración"
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-semibold"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => sigEmpRef.current?.clear()}
                  className="flex-1 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-600"
                >
                  Limpiar
                </button>
                <button
                  type="button"
                  disabled={firmando === "empresa"}
                  onClick={() => guardarFirma("empresa")}
                  className="flex-1 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold disabled:opacity-50"
                >
                  {firmando === "empresa" ? "Guardando..." : "Confirmar firma"}
                </button>
              </div>
            </>
          ) : (
            <p className="text-xs text-slate-400 font-semibold">
              Pendiente de firma
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
