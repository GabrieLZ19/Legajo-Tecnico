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
import { LicitacionesTab } from "./_components/LicitacionesTab";
import { EntregasTab } from "./_components/EntregasTab";
import { canWriteAppModule } from "@/lib/moduleAccess";

type Tab = "entregas" | "personal" | "catalogo" | "licitaciones";

const VALID_TABS: Tab[] = ["entregas", "personal", "catalogo", "licitaciones"];

export default function EppPage() {
  const { user, empresa } = useAuth();
  const searchParams = useSearchParams();
  const {
    getTiposEpp,
    descargarPdfEntrega,
    getProveedores,
    generarQrEntrega,
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
  const [qrEntrega, setQrEntrega] = useState<{
    qr: string;
    url: string;
    razonSocial: string;
  } | null>(null);
  const [generandoQr, setGenerandoQr] = useState(false);

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

  const handleGenerarQrEntrega = async () => {
    if (!empresa?.id) return;
    setGenerandoQr(true);
    try {
      const data = await generarQrEntrega(empresa.id);
      setQrEntrega({
        qr: data.qr,
        url: data.url,
        razonSocial: data.empresa.razon_social,
      });
    } catch {
      showAlert(
        "error",
        "Error",
        "No se pudo generar el QR de entrega. Reintentá en un momento.",
      );
    } finally {
      setGenerandoQr(false);
    }
  };

  const downloadQrEntrega = () => {
    if (!qrEntrega) return;
    const link = document.createElement("a");
    link.href = qrEntrega.qr;
    link.download = `QR_Entrega_EPP_${qrEntrega.razonSocial.replace(/\s+/g, "_")}.png`;
    link.click();
  };

  const printQrEntrega = () => {
    if (!qrEntrega) return;
    const w = window.open("", "_blank", "noopener,noreferrer,width=480,height=640");
    if (!w) {
      showAlert("warning", "Impresión", "Permití ventanas emergentes para imprimir el QR.");
      return;
    }
    const safeName = qrEntrega.razonSocial.replace(/</g, "");
    const safeUrl = qrEntrega.url.replace(/</g, "");
    w.document.write(`<!DOCTYPE html><html><head><title>QR Entrega EPP</title>
      <style>
        body{font-family:system-ui,sans-serif;text-align:center;padding:24px;color:#0f172a}
        h1{font-size:16px;margin:0 0 8px}
        p{font-size:12px;color:#64748b;margin:0 0 16px}
        img{width:320px;height:320px}
        .url{font-size:10px;word-break:break-all;margin-top:12px}
      </style></head><body>
      <h1>Entrega de EPP — ${safeName}</h1>
      <p>Escaneá para registrar la entrega (Res. SRT 299/11)</p>
      <img src="${qrEntrega.qr}" alt="QR entrega EPP" />
      <p class="url">${safeUrl}</p>
      <script>window.onload=function(){window.print();}</script>
      </body></html>`);
    w.document.close();
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
            Padrón con QR, catálogo, constancias oficiales y licitaciones
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
          Personal / QR
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
        {canCreate && (
          <button
            type="button"
            onClick={() => void handleGenerarQrEntrega()}
            disabled={generandoQr || !empresa?.id}
            className="shrink-0 ml-auto min-h-11 px-1 pb-3 pt-1 text-sm font-bold text-blue-700 hover:text-blue-800 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
          >
            <QrCode className="h-4 w-4" />
            {generandoQr ? "Generando…" : "Generar QR para entrega"}
          </button>
        )}
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

      {qrEntrega && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
          <div className="bg-white rounded-3xl p-6 w-full max-w-sm text-center space-y-4">
            <h3 className="text-sm font-black uppercase tracking-wider text-slate-800">
              QR para entrega de EPP
            </h3>
            <img
              src={qrEntrega.qr}
              alt="QR punto de entrega"
              className="mx-auto w-56 h-56"
            />
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Imprimí este código y dejalo en los puntos de entrega. El trabajador lo
              escanea con el celular, carga el EPP, la certificación y firma. La foto se
              toma del catálogo si está cargada. No requiere firma del responsable de la
              empresa.
            </p>
            <p className="text-[10px] text-slate-300 break-all">{qrEntrega.url}</p>
            <div className="flex flex-col gap-2">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setQrEntrega(null)}
                  className="flex-1 min-h-12 py-3 border rounded-xl text-sm font-bold cursor-pointer"
                >
                  Cerrar
                </button>
                <button
                  type="button"
                  onClick={downloadQrEntrega}
                  className="flex-1 min-h-12 py-3 bg-blue-600 text-white rounded-xl text-sm font-bold inline-flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Download className="h-4 w-4" />
                  Descargar
                </button>
              </div>
              <button
                type="button"
                onClick={printQrEntrega}
                className="w-full min-h-12 py-3 bg-slate-900 text-white rounded-xl text-sm font-bold cursor-pointer"
              >
                Imprimir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
