"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { useAdminEmpresas } from "@/hooks/useAdminEmpresas";
import type { EmpresaDetalle, PreventorActivo } from "@/hooks/useAdminEmpresas";
import { useAlert } from "@/context/AlertContext";
import { getClipboardImageFile } from "@/lib/signature";
import {
  Building2,
  Plus,
  Search,
  X,
  Edit2,
  Loader2,
  Building,
  UserPlus,
  Upload,
  Pause,
  Play,
  Trash2,
  AlertTriangle,
  KeyRound,
  Eye,
  EyeOff,
  Copy,
} from "lucide-react";
import type { EstadoEmpresa } from "@/types";

export default function AdminEmpresasPage() {
  const { showAlert, showConfirm } = useAlert();

  // Custom hook containing all TanStack React Query states and mutations
  const {
    empresas,
    preventores,
    isLoading,
    crearEmpresa,
    editarEmpresa,
    cambiarEstadoEmpresa,
    crearDuenoEmpresa,
    resetPasswordUsuario,
    subirLogoEmpresa,
    subirLogoConsultora,
    asignarPreventor,
    desasignarPreventor,
    buscarCuit,
    isSaving,
    isChangingEstado,
    isSavingDueno,
    isLookingUpCuit,
  } = useAdminEmpresas();

  // Search filter
  const [searchTerm, setSearchTerm] = useState("");

  // Selected company for the detail column (right)
  const [selectedEmpresaId, setSelectedEmpresaId] = useState<string | null>(
    null,
  );

  // Modal control
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [isCuitModalOpen, setIsCuitModalOpen] = useState(false);
  const [isDuenoModalOpen, setIsDuenoModalOpen] = useState(false);
  const [duenoModalMode, setDuenoModalMode] = useState<"create" | "password">(
    "create",
  );
  const [duenoTargetId, setDuenoTargetId] = useState<string | null>(null);
  const [duenoNombre, setDuenoNombre] = useState("");
  const [duenoUsername, setDuenoUsername] = useState("");
  const [duenoPassword, setDuenoPassword] = useState("");
  const [showDuenoPassword, setShowDuenoPassword] = useState(false);
  const [preventorSearch, setPreventorSearch] = useState("");

  // CUIT lookup input
  const [cuitLookup, setCuitLookup] = useState("");

  // Form fields
  const [editingEmpresa, setEditingEmpresa] = useState<EmpresaDetalle | null>(
    null,
  );
  const [cuit, setCuit] = useState("");
  const [razonSocial, setRazonSocial] = useState("");
  const [actividad, setActividad] = useState("");
  const [domicilio, setDomicilio] = useState("");
  const [localidad, setLocalidad] = useState("");
  const [codigoPostal, setCodigoPostal] = useState("");
  const [telefono, setTelefono] = useState("");
  const [contacto, setContacto] = useState("");

  // Upload file refs
  const fileEmpresaRef = useRef<HTMLInputElement>(null);
  const fileConsultoraRef = useRef<HTMLInputElement>(null);
  const logoEmpresaBoxRef = useRef<HTMLDivElement>(null);

  // Filtered list of companies
  const filteredEmpresas = empresas.filter(
    (emp) =>
      emp.razon_social?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      emp.cuit?.includes(searchTerm),
  );

  const selectedEmpresa =
    filteredEmpresas.find((emp) => emp.id === selectedEmpresaId) ||
    filteredEmpresas[0] ||
    null;

  // Helper: get initials for user initials badge
  const getInitials = (name: string) => {
    if (!name) return "??";
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  // Helper: CUIT formatting for visualization
  const formatCuit = (val: string) => {
    const raw = val.replace(/\D/g, "");
    if (raw.length === 11) {
      return `${raw.substring(0, 2)}-${raw.substring(2, 10)}-${raw.substring(10)}`;
    }
    return val;
  };

  // Open creation modal
  const openCreateModal = () => {
    setEditingEmpresa(null);
    setCuit("");
    setRazonSocial("");
    setActividad("");
    setDomicilio("");
    setLocalidad("");
    setCodigoPostal("");
    setTelefono("");
    setContacto("");
    setIsModalOpen(true);
  };

  // Open edit modal
  const getErrorMessage = (error: unknown, fallback: string) => {
    if (typeof error === "object" && error !== null && "response" in error) {
      const response = error as {
        response?: { data?: { error?: string } };
      };

      return response.response?.data?.error || fallback;
    }

    return fallback;
  };

  const estadoEmpresaLabel = (estado?: EstadoEmpresa | string | null) => {
    switch (estado) {
      case "aviso_deuda":
        return "Aviso de deuda";
      case "pausada":
        return "Pausada";
      case "eliminada":
        return "Eliminada";
      default:
        return "Activa";
    }
  };

  const estadoEmpresaBadgeClass = (estado?: EstadoEmpresa | string | null) => {
    switch (estado) {
      case "aviso_deuda":
        return "bg-amber-50 text-amber-700 border-amber-200";
      case "pausada":
        return "bg-orange-50 text-orange-700 border-orange-200";
      case "eliminada":
        return "bg-rose-50 text-rose-700 border-rose-200";
      default:
        return "bg-emerald-50 text-emerald-700 border-emerald-200";
    }
  };

  const handleCambiarEstado = async (
    emp: EmpresaDetalle,
    estado: EstadoEmpresa,
  ) => {
    const titles: Record<EstadoEmpresa, string> = {
      activa: "¿Reactivar empresa?",
      aviso_deuda: "¿Marcar aviso de deuda?",
      pausada: "¿Pausar empresa?",
      eliminada: "¿Eliminar empresa?",
    };

    const messages: Record<EstadoEmpresa, string> = {
      activa: `Vas a reactivar "${emp.razon_social}". Volverá a operar con normalidad.`,
      aviso_deuda: `Los usuarios de "${emp.razon_social}" podrán ingresar, pero verán un aviso de deuda en el portal.`,
      pausada: `"${emp.razon_social}" no podrá iniciar sesión (útil por falta de pago).`,
      eliminada: `"${emp.razon_social}" quedará dada de baja. Podés restaurarla después.`,
    };

    const confirmLabels: Record<EstadoEmpresa, string> = {
      activa: "Reactivar",
      aviso_deuda: "Marcar aviso",
      pausada: "Pausar",
      eliminada: "Eliminar",
    };

    const confirmTypes: Record<EstadoEmpresa, "success" | "warning" | "error"> =
      {
        activa: "success",
        aviso_deuda: "warning",
        pausada: "warning",
        eliminada: "error",
      };

    const ok = await showConfirm(titles[estado], messages[estado], {
      type: confirmTypes[estado],
      confirmLabel: confirmLabels[estado],
      cancelLabel: "Cancelar",
    });
    if (!ok) return;

    try {
      await cambiarEstadoEmpresa({ id: emp.id, estado });
      setSelectedEmpresaId(emp.id);
      showAlert(
        "success",
        "Estado actualizado",
        `La empresa quedó como: ${estadoEmpresaLabel(estado)}.`,
      );
    } catch (error: unknown) {
      showAlert(
        "error",
        "No se pudo cambiar el estado",
        getErrorMessage(error, "Ocurrió un error al actualizar la empresa."),
      );
    }
  };

  const openEditModal = (emp: EmpresaDetalle) => {
    setEditingEmpresa(emp);
    setCuit(emp.cuit);
    setRazonSocial(emp.razon_social);
    setActividad(emp.actividad || "");
    setDomicilio(emp.domicilio || "");
    setLocalidad(emp.localidad || "");
    setCodigoPostal(emp.codigo_postal || "");
    setTelefono(emp.telefono || "");
    setContacto(emp.contacto || "");
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingEmpresa(null);
  };

  // Submit create/edit company form
  const handleSaveEmpresa = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      cuit,
      razon_social: razonSocial,
      actividad,
      domicilio,
      localidad,
      codigo_postal: codigoPostal,
      telefono,
      contacto,
    };

    try {
      if (editingEmpresa) {
        const updated = await editarEmpresa({
          id: editingEmpresa.id,
          data: payload,
        });
        setSelectedEmpresaId(updated.id);
        showAlert(
          "success",
          "Empresa actualizada",
          "La empresa se ha actualizado con éxito.",
        );
      } else {
        const created = await crearEmpresa(payload);
        setSelectedEmpresaId(created.id);
        showAlert(
          "success",
          "Empresa registrada",
          "La empresa se ha registrado con éxito.",
        );
      }
      closeModal();
    } catch (error: unknown) {
      showAlert(
        "error",
        "Error al guardar",
        getErrorMessage(error, "No se pudo guardar la empresa."),
      );
    }
  };

  // AFIP CUIT Simulation Lookup and Auto-fill (Alta por CUIT)
  const handleAltaCuit = async () => {
    const rawCuit = cuitLookup.replace(/\D/g, "");
    if (rawCuit.length !== 11) {
      showAlert(
        "error",
        "CUIT Inválido",
        "El CUIT debe tener exactamente 11 dígitos.",
      );
      return;
    }

    try {
      const data = await buscarCuit(rawCuit);

      setEditingEmpresa(null);
      setCuit(data.cuit || rawCuit);
      setRazonSocial(data.razon_social || "");
      setActividad(data.actividad || "");
      setDomicilio(data.domicilio || "");
      setLocalidad(data.localidad || "");
      setCodigoPostal(data.codigo_postal || "");
      setTelefono(data.telefono || "");
      setContacto(data.contacto || "");

      setIsCuitModalOpen(false);
      setCuitLookup("");
      setIsModalOpen(true);

      showAlert(
        "success",
        "CUIT verificado",
        "Los datos se obtuvieron desde el padrón tributario.",
      );
    } catch (error: unknown) {
      showAlert(
        "error",
        "No se pudo consultar el CUIT",
        getErrorMessage(
          error,
          "No se pudieron recuperar los datos fiscales. Verificá el número o cargalo manualmente.",
        ),
      );
    }
  };

  const uploadLogoEmpresaFile = useCallback(
    async (file: File) => {
      if (!selectedEmpresa) return;

      const formData = new FormData();
      formData.append("logo", file);

      try {
        await subirLogoEmpresa({ id: selectedEmpresa.id, formData });
        setSelectedEmpresaId(selectedEmpresa.id);
        showAlert(
          "success",
          "Logo cargado",
          "El logotipo de la empresa se ha actualizado.",
        );
      } catch (error: unknown) {
        showAlert(
          "error",
          "Error de carga",
          getErrorMessage(error, "No se pudo subir el logo."),
        );
      }
    },
    [selectedEmpresa, showAlert, subirLogoEmpresa],
  );

  // Upload company logo handler (archivo o recorte pegado)
  const handleUploadLogoEmpresa = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    await uploadLogoEmpresaFile(file);
  };

  // Pegar recorte (Ctrl+V / Cmd+V) → logo empresa
  useEffect(() => {
    if (!selectedEmpresa) return;

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
      void uploadLogoEmpresaFile(file);
    };

    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [selectedEmpresa, uploadLogoEmpresaFile]);

  // Upload consultora logo handler
  const handleUploadLogoConsultora = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    if (!file || !selectedEmpresa?.consultora_id) return;

    const formData = new FormData();
    formData.append("logo", file);

    try {
      await subirLogoConsultora({
        id: selectedEmpresa.consultora_id,
        formData,
      });
      showAlert(
        "success",
        "Logo cargado",
        "El logotipo de la consultora se ha actualizado.",
      );
    } catch (error: unknown) {
      showAlert(
        "error",
        "Error de carga",
        getErrorMessage(error, "No se pudo subir el logo."),
      );
    }
  };

  // Assign preventor to company
  const handleAsignarPreventor = async (preventorId: string) => {
    if (!selectedEmpresa) return;
    try {
      await asignarPreventor({ preventorId, empresaId: selectedEmpresa.id });
      showAlert(
        "success",
        "Preventor asignado",
        "Asignación realizada con éxito.",
      );
    } catch (error: unknown) {
      showAlert(
        "error",
        "Error al asignar",
        getErrorMessage(error, "No se pudo asignar el preventor."),
      );
    }
  };

  // Unassign preventor from company
  const handleDesasignarPreventor = async (preventorId: string) => {
    if (!selectedEmpresa) return;
    try {
      await desasignarPreventor({ preventorId, empresaId: selectedEmpresa.id });
      showAlert(
        "success",
        "Preventor removido",
        "Asignación removida con éxito.",
      );
    } catch (error: unknown) {
      showAlert(
        "error",
        "Error al remover",
        getErrorMessage(error, "No se pudo remover el preventor."),
      );
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="flex justify-between items-center pb-4 border-b border-slate-200/60">
          <div className="h-10 bg-slate-200 rounded-lg w-1/4"></div>
          <div className="h-10 bg-slate-200 rounded-lg w-48"></div>
        </div>
        <div className="h-12 bg-slate-200 rounded-2xl w-full"></div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 h-125 bg-slate-200 rounded-2xl"></div>
          <div className="h-125 bg-slate-200 rounded-2xl"></div>
        </div>
      </div>
    );
  }

  // Active Assigned Preventores List for Selected Empresa
  const assignedList = selectedEmpresa?.preventor_empresas || [];
  const duenosEmpresa = (selectedEmpresa?.perfiles || []).filter(
    (p) => p.rol === "dueno",
  );
  const preventoresFiltrados = preventores.filter((prev) => {
    if (prev.rol !== "preventor" || prev.activo === false) return false;
    const searchable =
      `${prev.nombre_completo || ""} ${prev.username || ""}`.toLowerCase();
    return searchable.includes(preventorSearch.toLowerCase());
  });

  const openCreateDuenoModal = () => {
    setDuenoModalMode("create");
    setDuenoTargetId(null);
    setDuenoNombre(selectedEmpresa?.contacto || "");
    setDuenoUsername("");
    setDuenoPassword("");
    setShowDuenoPassword(false);
    setIsDuenoModalOpen(true);
  };

  const openResetDuenoPassword = (duenoId: string, username: string) => {
    setDuenoModalMode("password");
    setDuenoTargetId(duenoId);
    setDuenoUsername(username);
    setDuenoPassword("");
    setShowDuenoPassword(false);
    setIsDuenoModalOpen(true);
  };

  const closeDuenoModal = () => {
    setIsDuenoModalOpen(false);
    setDuenoTargetId(null);
    setDuenoNombre("");
    setDuenoUsername("");
    setDuenoPassword("");
    setShowDuenoPassword(false);
  };

  const handleSaveDuenoAcceso = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEmpresa) return;

    if (duenoPassword.trim().length < 6) {
      showAlert(
        "warning",
        "Contraseña corta",
        "La contraseña debe tener al menos 6 caracteres.",
      );
      return;
    }

    try {
      if (duenoModalMode === "create") {
        if (!duenoNombre.trim() || !duenoUsername.trim()) {
          showAlert(
            "warning",
            "Datos incompletos",
            "Completá nombre completo y usuario.",
          );
          return;
        }
        await crearDuenoEmpresa({
          empresa_id: selectedEmpresa.id,
          nombre_completo: duenoNombre.trim(),
          username: duenoUsername.trim(),
          password: duenoPassword,
        });
        showAlert(
          "success",
          "Acceso creado",
          `El dueño ya puede ingresar al portal con CUIT ${formatCuit(selectedEmpresa.cuit)}, usuario "${duenoUsername.trim()}" y la contraseña definida.`,
        );
      } else if (duenoTargetId) {
        await resetPasswordUsuario({
          id: duenoTargetId,
          password: duenoPassword,
        });
        showAlert(
          "success",
          "Contraseña actualizada",
          `Se actualizó la contraseña de @${duenoUsername}.`,
        );
      }
      closeDuenoModal();
    } catch (error: unknown) {
      showAlert(
        "error",
        "No se pudo guardar el acceso",
        getErrorMessage(error, "Revisá los datos e intentá de nuevo."),
      );
    }
  };

  const copyPortalHint = async () => {
    if (!selectedEmpresa) return;
    const dueno = duenosEmpresa[0];
    const text = [
      `Portal Legajo Técnico`,
      `CUIT: ${formatCuit(selectedEmpresa.cuit)}`,
      `Usuario: ${dueno?.username || "(definir)"}`,
      `Contraseña: (la que configuraste)`,
      `URL: /login`,
    ].join("\n");
    try {
      await navigator.clipboard.writeText(text);
      showAlert(
        "success",
        "Copiado",
        "Datos de acceso copiados al portapapeles.",
      );
    } catch {
      showAlert(
        "error",
        "No se pudo copiar",
        "Copiá manualmente CUIT + usuario para enviárselos al cliente.",
      );
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Encabezado */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-200/60">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight font-sans">
            Gestión de Empresas
          </h1>
          <p className="text-xs font-bold text-slate-450 mt-0.5 font-sans">
            Clientes del preventor · alta por CUIT
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex flex-col gap-3 w-full lg:w-auto sm:flex-row sm:flex-wrap sm:items-center">
          {/* Search Input */}
          <div className="relative w-full sm:w-auto">
            <Search className="absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-3 sm:w-48 border border-slate-200 rounded-xl text-xs font-semibold bg-white focus:outline-hidden focus:border-brand-secondary transition-all"
            />
          </div>

          {/* Nueva Empresa Button */}
          <button
            onClick={openCreateModal}
            className="inline-flex w-full items-center justify-center gap-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold px-4 py-3 rounded-xl text-xs transition-all shadow-2xs cursor-pointer select-none sm:w-auto"
          >
            <Plus className="h-4 w-4 text-slate-500" />
            Nueva empresa
          </button>

          {/* Alta por CUIT Button */}
          <button
            onClick={() => setIsCuitModalOpen(true)}
            className="inline-flex w-full items-center justify-center gap-1.5 bg-slate-900 hover:bg-slate-850 text-white font-bold px-4 py-3 rounded-xl text-xs transition-all shadow-md shadow-slate-900/10 cursor-pointer select-none sm:w-auto"
          >
            <Building2 className="h-4 w-4 text-slate-300" />
            Alta por CUIT
          </button>
        </div>
      </div>

      {/* 2. Info Banner */}
      <div className="bg-blue-50/40 border border-blue-100/50 rounded-2xl p-4 flex items-start gap-3.5 text-xs text-slate-600 font-semibold leading-relaxed">
        <div className="h-7 w-7 rounded-xl bg-blue-100 flex items-center justify-center shrink-0 text-blue-650">
          <Building className="h-4 w-4" />
        </div>
        <span className="mt-0.5">
          Alta recomendada en 3 pasos: 1) crear la empresa, 2) asignar
          preventor(es), 3) crear el acceso del dueño (usuario + contraseña) para
          que entre al portal con el CUIT.
        </span>
      </div>

      {/* 3. Main Grid layout */}
      <div className="grid grid-cols-1 gap-6 items-start xl:grid-cols-3">
        {/* Left Column: Table of Companies */}
        <div className="xl:col-span-2 bg-white border border-slate-200 rounded-2xl shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-190 divide-y divide-slate-100 text-left text-xs xl:min-w-full">
              <thead className="bg-slate-50/70">
                <tr>
                  <th className="px-6 py-4 text-[9px] font-black text-slate-400 uppercase tracking-wider">
                    Empresa
                  </th>
                  <th className="px-6 py-4 text-[9px] font-black text-slate-400 uppercase tracking-wider w-36">
                    CUIT
                  </th>
                  <th className="px-6 py-4 text-[9px] font-black text-slate-400 uppercase tracking-wider w-28 text-center">
                    Estado
                  </th>
                  <th className="px-6 py-4 text-[9px] font-black text-slate-400 uppercase tracking-wider w-20 text-center">
                    Cumplimiento
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {filteredEmpresas.map((emp) => {
                  const compliance = Math.round(
                    Number(emp.porcentaje_cumplimiento || 100),
                  );
                  const isSelected = selectedEmpresa?.id === emp.id;
                  const estado = (emp.estado || "activa") as EstadoEmpresa;

                  let badgeColor = "text-emerald-600";
                  if (compliance < 70) badgeColor = "text-rose-500";
                  else if (compliance < 80) badgeColor = "text-amber-500";

                  return (
                    <tr
                      key={emp.id}
                      onClick={() => setSelectedEmpresaId(emp.id)}
                      className={`cursor-pointer transition-all select-none ${
                        isSelected
                          ? "bg-blue-50/40 hover:bg-blue-50/50"
                          : "hover:bg-slate-50/30"
                      } ${estado === "eliminada" ? "opacity-60" : ""}`}
                    >
                      <td className="px-6 py-4 flex items-center gap-3">
                        {emp.logo_url ? (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img
                            src={emp.logo_url}
                            alt="Logo"
                            className="h-8 w-8 rounded-lg object-contain border border-slate-200 p-0.5 bg-white shrink-0"
                          />
                        ) : (
                          <div className="h-8 w-8 rounded-lg  border border-slate-200 flex items-center justify-center shrink-0">
                            <Building className="h-4 w-4 text-slate-900" />
                          </div>
                        )}
                        <div className="min-w-0">
                          <span className="block text-xs font-black text-slate-900 truncate">
                            {emp.razon_social}
                          </span>
                          <span className="block text-[10px] font-bold text-slate-400 truncate mt-0.5">
                            {emp.actividad || "General"}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-slate-500 font-bold">
                        {formatCuit(emp.cuit)}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span
                          className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[9px] font-black uppercase tracking-wider ${estadoEmpresaBadgeClass(estado)}`}
                        >
                          {estadoEmpresaLabel(estado)}
                        </span>
                      </td>
                      <td
                        className={`px-6 py-4 text-center font-black text-sm ${badgeColor}`}
                      >
                        {compliance}%
                      </td>
                    </tr>
                  );
                })}

                {filteredEmpresas.length === 0 && (
                  <tr>
                    <td
                      colSpan={4}
                      className="p-12 text-center text-xs font-bold text-slate-400"
                    >
                      No se encontraron empresas cargadas.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right Column: Detail Card */}
        {selectedEmpresa ? (
          <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 shadow-2xs space-y-6">
            {/* Header info */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
              <div className="flex items-center gap-3.5 min-w-0">
                {selectedEmpresa.logo_url ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={selectedEmpresa.logo_url}
                    alt="Logo"
                    className="h-12 w-12 rounded-xl object-contain border border-slate-200 p-1 bg-white"
                  />
                ) : (
                  <div className="h-12 w-12 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-650">
                    <Building className="h-6 w-6" />
                  </div>
                )}
                <div>
                  <h3 className="text-sm font-black text-slate-900 leading-tight">
                    {selectedEmpresa.razon_social}
                  </h3>
                  <span className="text-[10px] font-bold text-slate-400 block mt-0.5">
                    CUIT {formatCuit(selectedEmpresa.cuit)}
                  </span>
                </div>
              </div>

              {/* Edit button */}
              <button
                onClick={() => openEditModal(selectedEmpresa)}
                className="h-10 w-10 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-500 cursor-pointer transition-colors shrink-0 self-start sm:self-auto"
                title="Editar empresa"
              >
                <Edit2 className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* Estado operativo CRM */}
            <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-3.5 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
                  Estado CRM
                </span>
                <span
                  className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[9px] font-black uppercase tracking-wider ${estadoEmpresaBadgeClass(selectedEmpresa.estado)}`}
                >
                  {estadoEmpresaLabel(selectedEmpresa.estado)}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 font-medium leading-relaxed">
                {selectedEmpresa.estado === "aviso_deuda"
                  ? "Pueden ingresar al portal, pero verán un mensaje de aviso de deuda."
                  : selectedEmpresa.estado === "pausada"
                    ? "No pueden iniciar sesión (útil por falta de pago)."
                    : selectedEmpresa.estado === "eliminada"
                      ? "Baja lógica: oculta del uso operativo. Podés restaurarla."
                      : "Empresa operativa sin restricciones."}
              </p>
              <div className="flex flex-wrap gap-2">
                {selectedEmpresa.estado !== "activa" && (
                  <button
                    type="button"
                    disabled={isChangingEstado}
                    onClick={() =>
                      void handleCambiarEstado(selectedEmpresa, "activa")
                    }
                    className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-[10px] font-black uppercase tracking-wider text-emerald-700 hover:bg-emerald-100 disabled:opacity-50 cursor-pointer"
                  >
                    <Play className="h-3 w-3" />
                    Activar
                  </button>
                )}
                {selectedEmpresa.estado !== "aviso_deuda" &&
                  selectedEmpresa.estado !== "eliminada" && (
                    <button
                      type="button"
                      disabled={isChangingEstado}
                      onClick={() =>
                        void handleCambiarEstado(selectedEmpresa, "aviso_deuda")
                      }
                      className="inline-flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-[10px] font-black uppercase tracking-wider text-amber-700 hover:bg-amber-100 disabled:opacity-50 cursor-pointer"
                    >
                      <AlertTriangle className="h-3 w-3" />
                      Aviso deuda
                    </button>
                  )}
                {selectedEmpresa.estado !== "pausada" &&
                  selectedEmpresa.estado !== "eliminada" && (
                    <button
                      type="button"
                      disabled={isChangingEstado}
                      onClick={() =>
                        void handleCambiarEstado(selectedEmpresa, "pausada")
                      }
                      className="inline-flex items-center gap-1.5 rounded-lg border border-orange-200 bg-orange-50 px-2.5 py-1.5 text-[10px] font-black uppercase tracking-wider text-orange-700 hover:bg-orange-100 disabled:opacity-50 cursor-pointer"
                    >
                      <Pause className="h-3 w-3" />
                      Pausar
                    </button>
                  )}
                {selectedEmpresa.estado !== "eliminada" && (
                  <button
                    type="button"
                    disabled={isChangingEstado}
                    onClick={() =>
                      void handleCambiarEstado(selectedEmpresa, "eliminada")
                    }
                    className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-[10px] font-black uppercase tracking-wider text-rose-700 hover:bg-rose-100 disabled:opacity-50 cursor-pointer"
                  >
                    <Trash2 className="h-3 w-3" />
                    Eliminar
                  </button>
                )}
              </div>
            </div>

            {/* Info Grid */}
            <div className="space-y-3.5 border-t border-b border-slate-100 py-5 text-xs">
              <div className="flex flex-col gap-1.5 sm:flex-row sm:justify-between sm:items-center sm:gap-4">
                <span className="font-bold text-slate-400">Actividad</span>
                <span className="font-black text-slate-800 text-left sm:text-right">
                  {selectedEmpresa.actividad || "General"}
                </span>
              </div>
              <div className="flex flex-col gap-1.5 sm:flex-row sm:justify-between sm:items-center sm:gap-4">
                <span className="font-bold text-slate-400">Domicilio</span>
                <span className="font-black text-slate-800 text-left sm:text-right">
                  {selectedEmpresa.domicilio || "N/A"}
                </span>
              </div>
              <div className="flex flex-col gap-1.5 sm:flex-row sm:justify-between sm:items-center sm:gap-4">
                <span className="font-bold text-slate-400">Localidad</span>
                <span className="font-black text-slate-800 text-left sm:text-right">
                  {selectedEmpresa.localidad || "N/A"}
                </span>
              </div>
              <div className="flex flex-col gap-1.5 sm:flex-row sm:justify-between sm:items-center sm:gap-4">
                <span className="font-bold text-slate-400">Código Postal</span>
                <span className="font-black text-slate-800 text-left sm:text-right">
                  {selectedEmpresa.codigo_postal || "N/A"}
                </span>
              </div>
              <div className="flex flex-col gap-1.5 sm:flex-row sm:justify-between sm:items-center sm:gap-4">
                <span className="font-bold text-slate-400">Teléfono</span>
                <span className="font-black text-slate-800 text-left sm:text-right">
                  {selectedEmpresa.telefono || "N/A"}
                </span>
              </div>
              <div className="flex flex-col gap-1.5 sm:flex-row sm:justify-between sm:items-center sm:gap-4">
                <span className="font-bold text-slate-400">Contacto</span>
                <span className="font-black text-slate-800 text-left sm:text-right">
                  {selectedEmpresa.contacto || "N/A"}
                </span>
              </div>
              <div className="flex flex-col gap-1.5 sm:flex-row sm:justify-between sm:items-center sm:gap-4">
                <span className="font-bold text-slate-400">Cumplimiento</span>
                <span className="font-black text-emerald-600 text-left sm:text-right">
                  {Math.round(
                    Number(selectedEmpresa.porcentaje_cumplimiento || 100),
                  )}
                  % ·{" "}
                  {Math.round(
                    Number(selectedEmpresa.porcentaje_cumplimiento || 100),
                  ) >= 80
                    ? "Empresa Segura"
                    : "Necesita mejoras"}
                </span>
              </div>
            </div>

            {/* LOGOS DEL ENCABEZADO */}
            <div className="space-y-3">
              <span className="block text-[10px] font-black text-slate-400 uppercase tracking-wider">
                Logos del Encabezado
              </span>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {/* Logo Consultora Upload Box */}
                <div
                  onClick={() => fileConsultoraRef.current?.click()}
                  className="border border-slate-200 hover:border-slate-300 rounded-xl p-3 bg-slate-50/50 hover:bg-slate-50 flex flex-col items-center justify-center gap-1.5 cursor-pointer text-center group transition-all h-24"
                >
                  <input
                    type="file"
                    ref={fileConsultoraRef}
                    onChange={handleUploadLogoConsultora}
                    accept="image/*"
                    className="hidden"
                  />
                  {selectedEmpresa.consultoras?.logo_url ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={selectedEmpresa.consultoras.logo_url}
                      alt="Logo Consultora"
                      className="h-10 max-w-full object-contain p-0.5"
                    />
                  ) : (
                    <Upload className="h-4.5 w-4.5 text-slate-400 group-hover:text-blue-600 transition-colors" />
                  )}
                  <span className="text-[9px] font-black text-slate-500 uppercase tracking-wider block">
                    Logo Consultora
                  </span>
                </div>

                {/* Logo Empresa Upload Box */}
                <div
                  ref={logoEmpresaBoxRef}
                  role="button"
                  tabIndex={0}
                  onClick={() => fileEmpresaRef.current?.click()}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      fileEmpresaRef.current?.click();
                    }
                  }}
                  onPaste={(e) => {
                    const file = getClipboardImageFile(e.clipboardData);
                    if (!file) return;
                    e.preventDefault();
                    e.stopPropagation();
                    void uploadLogoEmpresaFile(file);
                  }}
                  className="border border-slate-200 hover:border-slate-300 focus:border-blue-400 focus:ring-2 focus:ring-blue-500/15 rounded-xl p-3 bg-slate-50/50 hover:bg-slate-50 flex flex-col items-center justify-center gap-1 cursor-pointer text-center group transition-all h-24 outline-none"
                >
                  <input
                    type="file"
                    ref={fileEmpresaRef}
                    onChange={handleUploadLogoEmpresa}
                    accept="image/*"
                    className="hidden"
                  />
                  {selectedEmpresa.logo_url ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={selectedEmpresa.logo_url}
                      alt="Logo Empresa"
                      className="h-9 max-w-full object-contain p-0.5"
                    />
                  ) : (
                    <Upload className="h-4.5 w-4.5 text-slate-400 group-hover:text-blue-600 transition-colors" />
                  )}
                  <span className="text-[9px] font-black text-slate-500 uppercase tracking-wider block">
                    Logo Empresa
                  </span>
                  <span className="text-[8px] font-semibold text-slate-400 normal-case tracking-normal">
                    Clic o pegá un recorte (Ctrl+V)
                  </span>
                </div>
              </div>
            </div>

            {/* ACCESO DUEÑO / PORTAL */}
            <div className="space-y-4 pt-4 border-t border-slate-100">
              <div className="flex justify-between items-center gap-2">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
                  Acceso al portal (Dueño)
                </span>
                {duenosEmpresa.length === 0 ? (
                  <button
                    type="button"
                    onClick={openCreateDuenoModal}
                    className="inline-flex items-center gap-1 text-[10px] font-black text-blue-650 hover:text-blue-800 transition-colors cursor-pointer uppercase tracking-wider"
                  >
                    <KeyRound className="h-3 w-3" />
                    Crear acceso
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => void copyPortalHint()}
                    className="inline-flex items-center gap-1 text-[10px] font-black text-slate-500 hover:text-slate-800 transition-colors cursor-pointer uppercase tracking-wider"
                  >
                    <Copy className="h-3 w-3" />
                    Copiar datos
                  </button>
                )}
              </div>

              {duenosEmpresa.length > 0 ? (
                <div className="space-y-2">
                  {duenosEmpresa.map((dueno) => (
                    <div
                      key={dueno.id}
                      className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between p-3 border border-emerald-100 rounded-xl bg-emerald-50/40"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="h-7 w-7 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-[10px] font-black shrink-0 border border-emerald-200">
                          {getInitials(dueno.nombre_completo || "")}
                        </div>
                        <div className="min-w-0">
                          <span className="block text-xs font-black text-slate-800 truncate">
                            {dueno.nombre_completo || "Sin nombre"}
                          </span>
                          <span className="block text-[10px] font-bold text-slate-500 truncate">
                            @{dueno.username} · login con CUIT{" "}
                            {formatCuit(selectedEmpresa.cuit)}
                          </span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          openResetDuenoPassword(
                            dueno.id,
                            dueno.username || "",
                          )
                        }
                        className="inline-flex items-center justify-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[10px] font-black uppercase tracking-wider text-slate-600 hover:bg-slate-50 cursor-pointer"
                      >
                        <KeyRound className="h-3 w-3" />
                        Contraseña
                      </button>
                    </div>
                  ))}
                  <p className="text-[10px] text-slate-500 font-semibold leading-relaxed">
                    El cliente entra en <strong>/login</strong> con CUIT +
                    usuario + contraseña.
                  </p>
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-amber-200 bg-amber-50/50 p-3 space-y-2">
                  <p className="text-xs text-amber-900 font-bold leading-relaxed">
                    Todavía no hay dueño con acceso al portal para esta
                    empresa.
                  </p>
                  <button
                    type="button"
                    onClick={openCreateDuenoModal}
                    className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-slate-900 px-3 py-2.5 text-[11px] font-black uppercase tracking-wider text-white hover:bg-slate-800 cursor-pointer"
                  >
                    <UserPlus className="h-3.5 w-3.5" />
                    Crear dueño y contraseña
                  </button>
                </div>
              )}
            </div>

            {/* PREVENTORES ASIGNADOS */}
            <div className="space-y-4 pt-4 border-t border-slate-100">
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
                  Preventores Asignados
                </span>

                <button
                  onClick={() => setIsAssignModalOpen(true)}
                  className="inline-flex items-center gap-1 text-[10px] font-black text-blue-650 hover:text-blue-800 transition-colors cursor-pointer uppercase tracking-wider"
                >
                  <UserPlus className="h-3 w-3" />
                  Asignar
                </button>
              </div>

              {/* Preventores List */}
              <div className="space-y-2">
                {assignedList.length > 0 ? (
                  assignedList.map((asg) => (
                    <div
                      key={asg.preventor_id}
                      className="flex items-center justify-between p-3 border border-slate-100 rounded-xl bg-slate-50/30"
                    >
                      <div className="flex items-center gap-3">
                        <div className="h-7 w-7 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-[10px] font-black shrink-0 border border-blue-200">
                          {getInitials(asg.perfiles?.nombre_completo || "")}
                        </div>
                        <span className="text-xs font-black text-slate-800">
                          {asg.perfiles?.nombre_completo}
                        </span>
                      </div>

                      <button
                        onClick={() =>
                          handleDesasignarPreventor(asg.preventor_id)
                        }
                        className="text-[10px] font-black text-red-500 hover:text-red-700 cursor-pointer uppercase tracking-wider transition-colors"
                      >
                        Quitar
                      </button>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-slate-450 italic font-semibold py-2">
                    Ninguno asignado. Asigna preventores para habilitar visitas.
                  </p>
                )}
              </div>

              {/* Data Reutilization Warning Banner */}
              <div className="bg-slate-50 border border-slate-100 rounded-xl p-3 text-[10px] text-slate-500 font-bold leading-normal">
                Estos datos (dirección, teléfono, CP y logo) se reutilizan
                automáticamente en informes, constancias y entrega de EPP.
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center text-xs font-bold text-slate-400 shadow-2xs">
            Selecciona una empresa para visualizar su ficha técnica.
          </div>
        )}
      </div>

      {/* 4. MODAL: Crear/Editar Empresa */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-xs animate-fade-in">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 max-w-lg w-full shadow-2xl space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-black text-slate-900 font-sans">
                {editingEmpresa
                  ? "Editar Empresa Client"
                  : "Nueva Empresa Client"}
              </h3>
              <button
                onClick={closeModal}
                className="h-7 w-7 rounded-lg bg-slate-50 hover:bg-red-50 hover:text-red-650 flex items-center justify-center text-slate-400 cursor-pointer transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form
              onSubmit={handleSaveEmpresa}
              className="space-y-4 text-xs font-semibold"
            >
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
                    CUIT (Sin guiones)
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 30712345678"
                    value={cuit}
                    onChange={(e) => setCuit(e.target.value.replace(/\D/g, ""))}
                    className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl focus:outline-hidden focus:border-blue-600 transition-colors"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
                    Razón Social
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Razón Social"
                    value={razonSocial}
                    onChange={(e) => setRazonSocial(e.target.value)}
                    className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl focus:outline-hidden focus:border-blue-600 transition-colors"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
                    Actividad / Rubro
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Metalurgia, Textil, Alimentos"
                    value={actividad}
                    onChange={(e) => setActividad(e.target.value)}
                    className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl focus:outline-hidden focus:border-blue-600 transition-colors"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
                    Contacto Principal
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Ing. Juan Gómez"
                    value={contacto}
                    onChange={(e) => setContacto(e.target.value)}
                    className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl focus:outline-hidden focus:border-blue-600 transition-colors"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="space-y-1 sm:col-span-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
                    Domicilio Legal
                  </label>
                  <input
                    type="text"
                    placeholder="Dirección completa"
                    value={domicilio}
                    onChange={(e) => setDomicilio(e.target.value)}
                    className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl focus:outline-hidden focus:border-blue-600 transition-colors"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
                    Código Postal
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. M5600"
                    value={codigoPostal}
                    onChange={(e) => setCodigoPostal(e.target.value)}
                    className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl focus:outline-hidden focus:border-blue-600 transition-colors"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
                    Localidad / Provincia
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. San Rafael, Mendoza"
                    value={localidad}
                    onChange={(e) => setLocalidad(e.target.value)}
                    className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl focus:outline-hidden focus:border-blue-600 transition-colors"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
                    Teléfono Comercial
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. +54 260 442-1180"
                    value={telefono}
                    onChange={(e) => setTelefono(e.target.value)}
                    className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl focus:outline-hidden focus:border-blue-600 transition-colors"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex flex-col-reverse gap-3.5 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={closeModal}
                  className="w-full px-4 py-3 border border-slate-200 hover:bg-slate-50 text-slate-600 font-bold rounded-xl text-xs transition-colors cursor-pointer sm:w-auto"
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  disabled={isSaving}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 py-3 text-xs font-bold text-white transition-colors shadow-md hover:bg-slate-850 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto cursor-pointer"
                >
                  {isSaving && <Loader2 className="h-4.5 w-4.5 animate-spin" />}
                  {editingEmpresa ? "Guardar Cambios" : "Registrar Empresa"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 5. MODAL: Alta por CUIT AFIP */}
      {isCuitModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-xs animate-fade-in">
          <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 max-w-md w-full shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-black text-slate-900 font-sans">
                Alta Rápida por CUIT
              </h3>
              <button
                onClick={() => setIsCuitModalOpen(false)}
                className="h-7 w-7 rounded-lg bg-slate-50 hover:bg-red-50 hover:text-red-650 flex items-center justify-center text-slate-400 cursor-pointer transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="text-xs font-semibold text-slate-500 leading-normal space-y-4">
              <p>
                Ingresa el número de CUIT comercial para realizar una consulta
                de padrón y pre-completar los datos fiscales legalmente.
              </p>

              <div className="space-y-1.5 text-slate-800">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">
                  Número de CUIT
                </label>
                <input
                  type="text"
                  placeholder="30712345678"
                  value={cuitLookup}
                  onChange={(e) =>
                    setCuitLookup(e.target.value.replace(/\D/g, ""))
                  }
                  className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl focus:outline-hidden focus:border-blue-600 transition-colors"
                />
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setIsCuitModalOpen(false)}
                className="w-full px-4 py-3 border border-slate-200 hover:bg-slate-50 text-slate-600 font-bold rounded-xl text-xs transition-colors cursor-pointer sm:w-auto"
              >
                Cancelar
              </button>

              <button
                type="button"
                onClick={handleAltaCuit}
                disabled={isLookingUpCuit}
                className="flex w-full items-center justify-center rounded-xl bg-slate-900 px-5 py-3 text-xs font-bold text-white transition-colors shadow-md hover:bg-slate-850 cursor-pointer sm:w-auto"
              >
                {isLookingUpCuit ? (
                  <span className="inline-flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Buscando...
                  </span>
                ) : (
                  "Buscar y Completar"
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6. MODAL: Asignar Preventores */}
      {isAssignModalOpen && selectedEmpresa && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-md animate-fade-in">
          <div className="w-full max-w-2xl overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_30px_80px_rgba(15,23,42,0.25)]">
            <div className="bg-linear-to-br from-slate-950 via-slate-900 to-slate-800 px-6 py-5 text-white">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-2">
                  <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.24em] text-slate-200">
                    Gestión operativa
                  </span>
                  <div>
                    <h3 className="text-xl font-black leading-tight tracking-tight">
                      Asignar preventores
                    </h3>
                    <p className="mt-1 max-w-xl text-sm text-slate-300">
                      Vinculá preventores activos a{" "}
                      {selectedEmpresa.razon_social} para habilitar visitas y
                      seguimiento.
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setIsAssignModalOpen(false)}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/10 text-slate-200 transition-colors hover:bg-white/20 hover:text-white"
                  aria-label="Cerrar modal"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="mt-5 grid grid-cols-1 gap-3 text-xs sm:grid-cols-2">
                <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                  <span className="block text-[10px] font-bold uppercase tracking-[0.22em] text-slate-400">
                    Asignados
                  </span>
                  <span className="mt-1 block text-lg font-black text-white">
                    {assignedList.length}
                  </span>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                  <span className="block text-[10px] font-bold uppercase tracking-[0.22em] text-slate-400">
                    Disponibles
                  </span>
                  <span className="mt-1 block text-lg font-black text-white">
                    {preventoresFiltrados.length}
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-slate-50 px-4 py-5 sm:px-6">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={preventorSearch}
                  onChange={(e) => setPreventorSearch(e.target.value)}
                  placeholder="Buscar por nombre o usuario"
                  className="w-full rounded-2xl border border-slate-200 bg-white py-3 pl-11 pr-4 text-sm font-medium text-slate-700 outline-none transition-colors placeholder:text-slate-400 focus:border-slate-400"
                />
              </div>
            </div>

            <div className="max-h-105 overflow-y-auto px-4 py-4 sm:px-6">
              <div className="grid gap-3">
                {preventoresFiltrados.length > 0 ? (
                  preventoresFiltrados.map((prev: PreventorActivo) => {
                    const isAssigned = selectedEmpresa.preventor_empresas?.some(
                      (asg) => asg.preventor_id === prev.id,
                    );

                    return (
                      <div
                        key={prev.id}
                        className="group flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-slate-900 text-[11px] font-black text-white shadow-sm">
                            {getInitials(
                              prev.nombre_completo || prev.username || "PR",
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="truncate text-sm font-black text-slate-900">
                                {prev.nombre_completo || "Sin nombre"}
                              </span>
                              {isAssigned && (
                                <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-700">
                                  Asignado
                                </span>
                              )}
                            </div>
                            <p className="mt-1 text-xs font-medium text-slate-500">
                              @{prev.username || "sin-usuario"}
                            </p>
                          </div>
                        </div>

                        {isAssigned ? (
                          <button
                            onClick={() => handleDesasignarPreventor(prev.id)}
                            className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-rose-200 bg-rose-50 px-4 py-2 text-[11px] font-black uppercase tracking-[0.18em] text-rose-700 transition-colors hover:bg-rose-100 sm:w-auto"
                          >
                            Quitar
                          </button>
                        ) : (
                          <button
                            onClick={() => handleAsignarPreventor(prev.id)}
                            className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-slate-900 bg-slate-900 px-4 py-2 text-[11px] font-black uppercase tracking-[0.18em] text-white transition-colors hover:bg-slate-800 sm:w-auto"
                          >
                            Asignar
                          </button>
                        )}
                      </div>
                    );
                  })
                ) : (
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-10 text-center">
                    <p className="text-sm font-bold text-slate-700">
                      No hay preventores que coincidan con la búsqueda.
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      Probá con otro nombre, usuario o limpiá el filtro.
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div className="flex flex-col gap-3 border-t border-slate-200 bg-white px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
              <p className="text-[11px] font-medium text-slate-500">
                Las asignaciones se aplican en tiempo real y habilitan el acceso
                operativo sobre la empresa.
              </p>
              <button
                type="button"
                onClick={() => setIsAssignModalOpen(false)}
                className="inline-flex w-full items-center justify-center rounded-full bg-slate-900 px-5 py-2.5 text-xs font-black uppercase tracking-[0.18em] text-white transition-colors hover:bg-slate-800 sm:w-auto"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 7. MODAL: Acceso dueño / contraseña */}
      {isDuenoModalOpen && selectedEmpresa && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-md animate-fade-in">
          <form
            onSubmit={(e) => void handleSaveDuenoAcceso(e)}
            className="w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
          >
            <div className="border-b border-slate-100 px-5 py-4 flex items-start justify-between gap-3">
              <div>
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                  Acceso al portal
                </span>
                <h3 className="mt-1 text-base font-black text-slate-900">
                  {duenoModalMode === "create"
                    ? "Crear dueño y contraseña"
                    : "Cambiar contraseña"}
                </h3>
                <p className="mt-1 text-xs text-slate-500 font-semibold leading-relaxed">
                  Empresa: {selectedEmpresa.razon_social}. Login con CUIT{" "}
                  {formatCuit(selectedEmpresa.cuit)} + usuario + contraseña.
                </p>
              </div>
              <button
                type="button"
                onClick={closeDuenoModal}
                className="h-8 w-8 rounded-full border border-slate-200 flex items-center justify-center text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4 px-5 py-5">
              {duenoModalMode === "create" && (
                <>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                      Nombre completo
                    </label>
                    <input
                      value={duenoNombre}
                      onChange={(e) => setDuenoNombre(e.target.value)}
                      required
                      placeholder="Responsable de la empresa"
                      className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-semibold text-slate-800 outline-none focus:border-slate-400"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                      Usuario
                    </label>
                    <input
                      value={duenoUsername}
                      onChange={(e) =>
                        setDuenoUsername(
                          e.target.value.replace(/\s+/g, "").toLowerCase(),
                        )
                      }
                      required
                      autoCapitalize="none"
                      autoCorrect="off"
                      spellCheck={false}
                      placeholder="ej. sandra.lapetina"
                      className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-semibold text-slate-800 outline-none focus:border-slate-400"
                    />
                  </div>
                </>
              )}

              {duenoModalMode === "password" && (
                <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5 text-xs font-bold text-slate-600">
                  Usuario: @{duenoUsername}
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                  {duenoModalMode === "create"
                    ? "Contraseña inicial"
                    : "Nueva contraseña"}
                </label>
                <div className="relative">
                  <input
                    type={showDuenoPassword ? "text" : "password"}
                    value={duenoPassword}
                    onChange={(e) => setDuenoPassword(e.target.value)}
                    required
                    minLength={6}
                    placeholder="Mínimo 6 caracteres"
                    className="w-full rounded-xl border border-slate-200 px-3 py-2.5 pr-10 text-sm font-semibold text-slate-800 outline-none focus:border-slate-400"
                  />
                  <button
                    type="button"
                    onClick={() => setShowDuenoPassword((v) => !v)}
                    className="absolute inset-y-0 right-0 px-3 text-slate-400 hover:text-slate-700 cursor-pointer"
                  >
                    {showDuenoPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>
            </div>

            <div className="flex gap-2 border-t border-slate-100 px-5 py-4">
              <button
                type="button"
                onClick={closeDuenoModal}
                className="flex-1 rounded-xl border border-slate-200 py-2.5 text-xs font-black text-slate-600 hover:bg-slate-50 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isSavingDueno}
                className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-slate-900 py-2.5 text-xs font-black text-white hover:bg-slate-800 disabled:opacity-50 cursor-pointer"
              >
                {isSavingDueno ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Guardando…
                  </>
                ) : duenoModalMode === "create" ? (
                  "Crear acceso"
                ) : (
                  "Guardar contraseña"
                )}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
