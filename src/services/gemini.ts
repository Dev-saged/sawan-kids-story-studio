import { Character, Language, NameAnalysis, QuizItem, StoryData, StoryParams, StoryPage } from '../types';
import { ART_STYLE_OPTIONS, FIRST_BATCH_PAGES, MAX_IDEA_LENGTH, MAX_STORY_PAGES, NEXT_BATCH_PAGES } from '../constants';
import { POSITIVE_ILLUSTRATION_DIRECTIVE } from '../shared/modelRules';
import { ApiError, authHeaders, codeFromStatus, postJson, trackApiCall } from './api';
import { base64ToBlob } from './media';

export const API_KEY_MISSING = 'API_KEY_MISSING';

export const getArtStylePrompt = (style: string): string => {
  const option = ART_STYLE_OPTIONS.find((o) => o.value === style);
  return option ? option.prompt : `${style} storybook illustration, vibrant colors, expressive characters.`;
};

const wordsOf = (text: string): string[] => text.trim().split(/\s+/).filter(Boolean);
const countWords = (text: string): number => wordsOf(text).length;
const capWords = (text: string, maxWords: number): string => {
  if (maxWords <= 0) return '';
  const w = wordsOf(text);
  return w.length <= maxWords ? w.join(' ') : w.slice(0, maxWords).join(' ');
};

// أ3: يفحص نصوص الصفحات ووصف الشخصيات واختيار المستخدم (fruitFantasy)، لا العنوان والدروس فقط
const FRUIT_RE = /fruit|pomegranate|lemon|citrus|mango|apple|berry|strawberry|orange|banana|peach|apricot|grape|watermelon|fig|فواكه|فاكهة|رمان|ليمون|مانجو|تفاح|تفاحة|توت|برتقال|موز|مشمش|مشمشة|تين|عنب|بطيخ/i;

export const isFruitStory = (story: StoryData): boolean => {
  if (story.story_info.fruitFantasy) return true;
  const charText = (story.characters ?? []).map((c) => `${c.name} ${c.description} ${c.personality}`).join(' ');
  const pagesText = (story.pages ?? []).map((p) => `${p.text} ${p.image_prompt}`).join(' ');
  const metaText = `${story.story_info.title ?? ''} ${(story.story_info.lessons ?? []).join(' ')} ${story.story_info.themeTopic ?? ''}`;
  return FRUIT_RE.test(`${charText} ${pagesText} ${metaText}`);
};

const detectFruitKind = (c: Character): string => {
  const combined = `${c.name} ${c.description}`.toLowerCase();
  if (/pomegranate|رمان|جلنار/.test(combined)) return 'pomegranate';
  if (/lemon|citrus|ليمون/.test(combined)) return 'lemon';
  if (/mango|مانجو/.test(combined)) return 'mango';
  if (/apple|تفاح/.test(combined)) return 'apple';
  if (/apricot|مشمش/.test(combined)) return 'apricot';
  if (/berry|strawberry|توت/.test(combined)) return 'berry';
  if (/orange|برتقال/.test(combined)) return 'orange';
  if (/peach|خوخ/.test(combined)) return 'peach';
  if (/fig|تين/.test(combined)) return 'fig';
  return 'fruit';
};

// أ3: fruitThemeBoost يعمل فقط إن كانت الشخصيات فاكهة، ويُدمج داخل سطر الشخصية دون فرض "fruit kingdom"
export const fruitThemeBoost = (story: StoryData, character?: Character): string => {
  if (!isFruitStory(story)) return '';
  const name = character?.name || story.characters?.[0]?.name || 'Hero';
  const fruit = character ? detectFruitKind(character) : 'fruit';
  return `${name} is a cute ${fruit} character with a face and limbs`;
};

// وصف الشخصية في 15 كلمة كحد أقصى مع دمج سمة الفاكهة أو الموضوع داخل الوصف نفسه
const formatCharacterLine = (c: Character, story: StoryData, maxWords = 15): string => {
  const cleanDesc = (c.description || c.personality || 'friendly young hero').replace(/\bVisual anchor:.*$/i, '').trim();
  const topic = story.story_info.themeTopic?.trim();
  let raw: string;
  if (isFruitStory(story)) {
    const fruitPhrase = fruitThemeBoost(story, c);
    raw = `${fruitPhrase}, ${cleanDesc}`;
  } else if (topic) {
    raw = `${c.name} (${topic} theme), ${cleanDesc}`;
  } else {
    raw = `${c.name}: ${cleanDesc}`;
  }
  return capWords(raw, maxWords);
};

