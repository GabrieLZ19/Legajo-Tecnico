"use client";

import React, { createContext, useCallback, useContext, useRef, useState } from "react";
import { CheckCircle2, AlertTriangle, XCircle, Info } from "lucide-react";

type AlertType = "success" | "warning" | "error" | "info";

interface AlertState {
  isOpen: boolean;
  type: AlertType;
  title: string;
  message: string;
}

interface ConfirmOptions {
  type?: AlertType;
  confirmLabel?: string;
  cancelLabel?: string;
}

interface ConfirmState {
  isOpen: boolean;
  type: AlertType;
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
}

interface AlertContextType {
  showAlert: (type: AlertType, title: string, message: string) => void;
  hideAlert: () => void;
  showConfirm: (
    title: string,
    message: string,
    options?: ConfirmOptions,
  ) => Promise<boolean>;
}

const AlertContext = createContext<AlertContextType | undefined>(undefined);

const iconWrapClass = (type: AlertType) => {
  if (type === "success") return "bg-emerald-50 text-emerald-600";
  if (type === "error") return "bg-red-50 text-red-600";
  if (type === "warning") return "bg-amber-50 text-amber-600";
  return "bg-blue-50 text-blue-600";
};

const primaryBtnClass = (type: AlertType) => {
  if (type === "success") return "bg-emerald-600 hover:bg-emerald-700";
  if (type === "error") return "bg-red-600 hover:bg-red-700";
  if (type === "warning") return "bg-amber-500 hover:bg-amber-600";
  return "bg-blue-600 hover:bg-blue-700";
};

function AlertIcon({ type }: { type: AlertType }) {
  if (type === "success") return <CheckCircle2 className="h-6 w-6" />;
  if (type === "error") return <XCircle className="h-6 w-6" />;
  if (type === "warning") return <AlertTriangle className="h-6 w-6" />;
  return <Info className="h-6 w-6" />;
}

export function AlertProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AlertState>({
    isOpen: false,
    type: "info",
    title: "",
    message: "",
  });

  const [confirmState, setConfirmState] = useState<ConfirmState>({
    isOpen: false,
    type: "warning",
    title: "",
    message: "",
    confirmLabel: "Confirmar",
    cancelLabel: "Cancelar",
  });

  const confirmResolverRef = useRef<((value: boolean) => void) | null>(null);

  const showAlert = (type: AlertType, title: string, message: string) => {
    setState({ isOpen: true, type, title, message });
  };

  const hideAlert = () => {
    setState((prev) => ({ ...prev, isOpen: false }));
  };

  const resolveConfirm = useCallback((value: boolean) => {
    confirmResolverRef.current?.(value);
    confirmResolverRef.current = null;
    setConfirmState((prev) => ({ ...prev, isOpen: false }));
  }, []);

  const showConfirm = useCallback(
    (title: string, message: string, options?: ConfirmOptions) => {
      if (confirmResolverRef.current) {
        confirmResolverRef.current(false);
        confirmResolverRef.current = null;
      }

      return new Promise<boolean>((resolve) => {
        confirmResolverRef.current = resolve;
        setConfirmState({
          isOpen: true,
          type: options?.type || "warning",
          title,
          message,
          confirmLabel: options?.confirmLabel || "Confirmar",
          cancelLabel: options?.cancelLabel || "Cancelar",
        });
      });
    },
    [],
  );

  return (
    <AlertContext.Provider value={{ showAlert, hideAlert, showConfirm }}>
      {children}
      {state.isOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-[80] animate-fadeIn p-4 select-none">
          <div className="bg-white rounded-2xl p-6 w-full max-w-xs shadow-xl border border-slate-100 space-y-4 relative overflow-hidden text-center flex flex-col items-center">
            <div
              className={`h-12 w-12 rounded-2xl flex items-center justify-center shrink-0 ${iconWrapClass(state.type)}`}
            >
              <AlertIcon type={state.type} />
            </div>

            <div className="space-y-1.5 w-full">
              <h3 className="font-black text-slate-900 text-sm">{state.title}</h3>
              <p className="text-xs text-slate-500 font-bold leading-relaxed">
                {state.message}
              </p>
            </div>

            <div className="w-full pt-1">
              <button
                type="button"
                onClick={hideAlert}
                className={`w-full py-2.5 px-4 text-xs font-black rounded-xl cursor-pointer text-white transition-colors shadow-xs ${primaryBtnClass(state.type)}`}
              >
                Aceptar
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmState.isOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-[85] animate-fadeIn p-4 select-none">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl border border-slate-100 space-y-4 relative overflow-hidden text-center flex flex-col items-center">
            <div
              className={`h-12 w-12 rounded-2xl flex items-center justify-center shrink-0 ${iconWrapClass(confirmState.type)}`}
            >
              <AlertIcon type={confirmState.type} />
            </div>

            <div className="space-y-1.5 w-full">
              <h3 className="font-black text-slate-900 text-sm">
                {confirmState.title}
              </h3>
              <p className="text-xs text-slate-500 font-bold leading-relaxed">
                {confirmState.message}
              </p>
            </div>

            <div className="w-full pt-1 flex gap-2">
              <button
                type="button"
                onClick={() => resolveConfirm(false)}
                className="flex-1 py-2.5 px-4 text-xs font-black rounded-xl cursor-pointer border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
              >
                {confirmState.cancelLabel}
              </button>
              <button
                type="button"
                onClick={() => resolveConfirm(true)}
                className={`flex-1 py-2.5 px-4 text-xs font-black rounded-xl cursor-pointer text-white transition-colors shadow-xs ${primaryBtnClass(confirmState.type)}`}
              >
                {confirmState.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </AlertContext.Provider>
  );
}

export function useAlert() {
  const context = useContext(AlertContext);
  if (!context) {
    throw new Error("useAlert must be used within an AlertProvider");
  }
  return context;
}
