import { ChildProfile, StoryData, StoryPage } from '../types';
import { dbAll, dbDelete, dbGet, dbPut, newId } from './db';
import { blobToBase64, getImage, reencode, saveImage, srcToBlob } from './media';

const LEGACY_KEY = 'sawan-saved-story';

const isRuntimeUrl = (v?: string) => Boolean(v?.startsWith('blob:'));

// نسخة قابلة للتخزين: بدون روابط blob ولا حالات التحميل
const toRecord = (story: StoryData): StoryData => ({
  ...story,
  coverImage: undefined,
  pages: story.pages.map(({ isGeneratingImage: _g, imageError: _e, generatedImage, ...rest }) => ({
    ...rest,
    generatedImage: isRuntimeUrl(generatedImage) ? undefined : generatedImage,
  })),
});

const migrateImage = async (raw: string | undefined, style: string, prompt: string, kind: 'page' | 'cover') => {
  if (!raw || isRuntimeUrl(raw)) return null;
  const blob = await reencode(await srcToBlob(raw), 2048);
  return saveImage(blob, kind, style, prompt);
};

// تجهيز قصة للعرض: معرّف، ترحيل base64 القديم، وروابط الصور من القاعدة
export const hydrateStory = async (input: StoryData): Promise<StoryData> => {
  const style = input.story_info.art_style;
  const pages: StoryPage[] = await Promise.all(
    input.pages.map(async (p) => {
      if (p.imageId) {
        const img = await getImage(p.imageId);
        if (img) return { ...p, generatedImage: img.url };
      }
      const migrated = await migrateImage(p.generatedImage, style, p.image_prompt, 'page').catch(() => null);
      return migrated ? { ...p, imageId: migrated.id, generatedImage: migrated.url } : { ...p, generatedImage: undefined, imageId: undefined };
    })
  );
  const cover = input.coverImageId ? await getImage(input.coverImageId) : await migrateImage(input.coverImage, style, input.cover_image_prompt ?? '', 'cover').catch(() => null);
  const now = Date.now();
  return {
    ...input,
    id: input.id ?? newId(),
    createdAt: input.createdAt ?? now,
    updatedAt: now,
    pages,
    coverImageId: cover ? ('id' in cover ? cover.id : input.coverImageId) : undefined,
    coverImage: cover?.url,
  };
};

export const saveStory = async (story: StoryData): Promise<void> => {
  if (!story.id) return;
  try {
    await dbPut('stories', { ...toRecord(story), updatedAt: Date.now() });
  } catch (err) {
    console.warn('Library save failed:', err);
  }
};

export interface StorySummary {
  id: string;
  title: string;
  pages: number;
  illustrated: number;
  updatedAt: number;
  coverUrl?: string;
  language: string;
  partNumber?: number;
}

export const listStories = async (): Promise<StorySummary[]> => {
  let records: StoryData[] = [];
  try {
    records = await dbAll<StoryData>('stories');
  } catch {
    return [];
  }
  const summaries = await Promise.all(
    records.map(async (s) => {
      const coverId = s.coverImageId ?? s.pages.find((p) => p.imageId)?.imageId;
      const cover = await getImage(coverId);
      return {
        id: s.id!,
        title: s.story_info.title,
        pages: s.pages.length,
        illustrated: s.pages.filter((p) => p.imageId).length,
        updatedAt: s.updatedAt ?? 0,
        coverUrl: cover?.url,
        language: s.story_info.language,
        partNumber: s.partNumber,
      };
    })
  );
  return summaries.sort((a, b) => b.updatedAt - a.updatedAt);
};

export const loadStory = async (id: string): Promise<StoryData | null> => {
  try {
    const rec = await dbGet<StoryData>('stories', id);
    return rec ? hydrateStory(rec) : null;
  } catch {
    return null;
  }
};

export const deleteStory = (id: string) => dbDelete('stories', id).catch(() => undefined);

export const latestStory = async (): Promise<StoryData | null> => {
  const list = await listStories();
  if (list[0]) return loadStory(list[0].id);
  // ترحيل القصة القديمة المحفوظة في localStorage
  try {
    const raw = localStorage.getItem(LEGACY_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoryData;
    if (!parsed.story_info || !Array.isArray(parsed.pages)) return null;
    const story = await hydrateStory(parsed);
    await saveStory(story);
    localStorage.removeItem(LEGACY_KEY);
    return story;
  } catch {
    return null;
  }
};

export const hasAnyStory = async (): Promise<boolean> => {
  try {
    if (localStorage.getItem(LEGACY_KEY)) return true;
  } catch {
    // ignore
  }
  return (await listStories()).length > 0;
};

// نسخة JSON محمولة بصور مضمّنة
export const serializeStory = async (story: StoryData): Promise<string> => {
  const embed = async (url?: string) => (url ? `data:image/webp;base64,${await blobToBase64(await srcToBlob(url))}` : undefined);
  const record = toRecord(story);
  const pages = await Promise.all(story.pages.map(async (p, i) => ({ ...record.pages[i], imageId: undefined, generatedImage: await embed(p.generatedImage) })));
  return JSON.stringify(
    { ...record, id: undefined, coverImageId: undefined, characterSheetId: undefined, heroPhotoId: undefined, coverImage: await embed(story.coverImage), pages },
    null,
    2
  );
};

// ملفات الأطفال: الصورة تُحفظ مصغّرة لإعادة الاستخدام في قصص لاحقة
export const saveChild = async (name: string, file: Blob): Promise<ChildProfile & { photoUrl: string }> => {
  const photo = await reencode(file, 1024, 'image/jpeg', 0.88);
  const { id: photoId, url } = await saveImage(photo, 'photo', 'photo', name);
  const child: ChildProfile = { id: newId(), name: name.trim().slice(0, 40), photoId, createdAt: Date.now() };
  await dbPut('children', child);
  return { ...child, photoUrl: url };
};

export const listChildren = async (): Promise<(ChildProfile & { photoUrl?: string })[]> => {
  try {
    const all = await dbAll<ChildProfile>('children');
    const withPhotos = await Promise.all(all.map(async (c) => ({ ...c, photoUrl: (await getImage(c.photoId))?.url })));
    return withPhotos.sort((a, b) => b.createdAt - a.createdAt);
  } catch {
    return [];
  }
};

export const deleteChild = (id: string) => dbDelete('children', id).catch(() => undefined);
