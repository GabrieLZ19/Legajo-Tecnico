"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { descargarInformePdf } from "@/hooks/useInformes";
import type { DocumentoArchivo } from "@/types";
import {
  Download,
  Search,
  Building2,
  FileText,
  GraduationCap,
  HardHat,
  AlertTriangle,
  ArrowLeft,
  Loader2,
  Filter,
  CheckCircle2,
  X,
} from "lucide-react";

const TIPO_CONFIG: Record<
  DocumentoArchivo["tipo"],
  { label: string; icon: typeof FileText; color: string; badgeBg: string }
> = {
  informe: {
    label: "Informe de visita",
    icon: FileText,
    color: "text-blue-700",
    badgeBg: "bg-blue-50 text-blue-700 border-blue-200",
  },
  capacitacion: {
    label: "Capacitación",
    icon: GraduationCap,
    color: "text-violet-700",
    badgeBg: "bg-violet-50 text-violet-700 border-violet-200",
  },
  epp: {
    label: "Entrega EPP",
    icon: HardHat,
    color: "text-amber-700",
    badgeBg: "bg-amber-50 text-amber-700 border-amber-200",
  },
  accion: {
    label: "Acción de mejora",
    icon: AlertTriangle,
    color: "text-rose-700",
    badgeBg: "bg-rose-50 text-rose-700 border-rose-200",
  },
};

