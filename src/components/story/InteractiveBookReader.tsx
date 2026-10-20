import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Volume2 as VolumeIcon, VolumeX, ChevronLeft, ChevronRight, BookOpen, Download, X, Layers, Sparkles, SlidersHorizontal, Check } from 'lucide-react';
import { PDFPreset, StoryData, Language } from '../../types';
import { toSrc } from '../../services/media';
import { BRAND } from '../../config';
import { ambientEngine, detectAmbientEnvironment, AMBIENT_PRESETS } from '../../services/ambientAudio';

interface Props {
  storyData: StoryData;
  language: Language;
  onClose: () => void;
  onDownloadPDFWithPreset: (preset: PDFPreset) => void;
}

export default function InteractiveBookReader({ storyData, language, onClose, onDownloadPDFWithPreset }: Props) {
  const ar = language === 'Arabic';
  const [currentPage, setCurrentPage] = useState(0); // 0 = Front Cover, 1..N = Story Pages, N+1 = Back Cover
  const [viewMode, setViewMode] = useState<'spread' | 'single'>('spread');
  const [pdfPreset, setPdfPreset] = useState<PDFPreset>('storybook');
  const [showTemplateMenu, setShowTemplateMenu] = useState(false);

  const totalStoryPages = storyData.pages.length;
  const maxPages = totalStoryPages + 2;

  const handleNext = () => {
    if (currentPage >= maxPages - 1) return;
    const step = viewMode === 'spread' && currentPage > 0 && currentPage < totalStoryPages ? 2 : 1;
    setCurrentPage((prev) => Math.min(maxPages - 1, prev + step));
  };

  const handlePrev = () => {
    if (currentPage <= 0) return;
    const step = viewMode === 'spread' && currentPage > 1 ? 2 : 1;
    setCurrentPage((prev) => Math.max(0, prev - step));
  };

  const coverImg = toSrc(storyData.coverImage || storyData.pages[0]?.generatedImage);
  const title = storyData.story_info.title;
  const moral = storyData.story_info.moral || storyData.pages[0]?.text?.slice(0, 150);

  const leftPageIndex = currentPage > 0 && currentPage <= totalStoryPages ? currentPage - 1 : null;
  const rightPageIndex = viewMode === 'spread' && leftPageIndex !== null && leftPageIndex + 1 < totalStoryPages ? leftPageIndex + 1 : null;

  const leftPageData = leftPageIndex !== null ? storyData.pages[leftPageIndex] : null;
  const rightPageData = rightPageIndex !== null ? storyData.pages[rightPageIndex] : null;

  const activePageForAmbient = leftPageData || rightPageData || storyData.pages[0];
  const activeAmbientType = activePageForAmbient ? detectAmbientEnvironment(activePageForAmbient.text, activePageForAmbient.image_prompt) : 'dream';
  const activeAmbientInfo = AMBIENT_PRESETS[activeAmbientType];
  const [ambientMuted, setAmbientMuted] = useState(() => ambientEngine.isMuted());

  useEffect(() => {
    if (activePageForAmbient) {
      const env = detectAmbientEnvironment(activePageForAmbient.text, activePageForAmbient.image_prompt);
      ambientEngine.playAmbient(env);
    }
  }, [activePageForAmbient?.page, activePageForAmbient?.text, activePageForAmbient?.image_prompt]);

  const pageVariants = {
    initial: (direction: number) => ({
      rotateY: direction > 0 ? 45 : -45,
      opacity: 0,
      scale: 0.95,
    }),
    animate: {
      rotateY: 0,
      opacity: 1,
      scale: 1,
      transition: {
        duration: 0.45,
        ease: [0.22, 1, 0.36, 1] as const,
      },
    },
    exit: (direction: number) => ({
      rotateY: direction > 0 ? -45 : 45,
      opacity: 0,
      scale: 0.95,
      transition: {
        duration: 0.35,
        ease: 'easeIn' as const,
      },
    }),
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-3 sm:p-6 backdrop-blur-lg" dir={ar ? 'rtl' : 'ltr'}>
      <div className="relative flex flex-col w-full max-w-5xl h-[90vh] max-h-[820px] rounded-3xl border border-amber-500/30 bg-[#120f21] p-4 sm:p-7 shadow-2xl text-moonlight overflow-hidden">
        
        {/* Header Control Bar */}
        <div className="flex items-center justify-between border-b border-white/10 pb-3 shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-500/20 text-amber-300">
              <BookOpen size={22} />
            </div>
            <div>
              <h3 className="font-display text-base sm:text-lg font-bold text-white flex items-center gap-2">
                <span>{ar ? 'الكتاب التفاعلي مع Framer Motion' : 'Interactive Book Reader'}</span>
                <span className="rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300 px-2 py-0.5 text-[10px] font-bold">
                  framer-motion
                </span>
              </h3>
              <p className="text-xs text-white/60">
                {ar ? 'اسحب أو انقر لتقليب الصفحات ككتاب ورقي حقيقي' : 'Drag or click to flip pages like a real storybook'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 relative">
            {/* Ambient Sound Badge & Toggle */}
            <button
              type="button"
              onClick={() => setAmbientMuted(ambientEngine.toggleMute())}
              className={`hidden sm:inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold transition active:scale-95 ${
                ambientMuted
                  ? 'border-white/20 bg-white/10 text-white/50 line-through'
                  : 'border-emerald-500/50 bg-emerald-500/15 text-emerald-300'
              }`}
              title={ar ? 'الأصوات المحيطية للمشهد' : 'Scene Ambient Sound Effects'}
            >
              {ambientMuted ? <VolumeX size={14} /> : <VolumeIcon size={14} className="text-emerald-400 animate-pulse" />}
              <span>{ar ? activeAmbientInfo.label.ar : activeAmbientInfo.label.en}</span>
            </button>

            {/* View Spread Mode Toggle */}
            <button
              type="button"
              onClick={() => setViewMode(viewMode === 'spread' ? 'single' : 'spread')}
              className="hidden sm:inline-flex items-center gap-1.5 rounded-full border border-white/20 px-3 py-1.5 text-xs font-semibold hover:bg-white/10 transition"
            >
              <Layers size={14} />
              <span>{viewMode === 'spread' ? (ar ? 'صفحة واحدة' : 'Single') : (ar ? 'صفحتان' : 'Spread')}</span>
            </button>

            {/* PDF Template Selector Dropdown */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowTemplateMenu(!showTemplateMenu)}
                className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/50 bg-amber-500/15 px-3 py-1.5 text-xs font-bold text-amber-300 transition hover:bg-amber-500/25"
              >
                <SlidersHorizontal size={14} />
                <span>{ar ? 'قالب PDF' : 'PDF Style'}</span>
              </button>

              {showTemplateMenu && (
                <div className="absolute end-0 mt-2 w-52 rounded-2xl border border-amber-500/30 bg-[#1c162e] p-2 shadow-2xl z-50 space-y-1 text-xs">
                  <div className="px-3 py-1.5 font-bold text-amber-300 border-b border-white/10 mb-1">
                    {ar ? 'اختر نمط تصدير PDF:' : 'Select PDF Template:'}
                  </div>
                  {[
                    { id: 'storybook', label: ar ? 'الملكي الكلاسيكي (.pdf-classic)' : 'Royal Classic (.pdf-classic)', desc: ar ? 'إطار ذهبي فاخر وفهرس محتويات' : 'Luxury gold border & TOC' },
                    { id: 'minimalist', label: ar ? 'المودرن البسيط (.pdf-minimal)' : 'Minimal Picture Book (.pdf-minimal)', desc: ar ? 'تصميم بأسلوب كتاب مصور حديث' : 'Modern clean picture book' },
                    { id: 'collector', label: ar ? 'طبعة المجمعين (.pdf-modern)' : 'Collector Edition (.pdf-modern)', desc: ar ? 'يتضمن بطاقات الشخصيات كاملة' : 'Includes character reference cards' },
                  ].map((tmpl) => (
                    <button
                      key={tmpl.id}
                      type="button"
                      onClick={() => {
                        setPdfPreset(tmpl.id as PDFPreset);
                        setShowTemplateMenu(false);
                        onDownloadPDFWithPreset(tmpl.id as PDFPreset);
                      }}
                      className={`w-full text-start p-2 rounded-xl transition flex items-center justify-between ${
                        pdfPreset === tmpl.id ? 'bg-amber-500/25 text-amber-200 font-bold' : 'hover:bg-white/10 text-white/80'
                      }`}
                    >
                      <div>
                        <div>{tmpl.label}</div>
                        <div className="text-[10px] text-white/50">{tmpl.desc}</div>
                      </div>
                      {pdfPreset === tmpl.id && <Check size={14} className="text-amber-300 shrink-0" />}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Quick Export PDF Button */}
            <button
              type="button"
              onClick={() => onDownloadPDFWithPreset(pdfPreset)}
              className="inline-flex items-center gap-1.5 rounded-full bg-lantern px-3.5 py-1.5 text-xs font-bold text-ink shadow-sm hover:brightness-105 transition"
            >
              <Download size={14} />
              <span>{ar ? 'تصدير PDF' : 'Export PDF'}</span>
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

        {/* Interactive Page Stage using Framer Motion */}
        <div className="relative flex-1 flex items-center justify-center my-4 overflow-hidden select-none" style={{ perspective: '1200px' }}>
          <AnimatePresence mode="wait" custom={1}>
            <motion.div
              key={currentPage}
              custom={1}
              variants={pageVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              drag="x"
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={0.2}
              onDragEnd={(_, info) => {
                if (info.offset.x < -80) handleNext();
                else if (info.offset.x > 80) handlePrev();
              }}
              className="w-full h-full flex items-center justify-center cursor-grab active:cursor-grabbing"
            >
              {/* Front Cover Page */}
              {currentPage === 0 && (
                <div className="relative flex flex-col items-center justify-between w-full max-w-md h-full rounded-2xl border-4 border-amber-500/40 bg-gradient-to-b from-[#281d45] to-[#100b21] p-6 shadow-2xl">
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

              {/* Story Book Pages (Spread or Single View) */}
              {currentPage > 0 && currentPage <= totalStoryPages && (
                <div className="flex w-full h-full max-w-4xl rounded-2xl border border-amber-500/30 bg-[#1e1733] shadow-2xl overflow-hidden">
                  
                  {/* Left Spread Page */}
                  <div className="flex-1 flex flex-col p-5 border-r border-amber-500/20 bg-gradient-to-br from-[#271f40] to-[#151026] overflow-y-auto">
                    {leftPageData ? (
                      <div className="flex flex-col h-full justify-between space-y-4">
                        <div className="flex items-center justify-between text-xs text-amber-400 font-bold border-b border-white/10 pb-2">
                          <span>{ar ? `المشهد ${leftPageData.page}` : `Scene ${leftPageData.page}`}</span>
                          {leftPageData.chapter && <span className="text-white/70">{leftPageData.chapter}</span>}
                        </div>

                        {leftPageData.generatedImage && (
                          <div className="relative flex-1 min-h-[200px] rounded-xl overflow-hidden border border-white/10 shadow-md">
                            <img src={toSrc(leftPageData.generatedImage) ?? undefined} alt="" className="h-full w-full object-cover" />
                          </div>
                        )}

                        <p className="text-sm sm:text-base leading-relaxed text-white/95 font-sans whitespace-pre-wrap">
                          {leftPageData.text}
                        </p>

                        <div className="text-center text-xs text-white/40 border-t border-white/10 pt-2 font-mono">
                          — {leftPageData.page} —
                        </div>
                      </div>
                    ) : null}
                  </div>

                  {/* Right Spread Page */}
                  {viewMode === 'spread' && (
                    <div className="hidden sm:flex flex-1 flex-col p-5 bg-gradient-to-bl from-[#201838] to-[#110c21] overflow-y-auto">
                      {rightPageData ? (
                        <div className="flex flex-col h-full justify-between space-y-4">
                          <div className="flex items-center justify-between text-xs text-amber-400 font-bold border-b border-white/10 pb-2">
                            <span>{ar ? `المشهد ${rightPageData.page}` : `Scene ${rightPageData.page}`}</span>
                            {rightPageData.chapter && <span className="text-white/70">{rightPageData.chapter}</span>}
                          </div>

                          {rightPageData.generatedImage && (
                            <div className="relative flex-1 min-h-[200px] rounded-xl overflow-hidden border border-white/10 shadow-md">
                              <img src={toSrc(rightPageData.generatedImage) ?? undefined} alt="" className="h-full w-full object-cover" />
                            </div>
                          )}

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

              {/* Back Cover Page */}
              {currentPage > totalStoryPages && (
                <div className="flex flex-col items-center justify-between w-full max-w-md h-full rounded-2xl border-4 border-amber-500/40 bg-gradient-to-b from-[#1b142e] to-[#090614] p-6 shadow-2xl text-center">
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
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Footer Navigation Controls */}
        <div className="flex items-center justify-between border-t border-white/10 pt-3 shrink-0">
          <button
            type="button"
            disabled={currentPage <= 0}
            onClick={handlePrev}
            className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-xs font-bold text-white transition hover:bg-white/20 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ChevronRight size={18} className={ar ? '' : 'rotate-180'} />
            <span>{ar ? 'الصفحة السابقة' : 'Previous'}</span>
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
            disabled={currentPage >= maxPages - 1}
            onClick={handleNext}
            className="inline-flex items-center gap-2 rounded-full bg-lantern px-5 py-2 text-xs font-bold text-ink shadow-md transition hover:brightness-105 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <span>{ar ? 'الصفحة التالية' : 'Next'}</span>
            <ChevronLeft size={18} className={ar ? '' : 'rotate-180'} />
          </button>
        </div>

      </div>
    </div>
  );
}
