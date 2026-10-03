"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  FileText,
  CheckSquare,
  HardHat,
  GraduationCap,
  Ruler,
  Shield,
  ClipboardCheck,
  AlertTriangle,
  LayoutGrid,
  X,
  ChevronRight,
  type LucideIcon,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import {
  getVisibleAppNavModules,
  type AppModuleKey,
  type AppNavModule,
} from "@/lib/moduleAccess";

const MODULE_ICONS: Record<AppModuleKey, LucideIcon> = {
  informes: FileText,
  planAccion: CheckSquare,
  epp: HardHat,
  capacitaciones: GraduationCap,
  mediciones: Ruler,
  art: Shield,
  checklists: ClipboardCheck,
  denunciaEventos: AlertTriangle,
};

/** Prioridad en la barra (máx. 3). El resto va a «Más». */
const PRIMARY_KEYS: AppModuleKey[] = [
  "informes",
  "planAccion",
  "capacitaciones",
];

type NavGroup = {
  title: string;
  keys: AppModuleKey[];
};

const MORE_GROUPS: NavGroup[] = [
  {
    title: "Operaciones",
    keys: ["epp", "checklists", "capacitaciones"],
  },
  {
    title: "Cumplimiento",
    keys: ["mediciones", "art", "planAccion", "informes"],
  },
  {
    title: "Eventos",
    keys: ["denunciaEventos"],
  },
];

type NavItem = {
  name: string;
  href: string;
  icon: LucideIcon;
  key?: AppModuleKey;
};

function splitNavModules(modules: AppNavModule[]) {
  const byKey = new Map(modules.map((m) => [m.key, m]));
  const primary: AppNavModule[] = [];
  const used = new Set<AppModuleKey>();

  for (const key of PRIMARY_KEYS) {
    const mod = byKey.get(key);
    if (mod) {
      primary.push(mod);
      used.add(key);
    }
  }

  const overflow = modules.filter((m) => !used.has(m.key));

  // Completar hasta 3 slots si faltan módulos prioritarios
  while (primary.length < 3 && overflow.length > 0) {
    const next = overflow.shift()!;
    primary.push(next);
    used.add(next.key);
  }

  return { primary, more: overflow };
}

