import { ApiError, postJson, preflight, type ApiErrorCode, type TrailItem } from './api';
import { getFreeCreds, getUserApiKey, isWebFreeEnabled, keyShape } from './apiKey';
import { hashText } from './db';
import { base64ToBlob, cropToAspect } from './media';
import type { AspectRatio } from '../types';

// طبقة الصور الموحدة: كل رسم في التطبيق يمر من هنا، ومن المتصفح أولاً (كما تعمل النسخة المرجعية).
// السلّم بالترتيب، وكل درجة تُجرَّب عند فشل التي قبلها:
//  1) direct-user : Gemini من المتصفح بمفتاح الزائر الخاص          (gemini-2.5-flash-image)
//  2) direct-env  : Gemini من المتصفح بالمفتاح المحقون من AI Studio (نفس النموذج، حتى لو كان placeholder)
//  3) server      : الخادم (سلسلة Nano Banana + Cloudflare FLUX المجاني إن أُعدّ)
//  4) web-free    : Pollinations مجاني بلا مفتاح (علامة مائية، بلا صور مرجعية) كشبكة أمان أخيرة
export type EngineId = 'direct-user' | 'direct-env' | 'server' | 'web-free';

export interface ImageRequest {
  prompt: string;
  aspectRatio: AspectRatio;
  references?: { data: string; mimeType: string }[];
  kind?: string;
}

// يرمى عندما لا يحتاج المحرك المجاني ورقة الشخصيات؛ ليس ApiError كي لا يُسجَّل
export class SkippedImage extends Error {}

// النموذج المثبت عمله داخل AI Studio في النسخة المرجعية
export const DIRECT_MODELS = ['gemini-2.5-flash-image'];
const DIRECT_TIMEOUT = 60_000;
const WEB_TIMEOUT = 80_000;
const HARD_DOWN_MS = 30 * 60_000;
const SOFT_DOWN_MS = 60_000;
const WEB_BASE = 'https://image.pollinations.ai';

const injectedKey = (): string => (typeof __DIRECT_KEY__ === 'string' ? __DIRECT_KEY__.trim() : '');

// ===== أدوات نقية (تُختبر في #test) =====
export type FailKind = 'auth' | 'billing' | 'quota' | 'missing' | 'busy' | 'skip';

// حصة صفرية = النموذج خارج الخطة المجانية (ليست حصة مؤقتة)
export const isZeroQuota = (msg: string): boolean => /limit:\s*0\b|free_?tier/i.test(msg);

export const classifyFailure = (status: number, msg: string): FailKind =>
  status === 401 || status === 402 || status === 403 || /API_KEY_INVALID|API key not valid|PERMISSION_DENIED/i.test(msg)
    ? 'auth'
    : status === 429 || /RESOURCE_EXHAUSTED|quota/i.test(msg)
      ? isZeroQuota(msg)
        ? 'billing'
        : 'quota'
      : status === 404 || /NOT_FOUND|is not found|not supported for/i.test(msg)
        ? 'missing'
        : status >= 500 || /UNAVAILABLE|overloaded|timeout|Failed to fetch|NetworkError/i.test(msg)
          ? 'busy'
          : 'skip';

// أدق رمز لمستخدم التطبيق من سجل محاولات المسار المباشر
export const codeFromTrail = (trail: TrailItem[]): ApiErrorCode => {
  const quota = trail.filter((t) => t.kind === 'quota' || t.kind === 'billing');
  if (quota.length) return quota.every((t) => t.kind === 'billing') ? 'BILLING' : 'QUOTA';
  if (trail.some((t) => t.kind === 'auth')) return 'AUTH';
  if (trail.length && trail.every((t) => t.kind === 'missing')) return 'NOMODEL';
  if (trail.some((t) => t.kind === 'busy')) return 'BUSY';
  return 'FAILED';
};

// أيّ الأخطاء أنفع للمستخدم عند فشل كل المحركات (الأصغر أولاً)
const RANK: Record<ApiErrorCode, number> = { FREE_AUTH: 0, FREE_QUOTA: 0, BILLING: 1, QUOTA: 2, NOKEY: 3, AUTH: 4, NOMODEL: 5, BUSY: 6, OFFLINE: 7, FAILED: 8 };
export const rankError = (code: ApiErrorCode): number => RANK[code] ?? 9;

