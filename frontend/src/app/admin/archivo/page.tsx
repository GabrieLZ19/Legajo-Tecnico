"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import type { AdminEmpresaOption, InformeVisita } from "@/types";
import {
  ArrowLeft,
  Building2,
  Calendar,
  ChevronRight,
  Clock3,
  Download,
  FileDown,
  FileText,
  Folder,
  Loader2,
  RefreshCw,
  Search,
  ShieldAlert,
  X,
} from "lucide-react";

const MESES = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];

type ArchiveFilter = "all" | "signed" | "pending" | "with-pdf";

type YearGroup = {
  year: number;
  count: number;
};

type MonthGroup = {
  month: number;
  count: number;
};

const FILTERS: Array<{ value: ArchiveFilter; label: string }> = [
  { value: "all", label: "Constancias" },
  { value: "signed", label: "Firmadas" },
  { value: "pending", label: "Pendientes" },
  { value: "with-pdf", label: "Con PDF" },
];

export default function AdminArchivoPage() {
  const [empresas, setEmpresas] = useState<AdminEmpresaOption[]>([]);
  const [informes, setInformes] = useState<InformeVisita[]>([]);
  const [selectedEmpresaId, setSelectedEmpresaId] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [archiveFilter, setArchiveFilter] = useState<ArchiveFilter>("all");
  const [currentYear, setCurrentYear] = useState<number | null>(null);
  const [currentMonth, setCurrentMonth] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const loadArchive = useCallback(async (silent = false) => {
    try {
      if (silent) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      const [empresasResponse, informesResponse] = await Promise.all([
        api.get("/admin/empresas"),
        api.get("/informes"),
      ]);

      setEmpresas(empresasResponse.data as AdminEmpresaOption[]);
      setInformes(informesResponse.data as InformeVisita[]);
      setErrorMessage(null);
    } catch (error) {
      console.error("Error loading archive data:", error);
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "No se pudo cargar el archivo histórico.",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadArchive();
  }, [loadArchive]);

  useEffect(() => {
    setCurrentYear(null);
    setCurrentMonth(null);
  }, [selectedEmpresaId]);

  useEffect(() => {
    if (searchTerm || dateFrom || dateTo || archiveFilter !== "all") {
      setCurrentYear(null);
      setCurrentMonth(null);
    }
  }, [archiveFilter, dateFrom, dateTo, searchTerm]);

  const companyById = useMemo(() => {
    return new Map(empresas.map((empresa) => [empresa.id, empresa]));
  }, [empresas]);

  const selectedEmpresa =
    selectedEmpresaId === "all"
      ? null
      : companyById.get(selectedEmpresaId) || null;

  const companyDocs = useMemo(() => {
    if (selectedEmpresaId === "all") {
      return informes;
    }

    return informes.filter(
      (informe) => informe.empresa_id === selectedEmpresaId,
    );
  }, [informes, selectedEmpresaId]);

  const filteredDocuments = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    const fromTime = dateFrom ? new Date(dateFrom).getTime() : null;
    const toTime = dateTo
      ? new Date(dateTo).getTime() + 24 * 60 * 60 * 1000 - 1
      : null;

    return companyDocs.filter((documento) => {
      const documentTime = new Date(documento.fecha_hora_visita).getTime();

      if (fromTime !== null && documentTime < fromTime) {
        return false;
      }

      if (toTime !== null && documentTime > toTime) {
        return false;
      }

      if (archiveFilter === "signed" && documento.estado_firma !== "firmado") {
        return false;
      }

      if (archiveFilter === "pending" && documento.estado_firma === "firmado") {
        return false;
      }

      if (archiveFilter === "with-pdf" && !documento.url_pdf_generado) {
        return false;
      }

      if (query) {
        const empresa = companyById.get(documento.empresa_id);
        const searchable = [
          documento.numero_informe?.toString() ?? "",
          documento.actividad ?? "",
          documento.lugar_visita ?? "",
          documento.contacto_visita ?? "",
          documento.observaciones ?? "",
          empresa?.razon_social ?? "",
          empresa?.cuit ?? "",
          documento.estado_firma,
        ]
          .join(" ")
          .toLowerCase();

        if (!searchable.includes(query)) {
          return false;
        }
      }

      return true;
    });
  }, [archiveFilter, companyById, companyDocs, dateFrom, dateTo, searchTerm]);

  const hasFlatFilters = Boolean(
    searchTerm.trim() || dateFrom || dateTo || archiveFilter !== "all",
  );

  const yearsGroup = useMemo<YearGroup[]>(() => {
    const groups = new Map<number, number>();

    filteredDocuments.forEach((documento) => {
      const year = new Date(documento.fecha_hora_visita).getFullYear();
      groups.set(year, (groups.get(year) || 0) + 1);
    });

    return Array.from(groups.entries())
      .map(([year, count]) => ({ year, count }))
      .sort((a, b) => b.year - a.year);
  }, [filteredDocuments]);

  const monthsGroup = useMemo<MonthGroup[]>(() => {
    if (currentYear === null) {
      return [];
    }

    const groups = new Map<number, number>();

    filteredDocuments.forEach((documento) => {
      const date = new Date(documento.fecha_hora_visita);
      if (date.getFullYear() !== currentYear) {
        return;
      }

      const month = date.getMonth();
      groups.set(month, (groups.get(month) || 0) + 1);
    });

    return Array.from(groups.entries())
      .map(([month, count]) => ({ month, count }))
      .sort((a, b) => b.month - a.month);
  }, [currentYear, filteredDocuments]);

  const documentsInMonth = useMemo(() => {
    if (currentYear === null || currentMonth === null) {
      return [];
    }

    return filteredDocuments
      .filter((documento) => {
        const date = new Date(documento.fecha_hora_visita);
        return (
          date.getFullYear() === currentYear && date.getMonth() === currentMonth
        );
      })
      .sort(
        (a, b) =>
          new Date(b.fecha_hora_visita).getTime() -
          new Date(a.fecha_hora_visita).getTime(),
      );
  }, [currentMonth, currentYear, filteredDocuments]);

  const totalDocuments = filteredDocuments.length;
  const signedDocuments = filteredDocuments.filter(
    (documento) => documento.estado_firma === "firmado",
  ).length;
  const pendingDocuments = totalDocuments - signedDocuments;
  const downloadableDocuments = filteredDocuments.filter((documento) =>
    Boolean(documento.url_pdf_generado),
  ).length;

  const activeCompanyLabel =
    selectedEmpresaId === "all"
      ? "Todas las empresas"
      : selectedEmpresa?.razon_social || "Empresa";

  const handleResetFilters = () => {
    setSearchTerm("");
    setDateFrom("");
    setDateTo("");
    setArchiveFilter("all");
    setCurrentYear(null);
    setCurrentMonth(null);
  };

  const handleDownloadPdf = async (documento: InformeVisita) => {
    setDownloadingId(documento.id);

    try {
      const response = await api.get(`/informes/${documento.id}/pdf`, {
        responseType: "blob",
      });

      const blob = new Blob([response.data], { type: "application/pdf" });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `constancia_visita_${String(
        documento.numero_informe,
      ).padStart(6, "0")}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Error downloading PDF:", error);
    } finally {
      setDownloadingId(null);
    }
  };

  const handleExportCsv = () => {
    if (filteredDocuments.length === 0) {
      return;
    }

    const csv = buildCsv(
      filteredDocuments.map((documento) => {
        const empresa = companyById.get(documento.empresa_id);
        return {
          numero: String(documento.numero_informe).padStart(6, "0"),
          empresa: empresa?.razon_social || "",
          cuit: empresa?.cuit || "",
          actividad: documento.actividad || "",
          lugar: documento.lugar_visita || "",
          fecha: formatDate(documento.fecha_hora_visita),
          estado: getEstadoLabel(documento.estado_firma),
          pdf: documento.url_pdf_generado ? "SI" : "NO",
        };
      }),
    );

    const blob = new Blob([csv], {
      type: "text/csv;charset=utf-8;",
    });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `archivo_historico_${slugify(activeCompanyLabel)}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  };

  if (loading) {
    return <ArchiveSkeleton />;
  }

  if (errorMessage) {
    return (
      <div className="rounded-[28px] border border-blue-200 bg-white p-8 shadow-[0_12px_40px_rgba(15,23,42,0.06)]">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-700">
            <ShieldAlert className="h-6 w-6" />
          </div>
          <div className="min-w-0">
            <h1 className="text-xl font-black tracking-tight text-slate-900">
              No se pudo cargar el archivo histórico
            </h1>
            <p className="mt-2 text-sm text-slate-500">{errorMessage}</p>
            <button
              type="button"
              onClick={() => void loadArchive(true)}
              className="mt-5 inline-flex items-center gap-2 rounded-full bg-blue-700 px-4 py-2.5 text-xs font-black uppercase tracking-[0.18em] text-white transition-colors hover:bg-blue-800"
            >
              <RefreshCw className="h-4 w-4" />
              Reintentar
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 border-b border-slate-200/60 pb-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900">
            Archivo Histórico Completo
          </h1>
          <p className="mt-1 text-sm font-semibold text-slate-500">
            Explora documentos, constancias y PDFs firmados por empresa, fecha y
            estado.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Buscar informe, empresa o lugar..."
              className="w-full rounded-2xl border border-slate-200 bg-white py-3 pl-10 pr-4 text-sm font-medium text-slate-700 outline-none transition-colors placeholder:text-slate-400 focus:border-blue-300 sm:w-72"
            />
          </div>

          <button
            type="button"
            onClick={handleExportCsv}
            disabled={filteredDocuments.length === 0}
            className="inline-flex items-center gap-2 rounded-2xl bg-blue-700 px-5 py-3 text-xs font-black uppercase tracking-[0.18em] text-white transition-colors hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Download className="h-4 w-4" />
            Exportar
          </button>
        </div>
      </div>

      {refreshing ? (
        <div className="inline-flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50 px-4 py-2 text-xs font-black uppercase tracking-[0.16em] text-blue-700">
          <Loader2 className="h-4 w-4 animate-spin" />
          Sincronizando archivo
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <ArchiveStatCard
          label="Documentos"
          value={totalDocuments}
          tone="blue"
        />
        <ArchiveStatCard
          label="Firmados"
          value={signedDocuments}
          tone="emerald"
        />
        <ArchiveStatCard
          label="Pendientes"
          value={pendingDocuments}
          tone="amber"
        />
        <ArchiveStatCard
          label="Con PDF"
          value={downloadableDocuments}
          tone="sky"
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="rounded-[28px] border border-blue-100 bg-white shadow-[0_12px_40px_rgba(15,23,42,0.06)]">
          <div className="border-b border-blue-100 bg-linear-to-r from-blue-50 to-white px-5 py-4">
            <div className="flex items-start gap-3">
              <div className="flex h-12 w-20 items-center justify-center rounded-2xl bg-blue-700 text-white shadow-sm">
                <Building2 className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <h2 className="text-base font-black text-slate-900">
                  Empresas
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Seleccioná una empresa o consultá la vista consolidada.
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-1 p-3">
            <CompanyButton
              active={selectedEmpresaId === "all"}
              label="Todas las empresas"
              sublabel={`${informes.length} documentos`}
              onClick={() => setSelectedEmpresaId("all")}
            />
            {empresas.map((empresa) => {
              const count = informes.filter(
                (documento) => documento.empresa_id === empresa.id,
              ).length;

              return (
                <CompanyButton
                  key={empresa.id}
                  active={selectedEmpresaId === empresa.id}
                  label={empresa.razon_social}
                  sublabel={`${count} documentos · CUIT ${empresa.cuit}`}
                  onClick={() => setSelectedEmpresaId(empresa.id)}
                />
              );
            })}
          </div>
        </aside>

        <section className="space-y-6 rounded-[28px] border border-blue-100 bg-white p-5 shadow-[0_12px_40px_rgba(15,23,42,0.06)] sm:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">
                Archivo seleccionado
              </p>
              <h2 className="mt-2 text-xl font-black tracking-tight text-slate-900">
                {activeCompanyLabel}
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                {selectedEmpresa
                  ? `CUIT ${selectedEmpresa.cuit} · ${companyDocs.length} documentos disponibles`
                  : `${companyDocs.length} documentos consolidados de la consultora`}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-100 bg-blue-50 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.16em] text-blue-700">
                <Clock3 className="h-3.5 w-3.5" />
                Constancias
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">
                <FileText className="h-3.5 w-3.5" />
                Histórico real
              </span>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {FILTERS.map((filter) => (
              <button
                key={filter.value}
                type="button"
                onClick={() => setArchiveFilter(filter.value)}
                className={`rounded-full px-4 py-2 text-xs font-black uppercase tracking-[0.18em] transition-colors ${
                  archiveFilter === filter.value
                    ? "bg-blue-700 text-white shadow-sm"
                    : "border border-slate-200 bg-white text-slate-500 hover:border-blue-200 hover:bg-blue-50"
                }`}
              >
                {filter.label}
              </button>
            ))}

            <div className="ml-auto flex flex-wrap items-center gap-2">
              <label className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-500">
                <Calendar className="h-4 w-4 text-slate-400" />
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(event) => setDateFrom(event.target.value)}
                  className="bg-transparent outline-none"
                />
              </label>
              <span className="text-xs font-bold text-slate-300">a</span>
              <label className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-500">
                <Calendar className="h-4 w-4 text-slate-400" />
                <input
                  type="date"
                  value={dateTo}
                  onChange={(event) => setDateTo(event.target.value)}
                  className="bg-transparent outline-none"
                />
              </label>

              {(searchTerm ||
                dateFrom ||
                dateTo ||
                archiveFilter !== "all") && (
                <button
                  type="button"
                  onClick={handleResetFilters}
                  className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-slate-500 transition-colors hover:bg-slate-50"
                >
                  <X className="h-4 w-4" />
                  Limpiar
                </button>
              )}
            </div>
          </div>

          <div className="rounded-3xl border border-blue-100 bg-blue-50/50 p-3">
            <div className="flex items-center justify-between border-b border-blue-100 px-3 py-3 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
              <span>Carpetas</span>
              <span>{hasFlatFilters ? "Vista filtrada" : "Explorador"}</span>
            </div>

            {hasFlatFilters ? (
              <div className="mt-3">
                {filteredDocuments.length > 0 ? (
                  <div className="divide-y divide-blue-100/80 overflow-hidden rounded-[20px] border border-blue-100 bg-white">
                    {filteredDocuments.map((documento) => (
                      <ArchiveRow
                        key={documento.id}
                        documento={documento}
                        empresa={companyById.get(documento.empresa_id) || null}
                        downloadingId={downloadingId}
                        onDownload={handleDownloadPdf}
                      />
                    ))}
                  </div>
                ) : (
                  <EmptyState
                    title="No hay documentos para estos filtros"
                    description="Probá otra fecha, quitá la búsqueda o seleccioná otra empresa."
                  />
                )}
              </div>
            ) : currentYear === null ? (
              <div className="mt-3 space-y-4">
                {yearsGroup.length > 0 ? (
                  <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                    {yearsGroup.map((group) => (
                      <FolderCard
                        key={group.year}
                        label={`Año ${group.year}`}
                        count={group.count}
                        onClick={() => setCurrentYear(group.year)}
                      />
                    ))}
                  </div>
                ) : (
                  <EmptyState
                    title="No hay documentos registrados"
                    description="Seleccioná otra empresa o revisá una fecha diferente."
                  />
                )}
              </div>
            ) : currentMonth === null ? (
              <div className="mt-3 space-y-4">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setCurrentYear(null)}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 transition-colors hover:bg-slate-50"
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </button>
                  <span className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">
                    Carpetas de {currentYear}
                  </span>
                </div>

                {monthsGroup.length > 0 ? (
                  <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                    {monthsGroup.map((group) => (
                      <FolderCard
                        key={group.month}
                        label={MESES[group.month]}
                        count={group.count}
                        onClick={() => setCurrentMonth(group.month)}
                      />
                    ))}
                  </div>
                ) : (
                  <EmptyState
                    title="Sin documentos en este año"
                    description="Elegí otro año o limpiá la selección de empresa."
                  />
                )}
              </div>
            ) : (
              <div className="mt-3 space-y-4">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setCurrentMonth(null)}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 transition-colors hover:bg-slate-50"
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </button>
                  <span className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">
                    Documentos de {MESES[currentMonth]} de {currentYear}
                  </span>
                </div>

                {documentsInMonth.length > 0 ? (
                  <div className="divide-y divide-blue-100/80 overflow-hidden rounded-[20px] border border-blue-100 bg-white">
                    {documentsInMonth.map((documento) => (
                      <ArchiveRow
                        key={documento.id}
                        documento={documento}
                        empresa={companyById.get(documento.empresa_id) || null}
                        downloadingId={downloadingId}
                        onDownload={handleDownloadPdf}
                      />
                    ))}
                  </div>
                ) : (
                  <EmptyState
                    title="No hay documentos en este mes"
                    description="Intentá con otro mes o cambiá la selección de empresa."
                  />
                )}
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

function ArchiveStatCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "blue" | "emerald" | "amber" | "sky";
}) {
  const toneClasses = {
    blue: "bg-blue-700 text-white",
    emerald: "bg-emerald-600 text-white",
    amber: "bg-amber-500 text-white",
    sky: "bg-sky-600 text-white",
  } as const;

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-[0_12px_40px_rgba(15,23,42,0.06)]">
      <div className="flex items-center justify-between gap-4">
        <div
          className={`flex h-12 w-12 items-center justify-center rounded-2xl ${toneClasses[tone]}`}
        >
          <FileText className="h-5 w-5" />
        </div>
        <span className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">
          {label}
        </span>
      </div>
      <div className="mt-5">
        <span className="block text-3xl font-black tracking-tight text-slate-900">
          {value}
        </span>
        <span className="mt-2 block text-xs font-medium text-slate-500">
          Documentos visibles en la vista actual
        </span>
      </div>
    </div>
  );
}

