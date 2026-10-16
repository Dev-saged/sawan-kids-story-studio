import { useEffect, useRef, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Download,
  FileJson,
  FileText,
  RotateCcw,
  Users,
  Volume2,
  Play,
  Pause,
  Square,
  Sparkles,
  Printer,
  Loader2,
  CheckCircle2,
  Wand2,
} from 'lucide-react';
import { Language, PageImage, StoryData, StoryPage } from '../../types';
import { exportImagesAsZip, exportStoryAsPDF, saveStoryAsJSON, saveStoryLocally } from '../../services/export';
import { generateIllustration, buildPageImagePrompt } from '../../services/gemini';
import PrintableStory from './PrintableStory';

interface Props {
  storyData: StoryData;
  language: Language;
  images?: PageImage[];
  printableContainerId?: string;
  onPagesChange?: (updater: (pages: StoryPage[]) => StoryPage[]) => void;
  onStartOver: () => void;
}

const formatImageSrc = (imgStr?: string): string | null => {
  if (!imgStr) return null;
  if (imgStr.startsWith('data:')) return imgStr;
  if (imgStr.startsWith('PHN2') || imgStr.startsWith('PD94')) {
    return `data:image/svg+xml;base64,${imgStr}`;
  }
  if (imgStr.startsWith('/9j/')) {
    return `data:image/jpeg;base64,${imgStr}`;
  }
  return `data:image/png;base64,${imgStr}`;
};

