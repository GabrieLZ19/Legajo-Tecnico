import axios from 'axios';
import Cookies from 'js-cookie';

// Preferir same-origin `/api` (rewrite en next.config) para que la cookie
// httpOnly sea first-party y funcione en Safari/iOS.
const API_URL = process.env.NEXT_PUBLIC_API_URL || '/api';

export const api = axios.create({
  baseURL: API_URL,
  timeout: 20000,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
    'X-Requested-With': 'XMLHttpRequest',
  },
});

api.interceptors.request.use(
  (config) => {
    const legacyToken = Cookies.get('token');
    if (legacyToken && !config.headers.Authorization) {
      config.headers.Authorization = `Bearer ${legacyToken}`;
    }
    if (typeof FormData !== "undefined" && config.data instanceof FormData) {
      const headers = config.headers as { delete?: (name: string) => void } & Record<string, unknown>;
      if (typeof headers.delete === "function") {
        headers.delete("Content-Type");
      } else {
        delete headers["Content-Type"];
      }
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      const path =
        typeof window !== "undefined" ? window.location.pathname : "";
      const requestUrl = String(error.config?.url || "");
      const isPublicRoute =
        path.includes("/login") ||
        path.startsWith("/evaluacion") ||
        path.startsWith("/firmar") ||
        path.startsWith("/cotizar");
      const isLogout = requestUrl.includes("/auth/logout");

      if (!isPublicRoute && !isLogout) {
        Cookies.remove("token");
        Cookies.remove("perfil");
        Cookies.remove("empresa");
        Cookies.remove("lt_session");
        if (typeof window !== "undefined") {
          const goAdmin = path.startsWith("/admin") || path.startsWith("/ente");
          window.location.href = goAdmin ? "/login-admin" : "/login";
        }
      }
    }
    return Promise.reject(error);
  }
);
