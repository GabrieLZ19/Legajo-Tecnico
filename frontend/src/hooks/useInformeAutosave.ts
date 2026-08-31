"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  buildFechaHoraIso,
  clearInformeDraft,
  draftHasContent,
  draftKeyEditar,
  draftKeyNuevo,
  InformeDraftImagenVisita,
  InformeDraftObservacion,
  InformeDraftPayload,
  readInformeDraft,
  writeInformeDraft,
} from "@/lib/informeDraft";
import {
  deleteDraftPhotos,
  getDraftPhotos,
  migrateDraftPhotos,
  syncDraftPhotos,
} from "@/lib/informeDraftPhotos";
import { subirEvidenciaInforme } from "@/hooks/useInformes";
import { mapPool } from "@/lib/mapPool";

const LOCAL_DEBOUNCE_MS = 800;
const SERVER_INTERVAL_MS = 60_000;

export type AutosaveStatus =
  | "idle"
  | "local"
  | "saving"
  | "saved"
  | "offline"
  | "error";

type ObsConImagen = InformeDraftObservacion & {
  imagenFile?: File;
};

type ImagenVisitaConArchivo = InformeDraftImagenVisita & {
  imagenFile?: File;
};

type Snapshot = {
  lugar: string;
  actividad: string;
  fecha: string;
  hora: string;
  declaracion_legal: string;
  observaciones: ObsConImagen[];
  imagenes_visita: ImagenVisitaConArchivo[];
};

type CrearFn = (payload: Record<string, unknown>) => Promise<{
  id: string;
  puntos_mejora?: Array<{ id: string; detalle: string }>;
}>;

type EditarFn = (args: {
  id: string;
  data: Record<string, unknown>;
}) => Promise<{
  id: string;
  puntos_mejora?: Array<{ id: string; detalle: string }>;
}>;

type Options = {
  mode: "nuevo" | "editar";
  empresaId?: string;
  /** ID del informe en servidor (editar, o nuevo tras primer create). */
  informeId?: string;
  enabled?: boolean;
  /** Evita solaparse con el guardado manual. */
  pause?: boolean;
  /** Campos del form que disparan persistencia local (debounce). */
  watch?: unknown[];
  getSnapshot: () => Snapshot;
  crearInforme: CrearFn;
  editarInforme: EditarFn;
  /** Tras crear borrador en /nuevo. */
  onCreated?: (informeId: string) => void;
  /** Tras sync exitoso: actualizar ids de puntos_mejora / evidencias de visita. */
  onSynced?: (res: {
    id: string;
    puntos_mejora?: Array<{ id: string; detalle: string }>;
    evidencias_urls?: string[];
  }) => void;
};

function stripImagenesForLocal(
  imagenes: ImagenVisitaConArchivo[],
): InformeDraftImagenVisita[] {
  return imagenes.map(({ id_temp, url }) => ({ id_temp, url }));
}

function stripObsForLocal(obs: ObsConImagen[]): InformeDraftObservacion[] {
  return obs.map(({ id_temp, id, detalle, acciones, evidencia_url }) => ({
    id_temp,
    id,
    detalle,
    acciones: acciones.map((a) => ({
      id: a.id,
      descripcion: a.descripcion,
      responsable: a.responsable || "",
    })),
    evidencia_url,
  }));
}

function fingerprint(snapshot: Snapshot): string {
  return JSON.stringify({
    lugar: snapshot.lugar,
    actividad: snapshot.actividad,
    fecha: snapshot.fecha,
    hora: snapshot.hora,
    declaracion_legal: snapshot.declaracion_legal,
    observaciones: stripObsForLocal(snapshot.observaciones),
    imagenes_visita: stripImagenesForLocal(snapshot.imagenes_visita),
    pendingImages: snapshot.observaciones
      .filter((o) => o.imagenFile)
      .map((o) => o.id_temp),
    pendingVisitImages: snapshot.imagenes_visita
      .filter((i) => i.imagenFile)
      .map((i) => i.id_temp),
  });
}

