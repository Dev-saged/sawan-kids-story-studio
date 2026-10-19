import { ApiError, postJson, preflight, type ApiErrorCode, type TrailItem } from './api';
import { getUserApiKey, keyShape } from './apiKey';
import { hashText } from './db';
import { base64ToBlob, cropToAspect } from './media';
import type { AspectRatio } from '../types';

// طبقة الصور الموحدة: كل رسم في التطبيق يمر من هنا عبر نماذج Gemini الحقيقية فقط.
//  1) direct-user : Gemini من المتصفح بمفتاح الزائر الخاص (gemini-2.5-flash-image وغيره)
//  2) server      : الخادم (سلسلة نماذج Gemini عبر proxy مع المفتاح المحقون)
//  3) direct-env  : Gemini من المتصفح بالمفتاح المحقون
export type EngineId = 'direct-user' | 'server' | 'direct-env';

export interface ImageRequest {
  prompt: string;
  aspectRatio: AspectRatio;
  references?: { data: string; mimeType: string }[];
  kind?: string;
  artStyle?: string;
}

// يرمى عندما يتم تخطي صورة (مثلاً ورقة الشخصيات إن لم تكن مطلوبة)
export class SkippedImage extends Error {}

// نماذج Gemini لتوليد الصور
export const DIRECT_MODELS = [
  'gemini-3.1-flash-lite-image',
  'gemini-nano-banana-2.1',
  'gemini-3.1-flash-image',
  'gemini-3.1-flash-image-preview',
  'gemini-2.5-flash-image',
  'nano-banana-pro-preview',
  'gemini-3-pro-image',
  'gemini-3-pro-image-preview',
];
const DIRECT_TIMEOUT = 60_000;
const HARD_DOWN_MS = 30 * 60_000;
const SOFT_DOWN_MS = 60_000;

const injectedKey = (): string => {
  const k = typeof __DIRECT_KEY__ === 'string' ? __DIRECT_KEY__.trim() : '';
  return k === 'MY_GEMINI_API_KEY' || k.length < 20 ? '' : k;
};

// ===== أدوات نقية (تُختبر في #test) =====
export type FailKind = 'auth' | 'billing' | 'quota' | 'missing' | 'busy' | 'skip';

// حصة صفرية = النموذج خارج الخطة المجانية (ليست حصة مؤقتة)
export const isZeroQuota = (msg: string): boolean => /limit:\s*0\b|free_?tier/i.test(msg);

export const classifyFailure = (status: number, msg: string): FailKind =>
  status === 401 || /API_KEY_INVALID|API key not valid/i.test(msg)
    ? 'auth'
    : status === 403 || /PERMISSION_DENIED|permission denied/i.test(msg)
      ? 'missing'
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

