import { Language, NameAnalysis, QuizItem, StoryData, StoryParams, StoryPage } from '../types';
import { ART_STYLE_OPTIONS, FIRST_BATCH_PAGES, MAX_IDEA_LENGTH, MAX_STORY_PAGES, NEXT_BATCH_PAGES } from '../constants';
import { ApiError, authHeaders, codeFromStatus, postJson, trackApiCall } from './api';
import { base64ToBlob } from './media';

export const API_KEY_MISSING = 'API_KEY_MISSING';

export const getArtStylePrompt = (style: string): string => {
  const option = ART_STYLE_OPTIONS.find((o) => o.value === style);
  return option ? option.prompt : `${style} illustration style, high quality, children friendly`;
};

const characterSheetText = (story: StoryData): string =>
  story.characters
    .map((c) => `${c.name} (${c.gender || 'character'}, ${c.age}): ${c.description}`)
    .join(' | ');

const styleLock = (story: StoryData): string =>
  `Art style (identical on every image of this book): ${getArtStylePrompt(story.story_info.art_style)}.`;

export const buildPageImagePrompt = (story: StoryData, page: StoryPage): string =>
  [
    styleLock(story),
    `Fixed characters, keep them visually identical: ${characterSheetText(story)}.`,
    `Scene: ${page.image_prompt}`,
  ].join(' ');

export const buildCoverPrompt = (story: StoryData): string =>
  [
    styleLock(story),
    `Book cover illustration for the children's story titled "${story.story_info.title}".`,
    `Fixed characters: ${characterSheetText(story)}.`,
    `Composition: ${story.cover_image_prompt || story.pages[0]?.image_prompt || ''}`,
    'Iconic, inviting hero shot, strong focal point, depth and atmosphere, generous calm space in the upper third.',
  ].join(' ');

export const buildSheetPrompt = (story: StoryData, withPhoto: boolean): string =>
  [
    styleLock(story),
    'Character reference sheet for a children picture book.',
    withPhoto ? 'The main hero is the child in the attached photo, redrawn in this art style with a faithful likeness of the face and hair.' : '',
    `Characters: ${characterSheetText(story)}.`,
    'Each character shown full body, front view, friendly neutral pose, side by side, evenly lit, plain soft light background, clean readable design.',
  ]
    .filter(Boolean)
    .join(' ');

export interface ProgressInfo {
  progress: number;
  message: string;
  preview?: string;
}

// استخراج آخر نص صفحة مكتمل من JSON جزئي أثناء البث
const PAGE_TEXT_RE = /"text"\s*:\s*"((?:[^"\\]|\\.)*)"/g;
const extractPreview = (raw: string): { count: number; last?: string } => {
  let count = 0;
  let last: string | undefined;
  for (const m of raw.matchAll(PAGE_TEXT_RE)) {
    count++;
    try {
      last = JSON.parse(`"${m[1]}"`);
    } catch {
      last = m[1];
    }
  }
  return { count, last };
};

const validQuiz = (quiz?: QuizItem[]): QuizItem[] => (quiz ?? []).filter((q) => q?.question && Array.isArray(q.options) && q.options.length >= 2);

const cleanPage = (p: Partial<StoryPage>): StoryPage => ({
  page: 0,
  text: (p.text ?? '').trim(),
  narration: (p.narration ?? '').trim() || (p.text ?? '').trim(),
  image_prompt: p.image_prompt ?? '',
  ...(p.chapter?.trim() ? { chapter: p.chapter.trim() } : {}),
});

// دفعة صفحات من قصة طويلة
export interface StoryBatch {
  pages: StoryPage[];
  final: boolean;
  quiz?: QuizItem[];
  moral?: string;
  lessons?: string[];
}

export const applyBatch = (s: StoryData, b: StoryBatch): StoryData => {
  const base = s.pages.length;
  const pages = [...s.pages, ...b.pages.map((p, i) => ({ ...p, page: base + i + 1 }))];
  const complete = b.final || pages.length >= (s.plannedPages ?? pages.length);
  return {
    ...s,
    pages,
    plannedPages: complete ? undefined : s.plannedPages,
    ...(b.final
      ? {
          quiz: b.quiz?.length ? b.quiz : s.quiz,
          story_info: { ...s.story_info, moral: b.moral || s.story_info.moral, lessons: b.lessons?.length ? b.lessons : s.story_info.lessons },
        }
      : {}),
  };
};