function CompanyButton({
  active,
  label,
  sublabel,
  onClick,
}: {
  active: boolean;
  label: string;
  sublabel: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full rounded-2xl px-4 py-3 text-left transition-colors ${
        active
          ? "bg-blue-50 text-blue-800 ring-1 ring-blue-100"
          : "hover:bg-slate-50"
      }`}
    >
      <span className="block text-sm font-black text-slate-900">{label}</span>
      <span className="mt-1 block text-[11px] font-medium text-slate-500">
        {sublabel}
      </span>
    </button>
  );
}

function FolderCard({
  label,
  count,
  onClick,
}: {
  label: string;
  count: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-[0_10px_28px_rgba(15,23,42,0.04)] transition-all hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-[0_14px_34px_rgba(59,130,246,0.10)]"
    >
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700 transition-colors group-hover:bg-blue-100">
        <Folder className="h-6 w-6" />
      </div>
      <div className="min-w-0">
        <span className="block text-sm font-black text-slate-900 transition-colors group-hover:text-blue-800">
          {label}
        </span>
        <span className="mt-0.5 block text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">
          {count} {count === 1 ? "documento" : "documentos"}
        </span>
      </div>
    </button>
  );
}

function ArchiveRow({
  documento,
  empresa,
  downloadingId,
  onDownload,
}: {
  documento: InformeVisita;
  empresa: AdminEmpresaOption | null;
  downloadingId: string | null;
  onDownload: (documento: InformeVisita) => Promise<void>;
}) {
  const fecha = formatDate(documento.fecha_hora_visita);
  const numero = String(documento.numero_informe).padStart(6, "0");
  const isSigned = documento.estado_firma === "firmado";
  const canDownload = Boolean(documento.url_pdf_generado) || isSigned;

  return (
    <div className="flex flex-col gap-4 px-4 py-4 transition-colors hover:bg-blue-50/30 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-start gap-4">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-700 ring-1 ring-blue-100">
          <FileText className="h-5 w-5" />
        </div>

        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-black text-slate-900">
              Constancia {numero}
            </span>
            <span
              className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.16em] ${isSigned ? "border border-emerald-100 bg-emerald-50 text-emerald-700" : "border border-amber-100 bg-amber-50 text-amber-700"}`}
            >
              {getEstadoLabel(documento.estado_firma)}
            </span>
          </div>
          <p className="mt-1 line-clamp-2 text-xs text-slate-500 sm:max-w-xl">
            {documento.actividad || "Constancia de visita"}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] font-medium text-slate-500">
            <span>{empresa?.razon_social || "Empresa"}</span>
            <span>·</span>
            <span>{documento.lugar_visita || "Sin lugar informado"}</span>
            <span>·</span>
            <span>{fecha}</span>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 sm:justify-end">
        <Link
          href={`/informes/${documento.id}`}
          className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-black uppercase tracking-[0.16em] text-slate-600 transition-colors hover:border-slate-300 hover:bg-slate-50"
        >
          <ChevronRight className="h-4 w-4" />
          Detalle
        </Link>

        <button
          type="button"
          disabled={!canDownload || downloadingId === documento.id}
          onClick={() => void onDownload(documento)}
          className="inline-flex items-center gap-2 rounded-full bg-blue-700 px-4 py-2 text-xs font-black uppercase tracking-[0.16em] text-white transition-colors hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {downloadingId === documento.id ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <FileDown className="h-4 w-4" />
          )}
          Descargar
        </button>
      </div>
    </div>
  );
}

