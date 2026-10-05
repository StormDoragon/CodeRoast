import { openDB, type IDBPDatabase } from 'idb';

const DB_NAME = 'coderoast';
const DB_VERSION = 3;
const ROASTS = 'roasts';
const PREFS = 'preferences';
const MAX_HISTORY = 25;

export interface SavedRoast {
  id?: number;
  createdAt: number;
  lang: string;
  score: number;
  title: string;
  text: string;
  snippet: string;
}

let dbPromise: Promise<IDBPDatabase> | null = null;

function db() {
  dbPromise ??= openDB(DB_NAME, DB_VERSION, {
    upgrade(d) {
      // v1/v2 stored a different shape; start clean.
      if (d.objectStoreNames.contains('sessions')) d.deleteObjectStore('sessions');
      if (!d.objectStoreNames.contains(ROASTS)) d.createObjectStore(ROASTS, { keyPath: 'id', autoIncrement: true });
      if (!d.objectStoreNames.contains(PREFS)) d.createObjectStore(PREFS, { keyPath: 'key' });
    },
  });
  return dbPromise;
}

export async function saveRoast(r: SavedRoast) {
  const d = await db();
  await d.add(ROASTS, r);
  const keys = await d.getAllKeys(ROASTS);
  for (const k of keys.slice(0, Math.max(0, keys.length - MAX_HISTORY))) await d.delete(ROASTS, k);
}

export async function listRoasts(): Promise<SavedRoast[]> {
  const d = await db();
  return ((await d.getAll(ROASTS)) as SavedRoast[]).reverse();
}

export async function clearRoasts() {
  const d = await db();
  await d.clear(ROASTS);
}

export async function getPref<T>(key: string, fallback: T): Promise<T> {
  try {
    const d = await db();
    const row = await d.get(PREFS, key);
    return row ? (row.value as T) : fallback;
  } catch {
    return fallback;
  }
}

export async function setPref<T>(key: string, value: T) {
  try {
    const d = await db();
    await d.put(PREFS, { key, value });
  } catch {
    // Private mode / blocked storage: preferences are a convenience only.
  }
}
