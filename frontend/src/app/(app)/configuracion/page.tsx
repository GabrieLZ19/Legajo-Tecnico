"use client";

import React, { useEffect, useRef, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import Cookies from "js-cookie";
import { Upload, Briefcase, Check, Loader, ShieldAlert } from "lucide-react";
import { getClipboardImageFile } from "@/lib/signature";
import { useAlert } from "@/context/AlertContext";

import { useConfiguracion } from "@/hooks/useConfiguracion";

export default function ConfiguracionPage() {
  const { user, empresa, logout } = useAuth();
  const { showAlert } = useAlert();
  const { uploadEmpresaLogo } = useConfiguracion();
  const [logoUrl, setLogoUrl] = useState<string | null>(
    empresa?.logo_url || null,
  );
  const [uploading, setUploading] = useState(false);
  const [success, setSuccess] = useState(false);
  const uploadingRef = useRef(false);

  const isDuenoOrAdmin = user?.rol === "dueno" || user?.rol === "admin";

  const applyLogoFile = async (file: File) => {
    if (!empresa || uploadingRef.current) return;

    uploadingRef.current = true;
    setUploading(true);
    setSuccess(false);

    try {
      const responseData = await uploadEmpresaLogo(empresa.id, file);

      const newLogoUrl = responseData.logo_url;
      setLogoUrl(newLogoUrl);
      setSuccess(true);

      const updatedEmpresa = { ...empresa, logo_url: newLogoUrl };
      Cookies.set("empresa", JSON.stringify(updatedEmpresa), {
        expires: 7,
        secure: true,
        sameSite: "lax",
      });

      setTimeout(() => {
        window.location.reload();
      }, 1500);
    } catch (error: unknown) {
      const message =
        typeof error === "object" &&
        error !== null &&
        "response" in error &&
        typeof (error as { response?: { data?: { error?: string } } }).response
          ?.data?.error === "string"
          ? (error as { response?: { data?: { error?: string } } }).response
              ?.data?.error
          : "Error al subir el logo";
      showAlert("error", "No se pudo subir el logo", message || "Error al subir el logo");
    } finally {
      uploadingRef.current = false;
      setUploading(false);
    }
  };

  const applyLogoFileRef = useRef(applyLogoFile);
  applyLogoFileRef.current = applyLogoFile;

  const handleLogoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    await applyLogoFile(file);
  };

  useEffect(() => {
    if (!isDuenoOrAdmin || !empresa) return;

    const onPaste = (event: ClipboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }

      const file = getClipboardImageFile(event.clipboardData);
      if (!file) return;

      event.preventDefault();
      void applyLogoFileRef.current(file);
    };

    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [isDuenoOrAdmin, empresa]);


  return (
    <div className="max-w-xl mx-auto bg-white border border-slate-200 rounded-2xl p-6 shadow-2xs space-y-6">
      <div>
        <h1 className="text-xl font-black text-slate-900">Configuración</h1>
        <p className="text-sm text-slate-500">
          Administra los aspectos de personalización y marca de tu empresa
        </p>
      </div>

      {/* Tarjeta de Personalización de Logos */}
      <div className="border border-slate-100 rounded-xl p-5 space-y-4 bg-slate-50/50">
        <div className="space-y-1">
          <h2 className="text-sm font-bold text-slate-800">
            Logo de la Empresa
          </h2>
          <p className="text-xs text-slate-500">
            Este logo se utilizará en las esquinas superiores de tus constancias
            de visita en PDF. 
          </p>
        </div>

        {/* Preview */}
        <div className="flex items-center justify-center p-6 border border-slate-200 bg-white rounded-lg h-32 relative overflow-hidden">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logoUrl}
              alt="Logo Empresa"
              className="h-20 max-w-full object-contain"
            />
          ) : (
            <div className="text-center space-y-2">
              <Briefcase className="h-8 w-8 text-slate-300 mx-auto" />
              <span className="text-xs text-slate-400 font-medium">
                Sin Logo Registrado
              </span>
            </div>
          )}
        </div>

        {/* Acciones */}
        {isDuenoOrAdmin ? (
          <div className="flex flex-col gap-3">
            <label className="flex items-center justify-center gap-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-bold px-4 py-2.5 rounded-lg text-sm transition-all cursor-pointer">
              {uploading ? (
                <Loader className="h-4 w-4 animate-spin text-slate-400" />
              ) : (
                <Upload className="h-4 w-4 text-slate-500" />
              )}
              {uploading ? "Subiendo Logo..." : "Subir Nuevo Logo"}
              <input
                type="file"
                accept="image/*"
                onChange={handleLogoChange}
                disabled={uploading}
                className="hidden"
              />
            </label>

            {success && (
              <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-600 justify-center bg-emerald-50 border border-emerald-100 p-2 rounded-lg">
                <Check className="h-4 w-4" />
                Logo actualizado correctamente. Recargando...
              </div>
            )}
          </div>
        ) : (
          <div className="rounded-lg bg-amber-50 border border-amber-100 p-4 flex items-start gap-3">
            <ShieldAlert className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="text-xs text-amber-800 font-medium">
              Solo los usuarios con rol <strong>Dueño</strong> o{" "}
              <strong>Administrador</strong> tienen permisos para modificar el
              logo de la empresa.
            </div>
          </div>
        )}
      </div>

      {/* Información de Sesión */}
      <div className="border border-slate-100 rounded-xl p-5 space-y-3 bg-slate-50/50">
        <h2 className="text-sm font-bold text-slate-800">Detalles de Sesión</h2>
        <div className="text-xs space-y-1 text-slate-600 font-medium">
          <div>
            <strong className="text-slate-700">Usuario:</strong>{" "}
            {user?.username}
          </div>
          <div>
            <strong className="text-slate-700">Nombre completo:</strong>{" "}
            {user?.nombre_completo}
          </div>
          <div>
            <strong className="text-slate-700">Rol asignado:</strong>{" "}
            <span className="capitalize">{user?.rol.replace("_", " ")}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
