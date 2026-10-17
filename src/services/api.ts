import { getFreeCreds, getUserApiKey } from './apiKey';

export type ApiErrorCode = 'AUTH' | 'QUOTA' | 'BILLING' | 'NOMODEL' | 'BUSY' | 'OFFLINE' | 'FAILED' | 'FREE_AUTH' | 'FREE_QUOTA';

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
    ar: 'حصة الصور صفر على مفتاحك (الخطة المجانية لا تشمل Nano Banana). فعّل الصور المجانية عبر Cloudflare من البطاقة أدناه، أو فعّل الفوترة على مشروع المفتاح.',
    en: 'Your key has zero image quota (the free tier excludes Nano Banana). Enable free images via Cloudflare from the card below, or enable billing on the key\'s project.',
  },
  NOMODEL: { ar: 'لا يتوفر أي نموذج مناسب لهذا المفتاح. افتح «تفاصيل تقنية» وأرسلها للمطوّر.', en: 'No suitable model is available for this key. Open "Technical details" and send them to the developer.' },
  BUSY: { ar: 'خوادم Google مشغولة الآن. أعد المحاولة بعد لحظات.', en: 'Google servers are busy. Retry in a moment.' },
  OFFLINE: { ar: 'لا يوجد اتصال بالإنترنت.', en: 'You are offline.' },
  FAILED: { ar: 'تعذّر إكمال الطلب. أعد المحاولة.', en: 'The request could not be completed. Please retry.' },
  FREE_AUTH: {
    ar: 'Cloudflare رفضت الرمز أو رقم الحساب. أعد إنشاء الرمز بصلاحية Workers AI وتأكد من نسخ Account ID صحيحاً.',
    en: 'Cloudflare rejected the token or account ID. Recreate the token with Workers AI permission and check the Account ID.',
  },
  FREE_QUOTA: {
    ar: 'استُهلكت حصة الصور المجانية اليوم في Cloudflare. تتجدد منتصف الليل بتوقيت UTC (حوالي 3 صباحاً بتوقيت فلسطين).',
    en: 'Today\'s free Cloudflare image allowance is used up. It resets at 00:00 UTC.',
  },
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
  private entry: ErrorRecord;

  constructor(public code: ApiErrorCode, public detail?: string, public trail?: TrailItem[], where = '') {
    super(isArabicUi() ? MESSAGES[code].ar : MESSAGES[code].en);
    this.entry = { at: new Date().toISOString(), where, code, detail, trail };
    record(this.entry);
  }

  // يضيف محاولات مسارات أخرى (مثل المسار المباشر) إلى سجل نفس الخطأ بدل تكرار سطر جديد
  addTrail(items: TrailItem[]): void {
    this.trail = [...items, ...(this.trail ?? [])];
    this.entry.trail = this.trail;
    errorLog = [...errorLog];
    listeners.forEach((fn) => fn());
  }
}

export const authHeaders = (): Record<string, string> => {
  const key = getUserApiKey();
  const free = getFreeCreds();
  return {
    'Content-Type': 'application/json',
    ...(key ? { 'x-goog-api-key': key } : {}),
    ...(free ? { 'x-cf-account': free.account, 'x-cf-token': free.token } : {}),
  };
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
  // لا نُنشئ ApiError مسبقاً: الإنشاء يسجّل في «تفاصيل تقنية» وكان يظهر خطأ FAILED فارغ مع كل طلب
  let last: ApiError | null = null;
  for (let i = 0; i < attempts; i++) {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) throw new ApiError('OFFLINE', undefined, undefined, url);
    try {
      const res = await fetch(url, { method: 'POST', headers: authHeaders(), body: JSON.stringify(body), signal });
      if (res.ok) return (await res.json()) as T;
      let data: ErrorBody = {};
      let raw = '';
      try {
        raw = await res.text();
        data = JSON.parse(raw);
      } catch {
        // رد غير JSON (بوابة أو انتهاء مهلة): نحفظ بدايته للتشخيص
      }
      last = new ApiError(data.code ?? codeFromStatus(res.status), data.error ?? `HTTP ${res.status} ${raw.replace(/\s+/g, ' ').slice(0, 300)}`, data.trail, url);
      if (last.code !== 'BUSY') throw last;
    } catch (err) {
      if (err instanceof ApiError && err.code !== 'BUSY') throw err;
      if ((err as Error).name === 'AbortError') throw err;
      if (!(err instanceof ApiError)) last = new ApiError('BUSY', (err as Error).message, undefined, url);
    }
    if (i < attempts - 1) await sleep(900 * 2 ** i + Math.random() * 500);
  }
  throw last ?? new ApiError('FAILED', undefined, undefined, url);
};

export interface Preflight {
  ok: true;
  keySource: 'user' | 'env';
  listed: boolean;
  free?: { configured: boolean };
  models: { text: string[]; image: string[]; tts: string[]; music: string[] };
}

// اختبار بيانات Cloudflare بصورة صغيرة فعلية
export const checkFree = async (): Promise<{ ok: true } | { ok: false; code: ApiErrorCode; detail?: string }> => {
  try {
    const res = await fetch('/api/free-check', { headers: authHeaders() });
    if (res.ok) return { ok: true };
    let data: ErrorBody = {};
    try {
      data = await res.json();
    } catch {
      // ignore
    }
    return { ok: false, code: data.code ?? codeFromStatus(res.status), detail: data.error };
  } catch {
    return { ok: false, code: 'OFFLINE' };
  }
};

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
