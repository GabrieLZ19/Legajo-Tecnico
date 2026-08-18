"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { EppEntrega, EppTipo, Empleado, EppProveedor, EppLicitacion } from "@/types";
import Link from "next/link";
import {
  HardHat,
  Plus,
  Download,
  Package,
  FileText,
  Layers,
  Users,
} from "lucide-react";
import { useEpp } from "@/hooks/useEpp";
import { useAlert } from "@/context/AlertContext";
import { CatalogoTab } from "./_components/CatalogoTab";
import { PersonalTab } from "./_components/PersonalTab";
import { LicitacionesTab } from "./_components/LicitacionesTab";

type Tab = "entregas" | "personal" | "catalogo" | "licitaciones";

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
  const { getEntregas, getTiposEpp, descargarPdfEntrega, getEmpleados, getProveedores, getLicitaciones } =
    useEpp();
  const { showAlert } = useAlert();
  const [tab, setTab] = useState<Tab>("entregas");
  const [entregas, setEntregas] = useState<EppEntrega[]>([]);
  const [tipos, setTipos] = useState<EppTipo[]>([]);
  const [empleados, setEmpleados] = useState<Empleado[]>([]);
  const [proveedores, setProveedores] = useState<EppProveedor[]>([]);
  const [licitaciones, setLicitaciones] = useState<EppLicitacion[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const canCreate = user?.rol === "preventor" || user?.rol === "admin";

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

  const tabClass = (value: Tab) =>
    `pb-3 text-sm font-bold border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
      tab === value
        ? "border-blue-600 text-blue-600"
        : "border-transparent text-slate-400 hover:text-slate-600"
    }`;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">
            Entrega de EPP (Res. SRT 299/11)
          </h1>
          <p className="text-slate-500 text-xs mt-1">
            Padrón con QR, catálogo, constancias oficiales y licitaciones
          </p>
        </div>

        {canCreate && tab === "entregas" && (
          <Link
            href="/epp/nueva-entrega"
            className="inline-flex items-center gap-2 px-5 py-3 bg-brand-primary hover:bg-brand-primary/95 text-white font-bold rounded-xl text-sm transition-all shadow-md shadow-blue-900/10 hover:shadow-lg self-start sm:self-auto cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            Registrar Entrega
          </Link>
        )}
      </div>

      <div className="flex border-b border-slate-200 gap-6 overflow-x-auto">
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
      </div>

      {tab === "entregas" && (
        <div className="bg-white rounded-3xl border border-slate-100 p-6 shadow-2xs">
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
                Escaneá el QR del trabajador para generar la constancia SRT 299/11.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-slate-50">
              {entregas.map((e) => (
                <li key={e.id} className="py-4 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-10 w-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0">
                      <HardHat className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-slate-800 truncate">
                        {e.nombre_empleado} · DNI {e.dni_empleado}
                      </p>
                      <p className="text-[11px] text-slate-400 font-semibold">
                        {e.epp_tipos?.nombre} · {formatLocalDate(e.fecha_entrega)}
                        {e.marca ? ` · ${e.marca}` : ""}
                        {e.modelo ? ` ${e.modelo}` : ""}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDownloadPdf(e.id, e.dni_empleado)}
                    disabled={downloadingId === e.id}
                    className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-900 text-white text-[11px] font-bold rounded-lg cursor-pointer disabled:opacity-50"
                    title="Descargar PDF SRT 299/11"
                  >
                    <Download className="h-3.5 w-3.5" />
                    PDF
                  </button>
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
          tipos={tipos.filter((t) => t.activo)}
          empresaId={empresa.id}
          canEdit={canCreate}
          onChanged={fetchData}
        />
      )}
    </div>
  );
}
