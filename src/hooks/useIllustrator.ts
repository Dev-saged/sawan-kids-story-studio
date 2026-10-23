import { useCallback, useEffect, useRef, useState } from 'react';
import { ArtStyle, AspectRatio, Character, StoryData, StoryPage } from '../types';
import { getStudioSettings } from '../config';
import { ApiError } from '../services/api';
import { checkIllustration } from '../services/imageQA';
import { buildCoverPrompt, buildPageImagePrompt, buildSheetPrompt, generateIllustration, getArtStylePrompt, SkippedImage } from '../services/gemini';
import { captureAspectFor } from '../shared/modelRules';
import { findSimilarImage, getImage, getNetworkAdaptation, reencode, saveImage, toReference, type ImageKind } from '../services/media';
import { hashText } from '../services/db';

type Updater = (fn: (s: StoryData) => StoryData) => void;
type Ref = { data: string; mimeType: string };

const CONCURRENCY = 1;
// أخطاء لا فائدة من تكرار الطلب معها
const FATAL = new Set(['AUTH', 'NOKEY', 'BILLING', 'NOMODEL', 'OFFLINE', 'FREE_AUTH', 'FREE_QUOTA']);
// حصة مؤقتة: نتوقف ثم نكمل تلقائياً (النص والصوت يعملان بحصص نماذج أخرى)
const RESUME_AFTER_MS = 15_000;
const MAX_AUTO_RESUMES = 5;

export const SHEET_FAILED_WARNING_AR =
  'تنبيه: تعذّر رسم ورقة الشخصيات المرجعية بعد محاولتين؛ لذلك فإن ثبات ملامح الشخصيات بين صفحات هذه القصة غير مضمون.';

// دالة نقية لبوابة المعاينة (ب4) قابلة للاختبار في #test
export const shouldPauseAtPreviewGate = (
  enabled: boolean,
  approved: boolean,
  coverDone: boolean,
  page1Done: boolean,
  totalPages: number,
  remainingUndrawnPages: number
): boolean => {
  if (!enabled || approved) return false;
  if (totalPages <= 1 || remainingUndrawnPages <= 0) return false;
  return coverDone && page1Done;
};