export default function EnteArchivoPage() {
  const [documentos, setDocumentos] = useState<DocumentoArchivo[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedTipo, setSelectedTipo] = useState<string>("todos");
  const [selectedEmpresa, setSelectedEmpresa] = useState<string>("todas");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api
      .get("/ente/archivo")
      .then((res) => {
        if (!cancelled) {
          setDocumentos(res.data.documentos || []);
          setLoading(false);
        }
      })
      .catch((err) => {
        console.error("Error loading ente archivo:", err);
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // Lista única de empresas presentes en los documentos
  const empresasDisponibles = useMemo(() => {
    const map = new Map<string, string>();
    documentos.forEach((d) => {
      if (d.empresa_id && d.empresa_razon_social) {
        map.set(d.empresa_id, d.empresa_razon_social);
      }
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [documentos]);

  // Filtrado reactivo
  const filteredDocumentos = useMemo(() => {
    const term = searchTerm.toLowerCase().trim();

    return documentos.filter((doc) => {
      if (selectedTipo !== "todos" && doc.tipo !== selectedTipo) return false;
      if (selectedEmpresa !== "todas" && doc.empresa_id !== selectedEmpresa) return false;

      if (!term) return true;
      const matchTitulo = doc.titulo?.toLowerCase().includes(term);
      const matchEmpresa = doc.empresa_razon_social?.toLowerCase().includes(term);
      const matchTipo = TIPO_CONFIG[doc.tipo]?.label.toLowerCase().includes(term);

      return matchTitulo || matchEmpresa || matchTipo;
    });
  }, [documentos, searchTerm, selectedTipo, selectedEmpresa]);

  const download = async (doc: DocumentoArchivo) => {
    setDownloading(doc.id);
    try {
      let blob: Blob;
      if (doc.tipo === "informe") {
        blob = await descargarInformePdf(doc.id);
      } else {
        const path =
          doc.tipo === "epp"
            ? `/epp/entregas/${doc.id}/pdf`
            : `/capacitaciones/${doc.id}/exportar?formato=pdf`;
        const res = await api.get(path, { responseType: "blob" });
        blob = new Blob([res.data], { type: "application/pdf" });
      }
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${doc.tipo}_${doc.id.slice(0, 8)}.pdf`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Error al descargar PDF:", err);
    } finally {
      setDownloading(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Encabezado */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="space-y-1">
          <Link
            href="/ente/dashboard"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-800 transition-colors mb-1"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Volver al Tablero de Auditoría
          </Link>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
            Archivo Histórico de Documentos
          </h1>
          <p className="text-sm text-slate-500 max-w-2xl">
            Explorá y descargá constancias de visita, registros de capacitación, entregas de EPP y acciones de mejora habilitadas.
          </p>
        </div>

        <div className="bg-blue-50 border border-blue-200/80 rounded-2xl px-4 py-2.5 text-xs font-bold text-blue-900 shrink-0">
          Total de documentos: <span className="text-blue-600 font-black text-sm">{documentos.length}</span>
        </div>
      </div>

      {/* Barra de Filtros */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
          {/* Buscador */}
          <div className="md:col-span-7 relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por título de documento, empresa o tema..."
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition-all"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Selector de Empresa */}
          <div className="md:col-span-5 relative">
            <Building2 className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
            <select
              value={selectedEmpresa}
              onChange={(e) => setSelectedEmpresa(e.target.value)}
              className="w-full pl-10 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 appearance-none cursor-pointer"
            >
              <option value="todas">Todas las empresas ({empresasDisponibles.length})</option>
              {empresasDisponibles.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Pestañas de tipo de documento */}
        <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-slate-100">
          <button
            type="button"
            onClick={() => setSelectedTipo("todos")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer border ${
              selectedTipo === "todos"
                ? "bg-slate-900 text-white border-slate-900 shadow-2xs"
                : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
            }`}
          >
            Todos ({documentos.length})
          </button>
          {(["informe", "capacitacion", "epp", "accion"] as const).map((t) => {
            const count = documentos.filter((d) => d.tipo === t).length;
            const config = TIPO_CONFIG[t];
            const Icon = config.icon;
            return (
              <button
                key={t}
                type="button"
                onClick={() => setSelectedTipo(t)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer border ${
                  selectedTipo === t
                    ? "bg-blue-600 text-white border-blue-600 shadow-2xs"
                    : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                <span>{config.label}</span>
                <span className="text-[10px] opacity-80 font-mono">({count})</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Lista de Documentos */}
      {loading ? (
        <div className="py-16 flex flex-col items-center justify-center text-slate-400 gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          <span className="text-sm font-bold">Cargando archivo de documentos...</span>
        </div>
      ) : filteredDocumentos.length === 0 ? (
        <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center text-slate-400">
          <FileText className="h-10 w-10 mx-auto text-slate-300 mb-2" />
          <p className="text-base font-black text-slate-700">No se encontraron documentos</p>
          <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
            Probá ajustando el filtro de empresa, tipo de archivo o el texto de búsqueda.
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-3xl border border-slate-200 divide-y divide-slate-100 overflow-hidden shadow-xs">
          {filteredDocumentos.map((doc) => {
            const config = TIPO_CONFIG[doc.tipo];
            const Icon = config?.icon || FileText;

            return (
              <div
                key={`${doc.tipo}-${doc.id}`}
                className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50/70 transition-colors"
              >
                <div className="flex items-start gap-3.5 min-w-0">
                  <div
                    className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 border mt-0.5 ${config?.badgeBg || "bg-slate-100 text-slate-600"}`}
                  >
                    <Icon className="h-5 w-5" />
                  </div>

                  <div className="min-w-0 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded border ${config?.badgeBg}`}
                      >
                        {config?.label || doc.tipo}
                      </span>
                      <span className="text-xs font-black text-slate-900 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded">
                        {doc.empresa_razon_social}
                      </span>
                    </div>

                    <p className="text-sm font-black text-slate-900 tracking-tight line-clamp-1">
                      {doc.titulo}
                    </p>

                    <div className="flex items-center gap-2 text-xs text-slate-400 font-medium flex-wrap">
                      <span>📅 {new Date(doc.fecha).toLocaleDateString("es-AR")}</span>
                      {doc.tipo === "accion" && doc.extra?.responsable && (
                        <>
                          <span>•</span>
                          <span>Resp: {String(doc.extra.responsable)}</span>
                        </>
                      )}
                      {doc.tipo === "accion" && doc.extra?.estado && (
                        <>
                          <span>•</span>
                          <span className="font-bold text-slate-600">Estado: {String(doc.extra.estado)}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                  {doc.tipo === "accion" ? (
                    <span className="text-[11px] font-bold text-slate-400 bg-slate-100 border border-slate-200 px-3 py-1.5 rounded-xl">
                      Solo consulta
                    </span>
                  ) : (
                    doc.pdf_disponible && (
                      <button
                        type="button"
                        onClick={() => download(doc)}
                        disabled={downloading === doc.id}
                        className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer disabled:opacity-50"
                      >
                        {downloading === doc.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Download className="h-3.5 w-3.5" />
                        )}
                        <span>Descargar PDF</span>
                      </button>
                    )
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
