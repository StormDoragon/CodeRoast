import { openDB } from 'idb';

const DB_NAME = 'coderoast';
const STORE = 'sessions';

export async function getDB() {
  return openDB(DB_NAME, 1, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id', autoIncrement: true });
      }
    },
  });
}

export interface RoastSession {
  id?: number;
  code: string;
  lang: string;
  model?: string;
  history: Array<{ question: string; answer: string }>;
}

export async function saveSession(session: RoastSession) {
  const db = await getDB();
  return db.put(STORE, session);
}

export async function loadSession(id: number) {
  const db = await getDB();
  return db.get(STORE, id);
}

export async function listSessions() {
  const db = await getDB();
  return db.getAll(STORE);
}

// Model preference storage
const PREFS_STORE = 'preferences';

export async function getPreferencesDB() {
  return openDB(DB_NAME, 2, {
    upgrade(db, oldVersion) {
      if (oldVersion < 2 && !db.objectStoreNames.contains(PREFS_STORE)) {
        db.createObjectStore(PREFS_STORE, { keyPath: 'key' });
      }
    },
  });
}

export async function getModelPreference(): Promise<string> {
  const db = await getPreferencesDB();
  const pref = await db.get(PREFS_STORE, 'selectedModel');
  return pref?.value || 'Qwen2-1.5B-Instruct-q4f16_1-MLC';
}

export async function setModelPreference(modelName: string) {
  const db = await getPreferencesDB();
  return db.put(PREFS_STORE, { key: 'selectedModel', value: modelName });
}