// خط إنتاج الصور: ورقة الشخصيات ← الغلاف والصفحة 1 (مع بوابة معاينة اختيارية) ← باقي الصفحات
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
  const rerunRef = useRef(false);
  const previewApprovedRef = useRef<boolean>(
    story.pages.filter((p) => p.page > 1 && Boolean(p.generatedImage)).length > 0
  );

  const [error, setError] = useState<string | null>(null);
  const [sheetWarning, setSheetWarning] = useState<string | null>(null);
  const [awaitingPreviewApproval, setAwaitingPreviewApproval] = useState(false);
  const [running, setRunning] = useState(false);

  // مفتاح الإعادة: نفس الأسلوب + نفس ثبات الأسلوب + نفس الشخصيات + نفس صورة البطل + الفئة العمرية
  const cacheStyle = (s: StoryData) =>
    `${s.story_info.art_style}|${s.styleConsistency ?? s.story_info.styleConsistency ?? ''}|${s.story_info.age_group ?? ''}|${captureAspectFor(s.story_info.aspect_ratio)}|${s.heroPhotoId ?? ''}|${hashText(s.characters.map((c) => c.description).join('|'))}`;

  const usedIds = (s: StoryData) => new Set([s.coverImageId, s.characterSheetId, ...s.pages.map((p) => p.imageId)].filter(Boolean) as string[]);

  // التشابه يُقاس على وصف المشهد وحده، ولا تتكرر صورة داخل نفس القصة
  const create = async (s: StoryData, kind: ImageKind, prompt: string, matchText: string, refs: Ref[], reuse: boolean, signal: AbortSignal, quality: 'hq' | 'std' = kind === 'page' ? 'std' : 'hq', pageText = '') => {
    if (reuse) {
      const hit = await findSimilarImage(matchText, cacheStyle(s), kind, kind === 'sheet' ? 0.92 : 0.88, usedIds(s));
      if (hit && !hit.url.includes('image/svg')) return hit;
    }
    const net = getNetworkAdaptation();
    const draw = async (text: string): Promise<Blob> => {
      const raw = await generateIllustration(
        {
          prompt: text,
          aspectRatio: kind === 'sheet' ? '16:9' : kind === 'page' ? (captureAspectFor(s.story_info.aspect_ratio) as AspectRatio) : s.story_info.aspect_ratio || '4:3',
          references: refs,
          kind,
          artStyle: s.story_info.art_style,
          quality,
        },
        signal
      );
      if (raw.type.includes('svg')) {
        throw new Error('SVG format is prohibited for story illustrations.');
      }
      return reencode(raw, net.maxImageSide, 'image/webp', net.compressionQuality);
    };

    let blob = await draw(prompt);
    // فحص بالرؤية لكل صورة (غلاف، ورقة، كل الصفحات)، ومحاولة تصحيح واحدة؛ فشل الفحص نفسه يُعد سليمة
    if (kind !== 'photo') {
      const style = getArtStylePrompt(s.story_info.art_style, s.story_info.age_group, s.styleConsistency || s.story_info.styleConsistency);
      const verdict = await checkIllustration(blob, matchText, signal, { text: pageText, style, sheet: kind === 'sheet' });
      if (!verdict.ok && verdict.fix) {
        const [first, ...rest] = prompt.split('\n');
        try {
          blob = await draw([`${first} Correction: ${verdict.fix.replace(/\.+$/, '')}.`, ...rest].join('\n'));
        } catch (err) {
          if ((err as Error)?.name === 'AbortError') throw err;
        }
      }
    }
    return saveImage(blob, kind, cacheStyle(s), matchText);
  };

  // أ5: محاولة أولى لورقة الشخصيات، فإن فشلت نعيد مرة واحدة بوصف مبسّط، فإن تم تخطيها (محرك مجاني لا يدعم المراجع) نكمل مباشرة بدون تلويث المراجع
  const references = async (signal: AbortSignal): Promise<Ref[]> => {
    if (refsCache.current) return refsCache.current;
    const s = storyRef.current;
    const photo = await getImage(s.heroPhotoId);
    let sheet = await getImage(s.characterSheetId);

    if (!sheet) {
      const photoRef = photo ? [await toReference(photo.blob)] : [];
      const matchText = s.characters.map((c) => c.description).join(' ');
      for (let attempt = 0; attempt < 2; attempt++) {
        if (signal.aborted) break;
        const simplified = attempt === 1;
        try {
          const made = await create(
            s,
            'sheet',
            buildSheetPrompt(s, Boolean(photo), simplified),
            matchText,
            photoRef,
            !simplified,
            signal
          );
          update((prev) => ({ ...prev, characterSheetId: made.id }));
          sheet = await getImage(made.id);
          if (sheet) {
            setSheetWarning(null);
            break;
          }
        } catch (err) {
          if ((err as Error)?.name === 'AbortError') throw err;
          if (err instanceof SkippedImage) {
            // المحرك البديل لا يحتاج ورقة شخصيات مرجعية بل يعتمد على الوصف البصري الدقيق
            break;
          }
          if (err instanceof ApiError && FATAL.has(err.code)) throw err;
          if (attempt === 1) {
            setSheetWarning(SHEET_FAILED_WARNING_AR);
          }
        }
      }
    }

    const refs: Ref[] = [];
    if (photo && ! photo.blob.type.includes('svg')) {
      refs.push(await toReference(photo.blob));
    }
    if (sheet && !sheet.blob.type.includes('svg')) {
      refs.push(await toReference(sheet.blob));
    }

    refsCache.current = refs.slice(0, 2);
    return refsCache.current;
  };

  const setPage = (pageNo: number, patch: Partial<StoryPage>) =>
    update((s) => ({ ...s, pages: s.pages.map((p) => (p.page === pageNo ? { ...p, ...patch } : p)) }));

  const paintPage = useCallback(
    async (pageNo: number, force = false, signal: AbortSignal = new AbortController().signal, promptOverride?: string, correctionNote?: string) => {
      if (inFlight.current.has(pageNo)) return;
      const found = storyRef.current.pages.find((p) => p.page === pageNo);
      if (!found) return;
      const page: StoryPage = {
        ...found,
        ...(promptOverride ? { image_prompt: promptOverride } : {}),
        ...(correctionNote !== undefined ? { correctionNote } : {}),
      };
      inFlight.current.add(pageNo);
      setPage(pageNo, {
        isGeneratingImage: true,
        imageError: false,
        ...(promptOverride ? { image_prompt: promptOverride } : {}),
        ...(correctionNote !== undefined ? { correctionNote } : {}),
      });
      try {
        const refs = await references(signal);
        const img = await create(storyRef.current, 'page', buildPageImagePrompt(storyRef.current, page), page.image_prompt, refs, !force, signal, pageNo === 1 ? 'hq' : 'std', page.text);
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

  const nextPage = (onlyFirstPage = false): number | null => {
    const pages = storyRef.current.pages;
    const focus = focusRef.current;
    const pending = pages
      .filter((p) => (!onlyFirstPage ? true : p.page === 1))
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

      const settings = getStudioSettings();
      const gateEnabled = settings.previewFirstGate;
      const otherPagesAlreadyDrawn = storyRef.current.pages.some((p) => p.page > 1 && Boolean(p.generatedImage));
      if (otherPagesAlreadyDrawn) {
        previewApprovedRef.current = true;
      }

      // ب4: نرسم الغلاف والصفحة 1 أولاً
      if (!ctrl.signal.aborted && !storyRef.current.coverImage) {
        await paintCover(ctrl.signal).catch(fatal);
      }
      const p1 = storyRef.current.pages.find((p) => p.page === 1);
      if (!ctrl.signal.aborted && p1 && !p1.generatedImage && !p1.imageError) {
        await paintPage(1, false, ctrl.signal).catch(fatal);
      }

      const coverDone = Boolean(storyRef.current.coverImage);
      const page1Done = Boolean(storyRef.current.pages.find((p) => p.page === 1)?.generatedImage);
      const remainingUndrawn = storyRef.current.pages.filter((p) => p.page > 1 && !p.generatedImage).length;

      if (
        !ctrl.signal.aborted &&
        shouldPauseAtPreviewGate(
          gateEnabled,
          previewApprovedRef.current,
          coverDone,
          page1Done,
          storyRef.current.pages.length,
          remainingUndrawn
        )
      ) {
        setAwaitingPreviewApproval(true);
        return;
      }

      setAwaitingPreviewApproval(false);

      const worker = async () => {
        for (let next = nextPage(false); next !== null && !ctrl.signal.aborted; next = nextPage(false)) {
          try {
            await paintPage(next, false, ctrl.signal);
            if (!ctrl.signal.aborted) await new Promise((r) => setTimeout(r, 1800));
          } catch (err) {
            if (fatal(err)) return;
          }
        }
      };
      await Promise.all(Array.from({ length: CONCURRENCY }, worker));
    } catch (err) {
      fatal(err);
    } finally {
      if (ctrlRef.current === ctrl) {
        runningRef.current = false;
        setRunning(false);
        if (rerunRef.current && !ctrl.signal.aborted && !awaitingPreviewApproval) {
          rerunRef.current = false;
          setTimeout(run, 0);
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paintPage]);

  useEffect(() => {
    refsCache.current = null;
    resumes.current = 0;
    setSheetWarning(null);
    previewApprovedRef.current = story.pages.some((p) => p.page > 1 && Boolean(p.generatedImage));
    setAwaitingPreviewApproval(false);
    run();
    return () => {
      ctrlRef.current?.abort();
      runningRef.current = false;
      if (resumeTimer.current) clearTimeout(resumeTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [story.id]);

  // صفحات جديدة من قصة طويلة: نعيد تشغيل خط الرسم لتشملها دون لمس ما رُسم
  const pageTotal = story.pages.length;
  const seenTotal = useRef(pageTotal);
  useEffect(() => {
    if (pageTotal > seenTotal.current) {
      seenTotal.current = pageTotal;
      if (!awaitingPreviewApproval) {
        if (runningRef.current) rerunRef.current = true;
        else setTimeout(run, 0);
      }
    }
    seenTotal.current = pageTotal;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageTotal, awaitingPreviewApproval]);

  const retryPage = useCallback(
    async (pageNo: number, force = false, prompt?: string, correctionNote?: string) => {
      setError(null);
      try {
        await paintPage(pageNo, force, undefined, prompt, correctionNote);
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

  // ب4: زر «أكمل» بعد معاينة الغلاف والصفحة 1
  const approvePreviewContinue = useCallback(() => {
    previewApprovedRef.current = true;
    setAwaitingPreviewApproval(false);
    setTimeout(run, 0);
  }, [run]);

  // ب4: زر «غيّر الأسلوب أو الشخصيات» لإعادة معاينة الغلاف والصفحة 1 بأسلوب أو شخصيات معدّلة
  const resetPreviewAndRepaint = useCallback(
    (newStyle?: ArtStyle, updatedCharacters?: Character[]) => {
      ctrlRef.current?.abort();
      runningRef.current = false;
      refsCache.current = null;
      previewApprovedRef.current = false;
      setAwaitingPreviewApproval(false);
      setSheetWarning(null);
      update((s) => ({
        ...s,
        characterSheetId: `seed-${Date.now()}-${Math.floor(Math.random() * 89999 + 10000)}`,
        coverImage: undefined,
        coverImageId: undefined,
        characters: updatedCharacters ?? s.characters,
        story_info: {
          ...s.story_info,
          art_style: newStyle ?? s.story_info.art_style,
        },
        pages: s.pages.map((p) =>
          p.page === 1 ? { ...p, generatedImage: undefined, imageId: undefined, imageError: false, isGeneratingImage: false } : p
        ),
      }));
      setTimeout(run, 80);
    },
    [run, update]
  );

  return {
    error,
    sheetWarning,
    awaitingPreviewApproval,
    approvePreviewContinue,
    resetPreviewAndRepaint,
    running,
    retryPage,
    retryAll,
    repaintCover,
  };
}
