"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader, Plus, Trash2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useAlert } from "@/context/AlertContext";
import {
  canPublishToBibliotecaLt,
  canWriteAppModule,
} from "@/lib/moduleAccess";
import { checklistsService } from "@/utils/services/checklists.service";
import type { CriticidadChecklist } from "@/types";
import { useQueryClient } from "@tanstack/react-query";

type ItemDraft = {
  texto: string;
  criticidad: CriticidadChecklist;
};

export default function NuevaPlantillaChecklistPage() {
  const { user, empresa } = useAuth();
  const { showAlert } = useAlert();
  const router = useRouter();
  const queryClient = useQueryClient();
  const canWrite = canWriteAppModule(user, "checklists");
  const canLt = canPublishToBibliotecaLt(user);

  const [titulo, setTitulo] = useState("");
  const [tipoEquipo, setTipoEquipo] = useState("");
  const [guardarEmpresa, setGuardarEmpresa] = useState(true);
  const [enviarLt, setEnviarLt] = useState(false);
  const [items, setItems] = useState<ItemDraft[]>([
    { texto: "", criticidad: "media" },
  ]);
  const [saving, setSaving] = useState(false);

  if (!canWrite) {
    return (
      <p className="text-center py-16 text-slate-500">
        No tenés permiso para crear plantillas.
      </p>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!empresa?.id) return;
    const cleanItems = items
      .map((i) => ({ ...i, texto: i.texto.trim() }))
      .filter((i) => i.texto);
    if (!titulo.trim() || !tipoEquipo.trim() || cleanItems.length === 0) {
      showAlert(
        "warning",
        "Datos incompletos",
        "Completá título, tipo de equipo y al menos un ítem.",
      );
      return;
    }
    if (!guardarEmpresa && !enviarLt) {
      showAlert(
        "warning",
        "Destino requerido",
        "Elegí biblioteca empresa y/o enviar a LT.",
      );
      return;
    }

    setSaving(true);
    try {
      let lastId: string | null = null;
      if (guardarEmpresa) {
        const p = await checklistsService.crearPlantilla({
          titulo: titulo.trim(),
          tipo_equipo: tipoEquipo.trim(),
          ambito: "empresa",
          empresa_id: empresa.id,
          items: cleanItems,
        });
        lastId = p.id;
      }
      if (enviarLt && canLt) {
        const p = await checklistsService.crearPlantilla({
          titulo: titulo.trim(),
          tipo_equipo: tipoEquipo.trim(),
          ambito: "global",
          items: cleanItems,
          publicar_directo: user?.rol === "admin",
        });
        lastId = p.id;
      }
      await queryClient.invalidateQueries({
        queryKey: ["checklist-plantillas-empresa"],
      });
      await queryClient.invalidateQueries({
        queryKey: ["checklist-plantillas-lt"],
      });
      showAlert("success", "Plantilla creada", "Se guardó correctamente.");
      router.push(
        lastId ? `/checklists/plantillas/${lastId}` : "/checklists/plantillas",
      );
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
        href="/checklists/plantillas"
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-brand-primary"
      >
        <ArrowLeft className="h-4 w-4" />
        Volver
      </Link>
      <div>
        <h1 className="text-3xl font-black text-slate-900 tracking-tight">
          Nueva plantilla
        </h1>
        <p className="text-sm text-brand-text-muted mt-1">
          Definí ítems y criticidad. Podés archivar en la empresa y/o enviar a
          la biblioteca LT.
        </p>
      </div>

      <form
        onSubmit={(e) => void handleSubmit(e)}
        className="rounded-2xl border border-slate-200 bg-white p-6 space-y-5 shadow-2xs"
      >
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">
            Título
          </label>
          <input
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">
            Tipo de equipo
          </label>
          <input
            value={tipoEquipo}
            onChange={(e) => setTipoEquipo(e.target.value)}
            placeholder="Ej. Extintor, Escalera, Montacargas"
            className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
            required
          />
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium text-slate-700">Ítems</p>
          {items.map((item, idx) => (
            <div key={idx} className="flex gap-2 items-start">
              <input
                value={item.texto}
                onChange={(e) => {
                  const next = [...items];
                  next[idx] = { ...next[idx], texto: e.target.value };
                  setItems(next);
                }}
                placeholder={`Ítem ${idx + 1}`}
                className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm"
              />
              <select
                value={item.criticidad}
                onChange={(e) => {
                  const next = [...items];
                  next[idx] = {
                    ...next[idx],
                    criticidad: e.target.value as CriticidadChecklist,
                  };
                  setItems(next);
                }}
                className="rounded-xl border border-slate-200 px-2 py-2 text-sm"
              >
                <option value="alta">Alta</option>
                <option value="media">Media</option>
                <option value="baja">Baja</option>
              </select>
              {items.length > 1 && (
                <button
                  type="button"
                  onClick={() => setItems(items.filter((_, i) => i !== idx))}
                  className="p-2 text-slate-400 hover:text-red-600"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
          ))}
          <button
            type="button"
            onClick={() =>
              setItems([...items, { texto: "", criticidad: "media" }])
            }
            className="inline-flex items-center gap-1 text-sm font-medium text-blue-600"
          >
            <Plus className="h-4 w-4" />
            Agregar ítem
          </button>
        </div>

        <div className="space-y-2 border-t border-slate-100 pt-4">
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={guardarEmpresa}
              onChange={(e) => setGuardarEmpresa(e.target.checked)}
            />
            Guardar en biblioteca de la empresa
          </label>
          {canLt && (
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={enviarLt}
                onChange={(e) => setEnviarLt(e.target.checked)}
              />
              Enviar a biblioteca LT (aprobación CRM)
            </label>
          )}
        </div>

        <button
          type="submit"
          disabled={saving}
          className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-brand-primary hover:bg-brand-primary/95 text-white py-3 text-sm font-bold disabled:opacity-60 cursor-pointer"
        >
          {saving && <Loader className="h-4 w-4 animate-spin" />}
          Guardar plantilla
        </button>
      </form>
    </div>
  );
}
