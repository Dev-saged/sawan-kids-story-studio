import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Clapperboard,
  Download,
  FileJson,
  FileText,
  Facebook,
  ImagePlus,
  Loader2,
  MessageCircle,
  Package,
  RefreshCw,
  RotateCcw,
  Save,
  Shuffle,
  Users,
} from 'lucide-react';
import { IMAGE_BATCH_SIZE } from '../../constants';
import { Language, BookSize, StoryData, StoryPage } from '../../types';
import { buildPageImagePrompt, generateIllustration, regeneratePrompt } from '../../services/gemini';
import {
  allImagesReady,
  exportFullPackage,
  exportImagesAsZip,
  exportStoryAsPDF,
  saveStoryAsJSON,
  saveStoryLocally,
} from '../../services/export';

interface Props {
  storyData: StoryData;
  language: Language;
  onPagesChange: (updater: (pages: StoryPage[]) => StoryPage[]) => void;
  onStartOver: () => void;
}

const ANIMATION_PROMPT = `Animate the image with smooth cinematic motion.

Rules:
- NO music.
- NO dialogue or spoken words.
- Characters must NOT speak or lip-sync.

Allowed audio:
- Natural sound effects only.
- Light laughter is allowed.
- Soft crying or emotional breathing is allowed.
- Ambient environment sounds.

Animation:
- Subtle realistic body movement.
- Natural breathing.
- Gentle head and eye motion.
- Emotional expressions without speech.

Camera:
- Smooth cinematic movement.

Result:
- Silent characters.
- Emotional animation.`;

const ratioParts = (ratio: string): [number, number] => {
  const [w, h] = ratio.split(':').map(Number);
  return [w || 4, h || 3];
};

const actionBtn =
  'flex flex-col items-center gap-1 rounded-2xl border border-dream/30 px-2 py-3 text-xs font-medium text-ink transition enabled:hover:border-lantern disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-lantern dark:text-moonlight';
const smallBtn =
  'inline-flex items-center gap-1.5 rounded-full border border-dream/30 px-3 py-1.5 text-xs font-medium text-ink transition enabled:hover:border-lantern disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-lantern dark:text-moonlight';