export default function StoryReader({
  storyData,
  language,
  images = [],
  printableContainerId = 'printable-story-root',
  onPagesChange,
  onStartOver,
}: Props) {
  const ar = language === 'Arabic';
  const [pageIndex, setPageIndex] = useState(0);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [exportProgress, setExportProgress] = useState<string | null>(null);
  const [pdfSuccess, setPdfSuccess] = useState(false);
  const [isPaintingImage, setIsPaintingImage] = useState(false);

  // SpeechSynthesis states
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [speechSupported, setSpeechSupported] = useState(true);

  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  const page = storyData.pages[pageIndex] || storyData.pages[0];
  const imageByPage = new Map(images.map((img) => [img.page, img.base64]));
  const currentImage = page?.generatedImage || imageByPage.get(page?.page);
  const imageSrc = formatImageSrc(currentImage);

  // Save story locally whenever loaded or updated
  useEffect(() => {
    if (storyData?.pages?.length) {
      saveStoryLocally(storyData);
    }
  }, [storyData]);

  // Auto-generate current page illustration if missing
  useEffect(() => {
    if (page && !page.generatedImage && !isPaintingImage) {
      const paint = async () => {
        setIsPaintingImage(true);
        try {
          const prompt = buildPageImagePrompt(storyData, page);
          const base64 = await generateIllustration(prompt, storyData.story_info.aspect_ratio || '4:3');
          if (onPagesChange) {
            onPagesChange((prev) =>
              prev.map((p) => (p.page === page.page ? { ...p, generatedImage: base64 } : p))
            );
          } else {
            page.generatedImage = base64;
          }
        } catch (e) {
          console.warn('Page image painting error:', e);
        } finally {
          setIsPaintingImage(false);
        }
      };
      paint();
    }
  }, [pageIndex, page?.page]);

  // Initialize SpeechSynthesis and voice list
  useEffect(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      setSpeechSupported(false);
      return;
    }

    const updateVoices = () => {
      const available = window.speechSynthesis.getVoices();
      if (available.length > 0) {
        setVoices(available);
      }
    };

    updateVoices();
    if (typeof window.speechSynthesis.onvoiceschanged !== 'undefined') {
      window.speechSynthesis.onvoiceschanged = updateVoices;
    }

    return () => {
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  // Stop speaking whenever page changes
  useEffect(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      setIsPaused(false);
    }
  }, [pageIndex]);

  const handleSpeak = () => {
    if (!speechSupported || typeof window === 'undefined' || !('speechSynthesis' in window)) {
      return;
    }

    if (isSpeaking && isPaused) {
      window.speechSynthesis.resume();
      setIsPaused(false);
      return;
    }

    window.speechSynthesis.cancel();

    const textToRead = page?.text || '';
    if (!textToRead.trim()) return;

    const utterance = new SpeechSynthesisUtterance(textToRead);
    utteranceRef.current = utterance;

    utterance.rate = 0.9;
    utterance.pitch = 1.05;

    if (ar) {
      utterance.lang = 'ar-SA';
      const arabicVoice =
        voices.find((v) => v.lang.startsWith('ar') || v.lang.includes('Arabic')) ||
        voices.find(
          (v) =>
            v.name.toLowerCase().includes('arabic') ||
            v.name.toLowerCase().includes('tarik') ||
            v.name.toLowerCase().includes('maged') ||
            v.name.toLowerCase().includes('laila')
        );
      if (arabicVoice) {
        utterance.voice = arabicVoice;
      }
    } else {
      utterance.lang = 'en-US';
      const englishVoice =
        voices.find(
          (v) =>
            v.lang.startsWith('en') &&
            (v.name.includes('Natural') ||
              v.name.includes('Google') ||
              v.name.includes('Samantha') ||
              v.name.includes('Serena'))
        ) || voices.find((v) => v.lang.startsWith('en'));
      if (englishVoice) {
        utterance.voice = englishVoice;
      }
    }

    utterance.onstart = () => {
      setIsSpeaking(true);
      setIsPaused(false);
    };

    utterance.onend = () => {
      setIsSpeaking(false);
      setIsPaused(false);
    };

    utterance.onerror = () => {
      setIsSpeaking(false);
      setIsPaused(false);
    };

    utterance.onpause = () => {
      setIsPaused(true);
    };

    utterance.onresume = () => {
      setIsPaused(false);
    };

    window.speechSynthesis.speak(utterance);
  };

  const handlePause = () => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window && isSpeaking) {
      window.speechSynthesis.pause();
      setIsPaused(true);
    }
  };

  const handleStop = () => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      setIsPaused(false);
    }
  };

  const handleManualPaint = async () => {
    if (isPaintingImage || !page) return;
    setIsPaintingImage(true);
    try {
      const prompt = buildPageImagePrompt(storyData, page);
      const base64 = await generateIllustration(prompt, storyData.story_info.aspect_ratio || '4:3');
      if (onPagesChange) {
        onPagesChange((prev) =>
          prev.map((p) => (p.page === page.page ? { ...p, generatedImage: base64 } : p))
        );
      } else {
        page.generatedImage = base64;
      }
    } catch (err: any) {
      setActionError(err.message || 'Failed to generate image');
    } finally {
      setIsPaintingImage(false);
    }
  };

  const handleExportPDF = async () => {
    setBusyAction('pdf');
    setActionError(null);
    setPdfSuccess(false);
    setExportProgress(ar ? 'جارٍ تجهيز صفحات القصة للطباعة...' : 'Preparing storybook pages for printing...');

    try {
      await exportStoryAsPDF(storyData, printableContainerId, (status) => {
        setExportProgress(status);
      });
      setPdfSuccess(true);
      setTimeout(() => setPdfSuccess(false), 4000);
    } catch (err) {
      setActionError((err as Error).message);
    } finally {
      setBusyAction(null);
      setExportProgress(null);
    }
  };

  const runAction = async (key: string, fn: () => Promise<void> | void) => {
    setBusyAction(key);
    setActionError(null);
    try {
      await fn();
    } catch (err) {
      setActionError((err as Error).message);
    } finally {
      setBusyAction(null);
    }
  };

  const handlePrint = () => {
    if (typeof window !== 'undefined') {
      window.print();
    }
  };

  // Build full images list for PrintableStory component
  const allImages: PageImage[] = storyData.pages
    .filter((p) => p.generatedImage)
    .map((p) => ({ page: p.page, base64: p.generatedImage! }));
  if (allImages.length === 0 && images.length > 0) {
    allImages.push(...images);
  }

  return (
    <div className="space-y-6">
      {/* Story Card */}
      <div className="page-corner overflow-hidden rounded-3xl border border-dream/20 bg-white/70 shadow-sm dark:bg-white/5">
        {imageSrc ? (
          <div className="relative aspect-[4/3] w-full overflow-hidden bg-dream/10">
            <img
              src={imageSrc}
              alt={page?.image_prompt || 'Story illustration'}
              className="h-full w-full object-cover transition-transform duration-500 hover:scale-105"
            />
            <div className="absolute top-3 inset-inline-end-3 rounded-full bg-black/40 px-3 py-1 text-xs font-medium text-white backdrop-blur-xs flex items-center gap-1">
              <Sparkles size={12} className="text-star" />
              <span>{storyData.story_info.art_style || 'Illustrated'}</span>
            </div>
          </div>
        ) : (
          <div className="relative aspect-[4/3] w-full flex flex-col items-center justify-center gap-3 bg-dream/10 p-6 text-center">
            {isPaintingImage ? (
              <>
                <Loader2 size={32} className="animate-spin text-lantern" />
                <p className="font-display text-sm text-ink/70 dark:text-moonlight/70">
                  {ar ? 'جارٍ رسم الصورة بالذكاء الاصطناعي...' : 'Painting illustration with AI...'}
                </p>
              </>
            ) : (
              <>
                <Wand2 size={28} className="text-dream" />
                <button
                  type="button"
                  onClick={handleManualPaint}
                  className="inline-flex items-center gap-1.5 rounded-full bg-lantern px-4 py-2 text-xs font-bold text-ink shadow-sm transition hover:brightness-105 active:scale-95"
                >
                  <Sparkles size={14} />
                  <span>{ar ? 'رسم صورة هذا المشهد' : 'Paint Illustration'}</span>
                </button>
              </>
            )}
          </div>
        )}

        <div className="p-5" dir={ar ? 'rtl' : 'ltr'}>
          {/* Read Aloud Narration Bar */}
          {speechSupported && (
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-dream/20 bg-dream/5 px-4 py-2.5 dark:bg-white/5">
              <div className="flex items-center gap-2">
                <span className="font-display text-xs font-semibold text-ink/70 dark:text-moonlight/70 flex items-center gap-1.5">
                  <Volume2
                    size={15}
                    className={isSpeaking && !isPaused ? 'text-lantern animate-pulse' : 'text-dream'}
                  />
                  {ar ? 'القراءة الصوتية' : 'Read Aloud'}
                </span>
                {isSpeaking && !isPaused && (
                  <span className="flex items-end gap-0.5 h-3.5 px-1" title="Reading aloud">
                    <span
                      className="w-1 bg-lantern rounded-full animate-bounce h-2"
                      style={{ animationDuration: '600ms' }}
                    />
                    <span
                      className="w-1 bg-lantern rounded-full animate-bounce h-3.5"
                      style={{ animationDuration: '800ms' }}
                    />
                    <span
                      className="w-1 bg-lantern rounded-full animate-bounce h-2.5"
                      style={{ animationDuration: '700ms' }}
                    />
                  </span>
                )}
              </div>

              <div className="flex items-center gap-1.5">
                {!isSpeaking ? (
                  <button
                    type="button"
                    onClick={handleSpeak}
                    className="inline-flex items-center gap-1.5 rounded-full bg-lantern px-3.5 py-1.5 text-xs font-semibold text-ink shadow-xs transition hover:brightness-105 active:scale-95"
                  >
                    <Play size={13} fill="currentColor" />
                    <span>{ar ? 'استمع الآن' : 'Listen'}</span>
                  </button>
                ) : (
                  <>
                    {isPaused ? (
                      <button
                        type="button"
                        onClick={handleSpeak}
                        className="inline-flex items-center gap-1 rounded-full bg-lantern px-3 py-1.5 text-xs font-semibold text-ink shadow-xs transition hover:brightness-105"
                        aria-label={ar ? 'استئناف' : 'Resume'}
                      >
                        <Play size={13} fill="currentColor" />
                        <span>{ar ? 'استئناف' : 'Resume'}</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={handlePause}
                        className="inline-flex items-center gap-1 rounded-full border border-dream/40 bg-white/70 px-3 py-1.5 text-xs font-semibold text-ink transition hover:bg-white dark:bg-white/10 dark:text-moonlight"
                        aria-label={ar ? 'إيقاف مؤقت' : 'Pause'}
                      >
                        <Pause size={13} />
                        <span>{ar ? 'مؤقت' : 'Pause'}</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={handleStop}
                      className="inline-flex items-center gap-1 rounded-full border border-coral/40 bg-coral/10 px-2.5 py-1.5 text-xs font-medium text-coral transition hover:bg-coral/20"
                      aria-label={ar ? 'إيقاف' : 'Stop'}
                    >
                      <Square size={12} fill="currentColor" />
                      <span>{ar ? 'إيقاف' : 'Stop'}</span>
                    </button>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Story Page Text */}
          <p className="text-base sm:text-lg leading-relaxed sm:leading-loose text-ink dark:text-moonlight">
            {page?.text}
          </p>
        </div>
      </div>

      {/* Page Navigation */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => setPageIndex((i) => Math.max(0, i - 1))}
          disabled={pageIndex === 0}
          className="rounded-full border border-dream/30 p-2.5 text-ink transition hover:border-lantern disabled:opacity-30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-lantern dark:text-moonlight"
          aria-label={ar ? 'الصفحة السابقة' : 'Previous page'}
        >
          {ar ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
        </button>
        <span className="font-display text-sm font-medium text-ink/70 dark:text-moonlight/70">
          {page?.page || pageIndex + 1} / {storyData.pages.length}
        </span>
        <button
          type="button"
          onClick={() => setPageIndex((i) => Math.min(storyData.pages.length - 1, i + 1))}
          disabled={pageIndex === storyData.pages.length - 1}
          className="rounded-full border border-dream/30 p-2.5 text-ink transition hover:border-lantern disabled:opacity-30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-lantern dark:text-moonlight"
          aria-label={ar ? 'الصفحة التالية' : 'Next page'}
        >
          {ar ? <ChevronLeft size={20} /> : <ChevronRight size={20} />}
        </button>
      </div>

      {/* Primary Action: Save as PDF Storybook */}
      <div className="rounded-3xl border border-dream/20 bg-gradient-to-br from-white/90 to-dream/10 p-4 shadow-xs dark:from-white/10 dark:to-dusk/60">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-lantern/20 text-lantern">
              <FileText size={22} />
            </div>
            <div>
              <h3 className="font-display text-sm font-semibold text-ink dark:text-moonlight">
                {ar ? 'كتاب القصة الكامل (PDF)' : 'Storybook Edition (PDF)'}
              </h3>
              <p className="text-xs text-ink/60 dark:text-moonlight/60">
                {ar
                  ? 'تنسيق طباعة أنيق يشمل الغلاف وجميع الصفحات والرسومات'
                  : 'Printable layout with cover, illustrations & story pages'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={busyAction !== null}
              onClick={handleExportPDF}
              className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 rounded-2xl bg-lantern px-5 py-2.5 font-display text-sm font-bold text-ink shadow-sm transition hover:brightness-105 active:scale-95 disabled:opacity-50"
            >
              {busyAction === 'pdf' ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  <span>{exportProgress || (ar ? 'جارٍ التحميل...' : 'Saving...')}</span>
                </>
              ) : pdfSuccess ? (
                <>
                  <CheckCircle2 size={16} className="text-emerald-700" />
                  <span>{ar ? 'تم الحفظ!' : 'Saved!'}</span>
                </>
              ) : (
                <>
                  <Download size={16} />
                  <span>{ar ? 'حفظ بصيغة PDF' : 'Save as PDF'}</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handlePrint}
              title={ar ? 'طباعة مباشرة' : 'Print directly'}
              className="inline-flex items-center justify-center rounded-2xl border border-dream/30 bg-white/70 p-2.5 text-ink transition hover:border-lantern dark:bg-white/10 dark:text-moonlight"
            >
              <Printer size={18} />
            </button>
          </div>
        </div>

        {busyAction === 'pdf' && exportProgress && (
          <div className="mt-3 flex items-center gap-2 text-xs text-ink/70 dark:text-moonlight/70 animate-pulse">
            <Loader2 size={12} className="animate-spin text-lantern" />
            <span>{exportProgress}</span>
          </div>
        )}
      </div>

      {/* Character Dossier */}
      <details className="rounded-2xl border border-dream/20 bg-white/50 p-4 dark:bg-white/5">
        <summary className="flex cursor-pointer items-center gap-2 font-display text-sm font-semibold text-ink dark:text-moonlight">
          <Users size={16} aria-hidden />
          {ar ? 'الشخصيات' : 'Characters'}
        </summary>
        <ul className="mt-3 space-y-2">
          {storyData.characters.map((c) => (
            <li key={c.name} className="text-sm text-ink/80 dark:text-moonlight/80">
              <span className="font-semibold text-ink dark:text-moonlight">{c.name}</span> — {c.description}
            </li>
          ))}
        </ul>
      </details>

      {/* Secondary Export Options */}
      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          disabled={busyAction !== null}
          onClick={() => runAction('zip', () => exportImagesAsZip(storyData, allImages))}
          className="flex items-center justify-center gap-2 rounded-2xl border border-dream/30 bg-white/50 py-3 text-xs font-medium text-ink transition hover:border-lantern disabled:opacity-50 dark:bg-white/5 dark:text-moonlight"
        >
          <Download size={16} aria-hidden />
          <span>
            {busyAction === 'zip'
              ? ar
                ? 'جارٍ التجهيز...'
                : 'Preparing...'
              : ar
              ? 'تنزيل الصور (ZIP)'
              : 'Download Images (ZIP)'}
          </span>
        </button>
        <button
          type="button"
          disabled={busyAction !== null}
          onClick={() => runAction('json', () => saveStoryAsJSON(storyData, allImages))}
          className="flex items-center justify-center gap-2 rounded-2xl border border-dream/30 bg-white/50 py-3 text-xs font-medium text-ink transition hover:border-lantern disabled:opacity-50 dark:bg-white/5 dark:text-moonlight"
        >
          <FileJson size={16} aria-hidden />
          <span>
            {busyAction === 'json'
              ? ar
                ? 'جارٍ الحفظ...'
                : 'Saving...'
              : ar
              ? 'نسخة احتياطية (JSON)'
              : 'Save Story (JSON)'}
          </span>
        </button>
      </div>

      {actionError && <p className="text-sm text-coral">{actionError}</p>}

      <button
        type="button"
        onClick={onStartOver}
        className="mx-auto flex items-center gap-2 text-sm font-medium text-ink/60 underline-offset-4 hover:underline dark:text-moonlight/60"
      >
        <RotateCcw size={14} aria-hidden />
        {ar ? 'قصة جديدة' : 'Start a new story'}
      </button>

      {/* Embedded Printable Story element for PDF capture & printing */}
      <PrintableStory storyData={storyData} images={allImages} containerId={printableContainerId} />
    </div>
  );
}
