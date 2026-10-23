import { ApiError } from './api';
import { reencode } from './media';

// طابور Colab عبر Cloudflare Worker: التطبيق يضع مهمة (صورة + وصف حركة) ودفتر Colab يسحبها ويرفع المقطع

export interface ColabConfig {
  url: string;
  token: string;
}

export interface ColabStatus {
  queued: number;
  running: number;
  workerSeenSeconds: number | null;
}

const KEY = 'sawan-colab-queue';
const POLL_MS = 5000;
const JOB_TIMEOUT_MS = 40 * 60_000;
const WORKER_ALIVE_SECONDS = 90;

// https فقط (و http للجهاز المحلي للتجارب)، بدون مسار ولا معاملات
export const normalizeQueueUrl = (raw: string): string | null => {
  try {
    const u = new URL(raw.trim());
    const local = u.hostname === 'localhost' || u.hostname === '127.0.0.1';
    if (u.protocol !== 'https:' && !(local && u.protocol === 'http:')) return null;
    return `${u.protocol}//${u.host}`;
  } catch {
    return null;
  }
};

export const loadColabConfig = (): ColabConfig | null => {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || 'null');
    const url = typeof raw?.url === 'string' ? normalizeQueueUrl(raw.url) : null;
    return url && typeof raw?.token === 'string' && raw.token.length >= 16 ? { url, token: raw.token } : null;
  } catch {
    return null;
  }
};

export const saveColabConfig = (url: string, token: string): ColabConfig | null => {
  const clean = normalizeQueueUrl(url);
  const tok = token.trim();
  if (!clean || tok.length < 16) return null;
  try {
    localStorage.setItem(KEY, JSON.stringify({ url: clean, token: tok }));
  } catch {
    // ignore
  }
  return { url: clean, token: tok };
};

export const clearColabConfig = () => {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
};

export const isWorkerOnline = (s: ColabStatus | null): boolean => s?.workerSeenSeconds != null && s.workerSeenSeconds < WORKER_ALIVE_SECONDS;

const sleep = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => {
      clearTimeout(t);
      reject(new DOMException('Aborted', 'AbortError'));
    });
  });

const call = async (cfg: ColabConfig, method: string, path: string, body?: BodyInit, headers: Record<string, string> = {}, signal?: AbortSignal): Promise<Response> => {
  try {
    return await fetch(cfg.url + path, { method, body, signal, headers: { 'x-sawan-key': cfg.token, ...headers } });
  } catch (err) {
    if ((err as Error)?.name === 'AbortError') throw err;
    throw new ApiError('OFFLINE', 'تعذّر الوصول إلى طابور Cloudflare. تحقق من الرابط والاتصال.', undefined, path);
  }
};

const failFrom = async (res: Response, path: string): Promise<never> => {
  let msg = `رد الطابور ${res.status}`;
  try {
    msg = ((await res.json()) as { error?: string }).error || msg;
  } catch {
    // ignore
  }
  if (res.status === 401) throw new ApiError('AUTH', 'رمز الطابور مرفوض؛ تأكد من APP_TOKEN.', undefined, path);
  throw new ApiError(res.status === 429 ? 'BUSY' : 'FAILED', msg, undefined, path);
};

export const fetchColabStatus = async (cfg: ColabConfig, signal?: AbortSignal): Promise<ColabStatus> => {
  const res = await call(cfg, 'GET', '/status', undefined, {}, signal);
  if (!res.ok) return failFrom(res, '/status');
  const d = (await res.json()) as Partial<ColabStatus>;
  return { queued: d.queued ?? 0, running: d.running ?? 0, workerSeenSeconds: typeof d.workerSeenSeconds === 'number' ? d.workerSeenSeconds : null };
};

export interface ColabJobInput {
  key: string;
  prompt: string;
  aspect: '16:9' | '9:16';
  seconds: number;
  image: Blob;
}

// صورة البداية بدقة جيدة (أقصى ضلع 1280) بدل المرجع المصغّر
export const prepareStartImage = (blob: Blob): Promise<Blob> => reencode(blob, 1280, 'image/jpeg', 0.9);