function isHrefActive(pathname: string | null, href: string) {
  if (!pathname) return false;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export const BottomNav: React.FC = () => {
  const pathname = usePathname();
  const { user } = useAuth();
  const [moreOpen, setMoreOpen] = useState(false);

  const visibleModules = useMemo(
    () => getVisibleAppNavModules(user),
    [user],
  );

  const { primary, more } = useMemo(
    () => splitNavModules(visibleModules),
    [visibleModules],
  );

  const primaryItems: NavItem[] = useMemo(
    () => [
      { name: "Inicio", href: "/dashboard", icon: Home },
      ...primary.map((mod) => ({
        name: mod.shortLabel,
        href: mod.href,
        icon: MODULE_ICONS[mod.key],
        key: mod.key,
      })),
    ],
    [primary],
  );

  const moreActive = more.some((mod) => isHrefActive(pathname, mod.href));
  const showMore = more.length > 0;

  useEffect(() => {
    setMoreOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!moreOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [moreOpen]);

  const groupedMore = useMemo(() => {
    const remaining = new Map(more.map((m) => [m.key, m]));
    const groups: { title: string; items: AppNavModule[] }[] = [];

    for (const group of MORE_GROUPS) {
      const items: AppNavModule[] = [];
      for (const key of group.keys) {
        const mod = remaining.get(key);
        if (mod) {
          items.push(mod);
          remaining.delete(key);
        }
      }
      if (items.length > 0) {
        groups.push({ title: group.title, items });
      }
    }

    // Cualquier módulo no tipificado en grupos
    if (remaining.size > 0) {
      groups.push({
        title: "Otros",
        items: Array.from(remaining.values()),
      });
    }

    return groups;
  }, [more]);

  return (
    <>
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 shadow-lg md:hidden z-50 pb-[env(safe-area-inset-bottom)]">
        <div className="flex justify-around items-stretch h-16 px-1">
          {primaryItems.map((item) => {
            const isActive = isHrefActive(pathname, item.href);
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex flex-col items-center justify-center flex-1 min-w-0 h-full text-[11px] font-semibold transition-colors ${
                  isActive
                    ? "text-blue-600"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                <Icon
                  className={`h-5 w-5 mb-0.5 shrink-0 ${isActive ? "stroke-[2.25]" : ""}`}
                />
                <span className="truncate max-w-full px-0.5">{item.name}</span>
              </Link>
            );
          })}

          {showMore ? (
            <button
              type="button"
              onClick={() => setMoreOpen(true)}
              aria-expanded={moreOpen}
              aria-haspopup="dialog"
              className={`flex flex-col items-center justify-center flex-1 min-w-0 h-full text-[11px] font-semibold transition-colors ${
                moreActive || moreOpen
                  ? "text-blue-600"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              <LayoutGrid
                className={`h-5 w-5 mb-0.5 shrink-0 ${
                  moreActive || moreOpen ? "stroke-[2.25]" : ""
                }`}
              />
              <span>Más</span>
            </button>
          ) : null}
        </div>
      </nav>

      {moreOpen ? (
        <div className="fixed inset-0 z-[80] flex items-end md:hidden">
          <button
            type="button"
            aria-label="Cerrar menú"
            className="absolute inset-0 bg-slate-950/45 backdrop-blur-[2px]"
            onClick={() => setMoreOpen(false)}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="bottom-nav-more-title"
            className="relative z-[81] w-full max-h-[78vh] rounded-t-3xl bg-white shadow-2xl border border-slate-200 border-b-0 overflow-hidden animate-fadeIn flex flex-col"
          >
            <div className="flex justify-center pt-3 pb-1">
              <span className="h-1 w-10 rounded-full bg-slate-200" />
            </div>
            <div className="flex items-center justify-between px-5 pb-3 border-b border-slate-100">
              <div>
                <h2
                  id="bottom-nav-more-title"
                  className="text-base font-black text-slate-900"
                >
                  Más módulos
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Accesos agrupados por tipo
                </p>
              </div>
              <button
                type="button"
                onClick={() => setMoreOpen(false)}
                className="p-2 rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
                aria-label="Cerrar"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="overflow-y-auto px-4 py-4 space-y-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
              {groupedMore.map((group) => (
                <section key={group.title}>
                  <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2 px-1">
                    {group.title}
                  </h3>
                  <ul className="rounded-2xl border border-slate-200 bg-slate-50/80 overflow-hidden divide-y divide-slate-200">
                    {group.items.map((mod) => {
                      const Icon = MODULE_ICONS[mod.key];
                      const active = isHrefActive(pathname, mod.href);
                      return (
                        <li key={mod.key}>
                          <Link
                            href={mod.href}
                            onClick={() => setMoreOpen(false)}
                            className={`flex items-center gap-3 px-3.5 py-3.5 transition-colors ${
                              active
                                ? "bg-blue-50"
                                : "hover:bg-white active:bg-white"
                            }`}
                          >
                            <span
                              className={`flex h-10 w-10 items-center justify-center rounded-xl shrink-0 ${
                                active
                                  ? "bg-blue-600 text-white"
                                  : "bg-white text-slate-600 border border-slate-200"
                              }`}
                            >
                              <Icon className="h-5 w-5" />
                            </span>
                            <span
                              className={`min-w-0 flex-1 text-sm font-bold ${
                                active ? "text-blue-700" : "text-slate-900"
                              }`}
                            >
                              {mod.label}
                            </span>
                            <ChevronRight
                              className={`h-4 w-4 shrink-0 ${
                                active ? "text-blue-500" : "text-slate-300"
                              }`}
                            />
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
};

export default BottomNav;
