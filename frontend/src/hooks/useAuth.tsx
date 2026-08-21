"use client";

import React, { createContext, useContext, useState, useLayoutEffect } from "react";
import Cookies from "js-cookie";
import { api } from "@/lib/api";
import { Perfil, Empresa } from "@/types";
import { useRouter } from "next/navigation";

interface AuthContextType {
  user: Perfil | null;
  empresa: Empresa | null;
  loading: boolean;
  login: (cuit: string, username: string, pass: string) => Promise<void>;
  loginAdmin: (email: string, pass: string) => Promise<void>;
  logout: () => void;
  cambiarEmpresaContexto: (empresa: Empresa) => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const COOKIE_OPTS = { expires: 7, secure: true, sameSite: "lax" as const };

function readStoredProfile(): { user: Perfil | null; empresa: Empresa | null } {
  if (typeof window === "undefined") {
    return { user: null, empresa: null };
  }
  try {
    const savedPerfil = Cookies.get("perfil");
    const savedEmpresa = Cookies.get("empresa");
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
  // Cookie liviana: el perfil completo puede superar el límite ~4KB del browser
  const slim = {
    id: perfil.id,
    nombre_completo: perfil.nombre_completo,
    username: perfil.username,
    rol: perfil.rol,
    empresa_id: perfil.empresa_id,
    consultora_id: perfil.consultora_id,
    activo: perfil.activo,
    permisos_personalizados: perfil.permisos_personalizados ?? null,
  };
  Cookies.set("perfil", JSON.stringify(slim), COOKIE_OPTS);
  Cookies.set("lt_session", "1", COOKIE_OPTS);
  if (empresa) {
    Cookies.set("empresa", JSON.stringify(empresa), COOKIE_OPTS);
  }
}

function clearClientSession() {
  Cookies.remove("token");
  Cookies.remove("perfil");
  Cookies.remove("empresa");
  Cookies.remove("lt_session");
}

function postLoginRedirect(path: string) {
  // Navegación full para evitar races de soft-nav + cookies recién seteadas
  if (typeof window !== "undefined") {
    window.location.assign(path);
    return;
  }
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<Perfil | null>(null);
  const [empresa, setEmpresa] = useState<Empresa | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const applySession = (perfil: Perfil, emp?: Empresa | null) => {
    persistProfile(perfil, emp);
    setUser(perfil);
    if (emp !== undefined) {
      setEmpresa(emp);
    }
  };

  const refreshUser = async () => {
    const { data } = await api.get("/auth/me");
    const perfil = data.user as Perfil;
    const stored = readStoredProfile();
    applySession(perfil, stored.empresa);
  };

  useLayoutEffect(() => {
    let cancelled = false;
    const path =
      typeof window !== "undefined" ? window.location.pathname : "";
    const isLoginPage = path.includes("/login");

    const restore = async () => {
      if (isLoginPage) {
        // No borrar cookies aquí: un clear al montar login rompe el post-login
        // cuando hay redirect de vuelta. Solo no hidratar UI desde perfil stale.
        setUser(null);
        setEmpresa(null);
        setLoading(false);
        return;
      }
      try {
        const { data } = await api.get("/auth/me");
        if (cancelled) return;
        const stored = readStoredProfile();
        applySession(data.user as Perfil, stored.empresa);
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

    const onFocus = () => {
      if (isLoginPage) return;
      void api
        .get("/auth/me")
        .then(({ data }) => {
          if (cancelled) return;
          const stored = readStoredProfile();
          applySession(data.user as Perfil, stored.empresa);
        })
        .catch(() => {
          if (cancelled) return;
          clearClientSession();
          setUser(null);
          setEmpresa(null);
        });
    };
    window.addEventListener("focus", onFocus);

    return () => {
      cancelled = true;
      window.removeEventListener("focus", onFocus);
    };
  }, []);

  const login = async (cuit: string, username: string, pass: string) => {
    try {
      const response = await api.post("/auth/login", {
        cuit,
        username,
        password: pass,
      });
      const { perfil, empresa: empData } = response.data;
      Cookies.remove("token");
      applySession(perfil, empData ?? null);
      const next =
        typeof window !== "undefined"
          ? new URLSearchParams(window.location.search).get("next")
          : null;
      const dest = next && next.startsWith("/") ? next : "/dashboard";
      postLoginRedirect(dest);
    } catch (error: unknown) {
      const message =
        error && typeof error === "object" && "response" in error
          ? (error as { response?: { data?: { error?: string } } }).response
              ?.data?.error
          : undefined;
      throw new Error(message || "Error al iniciar sesión");
    }
  };

  const loginAdmin = async (email: string, pass: string) => {
    try {
      const response = await api.post("/auth/login-admin", {
        email,
        password: pass,
      });
      const { perfil } = response.data;
      Cookies.remove("token");
      persistProfile(perfil);
      Cookies.remove("empresa");
      setEmpresa(null);
      setUser(perfil);
      const next =
        typeof window !== "undefined"
          ? new URLSearchParams(window.location.search).get("next")
          : null;
      let dest = "/dashboard";
      if (next && next.startsWith("/")) {
        dest = next;
      } else if (perfil.rol === "ente_regulador") {
        dest = "/ente/dashboard";
      } else if (perfil.rol === "admin") {
        dest = "/admin/dashboard";
      }
      postLoginRedirect(dest);
    } catch (error: unknown) {
      const message =
        error && typeof error === "object" && "response" in error
          ? (error as { response?: { data?: { error?: string } } }).response
              ?.data?.error
          : undefined;
      throw new Error(
        message || "Error al iniciar sesión como administrador",
      );
    }
  };

  const logout = () => {
    const wasAdmin = user?.rol === "admin" || user?.rol === "ente_regulador";
    void api.post("/auth/logout").catch(() => undefined);
    clearClientSession();
    setUser(null);
    setEmpresa(null);
    router.push(wasAdmin ? "/login-admin" : "/login");
  };

  const cambiarEmpresaContexto = (nuevaEmpresa: Empresa) => {
    Cookies.set("empresa", JSON.stringify(nuevaEmpresa), COOKIE_OPTS);
    setEmpresa(nuevaEmpresa);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        empresa,
        loading,
        login,
        loginAdmin,
        logout,
        cambiarEmpresaContexto,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth debe ser usado dentro de un AuthProvider");
  }
  return context;
};

export const getMisEmpresas = async () => {
  const { data } = await api.get("/auth/mis-empresas");
  return data.empresas || [];
};
