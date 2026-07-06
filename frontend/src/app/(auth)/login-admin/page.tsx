'use client';

import React, { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { ShieldCheck, Lock, Mail, Loader2 } from 'lucide-react';
import Link from 'next/link';

export default function LoginAdminPage() {
  const { loginAdmin, loading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      await loginAdmin(email, password);
    } catch (err: any) {
      setError(err.message || 'Error al iniciar sesión');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#090d16] relative overflow-hidden p-4">
      {/* Círculo de brillo/gradiente de fondo */}
      <div className="absolute w-[600px] h-[600px] rounded-full bg-[#111c3a]/40 blur-3xl pointer-events-none -top-40" />

      {/* Tarjeta de Login */}
      <div className="bg-white rounded-[32px] px-8 py-10 max-w-[420px] w-full shadow-2xl relative z-10 space-y-8">
        
        {/* Encabezado */}
        <div className="text-center space-y-3">
          <div className="h-14 w-14 rounded-2xl bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/20 mx-auto">
            <ShieldCheck className="h-7 w-7 text-white" />
          </div>
          <div className="space-y-1">
            <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">
              Panel Administrativo
            </h2>
            <p className="text-[11px] font-bold text-slate-400 tracking-wide">
              Legajo Técnico · CRM
            </p>
          </div>
        </div>

        {error && (
          <div className="bg-rose-50 border border-rose-100 text-rose-600 text-xs font-bold p-3.5 rounded-xl text-center">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Email */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-slate-450 tracking-wider uppercase">
              Email
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                <Mail className="h-4 w-4 text-blue-500" />
              </div>
              <input
                type="email"
                required
                placeholder="admin@legajotecnico.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="block w-full pl-10 pr-3 py-3.5 border border-transparent rounded-xl bg-[#f0f4f8] text-slate-800 placeholder-slate-400 focus:outline-hidden focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 text-sm transition-all font-semibold"
              />
            </div>
          </div>

          {/* Contraseña */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-slate-450 tracking-wider uppercase">
              Contraseña
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                <Lock className="h-4 w-4 text-blue-500" />
              </div>
              <input
                type="password"
                required
                placeholder="••••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="block w-full pl-10 pr-3 py-3.5 border border-transparent rounded-xl bg-[#f0f4f8] text-slate-800 placeholder-slate-400 focus:outline-hidden focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 text-sm transition-all font-semibold"
              />
            </div>
          </div>

          {/* Botón de Envío */}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 bg-[#1d3b8a] hover:bg-[#172e6c] disabled:opacity-50 text-white font-bold rounded-xl text-sm shadow-md transition-all cursor-pointer flex items-center justify-center gap-2"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              'Ingresar al panel'
            )}
          </button>
        </form>

        {/* Enlace de Navegación */}
        <div className="text-center pt-2">
          <Link
            href="/login"
            className="text-[11px] font-bold text-blue-600 hover:text-blue-800 transition-colors"
          >
            ¿Eres cliente o preventor? Iniciar sesión aquí
          </Link>
        </div>
      </div>
    </div>
  );
}
