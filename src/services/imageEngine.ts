import { ApiError, postJson, preflight, type ApiErrorCode, type TrailItem } from './api';
import { getUserApiKey, keyShape } from './apiKey';
import { hashText } from './db';
import { base64ToBlob, cropToAspect } from './media';
import { NO_SIZE_IMAGE_MODELS, POSITIVE_ILLUSTRATION_DIRECTIVE } from '../../shared/config.ts';
import type { AspectRatio, AudienceLevel } from '../types';

// طبقة الصور الموحدة: كل رسم في التطبيق يمر من هنا
export type EngineId = 'direct-user' | 'server' | 'direct-env';
export type DrawnEngineKind = 'gemini' | 'flux' | 'pollinations';

export interface ImageRequest {
  prompt: string;
  aspectRatio: AspectRatio;
  references?: { data: string; mimeType: string }[];
  kind?: string;
  artStyle?: string;
  styleConsistency?: string;
  audienceLevel?: AudienceLevel;
}

// سجل تقني لكل صورة مرسومة: المحرك الذي رسمها وأول 300 حرف من الطلب المرسل فعلاً
export interface DrawnImageRecord {
  id: string;
  kind: string;
  engine: DrawnEngineKind;
  model: string;
  promptSnippet: string;
  timestamp: string;
}

const drawnImages: DrawnImageRecord[] = [];
const drawnListeners = new Set<() => void>();

export const recordDrawnImage = (entry: Omit<DrawnImageRecord, 'id' | 'timestamp'>): void => {
  drawnImages.unshift({
    ...entry,
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    promptSnippet: entry.promptSnippet.slice(0, 300),
    timestamp: new Date().toISOString(),
  });
  if (drawnImages.length > 50) drawnImages.pop();
  drawnListeners.forEach((fn) => fn());
};

export const getDrawnImagesLog = (): DrawnImageRecord[] => drawnImages;
export const subscribeDrawnImages = (fn: () => void): (() => void) => {
  drawnListeners.add(fn);
  return () => drawnListeners.delete(fn);
};

// يرمى عندما يتم تخطي صورة (مثلاً ورقة الشخصيات إن لم تكن مطلوبة)
export class SkippedImage extends Error {}

// نماذج Gemini الفعلية لتوليد الصور
export const DIRECT_MODELS = [
  'gemini-2.5-flash-image',
  'gemini-3.1-flash-lite-image',
  'gemini-3.1-flash-image-preview',
  'gemini-nano-banana-2.1',
  'gemini-3-pro-image-preview',
  'gemini-3-pro-image',
];
const DIRECT_TIMEOUT = 60_000;
const HARD_DOWN_MS = 30 * 60_000;
const SOFT_DOWN_MS = 5 * 60_000;

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
      : status === 429 || /RESOURCE_EXHAUSTED|quota|rate limit|limit of requests|token limit/i.test(msg)
        ? isZeroQuota(msg)
          ? 'billing'
          : 'quota'
        : status === 404 || /NOT_FOUND|is not found|not supported for/i.test(msg)
          ? 'missing'
          : status >= 500 || /UNAVAILABLE|overloaded|timeout|Failed to fetch|NetworkError|Failed to call the Gemini API/i.test(msg)
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

const RANK: Record<ApiErrorCode, number> = { FREE_AUTH: 0, FREE_QUOTA: 0, BILLING: 1, QUOTA: 2, NOKEY: 3, AUTH: 4, NOMODEL: 5, BUSY: 6, OFFLINE: 7, FAILED: 8 };
export const rankError = (code: ApiErrorCode): number => RANK[code] ?? 9;

const HARD: ReadonlySet<ApiErrorCode> = new Set(['BILLING', 'AUTH', 'NOKEY', 'NOMODEL', 'FREE_AUTH']);

// ===== صحة المحركات والنماذج داخل الجلسة =====
const down = new Map<string, number>();
const directModelDown = new Map<string, number>();
const slot = (id: EngineId, key?: string) => (key ? `${id}:${hashText(key)}` : id);
const isDown = (k: string) => (down.get(k) ?? 0) > Date.now();
const markDown = (k: string, ms: number) => down.set(k, Date.now() + ms);
const isModelDown = (slotKey: string, model: string) => (directModelDown.get(`${slotKey}:${model}`) ?? 0) > Date.now();
const markModelDown = (slotKey: string, model: string, ms: number) => directModelDown.set(`${slotKey}:${model}`, Date.now() + ms);

interface Engine {
  id: EngineId;
  slot: string;
  key?: string;
}

