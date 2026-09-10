"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { EppEntrega, EppTipo, Empleado, EppProveedor, EppLicitacion } from "@/types";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  HardHat,
  Plus,
  Download,
  Package,
  FileText,
  Layers,
  Users,
  CheckCircle2,
  QrCode,
} from "lucide-react";
import { useEpp } from "@/hooks/useEpp";
import { useAlert } from "@/context/AlertContext";
import { VisibleEnteToggle } from "@/components/VisibleEnteToggle";
import { actualizarVisibilidadEppEntrega } from "@/lib/visibilidadEnte";
import { CatalogoTab } from "./_components/CatalogoTab";
import { PersonalTab } from "./_components/PersonalTab";
import { LicitacionesTab } from "./_components/LicitacionesTab";
import { canWriteAppModule } from "@/lib/moduleAccess";

type Tab = "entregas" | "personal" | "catalogo" | "licitaciones";

const VALID_TABS: Tab[] = ["entregas", "personal", "catalogo", "licitaciones"];

const formatLocalDate = (dateStr: string | Date | null | undefined): string => {
  if (!dateStr) return "";
  const isoStr =
    typeof dateStr === "string" ? dateStr : new Date(dateStr).toISOString();
  const datePart = isoStr.split("T")[0];
  const parts = datePart.split("-");
  if (parts.length === 3) {
    const [year, month, day] = parts;
    return `${parseInt(day, 10)}/${parseInt(month, 10)}/${year}`;
  }
  return new Date(dateStr).toLocaleDateString("es-AR");
};

export default function EppPage() {
  const { user, empresa } = useAuth();
  const searchParams = useSearchParams();
  const {
    getEntregas,
    getTiposEpp,
    descargarPdfEntrega,
    getEmpleados,
    getProveedores,
    getLicitaciones,
    generarQrEntrega,
  } = useEpp();
  const { showAlert } = useAlert();
  const tabParam = searchParams.get("tab");
  const initialTab: Tab =
    tabParam && VALID_TABS.includes(tabParam as Tab)
      ? (tabParam as Tab)
      : "entregas";
  const [tab, setTab] = useState<Tab>(initialTab);
  const [entregas, setEntregas] = useState<EppEntrega[]>([]);
  const [tipos, setTipos] = useState<EppTipo[]>([]);
  const [empleados, setEmpleados] = useState<Empleado[]>([]);
  const [proveedores, setProveedores] = useState<EppProveedor[]>([]);
  const [licitaciones, setLicitaciones] = useState<EppLicitacion[]>([]);
  const [loading, setLoading] = useState(true);
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
      setEntregas((prev) =>
        prev.map((e) =>
          e.id === id ? { ...e, visible_ente_regulador: visible } : e,
        ),
      );
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: string } } };
      showAlert(
        "error",
        "Error",
        axiosErr.response?.data?.error ||
          "No se pudo actualizar la visibilidad ante el ente regulador.",
      );
    }
  };

  useEffect(() => {
    if (tabParam && VALID_TABS.includes(tabParam as Tab) && tabParam !== tab) {
      setTab(tabParam as Tab);
    }
  }, [tabParam, tab]);

  const fetchData = async () => {
    if (!empresa?.id) return;
    setLoading(true);
    try {
      const [entregasRes, tiposRes, empleadosRes, proveedoresRes, licitacionesRes] =
        await Promise.all([
          getEntregas(empresa.id),
          getTiposEpp(true),
          getEmpleados(empresa.id),
          getProveedores(),
          getLicitaciones(empresa.id),
        ]);
      setEntregas(entregasRes.entregas || []);
      setTipos(tiposRes.tipos || []);
      setEmpleados(empleadosRes.empleados || []);
      setProveedores(proveedoresRes.proveedores || []);
      setLicitaciones(licitacionesRes.licitaciones || []);
    } catch (err) {
      console.error("Error cargando datos:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (empresa?.id) {
      fetchData();
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

  const entregasOrdenadas = useMemo(
    () =>
      entregas
        .filter((e) => user?.rol !== "ente_regulador" || Boolean(e.visible_ente_regulador))
        .sort((a, b) => {
          const ta = new Date(a.fecha_entrega || 0).getTime();
          const tb = new Date(b.fecha_entrega || 0).getTime();
          if (tb !== ta) return tb - ta;
          return b.id.localeCompare(a.id);
        }),
    [entregas, user?.rol],
  );

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

      {tab === "entregas" && (
        <div className="bg-white rounded-3xl border border-slate-100 p-4 sm:p-6 shadow-2xs">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-600"></div>
              <p className="text-xs text-slate-400 mt-2 font-semibold">
                Cargando constancias...
              </p>
            </div>
          ) : entregas.length === 0 ? (
            <div className="text-center py-12">
              <div className="h-12 w-12 rounded-2xl bg-slate-50 flex items-center justify-center mx-auto mb-4">
                <FileText className="h-6 w-6 text-slate-400" />
              </div>
              <h3 className="text-slate-800 font-bold text-sm">Sin entregas registradas</h3>
              <p className="text-slate-400 text-xs mt-1">
                Escaneá el QR del trabajador o generá el QR de punto de entrega.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-slate-50">
              {entregasOrdenadas.map((e) => (
                <li
                  key={e.id}
                  className="py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-10 w-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0">
                      <HardHat className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-slate-800 truncate">
                        {e.nombre_empleado} · DNI {e.dni_empleado}
                      </p>
                      <p className="text-xs text-slate-400 font-semibold">
                        {e.epp_tipos?.nombre} · {formatLocalDate(e.fecha_entrega)}
                        {e.marca ? ` · ${e.marca}` : ""}
                        {e.modelo ? ` ${e.modelo}` : ""}
                        {e.origen === "qr_publico" ? " · QR público" : ""}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 shrink-0">
                    {user?.rol === "ente_regulador" ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full">
                        <CheckCircle2 className="h-3.5 w-3.5" /> Habilitado para auditoría
                      </span>
                    ) : (
                      <VisibleEnteToggle
                        checked={Boolean(e.visible_ente_regulador)}
                        disabled={!canEdit}
                        onChange={(v) => void handleVisibilidadChange(e.id, v)}
                        label="Visible ente regulador"
                      />
                    )}
                    <button
                      type="button"
                      onClick={() => handleDownloadPdf(e.id, e.dni_empleado)}
                      disabled={downloadingId === e.id}
                      className="inline-flex items-center justify-center gap-2 shrink-0 min-h-11 px-4 py-2.5 bg-slate-900 text-white text-sm font-bold rounded-xl cursor-pointer disabled:opacity-50"
                      title="Descargar PDF SRT 299/11"
                    >
                      <Download className="h-4 w-4" />
                      PDF
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {tab === "personal" && empresa && (
        <PersonalTab
          empleados={empleados}
          empresaId={empresa.id}
          canEdit={canCreate}
          onChanged={fetchData}
        />
      )}

      {tab === "catalogo" && (
        <CatalogoTab tipos={tipos} canEdit={canCreate} onChanged={fetchData} />
      )}

      {tab === "licitaciones" && empresa && (
        <LicitacionesTab
          licitaciones={licitaciones}
          proveedores={proveedores}
          canEdit={canCreate}
          onChanged={fetchData}
        />
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
