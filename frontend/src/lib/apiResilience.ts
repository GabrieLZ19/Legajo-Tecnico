import axios, { type AxiosRequestConfig } from "axios";
import { api } from "./api";

/** Render free tier puede tardar ~30–60s en despertar. */
const AUTH_TIMEOUT_MS = 45000;

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Despierta el backend antes del login (cold start en Render). */
export async function warmupApi(): Promise<void> {
  const attempts = 3;
  for (let i = 0; i < attempts; i++) {
    try {
      await api.get("/health", { timeout: AUTH_TIMEOUT_MS });
      return;
    } catch {
      if (i < attempts - 1) {
        await delay(1200 * (i + 1));
      }
    }
  }
}

export function isTransientAxiosError(error: unknown): boolean {
  if (!axios.isAxiosError(error)) return false;
  if (!error.response) return true;
  return [502, 503, 504].includes(error.response.status);
}

export function loginErrorMessage(error: unknown, fallback: string): string {
  if (axios.isAxiosError(error)) {
    const apiMsg = error.response?.data?.error;
    if (typeof apiMsg === "string" && apiMsg.length > 0) {
      return apiMsg;
    }
    if (!error.response || error.code === "ECONNABORTED") {
      return "El servidor está iniciando. Esperá unos segundos e intentá de nuevo.";
    }
    if (error.response.status >= 502 && error.response.status <= 504) {
      return "El servidor no respondió a tiempo. Intentá ingresar de nuevo.";
    }
  }
  return fallback;
}

export async function postWithTransientRetry<T = unknown>(
  url: string,
  data?: unknown,
  config?: AxiosRequestConfig,
  maxRetries = 2,
) {
  let lastError: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await api.post<T>(url, data, {
        timeout: AUTH_TIMEOUT_MS,
        ...config,
      });
    } catch (error) {
      lastError = error;
      if (!isTransientAxiosError(error) || attempt === maxRetries) {
        throw error;
      }
      await warmupApi();
      await delay(1500);
    }
  }
  throw lastError;
}