export const isIncomplete = (s: StoryData): boolean => Boolean(s.plannedPages && s.pages.length < s.plannedPages);

// يكتب بقية القصة دفعة بعد دفعة؛ كل دفعة ناجحة تُسلَّم فوراً عبر append فلا يضيع شيء إن انقطع الطلب
export const continueStory = async (
  get: () => StoryData,
  append: (batch: StoryBatch) => void,
  onProgress?: (done: number, total: number) => void,
  signal?: AbortSignal,
  gate?: () => Promise<void>
): Promise<void> => {
  let work = get();
  while (work.plannedPages && work.pages.length < work.plannedPages) {
    await gate?.();
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    const remaining = work.plannedPages - work.pages.length;
    const count = Math.min(NEXT_BATCH_PAGES, remaining);
    const final = remaining <= count;
    const texts = work.pages.map((p) => p.text);
    const data = await postJson<{ pages: Partial<StoryPage>[]; quiz?: QuizItem[]; moral?: string; lessons?: string[] }>(
      '/api/continue-story',
      {
        story: {
          title: work.story_info.title,
          language: work.story_info.language,
          dialect: work.story_info.dialect,
          ageGroup: work.story_info.age_group,
          artStyle: work.story_info.art_style,
          characters: work.characters,
          earlier: texts.slice(0, -3).map((t) => t.slice(0, 160)),
          recent: texts.slice(-3),
        },
        from: work.pages.length + 1,
        count,
        total: work.plannedPages,
        final,
      },
      signal,
      3
    );
    const pages = (data?.pages ?? []).map(cleanPage).filter((p) => p.text);
    if (!pages.length) throw new ApiError('FAILED', 'Empty batch.', undefined, '/api/continue-story');
    const batch: StoryBatch = { pages, final, quiz: validQuiz(data.quiz), moral: data.moral, lessons: data.lessons };
    work = applyBatch(work, batch);
    append(batch);
    onProgress?.(work.pages.length, work.plannedPages ?? work.pages.length);
  }
};

export interface GeneratorLogEntry {
  timestamp: string;
  level: 'info' | 'warn' | 'error';
  stage: string;
  message: string;
  data?: unknown;
}

const generatorLogs: GeneratorLogEntry[] = [];
export const getGeneratorLogs = (): GeneratorLogEntry[] => [...generatorLogs];

export class StoryGenerator {
  private isPaused = false;
  private resumeResolver: (() => void) | null = null;

  private log(level: 'info' | 'warn' | 'error', stage: string, message: string, data?: unknown): void {
    const entry: GeneratorLogEntry = {
      timestamp: new Date().toISOString(),
      level,
      stage,
      message,
      data,
    };
    generatorLogs.push(entry);
    if (generatorLogs.length > 60) generatorLogs.shift();
    const prefix = `[StoryGenerator][${stage}]`;
    if (level === 'error') console.error(prefix, message, data ?? '');
    else if (level === 'warn') console.warn(prefix, message, data ?? '');
    else console.info(prefix, message, data ?? '');
  }

  public pause(): void {
    this.log('info', 'lifecycle', 'Story generation paused by user.');
    this.isPaused = true;
  }

  public resume(): void {
    this.log('info', 'lifecycle', 'Story generation resumed by user.');
    this.isPaused = false;
    if (this.resumeResolver) {
      this.resumeResolver();
      this.resumeResolver = null;
    }
  }

  private waitIfPaused(): Promise<void> {
    if (!this.isPaused) return Promise.resolve();
    return new Promise((resolve) => {
      this.resumeResolver = resolve;
    });
  }