function EmptyState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-3xl border border-dashed border-blue-200 bg-white px-6 py-12 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-700">
        <Folder className="h-6 w-6" />
      </div>
      <h3 className="mt-4 text-base font-black text-slate-900">{title}</h3>
      <p className="mt-2 text-sm text-slate-500">{description}</p>
    </div>
  );
}

function ArchiveSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="flex flex-col gap-4 border-b border-slate-200/60 pb-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-3">
          <div className="h-8 w-80 rounded-xl bg-slate-200" />
          <div className="h-4 w-md rounded-xl bg-slate-200" />
        </div>
        <div className="flex gap-3">
          <div className="h-11 w-72 rounded-2xl bg-slate-200" />
          <div className="h-11 w-32 rounded-2xl bg-slate-200" />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[...Array(4)].map((_, index) => (
          <div key={index} className="h-28 rounded-3xl bg-slate-200" />
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[280px_minmax(0,1fr)]">
        <div className="h-135 rounded-[28px] bg-slate-200" />
        <div className="h-135 rounded-[28px] bg-slate-200" />
      </div>
    </div>
  );
}

function getEstadoLabel(estado: InformeVisita["estado_firma"]) {
  switch (estado) {
    case "firmado":
      return "Firmado";
    case "pendiente_dueno":
      return "Pendiente dueño";
    case "pendiente_preventor":
      return "Pendiente preventor";
    case "archivado":
      return "Archivado";
    default:
      return "Borrador";
  }
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function slugify(value: string) {
  return (
    value
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "") || "archivo_historico"
  );
}

function escapeCsv(value: string) {
  return `"${value.replace(/"/g, '""')}"`;
}

function buildCsv(
  rows: Array<{
    numero: string;
    empresa: string;
    cuit: string;
    actividad: string;
    lugar: string;
    fecha: string;
    estado: string;
    pdf: string;
  }>,
) {
  const header = [
    "Numero",
    "Empresa",
    "CUIT",
    "Actividad",
    "Lugar",
    "Fecha",
    "Estado",
    "PDF",
  ];

  const lines = [
    header,
    ...rows.map((row) => [
      row.numero,
      row.empresa,
      row.cuit,
      row.actividad,
      row.lugar,
      row.fecha,
      row.estado,
      row.pdf,
    ]),
  ].map((row) => row.map(escapeCsv).join(","));

  return `sep=,\n${lines.join("\n")}`;
}
