'use client';

import React, { createContext, useContext, useState, useLayoutEffect } from 'react';
import Cookies from 'js-cookie';
import { api } from '@/lib/api';
import { Perfil, Empresa } from '@/types';
import { useRouter } from 'next/navigation';

interface AuthContextType {
  user: Perfil | null;
  empresa: Empresa | null;
  loading: boolean;
  login: (cuit: string, username: string, pass: string) => Promise<void>;
  loginAdmin: (email: string, pass: string) => Promise<void>;
  logout: () => void;
  cambiarEmpresaContexto: (empresa: Empresa) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const COOKIE_OPTS = { expires: 7, secure: true, sameSite: 'lax' as const };

function readStoredProfile(): { user: Perfil | null; empresa: Empresa | null } {
  if (typeof window === 'undefined') {
    return { user: null, empresa: null };
  }
  try {
    const savedPerfil = Cookies.get('perfil');
    const savedEmpresa = Cookies.get('empresa');
    if (!savedPerfil) {
      return { user: null, empresa: null };
    }
    return {
      user: JSON.parse(savedPerfil) as Perfil,
      empresa: savedEmpresa ? (JSON.parse(savedEmpresa) as Empresa) : null,
    };
  } catch {
    return { user: null, empresa: null };
  }
}

function persistProfile(perfil: Perfil, empresa?: Empresa | null) {
  Cookies.set('perfil', JSON.stringify(perfil), COOKIE_OPTS);
  if (empresa) {
    Cookies.set('empresa', JSON.stringify(empresa), COOKIE_OPTS);
  }
}

function clearClientSession() {
  Cookies.remove('token');
  Cookies.remove('perfil');
  Cookies.remove('empresa');
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<Perfil | null>(null);
  const [empresa, setEmpresa] = useState<Empresa | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useLayoutEffect(() => {
    let cancelled = false;
    const restore = async () => {
      try {
        const { data } = await api.get('/auth/me');
        if (cancelled) return;
        const stored = readStoredProfile();
        setUser(stored.user ?? data.user ?? null);
        setEmpresa(stored.empresa);
      } catch {
        if (cancelled) return;
        clearClientSession();
        setUser(null);
        setEmpresa(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void restore();
    return () => {
      cancelled = true;
    };
  }, []);

  const login = async (cuit: string, username: string, pass: string) => {
    try {
      const response = await api.post('/auth/login', { cuit, username, password: pass });
      const { perfil, empresa: empData } = response.data;
      Cookies.remove('token');
      persistProfile(perfil, empData);
      setUser(perfil);
      setEmpresa(empData ?? null);
      router.push('/dashboard');
    } catch (error: unknown) {
      const message =
        error && typeof error === 'object' && 'response' in error
          ? (error as { response?: { data?: { error?: string } } }).response?.data?.error
          : undefined;
      throw new Error(message || 'Error al iniciar sesión');
    }
  };

  const loginAdmin = async (email: string, pass: string) => {
    try {
      const response = await api.post('/auth/login-admin', { email, password: pass });
      const { perfil } = response.data;
      Cookies.remove('token');
      persistProfile(perfil);
      Cookies.remove('empresa');
      setEmpresa(null);
      setUser(perfil);
      if (perfil.rol === "ente_regulador") {
        router.push("/ente/dashboard");
      } else if (perfil.rol === "admin") {
        router.push("/admin/dashboard");
      } else {
        router.push("/dashboard");
      }
    } catch (error: unknown) {
      const message =
        error && typeof error === 'object' && 'response' in error
          ? (error as { response?: { data?: { error?: string } } }).response?.data?.error
          : undefined;
      throw new Error(message || 'Error al iniciar sesión como administrador');
    }
  };

  const logout = () => {
    void api.post('/auth/logout').catch(() => undefined);
    clearClientSession();
    setUser(null);
    setEmpresa(null);
    router.push('/login');
  };

  const cambiarEmpresaContexto = (nuevaEmpresa: Empresa) => {
    Cookies.set('empresa', JSON.stringify(nuevaEmpresa), COOKIE_OPTS);
    setEmpresa(nuevaEmpresa);
  };

  return (
    <AuthContext.Provider value={{ user, empresa, loading, login, loginAdmin, logout, cambiarEmpresaContexto }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth debe ser usado dentro de un AuthProvider');
  }
  return context;
};

export const getMisEmpresas = async () => {
  const { data } = await api.get('/auth/mis-empresas');
  return data.empresas || [];
};