export default function StoryReader({ storyData, language, onPagesChange, onStartOver }: Props) {
  const ar = language === 'Arabic';
  const [pageIndex, setPageIndex] = useState(0);
  const [bookSize, setBookSize] = useState<BookSize>('A4');
  const [busy, setBusy] = useState<string | null>(null);
  const [status, setStatus] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [bulk, setBulk] = useState<{ done: number; total: number } | null>(null);

  const page = storyData.pages[pageIndex];
  const ready = allImagesReady(storyData);
  const imageCount = storyData.pages.filter((p) => p.generatedImage).length;
  const [ratioW, ratioH] = ratioParts(storyData.story_info.aspect_ratio);

  // Refs keep the async image jobs reading the latest story (edited prompts) without re-creating them.
  const storyRef = useRef(storyData);
  storyRef.current = storyData;
  const alive = useRef(true);
  const jobs = useRef(new Map<number, Promise<void>>());

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const patchPage = useCallback(
    (pageNumber: number, patch: Partial<StoryPage>) => {
      if (!alive.current) return;
      onPagesChange((pages) => pages.map((p) => (p.page === pageNumber ? { ...p, ...patch } : p)));
    },
    [onPagesChange]
  );

  // One image job per page at a time; a second request for the same page joins the running one.
  const generatePage = useCallback(
    (pageNumber: number): Promise<void> => {
      const running = jobs.current.get(pageNumber);
      if (running) return running;

      const job = (async () => {
        patchPage(pageNumber, { isGeneratingImage: true, imageError: false });
        try {
          const story = storyRef.current;
          const target = story.pages.find((p) => p.page === pageNumber);
          if (!target) return;
          const image = await generateIllustration(buildPageImagePrompt(story, target), story.story_info.aspect_ratio);
          patchPage(pageNumber, { generatedImage: image, isGeneratingImage: false, imageError: false });
        } catch (err) {
          patchPage(pageNumber, { isGeneratingImage: false, imageError: true });
          if (alive.current) setError((err as Error).message);
        } finally {
          jobs.current.delete(pageNumber);
        }
      })();

      jobs.current.set(pageNumber, job);
      return job;
    },
    [patchPage]
  );

  // Illustrate a page the first time the reader lands on it. Failed pages wait for an explicit retry.
  useEffect(() => {
    if (page && !page.generatedImage && !page.isGeneratingImage && !page.imageError) void generatePage(page.page);
  }, [page, generatePage]);

  const generateAll = async () => {
    const queue = storyRef.current.pages.filter((p) => !p.generatedImage).map((p) => p.page);
    if (queue.length === 0) return;
    setError(null);
    setBulk({ done: 0, total: queue.length });
    let done = 0;
    const worker = async () => {
      while (queue.length > 0 && alive.current) {
        await generatePage(queue.shift()!);
        done += 1;
        if (alive.current) setBulk({ done, total: done + queue.length });
      }
    };
    await Promise.all(Array.from({ length: IMAGE_BATCH_SIZE }, worker));
    if (alive.current) setBulk(null);
  };

  const run = async (key: string, fn: () => Promise<void> | void) => {
    setBusy(key);
    setError(null);
    setStatus('');
    try {
      await fn();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(null);
      setStatus((s) => (key === 'pdf' || key === 'package' ? '' : s));
    }
  };

  const copyAnimationPrompt = async () => {
    try {
      await navigator.clipboard.writeText(ANIMATION_PROMPT);
      setStatus(ar ? 'تم نسخ برومبت التحريك' : 'Animation prompt copied');
    } catch {
      setError(ar ? 'تعذّر النسخ تلقائيًا في هذا المتصفح.' : 'Could not copy automatically in this browser.');
    }
  };

  const shareWhatsApp = () => {
    const text = encodeURIComponent(`${storyData.story_info.title}\n\n${page.text}`);
    window.open(`https://wa.me/?text=${text}`, '_blank', 'noopener,noreferrer');
  };

  const canShareLink = window.location.protocol.startsWith('http');
  const shareFacebook = () => {
    const url = encodeURIComponent(window.location.origin + window.location.pathname);
    window.open(`https://www.facebook.com/sharer/sharer.php?u=${url}`, '_blank', 'noopener,noreferrer');
  };

  const saveLocal = () =>
    run('save', () => {
      const where = saveStoryLocally(storyData);
      setStatus(
        where === 'local'
          ? ar ? 'تم حفظ القصة في المتصفح' : 'Story saved in this browser'
          : ar ? 'المساحة ممتلئة — تم تنزيل القصة كملف JSON' : 'Browser storage is full — downloaded as a JSON file instead'
      );
    });

  const rewriteAngle = () =>
    run('angle', async () => {
      const next = await regeneratePrompt(page.image_prompt);
      patchPage(page.page, { image_prompt: next });
    });

  if (!page) return null;

  return (
    <div className="space-y-6">
      <div className="page-corner overflow-hidden rounded-3xl border border-dream/20 bg-white/70 shadow-sm dark:bg-white/5">
        <div
          className="relative mx-auto flex w-full items-center justify-center bg-dream/10"
          style={{ aspectRatio: `${ratioW} / ${ratioH}`, maxWidth: `calc(65vh * ${ratioW / ratioH})` }}
        >
          {page.generatedImage && (
            <img src={`data:image/png;base64,${page.generatedImage}`} alt={page.image_prompt} className="h-full w-full object-cover" />
          )}

          {page.isGeneratingImage && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-moonlight/70 text-sm font-medium text-ink backdrop-blur-sm dark:bg-dusk/70 dark:text-moonlight" role="status">
              <Loader2 size={28} className="animate-spin text-lantern" aria-hidden />
              {ar ? 'يتم رسم الصورة...' : 'Painting the picture...'}
            </div>
          )}

          {page.imageError && !page.isGeneratingImage && !page.generatedImage && (
            <div className="flex flex-col items-center gap-3 p-6 text-center">
              <AlertTriangle size={28} className="text-coral" aria-hidden />
              <p className="text-sm text-ink dark:text-moonlight">{ar ? 'تعذّر رسم هذه الصورة.' : 'This picture could not be painted.'}</p>
              <button type="button" onClick={() => void generatePage(page.page)} className={smallBtn}>
                <RefreshCw size={14} aria-hidden />
                {ar ? 'حاول مرة أخرى' : 'Try again'}
              </button>
            </div>
          )}

          {page.generatedImage && !page.isGeneratingImage && (
            <a
              href={`data:image/png;base64,${page.generatedImage}`}
              download={`story_page_${page.page}.png`}
              className="absolute end-3 top-3 rounded-full bg-ink/60 p-2 text-white transition hover:bg-ink/80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-lantern"
              aria-label={ar ? 'تنزيل الصورة' : 'Download image'}
            >
              <Download size={18} aria-hidden />
            </a>
          )}
        </div>
        <div className="p-5" dir={ar ? 'rtl' : 'ltr'}>
          <p className="text-base leading-relaxed text-ink dark:text-moonlight">{page.text}</p>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => setPageIndex((i) => Math.max(0, i - 1))}
          disabled={pageIndex === 0}
          className="rounded-full border border-dream/30 p-2.5 text-ink transition disabled:opacity-30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-lantern dark:text-moonlight"
          aria-label={ar ? 'الصفحة السابقة' : 'Previous page'}
        >
          {ar ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
        </button>
        <span className="font-display text-sm text-ink/70 dark:text-moonlight/70">
          {page.page} / {storyData.pages.length}
        </span>
        <button
          type="button"
          onClick={() => setPageIndex((i) => Math.min(storyData.pages.length - 1, i + 1))}
          disabled={pageIndex === storyData.pages.length - 1}
          className="rounded-full border border-dream/30 p-2.5 text-ink transition disabled:opacity-30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-lantern dark:text-moonlight"
          aria-label={ar ? 'الصفحة التالية' : 'Next page'}
        >
          {ar ? <ChevronLeft size={20} /> : <ChevronRight size={20} />}
        </button>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-dream/20 bg-white/50 p-3 dark:bg-white/5">
        <p className="text-xs font-medium text-ink/70 dark:text-moonlight/70">
          {ar ? `الصور: ${imageCount} من ${storyData.pages.length}` : `Illustrated: ${imageCount} of ${storyData.pages.length}`}
        </p>
        {!ready && (
          <button type="button" onClick={() => void generateAll()} disabled={bulk !== null} className={smallBtn}>
            {bulk ? <Loader2 size={14} className="animate-spin" aria-hidden /> : <ImagePlus size={14} aria-hidden />}
            {bulk
              ? ar ? `يتم الرسم ${bulk.done}/${bulk.total}` : `Painting ${bulk.done}/${bulk.total}`
              : ar ? 'ارسم كل الصور' : 'Paint all pictures'}
          </button>
        )}
      </div>

      <details className="rounded-2xl border border-dream/20 bg-white/50 p-4 dark:bg-white/5">
        <summary className="flex cursor-pointer items-center gap-2 font-display text-sm font-semibold text-ink dark:text-moonlight">
          <ImagePlus size={16} aria-hidden />
          {ar ? 'وصف الصورة (قابل للتعديل)' : 'Image prompt (editable)'}
        </summary>
        <div className="mt-3 space-y-3">
          <textarea
            dir="ltr"
            rows={4}
            value={page.image_prompt}
            onChange={(e) => patchPage(page.page, { image_prompt: e.target.value.slice(0, 2000) })}
            className="w-full resize-none rounded-2xl border border-dream/30 bg-white/70 px-3 py-2.5 text-sm text-ink outline-none transition focus-visible:border-lantern focus-visible:ring-2 focus-visible:ring-lantern/40 dark:bg-white/10 dark:text-moonlight"
          />
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => void rewriteAngle()} disabled={busy !== null || page.isGeneratingImage} className={smallBtn}>
              {busy === 'angle' ? <Loader2 size={14} className="animate-spin" aria-hidden /> : <Shuffle size={14} aria-hidden />}
              {ar ? 'زاوية جديدة' : 'New angle'}
            </button>
            <button type="button" onClick={() => void generatePage(page.page)} disabled={page.isGeneratingImage} className={smallBtn}>
              <RefreshCw size={14} aria-hidden />
              {ar ? 'أعد رسم الصورة' : 'Repaint image'}
            </button>
          </div>
        </div>
      </details>

      <details className="rounded-2xl border border-dream/20 bg-white/50 p-4 dark:bg-white/5">
        <summary className="flex cursor-pointer items-center gap-2 font-display text-sm font-semibold text-ink dark:text-moonlight">
          <Users size={16} aria-hidden />
          {ar ? 'الشخصيات' : 'Characters'}
        </summary>
        <ul className="mt-3 space-y-2">
          {storyData.characters.map((c) => (
            <li key={c.name} className="text-sm text-ink/80 dark:text-moonlight/80">
              <span className="font-semibold">{c.name}</span> — {c.description}
            </li>
          ))}
        </ul>
      </details>

      {storyData.story_info.lessons.length > 0 && (
        <details className="rounded-2xl border border-dream/20 bg-white/50 p-4 dark:bg-white/5">
          <summary className="flex cursor-pointer items-center gap-2 font-display text-sm font-semibold text-ink dark:text-moonlight">
            <BookOpen size={16} aria-hidden />
            {ar ? 'ماذا تعلمنا؟' : 'What did we learn?'}
          </summary>
          <ul className="mt-3 list-disc space-y-1 ps-5">
            {storyData.story_info.lessons.map((l) => (
              <li key={l} className="text-sm text-ink/80 dark:text-moonlight/80">
                {l}
              </li>
            ))}
          </ul>
        </details>
      )}

      <section className="space-y-3" aria-label={ar ? 'التصدير' : 'Export'}>
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs font-semibold text-ink/70 dark:text-moonlight/70">{ar ? 'حجم الكتاب' : 'Book size'}</span>
          <div className="inline-flex rounded-full border border-dream/30 p-0.5" role="group">
            {(['A4', 'Square'] as const).map((size) => (
              <button
                key={size}
                type="button"
                aria-pressed={bookSize === size}
                onClick={() => setBookSize(size)}
                className={`rounded-full px-3 py-1 text-xs font-semibold transition ${bookSize === size ? 'bg-lantern text-ink' : 'text-ink/70 dark:text-moonlight/70'}`}
              >
                {size === 'A4' ? 'A4' : ar ? 'مربع' : 'Square'}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <button type="button" disabled={busy !== null || !ready} onClick={() => run('pdf', () => exportStoryAsPDF(storyData, bookSize, setStatus))} className={actionBtn}>
            {busy === 'pdf' ? <Loader2 size={18} className="animate-spin" aria-hidden /> : <FileText size={18} aria-hidden />}
            PDF
          </button>
          <button type="button" disabled={busy !== null || imageCount === 0} onClick={() => run('zip', () => exportImagesAsZip(storyData))} className={actionBtn}>
            {busy === 'zip' ? <Loader2 size={18} className="animate-spin" aria-hidden /> : <Download size={18} aria-hidden />}
            {ar ? 'الصور' : 'Images'}
          </button>
          <button type="button" disabled={busy !== null || !ready} onClick={() => run('package', () => exportFullPackage(storyData, bookSize, setStatus))} className={actionBtn}>
            {busy === 'package' ? <Loader2 size={18} className="animate-spin" aria-hidden /> : <Package size={18} aria-hidden />}
            {ar ? 'حزمة كاملة' : 'Full package'}
          </button>
          <button type="button" disabled={busy !== null} onClick={saveLocal} className={actionBtn}>
            <Save size={18} aria-hidden />
            {ar ? 'حفظ' : 'Save'}
          </button>
          <button type="button" disabled={busy !== null} onClick={() => run('json', () => saveStoryAsJSON(storyData))} className={actionBtn}>
            <FileJson size={18} aria-hidden />
            JSON
          </button>
          <button type="button" onClick={() => void copyAnimationPrompt()} className={actionBtn}>
            <Clapperboard size={18} aria-hidden />
            {ar ? 'برومبت التحريك' : 'Animation prompt'}
          </button>
        </div>

        {!ready && (
          <p className="text-xs text-ink/60 dark:text-moonlight/60">
            {ar ? 'PDF والحزمة الكاملة يتفعّلان بعد اكتمال رسم كل الصور.' : 'PDF and the full package unlock once every picture is painted.'}
          </p>
        )}

        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={shareWhatsApp} className={smallBtn}>
            <MessageCircle size={14} aria-hidden />
            {ar ? 'واتساب' : 'WhatsApp'}
          </button>
          {canShareLink && (
            <button type="button" onClick={shareFacebook} className={smallBtn}>
              <Facebook size={14} aria-hidden />
              {ar ? 'فيسبوك' : 'Facebook'}
            </button>
          )}
        </div>
      </section>

      <p role="status" className="min-h-[1.25rem] text-sm text-ink/70 dark:text-moonlight/70">
        {status}
      </p>
      {error && <p className="text-sm text-coral">{error}</p>}

      <button
        type="button"
        onClick={onStartOver}
        className="mx-auto flex items-center gap-2 text-sm font-medium text-ink/60 underline-offset-4 hover:underline dark:text-moonlight/60"
      >
        <RotateCcw size={14} aria-hidden />
        {ar ? 'قصة جديدة' : 'Start a new story'}
      </button>
    </div>
  );
}
