import type { StoryData, StoryPage } from '../types';
import { ApiError, authHeaders, postJson } from './api';
import { deleteColabJob, downloadColabVideo, lastFrameOf, loadColabConfig, submitColabJob, waitColabJob } from './colabQueue';
import { dbByIndex, dbDelete, dbPut, hashText } from './db';
import { charactersLineFor, getArtStylePrompt, getCharactersForPage, isAdultStory } from './gemini';
import { blobToBase64, getImage, reencode } from './media';
import { NO_AUDIO_DIRECTIVE, clipId, clipSecondsFor, partsForText, stripBrandNames, videoAspectFor, type ClipPlan, type VideoSource } from '../shared/modelRules';

// مقاطع الفيديو المتحركة (Gemini Omni): تخطيط، توليد عبر الخادم، وحفظ محلي في IndexedDB

export interface StoredClip {
  id: string;
  storyId: string;
  page: number;
  part: number;
  blob: Blob;
  interactionId?: string;
  source?: VideoSource;
  createdAt: number;
}

// معرّف القصة للتخزين (قصة غير محفوظة بعد تأخذ بصمة عنوانها)
export const storyKey = (story: StoryData): string => story.id || `draft-${hashText(story.story_info.title)}`;

export const listClips = (storyId: string): Promise<StoredClip[]> => dbByIndex<StoredClip>('video_clips', 'storyId', storyId);

export const deleteClipsOf = async (storyId: string): Promise<void> => {
  const all = await listClips(storyId);
  await Promise.all(all.map((c) => dbDelete('video_clips', c.id)));
};

export const deleteClip = (id: string) => dbDelete('video_clips', id);

// صفحة → مقاطعها مرتبة حسب الجزء
export const clipsByPage = (clips: StoredClip[]): Map<number, Blob[]> => {
  const map = new Map<number, StoredClip[]>();
  for (const c of clips) map.set(c.page, [...(map.get(c.page) ?? []), c]);
  return new Map([...map].map(([page, list]) => [page, list.sort((a, b) => a.part - b.part).map((c) => c.blob)]));
};

const DEFAULT_MOTION_FIRST = 'The characters move and react naturally to what is happening in the scene, with soft ambient motion in the environment.';
const DEFAULT_MOTION_NEXT = 'The action continues and develops naturally.';

// يقسّم القصة إلى مقاطع: كل صفحة 1..3 أجزاء بحسب طول نصها المقروء (≈ 8 ثوانٍ لكل جزء في Omni و5 في Colab)
export const planClips = async (story: StoryData, signal?: AbortSignal, source: VideoSource = 'omni'): Promise<ClipPlan[]> => {
  const clipSeconds = clipSecondsFor(source);
  const base: ClipPlan[] = story.pages.flatMap((p) => {
    const parts = partsForText(p.text, clipSeconds);
    return Array.from({ length: parts }, (_, i) => ({
      id: clipId(storyKey(story), p.page, i + 1),
      page: p.page,
      part: i + 1,
      parts,
      scene: (p.image_prompt || '').trim(),
      motion: i === 0 ? DEFAULT_MOTION_FIRST : DEFAULT_MOTION_NEXT,
      imageId: p.imageId,
    }));
  });
  try {
    const res = await postJson<{ clips: { page: number; part: number; motion: string }[] }>(
      '/api/video-plan',
      { pages: story.pages.map((p) => ({ page: p.page, parts: partsForText(p.text, clipSeconds), text: p.text, scene: p.image_prompt })) },
      signal,
      1
    );
    const byKey = new Map((res?.clips ?? []).map((c) => [`${c.page}:${c.part}`, c.motion]));
    return base.map((c) => ({ ...c, motion: byKey.get(`${c.page}:${c.part}`) || c.motion }));
  } catch (err) {
    if ((err as Error)?.name === 'AbortError') throw err;
    return base;
  }
};

export const buildClipPrompt = (story: StoryData, plan: ClipPlan, source: VideoSource = 'omni'): string => {
  const page = story.pages.find((p) => p.page === plan.page) as StoryPage | undefined;
  const motion = stripBrandNames(plan.motion).replace(/\.+$/, '');
  // Omni يمدّد المقطع السابق بنفسه؛ Colab يبدأ كل جزء من صورة (آخر إطار) فيحتاج وصف المشهد كاملاً
  if (plan.part > 1 && source === 'omni') {
    return [
      'Continue the scene.',
      `Action: ${motion}.`,
      'Keep the same characters, outfits, setting and art style. Gentle camera movement.',
      NO_AUDIO_DIRECTIVE,
    ].join(' ');
  }
  const adult = isAdultStory(story);
  const style = getArtStylePrompt(story.story_info.art_style, story.story_info.age_group, story.styleConsistency || story.story_info.styleConsistency, adult ? 'adults' : 'kids');
  const chars = page ? charactersLineFor(story, getCharactersForPage(story, page), 14) : '';
  return [
    plan.part > 1 ? 'Continue the scene from the starting frame.' : 'Animate this storybook illustration into a short film clip.',
    plan.scene ? `Scene: ${stripBrandNames(plan.scene).replace(/\.+$/, '')}.` : '',
    `Action: ${motion}.`,
    chars,
    `Style: ${style}. Keep the exact characters, outfits and art style of the starting frame.`,
    'Smooth natural character motion, gentle camera movement.',
    NO_AUDIO_DIRECTIVE,
    'Use this image as the starting frame.',
  ]
    .filter(Boolean)
    .join(' ');
};

const sleep = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => {
      clearTimeout(t);
      reject(new DOMException('Aborted', 'AbortError'));
    });
  });

