import { GoogleGenAI, Type, type GenerateContentParameters, type GenerateContentResponse, type Schema } from '@google/genai';
import { AspectRatio, Language, NameAnalysis, StoryData, StoryParams, StoryPage } from '../types';
import { ART_STYLE_OPTIONS, IMAGE_MODEL, MAX_IDEA_LENGTH, SYSTEM_INSTRUCTION, TEXT_MODEL } from '../constants';
import { getApiKey } from './apiKey';

export const API_KEY_MISSING = 'API_KEY_MISSING';

const getClient = (): GoogleGenAI => {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error(API_KEY_MISSING);
  }
  return new GoogleGenAI({ apiKey });
};

const withTimeout = <T>(promise: Promise<T>, ms: number): Promise<T> =>
  new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Request timed out after ${Math.round(ms / 1000)}s.`)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      }
    );
  });

// Auth/validation failures never succeed on retry; everything else (timeouts, 5xx, 429) gets one more try.
const isRetryable = (err: unknown): boolean => {
  const status = (err as { status?: number }).status;
  return !(status === 400 || status === 401 || status === 403);
};

const safeGenerateContent = async (
  ai: GoogleGenAI,
  request: GenerateContentParameters,
  maxRetries = 1,
  timeoutMs = 45000
): Promise<GenerateContentResponse> => {
  let lastError: unknown = null;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await withTimeout(ai.models.generateContent(request), timeoutMs);
    } catch (err) {
      lastError = err;
      if (attempt < maxRetries && isRetryable(err)) {
        await new Promise((r) => setTimeout(r, 2000));
      } else {
        break;
      }
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Generation failed after retries.');
};

// Expands the art-style name into the full descriptive prompt the image model needs.
export const getArtStylePrompt = (style: string): string => {
  const option = ART_STYLE_OPTIONS.find((o) => o.value === style);
  return option ? option.prompt : `${style} illustration style, high quality, children friendly`;
};

const STORY_RESPONSE_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    story_info: {
      type: Type.OBJECT,
      properties: {
        title: { type: Type.STRING },
        language: { type: Type.STRING },
        age_group: { type: Type.STRING },
        art_style: { type: Type.STRING },
        lessons: { type: Type.ARRAY, items: { type: Type.STRING } },
      },
      required: ['title', 'language', 'age_group', 'art_style', 'lessons'],
    },
    characters: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING },
          description: { type: Type.STRING },
          personality: { type: Type.STRING },
          age: { type: Type.STRING },
          gender: { type: Type.STRING },
        },
        required: ['name', 'description', 'personality', 'age', 'gender'],
      },
    },
    pages: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          page: { type: Type.NUMBER },
          text: { type: Type.STRING },
          image_prompt: { type: Type.STRING },
        },
        required: ['page', 'text', 'image_prompt'],
      },
    },
  },
  required: ['story_info', 'characters', 'pages'],
};

const NAME_ANALYSIS_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    meaning: { type: Type.STRING },
    origin: { type: Type.STRING },
    traits: { type: Type.ARRAY, items: { type: Type.STRING } },
  },
  required: ['meaning', 'origin', 'traits'],
};

const sanitizeIdea = (idea: string): string => idea.trim().slice(0, MAX_IDEA_LENGTH);

const buildUserPrompt = (params: StoryParams, pageCount: number): string => {
  const langLine =
    params.language === 'Arabic'
      ? `Language: Arabic${params.dialect ? ` (${params.dialect} dialect)` : ''}`
      : 'Language: English';

  return [
    `Story idea: ${params.idea}`,
    langLine,
    `Age group: ${params.ageGroup}`,
    `Story type: ${params.storyType}`,
    `Target page count: ${pageCount}`,
    `Art style: ${getArtStylePrompt(params.artStyle)}`,
    'Follow the response schema exactly and return valid JSON only.',
  ].join('\n');
};

// Full prompt for one page: style + locked character sheet (for cross-page consistency) + the scene.
export const buildPageImagePrompt = (story: StoryData, page: StoryPage): string => {
  const characterSheet = story.characters
    .map((c) => `${c.name} (${c.gender || 'character'}, ${c.age}): ${c.description}. MUST remain visually identical (same face, species, colors).`)
    .join(' | ');

  return [
    `Art style: ${getArtStylePrompt(story.story_info.art_style)}.`,
    `CHARACTERS ENFORCED: ${characterSheet}.`,
    `Scene: ${page.image_prompt}`,
    'No text, no captions, no watermarks in the image.',
  ].join(' ');
};

const FALLBACK_PAGE_TEXT = {
  ar: 'في يوم جميل، بدأ بطلنا مغامرة رائعة مليئة بالمفاجآت، وكان متحمسًا لاكتشاف ما ينتظره.',
  en: 'One beautiful day, our hero began an exciting adventure full of surprises.',
};

// The model sometimes returns an empty page or a "This is page N" placeholder instead of narrative.
const isPlaceholderText = (text: string): boolean => {
  const lower = text.toLowerCase();
  return text.length < 10 || lower.startsWith('this is page') || text.startsWith('هذه هي الصفحة رقم');
};

export class StoryGenerator {
  private ai = getClient();
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

  public async generate(
    rawParams: StoryParams,
    pageCount: number,
    onProgress: (progress: number, message: string) => void
  ): Promise<StoryData> {
    const params: StoryParams = { ...rawParams, idea: sanitizeIdea(rawParams.idea) };
    if (!params.idea) {
      throw new Error('Story idea cannot be empty.');
    }

    onProgress(5, 'Preparing story request...');
    await this.waitIfPaused();

    let raw = '';
    try {
      const response = await safeGenerateContent(
        this.ai,
        {
          model: TEXT_MODEL,
          contents: buildUserPrompt(params, pageCount),
          config: {
            systemInstruction: SYSTEM_INSTRUCTION,
            responseMimeType: 'application/json',
            responseSchema: STORY_RESPONSE_SCHEMA,
          },
        },
        1,
        60000
      );
      raw = response.text ?? '';
    } catch (err) {
      throw new Error(`Story generation request failed: ${(err as Error).message}`);
    }

    onProgress(60, 'Parsing story structure...');
    const parsed = this.parseStoryResponse(raw);
    this.validateStoryData(parsed);

    onProgress(80, 'Validating story pages...');
    const isArabic = params.language === 'Arabic';
    const storyData: StoryData = {
      ...parsed,
      story_info: {
        ...parsed.story_info,
        lessons: parsed.story_info.lessons ?? [],
        art_style: params.artStyle,
        aspect_ratio: params.aspectRatio,
        dialect: params.dialect,
      },
      pages: parsed.pages.map((p, i) => {
        const text = (p.text ?? '').trim();
        return {
          page: i + 1,
          text: isPlaceholderText(text) ? (isArabic ? FALLBACK_PAGE_TEXT.ar : FALLBACK_PAGE_TEXT.en) : text,
          image_prompt: p.image_prompt,
        };
      }),
    };

    onProgress(100, 'Story text ready.');
    return storyData;
  }

  private parseStoryResponse(raw: string): StoryData {
    try {
      return JSON.parse(raw) as StoryData;
    } catch {
      // Fallback: the model occasionally wraps JSON in markdown fences despite
      // responseSchema/responseMimeType — strip them and retry once.
      const cleaned = raw.replace(/```json|```/g, '').trim();
      try {
        return JSON.parse(cleaned) as StoryData;
      } catch {
        throw new Error('Could not parse the story JSON returned by the model.');
      }
    }
  }

  private validateStoryData(data: StoryData): void {
    if (!data?.pages?.length) throw new Error('The model returned zero pages.');
    if (!data?.characters?.length) throw new Error('The model returned zero characters.');
  }
}

export const generateIllustration = async (prompt: string, aspectRatio: AspectRatio): Promise<string> => {
  const ai = getClient();
  const response = await safeGenerateContent(
    ai,
    {
      model: IMAGE_MODEL,
      contents: { parts: [{ text: prompt }] },
      config: { imageConfig: { aspectRatio } },
    },
    1,
    90000
  );

  const parts = response.candidates?.[0]?.content?.parts ?? [];
  const imagePart = parts.find((p) => p.inlineData?.data);

  if (!imagePart?.inlineData?.data) {
    throw new Error('No image was returned for this page — the prompt may have been blocked.');
  }

  return imagePart.inlineData.data;
};

// Rewrites only the camera angle / composition; subject and style stay as they were.
export const regeneratePrompt = async (currentPrompt: string): Promise<string> => {
  const ai = getClient();
  const response = await safeGenerateContent(
    ai,
    {
      model: TEXT_MODEL,
      contents: `Rewrite the following image prompt to change the camera angle or composition, while keeping the subject, characters and art style exactly the same. Original: "${currentPrompt}". Return ONLY the new prompt text.`,
    },
    1,
    20000
  );
  return response.text?.trim() || currentPrompt;
};

export const analyzeNameMeaning = async (name: string, language: Language): Promise<NameAnalysis> => {
  const ai = getClient();
  const trimmed = name.trim().slice(0, 60);
  if (!trimmed) throw new Error('Please enter a name first.');

  const prompt =
    language === 'Arabic'
      ? `حلّل اسم "${trimmed}" للأطفال: المعنى، الأصل، وثلاث صفات إيجابية مرتبطة به. أسلوب لطيف ومناسب للأطفال. أعد JSON فقط.`
      : `Analyze the name "${trimmed}" for kids: its meaning, origin, and three positive traits associated with it. Warm, kid-friendly tone. Return JSON only.`;

  const response = await safeGenerateContent(
    ai,
    {
      model: TEXT_MODEL,
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: NAME_ANALYSIS_SCHEMA,
      },
    },
    1,
    30000
  );

  return JSON.parse(response.text ?? '{}') as NameAnalysis;
};