const engines = (_req?: ImageRequest): Engine[] => {
  const list: Engine[] = [];
  const user = getUserApiKey();
  if (user) list.push({ id: 'direct-user', slot: slot('direct-user', user), key: user });
  // مسار الخادم يشمل مفتاح الخادم + Cloudflare Flux + Pollinations الاحتياطي، فلا يُستبعد أبداً
  list.push({ id: 'server', slot: slot('server', user ?? 'env') });
  const live = list.filter((e) => e.id === 'server' || !isDown(e.slot));
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

// يبني النص النهائي المرسل للنموذج مع الحفاظ على الأسلوب الفني والمشهد (Scene:) في الصدارة دائماً وتثبيت الأسلوب
export const buildFinalImageText = (
  rawPrompt: string,
  hasRefs: boolean,
  styleConsistency?: string,
  audienceLevel?: AudienceLevel,
  artStyle?: string
): string => {
  const base = rawPrompt.trim();
  const cleanConsistency = (styleConsistency ?? '').trim();
  const hasConsistencyAlready = cleanConsistency && base.toLowerCase().includes(cleanConsistency.slice(0, 18).toLowerCase());

  // تعزيز الأسلوب الفني المختار في صدارة التوجيهات
  let explicitStyleLine = '';
  if (artStyle && !base.toLowerCase().includes(artStyle.toLowerCase())) {
    explicitStyleLine = `\nArt style: Masterpiece ${artStyle} illustration, unified aesthetic theme.`;
  }

  const consistencyLine =
    cleanConsistency && cleanConsistency.toLowerCase() !== 'auto' && !hasConsistencyAlready
      ? `\nStyle consistency: ${cleanConsistency}, cinematic lighting, high-fidelity, concept art style, detailed textures.`
      : '';
  const audienceLine =
    audienceLevel === 'adults' && !/mature|adult/i.test(base)
      ? '\nAudience: Adult story — depict characters with mature adult proportions and sophisticated cinematic atmosphere.'
      : '';
  const withDirective = base.includes(POSITIVE_ILLUSTRATION_DIRECTIVE)
    ? `${base}${explicitStyleLine}${consistencyLine}${audienceLine}`
    : `${base}${explicitStyleLine}${consistencyLine}${audienceLine}\n${POSITIVE_ILLUSTRATION_DIRECTIVE}`;
  return hasRefs
    ? `${withDirective}\nUse attached image strictly as character face/outfit reference while composing the full dynamic scene above.`
    : withDirective;
};

// ===== 1/2: Gemini من المتصفح =====
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

  const readyModels = DIRECT_MODELS.filter((m) => !isModelDown(eng.slot, m));
  const modelsToTry = readyModels.length > 0 ? readyModels : DIRECT_MODELS;

  for (const model of modelsToTry) {
    const isNoSize = NO_SIZE_IMAGE_MODELS.has(model);
    let currentRefs = cleanRefs;
    let retriedWithoutRef = false;
    for (let attempt = 0; attempt < 2; attempt++) {
      if (signal?.aborted) throw abortError();
      const text = buildFinalImageText(req.prompt, currentRefs.length > 0, req.styleConsistency, req.audienceLevel, req.artStyle);
      try {
        const parts: any[] = currentRefs.length
          ? [...currentRefs.map((r) => ({ inlineData: { data: r.data, mimeType: r.mimeType } })), { text }]
          : [{ text }];

        const response = await withTimeout(
          ai.models.generateContent({
            model,
            contents: { parts },
            config: {
              abortSignal: signal,
              imageConfig: isNoSize ? { aspectRatio: req.aspectRatio } : { aspectRatio: req.aspectRatio, imageSize: '1K' },
            },
          }),
          DIRECT_TIMEOUT
        );
        const cand = response.candidates?.[0];
        const part = (cand?.content?.parts ?? []).find((p) => p.inlineData?.data);
        if (part?.inlineData?.data) {
          const rawMime = part.inlineData.mimeType || 'image/png';
          if (rawMime.includes('svg')) {
            throw new Error('SVG format is prohibited for story illustrations.');
          }
          directModelDown.delete(`${eng.slot}:${model}`);
          recordDrawnImage({
            kind: req.kind || 'page',
            engine: 'gemini',
            model: `${eng.id}/${model}`,
            promptSnippet: text.slice(0, 300),
          });
          return base64ToBlob(part.inlineData.data, rawMime);
        }
        const why = [response.promptFeedback?.blockReason, cand?.finishReason, cand?.content?.parts?.find((p) => p.text)?.text?.slice(0, 120)].filter(Boolean).join(' · ');
        trail.push({ model: `${eng.id}/${model}`, kind: 'skip', status: 0, message: `No image returned${retriedWithoutRef ? ' [no-ref]' : ''}${why ? `: ${why}` : '.'}` });
        break;
      } catch (err: any) {
        if (signal?.aborted || err?.name === 'AbortError') throw abortError();
        const msg = String(err?.message ?? err).replace(/\s+/g, ' ');
        const status = Number(err?.status ?? err?.code ?? 0) || 0;

        // إعادة المحاولة بدون الصورة المرجعية تقتصر حصراً على أخطاء فك تشفير الصورة أو السلامة والفلاتر
        const isRefOrSafetyError = /decode|could not be decoded|source image|safety|blocked|policy|filter|face|person/i.test(msg);
        if (currentRefs.length > 0 && isRefOrSafetyError) {
          console.warn(`[runDirect] Image/safety reference error on ${model} ("${msg.slice(0, 80)}..."), retrying without reference...`);
          trail.push({
            model: `${eng.id}/${model}`,
            kind: 'skip',
            status,
            message: `[retried without reference] ${msg.slice(0, 420)}`,
          });
          currentRefs = [];
          retriedWithoutRef = true;
          continue;
        }

        const kind = classifyFailure(status, msg);
        trail.push({
          model: `${eng.id}/${model}`,
          kind,
          status,
          message: `${retriedWithoutRef ? '[no-ref] ' : ''}${msg.slice(0, 460)}`,
        });

        const isDaily = /daily limit|limit:\s*0\b|free_?tier|requests today|limit of requests|tomorrow|select a different model/i.test(msg);
        if (kind === 'billing' || kind === 'missing' || (kind === 'quota' && isDaily)) {
          markModelDown(eng.slot, model, HARD_DOWN_MS);
          console.warn(`[runDirect] Model ${model} unavailable or reached daily/zero quota, cooling down 30m and switching model...`);
          break;
        }

        if (kind === 'quota') {
          markModelDown(eng.slot, model, 75_000);
          console.warn(`[runDirect] Per-minute quota on ${model}, cooling down 75s and switching model immediately...`);
          break;
        }

        if (kind === 'busy' && modelsToTry.length === 1 && attempt < 1) {
          const backoff = Math.min(1200 + Math.random() * 600, 3000);
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
  const data = await postJson<{
    base64?: string;
    mimeType: string;
    skipped?: boolean;
    engine?: DrawnEngineKind | 'free';
    model?: string;
    promptSnippet?: string;
  }>(
    '/api/generate-image',
    {
      prompt: req.prompt,
      aspectRatio: req.aspectRatio,
      references: req.references,
      kind: req.kind,
      artStyle: req.artStyle,
      styleConsistency: req.styleConsistency,
      audienceLevel: req.audienceLevel,
    },
    signal
  );
  if (data?.skipped) throw new SkippedImage('Image skipped: free engine takes no reference sheet.');
  if (!data?.base64) throw new ApiError('FAILED', 'Empty image response.', undefined, '/api/generate-image');
  if (data.mimeType?.includes('svg')) {
    throw new ApiError('FAILED', 'SVG images are prohibited for story illustrations.', undefined, '/api/generate-image');
  }
  const resolvedEngine: DrawnEngineKind =
    data.engine === 'pollinations' ? 'pollinations' : data.engine === 'flux' || data.engine === 'free' ? 'flux' : 'gemini';
  recordDrawnImage({
    kind: req.kind || 'page',
    engine: resolvedEngine,
    model: data.model || resolvedEngine,
    promptSnippet: (data.promptSnippet || req.prompt).slice(0, 300),
  });
  const blob = base64ToBlob(data.base64, data.mimeType);
  if (blob.type.includes('svg')) {
    throw new ApiError('FAILED', 'SVG images are prohibited for story illustrations.', undefined, '/api/generate-image');
  }
  return resolvedEngine === 'flux' ? cropToAspect(blob, req.aspectRatio) : blob;
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
      if (blob.type.includes('svg')) {
        throw new ApiError('FAILED', 'SVG graphics prohibited.');
      }
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

const TEST_PROMPT = 'Scene: a small yellow star on a plain blue background, flat icon.';

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

// ب3: قراءة صحة محركات الصور في الجلسة (down Map) دون أي طلبات شبكة
export interface SessionEngineHealthEntry {
  slot: string;
  down: boolean;
  remainingMs: number;
}

export const getImageEngineSessionHealth = (): {
  engines: SessionEngineHealthEntry[];
  models: SessionEngineHealthEntry[];
  lastEngine: EngineId | null;
} => {
  const now = Date.now();
  const engineEntries: SessionEngineHealthEntry[] = [];
  for (const [k, until] of down.entries()) {
    const rem = Math.max(0, until - now);
    engineEntries.push({
      slot: k.replace(/:.*$/, ''),
      down: rem > 0,
      remainingMs: rem,
    });
  }
  const modelEntries: SessionEngineHealthEntry[] = [];
  for (const [k, until] of directModelDown.entries()) {
    const rem = Math.max(0, until - now);
    const modelName = k.split(':').pop() || k;
    modelEntries.push({
      slot: modelName,
      down: rem > 0,
      remainingMs: rem,
    });
  }
  return {
    engines: engineEntries,
    models: modelEntries,
    lastEngine,
  };
};

