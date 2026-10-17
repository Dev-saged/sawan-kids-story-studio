import { ApiError, postJson, type TrailItem } from './api';
import { getUserApiKey } from './apiKey';
import { base64ToBlob, cropToAspect } from './media';
import type { AspectRatio } from '../types';

// طبقة الصور الموحدة: كل رسم في التطبيق يمر من هنا.
// المسارات بالترتيب: direct (المتصفح ← Google بمفتاح AI Studio المحقون، كما تعمل النسخة المرجعية)
// ثم server (Nano Banana عبر السيرفر، وداخله المحرك المجاني Cloudflare كاحتياط).
export type ImagePath = 'direct' | 'server';

export interface ImageRequest {
  prompt: string;
  aspectRatio: AspectRatio;
  references?: { data: string; mimeType: string }[];
  kind?: string;
}

// يرمى عندما لا يحتاج المحرك المجاني ورقة الشخصيات؛ ليس ApiError كي لا يُسجَّل
export class SkippedImage extends Error {}

const PATH_KEY = 'sawan-img-path';
// النموذج المثبت عمله داخل AI Studio في النسخة المرجعية
const DIRECT_MODELS = ['gemini-2.5-flash-image'];
const DIRECT_TIMEOUT = 60_000;

const directKey = (): string => (typeof __DIRECT_KEY__ === 'string' ? __DIRECT_KEY__ : '');

export const directAvailable = (): boolean => !getUserApiKey() && directKey().length > 0;

const readPref = (): ImagePath | null => {
  try {
    const v = sessionStorage.getItem(PATH_KEY);
    return v === 'direct' || v === 'server' ? v : null;
  } catch {
    return null;
  }
};

const writePref = (p: ImagePath) => {
  try {
    sessionStorage.setItem(PATH_KEY, p);
  } catch {
    // ignore
  }
};

// مفتاح الزائر الخاص يعني السيرفر وحده (مفتاحه)، وإلا نجرب المباشر أولاً ما لم يفشل في هذه الجلسة
const pathOrder = (): ImagePath[] => {
  if (!directAvailable()) return ['server'];
  return readPref() === 'server' ? ['server', 'direct'] : ['direct', 'server'];
};

const classify = (status: number, msg: string): string =>
  status === 401 || status === 403 || /API_KEY_INVALID|PERMISSION_DENIED/i.test(msg)
    ? 'auth'
    : status === 429 || /RESOURCE_EXHAUSTED|quota/i.test(msg)
      ? 'quota'
      : status === 404 || /NOT_FOUND|is not found/i.test(msg)
        ? 'missing'
        : status >= 500 || /UNAVAILABLE|overloaded|timeout/i.test(msg)
          ? 'busy'
          : 'skip';

const withTimeout = <T,>(p: Promise<T>, ms: number): Promise<T> =>
  Promise.race([p, new Promise<T>((_, rej) => setTimeout(() => rej(new Error('timeout')), ms))]);

