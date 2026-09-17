"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { EppTipo, EppProveedor } from "@/types";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  Plus,
  Download,
  Package,
  FileText,
  Layers,
  Users,
  QrCode,
} from "lucide-react";
import { useEpp } from "@/hooks/useEpp";
import { useAlert } from "@/context/AlertContext";
import { actualizarVisibilidadEppEntrega } from "@/lib/visibilidadEnte";
import { CatalogoTab } from "./_components/CatalogoTab";
import { PersonalTab } from "./_components/PersonalTab";
import { GeneracionQrTab } from "./_components/GeneracionQrTab";
import { LicitacionesTab } from "./_components/LicitacionesTab";
import { EntregasTab } from "./_components/EntregasTab";
import { canWriteAppModule } from "@/lib/moduleAccess";

type Tab = "entregas" | "personal" | "qr" | "catalogo" | "licitaciones";

const VALID_TABS: Tab[] = ["entregas", "personal", "qr", "catalogo", "licitaciones"];

export default function EppPage() {
  const { user, empresa } = useAuth();
  const searchParams = useSearchParams();
  const {
    getTiposEpp,
    descargarPdfEntrega,
    getProveedores,
  } = useEpp();
  const { showAlert } = useAlert();
  const tabParam = searchParams.get("tab");
  const initialTab: Tab =
    tabParam && VALID_TABS.includes(tabParam as Tab)
      ? (tabParam as Tab)
      : "entregas";
  const [tab, setTab] = useState<Tab>(initialTab);
  const [tipos, setTipos] = useState<EppTipo[]>([]);
  const [proveedores, setProveedores] = useState<EppProveedor[]>([]);
  const [loadingShared, setLoadingShared] = useState(true);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const canCreate = canWriteAppModule(user, "epp");
  const canEdit = canCreate;

  const handleVisibilidadChange = async (id: string, visible: boolean) => {
    try {
      await actualizarVisibilidadEppEntrega(id, visible);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: string } } };
      showAlert(
        "error",
        "Error",
        axiosErr.response?.data?.error ||
          "No se pudo actualizar la visibilidad ante el ente regulador.",
      );
      throw err;
    }
  };

  useEffect(() => {
    if (tabParam && VALID_TABS.includes(tabParam as Tab) && tabParam !== tab) {
      setTab(tabParam as Tab);
    }
  }, [tabParam, tab]);

  const fetchShared = async () => {
    if (!empresa?.id) return;
    setLoadingShared(true);
    try {
      const [tiposRes, proveedoresRes] = await Promise.all([
        getTiposEpp(true),
        getProveedores(),
      ]);
      setTipos(tiposRes.tipos || []);
      setProveedores(proveedoresRes.proveedores || []);
    } catch (err) {
      console.error("Error cargando datos:", err);
    } finally {
      setLoadingShared(false);
    }
  };

  const fetchProveedores = async () => {
    try {
      const proveedoresRes = await getProveedores();
      setProveedores(proveedoresRes.proveedores || []);
    } catch (err) {
      console.error("Error cargando proveedores:", err);
    }
  };

  useEffect(() => {
    if (empresa?.id) {
      void fetchShared();
    }
  }, [empresa?.id]);

  const handleDownloadPdf = async (id: string, dni: string) => {
    setDownloadingId(id);
    try {
      const pdfBlob = await descargarPdfEntrega(id);
      const blob = new Blob([pdfBlob], { type: "application/pdf" });
      const link = document.createElement("a");
      link.href = window.URL.createObjectURL(blob);
      link.download = `Constancia_SRT_299_${dni}.pdf`;
      link.click();
      window.URL.revokeObjectURL(link.href);
    } catch (err) {
      console.error("Error al descargar PDF:", err);
      showAlert("error", "Error", "No se pudo descargar el PDF. Reintentá en un momento.");
    } finally {
      setDownloadingId(null);
    }
  };

  const tabClass = (value: Tab) =>
    `shrink-0 min-h-11 px-1 pb-3 pt-1 text-sm font-bold border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
      tab === value
        ? "border-blue-600 text-blue-600"
        : "border-transparent text-slate-400 hover:text-slate-600"
    }`;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            Entrega de EPP (Res. SRT 299/11)
          </h1>
          <p className="text-slate-500 text-sm sm:text-xs mt-1">
            Nómina, QR de armarios, catálogo, constancias oficiales y licitaciones
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
          <Link
            href="/epp/base-datos"
            className="inline-flex items-center justify-center gap-2 w-full sm:w-auto min-h-12 px-5 py-3 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold rounded-xl text-sm transition-all cursor-pointer"
          >
            <Download className="h-5 w-5" />
            Base histórica
          </Link>
          {canCreate && tab === "entregas" && (
            <Link
              href="/epp/nueva-entrega"
              className="inline-flex items-center justify-center gap-2 w-full sm:w-auto min-h-12 px-5 py-3 bg-brand-primary hover:bg-brand-primary/95 text-white font-bold rounded-xl text-sm transition-all shadow-md shadow-blue-900/10 hover:shadow-lg cursor-pointer"
            >
              <Plus className="h-5 w-5" />
              Registrar Entrega
            </Link>
          )}
        </div>
      </div>

      <div className="flex border-b border-slate-200 gap-4 sm:gap-6 overflow-x-auto items-end">
        <button type="button" onClick={() => setTab("entregas")} className={tabClass("entregas")}>
          <FileText className="h-4 w-4" />
          Entregas
        </button>
        <button type="button" onClick={() => setTab("personal")} className={tabClass("personal")}>
          <Users className="h-4 w-4" />
          Personal
        </button>
        <button type="button" onClick={() => setTab("qr")} className={tabClass("qr")}>
          <QrCode className="h-4 w-4" />
          Generación de QR
        </button>
        <button type="button" onClick={() => setTab("catalogo")} className={tabClass("catalogo")}>
          <Package className="h-4 w-4" />
          Catálogo
        </button>
        <button
          type="button"
          onClick={() => setTab("licitaciones")}
          className={tabClass("licitaciones")}
        >
          <Layers className="h-4 w-4" />
          Licitación
        </button>
      </div>

      {tab === "entregas" && empresa && (
        <EntregasTab
          empresaId={empresa.id}
          user={user}
          canEdit={canEdit}
          downloadingId={downloadingId}
          onDownloadPdf={handleDownloadPdf}
          onVisibilidadChange={handleVisibilidadChange}
        />
      )}

      {tab === "personal" && empresa && (
        <PersonalTab
          tipos={tipos}
          empresaId={empresa.id}
          canEdit={canCreate}
        />
      )}

      {tab === "qr" && empresa && (
        <GeneracionQrTab
          empresaId={empresa.id}
          razonSocial={empresa.razon_social}
          canEdit={canCreate}
        />
      )}

      {tab === "catalogo" && (
        <CatalogoTab
          tipos={tipos}
          canEdit={canCreate}
          onChanged={fetchShared}
        />
      )}

      {tab === "licitaciones" && empresa && (
        <LicitacionesTab
          empresaId={empresa.id}
          proveedores={proveedores}
          canEdit={canCreate}
          onProveedoresChanged={fetchProveedores}
        />
      )}

      {loadingShared && (tab === "personal" || tab === "catalogo") && tipos.length === 0 && (
        <p className="text-xs font-semibold text-slate-400">Cargando catálogo…</p>
      )}
    </div>
  );
}
