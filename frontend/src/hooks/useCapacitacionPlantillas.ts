import { useState, useCallback } from "react";
import { api } from "@/lib/api";
import {
  AmbitoCapacitacionPlantilla,
  CapacitacionPlantilla,
} from "@/types";

export interface PreguntaPlantillaForm {
  pregunta: string;
  opciones: string[];
  respuesta_correcta: number | number[];
  es_multiple?: boolean;
}

function mapPreguntasPayload(preguntas: PreguntaPlantillaForm[]) {
  return preguntas.map((p) => ({
    pregunta: p.pregunta,
    opciones: p.opciones,
    respuesta_correcta: Array.isArray(p.respuesta_correcta)
      ? JSON.stringify(p.respuesta_correcta)
      : String(p.respuesta_correcta),
  }));
}

export function mapPlantillaPreguntasToForm(
  preguntas: Array<{
    enunciado?: string;
    pregunta?: string;
    opciones: string[];
    respuesta_correcta: string | number | number[];
  }>,
): PreguntaPlantillaForm[] {
  return preguntas.map((p) => {
    const raw = p.respuesta_correcta;
    const esMult =
      typeof raw === "string" && raw.trim().startsWith("[");
    let resp: number | number[];
    try {
      resp = esMult
        ? (JSON.parse(String(raw)) as number[])
        : Number(raw);
    } catch {
      resp = Number(raw) || 0;
    }
    return {
      pregunta: p.pregunta || p.enunciado || "",
      opciones: p.opciones || ["", ""],
      respuesta_correcta: resp,
      es_multiple: esMult,
    };
  });
}

export function useCapacitacionPlantillas() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const listarPlantillas = useCallback(
    async (ambito: AmbitoCapacitacionPlantilla, empresaId?: string) => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({ ambito });
        if (ambito === "empresa" && empresaId) {
          params.set("empresa_id", empresaId);
        }
        const { data } = await api.get(
          `/capacitacion-plantillas?${params.toString()}`,
        );
        return (data.plantillas || []) as CapacitacionPlantilla[];
      } catch (err: any) {
        setError(
          err.response?.data?.error || "Error al cargar plantillas",
        );
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  const getPlantillaDetalle = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.get(`/capacitacion-plantillas/${id}`);
      return data as CapacitacionPlantilla;
    } catch (err: any) {
      setError(err.response?.data?.error || "Error al cargar plantilla");
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const crearPlantilla = useCallback(
    async (payload: {
      ambito: AmbitoCapacitacionPlantilla;
      empresa_id?: string;
      titulo: string;
      temario?: string;
      preguntas?: PreguntaPlantillaForm[];
    }) => {
      setLoading(true);
      setError(null);
      try {
        const { data } = await api.post("/capacitacion-plantillas", {
          ambito: payload.ambito,
          empresa_id: payload.empresa_id,
          titulo: payload.titulo,
          temario: payload.temario,
          preguntas: payload.preguntas
            ? mapPreguntasPayload(payload.preguntas)
            : [],
        });
        return data as CapacitacionPlantilla;
      } catch (err: any) {
        setError(
          err.response?.data?.error || "Error al crear la plantilla",
        );
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  const actualizarPlantilla = useCallback(
    async (
      id: string,
      payload: {
        titulo: string;
        temario?: string;
        preguntas?: PreguntaPlantillaForm[];
      },
    ) => {
      setLoading(true);
      setError(null);
      try {
        const { data } = await api.put(`/capacitacion-plantillas/${id}`, {
          titulo: payload.titulo,
          temario: payload.temario,
          preguntas: payload.preguntas
            ? mapPreguntasPayload(payload.preguntas)
            : [],
        });
        return data as CapacitacionPlantilla;
      } catch (err: any) {
        setError(
          err.response?.data?.error || "Error al actualizar la plantilla",
        );
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  const eliminarPlantilla = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.delete(`/capacitacion-plantillas/${id}`);
      return data;
    } catch (err: any) {
      setError(
        err.response?.data?.error || "Error al eliminar la plantilla",
      );
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    loading,
    error,
    listarPlantillas,
    getPlantillaDetalle,
    crearPlantilla,
    actualizarPlantilla,
    eliminarPlantilla,
  };
}
