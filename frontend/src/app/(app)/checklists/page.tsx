"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  FileStack,
  History,
  Loader,
  Plus,
  QrCode,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { canWriteAppModule } from "@/lib/moduleAccess";
import { checklistsService } from "@/utils/services/checklists.service";

export default function ChecklistsHubPage() {
  const { user, empresa } = useAuth();
  const canWrite = canWriteAppModule(user, "checklists");

  const { data: equipos = [], isLoading: loadingEquipos } = useQuery({
    queryKey: ["checklists-equipos", empresa?.id],
    queryFn: () => checklistsService.listarEquipos(empresa!.id, true),
    enabled: !!empresa?.id,
  });

  const { data: inspData, isLoading: loadingInsp } = useQuery({
    queryKey: ["checklists-inspecciones", empresa?.id],
    queryFn: () =>
      checklistsService.listarInspecciones({
        empresaId: empresa!.id,
        limit: 10,
      }),
    enabled: !!empresa?.id,
  });

  const { data: plantillasEmpresa = [] } = useQuery({
    queryKey: ["checklist-plantillas-empresa", empresa?.id],
    queryFn: () =>
      checklistsService.listarPlantillas({
        ambito: "empresa",
        empresaId: empresa!.id,
      }),
    enabled: !!empresa?.id,
  });

  const inspecciones = inspData?.inspecciones || [];
  const activos = equipos.filter((e) => e.activo).length;
  const rechazadas = inspecciones.filter((i) => i.resultado === "rechazada").length;
  const observadas = inspecciones.filter((i) => i.resultado === "observada").length;
  const aprobadas = inspecciones.filter((i) => i.resultado === "aprobada").length;

  return (
    <div className="w-full space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <span className="text-sm font-semibold text-slate-500 flex items-center gap-1.5">
            <ClipboardCheck className="h-4 w-4 text-brand-primary" />
            Módulo de Checklists
          </span>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight mt-1">
            Inspección de equipos
          </h1>
          <p className="text-sm text-brand-text-muted mt-1 max-w-2xl">
            Constructor de checklists, equipos con QR, inspección móvil Bien /
            Regular / Mal, resultado automático y plan de acción.
          </p>
        </div>
        {canWrite && (
          <div className="flex flex-wrap gap-2">
            <Link
              href="/checklists/plantillas/nueva"
              className="inline-flex items-center justify-center gap-2 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 font-bold px-5 py-3 rounded-xl text-sm cursor-pointer"
            >
              <FileStack className="h-4 w-4 text-brand-primary" />
              Nueva plantilla
            </Link>
            <Link
              href="/checklists/equipos/nuevo"
              className="inline-flex items-center justify-center gap-2 bg-brand-primary hover:bg-brand-primary/95 text-white font-bold px-5 py-3 rounded-xl shadow-md shadow-blue-900/10 text-sm cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              Nuevo equipo
            </Link>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <MiniStat label="Equipos activos" value={activos} tone="info" />
        <MiniStat label="Plantillas empresa" value={plantillasEmpresa.length} tone="neutral" />
        <MiniStat label="Observadas" value={observadas} tone="warning" />
        <MiniStat label="Rechazadas" value={rechazadas} tone="danger" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <HubCard
          href="/checklists/plantillas"
          icon={FileStack}
          title="Plantillas"
          desc="Constructor por tipo de equipo, criticidad y biblioteca LT"
          tone="blue"
        />
        <HubCard
          href="/checklists/equipos"
          icon={QrCode}
          title="Equipos + QR"
          desc="Alta de equipos e identificación para inspección móvil"
          tone="orange"
        />
        <HubCard
          href="/checklists/inspecciones"
          icon={History}
          title="Historial"
          desc="Resultados, plan de acción y seguimiento por inspección"
          tone="emerald"
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <section className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-2xs">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <History className="h-5 w-5 text-brand-primary" />
              <h2 className="font-bold text-slate-900">Últimas inspecciones</h2>
            </div>
            <Link
              href="/checklists/inspecciones"
              className="text-xs font-bold text-brand-secondary hover:underline"
            >
              Ver todas
            </Link>
          </div>
          {loadingInsp ? (
            <div className="flex justify-center py-12 text-slate-400">
              <Loader className="h-5 w-5 animate-spin" />
            </div>
          ) : inspecciones.length === 0 ? (
            <EmptyBlock
              title="Sin inspecciones aún"
              hint="Creá un equipo, escaneá su QR o cargá una inspección desde la app."
              ctaHref={canWrite ? "/checklists/inspecciones/nueva" : undefined}
              ctaLabel="Nueva inspección"
            />
          ) : (
            <ul className="divide-y divide-slate-50">
              {inspecciones.map((insp) => (
                <li key={insp.id}>
                  <Link
                    href={`/checklists/inspecciones/${insp.id}`}
                    className="flex items-center justify-between gap-3 px-5 py-3.5 hover:bg-slate-50 group"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-slate-900 truncate group-hover:text-brand-secondary">
                        {insp.equipos?.nombre || "Equipo"} · {insp.plantilla_titulo}
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {new Date(insp.fecha).toLocaleString("es-AR")}
                        {insp.acciones_pendientes
                          ? ` · ${insp.acciones_pendientes} acciones pend.`
                          : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <ResultadoBadge resultado={insp.resultado} />
                      <ChevronRight className="h-4 w-4 text-slate-300" />
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-2xs">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <QrCode className="h-5 w-5 text-orange-600" />
              <h2 className="font-bold text-slate-900">Equipos</h2>
            </div>
            <Link
              href="/checklists/equipos"
              className="text-xs font-bold text-brand-secondary hover:underline"
            >
              Ver todos
            </Link>
          </div>
          {loadingEquipos ? (
            <div className="flex justify-center py-12 text-slate-400">
              <Loader className="h-5 w-5 animate-spin" />
            </div>
          ) : equipos.length === 0 ? (
            <EmptyBlock
              title="No hay equipos cargados"
              hint="Cada equipo genera un QR para inspeccionar desde el celular."
              ctaHref={canWrite ? "/checklists/equipos/nuevo" : undefined}
              ctaLabel="Alta de equipo"
            />
          ) : (
            <ul className="divide-y divide-slate-50">
              {equipos.slice(0, 8).map((eq) => (
                <li key={eq.id}>
                  <Link
                    href={`/checklists/equipos/${eq.id}`}
                    className="flex items-center justify-between px-5 py-3.5 hover:bg-slate-50 group"
                  >
                    <div>
                      <p className="text-sm font-bold text-slate-900 group-hover:text-brand-secondary">
                        {eq.nombre}
                        {!eq.activo && (
                          <span className="ml-2 text-[10px] font-bold text-slate-400 uppercase">
                            Inactivo
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-slate-500">
                        {eq.tipo_equipo}
                        {eq.ubicacion ? ` · ${eq.ubicacion}` : ""}
                      </p>
                    </div>
                    <QrCode className="h-4 w-4 text-slate-400" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-gradient-to-r from-brand-primary to-[#2563eb] text-white p-6 shadow-lg flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p className="text-sm font-bold flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4" />
            Resumen reciente
          </p>
          <p className="text-xs text-blue-100 mt-1">
            {aprobadas} aprobadas · {observadas} observadas · {rechazadas}{" "}
            rechazadas en las últimas inspecciones listadas.
          </p>
        </div>
        {canWrite && (
          <Link
            href="/checklists/inspecciones/nueva"
            className="inline-flex items-center gap-2 bg-white text-brand-primary font-bold px-4 py-2.5 rounded-xl text-sm hover:bg-blue-50"
          >
            <Plus className="h-4 w-4" />
            Nueva inspección
          </Link>
        )}
      </div>
    </div>
  );
}

function MiniStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "neutral" | "info" | "warning" | "danger";
}) {
  const map = {
    neutral: "text-brand-primary bg-blue-50 border-blue-100",
    info: "text-sky-700 bg-sky-50 border-sky-100",
    warning: "text-amber-700 bg-amber-50 border-amber-100",
    danger: "text-rose-700 bg-rose-50 border-rose-100",
  };
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs">
      <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className={`mt-2 text-2xl font-black inline-flex px-2 rounded-lg border ${map[tone]}`}>
        {value}
      </p>
    </div>
  );
}

function HubCard({
  href,
  icon: Icon,
  title,
  desc,
  tone,
}: {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  desc: string;
  tone: "blue" | "orange" | "emerald";
}) {
  const tones = {
    blue: "bg-blue-50 text-brand-primary border-blue-100",
    orange: "bg-orange-50 text-orange-600 border-orange-100",
    emerald: "bg-emerald-50 text-emerald-600 border-emerald-100",
  };
  return (
    <Link
      href={href}
      className="rounded-2xl border border-slate-200 bg-white p-5 hover:border-brand-secondary/40 hover:shadow-md transition-all group"
    >
      <div
        className={`h-11 w-11 rounded-xl border flex items-center justify-center mb-3 ${tones[tone]}`}
      >
        <Icon className="h-5 w-5" />
      </div>
      <h2 className="font-bold text-slate-900 group-hover:text-brand-secondary">
        {title}
      </h2>
      <p className="text-xs text-slate-500 mt-1 leading-relaxed">{desc}</p>
    </Link>
  );
}

function EmptyBlock({
  title,
  hint,
  ctaHref,
  ctaLabel,
}: {
  title: string;
  hint: string;
  ctaHref?: string;
  ctaLabel?: string;
}) {
  return (
    <div className="px-5 py-10 text-center">
      <AlertTriangle className="h-8 w-8 text-slate-300 mx-auto mb-3" />
      <p className="text-sm font-bold text-slate-700">{title}</p>
      <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">{hint}</p>
      {ctaHref && ctaLabel && (
        <Link
          href={ctaHref}
          className="inline-flex items-center gap-1.5 mt-4 text-sm font-bold text-brand-secondary hover:underline"
        >
          <Plus className="h-4 w-4" />
          {ctaLabel}
        </Link>
      )}
    </div>
  );
}

function ResultadoBadge({ resultado }: { resultado: string }) {
  const map: Record<string, string> = {
    aprobada: "bg-emerald-50 text-emerald-700 border-emerald-100",
    observada: "bg-amber-50 text-amber-800 border-amber-200",
    rechazada: "bg-rose-50 text-rose-700 border-rose-100",
  };
  return (
    <span
      className={`text-xs font-bold px-2 py-0.5 rounded-md border capitalize ${map[resultado] || "bg-slate-50 text-slate-600 border-slate-200"}`}
    >
      {resultado}
    </span>
  );
}
