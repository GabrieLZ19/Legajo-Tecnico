import { useEffect } from "react";
import { warmupApi } from "@/lib/apiResilience";

/** Despierta el backend (cold start) mientras el usuario completa el login. */
export function useApiWarmup() {
  useEffect(() => {
    void warmupApi();
  }, []);
}
