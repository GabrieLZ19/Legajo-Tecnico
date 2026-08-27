/** Fotos de borradores de informes en IndexedDB (File/Blob no caben en localStorage). */

const DB_NAME = "legajo_informe_draft_photos";
const DB_VERSION = 1;
const STORE = "photos";

export type DraftPhotoRecord = {
  /** `${draftKey}::${id_temp}` */
  key: string;
  draftKey: string;
  id_temp: string;
  blob: Blob;
  name: string;
  type: string;
  updatedAt: string;
};

function photoKey(draftKey: string, idTemp: string): string {
  return `${draftKey}::${idTemp}`;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB no disponible"));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => reject(req.error ?? new Error("Error abriendo IndexedDB"));
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: "key" });
        store.createIndex("draftKey", "draftKey", { unique: false });
      }
    };
  });
}

function idbReq<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("IndexedDB request failed"));
  });
}

export async function putDraftPhoto(
  draftKey: string,
  idTemp: string,
  file: File | Blob,
  name?: string,
): Promise<void> {
  try {
    const db = await openDb();
    const tx = db.transaction(STORE, "readwrite");
    const store = tx.objectStore(STORE);
    const record: DraftPhotoRecord = {
      key: photoKey(draftKey, idTemp),
      draftKey,
      id_temp: idTemp,
      blob: file,
      name: name || (file instanceof File ? file.name : `evidencia-${idTemp}.jpg`),
      type: file.type || "image/jpeg",
      updatedAt: new Date().toISOString(),
    };
    store.put(record);
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error("putDraftPhoto failed"));
    });
    db.close();
  } catch (err) {
    console.warn("No se pudo guardar foto de borrador:", err);
  }
}

export async function getDraftPhotos(
  draftKey: string,
): Promise<Map<string, File>> {
  const map = new Map<string, File>();
  try {
    const db = await openDb();
    const tx = db.transaction(STORE, "readonly");
    const index = tx.objectStore(STORE).index("draftKey");
    const rows = await idbReq(index.getAll(draftKey));
    db.close();
    for (const row of rows as DraftPhotoRecord[]) {
      const file = new File([row.blob], row.name || `evidencia-${row.id_temp}.jpg`, {
        type: row.type || "image/jpeg",
        lastModified: Date.parse(row.updatedAt) || Date.now(),
      });
      map.set(row.id_temp, file);
    }
  } catch (err) {
    console.warn("No se pudieron leer fotos de borrador:", err);
  }
  return map;
}

export async function deleteDraftPhotos(draftKey: string): Promise<void> {
  try {
    const db = await openDb();
    const tx = db.transaction(STORE, "readwrite");
    const store = tx.objectStore(STORE);
    const index = store.index("draftKey");
    const keys = await idbReq(index.getAllKeys(draftKey));
    for (const k of keys) {
      store.delete(k);
    }
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error("deleteDraftPhotos failed"));
    });
    db.close();
  } catch (err) {
    console.warn("No se pudieron borrar fotos de borrador:", err);
  }
}

export async function deleteDraftPhoto(
  draftKey: string,
  idTemp: string,
): Promise<void> {
  try {
    const db = await openDb();
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(photoKey(draftKey, idTemp));
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error("deleteDraftPhoto failed"));
    });
    db.close();
  } catch (err) {
    console.warn("No se pudo borrar foto de borrador:", err);
  }
}

/** Copia fotos de una clave de borrador a otra y borra el origen. */
export async function migrateDraftPhotos(
  fromKey: string,
  toKey: string,
): Promise<void> {
  if (fromKey === toKey) return;
  try {
    const photos = await getDraftPhotos(fromKey);
    await Promise.all(
      [...photos.entries()].map(([idTemp, file]) =>
        putDraftPhoto(toKey, idTemp, file, file.name),
      ),
    );
    await deleteDraftPhotos(fromKey);
  } catch (err) {
    console.warn("No se pudieron migrar fotos de borrador:", err);
  }
}

/**
 * Sincroniza el store de fotos con las observaciones actuales:
 * guarda las que tienen File y elimina las que ya no están / no tienen archivo.
 */
export async function syncDraftPhotos(
  draftKey: string,
  observaciones: Array<{ id_temp: string; imagenFile?: File }>,
): Promise<void> {
  const keep = new Set(
    observaciones.filter((o) => o.imagenFile).map((o) => o.id_temp),
  );
  try {
    const existing = await getDraftPhotos(draftKey);
    await Promise.all(
      observaciones
        .filter((o) => o.imagenFile)
        .map((o) => putDraftPhoto(draftKey, o.id_temp, o.imagenFile!, o.imagenFile!.name)),
    );
    await Promise.all(
      [...existing.keys()]
        .filter((id) => !keep.has(id))
        .map((id) => deleteDraftPhoto(draftKey, id)),
    );
  } catch (err) {
    console.warn("No se pudieron sincronizar fotos de borrador:", err);
  }
}