  public async generate(rawParams: StoryParams, pageCount: number, onProgress: (info: ProgressInfo) => void): Promise<StoryData> {
    const params: StoryParams = { ...rawParams, idea: rawParams.idea.trim().slice(0, MAX_IDEA_LENGTH) };
    const total = Math.min(Math.max(Math.round(pageCount) || 6, 3), MAX_STORY_PAGES);
    // القصص الطويلة تبدأ بدفعة أولى ثم تُكمَل بدفعات؛ الأقصر تُكتب دفعة واحدة كما كانت
    pageCount = total > 16 ? FIRST_BATCH_PAGES : total;
    if (!params.idea) throw new Error('Story idea cannot be empty.');
    const ar = params.language === 'Arabic';

    this.log('info', 'init', `Starting story generation: ${total} pages planned (batch 1: ${pageCount} pages).`, {
      language: params.language,
      dialect: params.dialect,
      artStyle: params.artStyle,
      ageGroup: params.ageGroup,
    });

    onProgress({ progress: 6, message: ar ? 'نجهّز فكرة القصة...' : 'Preparing your story...' });
    await this.waitIfPaused();

    if (navigator.onLine === false) {
      this.log('error', 'network', 'Device is offline.');
      throw new ApiError('OFFLINE');
    }

    const MAX_RETRIES = 3;
    let res: Response | null = null;
    let lastError: unknown = null;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        if (attempt > 0) {
          const backoffMs = Math.min(1500 * Math.pow(2, attempt) + Math.random() * 800, 10000);
          this.log('warn', 'retry', `Quota or rate limit encountered. Applying exponential backoff: waiting ${Math.round(backoffMs)}ms before retry ${attempt + 1}/${MAX_RETRIES + 1}...`);
          onProgress({
            progress: 8,
            message: ar
              ? `ننتظر لحظات لتخفيف الضغط على النموذج (${attempt + 1}/${MAX_RETRIES + 1})...`
              : `Stabilizing rate limit, retrying in ${Math.round(backoffMs / 1000)}s...`,
          });
          await new Promise((resolve) => setTimeout(resolve, backoffMs));
          await this.waitIfPaused();
        }

        this.log('info', 'request', `Sending /api/generate-story request (attempt ${attempt + 1})...`);
        const finishTracking = trackApiCall('/api/generate-story', 'POST', `attempt ${attempt + 1}, pages: ${pageCount}/${total}`);
        res = await fetch('/api/generate-story', {
          method: 'POST',
          headers: authHeaders(),
          body: JSON.stringify({ params, pageCount, totalPages: total }),
        });

        if (res.status === 429) {
          let errorData: any = {};
          try {
            errorData = await res.json();
          } catch {
            // ignore
          }
          finishTracking(429, errorData.error || 'Rate limit', 'QUOTA');
          this.log('warn', 'quota', `Received 429 Quota Exceeded from Gemini: ${errorData.error || 'Rate limit'}`);
          lastError = new ApiError('QUOTA', errorData.error, errorData.trail, '/api/generate-story');
          continue;
        }

        if (!res.ok) {
          let errorData: any = {};
          try {
            errorData = await res.json();
          } catch {
            // ignore
          }
          const code = errorData.code ?? codeFromStatus(res.status);
          finishTracking(res.status, errorData.error, code);
          this.log('error', 'http_error', `Received HTTP ${res.status} from /api/generate-story`, errorData);
          throw new ApiError(code, errorData.error, errorData.trail, '/api/generate-story');
        }

        finishTracking(res.status);
        break;
      } catch (err: any) {
        lastError = err;
        if (err instanceof ApiError && err.code === 'QUOTA' && attempt < MAX_RETRIES) {
          continue;
        }
        if (attempt >= MAX_RETRIES) {
          this.log('error', 'exhausted', `All ${MAX_RETRIES + 1} attempts exhausted.`, err);
          throw err;
        }
      }
    }

    if (!res || !res.ok || !res.body) {
      throw lastError ?? new ApiError('FAILED', undefined, undefined, '/api/generate-story');
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let raw = '';
    let story: StoryData | null = null;

    const handle = (line: string) => {
      if (!line.trim()) return;
      const msg = JSON.parse(line);
      if (msg.t === 'chunk') {
        raw += msg.d;
        const { count, last } = extractPreview(raw);
        onProgress({
          progress: Math.min(94, 12 + Math.round((count / total) * 82)),
          message: ar ? `نكتب الصفحة ${Math.min(count + 1, pageCount)} من ${total}...` : `Writing page ${Math.min(count + 1, pageCount)} of ${total}...`,
          preview: last,
        });
      } else if (msg.t === 'reset') {
        raw = '';
      } else if (msg.t === 'done') {
        story = msg.story;
      } else if (msg.t === 'error') {
        throw new ApiError(msg.code ?? 'FAILED', msg.error, msg.trail, '/api/generate-story');
      }
    };

    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      lines.forEach(handle);
      await this.waitIfPaused();
    }
    handle(buffer);

    const parsed = story as StoryData | null;
    if (!parsed?.pages?.length || !parsed?.characters?.length) throw new ApiError('FAILED');

    let result: StoryData = {
      ...parsed,
      plannedPages: total > pageCount ? total : undefined,
      story_info: {
        ...parsed.story_info,
        lessons: parsed.story_info.lessons ?? [],
        art_style: params.artStyle,
        aspect_ratio: params.aspectRatio,
        dialect: params.dialect,
      },
      heroPhotoId: params.series?.heroPhotoId ?? params.heroPhotoId,
      // الجزء التالي يحتفظ بنفس الشخصيات وورقة المراجع لتبقى الوجوه ثابتة
      ...(params.series
        ? {
            characters: params.series.characters,
            characterSheetId: params.series.characterSheetId,
            seriesId: params.series.seriesId,
            seriesTitle: params.series.seriesTitle,
            partNumber: params.series.partNumber,
          }
        : {}),
      quiz: validQuiz(parsed.quiz),
      pages: parsed.pages.slice(0, pageCount).map((p, i) => ({ ...cleanPage(p), page: i + 1 })),
    };

    // بقية القصة الطويلة: أي انقطاع بعد الدفعة الأولى يُرجِع القصة ناقصة وقابلة للاستئناف بدل أن يضيع ما كُتب
    if (isIncomplete(result)) {
      let current = result;
      try {
        await continueStory(
          () => current,
          (batch) => {
            current = applyBatch(current, batch);
          },
          (done, all) =>
            onProgress({
              progress: Math.min(97, 12 + Math.round((done / all) * 85)),
              message: ar ? `نكتب الفصل التالي... ${done} من ${all}` : `Writing the next chapter... ${done} of ${all}`,
              preview: current.pages[current.pages.length - 1]?.text,
            }),
          undefined,
          () => this.waitIfPaused()
        );
      } catch {
        // الخطأ مسجّل في «تفاصيل تقنية»؛ نكمل بما كُتب
      }
      result = current;
    }

    onProgress({ progress: 100, message: ar ? 'القصة جاهزة!' : 'Story ready!' });
    return result;
  }
}

