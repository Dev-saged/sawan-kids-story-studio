import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { ASPECT_RATIO_OPTIONS } from '../constants';
import { generatePDFBlob } from './pdf';
import { AspectRatio, BookSize, Character, PageImage, StoryData, StoryPage } from '../types';

export const LOCAL_STORY_KEY = 'sawan_story';

const safeFileName = (title: string, fallback: string): string =>
  (title || fallback).trim().replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, '_').slice(0, 80) || fallback;

const isArabicStory = (story: StoryData): boolean => story.story_info.language?.toLowerCase().includes('arabic');

// Transient UI flags must never be persisted.
const forStorage = (story: StoryData): StoryData => ({
  ...story,
  pages: story.pages.map(({ page, text, image_prompt, generatedImage }) => ({ page, text, image_prompt, generatedImage })),
});

export const allImagesReady = (story: StoryData): boolean => story.pages.length > 0 && story.pages.every((p) => Boolean(p.generatedImage));

export const exportStoryAsPDF = async (
  story: StoryData,
  bookSize: BookSize,
  onProgress?: (msg: string) => void
): Promise<void> => {
  const blob = await generatePDFBlob(story, bookSize, isArabicStory(story), onProgress);
  saveAs(blob, `${safeFileName(story.story_info.title, 'story')}_book.pdf`);
};

export const exportImagesAsZip = async (story: StoryData): Promise<void> => {
  const zip = new JSZip();
  story.pages.forEach((p) => {
    if (p.generatedImage) zip.file(`page-${String(p.page).padStart(2, '0')}.png`, p.generatedImage, { base64: true });
  });
  const blob = await zip.generateAsync({ type: 'blob' });
  saveAs(blob, `${safeFileName(story.story_info.title, 'story')}-images.zip`);
};

// Everything in one archive: editable JSON, plain text, cover + page images, and the finished PDF book.
export const exportFullPackage = async (
  story: StoryData,
  bookSize: BookSize,
  onProgress?: (msg: string) => void
): Promise<void> => {
  const ar = isArabicStory(story);
  const name = safeFileName(story.story_info.title, 'story');
  const zip = new JSZip();
  const root = zip.folder(name);
  if (!root) throw new Error('Could not create the archive folder.');

  root.file('story.json', JSON.stringify(forStorage(story), null, 2));
  root.file(
    'story.txt',
    `${story.story_info.title}\n\n` + story.pages.map((p) => `${ar ? 'صفحة' : 'Page'} ${p.page}:\n${p.text}`).join('\n\n')
  );

  const pagesFolder = root.folder('pages');
  story.pages.forEach((p, i) => {
    if (!p.generatedImage) return;
    if (i === 0) root.file('cover.png', p.generatedImage, { base64: true });
    pagesFolder?.file(`page_${String(p.page).padStart(2, '0')}.png`, p.generatedImage, { base64: true });
  });

  root.file('book.pdf', await generatePDFBlob(story, bookSize, ar, onProgress));

  onProgress?.(ar ? 'يتم ضغط الملفات...' : 'Compressing files...');
  saveAs(await zip.generateAsync({ type: 'blob' }), `${name}_package.zip`);
};

export const saveStoryAsJSON = (story: StoryData): void => {
  const blob = new Blob([JSON.stringify(forStorage(story), null, 2)], { type: 'application/json' });
  saveAs(blob, `${safeFileName(story.story_info.title, 'story')}.json`);
};

// Browser storage has a small quota and illustrated stories are large; fall back to a file download.
export const saveStoryLocally = (story: StoryData): 'local' | 'file' => {
  try {
    localStorage.setItem(LOCAL_STORY_KEY, JSON.stringify({ ...forStorage(story), savedAt: new Date().toISOString() }));
    return 'local';
  } catch {
    saveStoryAsJSON(story);
    return 'file';
  }
};

const BASE64 = /^[A-Za-z0-9+/]+={0,2}$/;
const str = (v: unknown, fallback = ''): string => (typeof v === 'string' ? v : fallback);

// Rebuilds a story from untrusted JSON field by field, so nothing unexpected (e.g. a crafted
// "image" with quotes) can reach the DOM/PDF templates.
const normalizeStory = (raw: unknown, legacyImages: PageImage[] = []): StoryData => {
  const r = raw as { story_info?: Record<string, unknown>; characters?: unknown; pages?: unknown } | null;
  if (!r || typeof r !== 'object' || !r.story_info || !Array.isArray(r.pages) || r.pages.length === 0) {
    throw new Error('Invalid story file format.');
  }
  const info = r.story_info;
  const ratio = ASPECT_RATIO_OPTIONS.some((o) => o.value === info.aspect_ratio) ? (info.aspect_ratio as AspectRatio) : '4:3';
  const legacy = new Map(legacyImages.map((i) => [i.page, i.base64]));

  const pages: StoryPage[] = r.pages.map((p: Record<string, unknown>, i: number) => {
    const number = typeof p?.page === 'number' ? p.page : i + 1;
    const image = str(p?.generatedImage) || legacy.get(number) || '';
    return {
      page: number,
      text: str(p?.text),
      image_prompt: str(p?.image_prompt),
      generatedImage: BASE64.test(image) ? image : undefined,
    };
  });

  const characters: Character[] = (Array.isArray(r.characters) ? r.characters : []).map((c: Record<string, unknown>) => ({
    name: str(c?.name),
    description: str(c?.description),
    personality: str(c?.personality),
    age: str(c?.age),
    gender: str(c?.gender),
  }));

  return {
    story_info: {
      title: str(info.title, 'Story'),
      language: str(info.language),
      age_group: str(info.age_group),
      art_style: str(info.art_style),
      aspect_ratio: ratio,
      dialect: typeof info.dialect === 'string' ? info.dialect : undefined,
      lessons: Array.isArray(info.lessons) ? info.lessons.filter((l): l is string => typeof l === 'string') : [],
    },
    characters,
    pages,
  };
};

const parseStoryJSON = (text: string): StoryData => {
  const parsed = JSON.parse(text);
  // v1.2 files wrapped the story and kept images beside it.
  if (parsed?.storyData) return normalizeStory(parsed.storyData, Array.isArray(parsed.images) ? parsed.images : []);
  return normalizeStory(parsed);
};

export const hasSavedStory = (): boolean => {
  try {
    return localStorage.getItem(LOCAL_STORY_KEY) !== null;
  } catch {
    return false;
  }
};

export const loadStoryLocally = (): StoryData | null => {
  try {
    const text = localStorage.getItem(LOCAL_STORY_KEY);
    return text ? parseStoryJSON(text) : null;
  } catch {
    return null;
  }
};

export const loadStoryFromJSON = (file: File): Promise<StoryData> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        resolve(parseStoryJSON(reader.result as string));
      } catch (err) {
        reject(new Error(`Failed to read story file: ${(err as Error).message}`));
      }
    };
    reader.onerror = () => reject(new Error('Failed to read file.'));
    reader.readAsText(file);
  });
