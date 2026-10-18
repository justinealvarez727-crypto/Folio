import { createStore, del, get, set, type UseStore } from 'idb-keyval';
import type { StateStorage } from 'zustand/middleware';

/**
 * IndexedDB persistence.
 *
 * Two roles:
 *  1. `idbStorage` – an async StateStorage adapter so Zustand `persist` can
 *     write to IndexedDB instead of localStorage (no 5 MB cap, non-blocking).
 *  2. Blob helpers – the raw .epub ArrayBuffer, cover image and epub.js
 *     "locations" (page-position index) are stored per book, outside Zustand.
 */

const db: UseStore = createStore('folio-db', 'kv');

export const idbStorage: StateStorage = {
  getItem: async (name) => (await get<string>(name, db)) ?? null,
  setItem: async (name, value) => {
    await set(name, value, db);
  },
  removeItem: async (name) => {
    await del(name, db);
  },
};

const fileKey = (id: string) => `book:file:${id}`;
const coverKey = (id: string) => `book:cover:${id}`;
// v2: locations are generated at 250 chars each (Kindle-like granularity); bump to invalidate caches.
const locationsKey = (id: string) => `book:locations:v2:${id}`;

export const saveBookFile = (id: string, buf: ArrayBuffer) => set(fileKey(id), buf, db);
export const loadBookFile = (id: string) => get<ArrayBuffer>(fileKey(id), db);
export const saveCover = (id: string, blob: Blob) => set(coverKey(id), blob, db);
export const loadCover = (id: string) => get<Blob>(coverKey(id), db);
export const saveLocations = (id: string, json: string) => set(locationsKey(id), json, db);
export const loadLocations = (id: string) => get<string>(locationsKey(id), db);

export async function deleteBookBlobs(id: string): Promise<void> {
  await Promise.all([del(fileKey(id), db), del(coverKey(id), db), del(locationsKey(id), db)]);
}

/**
 * Ask the browser not to evict our data under storage pressure. Best-effort:
 * browsers may decline silently (Safari) — the app works either way.
 */
export async function requestPersistentStorage(): Promise<boolean> {
  try {
    if (navigator.storage?.persist && !(await navigator.storage.persisted())) {
      return await navigator.storage.persist();
    }
  } catch {
    /* ignore */
  }
  return false;
}

export async function estimateStorage(): Promise<{ usage: number; quota: number } | null> {
  try {
    const e = await navigator.storage?.estimate?.();
    if (e && e.usage != null && e.quota != null) return { usage: e.usage, quota: e.quota };
  } catch {
    /* ignore */
  }
  return null;
}
