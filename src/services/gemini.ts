import { AspectRatio, Language, NameAnalysis, StoryData, StoryParams, StoryPage } from '../types';
import { ART_STYLE_OPTIONS, MAX_IDEA_LENGTH } from '../constants';
import { ApiError, authHeaders, codeFromStatus, postJson, type ApiErrorCode, type TrailItem } from './api';
import { base64ToBlob, type ImageKind } from './media';

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

export class StoryGenerator {
  private isPaused = false;
  private resumeResolver: (() => void) | null = null;

  public pause(): void {
    this.isPaused = true;
  }

  public resume(): void {
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
    if (!params.idea) throw new Error('Story idea cannot be empty.');
    const ar = params.language === 'Arabic';

    onProgress({ progress: 6, message: ar ? 'نجهّز فكرة القصة...' : 'Preparing your story...' });
    await this.waitIfPaused();

    if (navigator.onLine === false) throw new ApiError('OFFLINE');
    let res: Response;
    try {
      res = await fetch('/api/generate-story', { method: 'POST', headers: authHeaders(), body: JSON.stringify({ params, pageCount }) });
    } catch {
      throw new ApiError('BUSY', undefined, undefined, '/api/generate-story');
    }
    if (!res.ok || !res.body) {
      let data: { code?: ApiErrorCode; error?: string; trail?: TrailItem[] } = {};
      try {
        data = await res.json();
      } catch {
        // ignore
      }
      throw new ApiError(data.code ?? codeFromStatus(res.status), data.error, data.trail, '/api/generate-story');
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
          progress: Math.min(94, 12 + Math.round((count / pageCount) * 82)),
          message: ar ? `نكتب الصفحة ${Math.min(count + 1, pageCount)} من ${pageCount}...` : `Writing page ${Math.min(count + 1, pageCount)} of ${pageCount}...`,
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

    onProgress({ progress: 100, message: ar ? 'القصة جاهزة!' : 'Story ready!' });

    return {
      ...parsed,
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
      quiz: (parsed.quiz ?? []).filter((q) => q?.question && Array.isArray(q.options) && q.options.length >= 2),
      pages: parsed.pages.map((p, i) => ({
        page: i + 1,
        text: (p.text ?? '').trim(),
        narration: (p.narration ?? '').trim() || (p.text ?? '').trim(),
        image_prompt: p.image_prompt,
      })),
    };
  }
}

export interface ImageRequest {
  prompt: string;
  aspectRatio: AspectRatio;
  references?: { data: string; mimeType: string }[];
  kind?: ImageKind;
}

export const generateIllustration = async ({ prompt, aspectRatio, references }: ImageRequest, signal?: AbortSignal): Promise<Blob> => {
  const data = await postJson<{ base64: string; mimeType: string }>('/api/generate-image', { prompt, aspectRatio, references }, signal);
  if (!data?.base64) throw new ApiError('FAILED');
  return base64ToBlob(data.base64, data.mimeType);
};

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

export const regeneratePrompt = async (currentPrompt: string): Promise<string> => {
  const variations = [
    ', wide angle view, warm sunlight, cinematic perspective',
    ', close-up shot focusing on character expression, soft depth of field',
    ', dynamic side angle view, rich colorful details',
    ', bird eye perspective, charming storybook depth',
  ];
  const variation = variations[Math.floor(Math.random() * variations.length)];
  return `${currentPrompt.replace(/, (wide angle|close-up|dynamic|bird eye).*/i, '')}${variation}`;
};

export const analyzeNameMeaning = async (name: string, language: Language): Promise<NameAnalysis> => {
  const trimmed = name.trim().slice(0, 60);
  if (!trimmed) throw new Error('Please enter a name first.');
  return postJson<NameAnalysis>('/api/analyze-name', { name: trimmed, language });
};
