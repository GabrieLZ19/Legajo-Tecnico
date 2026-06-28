'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import Cookies from 'js-cookie';
import { api } from '@/lib/api';
import { Perfil, Empresa } from '@/types';
import { useRouter } from 'next/navigation';

interface AuthContextType {
  user: Perfil | null;
  empresa: Empresa | null;
  loading: boolean;
  login: (cuit: string, username: string, pass: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<Perfil | null>(null);
  const [empresa, setEmpresa] = useState<Empresa | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    // Restaurar sesión desde las cookies al montar el componente
    const token = Cookies.get('token');
    const savedPerfil = Cookies.get('perfil');
    const savedEmpresa = Cookies.get('empresa');

    if (token && savedPerfil) {
      setUser(JSON.parse(savedPerfil));
      if (savedEmpresa) {
        setEmpresa(JSON.parse(savedEmpresa));
      }
    }
    setLoading(false);
  }, []);

  const login = async (cuit: string, username: string, pass: string) => {
    setLoading(true);
    try {
      const response = await api.post('/auth/login', { cuit, username, password: pass });
      const { access_token, perfil, empresa: empData } = response.data;

      // Guardar en cookies (expira en 7 días)
      Cookies.set('token', access_token, { expires: 7, secure: true });
      Cookies.set('perfil', JSON.stringify(perfil), { expires: 7, secure: true });
      if (empData) {
        Cookies.set('empresa', JSON.stringify(empData), { expires: 7, secure: true });
        setEmpresa(empData);
      }

      setUser(perfil);
      router.push('/dashboard');
    } catch (error: any) {
      throw new Error(error.response?.data?.error || 'Error al iniciar sesión');
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    Cookies.remove('token');
    Cookies.remove('perfil');
    Cookies.remove('empresa');
    setUser(null);
    setEmpresa(null);
    router.push('/login');
  };

  return (
    <AuthContext.Provider value={{ user, empresa, loading, login, logout }}>
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
