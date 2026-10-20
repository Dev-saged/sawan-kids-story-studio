import { useState } from 'react';
import { ChevronLeft, ChevronRight, BookOpen, Download, Sparkles, X, Layers } from 'lucide-react';
import { StoryData } from '../../types';
import { toSrc } from '../../services/media';
import { APP_VERSION, BRAND } from '../../config';

interface Props {
  storyData: StoryData;
  ar: boolean;
  onClose: () => void;
  onDownloadPDF: () => void;
}

export default function InteractiveFlipbook({ storyData, ar, onClose, onDownloadPDF }: Props) {
  const [currentPage, setCurrentPage] = useState(0); // 0 = Cover, 1..N = Pages, N+1 = Back Cover
  const [isFlipping, setIsFlipping] = useState(false);
  const [viewMode, setViewMode] = useState<'spread' | 'single'>('spread');

  const totalStoryPages = storyData.pages.length;
  const totalPagesCount = totalStoryPages + 2; // Cover + Pages + Back Cover

  const handleNext = () => {
    if (currentPage >= totalPagesCount - 1 || isFlipping) return;
    setIsFlipping(true);
    setTimeout(() => {
      setCurrentPage((prev) => Math.min(totalPagesCount - 1, prev + (viewMode === 'spread' && prev > 0 && prev < totalStoryPages ? 2 : 1)));
      setIsFlipping(false);
    }, 300);
  };

  const handlePrev = () => {
    if (currentPage <= 0 || isFlipping) return;
    setIsFlipping(true);
    setTimeout(() => {
      setCurrentPage((prev) => Math.max(0, prev - (viewMode === 'spread' && prev > 1 ? 2 : 1)));
      setIsFlipping(false);
    }, 300);
  };

  const coverImg = toSrc(storyData.coverImage || storyData.pages[0]?.generatedImage);
  const title = storyData.story_info.title;
  const moral = storyData.story_info.moral || storyData.pages[0]?.text?.slice(0, 160);

  // Active page logic for two-page spread
  const leftPageIndex = currentPage > 0 && currentPage <= totalStoryPages ? currentPage - 1 : null;
  const rightPageIndex = viewMode === 'spread' && leftPageIndex !== null && leftPageIndex + 1 < totalStoryPages ? leftPageIndex + 1 : null;

  const leftPageData = leftPageIndex !== null ? storyData.pages[leftPageIndex] : null;
  const rightPageData = rightPageIndex !== null ? storyData.pages[rightPageIndex] : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-3 sm:p-6 backdrop-blur-md" dir={ar ? 'rtl' : 'ltr'}>
      <div className="relative flex flex-col w-full max-w-5xl h-[90vh] max-h-[820px] rounded-3xl border border-dream/30 bg-[#120f21] p-4 sm:p-7 shadow-2xl text-moonlight overflow-hidden">
        
        {/* Header Bar */}
        <div className="flex items-center justify-between border-b border-white/10 pb-3 shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-lantern/20 text-lantern">
              <BookOpen size={22} />
            </div>
            <div>
              <h3 className="font-display text-base sm:text-lg font-bold text-white flex items-center gap-2">
                <span>{ar ? 'الكتاب التفاعلي بخصائص تقليب الصفحات' : 'Interactive Flipbook Reader'}</span>
                <span className="rounded-full bg-lantern/20 border border-lantern/40 text-lantern px-2 py-0.5 text-[10px] font-bold">
                  v{APP_VERSION}
                </span>
              </h3>
              <p className="text-xs text-white/60">
                {ar ? 'تصفّح القصة بتقليب الصفحات الواقعي وتجربة كتاب الأطفال المصور' : 'Experience realistic page turns and illustrated storybook reading'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setViewMode(viewMode === 'spread' ? 'single' : 'spread')}
              className="hidden sm:inline-flex items-center gap-1.5 rounded-full border border-white/20 px-3 py-1.5 text-xs font-semibold hover:bg-white/10 transition"
            >
              <Layers size={14} />
              <span>{viewMode === 'spread' ? (ar ? 'صفحة واحدة' : 'Single Page') : (ar ? 'صفحتان (كتاب)' : 'Double Spread')}</span>
            </button>

            <button
              type="button"
              onClick={onDownloadPDF}
              className="inline-flex items-center gap-1.5 rounded-full bg-lantern px-3.5 py-1.5 text-xs font-bold text-ink shadow-sm hover:brightness-105 transition"
            >
              <Download size={14} />
              <span>{ar ? 'تحميل PDF' : 'PDF Export'}</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="rounded-full p-2 text-white/60 hover:bg-white/10 hover:text-white transition"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Flipbook Container Stage */}
        <div className="relative flex-1 flex items-center justify-center my-4 overflow-hidden select-none">
          
          {/* Cover View (Page 0) */}
          {currentPage === 0 && (
            <div className={`relative flex flex-col items-center justify-between w-full max-w-md h-full rounded-2xl border-4 border-amber-500/40 bg-gradient-to-b from-[#241a3d] to-[#0f0a1c] p-6 shadow-2xl transition-transform duration-500 ${isFlipping ? 'scale-95 opacity-50' : 'scale-100 opacity-100'}`}>
              <div className="w-full text-center space-y-2">
                <span className="inline-block rounded-full bg-amber-500/20 border border-amber-500/30 text-amber-300 px-3 py-1 text-xs font-bold">
                  {ar ? BRAND.fullName.ar : BRAND.fullName.en}
                </span>
                <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-white leading-tight drop-shadow-md">
                  {title}
                </h1>
              </div>

              {coverImg ? (
                <div className="relative w-full flex-1 max-h-[380px] my-4 rounded-xl overflow-hidden border-2 border-amber-400/30 shadow-lg">
                  <img src={coverImg} alt="Cover" className="h-full w-full object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                </div>
              ) : (
                <div className="flex-1 flex items-center justify-center my-4">
                  <BookOpen size={64} className="text-amber-400/50" />
                </div>
              )}

              <div className="w-full text-center border-t border-white/10 pt-3 text-xs text-amber-300/80 font-medium">
                {ar ? `تصميم وتأليف: ${BRAND.author.ar} · ${BRAND.madeIn.ar}` : `Created by ${BRAND.author.en}`}
              </div>
            </div>
          )}

          {/* Story Pages View (Spread / Single) */}
          {currentPage > 0 && currentPage <= totalStoryPages && (
            <div className={`flex w-full h-full max-w-4xl rounded-2xl border border-amber-500/30 bg-[#1d1730] shadow-2xl overflow-hidden transition-all duration-300 ${isFlipping ? 'rotate-y-12 opacity-70' : ''}`}>
              
              {/* Left Page (Image or Text depending on layout) */}
              <div className="flex-1 flex flex-col p-5 border-r border-amber-500/20 bg-gradient-to-br from-[#261f3e] to-[#161126] overflow-y-auto">
                {leftPageData ? (
                  <div className="flex flex-col h-full justify-between space-y-4">
                    <div className="flex items-center justify-between text-xs text-amber-400 font-bold border-b border-white/10 pb-2">
                      <span>{ar ? `المشهد ${leftPageData.page}` : `Scene ${leftPageData.page}`}</span>
                      {leftPageData.chapter && <span className="text-white/70">{leftPageData.chapter}</span>}
                    </div>

                    {leftPageData.generatedImage ? (
                      <div className="relative flex-1 min-h-[200px] rounded-xl overflow-hidden border border-white/10 shadow-md">
                        <img src={toSrc(leftPageData.generatedImage) ?? undefined} alt="" className="h-full w-full object-cover" />
                      </div>
                    ) : null}

                    <p className="text-sm sm:text-base leading-relaxed text-white/95 font-sans whitespace-pre-wrap">
                      {leftPageData.text}
                    </p>

                    <div className="text-center text-xs text-white/40 border-t border-white/10 pt-2 font-mono">
                      — {leftPageData.page} —
                    </div>
                  </div>
                ) : null}
              </div>

              {/* Right Page (Next page in spread view) */}
              {viewMode === 'spread' && (
                <div className="hidden sm:flex flex-1 flex-col p-5 bg-gradient-to-bl from-[#211a36] to-[#120d21] overflow-y-auto">
                  {rightPageData ? (
                    <div className="flex flex-col h-full justify-between space-y-4">
                      <div className="flex items-center justify-between text-xs text-amber-400 font-bold border-b border-white/10 pb-2">
                        <span>{ar ? `المشهد ${rightPageData.page}` : `Scene ${rightPageData.page}`}</span>
                        {rightPageData.chapter && <span className="text-white/70">{rightPageData.chapter}</span>}
                      </div>

                      {rightPageData.generatedImage ? (
                        <div className="relative flex-1 min-h-[200px] rounded-xl overflow-hidden border border-white/10 shadow-md">
                          <img src={toSrc(rightPageData.generatedImage) ?? undefined} alt="" className="h-full w-full object-cover" />
                        </div>
                      ) : null}

                      <p className="text-sm sm:text-base leading-relaxed text-white/95 font-sans whitespace-pre-wrap">
                        {rightPageData.text}
                      </p>

                      <div className="text-center text-xs text-white/40 border-t border-white/10 pt-2 font-mono">
                        — {rightPageData.page} —
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full text-white/30 text-xs">
                      <Sparkles size={32} className="mb-2 text-amber-400/40" />
                      <span>{ar ? 'نهاية مشاهد القصة' : 'End of story scenes'}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Back Cover View (Final Page) */}
          {currentPage > totalStoryPages && (
            <div className="flex flex-col items-center justify-between w-full max-w-md h-full rounded-2xl border-4 border-amber-500/40 bg-gradient-to-b from-[#1c162e] to-[#0a0714] p-6 shadow-2xl text-center">
              <div className="space-y-2">
                <span className="flex items-center justify-center gap-1.5 text-amber-400 font-bold text-sm">
                  <Sparkles size={16} />
                  <span>{ar ? 'خاتمة القصة والحكمة' : 'Moral & Closing'}</span>
                </span>
                <h2 className="font-display text-2xl font-bold text-white">{title}</h2>
              </div>

              <div className="my-6 rounded-2xl bg-white/5 border border-white/10 p-5 text-sm text-white/90 leading-relaxed text-start">
                <p className="font-semibold text-amber-300 mb-2">{ar ? 'ماذا تعلمنا من القصة؟' : 'Story Lesson:'}</p>
                <p>{moral}</p>
              </div>

              <div className="w-full border-t border-white/10 pt-4 space-y-2">
                <p className="text-xs text-amber-300 font-bold">
                  {ar ? `حقوق النشر والتأليف © 2026 — ${BRAND.fullName.ar}` : `Copyright © 2026 — ${BRAND.fullName.en}`}
                </p>
                <p className="text-[11px] text-white/50">
                  {ar ? `برمجة وتطوير: ${BRAND.author.ar} · ${BRAND.madeIn.ar}` : `Developed by ${BRAND.author.en}`}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer Navigation Bar */}
        <div className="flex items-center justify-between border-t border-white/10 pt-3 shrink-0">
          <button
            type="button"
            disabled={currentPage <= 0 || isFlipping}
            onClick={handlePrev}
            className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-xs font-bold text-white transition hover:bg-white/20 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ChevronRight size={18} className={ar ? '' : 'rotate-180'} />
            <span>{ar ? 'الصفحة السابقة' : 'Previous Page'}</span>
          </button>

          <div className="flex items-center gap-2 text-xs font-bold text-amber-300">
            <span>
              {currentPage === 0
                ? (ar ? 'الغلاف الأمامي' : 'Front Cover')
                : currentPage > totalStoryPages
                ? (ar ? 'الغلاف الخلفي' : 'Back Cover')
                : (ar ? `صفحة ${currentPage} من ${totalStoryPages}` : `Page ${currentPage} of ${totalStoryPages}`)}
            </span>
          </div>

          <button
            type="button"
            disabled={currentPage >= totalPagesCount - 1 || isFlipping}
            onClick={handleNext}
            className="inline-flex items-center gap-2 rounded-full bg-lantern px-5 py-2 text-xs font-bold text-ink shadow-md transition hover:brightness-105 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <span>{ar ? 'الصفحة التالية' : 'Next Page'}</span>
            <ChevronLeft size={18} className={ar ? '' : 'rotate-180'} />
          </button>
        </div>

      </div>
    </div>
  );
}