const POLL_MS = 5000;
const JOB_TIMEOUT_MS = 14 * 60_000;

interface JobStatus {
  status: 'running' | 'done' | 'error';
  interactionId?: string;
  error?: string;
  code?: ApiError['code'];
}

// يولّد مقطعاً واحداً: بدء المهمة، استطلاعها، تنزيل الملف، حفظه محلياً
const saveClip = async (story: StoryData, plan: ClipPlan, blob: Blob, source: VideoSource, interactionId?: string): Promise<StoredClip> => {
  const clip: StoredClip = {
    id: plan.id,
    storyId: storyKey(story),
    page: plan.page,
    part: plan.part,
    blob: blob.type ? blob : new Blob([blob], { type: 'video/mp4' }),
    interactionId,
    source,
    createdAt: Date.now(),
  };
  await dbPut('video_clips', clip);
  return clip;
};

const pageImage = async (story: StoryData, plan: ClipPlan): Promise<Blob> => {
  const stored = await getImage(story.pages.find((p) => p.page === plan.page)?.imageId);
  if (!stored) throw new ApiError('FAILED', 'الصفحة بلا صورة بعد؛ ارسمها أولاً ثم ولّد الحركة.', undefined, '/api/video/start');
  return stored.blob;
};

// Colab: المهمة تُرسل للطابور (مفتاح ثابت يمنع التكرار عند الاستئناف)، يعالجها الدفتر، ثم ننزّل المقطع
const generateColabClip = async (story: StoryData, plan: ClipPlan, previous: StoredClip | undefined, signal: AbortSignal): Promise<StoredClip> => {
  const cfg = loadColabConfig();
  if (!cfg) throw new ApiError('FAILED', 'أدخل رابط طابور Cloudflare ورمز الوصول أولاً.', undefined, '/colab');
  let start: Blob;
  if (plan.part === 1) start = await pageImage(story, plan);
  else if (previous?.blob) start = await lastFrameOf(previous.blob);
  else throw new ApiError('FAILED', 'الجزء السابق من هذا المشهد غير جاهز.', undefined, '/colab');

  const prompt = buildClipPrompt(story, plan, 'colab');
  const input = { prompt, aspect: videoAspectFor(story.story_info.aspect_ratio), seconds: clipSecondsFor('colab'), image: start };
  const baseKey = `${plan.id}:${hashText(prompt)}`;
  for (let attempt = 0; attempt < 2; attempt++) {
    const id = await submitColabJob(cfg, { ...input, key: attempt ? `${baseKey}:${Date.now()}` : baseKey }, signal);
    await waitColabJob(cfg, id, signal);
    try {
      const blob = await downloadColabVideo(cfg, id, signal);
      void deleteColabJob(cfg, id);
      return await saveClip(story, plan, blob, 'colab');
    } catch (err) {
      // صلاحية المقطع المخزَّن انتهت (مهمة قديمة بنفس المفتاح): نعيد مرة بمفتاح جديد
      if ((err as Error)?.name === 'AbortError' || attempt === 1) throw err;
    }
  }
  throw new ApiError('FAILED', 'تعذّر الحصول على المقطع من Colab.', undefined, '/colab');
};

export const generateClip = async (
  story: StoryData,
  plan: ClipPlan,
  previous: StoredClip | undefined,
  signal: AbortSignal,
  source: VideoSource = 'omni'
): Promise<StoredClip> => {
  if (source === 'colab') return generateColabClip(story, plan, previous, signal);
  let image: { data: string; mimeType: string } | undefined;
  if (plan.part === 1) {
    // صورة البداية بدقة 1024 (بدل المرجع المصغّر 512) لحفظ تفاصيل الوجوه
    const small = await reencode(await pageImage(story, plan), 1024, 'image/jpeg', 0.88);
    image = { data: await blobToBase64(small), mimeType: 'image/jpeg' };
  } else if (!previous?.interactionId) {
    throw new ApiError('FAILED', 'الجزء السابق من هذا المشهد غير جاهز.', undefined, '/api/video/start');
  }

  const { jobId } = await postJson<{ jobId: string }>(
    '/api/video/start',
    {
      prompt: buildClipPrompt(story, plan),
      aspectRatio: videoAspectFor(story.story_info.aspect_ratio),
      resolution: '720p',
      image,
      previousInteractionId: plan.part > 1 ? previous?.interactionId : undefined,
    },
    signal,
    1
  );

  const started = Date.now();
  let status: JobStatus = { status: 'running' };
  while (status.status === 'running') {
    if (Date.now() - started > JOB_TIMEOUT_MS) throw new ApiError('FAILED', 'استغرق توليد المقطع وقتاً أطول من المتوقع.', undefined, '/api/video');
    await sleep(POLL_MS, signal);
    const res = await fetch(`/api/video/${jobId}`, { headers: authHeaders(), signal });
    if (!res.ok) throw new ApiError(res.status === 404 ? 'FAILED' : 'BUSY', 'فُقد الاتصال بمهمة الفيديو على الخادم.', undefined, '/api/video');
    status = (await res.json()) as JobStatus;
  }
  if (status.status === 'error') throw new ApiError(status.code ?? 'FAILED', status.error, undefined, '/api/video');

  const fileRes = await fetch(`/api/video/${jobId}/file`, { headers: authHeaders(), signal });
  if (!fileRes.ok) throw new ApiError('FAILED', 'تعذّر تنزيل المقطع من الخادم.', undefined, '/api/video/file');
  return saveClip(story, plan, await fileRes.blob(), 'omni', status.interactionId);
};
