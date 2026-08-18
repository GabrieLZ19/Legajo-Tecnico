import { useEffect } from "react";
import { api } from "@/lib/api";

/** Despierta el backend (cold start) mientras el usuario completa el login. */
export function useApiWarmup() {
  useEffect(() => {
    void api.get("/health").catch(() => undefined);
  }, []);
}