// مطابقة الشخصيات الظاهرة في الصفحة فقط (من page.text و page.image_prompt)؛ إن لم تطابق أي شخصية فالرئيسية فقط
export const getCharactersForPage = (story: StoryData, page?: StoryPage): Character[] => {
  const chars = story.characters ?? [];
  if (!chars.length) return [];
  if (!page) return chars;
  const haystack = `${page.text ?? ''} ${page.image_prompt ?? ''}`.toLowerCase();
  const matched = chars.filter((c) => {
    const name = c.name?.trim().toLowerCase();
    return Boolean(name && haystack.includes(name));
  });
  return matched.length > 0 ? matched : [chars[0]];
};

// أ1 + أ3: تجميع الطلب مع سقف صارم 120 كلمة؛ إن تجاوز نقصّ وصف الشخصيات أولاً ثم الأسلوب، ولا نقصّ المشهد أبداً
const assemblePromptWithWordCap = (
  sceneLine: string,
  charactersLine: string,
  styleLine: string,
  directiveLine: string,
  maxTotalWords = 120
): string => {
  const scene = sceneLine.trim();
  let directive = directiveLine.trim();
  let chars = charactersLine.trim();
  let style = styleLine.trim();

  const total = () => countWords([scene, chars, style, directive].filter(Boolean).join(' '));

  if (total() > maxTotalWords) {
    // 1) قصّ وصف الشخصيات أولاً
    const fixedWithoutChars = countWords([scene, style, directive].filter(Boolean).join(' '));
    const allowedForChars = Math.max(0, maxTotalWords - fixedWithoutChars);
    chars = capWords(chars, allowedForChars);
  }

  if (total() > maxTotalWords) {
    // 2) قصّ الأسلوب ثانياً
    const fixedWithoutStyle = countWords([scene, chars, directive].filter(Boolean).join(' '));
    const allowedForStyle = Math.max(0, maxTotalWords - fixedWithoutStyle);
    style = capWords(style, allowedForStyle);
  }

  if (total() > maxTotalWords) {
    // 3) إذا بقي المجموع أكبر من 120 بسبب طول المشهد، نقلص التوجيه الإيجابي دون المساس بالمشهد أبداً
    chars = '';
    style = '';
    const allowedForDirective = Math.max(0, maxTotalWords - countWords(scene));
    directive = capWords(directive, allowedForDirective);
  }

  return [scene, chars, style, directive].filter(Boolean).join('\n');
};

// أ1 + ب5: يبدأ بـ "Scene: <page.image_prompt>." (مع Correction إن وجد) ثم الشخصيات في الصفحة ثم الأسلوب ثم التوجيه الإيجابي (<= 120 كلمة)
export const buildPageImagePrompt = (story: StoryData, page: StoryPage): string => {
  const rawScene = (page.image_prompt || page.text || 'A colorful children storybook illustration').trim().replace(/\.+$/, '');
  const correction = page.correctionNote?.trim()
    ? ` Correction: ${page.correctionNote.trim().replace(/\.+$/, '')}.`
    : '';
  const sceneLine = `Scene: ${rawScene}.${correction}`;

  const pageChars = getCharactersForPage(story, page);
  const charsLine = pageChars.length
    ? `Characters: ${pageChars.map((c) => formatCharacterLine(c, story, 15)).join('; ')}.`
    : '';

  const styleLine = getArtStylePrompt(story.story_info.art_style);
  return assemblePromptWithWordCap(sceneLine, charsLine, styleLine, POSITIVE_ILLUSTRATION_DIRECTIVE, 120);
};

// أ1: الغلاف يبدأ بـ "Scene: <cover_image_prompt>" أولاً، ثم العنوان كسياق فقط (لا نص يظهر في الصورة)، ثم الأسلوب
export const buildCoverPrompt = (story: StoryData): string => {
  const rawCover = (story.cover_image_prompt || story.pages[0]?.image_prompt || story.story_info.title || 'Heroic children book cover illustration').trim().replace(/\.+$/, '');
  const titleContext = story.story_info.title ? ` Story context (no text in image): "${story.story_info.title}".` : '';
  const sceneLine = `Scene: ${rawCover}.${titleContext}`;

  const mainChars = (story.characters ?? []).slice(0, 2);
  const charsLine = mainChars.length
    ? `Characters: ${mainChars.map((c) => formatCharacterLine(c, story, 15)).join('; ')}.`
    : '';

  const styleLine = getArtStylePrompt(story.story_info.art_style);
  return assemblePromptWithWordCap(sceneLine, charsLine, styleLine, POSITIVE_ILLUSTRATION_DIRECTIVE, 120);
};

