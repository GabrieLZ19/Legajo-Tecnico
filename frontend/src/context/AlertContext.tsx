"use client";

import React, { createContext, useContext, useState } from "react";
import { CheckCircle2, AlertTriangle, XCircle, Info } from "lucide-react";

type AlertType = "success" | "warning" | "error" | "info";

interface AlertState {
  isOpen: boolean;
  type: AlertType;
  title: string;
  message: string;
}

interface AlertContextType {
  showAlert: (type: AlertType, title: string, message: string) => void;
  hideAlert: () => void;
}

const AlertContext = createContext<AlertContextType | undefined>(undefined);

export function AlertProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AlertState>({
    isOpen: false,
    type: "info",
    title: "",
    message: "",
  });

  const showAlert = (type: AlertType, title: string, message: string) => {
    setState({ isOpen: true, type, title, message });
  };

  const hideAlert = () => {
    setState((prev) => ({ ...prev, isOpen: false }));
  };

  return (
    <AlertContext.Provider value={{ showAlert, hideAlert }}>
      {children}
      {state.isOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 animate-fadeIn p-4 select-none">
          <div className="bg-white rounded-2xl p-6 w-full max-w-xs shadow-xl border border-slate-100 space-y-4 relative overflow-hidden text-center flex flex-col items-center">
            <div className={`h-12 w-12 rounded-2xl flex items-center justify-center shrink-0 ${
              state.type === "success" ? "bg-emerald-50 text-emerald-600" :
              state.type === "error" ? "bg-red-50 text-red-600" :
              state.type === "warning" ? "bg-amber-50 text-amber-600" :
              "bg-blue-50 text-blue-600"
            }`}>
              {state.type === "success" && <CheckCircle2 className="h-6 w-6" />}
              {state.type === "error" && <XCircle className="h-6 w-6" />}
              {state.type === "warning" && <AlertTriangle className="h-6 w-6" />}
              {state.type === "info" && <Info className="h-6 w-6" />}
            </div>
            
            <div className="space-y-1.5 w-full">
              <h3 className="font-black text-slate-900 text-sm">{state.title}</h3>
              <p className="text-xs text-slate-500 font-bold leading-relaxed">{state.message}</p>
            </div>

            <div className="w-full pt-1">
              <button
                type="button"
                onClick={hideAlert}
                className={`w-full py-2.5 px-4 text-xs font-black rounded-xl cursor-pointer text-white transition-colors shadow-xs ${
                  state.type === "success" ? "bg-emerald-600 hover:bg-emerald-700" :
                  state.type === "error" ? "bg-red-600 hover:bg-red-700" :
                  state.type === "warning" ? "bg-amber-500 hover:bg-amber-600" :
                  "bg-blue-600 hover:bg-blue-700"
                }`}
              >
                Aceptar
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
