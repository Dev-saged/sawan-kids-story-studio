import { CURRENT_VERSION } from '../version';
import { getErrorLog, preflight, type ApiErrorCode, type ErrorRecord, type Preflight } from './api';
import { getApiKey, getFreeCreds, getUserApiKey, isKeyRemembered, keyHint } from './apiKey';
import { DB_NAME, DB_VERSION, dbAll } from './db';
import { getImageEngineSessionHealth, type PathTest, type SessionEngineHealthEntry } from './imageEngine';
import { checkForAppUpdate } from './versionCheck';

export interface IndexedDbStoreStats {
  stories: number;
  images: number;
  audio: number;
  children: number;
  voice_profiles: number;
  characters: number;
  custom_presets: number;
}

export interface StorageEstimateInfo {
  supported: boolean;
  usageBytes: number;
  quotaBytes: number;
  percent: number;
}

export interface ServiceWorkerStatusInfo {
  supported: boolean;
  state: 'active' | 'waiting' | 'installing' | 'none' | 'unsupported';
  cacheNames: string[];
}

export interface SanitizedErrorItem {
  at: string;
  where: string;
  code: ApiErrorCode;
  engine: string;
  model: string;
  detail?: string;
}

export interface AppHealthSnapshot {
  generatedAt: string;
  version: {
    currentVersion: string;
    buildNumber: number;
    latestVersion: string;
    hasUpdate: boolean;
  };
  keyStatus: {
    source: 'user' | 'server' | 'none';
    sourceLabelAr: string;
    sourceLabelEn: string;
    maskedHint: string;
    remembered: boolean;
    freeCloudflareConfigured: boolean;
  };
  preflightStatus: {
    ok: boolean;
    code?: ApiErrorCode;
    listed: boolean;
    categories: {
      text: { ready: boolean; count: number; models: string[] };
      image: { ready: boolean; count: number; models: string[] };
      tts: { ready: boolean; count: number; models: string[] };
      music: { ready: boolean; count: number; models: string[] };
    };
  };
  imageEnginesSession: {
    engines: SessionEngineHealthEntry[];
    models: SessionEngineHealthEntry[];
    lastEngine: string | null;
  };
  indexedDb: {
    dbName: string;
    schemaVersion: number;
    stores: IndexedDbStoreStats;
  };
  storage: StorageEstimateInfo;
  serviceWorker: ServiceWorkerStatusInfo;
  online: boolean;
  lastErrors: SanitizedErrorItem[];
  imagePathTests?: PathTest[];
}

// أنماط المفاتيح السرية التي يجب ألا تظهر أبداً في أي تقرير منسوخ
const SECRET_PATTERNS: RegExp[] = [
  /AIza[0-9A-Za-z_-]{20,}/g,
  /AQ\.[0-9A-Za-z._-]{20,}/g,
  /Bearer\s+[0-9A-Za-z._~+/-]{16,}/gi,
  /\b[a-f0-9]{32}\b/gi,
  /sk-[0-9A-Za-z_-]{20,}/g,
];

export const redactSecretsFromText = (input: string): string => {
  let out = String(input ?? '');
  const userKey = getUserApiKey();
  if (userKey && userKey.length >= 8) {
    out = out.split(userKey).join('[REDACTED_KEY]');
  }
  const free = getFreeCreds();
  if (free?.account && free.account.length >= 8) {
    out = out.split(free.account).join('[REDACTED_CF_ACCOUNT]');
  }
  if (free?.token && free.token.length >= 8) {
    out = out.split(free.token).join('[REDACTED_CF_TOKEN]');
  }
  for (const re of SECRET_PATTERNS) {
    out = out.replace(re, '[REDACTED]');
  }
  return out;
};

export const containsRawSecretPattern = (input: string): boolean => {
  const s = String(input ?? '');
  return (
    /AIza[0-9A-Za-z_-]{20,}/.test(s) ||
    /AQ\.[0-9A-Za-z._-]{20,}/.test(s) ||
    /Bearer\s+[0-9A-Za-z._~+/-]{16,}/i.test(s) ||
    /sk-[0-9A-Za-z_-]{20,}/.test(s)
  );
};

export const buildSafeHealthReportJson = (snapshot: unknown): string => {
  const rawJson = JSON.stringify(snapshot, null, 2);
  return redactSecretsFromText(rawJson);
};

export const formatBytesAr = (bytes: number, ar = true): string => {
  if (!Number.isFinite(bytes) || bytes <= 0) return ar ? '0 بايت' : '0 B';
  const unitsAr = ['بايت', 'ك.ب', 'م.ب', 'ج.ب'];
  const unitsEn = ['B', 'KB', 'MB', 'GB'];
  let idx = 0;
  let val = bytes;
  while (val >= 1024 && idx < unitsAr.length - 1) {
    val /= 1024;
    idx++;
  }
  const formatted = idx === 0 ? Math.round(val).toString() : val.toFixed(1);
  return `${formatted} ${ar ? unitsAr[idx] : unitsEn[idx]}`;
};

const extractErrorEngineAndModel = (err: ErrorRecord): SanitizedErrorItem => {
  const firstTrail = err.trail?.[0];
  const model = firstTrail?.model || '—';
  const engine =
    err.where.includes('free') || model.includes('flux')
      ? 'cloudflare-flux'
      : err.where.includes('direct')
        ? 'direct-gemini'
        : err.where.startsWith('/api/')
          ? 'server-api'
          : err.where || 'app';
  return {
    at: err.at,
    where: err.where || 'unknown',
    code: err.code,
    engine,
    model,
    detail: err.detail ? redactSecretsFromText(err.detail).slice(0, 220) : undefined,
  };
};