// أخطاء دائمة: لا فائدة من إعادة المحاولة معها في هذه الجلسة
const HARD: ReadonlySet<ApiErrorCode> = new Set(['BILLING', 'AUTH', 'NOKEY', 'NOMODEL', 'FREE_AUTH']);

export const WEB_SIZES: Record<AspectRatio, [number, number]> = {
  '1:1': [1024, 1024],
  '4:3': [1024, 768],
  '3:4': [768, 1024],
  '16:9': [1024, 576],
  '9:16': [576, 1024],
};

export const webFreeUrl = (prompt: string, aspect: AspectRatio, seed: number): string => {
  const [w, h] = WEB_SIZES[aspect] ?? WEB_SIZES['4:3'];
  const text = `${prompt.replace(/\s+/g, ' ').trim().slice(0, 700)}, children's book illustration, no text, no letters`;
  return `${WEB_BASE}/prompt/${encodeURIComponent(text)}?width=${w}&height=${h}&seed=${seed}&nologo=true&safe=true&nofeed=true&private=true`;
};

// ===== صحة المحركات داخل الجلسة =====
const down = new Map<string, number>();
const slot = (id: EngineId, key?: string) => (key ? `${id}:${hashText(key)}` : id);
const isDown = (k: string) => (down.get(k) ?? 0) > Date.now();
const markDown = (k: string, ms: number) => down.set(k, Date.now() + ms);

interface Engine {
  id: EngineId;
  slot: string;
  key?: string;
}

const engines = (req: ImageRequest): Engine[] => {
  const list: Engine[] = [];
  const user = getUserApiKey();
  const env = injectedKey();
  if (user) list.push({ id: 'direct-user', slot: slot('direct-user', user), key: user });
  if (env && env !== user) list.push({ id: 'direct-env', slot: slot('direct-env', env), key: env });
  list.push({ id: 'server', slot: slot('server', user ?? 'env') });
  // المحرك المجاني لا يقبل صوراً مرجعية: ورقة الشخصيات لا تُرسل إليه
  if (isWebFreeEnabled() && req.kind !== 'sheet') list.push({ id: 'web-free', slot: slot('web-free') });
  const live = list.filter((e) => !isDown(e.slot));
  return live.length ? live : list;
};

let lastEngine: EngineId | null = null;
export const getLastEngine = (): EngineId | null => lastEngine;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const abortError = () => new DOMException('Aborted', 'AbortError');

const withTimeout = <T,>(p: Promise<T>, ms: number): Promise<T> => {
  let timer: ReturnType<typeof setTimeout>;
  return Promise.race([p, new Promise<T>((_, rej) => (timer = setTimeout(() => rej(new Error('timeout')), ms)))]).finally(() => clearTimeout(timer));
};

const failed = (trail: TrailItem[]): Error & { trail: TrailItem[] } => Object.assign(new Error('engine failed'), { trail });

// ===== 1/2: Gemini من المتصفح (نفس استدعاء النسخة المرجعية) =====
const runDirect = async (eng: Engine, req: ImageRequest, signal?: AbortSignal): Promise<Blob> => {
  const { GoogleGenAI } = await import('@google/genai');
  const ai = new GoogleGenAI({ apiKey: eng.key! });
  const trail: TrailItem[] = [];
  const lead = req.references?.length
    ? 'Use the attached reference image(s) as the exact character design: keep the same face, hairstyle, skin tone, outfit, colors and proportions. Do not copy their background or pose. '
    : '';
  const text = `${lead}${req.prompt} Masterpiece children's book illustration, sharp focus, rich detail, professional composition, consistent character design. Absolutely no text, letters, captions, logos or watermark.`;
  for (const model of DIRECT_MODELS) {
    for (let attempt = 0; attempt < 2; attempt++) {
      if (signal?.aborted) throw abortError();
      try {
        const response = await withTimeout(
          ai.models.generateContent({
            model,
            contents: { parts: [...(req.references ?? []).map((r) => ({ inlineData: r })), { text }] },
            config: { abortSignal: signal, imageConfig: { aspectRatio: req.aspectRatio } },
          }),
          DIRECT_TIMEOUT
        );
        const cand = response.candidates?.[0];
        const part = (cand?.content?.parts ?? []).find((p) => p.inlineData?.data);
        if (part?.inlineData?.data) return base64ToBlob(part.inlineData.data, part.inlineData.mimeType || 'image/png');
        const why = [response.promptFeedback?.blockReason, cand?.finishReason, cand?.content?.parts?.find((p) => p.text)?.text?.slice(0, 120)].filter(Boolean).join(' · ');
        trail.push({ model: `${eng.id}/${model}`, kind: 'skip', status: 0, message: `No image returned${why ? `: ${why}` : '.'}` });
        break;
      } catch (err: any) {
        if (signal?.aborted || err?.name === 'AbortError') throw abortError();
        const status = Number(err?.status ?? err?.code ?? 0) || 0;
        const msg = String(err?.message ?? err).replace(/\s+/g, ' ');
        const kind = classifyFailure(status, msg);
        trail.push({ model: `${eng.id}/${model}`, kind, status, message: msg.slice(0, 480) });
        if (kind === 'busy' && attempt === 0) {
          await sleep(1200);
          continue;
        }
        break;
      }
    }
  }
  throw failed(trail);
};