const engines = (_req?: ImageRequest): Engine[] => {
  const list: Engine[] = [];
  const user = getUserApiKey();
  const env = injectedKey();
  if (user) list.push({ id: 'direct-user', slot: slot('direct-user', user), key: user });
  list.push({ id: 'server', slot: slot('server', user ?? 'env') });
  if (env && env !== user) list.push({ id: 'direct-env', slot: slot('direct-env', env), key: env });
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
  const cleanRefs = (req.references ?? [])
    .filter((r) => typeof r?.data === 'string' && r.data.trim().length > 100)
    .slice(0, 2)
    .map((r) => {
      const data = String(r.data).replace(/^data:image\/[^;]+;base64,/, '').replace(/[\r\n\s]/g, '');
      const rawMime = String(r.mimeType || '').toLowerCase();
      const mimeType = rawMime.includes('png') ? 'image/png' : rawMime.includes('webp') ? 'image/webp' : 'image/jpeg';
      return { data, mimeType };
    })
    .filter((r) => r.data.length > 200 && r.data.length < 5_000_000);

  const lead = cleanRefs.length
    ? '[STRICT CHARACTER REFERENCE ATTACHED]: Use the attached character reference sheet image(s) as the EXACT character model. Keep the identical face shape, hairstyle, hair color, skin tone, outfit design, color palette, and body proportions. '
    : '';
  const text = `${lead}${req.prompt} Masterpiece children's book illustration, sharp focus, rich detail, professional composition, consistent character design. Negative prompt: extra fingers, mutated hands, missing limbs, distorted faces, asymmetrical eyes, blurry details, double heads, cloned characters, extra limbs, floating objects, unwanted text, letters, captions, logos, signature, watermark, bad anatomy, deformed bodies, cut off heads, low resolution, jpeg artifacts.`;

  for (const model of DIRECT_MODELS) {
    let currentRefs = cleanRefs;
    for (let attempt = 0; attempt < 2; attempt++) {
      if (signal?.aborted) throw abortError();
      try {
        const parts: any[] = currentRefs.length
          ? [...currentRefs.map((r) => ({ inlineData: { data: r.data, mimeType: r.mimeType } })), { text }]
          : [{ text }];

        const response = await withTimeout(
          ai.models.generateContent({
            model,
            contents: { parts },
            config: { abortSignal: signal, imageConfig: { aspectRatio: req.aspectRatio, imageSize: '1K' } },
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
        const msg = String(err?.message ?? err).replace(/\s+/g, ' ');
        if (currentRefs.length > 0 && (/could not be decoded|source image|invalid|safety|blocked|policy|filter|size|large|face|person/i.test(msg) || attempt === 0)) {
          console.warn(`[runDirect] Reference error on ${model} ("${msg.slice(0, 80)}..."), immediately retrying cleanly with text-only character description...`);
          currentRefs = [];
          continue;
        }
        const status = Number(err?.status ?? err?.code ?? 0) || 0;
        const kind = classifyFailure(status, msg);
        trail.push({ model: `${eng.id}/${model}`, kind, status, message: msg.slice(0, 480) });

        const isDaily = /daily limit|limit:\s*0\b|free_?tier|requests today|limit of requests|tomorrow/i.test(msg);
        if (kind === 'quota') {
          if (isDaily || attempt >= 1) {
            console.warn(`[runDirect] Model ${model} reached quota limit ("${msg.slice(0, 80)}"), immediately trying next model in chain...`);
            break; // Don't retry same model on daily limit or repeat quota, try next model in DIRECT_MODELS
          }
        }

        // استراتيجية إعادة المحاولة بتأخير متصاعد أسي
        if ((kind === 'quota' || kind === 'busy') && attempt < 1) {
          const backoff = Math.min(1000 + Math.random() * 500, 3000);
          console.warn(`[runDirect] Transient busy or limit on ${model}, retrying with backoff in ${Math.round(backoff)}ms...`);
          await sleep(backoff);
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
    { prompt: req.prompt, aspectRatio: req.aspectRatio, references: req.references, kind: req.kind, artStyle: req.artStyle },
    signal
  );
  if (data?.skipped) throw new SkippedImage('Image skipped: free engine takes no reference sheet.');
  if (!data?.base64) throw new ApiError('FAILED', 'Empty image response.', undefined, '/api/generate-image');
  const blob = base64ToBlob(data.base64, data.mimeType);
  return data.engine === 'free' ? cropToAspect(blob, req.aspectRatio) : blob;
};

const run = (eng: Engine, req: ImageRequest, signal?: AbortSignal): Promise<Blob> =>
  eng.id === 'server' ? runServer(req, signal) : runDirect(eng, req, signal);

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

  // كل مسارات Gemini المباشرة أو الخادم فشلت: نُظهر أنفع رمز
  const direct = codeFromTrail(trails);
  const best: ApiErrorCode = serverErr && rankError(serverErr.code) <= rankError(direct) ? serverErr.code : direct;
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
}

const TEST_PROMPT = 'a small yellow star on a plain blue background, flat icon';

export const diagnoseImagePaths = async (): Promise<{ tests: PathTest[]; keys: KeyReport }> => {
  const tests: PathTest[] = [];
  const user = getUserApiKey();
  const env = injectedKey();
  const list: Engine[] = [];
  if (user) list.push({ id: 'direct-user', slot: slot('direct-user', user), key: user });
  list.push({ id: 'server', slot: slot('server', user ?? 'env') });
  if (env && env !== user) list.push({ id: 'direct-env', slot: slot('direct-env', env), key: env });
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
    },
  };
};