export { generateIllustration, SkippedImage, type ImageRequest } from './imageEngine';

export const narrate = async (text: string, voice: string, signal?: AbortSignal): Promise<Blob> => {
  const data = await postJson<{ base64: string; mimeType: string }>('/api/narrate', { text, voice }, signal);
  if (!data?.base64) throw new ApiError('FAILED');
  return base64ToBlob(data.base64, data.mimeType || 'audio/wav');
};

export const generateMusic = async (prompt: string, signal?: AbortSignal): Promise<Blob> => {
  const data = await postJson<{ base64: string; mimeType: string }>('/api/music', { prompt }, signal, 2);
  if (!data?.base64) throw new ApiError('FAILED');
  return base64ToBlob(data.base64, data.mimeType || 'audio/mpeg');
};

export type CameraAngle = 'auto' | 'wide' | 'close' | 'low' | 'high' | 'side' | 'back';

// إعادة كتابة وصف مشهد واحد بزاوية كاميرا جديدة أو بتعليمات المستخدم (الشخصيات والحدث ثابتان)
export const rewriteImagePrompt = async (current: string, opts: { angle?: CameraAngle; instruction?: string; text?: string }, signal?: AbortSignal): Promise<string> => {
  const data = await postJson<{ prompt: string }>('/api/rewrite-prompt', { prompt: current, ...opts }, signal, 2);
  if (!data?.prompt) throw new ApiError('FAILED', 'Empty rewrite.', undefined, '/api/rewrite-prompt');
  return data.prompt;
};

export const analyzeNameMeaning = async (name: string, language: Language): Promise<NameAnalysis> => {
  const trimmed = name.trim().slice(0, 60);
  if (!trimmed) throw new Error('Please enter a name first.');
  return postJson<NameAnalysis>('/api/analyze-name', { name: trimmed, language });
};
