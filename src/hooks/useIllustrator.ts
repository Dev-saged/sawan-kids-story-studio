import { useCallback, useEffect, useRef, useState } from 'react';
import { StoryData, StoryPage } from '../types';
import { ApiError } from '../services/api';
import { buildCoverPrompt, buildPageImagePrompt, buildSheetPrompt, generateIllustration } from '../services/gemini';
import { findSimilarImage, getImage, reencode, saveImage, toReference, type ImageKind } from '../services/media';
import { hashText } from '../services/db';

type Updater = (fn: (s: StoryData) => StoryData) => void;
type Ref = { data: string; mimeType: string };

const CONCURRENCY = 2;
// أخطاء لا فائدة من تكرار الطلب معها
const FATAL = new Set(['AUTH', 'BILLING', 'NOMODEL', 'OFFLINE']);
// حصة مؤقتة: نتوقف ثم نكمل تلقائياً (النص والصوت يعملان بحصص نماذج أخرى)
const RESUME_AFTER_MS = 45_000;
const MAX_AUTO_RESUMES = 3;

// خط إنتاج الصور: ورقة الشخصيات ← الغلاف ← الصفحات (الأقرب للقارئ أولاً، صورتان بالتوازي)
export function useIllustrator(story: StoryData, update: Updater, focusIndex: number) {
  const storyRef = useRef(story);
  storyRef.current = story;
  const focusRef = useRef(focusIndex);
  focusRef.current = focusIndex;
  const inFlight = useRef(new Set<number>());
  const refsCache = useRef<Ref[] | null>(null);
  const ctrlRef = useRef<AbortController | null>(null);
  const runningRef = useRef(false);
  const resumeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const resumes = useRef(0);
  const retryAllRef = useRef<() => void>(() => undefined);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);

  // مفتاح الإعادة: نفس الأسلوب + نفس الشخصيات + نفس صورة البطل
  const cacheStyle = (s: StoryData) =>
    `${s.story_info.art_style}|${s.heroPhotoId ?? ''}|${hashText(s.characters.map((c) => c.description).join('|'))}`;

  const usedIds = (s: StoryData) => new Set([s.coverImageId, s.characterSheetId, ...s.pages.map((p) => p.imageId)].filter(Boolean) as string[]);

  // التشابه يُقاس على وصف المشهد وحده، ولا تتكرر صورة داخل نفس القصة
  const create = async (s: StoryData, kind: ImageKind, prompt: string, matchText: string, refs: Ref[], reuse: boolean, signal: AbortSignal) => {
    if (reuse) {
      const hit = await findSimilarImage(matchText, cacheStyle(s), kind, kind === 'sheet' ? 0.9 : 0.82, usedIds(s));
      if (hit) return hit;
    }
    const raw = await generateIllustration({ prompt, aspectRatio: kind === 'sheet' ? '16:9' : s.story_info.aspect_ratio || '4:3', references: refs }, signal);
    return saveImage(await reencode(raw, 2048), kind, cacheStyle(s), matchText);
  };

  const references = async (signal: AbortSignal): Promise<Ref[]> => {
    if (refsCache.current) return refsCache.current;
    const s = storyRef.current;
    const photo = await getImage(s.heroPhotoId);
    let sheet = await getImage(s.characterSheetId);
    if (!sheet) {
      try {
        const made = await create(s, 'sheet', buildSheetPrompt(s, Boolean(photo)), s.characters.map((c) => c.description).join(' '), photo ? [await toReference(photo.blob)] : [], true, signal);
        update((prev) => ({ ...prev, characterSheetId: made.id }));
        sheet = await getImage(made.id);
      } catch (err) {
        if (err instanceof ApiError && FATAL.has(err.code)) throw err;
      }
    }
    const refs: Ref[] = [];
    if (sheet) refs.push(await toReference(sheet.blob));
    if (photo) refs.push(await toReference(photo.blob));
    refsCache.current = refs;
    return refs;
  };

  const setPage = (pageNo: number, patch: Partial<StoryPage>) =>
    update((s) => ({ ...s, pages: s.pages.map((p) => (p.page === pageNo ? { ...p, ...patch } : p)) }));

  const paintPage = useCallback(
    async (pageNo: number, force = false, signal: AbortSignal = new AbortController().signal) => {
      if (inFlight.current.has(pageNo)) return;
      const page = storyRef.current.pages.find((p) => p.page === pageNo);
      if (!page) return;
      inFlight.current.add(pageNo);
      setPage(pageNo, { isGeneratingImage: true, imageError: false });
      try {
        const refs = await references(signal);
        const img = await create(storyRef.current, 'page', buildPageImagePrompt(storyRef.current, page), page.image_prompt, refs, !force, signal);
        setPage(pageNo, { generatedImage: img.url, imageId: img.id, isGeneratingImage: false, imageError: false });
      } catch (err) {
        setPage(pageNo, { isGeneratingImage: false, imageError: (err as Error).name !== 'AbortError' });
        throw err;
      } finally {
        inFlight.current.delete(pageNo);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [update]
  );

  const paintCover = async (signal: AbortSignal, force = false) => {
    const refs = await references(signal);
    const s = storyRef.current;
    const img = await create(s, 'cover', buildCoverPrompt(s), `${s.story_info.title} ${s.cover_image_prompt ?? ''}`, refs, !force, signal);
    update((s) => ({ ...s, coverImage: img.url, coverImageId: img.id }));
  };

  const nextPage = (): number | null => {
    const pages = storyRef.current.pages;
    const focus = focusRef.current;
    const pending = pages
      .map((p, i) => ({ p, d: i >= focus ? i - focus : (focus - i) * 2 }))
      .filter(({ p }) => !p.generatedImage && !p.imageError && !inFlight.current.has(p.page))
      .sort((a, b) => a.d - b.d);
    return pending[0]?.p.page ?? null;
  };

  const run = useCallback(async () => {
    if (runningRef.current) return;
    runningRef.current = true;
    setRunning(true);
    setError(null);
    const ctrl = new AbortController();
    ctrlRef.current = ctrl;
    const fatal = (err: unknown) => {
      if (err instanceof ApiError && err.code === 'QUOTA' && resumes.current < MAX_AUTO_RESUMES) {
        const ar = document.documentElement.lang === 'ar';
        setError(`${err.message} ${ar ? 'سنكمل الرسم تلقائياً بعد قليل.' : 'We will resume painting automatically shortly.'}`);
        ctrl.abort();
        resumeTimer.current = setTimeout(() => {
          resumes.current += 1;
          retryAllRef.current();
        }, RESUME_AFTER_MS);
        return true;
      }
      if (err instanceof ApiError && (FATAL.has(err.code) || err.code === 'QUOTA')) {
        setError(err.message);
        ctrl.abort();
        return true;
      }
      return (err as Error).name === 'AbortError';
    };
    try {
      await references(ctrl.signal);
      const worker = async () => {
        for (let next = nextPage(); next !== null && !ctrl.signal.aborted; next = nextPage()) {
          try {
            await paintPage(next, false, ctrl.signal);
          } catch (err) {
            if (fatal(err)) return;
          }
        }
      };
      await Promise.all(Array.from({ length: CONCURRENCY }, worker));
      if (!ctrl.signal.aborted && !storyRef.current.coverImage) await paintCover(ctrl.signal).catch(fatal);
    } catch (err) {
      fatal(err);
    } finally {
      if (ctrlRef.current === ctrl) {
        runningRef.current = false;
        setRunning(false);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paintPage]);

  useEffect(() => {
    refsCache.current = null;
    resumes.current = 0;
    run();
    return () => {
      ctrlRef.current?.abort();
      runningRef.current = false;
      if (resumeTimer.current) clearTimeout(resumeTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [story.id]);

  const retryPage = useCallback(
    async (pageNo: number, force = false) => {
      setError(null);
      try {
        await paintPage(pageNo, force);
      } catch (err) {
        setError((err as Error).message);
      }
    },
    [paintPage]
  );

  const retryAll = useCallback(() => {
    if (resumeTimer.current) clearTimeout(resumeTimer.current);
    update((s) => ({ ...s, pages: s.pages.map((p) => ({ ...p, imageError: false })) }));
    setTimeout(run, 0);
  }, [run, update]);
  retryAllRef.current = retryAll;

  const repaintCover = useCallback(async () => {
    setError(null);
    try {
      await paintCover(new AbortController().signal, true);
    } catch (err) {
      setError((err as Error).message);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { error, running, retryPage, retryAll, repaintCover };
}
