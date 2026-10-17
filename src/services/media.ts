import { dbAll, dbByIndex, dbGet, dbPut, newId } from './db';

export type ImageKind = 'page' | 'cover' | 'sheet' | 'photo';

interface ImageRecord {
  id: string;
  blob: Blob;
  kind: ImageKind;
  style: string;
  prompt: string;
  tokens: string[];
  createdAt: number;
}

const urlCache = new Map<string, string>();

const sniffMime = (b64: string): string =>
  b64.startsWith('/9j/') ? 'image/jpeg' : b64.startsWith('UklG') ? 'image/webp' : b64.startsWith('PHN2') || b64.startsWith('PD94') ? 'image/svg+xml' : 'image/png';

// مصدر صالح لـ <img> من blob:/data:/base64 خام
export const toSrc = (img?: string): string | null => {
  if (!img) return null;
  if (img.startsWith('blob:') || img.startsWith('data:')) return img;
  return `data:${sniffMime(img)};base64,${img}`;
};

export const base64ToBlob = (b64: string, mime?: string): Blob => {
  const clean = b64.replace(/^data:[^;]+;base64,/, '');
  const bin = atob(clean);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: mime || sniffMime(clean) });
};

export const blobToBase64 = (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(',')[1] ?? '');
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });

export const srcToBlob = async (src: string): Promise<Blob> => {
  if (src.startsWith('blob:') || src.startsWith('data:')) return (await fetch(src)).blob();
  return base64ToBlob(src);
};

const loadBitmap = async (blob: Blob): Promise<ImageBitmap | HTMLImageElement> => {
  if ('createImageBitmap' in window) return createImageBitmap(blob);
  const url = URL.createObjectURL(blob);
  const img = new Image();
  img.src = url;
  await img.decode();
  URL.revokeObjectURL(url);
  return img;
};

// إعادة ترميز بحجم أقصى وصيغة محددة (WebP افتراضياً)
export const reencode = async (blob: Blob, maxSide: number, type = 'image/webp', quality = 0.9): Promise<Blob> => {
  const bmp = await loadBitmap(blob);
  const scale = Math.min(1, maxSide / Math.max(bmp.width, bmp.height));
  const w = Math.round(bmp.width * scale);
  const h = Math.round(bmp.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  canvas.getContext('2d')!.drawImage(bmp, 0, 0, w, h);
  if ('close' in bmp) bmp.close();
  const out = await new Promise<Blob | null>((res) => canvas.toBlob(res, type, quality));
  if (out && out.type === type) return out;
  return (await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/jpeg', quality))) ?? blob;
};

// قص مركزي إلى نسبة العرض المطلوبة (المحرك المجاني يرسم مربعاً فقط)
export const cropToAspect = async (blob: Blob, aspect: string): Promise<Blob> => {
  const [aw, ah] = aspect.split(':').map(Number);
  if (!aw || !ah) return blob;
  const bmp = await loadBitmap(blob);
  const target = aw / ah;
  const current = bmp.width / bmp.height;
  if (Math.abs(target - current) < 0.01) {
    if ('close' in bmp) bmp.close();
    return blob;
  }
  let sw = bmp.width;
  let sh = bmp.height;
  if (current > target) sw = Math.round(sh * target);
  else sh = Math.round(sw / target);
  const canvas = document.createElement('canvas');
  canvas.width = sw;
  canvas.height = sh;
  canvas.getContext('2d')!.drawImage(bmp, Math.round((bmp.width - sw) / 2), Math.round((bmp.height - sh) / 2), sw, sh, 0, 0, sw, sh);
  if ('close' in bmp) bmp.close();
  return (await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/jpeg', 0.92))) ?? blob;
};

export const objectUrlFor =(id: string, blob: Blob): string => {
  const existing = urlCache.get(id);
  if (existing) return existing;
  const url = URL.createObjectURL(blob);
  urlCache.set(id, url);
  return url;
};

const tokenize = (text: string): string[] =>
  Array.from(new Set(text.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/).filter((w) => w.length > 2)));

export const saveImage = async (blob: Blob, kind: ImageKind, style = '', prompt = ''): Promise<{ id: string; url: string }> => {
  const id = newId();
  const record: ImageRecord = { id, blob, kind, style, prompt, tokens: tokenize(prompt), createdAt: Date.now() };
  try {
    await dbPut('images', record);
  } catch (err) {
    console.warn('Image cache write failed:', err);
  }
  return { id, url: objectUrlFor(id, blob) };
};

export const getImage = async (id?: string): Promise<{ blob: Blob; url: string } | null> => {
  if (!id) return null;
  try {
    const rec = await dbGet<ImageRecord>('images', id);
    return rec ? { blob: rec.blob, url: objectUrlFor(id, rec.blob) } : null;
  } catch {
    return null;
  }
};

const jaccard = (a: string[], b: string[]): number => {
  if (!a.length || !b.length) return 0;
  const set = new Set(a);
  const inter = b.filter((t) => set.has(t)).length;
  return inter / (a.length + b.length - inter);
};

// إعادة استخدام صورة مولّدة سابقاً لمشهد شبه مطابق بنفس الأسلوب
export const findSimilarImage = async (prompt: string, style: string, kind: ImageKind, threshold = 0.82, exclude: Set<string> = new Set()): Promise<{ id: string; url: string } | null> => {
  try {
    const tokens = tokenize(prompt);
    const candidates = await dbByIndex<ImageRecord>('images', 'style', style);
    let best: ImageRecord | null = null;
    let bestScore = threshold;
    for (const rec of candidates) {
      if (rec.kind !== kind || exclude.has(rec.id)) continue;
      const score = jaccard(tokens, rec.tokens);
      if (score >= bestScore) {
        best = rec;
        bestScore = score;
      }
    }
    return best ? { id: best.id, url: objectUrlFor(best.id, best.blob) } : null;
  } catch {
    return null;
  }
};

export const imageCount = async (): Promise<number> => {
  try {
    return (await dbAll<ImageRecord>('images')).length;
  } catch {
    return 0;
  }
};

// مرجع مصغّر يُرسل للنموذج
export const toReference = async (blob: Blob): Promise<{ data: string; mimeType: string }> => {
  const small = await reencode(blob, 1024, 'image/jpeg', 0.85);
  return { data: await blobToBase64(small), mimeType: 'image/jpeg' };
};
