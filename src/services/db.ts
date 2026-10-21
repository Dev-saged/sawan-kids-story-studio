// مخزن المتصفح المحلي (IndexedDB v4): قصص + صور + صوت (keyPath: 'id' مع ترحيل القواعد القديمة) + ملفات الأطفال + البصمات الصوتية + ألبوم الشخصيات (ب7) + الهويات المخصصة (ب3)
import type { BrandPreset } from '../config';
import type { SavedCharacter } from '../types';

export const DB_NAME = 'sawan_studio';
export const DB_VERSION = 4;

export type ImageKind = 'page' | 'cover' | 'sheet' | 'hero' | 'explain';

export interface StoredImage {
  id: string;
  blob: Blob;
  kind: ImageKind;
  style: string;
  tokens: string[];
  createdAt: number;
}

export interface StoredAudio {
  id: string;
  blob: Blob;
  createdAt: number;
}

export interface ChildProfile {
  id: string;
  name: string;
  photoId?: string;
  createdAt: number;
}

export interface VoiceProfile {
  id: string;
  name: string;
  sampleAudioKey: string;
  matchedAiVoice: string;
  pitchAdjust: number;
  rateAdjust: number;
  warmthAdjust: number;
  description: string;
  createdAt: number;
}

export const newId = (): string =>
  typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;

/**
 * أ1: ترقية وترحيل مخطط IndexedDB.
 * إن وُجد مخزن 'audio' بمفتاح مختلف عن 'id' (مثل 'key' في الإصدارات السابقة)،
 * يُعاد إنشاؤه بـ keyPath: 'id' وتُنسخ جميع السجلات (id أو key -> id) دون فقدان.
 */
export const upgradeDbSchema = (db: IDBDatabase, tx: IDBTransaction | null): void => {
  if (!db.objectStoreNames.contains('stories')) {
    const s = db.createObjectStore('stories', { keyPath: 'id' });
    s.createIndex('createdAt', 'createdAt');
  }
  if (!db.objectStoreNames.contains('images')) {
    const i = db.createObjectStore('images', { keyPath: 'id' });
    i.createIndex('kind', 'kind');
  }
  if (!db.objectStoreNames.contains('audio')) {
    db.createObjectStore('audio', { keyPath: 'id' });
  } else if (tx) {
    const existingAudio = tx.objectStore('audio');
    if (existingAudio.keyPath !== 'id') {
      const preparedRecords: Array<Record<string, unknown>> = [];
      const cursorReq = existingAudio.openCursor();
      cursorReq.onsuccess = () => {
        const cursor = cursorReq.result;
        if (cursor) {
          const rawVal = cursor.value;
          const rec: Record<string, unknown> =
            rawVal && typeof rawVal === 'object' ? (rawVal as Record<string, unknown>) : { value: rawVal };
          const fallbackKey = cursor.key;
          const resolvedId = String(rec.id ?? rec.key ?? fallbackKey ?? newId());
          const migrated: Record<string, unknown> = {};
          for (const [k, v] of Object.entries(rec)) {
            if (k !== 'key') {
              migrated[k] = v;
            }
          }
          migrated.id = resolvedId;
          migrated.createdAt = typeof rec.createdAt === 'number' ? rec.createdAt : Date.now();
          preparedRecords.push(migrated);
          cursor.continue();
        } else {
          db.deleteObjectStore('audio');
          const recreatedAudio = db.createObjectStore('audio', { keyPath: 'id' });
          for (const item of preparedRecords) {
            recreatedAudio.put(item);
          }
        }
      };
    }
  }
  if (!db.objectStoreNames.contains('children')) {
    db.createObjectStore('children', { keyPath: 'id' });
  }
  if (!db.objectStoreNames.contains('voice_profiles')) {
    db.createObjectStore('voice_profiles', { keyPath: 'id' });
  }
  // ب7: مخزن ألبوم الشخصيات المحفوظة مع صورها المرجعية
  if (!db.objectStoreNames.contains('characters')) {
    const c = db.createObjectStore('characters', { keyPath: 'id' });
    c.createIndex('createdAt', 'createdAt');
  }
  // ب3: مخزن الهويات السريعة المخصصة («احفظ هويتي»)
  if (!db.objectStoreNames.contains('custom_presets')) {
    const p = db.createObjectStore('custom_presets', { keyPath: 'id' });
    p.createIndex('createdAt', 'createdAt');
  }
};

let dbPromise: Promise<IDBDatabase> | null = null;

export const openDb = (): Promise<IDBDatabase> => {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      upgradeDbSchema(req.result, req.transaction);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => {
      dbPromise = null;
      reject(req.error);
    };
  });
  return dbPromise;
};

const run = async <T,>(store: string, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> => {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, mode);
    const req = fn(tx.objectStore(store));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
};

export const dbGet = <T,>(store: string, key: IDBValidKey): Promise<T | undefined> => run(store, 'readonly', (s) => s.get(key));
export const dbGetAll = <T,>(store: string): Promise<T[]> => run(store, 'readonly', (s) => s.getAll());
export const dbAll = dbGetAll;
export const dbByIndex = <T,>(store: string, index: string, key: IDBValidKey): Promise<T[]> =>
  run(store, 'readonly', (s) => s.index(index).getAll(key));
export const dbPut = <T,>(store: string, value: T): Promise<IDBValidKey> => run(store, 'readwrite', (s) => s.put(value));
export const dbDelete = (store: string, key: IDBValidKey): Promise<undefined> => run(store, 'readwrite', (s) => s.delete(key));

export const hashText = (s: string): string => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return (h >>> 0).toString(36);
};

// ===== ب7: دوال ألبوم الشخصيات (IndexedDB characters store) =====
export const saveAlbumCharacter = async (
  input: Omit<SavedCharacter, 'id' | 'createdAt'> & { id?: string; createdAt?: number }
): Promise<SavedCharacter> => {
  const record: SavedCharacter = {
    id: input.id || `char-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    name: input.name.trim(),
    description: input.description.trim(),
    personality: (input.personality || 'Friendly and brave').trim(),
    age: (input.age || '7').trim(),
    gender: (input.gender || 'Child').trim(),
    referenceImageId: input.referenceImageId,
    createdAt: input.createdAt ?? Date.now(),
  };
  await dbPut('characters', record);
  return record;
};

export const listAlbumCharacters = async (): Promise<SavedCharacter[]> => {
  try {
    const all = await dbGetAll<SavedCharacter>('characters');
    return all.sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
  } catch {
    return [];
  }
};

export const deleteAlbumCharacter = async (id: string): Promise<void> => {
  await dbDelete('characters', id);
};

// ===== ب3: دوال الهويات السريعة المخصصة (IndexedDB custom_presets store) =====
export const saveCustomPreset = async (preset: BrandPreset): Promise<BrandPreset> => {
  const record: BrandPreset = {
    ...preset,
    id: preset.id || `preset-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    isCustom: true,
    createdAt: preset.createdAt ?? Date.now(),
  };
  await dbPut('custom_presets', record);
  return record;
};

export const listCustomPresets = async (): Promise<BrandPreset[]> => {
  try {
    const all = await dbGetAll<BrandPreset>('custom_presets');
    return all.sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
  } catch {
    return [];
  }
};

export const deleteCustomPreset = async (id: string): Promise<void> => {
  await dbDelete('custom_presets', id);
};