// ===== 3: الخادم =====
const runServer = async (req: ImageRequest, signal?: AbortSignal): Promise<Blob> => {
  const data = await postJson<{ base64?: string; mimeType: string; skipped?: boolean; engine?: string }>(
    '/api/generate-image',
    { prompt: req.prompt, aspectRatio: req.aspectRatio, references: req.references, kind: req.kind },
    signal
  );
  if (data?.skipped) throw new SkippedImage('Image skipped: free engine takes no reference sheet.');
  if (!data?.base64) throw new ApiError('FAILED', 'Empty image response.', undefined, '/api/generate-image');
  const blob = base64ToBlob(data.base64, data.mimeType);
  return data.engine === 'free' ? cropToAspect(blob, req.aspectRatio) : blob;
};

// ===== 4: Pollinations (مجاني بلا مفتاح). طلب واحد في كل مرة: الطبقة المجانية تحدّ التوازي =====
let webChain: Promise<unknown> = Promise.resolve();

const fetchWeb = async (req: ImageRequest, signal?: AbortSignal): Promise<Blob> => {
  const trail: TrailItem[] = [];
  for (let attempt = 0; attempt < 3; attempt++) {
    if (signal?.aborted) throw abortError();
    const ctrl = new AbortController();
    const onAbort = () => ctrl.abort();
    signal?.addEventListener('abort', onAbort);
    const timer = setTimeout(() => ctrl.abort(), WEB_TIMEOUT);
    try {
      const res = await fetch(webFreeUrl(req.prompt, req.aspectRatio, Math.floor(Math.random() * 1e9)), { signal: ctrl.signal });
      const type = res.headers.get('content-type') ?? '';
      if (res.ok && type.startsWith('image/')) {
        const blob = await res.blob();
        if (blob.size > 2000) return cropToAspect(blob, req.aspectRatio);
        trail.push({ model: 'web-free/pollinations', kind: 'skip', status: res.status, message: 'Image too small.' });
        break;
      }
      const body = (await res.text().catch(() => '')).replace(/\s+/g, ' ').slice(0, 300);
      const kind = classifyFailure(res.status, body);
      trail.push({ model: 'web-free/pollinations', kind, status: res.status, message: body || `HTTP ${res.status}` });
      if ((kind === 'quota' || kind === 'busy') && attempt < 2) {
        await sleep(2500 * (attempt + 1));
        continue;
      }
      break;
    } catch (err: any) {
      if (signal?.aborted) throw abortError();
      const msg = err?.name === 'AbortError' ? 'timeout' : String(err?.message ?? err);
      trail.push({ model: 'web-free/pollinations', kind: classifyFailure(0, msg), status: 0, message: msg });
      if (attempt < 1) {
        await sleep(1500);
        continue;
      }
      break;
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
    }
  }
  throw failed(trail);
};

const runWeb = (req: ImageRequest, signal?: AbortSignal): Promise<Blob> => {
  const job = webChain.then(() => fetchWeb(req, signal));
  webChain = job.catch(() => undefined);
  return job;
};

const run = (eng: Engine, req: ImageRequest, signal?: AbortSignal): Promise<Blob> =>
  eng.id === 'server' ? runServer(req, signal) : eng.id === 'web-free' ? runWeb(req, signal) : runDirect(eng, req, signal);

