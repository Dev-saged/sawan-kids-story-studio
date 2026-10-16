import { getUserApiKey } from './apiKey';

export type ApiErrorCode = 'AUTH' | 'QUOTA' | 'BUSY' | 'OFFLINE' | 'FAILED';

const MESSAGES: Record<ApiErrorCode, { ar: string; en: string }> = {
  AUTH: { ar: 'مفتاح Gemini غير صالح أو لا يملك صلاحية. تأكد من المفتاح.', en: 'Your Gemini key is invalid or lacks permission.' },
  QUOTA: { ar: 'انتهت الحصة المتاحة حالياً لكل النماذج. انتظر قليلاً ثم أعد المحاولة.', en: 'Quota is used up for all models right now. Wait a bit and retry.' },
  BUSY: { ar: 'خوادم Google مشغولة الآن. أعد المحاولة بعد لحظات.', en: 'Google servers are busy. Retry in a moment.' },
  OFFLINE: { ar: 'لا يوجد اتصال بالإنترنت.', en: 'You are offline.' },
  FAILED: { ar: 'تعذّر إكمال الطلب. أعد المحاولة.', en: 'The request could not be completed. Please retry.' },
};

const isArabicUi = (): boolean => typeof document !== 'undefined' && document.documentElement.lang === 'ar';

export class ApiError extends Error {
  constructor(public code: ApiErrorCode, public detail?: string) {
    super(isArabicUi() ? MESSAGES[code].ar : MESSAGES[code].en);
  }
}

export const authHeaders = (): Record<string, string> => {
  const key = getUserApiKey();
  return key ? { 'Content-Type': 'application/json', 'x-goog-api-key': key } : { 'Content-Type': 'application/json' };
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// طلب JSON بإعادة محاولة متصاعدة على الانشغال وانقطاع الشبكة
export const postJson = async <T>(url: string, body: unknown, signal?: AbortSignal, attempts = 3): Promise<T> => {
  let last: ApiError = new ApiError('FAILED');
  for (let i = 0; i < attempts; i++) {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) throw new ApiError('OFFLINE');
    try {
      const res = await fetch(url, { method: 'POST', headers: authHeaders(), body: JSON.stringify(body), signal });
      if (res.ok) return (await res.json()) as T;
      let data: { error?: string; code?: ApiErrorCode } = {};
      try {
        data = await res.json();
      } catch {
        // ignore
      }
      const code: ApiErrorCode = data.code ?? (res.status === 429 ? 'QUOTA' : res.status === 401 ? 'AUTH' : res.status >= 500 ? 'BUSY' : 'FAILED');
      last = new ApiError(code, data.error);
      if (code !== 'BUSY') throw last;
    } catch (err) {
      if (err instanceof ApiError && err.code !== 'BUSY') throw err;
      if ((err as Error).name === 'AbortError') throw err;
      if (!(err instanceof ApiError)) last = new ApiError('BUSY', (err as Error).message);
    }
    if (i < attempts - 1) await sleep(900 * 2 ** i + Math.random() * 500);
  }
  throw last;
};
