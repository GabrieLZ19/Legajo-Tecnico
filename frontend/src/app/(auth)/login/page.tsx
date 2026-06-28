"use client";

import React, { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import {
  ShieldCheck,
  Lock,
  User,
  Briefcase,
  Eye,
  EyeOff,
  Check,
  AlertCircle,
} from "lucide-react";

export default function LoginPage() {
  const { login, loading } = useAuth();
  const [cuit, setCuit] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!cuit || !username || !password) {
      setError("Por favor completa todos los campos.");
      return;
    }

    try {
      await login(cuit, username, password);
    } catch (err: any) {
      setError(err.message || "Error al iniciar sesión. Inténtalo de nuevo.");
    }
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-white">
      {/* Panel Izquierdo (Diseño Corporativo) */}
      <div className="hidden md:flex md:w-1/2 bg-[#050b14] text-white p-16 flex-col justify-center relative overflow-hidden">
        {/* Gráfico de curvas concéntricas de fondo (Layered Gradient Curves) */}
        <div className="absolute top-[-200px] right-[-200px] w-[900px] h-[900px] rounded-full bg-[#0a152d]/30 pointer-events-none" />
        <div className="absolute top-[-150px] right-[-150px] w-[750px] h-[750px] rounded-full bg-[#0d1e3d]/40 pointer-events-none" />
        <div className="absolute top-[-100px] right-[-100px] w-[600px] h-[600px] rounded-full bg-[#11264e]/50 pointer-events-none" />
        <div className="absolute top-[-50px] right-[-50px] w-[450px] h-[450px] rounded-full bg-[#163063]/30 pointer-events-none" />

        <div className="relative z-10 space-y-12 max-w-lg">
          {/* Logo e Identidad */}
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="h-14 w-14 rounded-xl bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-600/30">
                <ShieldCheck className="h-8 w-8 text-white" />
              </div>
              <h1 className="text-4xl font-extrabold tracking-tight">
                Legajo Técnico
              </h1>
            </div>
            <p className="text-lg text-brand-text-light font-medium leading-relaxed">
              Gestión digital de seguridad e higiene laboral.
            </p>
          </div>

          {/* Características */}
          <ul className="space-y-6">
            <li className="flex items-center gap-4">
              <div className="h-6 w-6 rounded-full bg-blue-950 border border-blue-800 flex items-center justify-center shrink-0">
                <Check className="h-3.5 w-3.5 text-blue-500 stroke-3" />
              </div>
              <span className="text-sm font-medium text-slate-200">
                Informes de visita con firma digital
              </span>
            </li>
            <li className="flex items-center gap-4">
              <div className="h-6 w-6 rounded-full bg-blue-950 border border-blue-800 flex items-center justify-center shrink-0">
                <Check className="h-3.5 w-3.5 text-blue-500 stroke-3" />
              </div>
              <span className="text-sm font-medium text-slate-200">
                Plan de acción y archivo histórico
              </span>
            </li>
            <li className="flex items-center gap-4">
              <div className="h-6 w-6 rounded-full bg-blue-950 border border-blue-800 flex items-center justify-center shrink-0">
                <Check className="h-3.5 w-3.5 text-blue-500 stroke-3" />
              </div>
              <span className="text-sm font-medium text-slate-200">
                Entrega y licitación de EPP
              </span>
            </li>
          </ul>
        </div>
      </div>

      {/* Panel Derecho (Formulario de Login) */}
      <div className="w-full md:w-1/2 flex items-center justify-center p-8 md:p-16 bg-white">
        <div className="max-w-md w-full space-y-8">
          {/* Título */}
          <div className="space-y-2">
            <h2 className="text-3xl font-extrabold text-brand-text-dark">
              Iniciar sesión
            </h2>
            <p className="text-sm text-brand-text-muted font-medium">
              Ingresá con el CUIT de tu empresa y tus credenciales.
            </p>
          </div>

          <form className="space-y-6" onSubmit={handleSubmit}>
            {error && (
              <div className="rounded-xl bg-red-50 border border-red-100 p-4 flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
                <div className="text-sm text-red-800 font-semibold">
                  {error}
                </div>
              </div>
            )}

            <div className="space-y-5">
              {/* CUIT */}
              <div className="space-y-2">
                <label
                  htmlFor="cuit"
                  className="block text-[11px] font-bold text-brand-text-muted uppercase tracking-wider"
                >
                  CUIT Empresa
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Briefcase className="h-5 w-5 text-brand-text-light" />
                  </div>
                  <input
                    id="cuit"
                    name="cuit"
                    type="text"
                    required
                    placeholder="30-12345678-9"
                    value={cuit}
                    onChange={(e) => setCuit(e.target.value)}
                    className="block w-full pl-10 pr-3 py-3 border border-brand-input-border rounded-xl bg-brand-input-bg text-brand-text-dark placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-brand-secondary/25 focus:border-brand-secondary text-sm transition-all font-medium"
                  />
                </div>
              </div>

              {/* Usuario */}
              <div className="space-y-2">
                <label
                  htmlFor="username"
                  className="block text-[11px] font-bold text-brand-text-muted uppercase tracking-wider"
                >
                  Usuario
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <User className="h-5 w-5 text-brand-text-light" />
                  </div>
                  <input
                    id="username"
                    name="username"
                    type="text"
                    required
                    placeholder="diego.luduena"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="block w-full pl-10 pr-3 py-3 border border-brand-input-border rounded-xl bg-brand-input-bg text-brand-text-dark placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-brand-secondary/25 focus:border-brand-secondary text-sm transition-all font-medium"
                  />
                </div>
              </div>

              {/* Contraseña */}
              <div className="space-y-2">
                <label
                  htmlFor="password"
                  className="block text-[11px] font-bold text-brand-text-muted uppercase tracking-wider"
                >
                  Contraseña
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Lock className="h-5 w-5 text-brand-text-light" />
                  </div>
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    required
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="block w-full pl-10 pr-10 py-3 border border-brand-input-border rounded-xl bg-brand-input-bg text-brand-text-dark placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-brand-secondary/25 focus:border-brand-secondary text-sm transition-all font-medium"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-brand-text-light hover:text-brand-text-dark cursor-pointer"
                  >
                    {showPassword ? (
                      <EyeOff className="h-5 w-5" />
                    ) : (
                      <Eye className="h-5 w-5" />
                    )}
                  </button>
                </div>
              </div>
            </div>

            <div className="space-y-4 pt-2">
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 px-4 border border-transparent text-sm font-bold rounded-xl text-white bg-brand-primary hover:bg-brand-primary/95 shadow-md shadow-brand-primary/20 hover:shadow-lg focus:outline-hidden transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer text-center"
              >
                {loading ? "Ingresando..." : "Ingresar"}
              </button>

              <div className="text-center">
                <a
                  href="#"
                  className="text-xs font-bold text-brand-secondary hover:underline transition-all"
                >
                  ¿Olvidaste tu contraseña?
                </a>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
