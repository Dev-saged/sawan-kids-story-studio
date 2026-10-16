import { useState } from 'react';
import { ChevronLeft, ChevronRight, Download, FileJson, FileText, RotateCcw, Users } from 'lucide-react';
import { Language, PageImage, StoryData } from '../../types';
import { exportImagesAsZip, exportStoryAsPDF, saveStoryAsJSON } from '../../services/export';

interface Props {
  storyData: StoryData;
  images: PageImage[];
  language: Language;
  printableContainerId: string;
  onStartOver: () => void;
}

export default function StoryReader({ storyData, images, language, printableContainerId, onStartOver }: Props) {
  const ar = language === 'Arabic';
  const [pageIndex, setPageIndex] = useState(0);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const page = storyData.pages[pageIndex];
  const imageByPage = new Map(images.map((img) => [img.page, img.base64]));
  const currentImage = imageByPage.get(page.page);

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

  return (
    <div className="space-y-6">
      <div className="page-corner overflow-hidden rounded-3xl border border-dream/20 bg-white/70 shadow-sm dark:bg-white/5">
        {currentImage && (
          <img src={`data:image/png;base64,${currentImage}`} alt="" className="aspect-[4/3] w-full object-cover" />
        )}
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

      <div className="grid grid-cols-3 gap-3">
        <button
          type="button"
          disabled={busyAction !== null}
          onClick={() => runAction('pdf', () => exportStoryAsPDF(storyData, printableContainerId))}
          className="flex flex-col items-center gap-1 rounded-2xl border border-dream/30 py-3 text-xs font-medium text-ink transition hover:border-lantern disabled:opacity-50 dark:text-moonlight"
        >
          <FileText size={18} aria-hidden />
          {busyAction === 'pdf' ? (ar ? 'جارٍ...' : '...') : 'PDF'}
        </button>
        <button
          type="button"
          disabled={busyAction !== null}
          onClick={() => runAction('zip', () => exportImagesAsZip(storyData, images))}
          className="flex flex-col items-center gap-1 rounded-2xl border border-dream/30 py-3 text-xs font-medium text-ink transition hover:border-lantern disabled:opacity-50 dark:text-moonlight"
        >
          <Download size={18} aria-hidden />
          {busyAction === 'zip' ? (ar ? 'جارٍ...' : '...') : 'ZIP'}
        </button>
        <button
          type="button"
          disabled={busyAction !== null}
          onClick={() => runAction('json', () => saveStoryAsJSON(storyData, images))}
          className="flex flex-col items-center gap-1 rounded-2xl border border-dream/30 py-3 text-xs font-medium text-ink transition hover:border-lantern disabled:opacity-50 dark:text-moonlight"
        >
          <FileJson size={18} aria-hidden />
          {busyAction === 'json' ? (ar ? 'جارٍ...' : '...') : 'JSON'}
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
    </div>
  );
}
