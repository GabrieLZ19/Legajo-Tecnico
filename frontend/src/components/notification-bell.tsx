"use client";

import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { api } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { Bell, X, Info, AlertTriangle, AlertCircle, CheckCheck } from "lucide-react";

type NotificationBellProps = {
  /** Dirección del panel. En footers de sidebar usá "top". */
  placement?: "top" | "bottom";
  /** Estilo del botón según fondo claro u oscuro. */
  variant?: "light" | "dark";
};

type NotificacionItem = {
  id: string;
  tipo: string;
  titulo: string;
  mensaje: string;
  created_at: string;
  leida?: boolean;
};

type PanelCoords = {
  top?: number;
  bottom?: number;
  left: number;
  width: number;
};

const PANEL_WIDTH = 320;
const PANEL_GAP = 10;
const EXIT_MS = 150;
const POLL_MS = 20_000;
const POLL_OPEN_MS = 8_000;

export function NotificationBell({
  placement = "bottom",
  variant = "light",
}: NotificationBellProps) {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<NotificacionItem[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);
  const [coords, setCoords] = useState<PanelCoords | null>(null);
  const [mounted, setMounted] = useState(false);

  const buttonRef = useRef<HTMLButtonElement>(null);
  const closeTimerRef = useRef<number | null>(null);

  const unreadCount = notifications.filter((n) => !n.leida).length;

  const fetchNotifications = useCallback(async () => {
    if (!user) return;
    try {
      const res = await api.get("/admin/notificaciones/mias");
      setNotifications(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error("Error fetching notifications:", err);
    }
  }, [user]);

  const updateCoords = useCallback(() => {
    const button = buttonRef.current;
    if (!button) return;

    const rect = button.getBoundingClientRect();
    const width = Math.min(PANEL_WIDTH, window.innerWidth - 16);
    let left = rect.right - width;
    left = Math.max(8, Math.min(left, window.innerWidth - width - 8));

    if (placement === "top") {
      setCoords({
        bottom: window.innerHeight - rect.top + PANEL_GAP,
        left,
        width,
      });
      return;
    }

    setCoords({
      top: rect.bottom + PANEL_GAP,
      left,
      width,
    });
  }, [placement]);

  const openPanel = useCallback(() => {
    if (closeTimerRef.current) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
    updateCoords();
    setIsLeaving(false);
    setIsVisible(true);
    setIsOpen(true);
    void fetchNotifications();
  }, [fetchNotifications, updateCoords]);

  const closePanel = useCallback(() => {
    if (!isOpen || isLeaving) return;
    setIsLeaving(true);

    const hadUnread = notifications.some((n) => !n.leida);
    if (hadUnread) {
      void api
        .post("/admin/notificaciones/mias/leer-todas")
        .then(() => {
          setNotifications((prev) => prev.map((n) => ({ ...n, leida: true })));
        })
        .catch((err) => {
          console.error("Error marking notifications as read:", err);
        });
    }

    closeTimerRef.current = window.setTimeout(() => {
      setIsOpen(false);
      setIsVisible(false);
      setIsLeaving(false);
      closeTimerRef.current = null;
    }, EXIT_MS);
  }, [isLeaving, isOpen, notifications]);

  const togglePanel = () => {
    if (isOpen && !isLeaving) {
      closePanel();
      return;
    }
    openPanel();
  };

  useEffect(() => {
    setMounted(true);
    return () => {
      if (closeTimerRef.current) window.clearTimeout(closeTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!user) return;

    void fetchNotifications();

    const intervalMs = isOpen ? POLL_OPEN_MS : POLL_MS;
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void fetchNotifications();
      }
    }, intervalMs);

    const onFocus = () => void fetchNotifications();
    window.addEventListener("focus", onFocus);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", onFocus);
    };
  }, [user, isOpen, fetchNotifications]);

  useLayoutEffect(() => {
    if (!isOpen) return;
    updateCoords();

    const onReposition = () => updateCoords();
    window.addEventListener("resize", onReposition);
    window.addEventListener("scroll", onReposition, true);

    return () => {
      window.removeEventListener("resize", onReposition);
      window.removeEventListener("scroll", onReposition, true);
    };
  }, [isOpen, updateCoords]);

  useEffect(() => {
    if (!isOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closePanel();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen, closePanel]);

  const getIcon = (tipo: string) => {
    switch (tipo) {
      case "warning":
        return <AlertTriangle className="h-4 w-4 text-amber-600" />;
      case "error":
        return <AlertCircle className="h-4 w-4 text-rose-600" />;
      default:
        return <Info className="h-4 w-4 text-blue-600" />;
    }
  };

  const getBg = (tipo: string) => {
    switch (tipo) {
      case "warning":
        return "bg-amber-50";
      case "error":
        return "bg-rose-50";
      default:
        return "bg-blue-50";
    }
  };

  const buttonClass =
    variant === "dark"
      ? "relative rounded-full p-2 transition-all cursor-pointer text-brand-text-light hover:text-white hover:bg-slate-900/60"
      : "relative rounded-full p-2 transition-all cursor-pointer text-slate-400 hover:text-blue-600 hover:bg-slate-100";

  const panel = isVisible && coords && mounted
    ? createPortal(
        <>
          <div
            className={`fixed inset-0 z-[80] bg-slate-950/10 notif-backdrop${isLeaving ? " is-leaving" : ""}`}
            aria-hidden
            onClick={closePanel}
          />
          <div
            role="dialog"
            aria-label="Notificaciones"
            className={`fixed z-[90] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_20px_50px_-12px_rgba(15,23,42,0.35)] ${
              placement === "top" ? "notif-panel-top" : "notif-panel-bottom"
            }${isLeaving ? " is-leaving" : ""}`}
            style={{
              top: coords.top,
              bottom: coords.bottom,
              left: coords.left,
              width: coords.width,
            }}
          >
            <div className="flex items-center justify-between gap-3 border-b border-slate-100 bg-slate-50/80 px-4 py-3">
              <div className="min-w-0">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
                  Notificaciones
                </p>
                <p className="mt-0.5 text-xs font-semibold text-slate-500">
                  {unreadCount > 0
                    ? `${unreadCount} sin leer`
                    : "Estás al día"}
                </p>
              </div>
              <button
                type="button"
                onClick={closePanel}
                className="rounded-full p-1.5 text-slate-400 transition-colors hover:bg-white hover:text-slate-600 cursor-pointer"
                aria-label="Cerrar"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="max-h-[min(22rem,calc(100vh-8rem))] overflow-y-auto">
              {notifications.length > 0 ? (
                notifications.map((n) => (
                  <div
                    key={n.id}
                    className={`border-b border-slate-50 p-4 transition-colors last:border-b-0 ${
                      n.leida ? "bg-white" : "bg-blue-50/40"
                    }`}
                  >
                    <div className="flex gap-3">
                      <div
                        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${getBg(n.tipo)}`}
                      >
                        {getIcon(n.tipo)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-bold leading-tight text-slate-900">
                            {n.titulo}
                          </p>
                          {!n.leida && (
                            <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-blue-500" />
                          )}
                        </div>
                        <p className="mt-1 text-xs leading-relaxed text-slate-500">
                          {n.mensaje}
                        </p>
                        <p className="mt-2 text-[10px] font-bold uppercase tracking-wide text-slate-300">
                          {new Date(n.created_at).toLocaleString("es-AR", {
                            day: "2-digit",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="flex flex-col items-center gap-2 px-6 py-10 text-center">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-50 text-slate-300">
                    <CheckCheck className="h-5 w-5" />
                  </div>
                  <p className="text-sm font-bold text-slate-400">
                    No hay avisos nuevos
                  </p>
                  <p className="text-xs text-slate-300">
                    Cuando el admin envíe un aviso, aparece acá.
                  </p>
                </div>
              )}
            </div>
          </div>
        </>,
        document.body,
      )
    : null;

  return (
    <div className="relative shrink-0">
      <button
        ref={buttonRef}
        type="button"
        aria-label="Notificaciones"
        aria-expanded={isOpen}
        onClick={togglePanel}
        className={buttonClass}
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute top-1.5 right-1.5 flex h-4 min-w-[16px] items-center justify-center rounded-full border-2 border-white bg-rose-500 px-1 text-[10px] font-black text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>
      {panel}
    </div>
  );
}
