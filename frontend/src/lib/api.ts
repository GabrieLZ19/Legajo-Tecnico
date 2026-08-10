import axios from 'axios';
import Cookies from 'js-cookie';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

export const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor para inyectar el token JWT de las cookies en cada petición
api.interceptors.request.use(
  (config) => {
    const token = Cookies.get('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Interceptor para manejar errores globales (como 401 No Autorizado)
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      const path =
        typeof window !== "undefined" ? window.location.pathname : "";
      const isPublicRoute =
        path.includes("/login") ||
        path.startsWith("/evaluacion") ||
        path.startsWith("/firmar");

      // No expulsar al login en flujos públicos (QR de evaluación, etc.)
      if (!isPublicRoute) {
        Cookies.remove("token");
        Cookies.remove("perfil");
        Cookies.remove("empresa");
        if (typeof window !== "undefined") {
          window.location.href = "/login";
        }
      }
    }
    return Promise.reject(error);
  }
);
