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
import { IMAGE_BATCH_SIZE } from '../constants';

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
    const params: StoryParams = { ...rawParams, idea: rawParams.idea.trim().slice(0, 500) };
    if (!params.idea) {
      throw new Error('Story idea cannot be empty.');
    }

    onProgress(15, 'Sending story request to studio AI...');

    const res = await fetch('/api/generate-story', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ params, pageCount }),
    });

    if (!res.ok) {
      let errorMessage = 'Failed to generate story';
      try {
        const errorData = await res.json();
        errorMessage = errorData.error || errorMessage;
      } catch {
        // fallback
      }
      throw new Error(errorMessage);
    }

    onProgress(85, 'Validating generated story structure...');
    const storyData: StoryData = await res.json();

    if (!storyData?.pages?.length || !storyData?.characters?.length) {
      throw new Error('The story generation returned incomplete data.');
    }

    onProgress(100, 'Story text ready.');
    return storyData;
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
  const res = await fetch('/api/generate-image', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ prompt, aspectRatio }),
  });

  if (!res.ok) {
    let errorMessage = 'Failed to generate illustration';
    try {
      const errorData = await res.json();
      errorMessage = errorData.error || errorMessage;
    } catch {
      // fallback
    }
    throw new Error(errorMessage);
  }

  const data = await res.json();
  if (!data?.base64) {
    throw new Error('No image was returned for this page — the prompt may have been blocked.');
  }

  return data.base64;
};

export const analyzeNameMeaning = async (name: string, language: Language): Promise<NameAnalysis> => {
  const trimmed = name.trim().slice(0, 60);
  if (!trimmed) throw new Error('Please enter a name first.');

  const res = await fetch('/api/analyze-name', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ name: trimmed, language }),
  });

  if (!res.ok) {
    let errorMessage = 'Failed to analyze name';
    try {
      const errorData = await res.json();
      errorMessage = errorData.error || errorMessage;
    } catch {
      // fallback
    }
    throw new Error(errorMessage);
  }

  return await res.json() as NameAnalysis;
};