export function useInformeAutosave(options: Options) {
  const {
    mode,
    empresaId,
    informeId: informeIdProp,
    enabled = true,
    pause = false,
    watch = [],
    getSnapshot,
    crearInforme,
    editarInforme,
    onCreated,
    onSynced,
  } = options;

  const [status, setStatus] = useState<AutosaveStatus>("idle");
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [informeId, setInformeId] = useState<string | undefined>(informeIdProp);

  const dirtyRef = useRef(false);
  const lastFpRef = useRef<string>("");
  const savingRef = useRef(false);
  const informeIdRef = useRef(informeId);
  const getSnapshotRef = useRef(getSnapshot);
  const onCreatedRef = useRef(onCreated);
  const onSyncedRef = useRef(onSynced);
  const crearRef = useRef(crearInforme);
  const editarRef = useRef(editarInforme);

  useEffect(() => {
    setInformeId(informeIdProp);
  }, [informeIdProp]);

  useEffect(() => {
    informeIdRef.current = informeId;
  }, [informeId]);

  useEffect(() => {
    getSnapshotRef.current = getSnapshot;
  }, [getSnapshot]);

  useEffect(() => {
    onCreatedRef.current = onCreated;
  }, [onCreated]);

  useEffect(() => {
    onSyncedRef.current = onSynced;
  }, [onSynced]);

  useEffect(() => {
    crearRef.current = crearInforme;
  }, [crearInforme]);

  useEffect(() => {
    editarRef.current = editarInforme;
  }, [editarInforme]);

  const storageKey = useCallback(() => {
    if (!empresaId) return null;
    const id = informeIdRef.current;
    if (id) return draftKeyEditar(id);
    if (mode === "nuevo") return draftKeyNuevo(empresaId);
    return null;
  }, [empresaId, mode]);

  const persistLocal = useCallback(() => {
    const key = storageKey();
    if (!key || !empresaId) return;

    const snap = getSnapshotRef.current();
    const draft: InformeDraftPayload = {
      version: 1,
      empresaId,
      informeId: informeIdRef.current,
      lugar: snap.lugar,
      actividad: snap.actividad,
      fecha: snap.fecha,
      hora: snap.hora,
      declaracion_legal: snap.declaracion_legal,
      observaciones: stripObsForLocal(snap.observaciones),
      imagenes_visita: stripImagenesForLocal(snap.imagenes_visita),
      savedAt: new Date().toISOString(),
    };

    if (!draftHasContent(draft) && !informeIdRef.current) return;

    writeInformeDraft(key, draft);
    void syncDraftPhotos(key, [
      ...snap.observaciones,
      ...snap.imagenes_visita,
    ]);
    setLastSavedAt(new Date());
    setStatus((s) => (s === "saving" ? s : "local"));
  }, [empresaId, storageKey]);

  const clearLocal = useCallback(async () => {
    if (!empresaId) return;
    const nuevoKey = draftKeyNuevo(empresaId);
    clearInformeDraft(nuevoKey);
    await deleteDraftPhotos(nuevoKey);
    if (informeIdRef.current) {
      const editKey = draftKeyEditar(informeIdRef.current);
      clearInformeDraft(editKey);
      await deleteDraftPhotos(editKey);
    }
  }, [empresaId]);

  const resolveDraftKey = useCallback((): string | null => {
    if (!empresaId) return null;
    if (informeIdProp) return draftKeyEditar(informeIdProp);
    if (mode === "nuevo") {
      const nuevo = readInformeDraft(draftKeyNuevo(empresaId));
      if (nuevo?.informeId) {
        const byId = readInformeDraft(draftKeyEditar(nuevo.informeId));
        return byId
          ? draftKeyEditar(nuevo.informeId)
          : draftKeyNuevo(empresaId);
      }
      return draftKeyNuevo(empresaId);
    }
    return null;
  }, [empresaId, informeIdProp, mode]);

  const loadLocalDraft = useCallback((): InformeDraftPayload | null => {
    if (!empresaId) return null;
    if (informeIdProp) {
      return readInformeDraft(draftKeyEditar(informeIdProp));
    }
    if (mode === "nuevo") {
      const nuevo = readInformeDraft(draftKeyNuevo(empresaId));
      if (nuevo?.informeId) {
        const byId = readInformeDraft(draftKeyEditar(nuevo.informeId));
        return byId || nuevo;
      }
      return nuevo;
    }
    return null;
  }, [empresaId, informeIdProp, mode]);

  /** Draft + fotos restauradas desde IndexedDB. */
  const loadLocalDraftWithPhotos = useCallback(async (): Promise<{
    draft: InformeDraftPayload | null;
    photos: Map<string, File>;
  }> => {
    const draft = loadLocalDraft();
    const key = resolveDraftKey();
    if (!draft || !key) return { draft, photos: new Map() };
    const photos = await getDraftPhotos(key);
    return { draft, photos };
  }, [loadLocalDraft, resolveDraftKey]);

  const syncToServer = useCallback(async (): Promise<boolean> => {
    if (!empresaId || pause || !enabled) return false;
    if (savingRef.current) return false;
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      setStatus("offline");
      persistLocal();
      return false;
    }

    const snap = getSnapshotRef.current();
    const fp = fingerprint(snap);
    if (!dirtyRef.current && fp === lastFpRef.current) return false;

    const base = {
      actividad: snap.actividad,
      lugar: snap.lugar,
      declaracion_legal: snap.declaracion_legal,
      observaciones: stripObsForLocal(snap.observaciones),
      imagenes_visita: stripImagenesForLocal(snap.imagenes_visita),
    };
    if (!draftHasContent(base) && !informeIdRef.current) return false;

    const fechaIso = buildFechaHoraIso(snap.fecha, snap.hora);
    if (!fechaIso) return false;

    savingRef.current = true;
    setStatus("saving");

    try {
      const puntos_mejora = snap.observaciones.map((obs) => ({
        id: obs.id,
        detalle: obs.detalle,
        evidencia_url: obs.evidencia_url,
        acciones: obs.acciones
          .filter((a) => a.descripcion.trim().length > 0)
          .map((a) => ({
            id: a.id,
            descripcion: a.descripcion,
            responsable: a.responsable || undefined,
          })),
      }));

      let res: {
        id: string;
        puntos_mejora?: Array<{ id: string; detalle: string }>;
      };

      const currentId = informeIdRef.current;

      if (currentId) {
        const retainedUrls = snap.imagenes_visita
          .filter((img) => img.url && !img.imagenFile)
          .map((img) => img.url!);

        res = await editarRef.current({
          id: currentId,
          data: {
            actividad: snap.actividad,
            fecha_hora_visita: fechaIso,
            lugar_visita: snap.lugar,
            declaracion_legal: snap.declaracion_legal,
            observaciones: "",
            puntos_mejora,
            evidencias_urls: retainedUrls,
          },
        });
      } else {
        res = await crearRef.current({
          empresa_id: empresaId,
          actividad: snap.actividad,
          fecha_hora_visita: fechaIso,
          lugar_visita: snap.lugar,
          contacto_visita: "Responsable de Planta",
          declaracion_legal: snap.declaracion_legal,
          observaciones: "",
          peligros: [],
          puntos_mejora: puntos_mejora.map(({ detalle, acciones }) => ({
            detalle,
            acciones,
          })),
        });

        setInformeId(res.id);
        informeIdRef.current = res.id;
        onCreatedRef.current?.(res.id);

        // Migrar clave local de "nuevo" → "edit" (texto + fotos)
        const fromKey = draftKeyNuevo(empresaId);
        const toKey = draftKeyEditar(res.id);
        clearInformeDraft(fromKey);
        await migrateDraftPhotos(fromKey, toKey);
      }

      const obsConImagen = snap.observaciones.filter((obs) => obs.imagenFile);
      if (obsConImagen.length > 0 && res.puntos_mejora) {
        await mapPool(obsConImagen, 3, async (obs) => {
          const pmCreado = res.puntos_mejora?.find(
            (pm) =>
              (obs.id && pm.id === obs.id) || pm.detalle === obs.detalle,
          );
          if (!pmCreado || !obs.imagenFile) return;
          const formData = new FormData();
          formData.append("evidencia", obs.imagenFile);
          formData.append("punto_mejora_id", pmCreado.id);
          await subirEvidenciaInforme(res.id, formData);
        });
      }

      const visitPending = snap.imagenes_visita.filter((img) => img.imagenFile);
      let evidenciasUrls: string[] | undefined =
        currentId
          ? snap.imagenes_visita
              .filter((img) => img.url && !img.imagenFile)
              .map((img) => img.url!)
          : undefined;

      if (visitPending.length > 0) {
        const formData = new FormData();
        for (const img of visitPending) {
          if (img.imagenFile) formData.append("evidencia", img.imagenFile);
        }
        const uploadRes = await subirEvidenciaInforme(res.id, formData);
        evidenciasUrls = uploadRes?.evidencias_urls;
      }

      dirtyRef.current = false;
      lastFpRef.current = fingerprint(getSnapshotRef.current());
      const now = new Date();
      setLastSavedAt(now);
      setStatus("saved");

      const key = draftKeyEditar(res.id);
      writeInformeDraft(key, {
        version: 1,
        empresaId,
        informeId: res.id,
        lugar: snap.lugar,
        actividad: snap.actividad,
        fecha: snap.fecha,
        hora: snap.hora,
        declaracion_legal: snap.declaracion_legal,
        observaciones: stripObsForLocal(snap.observaciones),
        imagenes_visita: stripImagenesForLocal(
          evidenciasUrls
            ? evidenciasUrls.map((url) => ({ id_temp: url, url }))
            : snap.imagenes_visita.filter((i) => !i.imagenFile),
        ),
        savedAt: now.toISOString(),
        lastServerSyncAt: now.toISOString(),
      });
      // Tras subir evidencia, limpiar fotos locales pendientes de esas obs
      void syncDraftPhotos(
        key,
        [
          ...snap.observaciones.map((o) =>
            o.imagenFile &&
            res.puntos_mejora?.some(
              (pm) =>
                (o.id && pm.id === o.id) || pm.detalle === o.detalle,
            )
              ? { id_temp: o.id_temp }
              : o,
          ),
          ...(evidenciasUrls
            ? evidenciasUrls.map((url) => ({ id_temp: url, url }))
            : snap.imagenes_visita.filter((i) => !i.imagenFile)),
        ],
      );

      onSyncedRef.current?.({ ...res, evidencias_urls: evidenciasUrls });
      return true;
    } catch (err) {
      console.warn("Autosave de informe falló:", err);
      persistLocal();
      setStatus(
        typeof navigator !== "undefined" && !navigator.onLine
          ? "offline"
          : "error",
      );
      return false;
    } finally {
      savingRef.current = false;
    }
  }, [empresaId, enabled, pause, persistLocal]);

  const watchKey = JSON.stringify(watch);

  // Marcar dirty + debounce local cuando cambian campos del form
  useEffect(() => {
    if (!enabled || !empresaId || pause) return;

    const markAndPersist = () => {
      const snap = getSnapshotRef.current();
      const fp = fingerprint(snap);
      if (fp !== lastFpRef.current) {
        dirtyRef.current = true;
      }
      persistLocal();
    };

    const t = window.setTimeout(markAndPersist, LOCAL_DEBOUNCE_MS);
    return () => window.clearTimeout(t);
  }, [enabled, empresaId, pause, persistLocal, watchKey]);

  // Intervalo servidor + online/offline + beforeunload
  useEffect(() => {
    if (!enabled || !empresaId) return;

    const tick = () => {
      if (pause) return;
      void syncToServer();
    };

    // Primer intento a los ~5s (no esperar el minuto completo la primera vez)
    const firstSync = window.setTimeout(tick, 5_000);
    const interval = window.setInterval(tick, SERVER_INTERVAL_MS);

    const onOnline = () => {
      setStatus((s) => (s === "offline" ? "local" : s));
      void syncToServer();
    };
    const onOffline = () => {
      persistLocal();
      setStatus("offline");
    };
    const onVis = () => {
      if (document.visibilityState === "hidden") {
        persistLocal();
      }
    };
    const onUnload = () => {
      persistLocal();
    };

    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("beforeunload", onUnload);

    if (typeof navigator !== "undefined" && !navigator.onLine) {
      setStatus("offline");
    }

    return () => {
      window.clearTimeout(firstSync);
      window.clearInterval(interval);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("beforeunload", onUnload);
    };
  }, [enabled, empresaId, pause, persistLocal, syncToServer]);

  /** Llamar cuando el form cambia (además del debounce por getSnapshot). */
  const notifyChange = useCallback(() => {
    dirtyRef.current = true;
    persistLocal();
  }, [persistLocal]);

  /** Tras guardado manual exitoso: limpia local y alinea fingerprint. */
  const markCleanAfterManualSave = useCallback(() => {
    dirtyRef.current = false;
    lastFpRef.current = fingerprint(getSnapshotRef.current());
    void clearLocal();
    setStatus("saved");
    setLastSavedAt(new Date());
  }, [clearLocal]);

  /** Inicializa fingerprint tras hidratar el form (evita PATCH vacío). */
  const baselineFromCurrent = useCallback(() => {
    lastFpRef.current = fingerprint(getSnapshotRef.current());
    dirtyRef.current = false;
  }, []);

  /** Marca el form como pendiente de sync (p. ej. tras restaurar borrador local). */
  const markDirty = useCallback(() => {
    dirtyRef.current = true;
    lastFpRef.current = "";
  }, []);

  /** Reinicia estado interno del autosave (tras descartar borrador). */
  const resetAutosaveState = useCallback(() => {
    dirtyRef.current = false;
    lastFpRef.current = "";
    setInformeId(undefined);
    informeIdRef.current = undefined;
    setStatus("idle");
    setLastSavedAt(null);
  }, []);

  return {
    status,
    lastSavedAt,
    informeId,
    setInformeId,
    loadLocalDraft,
    loadLocalDraftWithPhotos,
    syncNow: syncToServer,
    notifyChange,
    markCleanAfterManualSave,
    clearLocal,
    baselineFromCurrent,
    markDirty,
    persistLocal,
    resetAutosaveState,
  };
}

export function formatAutosaveLabel(
  status: AutosaveStatus,
  lastSavedAt: Date | null,
): string {
  const time =
    lastSavedAt &&
    lastSavedAt.toLocaleTimeString("es-AR", {
      hour: "2-digit",
      minute: "2-digit",
    });

  switch (status) {
    case "saving":
      return "Guardando borrador…";
    case "saved":
      return time ? `Borrador guardado · ${time}` : "Borrador guardado";
    case "local":
      return time
        ? `Borrador local · ${time}`
        : "Borrador guardado en este dispositivo";
    case "offline":
      return "Sin conexión · borrador local";
    case "error":
      return "No se pudo sincronizar · borrador local";
    default:
      return "Autoguardado cada 1 min";
  }
}