export const collectIndexedDbStats = async (): Promise<IndexedDbStoreStats> => {
  const countStore = async (name: string): Promise<number> => {
    try {
      const rows = await dbAll<unknown>(name);
      return Array.isArray(rows) ? rows.length : 0;
    } catch {
      return 0;
    }
  };
  const [stories, images, audio, children, voice_profiles, characters, custom_presets] = await Promise.all([
    countStore('stories'),
    countStore('images'),
    countStore('audio'),
    countStore('children'),
    countStore('voice_profiles'),
    countStore('characters'),
    countStore('custom_presets'),
  ]);
  return {
    stories,
    images,
    audio,
    children,
    voice_profiles,
    characters,
    custom_presets,
  };
};

export const getStorageEstimateSafe = async (): Promise<StorageEstimateInfo> => {
  try {
    if (typeof navigator !== 'undefined' && navigator.storage && typeof navigator.storage.estimate === 'function') {
      const est = await navigator.storage.estimate();
      const usageBytes = Number(est.usage ?? 0);
      const quotaBytes = Number(est.quota ?? 0);
      const percent = quotaBytes > 0 ? Math.min(100, Math.round((usageBytes / quotaBytes) * 1000) / 10) : 0;
      return { supported: true, usageBytes, quotaBytes, percent };
    }
  } catch {
    // ignore
  }
  return { supported: false, usageBytes: 0, quotaBytes: 0, percent: 0 };
};

export const getServiceWorkerStatusSafe = async (): Promise<ServiceWorkerStatusInfo> => {
  let cacheNames: string[] = [];
  try {
    if (typeof caches !== 'undefined' && typeof caches.keys === 'function') {
      cacheNames = await caches.keys();
    }
  } catch {
    cacheNames = [];
  }

  try {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
      return { supported: false, state: 'unsupported', cacheNames };
    }
    const reg = await navigator.serviceWorker.getRegistration();
    if (!reg) {
      return { supported: true, state: 'none', cacheNames };
    }
    const state = reg.active ? 'active' : reg.waiting ? 'waiting' : reg.installing ? 'installing' : 'none';
    return { supported: true, state, cacheNames };
  } catch {
    return { supported: false, state: 'none', cacheNames };
  }
};

export const collectAppHealthSnapshot = async (
  cachedPreflight?: Preflight | { ok: false; code: ApiErrorCode } | null,
  imagePathTests?: PathTest[]
): Promise<AppHealthSnapshot> => {
  const [updateCheck, preResult, dbStores, storage, sw] = await Promise.all([
    checkForAppUpdate().catch(() => ({
      hasUpdate: false,
      currentVersion: CURRENT_VERSION.version,
      latestVersion: CURRENT_VERSION.version,
    })),
    cachedPreflight ? Promise.resolve(cachedPreflight) : preflight(),
    collectIndexedDbStats(),
    getStorageEstimateSafe(),
    getServiceWorkerStatusSafe(),
  ]);

  const userKey = getUserApiKey();
  const rawKey = getApiKey();
  const keySource: 'user' | 'server' | 'none' = userKey
    ? 'user'
    : preResult.ok && preResult.keySource === 'env'
      ? 'server'
      : rawKey === 'server-proxy'
        ? 'server'
        : 'none';

  const sourceLabelAr =
    keySource === 'user' ? 'مفتاح المستخدم' : keySource === 'server' ? 'مفتاح الخادم' : 'لا شيء';
  const sourceLabelEn =
    keySource === 'user' ? 'User API Key' : keySource === 'server' ? 'Server API Key' : 'None';

  const models = preResult.ok
    ? preResult.models
    : { text: [] as string[], image: [] as string[], tts: [] as string[], music: [] as string[] };

  const sessionHealth = getImageEngineSessionHealth();
  const lastErrors = getErrorLog().slice(0, 5).map(extractErrorEngineAndModel);

  return {
    generatedAt: new Date().toISOString(),
    version: {
      currentVersion: CURRENT_VERSION.version,
      buildNumber: CURRENT_VERSION.buildNumber,
      latestVersion: updateCheck.latestVersion || CURRENT_VERSION.version,
      hasUpdate: updateCheck.hasUpdate,
    },
    keyStatus: {
      source: keySource,
      sourceLabelAr,
      sourceLabelEn,
      maskedHint: redactSecretsFromText(keyHint()),
      remembered: isKeyRemembered(),
      freeCloudflareConfigured: Boolean(getFreeCreds()) || Boolean(preResult.ok && preResult.free?.configured),
    },
    preflightStatus: {
      ok: preResult.ok,
      code: preResult.ok ? undefined : preResult.code,
      listed: preResult.ok ? preResult.listed : false,
      categories: {
        text: { ready: models.text.length > 0, count: models.text.length, models: models.text },
        image: {
          ready: models.image.length > 0 || Boolean(getFreeCreds()) || Boolean(preResult.ok && preResult.free?.configured),
          count: models.image.length,
          models: models.image,
        },
        tts: { ready: models.tts.length > 0, count: models.tts.length, models: models.tts },
        music: { ready: models.music.length > 0, count: models.music.length, models: models.music },
      },
    },
    imageEnginesSession: sessionHealth,
    indexedDb: {
      dbName: DB_NAME,
      schemaVersion: DB_VERSION,
      stores: dbStores,
    },
    storage,
    serviceWorker: sw,
    online: typeof navigator !== 'undefined' ? navigator.onLine !== false : true,
    lastErrors,
    ...(imagePathTests ? { imagePathTests } : {}),
  };
};
