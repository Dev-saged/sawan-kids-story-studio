const DB_NAME = 'sawan-studio';
const DB_VERSION = 2;

export type StoreName = 'stories' | 'images' | 'audio' | 'children' | 'voice_profiles';

const MIGRATIONS: Record<number, (db: IDBDatabase) => void> = {
  1: (db) => {
    db.createObjectStore('stories', { keyPath: 'id' }).createIndex('updatedAt', 'updatedAt');
    db.createObjectStore('images', { keyPath: 'id' }).createIndex('style', 'style');
    db.createObjectStore('audio', { keyPath: 'id' });
    db.createObjectStore('children', { keyPath: 'id' });
  },
  2: (db) => {
    if (!db.objectStoreNames.contains('voice_profiles')) {
      db.createObjectStore('voice_profiles', { keyPath: 'id' });
    }
  },
};

let dbPromise: Promise<IDBDatabase> | null = null;

const openDb = (): Promise<IDBDatabase> => {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') return reject(new Error('IndexedDB unavailable'));
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      for (let v = e.oldVersion + 1; v <= DB_VERSION; v++) MIGRATIONS[v]?.(req.result);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  dbPromise.catch(() => {
    dbPromise = null;
  });
  return dbPromise;
};

const run = async <T>(store: StoreName, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> => {
  const db = await openDb();
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(store, mode);
    const req = fn(tx.objectStore(store));
    tx.oncomplete = () => resolve(req.result);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
};

export const dbGet = <T>(store: StoreName, id: string): Promise<T | undefined> => run<T>(store, 'readonly', (s) => s.get(id));
export const dbPut = <T>(store: StoreName, value: T): Promise<IDBValidKey> => run(store, 'readwrite', (s) => s.put(value));
export const dbDelete = (store: StoreName, id: string): Promise<undefined> => run(store, 'readwrite', (s) => s.delete(id));
export const dbAll = <T>(store: StoreName): Promise<T[]> => run<T[]>(store, 'readonly', (s) => s.getAll());
export const dbByIndex = <T>(store: StoreName, index: string, key: IDBValidKey): Promise<T[]> =>
  run<T[]>(store, 'readonly', (s) => s.index(index).getAll(key));

export const newId = (): string =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;

export const hashText = (text: string): string => {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return (h >>> 0).toString(36);
};