// ===== السلّم =====
export const generateIllustration = async (req: ImageRequest, signal?: AbortSignal): Promise<Blob> => {
  const trails: TrailItem[] = [];
  let serverErr: ApiError | null = null;
  for (const eng of engines(req)) {
    if (signal?.aborted) throw abortError();
    try {
      const blob = await run(eng, req, signal);
      lastEngine = eng.id;
      down.delete(eng.slot);
      return blob;
    } catch (err: any) {
      if (err?.name === 'AbortError' || err instanceof SkippedImage) throw err;
      if (err instanceof ApiError) {
        serverErr = err;
        if (HARD.has(err.code)) markDown(eng.slot, HARD_DOWN_MS);
        else if (err.code === 'QUOTA') markDown(eng.slot, SOFT_DOWN_MS);
        continue;
      }
      const trail = (err?.trail as TrailItem[] | undefined) ?? [];
      trails.push(...trail);
      const code = codeFromTrail(trail);
      if (HARD.has(code)) markDown(eng.slot, HARD_DOWN_MS);
      else if (code === 'QUOTA') markDown(eng.slot, SOFT_DOWN_MS);
    }
  }

  // كل المحركات فشلت: نُظهر أنفع رمز (حصة صفرية أوضح من «لا مفتاح على الخادم»)
  const direct = codeFromTrail(trails.filter((t) => !t.model.startsWith('web-free')));
  const best: ApiErrorCode = serverErr && rankError(serverErr.code) <= rankError(direct) ? serverErr.code : direct;
  // ورقة الشخصيات: المحرك المجاني لا يقبلها، فنتخطاها بدل إيقاف رسم الصفحات
  if (req.kind === 'sheet' && isWebFreeEnabled() && HARD.has(best)) throw new SkippedImage('Character sheet skipped: no reference-capable engine.');
  if (serverErr && best === serverErr.code) {
    if (trails.length) serverErr.addTrail(trails);
    throw serverErr;
  }
  throw new ApiError(best, trails.map((t) => `${t.model}: ${t.message}`).join(' | ').slice(0, 900) || undefined, trails, 'image-engine');
};

// ===== فحص صريح لكل محرك (زر «تفاصيل تقنية») =====
export interface PathTest {
  engine: EngineId;
  ok: boolean;
  ms: number;
  detail?: string;
}

export interface KeyReport {
  injected: string;
  user: string;
  server: string;
  webFree: boolean;
  cloudflare: boolean;
}

const TEST_PROMPT = 'a small yellow star on a plain blue background, flat icon';

export const diagnoseImagePaths = async (): Promise<{ tests: PathTest[]; keys: KeyReport }> => {
  const tests: PathTest[] = [];
  const user = getUserApiKey();
  const env = injectedKey();
  const list: Engine[] = [];
  if (user) list.push({ id: 'direct-user', slot: slot('direct-user', user), key: user });
  if (env && env !== user) list.push({ id: 'direct-env', slot: slot('direct-env', env), key: env });
  list.push({ id: 'server', slot: slot('server', user ?? 'env') });
  if (isWebFreeEnabled()) list.push({ id: 'web-free', slot: slot('web-free') });
  const probe: ImageRequest = { prompt: TEST_PROMPT, aspectRatio: '1:1', kind: 'diag' };
  for (const eng of list) {
    const t0 = performance.now();
    try {
      await run(eng, probe);
      down.delete(eng.slot);
      tests.push({ engine: eng.id, ok: true, ms: Math.round(performance.now() - t0) });
    } catch (err: any) {
      const item = (err?.trail as TrailItem[] | undefined)?.[0];
      const detail = err instanceof ApiError ? `${err.code} ${String(err.detail ?? '')}` : item ? `${item.kind} ${item.status} ${item.message}` : String(err?.message ?? err);
      tests.push({ engine: eng.id, ok: false, ms: Math.round(performance.now() - t0), detail: detail.trim().slice(0, 300) });
    }
  }
  const pre = await preflight();
  return {
    tests,
    keys: {
      injected: keyShape(env),
      user: keyShape(user ?? ''),
      server: pre.ok ? `${pre.keySource} key` : pre.code,
      webFree: isWebFreeEnabled(),
      cloudflare: Boolean(getFreeCreds()),
    },
  };
};