// أ1: ورقة الشخصيات تبدأ بـ "Character reference sheet:" ثم الشخصيات ثم الأسلوب
export const buildSheetPrompt = (story: StoryData, withPhoto: boolean, simplified = false): string => {
  const photoNote = withPhoto ? ' Primary hero matches the attached child photo.' : '';
  const sceneLine = simplified
    ? `Character reference sheet: Simple front-view model sheet on plain background.${photoNote}`
    : `Character reference sheet: Full-body turnaround model sheet on clean plain background.${photoNote}`;

  const chars = story.characters ?? [];
  const charsLine = chars.length
    ? `Characters: ${chars.map((c) => formatCharacterLine(c, story, simplified ? 10 : 15)).join('; ')}.`
    : '';

  const styleLine = getArtStylePrompt(story.story_info.art_style);
  return assemblePromptWithWordCap(sceneLine, charsLine, styleLine, POSITIVE_ILLUSTRATION_DIRECTIVE, 120);
};

// ب5: بناء وصف مشهد مصحح عند ضغط المستخدم على «الصورة لا تطابق»
export const applySceneCorrection = (originalPrompt: string, correction: string): string => {
  const cleanPrompt = originalPrompt.replace(/\s*Correction:[\s\S]*$/i, '').trim().replace(/\.+$/, '');
  const cleanCorrection = correction.trim().replace(/\.+$/, '');
  if (!cleanCorrection) return cleanPrompt;
  return `${cleanPrompt}. Correction: ${cleanCorrection}.`;
};

// ب6: اقتراح 3 عناوين بديلة بنفس اللغة واللهجة
export const suggestAlternativeTitles = async (story: StoryData, signal?: AbortSignal): Promise<string[]> => {
  const summary = story.pages.slice(0, 5).map((p) => p.text).join(' ').slice(0, 900);
  const data = await postJson<{ titles: string[] }>(
    '/api/suggest-titles',
    {
      currentTitle: story.story_info.title,
      language: story.story_info.language,
      dialect: story.story_info.dialect,
      summary,
    },
    signal,
    2
  );
  if (!Array.isArray(data?.titles) || !data.titles.length) {
    throw new ApiError('FAILED', 'Could not generate title suggestions.', undefined, '/api/suggest-titles');
  }
  return data.titles.slice(0, 3);
};

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
          storyType: work.story_info.story_type,
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
    pageCount = total > 16 ? FIRST_BATCH_PAGES : total;
    if (!params.idea) throw new Error('Story idea cannot be empty.');
    const ar = params.language === 'Arabic';

    this.log('info', 'init', `Starting story generation: ${total} pages planned (batch 1: ${pageCount} pages).`, {
      language: params.language,
      dialect: params.dialect,
      artStyle: params.artStyle,
      storyType: params.storyType,
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

    const albumRefId = params.customCharacters?.find((c) => c.referenceImageId)?.referenceImageId;

    let result: StoryData = {
      ...parsed,
      plannedPages: total > pageCount ? total : undefined,
      characterSheetId:
        params.series?.characterSheetId ??
        albumRefId ??
        parsed.characterSheetId ??
        `seed-${Date.now()}-${Math.floor(Math.random() * 89999 + 10000)}`,
      coverFontStyle: params.coverFontStyle,
      coverTextEffect: params.coverTextEffect,
      story_info: {
        ...parsed.story_info,
        lessons: parsed.story_info.lessons ?? [],
        art_style: params.artStyle,
        aspect_ratio: params.aspectRatio,
        dialect: params.dialect,
        story_type: params.storyType,
        fruitFantasy: params.fruitFantasy,
        themeTopic: params.themeTopic,
        coverFontStyle: params.coverFontStyle,
        coverTextEffect: params.coverTextEffect,
      },
      heroPhotoId: params.series?.heroPhotoId ?? params.heroPhotoId,
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

export const rewriteImagePrompt = async (current: string, opts: { angle?: CameraAngle; instruction?: string; text?: string }, signal?: AbortSignal): Promise<string> => {
  const data = await postJson<{ prompt: string }>('/api/rewrite-prompt', { prompt: current, ...opts }, signal, 2);
  if (!data?.prompt) throw new ApiError('FAILED', 'Empty rewrite.', undefined, '/api/rewrite-prompt');
  return data.prompt;
};

export const analyzeName = async (name: string, language: Language): Promise<NameAnalysis> => {
  const trimmed = name.trim().slice(0, 60);
  if (!trimmed) throw new Error('Please enter a name first.');
  return postJson<NameAnalysis>('/api/analyze-name', { name: trimmed, language }, undefined, 2);
};

export const analyzeNameMeaning = analyzeName;
export const countPromptWords = (text: string): number => text.trim().split(/\s+/).filter(Boolean).length;

