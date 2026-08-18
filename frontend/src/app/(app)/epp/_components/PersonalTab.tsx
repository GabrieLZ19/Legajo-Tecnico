"use client";

import { useState } from "react";
import { QrCode, UserPlus, Download } from "lucide-react";
import type { Empleado } from "@/types";
import { useEpp } from "@/hooks/useEpp";
import { useAlert } from "@/context/AlertContext";

type PersonalTabProps = {
  empleados: Empleado[];
  empresaId: string;
  canEdit: boolean;
  onChanged: () => Promise<void>;
};

export function PersonalTab({ empleados, empresaId, canEdit, onChanged }: PersonalTabProps) {
  const { crearEmpleado, generarQrEmpleado } = useEpp();
  const { showAlert } = useAlert();
  const [nombre, setNombre] = useState("");
  const [documento, setDocumento] = useState("");
  const [sector, setSector] = useState("");
  const [saving, setSaving] = useState(false);
  const [qrPreview, setQrPreview] = useState<{ nombre: string; qr: string } | null>(null);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await crearEmpleado({
        empresa_id: empresaId,
        nombre,
        documento,
        sector: sector || undefined,
      });
      setNombre("");
      setDocumento("");
      setSector("");
      await onChanged();
      showAlert("success", "Trabajador dado de alta", "Ya podés generar su QR desde el padrón.");
    } catch {
      showAlert("error", "Error", "No se pudo dar de alta al trabajador.");
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

  return (
    <div className="space-y-6">
      {canEdit && (
        <form
          onSubmit={handleCreate}
          className="bg-white rounded-3xl border border-slate-100 p-5 grid grid-cols-1 sm:grid-cols-4 gap-3"
        >
          <input
            required
            minLength={3}
            value={nombre}
            onChange={(e) => setNombre(e.target.value.replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑ\s]/g, ""))}
            placeholder="Nombre y apellido"
            className="px-3 py-2.5 border border-slate-200 rounded-xl text-sm"
          />
          <input
            required
            inputMode="numeric"
            maxLength={8}
            value={documento}
            onChange={(e) => setDocumento(e.target.value.replace(/\D/g, "").slice(0, 8))}
            placeholder="DNI"
            className="px-3 py-2.5 border border-slate-200 rounded-xl text-sm"
          />
          <input
            value={sector}
            onChange={(e) => setSector(e.target.value)}
            placeholder="Sector (opcional)"
            className="px-3 py-2.5 border border-slate-200 rounded-xl text-sm"
          />
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center justify-center gap-2 bg-slate-900 text-white rounded-xl text-xs font-bold cursor-pointer disabled:opacity-50"
          >
            <UserPlus className="h-4 w-4" />
            Alta
          </button>
        </form>
      )}

      <div className="bg-white rounded-3xl border border-slate-100 overflow-hidden">
        {empleados.length === 0 ? (
          <p className="p-10 text-center text-sm text-slate-400 font-semibold">
            No hay trabajadores cargados. El QR se emite desde este padrón.
          </p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {empleados.map((emp) => (
              <li key={emp.id} className="px-5 py-4 flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-bold text-slate-800">{emp.nombre}</p>
                  <p className="text-[11px] text-slate-400 font-semibold">
                    DNI {emp.documento}
                    {emp.sector ? ` · ${emp.sector}` : ""}
                    {!emp.activo ? " · inactivo" : ""}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleQr(emp)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 bg-blue-50 text-blue-700 text-[11px] font-bold rounded-lg cursor-pointer"
                >
                  <QrCode className="h-3.5 w-3.5" />
                  Ver QR
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {qrPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
          <div className="bg-white rounded-3xl p-6 w-full max-w-sm text-center space-y-4">
            <h3 className="text-sm font-black uppercase tracking-wider text-slate-800">
              QR de {qrPreview.nombre}
            </h3>
            <img src={qrPreview.qr} alt="QR trabajador" className="mx-auto w-56 h-56" />
            <p className="text-[11px] text-slate-400">
              Imprimí o mostrá este código para registrar entregas en campo.
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setQrPreview(null)}
                className="flex-1 py-2.5 border rounded-xl text-sm font-bold cursor-pointer"
              >
                Cerrar
              </button>
              <button
                type="button"
                onClick={downloadQr}
                className="flex-1 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-bold inline-flex items-center justify-center gap-2 cursor-pointer"
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