// المسار المباشر: نفس استدعاء النسخة المرجعية (SDK داخل المتصفح)
const runDirect = async (req: ImageRequest, signal?: AbortSignal): Promise<{ blob: Blob; trail: TrailItem[] }> => {
  const { GoogleGenAI } = await import('@google/genai');
  const ai = new GoogleGenAI({ apiKey: directKey() });
  const trail: TrailItem[] = [];
  const lead = req.references?.length
    ? 'Use the attached reference image(s) as the exact character design: keep the same face, hairstyle, skin tone, outfit, colors and proportions. Do not copy their background or pose. '
    : '';
  const text = `${lead}${req.prompt} Masterpiece children's book illustration, sharp focus, rich detail, professional composition, consistent character design. Absolutely no text, letters, captions, logos or watermark.`;
  for (const model of DIRECT_MODELS) {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    try {
      const response = await withTimeout(
        ai.models.generateContent({
          model,
          contents: { parts: [...(req.references ?? []).map((r) => ({ inlineData: r })), { text }] },
          config: { imageConfig: { aspectRatio: req.aspectRatio } },
        }),
        DIRECT_TIMEOUT
      );
      const part = (response.candidates?.[0]?.content?.parts ?? []).find((p) => p.inlineData?.data);
      if (part?.inlineData?.data) return { blob: base64ToBlob(part.inlineData.data, part.inlineData.mimeType || 'image/png'), trail };
      trail.push({ model: `direct/${model}`, kind: 'skip', status: 0, message: 'Model returned no image.' });
    } catch (err: any) {
      const status = Number(err?.status ?? err?.code ?? 0) || 0;
      const msg = String(err?.message ?? err).replace(/\s+/g, ' ');
      trail.push({ model: `direct/${model}`, kind: classify(status, msg), status, message: msg.slice(0, 480) });
    }
  }
  const failed = new Error('direct path failed') as Error & { trail: TrailItem[] };
  failed.trail = trail;
  throw failed;
};

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

export const generateIllustration = async (req: ImageRequest, signal?: AbortSignal): Promise<Blob> => {
  const earlier: TrailItem[] = [];
  let lastErr: unknown = null;
  for (const path of pathOrder()) {
    try {
      if (path === 'direct') {
        const { blob } = await runDirect(req, signal);
        writePref('direct');
        return blob;
      }
      const blob = await runServer(req, signal);
      writePref('server');
      return blob;
    } catch (err: any) {
      if (err?.name === 'AbortError' || err instanceof SkippedImage) throw err;
      lastErr = err;
      if (path === 'direct') {
        earlier.push(...((err?.trail as TrailItem[] | undefined) ?? []));
        // المباشر مرفوض بسبب الحصة أو الصلاحية: نبقى على السيرفر في هذه الجلسة
        if (earlier.some((t) => t.kind === 'quota' || t.kind === 'auth')) writePref('server');
      }
    }
  }
  if (lastErr instanceof ApiError) {
    if (earlier.length) lastErr.addTrail(earlier);
    throw lastErr;
  }
  throw new ApiError('FAILED', earlier.map((t) => `${t.model}: ${t.message}`).join(' | ') || undefined, earlier, 'image-engine');
};

// فحص صريح لكل مسار (زر «تفاصيل تقنية»)
export interface PathTest {
  path: ImagePath;
  ok: boolean;
  ms: number;
  detail?: string;
}

const TEST_PROMPT = 'a small yellow star on a plain blue background, flat icon';

export const diagnoseImagePaths = async (): Promise<PathTest[]> => {
  const out: PathTest[] = [];
  if (directAvailable()) {
    const t0 = performance.now();
    try {
      await runDirect({ prompt: TEST_PROMPT, aspectRatio: '1:1' });
      out.push({ path: 'direct', ok: true, ms: Math.round(performance.now() - t0) });
    } catch (err: any) {
      const item = (err?.trail as TrailItem[] | undefined)?.[0];
      out.push({ path: 'direct', ok: false, ms: Math.round(performance.now() - t0), detail: item ? `${item.kind} ${item.status} ${item.message}`.slice(0, 260) : String(err?.message ?? err) });
    }
  }
  const t1 = performance.now();
  try {
    const data = await postJson<{ engine?: string; model?: string }>('/api/generate-image', { prompt: TEST_PROMPT, aspectRatio: '1:1', kind: 'diag' }, undefined, 1);
    out.push({ path: 'server', ok: true, ms: Math.round(performance.now() - t1), detail: `${data?.engine ?? 'gemini'} · ${data?.model ?? ''}`.trim() });
  } catch (err: any) {
    out.push({ path: 'server', ok: false, ms: Math.round(performance.now() - t1), detail: `${err?.code ?? ''} ${String(err?.detail ?? err?.message ?? '').slice(0, 260)}`.trim() });
  }
  return out;
};