export const submitColabJob = async (cfg: ColabConfig, input: ColabJobInput, signal?: AbortSignal): Promise<string> => {
  const image = await prepareStartImage(input.image);
  const created = await call(cfg, 'POST', '/jobs', JSON.stringify({ key: input.key, prompt: input.prompt, aspect: input.aspect, seconds: input.seconds, mime: image.type || 'image/jpeg' }), { 'content-type': 'application/json' }, signal);
  if (!created.ok) return failFrom(created, '/jobs');
  const job = (await created.json()) as { id: string; status: string; reused?: boolean };
  if (job.status === 'awaiting') {
    const up = await call(cfg, 'PUT', `/jobs/${job.id}/image`, image, { 'content-type': image.type || 'image/jpeg' }, signal);
    if (!up.ok) return failFrom(up, `/jobs/${job.id}/image`);
  }
  return job.id;
};

export const waitColabJob = async (cfg: ColabConfig, id: string, signal: AbortSignal, onTick?: (s: { status: string; queued: number }) => void): Promise<void> => {
  const started = Date.now();
  for (;;) {
    if (Date.now() - started > JOB_TIMEOUT_MS) throw new ApiError('FAILED', 'انتظر التطبيق طويلاً دون مقطع؛ تأكد أن دفتر Colab يعمل ثم أعد المحاولة (ما اكتمل يبقى محفوظاً).', undefined, '/jobs');
    const res = await call(cfg, 'GET', `/jobs/${id}`, undefined, {}, signal);
    if (res.status === 404) throw new ApiError('FAILED', 'اختفت المهمة من الطابور (ربما انتهت صلاحيتها). أعد التوليد.', undefined, '/jobs');
    if (!res.ok) return failFrom(res, '/jobs');
    const d = (await res.json()) as { status: string; error?: string };
    if (d.status === 'done') return;
    if (d.status === 'error') throw new ApiError('FAILED', `فشل Colab: ${d.error || 'سبب غير معروف'}`, undefined, '/jobs');
    onTick?.({ status: d.status, queued: 0 });
    await sleep(POLL_MS, signal);
  }
};

export const deleteColabJob = async (cfg: ColabConfig, id: string): Promise<void> => {
  try {
    await call(cfg, 'DELETE', `/jobs/${id}`);
  } catch {
    // تنظيف اختياري؛ الصلاحية تنتهي تلقائياً بعد 24 ساعة
  }
};

export const downloadColabVideo = async (cfg: ColabConfig, id: string, signal?: AbortSignal): Promise<Blob> => {
  const res = await call(cfg, 'GET', `/jobs/${id}/video`, undefined, {}, signal);
  if (!res.ok) return failFrom(res, `/jobs/${id}/video`);
  const blob = await res.blob();
  return blob.type.startsWith('video/') ? blob : new Blob([blob], { type: 'video/mp4' });
};

// آخر إطار من مقطع محفوظ: يبدأ منه الجزء التالي من نفس المشهد
export const lastFrameOf = (video: Blob): Promise<Blob> =>
  new Promise((resolve, reject) => {
    const url = URL.createObjectURL(video);
    const el = document.createElement('video');
    el.muted = true;
    el.playsInline = true;
    el.preload = 'auto';
    const done = (fn: () => void) => {
      URL.revokeObjectURL(url);
      el.removeAttribute('src');
      el.load();
      fn();
    };
    el.onerror = () => done(() => reject(new ApiError('FAILED', 'تعذّر قراءة المقطع السابق لمتابعة المشهد.', undefined, 'lastFrame')));
    el.onloadedmetadata = () => {
      el.currentTime = Math.max(0, (Number.isFinite(el.duration) ? el.duration : 1) - 0.08);
    };
    el.onseeked = () => {
      const c = document.createElement('canvas');
      c.width = el.videoWidth;
      c.height = el.videoHeight;
      c.getContext('2d')?.drawImage(el, 0, 0);
      c.toBlob((b) => done(() => (b ? resolve(b) : reject(new ApiError('FAILED', 'تعذّر التقاط آخر إطار.', undefined, 'lastFrame')))), 'image/jpeg', 0.92);
    };
    el.src = url;
  });
