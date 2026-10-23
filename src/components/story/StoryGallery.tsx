import { useEffect, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Download,
  Maximize2,
  Sparkles,
  X,
  BookOpen,
  Loader2,
  Wand2,
  Clapperboard,
  Check,
  ZoomIn,
  Palette,
} from 'lucide-react';
import { Language, StoryData, StoryPage } from '../../types';
import { srcToBlob, toSrc } from '../../services/media';
import { saveAs } from 'file-saver';
import { animationPrompt } from '../../services/animation';
import { analyzeTextSentimentAndPalette } from '../../services/gemini';
import { ImageMagnifierModal } from './ImageMagnifierModal';

interface Props {
  storyData: StoryData;
  language: Language;
  onSelectPage?: (pageIndex: number) => void;
  onPagesChange?: (updater: (pages: StoryPage[]) => StoryPage[]) => void;
  onPaint: (pageNo: number, force?: boolean) => Promise<void>;
}

export default function StoryGallery({ storyData, language, onSelectPage, onPaint }: Props) {
  const ar = language === 'Arabic';
  const [fullscreenIndex, setFullscreenIndex] = useState<number | null>(null);
  const [copiedPage, setCopiedPage] = useState<number | null>(null);
  const [magnifierPage, setMagnifierPage] = useState<StoryPage | null>(null);

  const copyAnimation = async (page: StoryPage, idx: number, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(animationPrompt(storyData, page, idx));
      setCopiedPage(page.page);
      setTimeout(() => setCopiedPage(null), 2000);
    } catch {
      setCopiedPage(null);
    }
  };

  const pagesWithImages = storyData.pages.filter((p) => Boolean(p.generatedImage));
  const totalPages = storyData.pages.length;

  // Keyboard navigation for full screen lightbox
  useEffect(() => {
    if (fullscreenIndex === null) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setFullscreenIndex(null);
      } else if (e.key === 'ArrowRight') {
        if (ar) {
          setFullscreenIndex((prev) => (prev !== null && prev > 0 ? prev - 1 : prev));
        } else {
          setFullscreenIndex((prev) =>
            prev !== null && prev < storyData.pages.length - 1 ? prev + 1 : prev
          );
        }
      } else if (e.key === 'ArrowLeft') {
        if (ar) {
          setFullscreenIndex((prev) =>
            prev !== null && prev < storyData.pages.length - 1 ? prev + 1 : prev
          );
        } else {
          setFullscreenIndex((prev) => (prev !== null && prev > 0 ? prev - 1 : prev));
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [fullscreenIndex, ar, storyData.pages.length]);

  const handlePaintImage = (page: StoryPage, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!page.isGeneratingImage) onPaint(page.page, Boolean(page.generatedImage));
  };

  const handleDownloadSingleImage = async (page: StoryPage, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!page.generatedImage) return;
    const blob = await srcToBlob(page.generatedImage);
    const ext = blob.type.includes('webp') ? 'webp' : blob.type.includes('jpeg') ? 'jpg' : 'png';
    const safeTitle = (storyData.story_info.title || 'story').replace(/[\\/:*?"<>|]+/g, '-');
    saveAs(blob, `${safeTitle}-page-${page.page}.${ext}`);
  };

  const activeFullscreenPage =
    fullscreenIndex !== null ? storyData.pages[fullscreenIndex] : null;
  const activeFullscreenImageSrc = activeFullscreenPage
    ? toSrc(activeFullscreenPage.generatedImage)
    : null;

  return (
    <div className="space-y-6" dir={ar ? 'rtl' : 'ltr'}>
      {/* Gallery Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-3xl border border-dream/20 bg-white/70 p-5 shadow-xs dark:bg-white/5">
        <div>
          <h2 className="font-display text-lg font-bold text-ink dark:text-moonlight flex items-center gap-2">
            <span>{ar ? 'معرض رسومات القصة' : 'Story Illustrations Gallery'}</span>
            <span className="rounded-full bg-dream/20 px-2.5 py-0.5 text-xs font-semibold text-ink dark:text-moonlight">
              {pagesWithImages.length} / {totalPages}
            </span>
          </h2>
          <p className="mt-1 text-xs text-ink/65 dark:text-moonlight/65">
            {ar
              ? `أسلوب الرسم: ${storyData.story_info.art_style || 'كرتوني'} • انقر على أي رسمة لعرضها بكامل الشاشة`
              : `Art style: ${storyData.story_info.art_style || 'Cartoon'} • Click any scene to view in full screen`}
          </p>
        </div>
      </div>

      {/* Grid View */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        {storyData.pages.map((page, idx) => {
          const imgUrl = toSrc(page.generatedImage);
          const isPaintingThis = Boolean(page.isGeneratingImage);

          return (
            <div
              key={page.page}
              onClick={() => imgUrl && setFullscreenIndex(idx)}
              className={`group relative flex flex-col overflow-hidden rounded-3xl border border-dream/25 bg-white/80 shadow-xs transition duration-300 dark:bg-white/5 ${
                imgUrl ? 'cursor-pointer hover:-translate-y-1 hover:shadow-md hover:border-lantern' : ''
              }`}
            >
              {/* Image Frame */}
              <div className="relative aspect-[4/3] w-full overflow-hidden bg-dream/10">
                {imgUrl ? (
                  <>
                    <img
                      src={imgUrl}
                      alt={page.image_prompt || `Scene ${page.page}`}
                      className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                      loading="lazy"
                    />

                    {/* Hover Overlay */}
                    <div className="absolute inset-0 bg-black/40 opacity-0 backdrop-blur-xs transition duration-200 group-hover:opacity-100 flex items-center justify-center gap-2">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setMagnifierPage(page);
                        }}
                        className="flex h-10 w-10 items-center justify-center rounded-full bg-lantern text-ink shadow-sm transition hover:scale-110"
                        title={ar ? 'تكبير وفحص التفاصيل بعدسة HD' : 'Zoom & Inspect HD Details'}
                      >
                        <ZoomIn size={18} />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setFullscreenIndex(idx);
                        }}
                        className="flex h-10 w-10 items-center justify-center rounded-full bg-white/90 text-ink shadow-sm transition hover:scale-110"
                        title={ar ? 'تكبير كامل الشاشة' : 'Full Screen'}
                      >
                        <Maximize2 size={18} />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => handleDownloadSingleImage(page, e)}
                        className="flex h-10 w-10 items-center justify-center rounded-full bg-white/90 text-ink shadow-sm transition hover:scale-110"
                        title={ar ? 'تنزيل الصورة' : 'Download Image'}
                      >
                        <Download size={18} />
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="flex h-full w-full flex-col items-center justify-center p-4 text-center">
                    {isPaintingThis ? (
                      <div className="flex flex-col items-center gap-2">
                        <Loader2 size={24} className="animate-spin text-lantern" />
                        <span className="text-xs font-medium text-ink/70 dark:text-moonlight/70">
                          {ar ? 'جارٍ الرسم...' : 'Painting...'}
                        </span>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={(e) => handlePaintImage(page, e)}
                        className="inline-flex items-center gap-1.5 rounded-full bg-lantern px-3.5 py-1.5 text-xs font-bold text-ink shadow-xs transition hover:brightness-105 active:scale-95"
                      >
                        <Sparkles size={14} />
                        <span>{ar ? 'رسم المشهد' : 'Paint Scene'}</span>
                      </button>
                    )}
                  </div>
                )}

                {/* Page Badge & Sentiment Swatch */}
                <div className="absolute top-2.5 start-2.5 flex items-center gap-1.5 rounded-full bg-black/60 px-2.5 py-0.5 text-xs font-bold text-white backdrop-blur-xs">
                  <span
                    className="h-2.5 w-2.5 rounded-full ring-1 ring-white/50"
                    style={{
                      backgroundColor: analyzeTextSentimentAndPalette(page.text || '', page.image_prompt || '').swatchHex,
                    }}
                    title={analyzeTextSentimentAndPalette(page.text || '', page.image_prompt || '').paletteDescriptor}
                  />
                  <span>{ar ? `مشهد ${page.page}` : `Scene ${page.page}`}</span>
                </div>
              </div>

              {/* Card Footer / Caption */}
              <div className="flex flex-1 flex-col justify-between p-3.5">
                <p className="line-clamp-2 text-xs leading-relaxed text-ink/80 dark:text-moonlight/80">
                  {page.text}
                </p>

                <div className="mt-3 flex items-center justify-between border-t border-dream/15 pt-2">
                  <span className="text-[11px] font-semibold text-ink/50 dark:text-moonlight/50">
                    {storyData.story_info.title}
                  </span>

                  <button
                    type="button"
                    onClick={(e) => copyAnimation(page, idx, e)}
                    className="inline-flex min-h-11 items-center gap-1 px-1 text-[11px] font-bold text-dream transition hover:underline"
                    title={ar ? 'انسخ برومبت تحريك المشهد' : 'Copy scene animation prompt'}
                  >
                    {copiedPage === page.page ? <Check size={12} aria-hidden /> : <Clapperboard size={12} aria-hidden />}
                    <span>{copiedPage === page.page ? (ar ? 'تم النسخ' : 'Copied') : ar ? 'برومبت التحريك' : 'Animation prompt'}</span>
                  </button>

                  {onSelectPage && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectPage(idx);
                      }}
                      className="inline-flex min-h-11 items-center gap-1 px-1 text-[11px] font-bold text-lantern transition hover:underline"
                    >
                      <BookOpen size={12} />
                      <span>{ar ? 'قراءة المشهد' : 'Read scene'}</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Full-Screen Lightbox Modal */}
      {fullscreenIndex !== null && activeFullscreenPage && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex flex-col bg-black/92 backdrop-blur-md animate-in fade-in duration-200"
          onClick={() => setFullscreenIndex(null)}
        >
          {/* Top Bar */}
          <div
            className="flex items-center justify-between px-6 py-4 text-white border-b border-white/10 z-10"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3">
              <span className="font-display text-sm font-bold text-lantern">
                {ar
                  ? `المشهد ${activeFullscreenPage.page} من ${storyData.pages.length}`
                  : `Scene ${activeFullscreenPage.page} of ${storyData.pages.length}`}
              </span>
              <span className="hidden sm:inline text-white/50">•</span>
              <span className="hidden sm:inline text-xs font-medium text-white/80 max-w-sm truncate">
                {storyData.story_info.title}
              </span>
            </div>

            <div className="flex items-center gap-2">
              {activeFullscreenPage.generatedImage && (
                <>
                  <button
                    type="button"
                    onClick={() => setMagnifierPage(activeFullscreenPage)}
                    className="flex items-center gap-1.5 rounded-full bg-lantern px-3.5 py-1.5 text-xs font-extrabold text-ink transition hover:brightness-105"
                    title={ar ? 'تكبير وفحص التفاصيل بعدسة HD' : 'Zoom & Inspect HD Details'}
                  >
                    <ZoomIn size={14} />
                    <span className="hidden sm:inline">{ar ? 'عدسة الفحص والتكبير' : 'Zoom & Inspect'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDownloadSingleImage(activeFullscreenPage)}
                    className="flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-white/25"
                    title={ar ? 'تنزيل الصورة' : 'Download Image'}
                  >
                    <Download size={14} />
                    <span className="hidden sm:inline">{ar ? 'تنزيل' : 'Download'}</span>
                  </button>
                </>
              )}

              {onSelectPage && (
                <button
                  type="button"
                  onClick={() => {
                    const idx = fullscreenIndex;
                    setFullscreenIndex(null);
                    onSelectPage(idx);
                  }}
                  className="flex items-center gap-1.5 rounded-full bg-lantern px-3 py-1.5 text-xs font-bold text-ink transition hover:brightness-105"
                >
                  <BookOpen size={14} />
                  <span className="hidden sm:inline">{ar ? 'افتح في القارئ' : 'Open in Reader'}</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => setFullscreenIndex(null)}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-white/15 text-white transition hover:bg-white/25 active:scale-95"
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Main Stage (Image + Arrows) */}
          <div
            className="relative flex flex-1 items-center justify-center p-4 sm:p-8 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Previous Button */}
            <button
              type="button"
              disabled={fullscreenIndex === 0}
              onClick={() => setFullscreenIndex((i) => Math.max(0, (i ?? 0) - 1))}
              className="absolute start-4 sm:start-8 z-20 flex h-12 w-12 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur-xs transition hover:bg-white/30 disabled:opacity-20 active:scale-95"
              aria-label={ar ? 'المشهد السابق' : 'Previous scene'}
            >
              {ar ? <ChevronRight size={28} /> : <ChevronLeft size={28} />}
            </button>

            {/* Full Screen Image */}
            {activeFullscreenImageSrc ? (
              <div className="relative max-h-[75vh] max-w-[90vw] flex items-center justify-center select-none">
                <img
                  src={activeFullscreenImageSrc}
                  alt={activeFullscreenPage.image_prompt || `Scene ${activeFullscreenPage.page}`}
                  className="max-h-[75vh] max-w-[90vw] rounded-2xl object-contain shadow-2xl transition-all duration-300"
                />
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center gap-4 rounded-3xl bg-white/10 p-8 text-white text-center">
                <Wand2 size={40} className="text-lantern animate-pulse" />
                <p className="text-sm font-medium">
                  {ar ? 'لم يتم رسم هذا المشهد بعد' : 'This scene has not been illustrated yet'}
                </p>
                <button
                  type="button"
                  onClick={(e) => handlePaintImage(activeFullscreenPage, e)}
                  className="inline-flex items-center gap-2 rounded-full bg-lantern px-5 py-2 font-display text-sm font-bold text-ink transition hover:brightness-105"
                >
                  <Sparkles size={16} />
                  <span>{ar ? 'رسم هذا المشهد الآن' : 'Paint This Scene Now'}</span>
                </button>
              </div>
            )}

            {/* Next Button */}
            <button
              type="button"
              disabled={fullscreenIndex === storyData.pages.length - 1}
              onClick={() =>
                setFullscreenIndex((i) => Math.min(storyData.pages.length - 1, (i ?? 0) + 1))
              }
              className="absolute end-4 sm:end-8 z-20 flex h-12 w-12 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur-xs transition hover:bg-white/30 disabled:opacity-20 active:scale-95"
              aria-label={ar ? 'المشهد التالي' : 'Next scene'}
            >
              {ar ? <ChevronLeft size={28} /> : <ChevronRight size={28} />}
            </button>
          </div>

          {/* Bottom Floating Story Text Bar */}
          <div
            className="px-6 py-4 bg-gradient-to-t from-black/80 via-black/60 to-transparent text-white"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto max-w-2xl rounded-2xl bg-white/10 p-4 backdrop-blur-md border border-white/10 space-y-2">
              <div className="flex items-center justify-center gap-2 text-xs text-amber-200 font-bold">
                <Palette size={13} className="text-lantern" />
                <span>
                  {ar
                    ? analyzeTextSentimentAndPalette(activeFullscreenPage.text || '', activeFullscreenPage.image_prompt || '').label.ar
                    : analyzeTextSentimentAndPalette(activeFullscreenPage.text || '', activeFullscreenPage.image_prompt || '').label.en}
                </span>
              </div>
              <p className="text-sm sm:text-base leading-relaxed text-center font-medium">
                {activeFullscreenPage.text}
              </p>
            </div>
          </div>
        </div>
      )}

      {magnifierPage && toSrc(magnifierPage.generatedImage) && (
        <ImageMagnifierModal
          src={toSrc(magnifierPage.generatedImage)!}
          title={ar ? `مشهد ${magnifierPage.page} — ${storyData.story_info.title}` : `Scene ${magnifierPage.page} — ${storyData.story_info.title}`}
          pageText={magnifierPage.text}
          scenePrompt={magnifierPage.image_prompt}
          artStyle={storyData.story_info.art_style}
          styleConsistency={storyData.styleConsistency || storyData.story_info.styleConsistency}
          ar={ar}
          onClose={() => setMagnifierPage(null)}
        />
      )}
    </div>
  );
}
