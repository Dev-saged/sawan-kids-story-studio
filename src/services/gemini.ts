import { GoogleGenAI, Type, type Schema } from '@google/genai';
import {
  AspectRatio,
  Character,
  Language,
  NameAnalysis,
  PageImage,
  StoryData,
  StoryParams,
  StoryPage,
} from '../types';
import { IMAGE_MODEL, MAX_IDEA_LENGTH, IMAGE_BATCH_SIZE, SYSTEM_INSTRUCTION, TEXT_MODEL } from '../constants';

const getClient = (): GoogleGenAI => {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY as string | undefined;
  if (!apiKey) {
    throw new Error(
      'VITE_GEMINI_API_KEY is missing. Copy .env.example to .env and set your Gemini API key.'
    );
  }
  return new GoogleGenAI({ apiKey });
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
    `Art style: ${params.artStyle}`,
    'Follow the response schema exactly and return valid JSON only.',
  ].join('\n');
};

const buildImagePrompt = (page: StoryPage, characters: Character[], artStyle: string): string => {
  const characterSheet = characters
    .map((c) => `${c.name} (${c.gender}, ${c.age}): ${c.description}`)
    .join('; ');

  return [
    `Art style: ${artStyle}.`,
    `Consistent character designs — do not alter appearance, species, or colors: ${characterSheet}.`,
    `Scene: ${page.image_prompt}`,
    'No text, no captions, no watermarks in the image.',
  ].join(' ');
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

    let raw = '';
    try {
      const response = await this.ai.models.generateContent({
        model: TEXT_MODEL,
        contents: buildUserPrompt(params, pageCount),
        config: {
          systemInstruction: SYSTEM_INSTRUCTION,
          responseMimeType: 'application/json',
          responseSchema: STORY_RESPONSE_SCHEMA,
        },
      });
      raw = response.text ?? '';
    } catch (err) {
      throw new Error(`Story generation request failed: ${(err as Error).message}`);
    }

    onProgress(60, 'Parsing story structure...');
    const storyData = this.parseStoryResponse(raw);

    onProgress(80, 'Validating story pages...');
    this.validateStoryData(storyData);

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

  public async generateImagesForStory(
    storyData: StoryData,
    aspectRatio: AspectRatio,
    artStyle: string,
    onProgress: (progress: number, message: string) => void
  ): Promise<PageImage[]> {
    const results: PageImage[] = [];
    const total = storyData.pages.length;

    for (let i = 0; i < total; i += IMAGE_BATCH_SIZE) {
      await this.waitIfPaused();

      const batch = storyData.pages.slice(i, i + IMAGE_BATCH_SIZE);
      const batchResults = await Promise.all(
        batch.map(async (page) => {
          const prompt = buildImagePrompt(page, storyData.characters, artStyle);
          const base64 = await generateIllustration(prompt, aspectRatio);
          return { page: page.page, base64 };
        })
      );

      results.push(...batchResults);
      onProgress(
        Math.round(((i + batchResults.length) / total) * 100),
        `Illustrated ${i + batchResults.length} of ${total} pages...`
      );
    }

    return results.sort((a, b) => a.page - b.page);
  }
}

export const generateIllustration = async (prompt: string, aspectRatio: AspectRatio): Promise<string> => {
  const ai = getClient();
  const response = await ai.models.generateContent({
    model: IMAGE_MODEL,
    contents: { parts: [{ text: prompt }] },
    config: { imageConfig: { aspectRatio } },
  });

  const parts = response.candidates?.[0]?.content?.parts ?? [];
  const imagePart = parts.find((p) => p.inlineData?.data);

  if (!imagePart?.inlineData?.data) {
    throw new Error('No image was returned for this page — the prompt may have been blocked.');
  }

  return imagePart.inlineData.data;
};

export const analyzeNameMeaning = async (name: string, language: Language): Promise<NameAnalysis> => {
  const ai = getClient();
  const trimmed = name.trim().slice(0, 60);
  if (!trimmed) throw new Error('Please enter a name first.');

  const prompt =
    language === 'Arabic'
      ? `حلّل اسم "${trimmed}" للأطفال: المعنى، الأصل، وثلاث صفات إيجابية مرتبطة به. أسلوب لطيف ومناسب للأطفال. أعد JSON فقط.`
      : `Analyze the name "${trimmed}" for kids: its meaning, origin, and three positive traits associated with it. Warm, kid-friendly tone. Return JSON only.`;

  const response = await ai.models.generateContent({
    model: TEXT_MODEL,
    contents: prompt,
    config: {
      responseMimeType: 'application/json',
      responseSchema: NAME_ANALYSIS_SCHEMA,
    },
  });

  return JSON.parse(response.text ?? '{}') as NameAnalysis;
};
