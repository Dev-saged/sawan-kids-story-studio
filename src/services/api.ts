import { getUserApiKey } from './apiKey';

export type ApiErrorCode = 'AUTH' | 'QUOTA' | 'BILLING' | 'NOMODEL' | 'BUSY' | 'OFFLINE' | 'FAILED';

export interface TrailItem {
  model: string;
  kind: string;
  status: number;
  message: string;
}

const MESSAGES: Record<ApiErrorCode, { ar: string; en: string }> = {
  AUTH: { ar: 'مفتاح Gemini مرفوض من Google أو لا يملك صلاحية. تأكد من المفتاح.', en: 'Google rejected your Gemini key or it lacks permission.' },
  QUOTA: { ar: 'انتهت الحصة المؤقتة لهذا النموذج. انتظر قليلاً ثم أعد المحاولة.', en: 'The temporary quota is used up. Wait a bit and retry.' },
  BILLING: {
    ar: 'حصة هذا النوع من النماذج صفر على مفتاحك (الخطة المجانية لا تشمله). فعّل الفوترة على مشروع المفتاح في Google AI Studio أو استخدم مفتاحاً من مشروع مفوتر.',
    en: 'Your key has zero quota for this model type (not included in the free tier). Enable billing on the key\'s project in Google AI Studio or use a billed key.',
  },
  NOMODEL: { ar: 'لا يتوفر أي نموذج مناسب لهذا المفتاح. افتح «تفاصيل تقنية» وأرسلها للمطوّر.', en: 'No suitable model is available for this key. Open "Technical details" and send them to the developer.' },
  BUSY: { ar: 'خوادم Google مشغولة الآن. أعد المحاولة بعد لحظات.', en: 'Google servers are busy. Retry in a moment.' },
  OFFLINE: { ar: 'لا يوجد اتصال بالإنترنت.', en: 'You are offline.' },
  FAILED: { ar: 'تعذّر إكمال الطلب. أعد المحاولة.', en: 'The request could not be completed. Please retry.' },
};

const isArabicUi = (): boolean => typeof document !== 'undefined' && document.documentElement.lang === 'ar';

// سجل الأخطاء الأخيرة لعرضه في «تفاصيل تقنية»
export interface ErrorRecord {
  at: string;
  where: string;
  code: ApiErrorCode;
  detail?: string;
  trail?: TrailItem[];
}

const LOG_LIMIT = 6;
let errorLog: ErrorRecord[] = [];
const listeners = new Set<() => void>();

export const getErrorLog = (): ErrorRecord[] => errorLog;
export const subscribeErrorLog = (fn: () => void) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};

const record = (entry: ErrorRecord) => {
  errorLog = [entry, ...errorLog].slice(0, LOG_LIMIT);
  listeners.forEach((fn) => fn());
};

export class ApiError extends Error {
  constructor(public code: ApiErrorCode, public detail?: string, public trail?: TrailItem[], where = '') {
    super(isArabicUi() ? MESSAGES[code].ar : MESSAGES[code].en);
    record({ at: new Date().toISOString(), where, code, detail, trail });
  }
}

export const authHeaders = (): Record<string, string> => {
  const key = getUserApiKey();
  return key ? { 'Content-Type': 'application/json', 'x-goog-api-key': key } : { 'Content-Type': 'application/json' };
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface ErrorBody {
  error?: string;
  code?: ApiErrorCode;
  trail?: TrailItem[];
}

export const codeFromStatus = (status: number): ApiErrorCode => (status === 429 ? 'QUOTA' : status === 401 ? 'AUTH' : status === 404 ? 'NOMODEL' : status >= 500 ? 'BUSY' : 'FAILED');

// طلب JSON بإعادة محاولة متصاعدة على الانشغال وانقطاع الشبكة
export const postJson = async <T>(url: string, body: unknown, signal?: AbortSignal, attempts = 3): Promise<T> => {
  let last: ApiError = new ApiError('FAILED', undefined, undefined, url);
  for (let i = 0; i < attempts; i++) {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) throw new ApiError('OFFLINE', undefined, undefined, url);
    try {
      const res = await fetch(url, { method: 'POST', headers: authHeaders(), body: JSON.stringify(body), signal });
      if (res.ok) return (await res.json()) as T;
      let data: ErrorBody = {};
      try {
        data = await res.json();
      } catch {
        // ignore
      }
      last = new ApiError(data.code ?? codeFromStatus(res.status), data.error, data.trail, url);
      if (last.code !== 'BUSY') throw last;
    } catch (err) {
      if (err instanceof ApiError && err.code !== 'BUSY') throw err;
      if ((err as Error).name === 'AbortError') throw err;
      if (!(err instanceof ApiError)) last = new ApiError('BUSY', (err as Error).message, undefined, url);
    }
    if (i < attempts - 1) await sleep(900 * 2 ** i + Math.random() * 500);
  }
  throw last;
};

export interface Preflight {
  ok: true;
  keySource: 'user' | 'env';
  listed: boolean;
  models: { text: string[]; image: string[]; tts: string[]; music: string[] };
}

// فحص المفتاح والنماذج المتاحة له قبل البدء
export const preflight = async (signal?: AbortSignal): Promise<Preflight | { ok: false; code: ApiErrorCode }> => {
  try {
    const res = await fetch('/api/preflight', { headers: authHeaders(), signal });
    if (res.ok) return (await res.json()) as Preflight;
    let data: ErrorBody = {};
    try {
      data = await res.json();
    } catch {
      // ignore
    }
    return { ok: false, code: data.code ?? codeFromStatus(res.status) };
  } catch {
    return { ok: false, code: 'OFFLINE' };
  }
};
