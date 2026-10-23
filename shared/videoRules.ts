// قواعد توليد الفيديو المشتركة بين الخادم والعميل

export const OMNI_MODEL = 'gemini-omni-1.1-flash';
// سعر تقديري بالدولار لكل ثانية عند 720p حسب إعلان جوجل؛ يُعرض للمستخدم كتقدير فقط ويجب التحقق من لوحة الفوترة
export const OMNI_USD_PER_SECOND = 0.1;
// طول المقطع الواحد المتوقع بالثواني (لا يوجد حقل مدة موثق؛ الطول يخرج من النموذج)
export const CLIP_SECONDS = 8;
export const NARRATION_WORDS_PER_SECOND = 2.2;
export const MAX_PARTS_PER_PAGE = 3;
export const NO_AUDIO_DIRECTIVE = 'No music, no speech, no dialogue, no sound effects, no on-screen text, no captions.';

export type VideoAspect = '16:9' | '9:16';

// مصدر المقاطع: Omni (مدفوع، مقطع ≈ 8ث) أو دفتر Colab بنموذج Wan عبر طابور Cloudflare (مجاني من رصيدك، مقطع ≈ 5ث)
export type VideoSource = 'omni' | 'colab';
export const COLAB_CLIP_SECONDS = 5;
export const clipSecondsFor = (source: VideoSource): number => (source === 'colab' ? COLAB_CLIP_SECONDS : CLIP_SECONDS);

export const videoAspectFor = (storyAspect?: string): VideoAspect => (storyAspect === '3:4' || storyAspect === '9:16' ? '9:16' : '16:9');

export interface ClipPlan {
  id: string;
  page: number;
  part: number;
  parts: number;
  scene: string;
  motion: string;
  imageId?: string;
}

// عدد المقاطع لصفحة من عدد كلماتها (قراءة بطيئة للأطفال)
export const partsForText = (text: string, clipSeconds: number = CLIP_SECONDS): number => {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  const seconds = words / NARRATION_WORDS_PER_SECOND;
  return Math.min(MAX_PARTS_PER_PAGE, Math.max(1, Math.ceil(seconds / clipSeconds)));
};

export const estimateCostUsd = (clipCount: number): number => Math.round(clipCount * CLIP_SECONDS * OMNI_USD_PER_SECOND * 100) / 100;

export const clipId = (storyId: string, page: number, part: number): string => `${storyId}:${page}:${part}`;
