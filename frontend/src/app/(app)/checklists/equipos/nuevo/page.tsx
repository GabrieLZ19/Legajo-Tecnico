"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useAlert } from "@/context/AlertContext";
import { canWriteAppModule } from "@/lib/moduleAccess";
import { checklistsService } from "@/utils/services/checklists.service";
import { useQueryClient } from "@tanstack/react-query";

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

  if (!canWrite) {
    return (
      <p className="text-center py-16 text-slate-500">
        No tenés permiso para crear equipos.
      </p>
    );
  }

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
      showAlert("success", "Equipo creado", "Ya podés usar su código QR.");
      router.push(`/checklists/equipos/${eq.id}`);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: string } } };
      showAlert(
        "error",
        "Error",
        axiosErr.response?.data?.error ||
          (err instanceof Error ? err.message : "No se pudo crear"),
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="w-full max-w-3xl space-y-6">
      <Link
        href="/checklists/equipos"
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-brand-primary"
      >
        <ArrowLeft className="h-4 w-4" />
        Equipos
      </Link>
      <div>
        <h1 className="text-3xl font-black text-slate-900 tracking-tight">
          Nuevo equipo
        </h1>
        <p className="text-sm text-brand-text-muted mt-1">
          Se genera un QR identificatorio para inspeccionar desde el celular.
        </p>
      </div>

      <form
        onSubmit={(e) => void handleSubmit(e)}
        className="rounded-2xl border border-slate-200 bg-white p-6 space-y-4 shadow-2xs"
      >
        <Field label="Nombre" value={nombre} onChange={setNombre} required />
        <Field
          label="Tipo de equipo"
          value={tipoEquipo}
          onChange={setTipoEquipo}
          required
          placeholder="Debe coincidir con plantillas (ej. Extintor)"
        />
        <Field label="Código interno" value={codigo} onChange={setCodigo} />
        <Field label="Ubicación" value={ubicacion} onChange={setUbicacion} />
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">
            Notas
          </label>
          <textarea
            value={notas}
            onChange={(e) => setNotas(e.target.value)}
            rows={3}
            className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
          />
        </div>
        <button
          type="submit"
          disabled={saving}
          className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-brand-primary hover:bg-brand-primary/95 text-white py-3 text-sm font-bold disabled:opacity-60 cursor-pointer"
        >
          {saving && <Loader className="h-4 w-4 animate-spin" />}
          Crear equipo
        </button>
      </form>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  required,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1.5">
        {label}
      </label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        placeholder={placeholder}
        className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
      />
    </div>
  );
}
