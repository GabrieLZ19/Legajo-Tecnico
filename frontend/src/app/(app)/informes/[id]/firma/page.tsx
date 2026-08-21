"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useInformeDetalle, firmarInforme } from "@/hooks/useInformes";
import FirmaCanvas from "@/components/FirmaCanvas";
import { useQueryClient } from "@tanstack/react-query";
import { ShieldAlert, ArrowLeft } from "lucide-react";
import { useAlert } from "@/context/AlertContext";
import { useAuth } from "@/hooks/useAuth";

export default function FirmaInformePage() {
  const { id } = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { showAlert } = useAlert();
  const { user } = useAuth();
  const { data: informe, isLoading, error } = useInformeDetalle(id as string);
  const [loading, setLoading] = useState(false);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-600"></div>
        <p className="text-xs text-slate-500 mt-3 font-semibold">
          Cargando datos del informe...
        </p>
      </div>
    );
  }

  if (error || !informe) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-8 text-center space-y-4">
        <ShieldAlert className="h-12 w-12 text-red-500 mx-auto" />
        <h2 className="text-lg font-bold text-slate-800">
          Error al cargar el informe
        </h2>
        <p className="text-sm text-slate-500">
          No se pudo encontrar el informe o no tienes permisos de acceso.
        </p>
      </div>
    );
  }

  const estado = informe.estado_firma;
  const needsPreventor =
    estado === "borrador" || estado === "pendiente_preventor";
  const needsDueno = estado === "pendiente_dueno";
  const rol = user?.rol;
  const canSignPreventor =
    needsPreventor && (rol === "preventor" || rol === "admin");
  const canSignDueno = needsDueno && (rol === "dueno" || rol === "admin");
  const canSign = canSignPreventor || canSignDueno;

  const handleSaveSignature = async (base64: string) => {
    if (!canSign) return;
    setLoading(true);
    try {
      const endpoint = canSignPreventor
        ? `/informes/${id}/firma-preventor`
        : `/informes/${id}/firma-dueno`;

      await firmarInforme(endpoint, {
        firma_base64: base64,
      });

      queryClient.invalidateQueries({ queryKey: ["informe", id] });
      queryClient.invalidateQueries({ queryKey: ["informes"] });

      router.push(`/informes/${id}`);
    } catch (err: any) {
      showAlert(
        "error",
        "Error al firmar",
        err.response?.data?.error || "Error al guardar la firma",
      );
    } finally {
      setLoading(false);
    }
  };

  if (!needsPreventor && !needsDueno) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-8 text-center space-y-4 max-w-md mx-auto">
        <ShieldAlert className="h-12 w-12 text-amber-500 mx-auto" />
        <h2 className="text-lg font-bold text-slate-800">Informe ya firmado</h2>
        <p className="text-sm text-slate-500">
          Este informe ya ha sido firmado y no requiere firmas adicionales en
          esta fase.
        </p>
        <button
          onClick={() => router.push(`/informes/${id}`)}
          className="inline-flex items-center gap-1.5 px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-lg text-sm font-semibold transition-colors cursor-pointer"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver al detalle
        </button>
      </div>
    );
  }

  if (!canSign) {
    const mensaje = needsDueno
      ? "Este informe ya fue firmado por el preventor. Solo el dueño de la empresa (o un administrador) puede completar la firma de conformidad."
      : "Solo el preventor (o un administrador) puede firmar esta etapa del informe.";

    return (
      <div className="bg-white border border-slate-200 rounded-xl p-8 text-center space-y-4 max-w-md mx-auto">
        <ShieldAlert className="h-12 w-12 text-amber-500 mx-auto" />
        <h2 className="text-lg font-bold text-slate-800">
          No podés firmar esta etapa
        </h2>
        <p className="text-sm text-slate-500">{mensaje}</p>
        <button
          onClick={() => router.push(`/informes/${id}`)}
          className="inline-flex items-center gap-1.5 px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-lg text-sm font-semibold transition-colors cursor-pointer"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver al detalle
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <button
        onClick={() => router.push(`/informes/${id}`)}
        className="inline-flex items-center gap-1.5 text-slate-500 hover:text-slate-700 text-sm font-semibold transition-colors cursor-pointer"
      >
        <ArrowLeft className="h-4 w-4" />
        Volver al informe
      </button>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-600"></div>
          <p className="text-xs text-slate-500 mt-3 font-semibold">
            Guardando firma y actualizando informe...
          </p>
        </div>
      ) : (
        <FirmaCanvas
          onSave={handleSaveSignature}
          onCancel={() => router.push(`/informes/${id}`)}
          title={
            canSignPreventor
              ? "Firma del Profesional (Preventor)"
              : "Firma de Conformidad (Dueño de Empresa)"
          }
        />
      )}
    </div>
  );
}
