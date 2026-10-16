import { AspectRatio, Language, NameAnalysis, StoryData, StoryParams, StoryPage } from '../types';
import { ART_STYLE_OPTIONS, MAX_IDEA_LENGTH } from '../constants';

export const API_KEY_MISSING = 'API_KEY_MISSING';

export const getArtStylePrompt = (style: string): string => {
  const option = ART_STYLE_OPTIONS.find((o) => o.value === style);
  return option ? option.prompt : `${style} illustration style, high quality, children friendly`;
};

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
    const params: StoryParams = { ...rawParams, idea: rawParams.idea.trim().slice(0, MAX_IDEA_LENGTH) };
    if (!params.idea) {
      throw new Error('Story idea cannot be empty.');
    }

    onProgress(15, 'Preparing story request...');
    await this.waitIfPaused();

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
        // continue
      }
      throw new Error(errorMessage);
    }

    onProgress(75, 'Validating story pages and characters...');
    await this.waitIfPaused();

    const parsed: StoryData = await res.json();
    if (!parsed?.pages?.length || !parsed?.characters?.length) {
      throw new Error('The story generation returned incomplete data.');
    }

    const storyData: StoryData = {
      ...parsed,
      story_info: {
        ...parsed.story_info,
        lessons: parsed.story_info.lessons ?? [],
        art_style: params.artStyle,
        aspect_ratio: params.aspectRatio,
        dialect: params.dialect,
      },
      pages: parsed.pages.map((p, i) => ({
        page: i + 1,
        text: (p.text ?? '').trim(),
        image_prompt: p.image_prompt,
      })),
    };

    onProgress(100, 'Story text ready.');
    return storyData;
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
      // continue
    }
    throw new Error(errorMessage);
  }

  const data = await res.json();
  if (!data?.base64) {
    throw new Error('No image was returned for this page.');
  }

  return data.base64;
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
      // continue
    }
    throw new Error(errorMessage);
  }

  return (await res.json()) as NameAnalysis;
};
