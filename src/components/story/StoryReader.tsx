import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react';
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
  LayoutGrid,
  BookOpen,
  Images,
  Clapperboard,
  ListMusic,
  RefreshCw,
  Layers,
  Package,
  Film,
  BookPlus,
  AlertTriangle,
  BookmarkPlus,
  Check,
  MessageSquareWarning,
  ZoomIn,
  Palette,
} from 'lucide-react';
import { ArtStyle, Character, CoverFontStyle, CoverTextEffect, Language, NarratorVoice, PageImage, PDFPreset, StoryData, StoryPage } from '../../types';
import { ART_STYLE_OPTIONS, COVER_EFFECT_OPTIONS, COVER_FONT_OPTIONS, getCoverTitleClasses } from '../../constants';
import { exportImagesAsZip, exportPrintBook, saveStoryAsJSON } from '../../services/export';
import { exportBundle } from '../../services/storyBundle';
import { recordGame } from '../../services/progress';
import { toSrc } from '../../services/media';
import { VOICE_OPTIONS } from '../../services/narration';
import { analyzeTextSentimentAndPalette, suggestAlternativeTitles } from '../../services/gemini';
import { saveAlbumCharacter } from '../../services/db';
import { useIllustrator } from '../../hooks/useIllustrator';
import { useNarration } from '../../hooks/useNarration';
import { useContinueStory } from '../../hooks/useContinueStory';
import PrintableStory from './PrintableStory';
import StoryGallery from './StoryGallery';
import QuizCard from './QuizCard';
import ErrorDetails from '../common/ErrorDetails';
import FreeEngineCard from '../apiKey/FreeEngineCard';
import LuxurySelect, { type LuxuryOption } from '../common/LuxurySelect';
import SleepMode from './SleepMode';
import FamilyRecorder from './FamilyRecorder';
import ShareMenu from './ShareMenu';
import PageTools from './PageTools';
import InteractiveFlipbook from './InteractiveFlipbook';
import InteractiveBookReader from './InteractiveBookReader';
import Book3DViewer from './Book3DViewer';
import LivingCanvas from './LivingCanvas';
import FullPageEditor from './FullPageEditor';
import InteractiveBranches from './InteractiveBranches';
import VoiceClonerModal from './VoiceClonerModal';
import PrintPreviewModal from './PrintPreviewModal';
import { ImageMagnifierModal } from './ImageMagnifierModal';
import { ambientEngine, detectAmbientEnvironment, AMBIENT_PRESETS } from '../../services/ambientAudio';
import { Rotate3D, ShieldCheck, AudioWaveform, VolumeX, Volume2 as VolumeIcon } from 'lucide-react';

const VideoExportSheet = lazy(() => import('./VideoExportSheet'));

interface Props {
  storyData: StoryData;
  language: Language;
  printableContainerId?: string;
  onStoryChange: (updater: (s: StoryData) => StoryData) => void;
  onStartOver: () => void;
  onNextPart?: (story: StoryData) => void;
  // تنقّل لباقي الأقسام بعد القصة: اقرأ وتعلّم والألعاب
  onNavigate?: (section: 'learn' | 'games') => void;
}

export default function StoryReader({ storyData, language, printableContainerId = 'printable-story-root', onStoryChange, onStartOver, onNextPart, onNavigate }: Props) {
  const ar = language === 'Arabic';
  const [viewMode, setViewMode] = useState<'reader' | 'gallery'>('reader');
  const [pageIndex, setPageIndex] = useState(0);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [exportProgress, setExportProgress] = useState<string | null>(null);
  const [pdfSuccess, setPdfSuccess] = useState(false);
  const [pdfPreset, setPdfPreset] = useState<PDFPreset>('storybook');
  const [showVideo, setShowVideo] = useState(false);
  const [show3DViewer, setShow3DViewer] = useState(false);
  const [showFlipbook, setShowFlipbook] = useState(false);
  const [showClassicFlipbook, setShowClassicFlipbook] = useState(false);
  const [fullEditMode, setFullEditMode] = useState(false);
  const [showVoiceCloner, setShowVoiceCloner] = useState(false);
  const [showPrintPreview, setShowPrintPreview] = useState(false);
  const [magnifierTarget, setMagnifierTarget] = useState<{
    src: string;
    title: string;
    pageText?: string;
    scenePrompt?: string;
  } | null>(null);

  // ب4: تحرير الأسلوب أو الشخصيات عند بوابة المعاينة
  const [showPreviewChangePanel, setShowPreviewChangePanel] = useState(false);
  const [previewNewStyle, setPreviewNewStyle] = useState<ArtStyle>(storyData.story_info.art_style as ArtStyle);
  const [previewChars, setPreviewChars] = useState<Character[]>(storyData.characters);

  // ب5: زر «الصورة لا تطابق» وتصحيح المشهد
  const [showMismatchInput, setShowMismatchInput] = useState(false);
  const [mismatchText, setMismatchText] = useState('');

  // ب6: اقتراح 3 عناوين بديلة
  const [suggestedTitles, setSuggestedTitles] = useState<string[]>([]);
  const [suggestingTitles, setSuggestingTitles] = useState(false);

  // ب7: حفظ الشخصيات في «ألبومي»
  const [savedAlbumNames, setSavedAlbumNames] = useState<Record<string, boolean>>({});

  const illustrator = useIllustrator(storyData, onStoryChange, pageIndex);
  const goTo = useCallback((i: number) => setPageIndex(i), []);
  const narration = useNarration(storyData, pageIndex, goTo);
  const more = useContinueStory(storyData, onStoryChange);

  const page = storyData.pages[pageIndex] || storyData.pages[0];
  const imageSrc = toSrc(page?.generatedImage);
  const pageSentiment = useMemo(
    () => analyzeTextSentimentAndPalette(page?.text || '', page?.image_prompt || ''),
    [page?.text, page?.image_prompt]
  );
  const illustratedCount = storyData.pages.filter((p) => p.generatedImage).length;
  const allDrawn = illustratedCount === storyData.pages.length;

  const [ambientMuted, setAmbientMuted] = useState(() => ambientEngine.isMuted());
  const activeAmbientType = page ? detectAmbientEnvironment(page.text, page.image_prompt) : 'dream';
  const activeAmbientInfo = AMBIENT_PRESETS[activeAmbientType];

  useEffect(() => {
    if (page) {
      const env = detectAmbientEnvironment(page.text, page.image_prompt);
      ambientEngine.playAmbient(env);
    }
  }, [pageIndex, page?.text, page?.image_prompt]);

  useEffect(() => {
    ambientEngine.setDucking(narration.status === 'playing');
  }, [narration.status]);

  useEffect(() => {
    return () => {
      ambientEngine.stopAmbient();
    };
  }, []);

  const handleUpdateCurrentPage = useCallback(
    (patch: Partial<StoryPage>) => {
      onStoryChange((s) => ({
        ...s,
        pages: s.pages.map((p, i) => (i === pageIndex ? { ...p, ...patch } : p)),
      }));
    },
    [onStoryChange, pageIndex]
  );

  const handleAddBlankPage = useCallback(() => {
    const newPageNo = pageIndex + 2;
    const newPage: StoryPage = {
      page: newPageNo,
      text: ar ? 'اكتب نص الصفحة الجديدة هنا...' : 'Write your new page text here...',
      narration: ar ? 'اكتب نص الصفحة الجديدة هنا...' : 'Write your new page text here...',
      image_prompt: 'A wonderful colorful storybook illustration',
    };
    onStoryChange((s) => {
      const next = [...s.pages];
      next.splice(pageIndex + 1, 0, newPage);
      return {
        ...s,
        pages: next.map((p, idx) => ({ ...p, page: idx + 1 })),
      };
    });
    setPageIndex((prev) => prev + 1);
  }, [ar, onStoryChange, pageIndex]);

  const handleDeleteCurrentPage = useCallback(() => {
    if (storyData.pages.length <= 1) return;
    onStoryChange((s) => {
      const next = s.pages.filter((_, idx) => idx !== pageIndex);
      return {
        ...s,
        pages: next.map((p, idx) => ({ ...p, page: idx + 1 })),
      };
    });
    setPageIndex((prev) => Math.max(0, prev - 1));
  }, [onStoryChange, pageIndex, storyData.pages.length]);

  const handleChooseBranch = useCallback(
    async (choiceText: string) => {
      await more.appendBranch(choiceText);
      setPageIndex(storyData.pages.length);
    },
    [more, storyData.pages.length]
  );
  const isLast = pageIndex === storyData.pages.length - 1;
  const words = useMemo(() => (page?.text ?? '').split(/\s+/).filter(Boolean), [page?.text]);
  const narrating = narration.status !== 'idle';

  const onPagesChange = useCallback(
    (updater: (pages: StoryPage[]) => StoryPage[]) => onStoryChange((s) => ({ ...s, pages: updater(s.pages) })),
    [onStoryChange]
  );

  const handleExportPDF = async () => {
    handleExportPDFWithPreset(pdfPreset);
  };

  const handleExportPDFWithPreset = async (preset: PDFPreset = 'storybook') => {
    setBusyAction('pdf');
    setActionError(null);
    setPdfSuccess(false);
    setExportProgress(ar ? 'جارٍ تجهيز وقص صفحات القصة...' : 'Preparing PDF pages with template...');
    try {
      const { generatePDFBlob } = await import('../../services/pdf');
      const blob = await generatePDFBlob(storyData, 'A4', ar, setExportProgress, preset);
      const { saveAs } = await import('file-saver');
      const { safeFileName } = await import('../../services/export');
      saveAs(blob, `${safeFileName(storyData.story_info.title, 'story')}_${preset}.pdf`);
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

  const allImages: PageImage[] = storyData.pages.filter((p) => p.generatedImage).map((p) => ({ page: p.page, base64: p.generatedImage! }));

  return (
    <div className="space-y-6">
      {/* غلاف القصة بتنسيقات خطوط الغلاف الفاخرة */}
      <div className="relative overflow-hidden rounded-3xl border border-dream/20 bg-dusk shadow-sm">
        {storyData.coverImage ? (
          <img src={storyData.coverImage} alt="" className="aspect-[16/9] w-full object-cover" />
        ) : (
          <div className="flex aspect-[16/9] w-full items-center justify-center bg-gradient-to-br from-dream/40 to-dusk">
            <Loader2 size={26} className="animate-spin text-star/80" aria-hidden />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent" />
        {storyData.coverImage && (
          <button
            type="button"
            onClick={() =>
              setMagnifierTarget({
                src: storyData.coverImage!,
                title: ar ? `غلاف: ${storyData.story_info.title}` : `Cover: ${storyData.story_info.title}`,
                pageText: storyData.pages[0]?.text || storyData.story_info.title,
                scenePrompt: storyData.cover_image_prompt || storyData.pages[0]?.image_prompt,
              })
            }
            className="absolute top-3 end-3 z-20 inline-flex min-h-11 items-center gap-1.5 rounded-full bg-black/65 px-3.5 text-xs font-extrabold text-white shadow-sm backdrop-blur-xs transition hover:bg-black/85 active:scale-95"
            title={ar ? 'تكبير وفحص تفاصيل الغلاف بعدسة HD' : 'Zoom & inspect cover details with HD loupe'}
          >
            <ZoomIn size={14} className="text-lantern" />
            <span>{ar ? 'تكبير الغلاف' : 'Zoom Cover'}</span>
          </button>
        )}
        <div className="absolute inset-x-0 bottom-0 flex flex-col gap-2 p-4" dir={ar ? 'rtl' : 'ltr'}>
          <div className="flex items-end justify-between gap-3">
            <div className="min-w-0 flex-1">
              {/* ب2 + ب6: عنوان الغلاف بالخط والتأثير المختارين + زر «اقترح عناوين» */}
              <div className="flex flex-wrap items-center gap-2">
                <h1
                  className={`text-xl sm:text-3xl leading-snug ${getCoverTitleClasses(
                    storyData.coverFontStyle ?? storyData.story_info.coverFontStyle ?? 'kufi',
                    storyData.coverTextEffect ?? storyData.story_info.coverTextEffect ?? 'gold'
                  )}`}
                >
                  {storyData.story_info.title}
                </h1>
                <button
                  type="button"
                  disabled={suggestingTitles}
                  onClick={async () => {
                    setSuggestingTitles(true);
                    setActionError(null);
                    try {
                      const titles = await suggestAlternativeTitles(storyData);
                      setSuggestedTitles(titles);
                    } catch (err) {
                      setActionError((err as Error).message);
                    } finally {
                      setSuggestingTitles(false);
                    }
                  }}
                  className="inline-flex min-h-8 items-center gap-1 rounded-full border border-lantern/50 bg-black/55 px-3 py-1 text-[11px] font-bold text-amber-200 backdrop-blur-xs transition hover:bg-lantern hover:text-ink active:scale-95 disabled:opacity-50"
                >
                  {suggestingTitles ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                  <span>{ar ? 'اقترح عناوين' : 'Suggest Titles'}</span>
                </button>
              </div>

              {suggestedTitles.length > 0 && (
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  {suggestedTitles.map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => {
                        onStoryChange((s) => ({
                          ...s,
                          story_info: { ...s.story_info, title: t },
                        }));
                        setSuggestedTitles([]);
                        illustrator.repaintCover();
                      }}
                      className="rounded-full border border-lantern/60 bg-lantern/25 px-3 py-1 text-xs font-bold text-white backdrop-blur-xs transition hover:bg-lantern hover:text-ink"
                    >
                      {t}
                    </button>
                  ))}
                </div>
              )}

              <p className="mt-1 text-xs font-medium text-white/75">
                {illustrator.running ? (ar ? `نرسم الصور... ${illustratedCount}/${storyData.pages.length}` : `Painting... ${illustratedCount}/${storyData.pages.length}`) : `${storyData.story_info.art_style}`}
              </p>
            </div>
            {storyData.coverImage && (
              <button
                type="button"
                onClick={illustrator.repaintCover}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur transition active:scale-95"
                aria-label={ar ? 'أعد رسم الغلاف' : 'Repaint cover'}
              >
                <RefreshCw size={18} />
              </button>
            )}
          </div>

          {/* ب2: مبدّل أنماط خط الغلاف الـ 12 + تأثيرات النص الـ 4 */}
          <div className="flex flex-col gap-1.5 pt-1.5 border-t border-white/10">
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 custom-scrollbar">
              <span className="text-[10px] font-medium text-white/60 shrink-0 me-1">{ar ? 'خط العنوان (12):' : 'Font (12):'}</span>
              {COVER_FONT_OPTIONS.map((font) => {
                const currentFont: CoverFontStyle = storyData.coverFontStyle ?? storyData.story_info.coverFontStyle ?? 'kufi';
                const active = currentFont === font.value;
                return (
                  <button
                    key={font.value}
                    type="button"
                    onClick={() =>
                      onStoryChange((s) => ({
                        ...s,
                        coverFontStyle: font.value,
                        story_info: { ...s.story_info, coverFontStyle: font.value },
                      }))
                    }
                    className={`shrink-0 rounded-full px-3 py-1 text-[11px] font-bold transition active:scale-95 ${font.className} ${
                      active ? 'bg-lantern text-ink shadow-xs' : 'bg-black/45 text-white/85 hover:text-white hover:bg-black/65'
                    }`}
                  >
                    {ar ? font.label.ar : font.label.en}
                  </button>
                );
              })}
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[10px] font-medium text-white/60 me-1">{ar ? 'التأثير:' : 'Effect:'}</span>
              {COVER_EFFECT_OPTIONS.map((ef) => {
                const currentEf: CoverTextEffect = storyData.coverTextEffect ?? storyData.story_info.coverTextEffect ?? 'gold';
                const active = currentEf === ef.value;
                return (
                  <button
                    key={ef.value}
                    type="button"
                    onClick={() =>
                      onStoryChange((s) => ({
                        ...s,
                        coverTextEffect: ef.value,
                        story_info: { ...s.story_info, coverTextEffect: ef.value },
                      }))
                    }
                    className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold transition ${
                      active ? 'bg-amber-300 text-ink' : 'bg-black/45 text-white/80 hover:bg-black/65'
                    }`}
                  >
                    {ar ? ef.label.ar : ef.label.en}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* أ5: تنبيه عربي صريح عند تعذّر توليد ورقة الشخصيات بعد محاولتين */}
      {illustrator.sheetWarning && (
        <div
          role="alert"
          dir="rtl"
          className="flex items-start gap-3 rounded-2xl border border-amber-500/45 bg-amber-500/15 px-4 py-3 text-xs sm:text-sm font-bold text-ink dark:text-amber-200"
        >
          <AlertTriangle size={18} className="mt-0.5 shrink-0 text-lantern" aria-hidden />
          <span>{illustrator.sheetWarning}</span>
        </div>
      )}

      {/* ب4: بوابة معاينة الغلاف والصفحة الأولى قبل إكمال رسم باقي الصفحات لتوفير الحصة */}
      {illustrator.awaitingPreviewApproval && (
        <div
          dir={ar ? 'rtl' : 'ltr'}
          className="space-y-3 rounded-3xl border-2 border-lantern bg-gradient-to-br from-lantern/20 via-amber-500/10 to-transparent p-4 sm:p-5 shadow-md"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-1">
              <h3 className="font-display text-sm sm:text-base font-extrabold text-ink dark:text-moonlight">
                {ar
                  ? 'اكتملت معاينة الغلاف والصفحة الأولى — هل نكمل رسم باقي صفحات القصة؟'
                  : 'Cover & Page 1 preview ready — continue painting the remaining pages?'}
              </h3>
              <p className="text-xs text-ink/70 dark:text-moonlight/70">
                {ar
                  ? 'توقفنا هنا مؤقتاً لتوفير حصتك والتأكد من رضاك عن أسلوب الرسم وملامح الشخصيات.'
                  : 'Paused after page 1 to save your image quota until you confirm the style and characters.'}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={illustrator.approvePreviewContinue}
                className="inline-flex min-h-11 items-center gap-2 rounded-2xl bg-lantern px-5 text-xs sm:text-sm font-extrabold text-ink shadow-sm transition hover:brightness-105 active:scale-95"
              >
                <Play size={15} />
                <span>{ar ? 'أكمل' : 'Continue'}</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setPreviewNewStyle(storyData.story_info.art_style as ArtStyle);
                  setPreviewChars(storyData.characters);
                  setShowPreviewChangePanel((v) => !v);
                }}
                className="inline-flex min-h-11 items-center gap-2 rounded-2xl border border-dream/40 bg-white/80 px-4 text-xs sm:text-sm font-bold text-ink transition hover:border-lantern active:scale-95 dark:bg-white/10 dark:text-moonlight"
              >
                <RefreshCw size={15} />
                <span>{ar ? 'غيّر الأسلوب أو الشخصيات' : 'Change Style or Characters'}</span>
              </button>
            </div>
          </div>

          {showPreviewChangePanel && (
            <div className="space-y-3 rounded-2xl border border-dream/30 bg-white/85 p-4 dark:border-white/15 dark:bg-black/40">
              <div>
                <label className="mb-1 block text-xs font-bold text-ink dark:text-moonlight">
                  {ar ? 'اختر أسلوب الرسم الجديد:' : 'Select new art style:'}
                </label>
                <select
                  value={previewNewStyle}
                  onChange={(e) => setPreviewNewStyle(e.target.value as ArtStyle)}
                  className="w-full rounded-xl border border-dream/30 bg-white px-3 py-2 text-xs font-bold text-ink dark:border-white/20 dark:bg-dusk dark:text-moonlight"
                >
                  {ART_STYLE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {ar ? `${opt.labelAr} (${opt.value})` : opt.value}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <span className="block text-xs font-bold text-ink dark:text-moonlight">
                  {ar ? 'تعديل وصف الشخصيات (باللغتين أو الإنجليزية):' : 'Adjust character descriptions:'}
                </span>
                {previewChars.map((ch, idx) => (
                  <div key={ch.name} className="space-y-1">
                    <span className="text-[11px] font-bold text-lantern">{ch.name}</span>
                    <input
                      type="text"
                      value={ch.description}
                      onChange={(e) =>
                        setPreviewChars((prev) =>
                          prev.map((item, i) => (i === idx ? { ...item, description: e.target.value } : item))
                        )
                      }
                      className="w-full rounded-xl border border-dream/30 bg-white px-3 py-1.5 text-xs text-ink dark:border-white/20 dark:bg-dusk dark:text-moonlight"
                    />
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowPreviewChangePanel(false);
                  illustrator.resetPreviewAndRepaint(previewNewStyle, previewChars);
                }}
                className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-lantern px-4 text-xs font-extrabold text-ink shadow-xs"
              >
                <RefreshCw size={14} />
                <span>{ar ? 'أعد رسم الغلاف والصفحة 1 بالإعدادات الجديدة' : 'Repaint Cover & Page 1 with New Settings'}</span>
              </button>
            </div>
          )}
        </div>
      )}

      {illustrator.error && (
        <div
          role="alert"
          className={`space-y-1.5 rounded-2xl border px-4 py-3 text-sm ${
            /حصة|quota|تلقائياً|دقائق|لحظات/i.test(illustrator.error)
              ? 'border-lantern/40 bg-lantern/10 text-ink dark:text-moonlight'
              : 'border-coral/30 bg-coral/5 text-coral'
          }`}
          dir={ar ? 'rtl' : 'ltr'}
        >
          <div className="flex items-center justify-between gap-3">
            <span className="font-medium">{illustrator.error}</span>
            <button
              type="button"
              onClick={illustrator.retryAll}
              className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full bg-lantern/20 hover:bg-lantern/30 px-4 font-semibold text-ink dark:text-moonlight transition active:scale-95"
            >
              <RefreshCw size={14} aria-hidden />
              {ar ? 'أعد المحاولة' : 'Retry'}
            </button>
          </div>
          <FreeEngineCard ar={ar} mode="error" onSaved={illustrator.retryAll} />
          <ErrorDetails ar={ar} />
        </div>
      )}

      {more.incomplete && (
        <div className="space-y-2 rounded-3xl border border-lantern/40 bg-lantern/10 p-4" dir={ar ? 'rtl' : 'ltr'}>
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-lantern/25 text-ink dark:text-moonlight">
              <BookPlus size={20} aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-display text-sm font-bold text-ink dark:text-moonlight">
                {ar ? `القصة ${storyData.pages.length} من ${storyData.plannedPages} صفحة` : `Story at ${storyData.pages.length} of ${storyData.plannedPages} pages`}
              </p>
              <p className="text-xs text-ink/65 dark:text-moonlight/65">
                {more.running ? (ar ? 'نكتب الفصل التالي وترسم صفحاته تباعاً...' : 'Writing the next chapter; pages are painted as they arrive...') : ar ? `بقي ${more.remaining} صفحة. أكمل من حيث توقفت القصة.` : `${more.remaining} pages left. Continue where it stopped.`}
              </p>
            </div>
            <button
              type="button"
              onClick={more.start}
              disabled={more.running}
              className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full bg-lantern px-4 text-xs font-bold text-ink shadow-xs transition active:scale-95 disabled:opacity-60"
            >
              {more.running ? <Loader2 size={14} className="animate-spin" aria-hidden /> : <Sparkles size={14} aria-hidden />}
              {more.running ? (ar ? 'جارٍ الكتابة' : 'Writing') : ar ? 'أكمل القصة' : 'Continue story'}
            </button>
          </div>
          {more.error && (
            <div role="alert" className="text-xs text-coral">
              <p>{more.error}</p>
              <ErrorDetails ar={ar} />
            </div>
          )}
        </div>
      )}

      {/* View Switcher & Action Bar */}
      <div className="flex flex-wrap items-center justify-center gap-2">
        <div className="inline-flex rounded-2xl border border-dream/20 bg-white/75 p-1.5 shadow-xs dark:bg-white/10">
          {(['reader', 'gallery'] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => setViewMode(mode)}
              className={`inline-flex min-h-11 items-center gap-2 rounded-xl px-4 font-display text-xs font-bold transition ${
                viewMode === mode ? 'bg-lantern text-ink shadow-xs' : 'text-ink/70 hover:text-ink dark:text-moonlight/70 dark:hover:text-moonlight'
              }`}
            >
              {mode === 'reader' ? <BookOpen size={15} /> : <LayoutGrid size={15} />}
              <span>{mode === 'reader' ? (ar ? 'قارئ القصة' : 'Story Reader') : ar ? 'معرض الرسومات' : 'Illustrations Gallery'}</span>
              {mode === 'gallery' && (
                <span className="rounded-full bg-black/10 px-2 py-0.5 text-[11px] font-semibold dark:bg-white/20">
                  {illustratedCount}/{storyData.pages.length}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* 3D Book Experience Button */}
        <button
          type="button"
          onClick={() => setShow3DViewer(true)}
          className="inline-flex min-h-11 items-center gap-2 rounded-2xl border border-dream/30 bg-white/80 px-4 font-display text-xs font-bold text-ink transition hover:border-lantern hover:bg-lantern/10 active:scale-95 dark:bg-white/10 dark:text-moonlight shadow-xs"
          title={ar ? 'معاينة الكتاب ثلاثي الأبعاد 3D وتنزيل فيديو' : '3D Book Experience & Video'}
        >
          <Rotate3D size={16} className="text-lantern" />
          <span>{ar ? 'كتاب 3D' : '3D Book'}</span>
        </button>

        {/* Ambient Sound Badge & Mute Toggle Button */}
        <button
          type="button"
          onClick={() => setAmbientMuted(ambientEngine.toggleMute())}
          className={`inline-flex min-h-11 items-center gap-2 rounded-2xl border px-4 font-display text-xs font-bold transition active:scale-95 shadow-xs ${
            ambientMuted
              ? 'border-white/20 bg-white/10 text-white/50 line-through'
              : 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300'
          }`}
          title={ar ? 'الأصوات المحيطية للمشهد' : 'Scene Ambient Sound Effects'}
        >
          {ambientMuted ? <VolumeX size={16} /> : <VolumeIcon size={16} className="text-emerald-400 animate-pulse" />}
          <span>{ar ? activeAmbientInfo.label.ar : activeAmbientInfo.label.en}</span>
        </button>
        <button
          type="button"
          onClick={() => setShowFlipbook(true)}
          className="inline-flex min-h-11 items-center gap-2 rounded-2xl border border-amber-500/40 bg-amber-500/15 px-4 font-display text-xs font-bold text-amber-300 transition hover:bg-amber-500/25 active:scale-95 shadow-xs"
          title={ar ? 'الكتاب التفاعلي بخصائص السحب وتقليب الصفحات' : 'Interactive Spread Book Reader'}
        >
          <BookOpen size={16} className="text-amber-400" />
          <span>{ar ? 'الكتاب التفاعلي (Spread)' : 'Interactive Book'}</span>
        </button>

        <button
          type="button"
          onClick={() => setShowClassicFlipbook(true)}
          className="inline-flex min-h-11 items-center gap-2 rounded-2xl border border-dream/30 bg-white/80 px-4 font-display text-xs font-bold text-ink transition hover:border-lantern active:scale-95 dark:bg-white/10 dark:text-moonlight shadow-xs"
          title={ar ? 'الدفتر التفاعلي الكلاسيكي' : 'Classic Flipbook Reader'}
        >
          <Layers size={16} className="text-lantern" />
          <span>{ar ? 'دفتر التصفح الكلاسيكي' : 'Classic Flipbook'}</span>
        </button>

        {/* Full Edit Mode Toggle Button */}
        <button
          type="button"
          onClick={() => setFullEditMode(!fullEditMode)}
          className={`inline-flex min-h-11 items-center gap-2 rounded-2xl border px-4 font-display text-xs font-bold transition active:scale-95 shadow-xs ${
            fullEditMode
              ? 'border-lantern bg-lantern text-ink shadow-md'
              : 'border-dream/30 bg-white/80 text-ink/80 hover:border-lantern dark:bg-white/10 dark:text-moonlight'
          }`}
          title={ar ? 'تفعيل الصلاحية الكاملة لتعديل نص الصفحة والصورة والفقاعات' : 'Toggle Full Edit Mode for this page'}
        >
          <ShieldCheck size={16} />
          <span>{ar ? 'صلاحية كاملة للتعديل' : 'Full Edit Mode'}</span>
        </button>
      </div>

      {viewMode === 'gallery' ? (
        <StoryGallery
          storyData={storyData}
          language={language}
          onSelectPage={(idx) => {
            setPageIndex(idx);
            setViewMode('reader');
          }}
          onPagesChange={onPagesChange}
          onPaint={illustrator.retryPage}
        />
      ) : (
        <>
          {fullEditMode && page && (
            <FullPageEditor
              ar={ar}
              page={page}
              pageIndex={pageIndex}
              totalPages={storyData.pages.length}
              onUpdatePage={handleUpdateCurrentPage}
              onAddPage={handleAddBlankPage}
              onDeletePage={handleDeleteCurrentPage}
              onRedrawImage={(customPrompt) => illustrator.retryPage(page.page, true, customPrompt)}
              isRedrawing={page.isGeneratingImage}
            />
          )}

          <div className="page-corner overflow-hidden rounded-3xl border border-dream/20 bg-white/70 shadow-sm dark:bg-white/5">
            {imageSrc ? (
              <div className="relative aspect-[4/3] w-full overflow-hidden bg-dream/10">
                <LivingCanvas
                  src={imageSrc}
                  alt={page?.image_prompt || 'Story illustration'}
                  ar={ar}
                  className="h-full w-full"
                />
                <div className="absolute top-3 end-3 flex flex-wrap items-center gap-1.5 z-20">
                  <div
                    className="flex items-center gap-1.5 rounded-full bg-black/65 px-3 py-1 text-[11px] font-bold text-white backdrop-blur-xs"
                    title={
                      ar
                        ? `طيف الألوان العاطفي التلقائي: ${pageSentiment.paletteDescriptor}`
                        : `Auto Emotional Color Palette: ${pageSentiment.paletteDescriptor}`
                    }
                  >
                    <Palette size={12} className="text-lantern" />
                    <span
                      className="h-2.5 w-2.5 rounded-full ring-1 ring-white/60"
                      style={{ backgroundColor: pageSentiment.swatchHex }}
                    />
                    <span>{ar ? pageSentiment.label.ar : pageSentiment.label.en}</span>
                  </div>
                  <div className="flex items-center gap-1 rounded-full bg-black/55 px-3 py-1 text-xs font-medium text-white backdrop-blur-xs">
                    <Sparkles size={12} className="text-star" />
                    <span>{storyData.story_info.art_style || 'Illustrated'}</span>
                  </div>
                </div>
                <div className="absolute bottom-3 end-3 flex flex-wrap gap-2 z-20">
                  <button
                    type="button"
                    onClick={() =>
                      setMagnifierTarget({
                        src: imageSrc,
                        title: ar
                          ? `مشهد ${page?.page || pageIndex + 1} — ${storyData.story_info.title}`
                          : `Scene ${page?.page || pageIndex + 1} — ${storyData.story_info.title}`,
                        pageText: page?.text,
                        scenePrompt: page?.image_prompt,
                      })
                    }
                    className="flex min-h-11 items-center gap-1.5 rounded-full bg-lantern px-3.5 text-xs font-extrabold text-ink shadow-sm transition hover:brightness-105 active:scale-95"
                    title={ar ? 'تكبير الصورة وفحص تفاصيل الشخصيات والخلفية بعدسة HD' : 'Zoom & inspect character and background details with HD loupe'}
                  >
                    <ZoomIn size={15} />
                    <span>{ar ? 'تكبير وفحص التفاصيل' : 'Zoom & Inspect'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => illustrator.retryPage(page.page, true)}
                    disabled={page.isGeneratingImage}
                    className="flex h-11 w-11 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur-xs transition hover:bg-black/75 active:scale-95 disabled:opacity-50"
                    title={ar ? 'أعد رسم المشهد' : 'Repaint scene'}
                    aria-label={ar ? 'أعد رسم المشهد' : 'Repaint scene'}
                  >
                    {page.isGeneratingImage ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMismatchText(page?.correctionNote ?? '');
                      setShowMismatchInput((v) => !v);
                    }}
                    className="flex min-h-11 items-center gap-1.5 rounded-full bg-black/65 px-3.5 text-xs font-bold text-amber-200 shadow-sm backdrop-blur-xs transition hover:bg-black/85 active:scale-95"
                    title={ar ? 'الصورة لا تطابق المشهد؟ صحّحها بسطر واحد' : 'Image does not match? Add a correction'}
                  >
                    <MessageSquareWarning size={14} />
                    <span>{ar ? 'الصورة لا تطابق' : 'Image Mismatch'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode('gallery')}
                    className="flex min-h-11 items-center gap-1.5 rounded-full bg-black/55 px-3.5 text-xs font-semibold text-white shadow-sm backdrop-blur-xs transition hover:bg-black/75 active:scale-95"
                    title={ar ? 'عرض في المعرض الكامل' : 'Open in Gallery'}
                  >
                    <Images size={13} />
                    <span>{ar ? 'المعرض' : 'Gallery'}</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="relative flex aspect-[4/3] w-full flex-col items-center justify-center gap-3 bg-dream/10 p-6 text-center">
                {page?.isGeneratingImage || (illustrator.running && !page?.imageError) ? (
                  <>
                    <div className="absolute inset-0 animate-pulse bg-gradient-to-br from-dream/20 via-star/10 to-dream/20" />
                    <Loader2 size={32} className="relative animate-spin text-lantern" />
                    <p className="relative font-display text-sm text-ink/70 dark:text-moonlight/70">{ar ? 'نرسم المشهد بالذكاء الاصطناعي...' : 'Painting illustration with AI...'}</p>
                  </>
                ) : (
                  <>
                    <Wand2 size={28} className="text-dream" />
                    <button
                      type="button"
                      onClick={() => illustrator.retryPage(page.page)}
                      className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-lantern px-5 text-xs font-bold text-ink shadow-sm transition hover:brightness-105 active:scale-95"
                    >
                      <Sparkles size={14} />
                      <span>{ar ? 'ارسم هذا المشهد' : 'Paint Illustration'}</span>
                    </button>
                  </>
                )}
              </div>
            )}

            <div className="p-5" dir={ar ? 'rtl' : 'ltr'}>
              {/* ب5: حقل تصحيح الصورة عند ضغط «الصورة لا تطابق» */}
              {showMismatchInput && page && (
                <div className="mb-4 flex flex-wrap items-center gap-2 rounded-2xl border border-lantern/45 bg-lantern/10 p-3">
                  <input
                    type="text"
                    value={mismatchText}
                    onChange={(e) => setMismatchText(e.target.value.slice(0, 160))}
                    placeholder={ar ? 'ما الخطأ؟ (مثلاً: القطة يجب أن تكون بيضاء)' : 'What is wrong? (e.g., The cat should be white)'}
                    className="min-h-10 flex-1 rounded-xl border border-dream/35 bg-white px-3 text-xs text-ink outline-none focus:border-lantern dark:border-white/15 dark:bg-black/40 dark:text-moonlight"
                  />
                  <button
                    type="button"
                    disabled={!mismatchText.trim() || page.isGeneratingImage}
                    onClick={() => {
                      const note = mismatchText.trim();
                      setShowMismatchInput(false);
                      illustrator.retryPage(page.page, true, undefined, note);
                    }}
                    className="inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-lantern px-4 text-xs font-extrabold text-ink shadow-xs transition active:scale-95 disabled:opacity-50"
                  >
                    <RefreshCw size={13} />
                    <span>{ar ? 'أعد الرسم بالتصحيح' : 'Repaint with Correction'}</span>
                  </button>
                </div>
              )}

              {/* شريط الراوي */}
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-dream/20 bg-dream/5 px-3 py-2 dark:bg-white/5">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="w-56 sm:w-64">
                    <LuxurySelect<NarratorVoice>
                      ar={ar}
                      value={narration.voice}
                      onChange={narration.setVoice}
                      searchable={false}
                      options={VOICE_OPTIONS.map((v): LuxuryOption<NarratorVoice> => ({
                        value: v.value,
                        label: ar ? v.label.ar : v.label.en,
                        icon: <Volume2 size={15} className={narration.status === 'playing' ? 'animate-pulse text-lantern' : 'text-lantern'} />,
                      }))}
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() => setShowVoiceCloner(true)}
                    className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-lantern/40 bg-lantern/15 hover:bg-lantern/25 px-3.5 py-1 text-xs font-bold text-ink transition active:scale-95 dark:text-moonlight"
                    title={ar ? 'مطابقة أقرب صوت راوٍ جاهز لطبقة صوتك' : 'Match closest prebuilt AI voice to your vocal pitch'}
                  >
                    <AudioWaveform size={14} className="text-lantern" />
                    <span>{ar ? 'مطابقة نبرة صوتك' : 'Match Voice Pitch'}</span>
                  </button>

                  {narration.voice === 'ClonedVoice' && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 px-2.5 py-1 text-[11px] font-bold">
                      <Sparkles size={12} />
                      <span>{ar ? 'الراوي المطابق لنبرتك نشط' : 'Pitch-Matched Voice Active'}</span>
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-1.5">
                  {narration.status === 'loading' ? (
                    <span className="inline-flex min-h-11 items-center gap-1.5 px-3 text-xs font-semibold text-ink/70 dark:text-moonlight/70">
                      <Loader2 size={14} className="animate-spin text-lantern" />
                      {ar ? 'نجهّز الصوت...' : 'Preparing voice...'}
                    </span>
                  ) : narration.status === 'idle' ? (
                    <>
{narration.voice !== 'Family' && (
                      <button
                        type="button"
                        onClick={narration.regenerate}
                        className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-dream/40 text-ink transition hover:border-lantern active:scale-95 dark:text-moonlight"
                        title={ar ? 'أعد توليد صوت هذه الصفحة' : 'Regenerate this page voice'}
                        aria-label={ar ? 'أعد توليد صوت هذه الصفحة' : 'Regenerate this page voice'}
                      >
                        <RefreshCw size={14} />
                      </button>
)}
                      <button type="button" onClick={() => narration.play(false)} className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-lantern px-4 text-xs font-semibold text-ink shadow-xs transition hover:brightness-105 active:scale-95">
                        <Play size={13} fill="currentColor" />
                        <span>{ar ? 'استمع' : 'Listen'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => narration.play(true)}
                        className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-dream/40 px-3.5 text-xs font-semibold text-ink transition hover:border-lantern dark:text-moonlight"
                        title={ar ? 'اقرأ القصة كاملة' : 'Read the whole story'}
                      >
                        <ListMusic size={14} />
                        <span>{ar ? 'القصة كاملة' : 'Whole story'}</span>
                      </button>
                    </>
                  ) : (
                    <>
                      {narration.status === 'paused' ? (
                        <button type="button" onClick={() => narration.play(narration.continuous)} className="inline-flex min-h-11 items-center gap-1 rounded-full bg-lantern px-3.5 text-xs font-semibold text-ink shadow-xs" aria-label={ar ? 'استئناف' : 'Resume'}>
                          <Play size={13} fill="currentColor" />
                          <span>{ar ? 'استئناف' : 'Resume'}</span>
                        </button>
                      ) : (
                        <button type="button" onClick={narration.pause} className="inline-flex min-h-11 items-center gap-1 rounded-full border border-dream/40 bg-white/70 px-3.5 text-xs font-semibold text-ink dark:bg-white/10 dark:text-moonlight" aria-label={ar ? 'إيقاف مؤقت' : 'Pause'}>
                          <Pause size={13} />
                          <span>{ar ? 'مؤقت' : 'Pause'}</span>
                        </button>
                      )}
                      <button type="button" onClick={narration.stop} className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-coral/40 bg-coral/10 text-coral" aria-label={ar ? 'إيقاف' : 'Stop'}>
                        <Square size={12} fill="currentColor" />
                      </button>
                    </>
                  )}
                </div>
                <SleepMode ar={ar} narration={narration} />
                {narration.voice === 'Family' && <FamilyRecorder ar={ar} storyId={storyData.id} pageNo={page.page} onSaved={narration.stop} />}
                {narration.error && (
                  <div className="w-full">
                    <p className="text-xs text-coral">{narration.error}</p>
                    <ErrorDetails ar={ar} />
                  </div>
                )}
              </div>

              {page?.chapter && (
                <p className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-dream/15 px-3 py-1 font-display text-xs font-bold text-dream">
                  <BookOpen size={12} aria-hidden />
                  {page.chapter}
                </p>
              )}

              {/* نص الصفحة مع تظليل الكلمة المنطوقة */}
              <p className="text-base leading-relaxed text-ink sm:text-lg sm:leading-loose dark:text-moonlight">
                {narrating
                  ? words.map((w, i) => (
                      <span
                        key={i}
                        className={`rounded-md transition-colors duration-150 ${
                          i === narration.wordIndex ? 'bg-lantern/35 text-ink dark:text-moonlight' : i < narration.wordIndex ? 'text-ink dark:text-moonlight' : 'text-ink/55 dark:text-moonlight/55'
                        }`}
                      >
                        {w}{' '}
                      </span>
                    ))
                  : page?.text}
              </p>
            </div>
          </div>

          {/* Page Navigation */}
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => setPageIndex((i) => Math.max(0, i - 1))}
              disabled={pageIndex === 0}
              className="flex h-11 w-11 items-center justify-center rounded-full border border-dream/30 text-ink transition hover:border-lantern focus-visible:outline focus-visible:outline-2 focus-visible:outline-lantern disabled:opacity-30 dark:text-moonlight"
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
              disabled={isLast}
              className="flex h-11 w-11 items-center justify-center rounded-full border border-dream/30 text-ink transition hover:border-lantern focus-visible:outline focus-visible:outline-2 focus-visible:outline-lantern disabled:opacity-30 dark:text-moonlight"
              aria-label={ar ? 'الصفحة التالية' : 'Next page'}
            >
              {ar ? <ChevronLeft size={20} /> : <ChevronRight size={20} />}
            </button>
          </div>

          {page && <PageTools story={storyData} page={page} index={pageIndex} ar={ar} onPaint={illustrator.retryPage} />}

          {/* مسارات المغامرة والقصة التفاعلية */}
          {isLast && !more.incomplete && (
            <InteractiveBranches
              ar={ar}
              storyData={storyData}
              onChooseBranch={handleChooseBranch}
              disabled={more.running}
            />
          )}

          {isLast && !more.incomplete && <QuizCard key={storyData.id} storyData={storyData} ar={ar} onScore={(score) => {
            onStoryChange((s) => ({ ...s, quizScore: score }));
            recordGame('story-quiz', score, storyData.quiz?.length ?? 3);
          }} />}

          {isLast && !more.incomplete && onNextPart && (
            <button
              type="button"
              onClick={() => onNextPart(storyData)}
              className="flex w-full items-center gap-3 rounded-3xl border border-dream/30 bg-white/60 p-4 text-start transition active:scale-[0.99] dark:bg-white/5"
            >
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-dream/20 text-dream">
                <Layers size={22} aria-hidden />
              </span>
              <span className="min-w-0 flex-1" dir={ar ? 'rtl' : 'ltr'}>
                <span className="block font-display text-sm font-bold text-ink dark:text-moonlight">{ar ? 'ابدأ الجزء التالي' : 'Start the next part'}</span>
                <span className="block text-xs text-ink/60 dark:text-moonlight/60">{ar ? 'نفس الشخصيات ونفس الوجوه بمغامرة جديدة تكمل ما سبق' : 'Same characters and faces in a new adventure'}</span>
              </span>
            </button>
          )}

          {isLast && !more.incomplete && onNavigate && (
            <div className="grid grid-cols-2 gap-3" dir={ar ? 'rtl' : 'ltr'}>
              <button type="button" onClick={() => onNavigate('learn')} className="flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-dream/30 bg-white/60 text-xs font-semibold text-ink dark:bg-white/5 dark:text-moonlight">
                <BookOpen size={16} aria-hidden />
                {ar ? 'تعلّم المزيد' : 'Learn more'}
              </button>
              <button type="button" onClick={() => onNavigate('games')} className="flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-dream/30 bg-white/60 text-xs font-semibold text-ink dark:bg-white/5 dark:text-moonlight">
                <Sparkles size={16} aria-hidden />
                {ar ? 'العب واجمع النجوم' : 'Play & earn stars'}
              </button>
            </div>
          )}

          {/* فيديو القصة */}
          <button
            type="button"
            onClick={() => setShowVideo(true)}
            className="group flex w-full items-center gap-3 rounded-3xl border border-lantern/40 bg-gradient-to-br from-dusk to-[#3a2a6b] p-4 text-start text-white shadow-md transition active:scale-[0.99]"
          >
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-lantern text-ink shadow-lg shadow-lantern/30">
              <Clapperboard size={22} aria-hidden />
            </span>
            <span className="min-w-0 flex-1" dir={ar ? 'rtl' : 'ltr'}>
              <span className="block font-display text-sm font-bold">{ar ? 'تحميل فيديو القصة' : 'Download story video'}</span>
              <span className="block text-xs text-white/70">
                {allDrawn
                  ? ar
                    ? 'صور متحركة + صوت الراوي + نص متزامن + موسيقى'
                    : 'Moving pictures + narration + synced text + music'
                  : ar
                  ? `بانتظار اكتمال الرسم (${illustratedCount}/${storyData.pages.length})`
                  : `Waiting for pictures (${illustratedCount}/${storyData.pages.length})`}
              </span>
            </span>
          </button>

          <ShareMenu story={storyData} ar={ar} />

          {/* PDF */}
          <div className="luxury-card p-4 sm:p-5 space-y-3.5">
            <div className="flex flex-col items-stretch justify-between gap-3 sm:flex-row sm:items-center">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-lantern/20 text-lantern">
                  <FileText size={22} />
                </div>
                <div>
                  <h3 className="font-display text-sm font-semibold text-ink dark:text-moonlight">{ar ? 'كتاب القصة الكامل (PDF)' : 'Storybook Edition (PDF)'}</h3>
                  <p className="text-xs text-ink/60 dark:text-moonlight/60">{ar ? 'اختر القالب الملكي لتصدير القصة بجودة طباعة فاخرة' : 'Choose your luxury template for print-ready PDF export'}</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={busyAction !== null}
                  onClick={handleExportPDF}
                  className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-2xl bg-lantern px-5 font-display text-sm font-bold text-ink shadow-sm transition hover:brightness-105 active:scale-95 disabled:opacity-50 sm:flex-none"
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
                  onClick={() => window.print()}
                  title={ar ? 'طباعة مباشرة' : 'Print directly'}
                  className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-dream/30 bg-white/70 text-ink transition hover:border-lantern dark:bg-white/10 dark:text-moonlight"
                >
                  <Printer size={18} />
                </button>
              </div>
            </div>

            <div className="pt-2 border-t border-dream/20 dark:border-white/10">
              <LuxurySelect<PDFPreset>
                ar={ar}
                label={ar ? 'قالب وتصميم كتاب PDF (.pdf-classic / .pdf-modern / .pdf-minimal)' : 'PDF Book Layout Template'}
                value={pdfPreset}
                onChange={setPdfPreset}
                searchable={false}
                options={[
                  {
                    value: 'storybook',
                    label: ar ? 'القالب الكلاسيكي الفاخر (.pdf-classic)' : 'Classic Royal Storybook (.pdf-classic)',
                    sublabel: ar ? 'إطار ذهبي مزدوج وخط أميري أصيل مع غلاف كامل' : 'Double gold frame, serif typography & full cover',
                    badge: ar ? 'موصى به' : 'Classic',
                    icon: <BookOpen size={15} className="text-lantern" />,
                  },
                  {
                    value: 'minimalist',
                    label: ar ? 'القالب العصري الحديث (.pdf-modern)' : 'Modern Editorial Picture Book (.pdf-modern)',
                    sublabel: ar ? 'مساحات بيضاء أنيقة وتركيز بصري واسع على اللوحات' : 'Clean modern layout with large visual focus',
                    badge: 'Modern',
                    icon: <Sparkles size={15} className="text-lantern" />,
                  },
                  {
                    value: 'collector',
                    label: ar ? 'نسخة المقتنين البسيطة والشاملة (.pdf-minimal)' : 'Minimal Collector Edition (.pdf-minimal)',
                    sublabel: ar ? 'تصميم هادئ يشمل بطاقة الشخصيات الكاملة' : 'Refined minimal design with character showcase page',
                    badge: 'Collector',
                    icon: <FileText size={15} className="text-lantern" />,
                  },
                ]}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <button
              type="button"
              data-testid="open-print-preview-btn"
              onClick={() => setShowPrintPreview(true)}
              className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl border border-lantern bg-lantern/20 px-4 text-sm font-extrabold text-ink transition-opacity hover:opacity-95 dark:text-amber-200"
            >
              <Printer size={16} className="text-lantern shrink-0" aria-hidden />
              <span>{ar ? 'معاينة الطباعة (A5 / A4 / مربع 21×21)' : 'Print Preview (A5 / A4 / 21×21)'}</span>
            </button>

            <button
              type="button"
              disabled={busyAction !== null}
              onClick={() => runAction('print', async () => {
                setExportProgress(ar ? 'نجهّز ملف المطبعة...' : 'Preparing print file...');
                try {
                  await exportPrintBook(storyData, setExportProgress);
                } finally {
                  setExportProgress(null);
                }
              })}
              className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl border border-lantern/40 bg-lantern/10 px-4 text-sm font-semibold text-ink transition hover:brightness-105 active:scale-[0.99] disabled:opacity-50 dark:text-moonlight"
            >
              {busyAction === 'print' ? <Loader2 size={16} className="animate-spin" aria-hidden /> : <Download size={16} aria-hidden />}
              <span>{busyAction === 'print' ? exportProgress || (ar ? 'جارٍ التجهيز...' : 'Preparing...') : ar ? 'تصدير سريع للمطبعة A5 (3 مم)' : 'Quick Print A5 (3 mm bleed)'}</span>
            </button>
          </div>

          <details className="rounded-2xl border border-dream/20 bg-white/50 p-4 dark:bg-white/5" dir={ar ? 'rtl' : 'ltr'}>
            <summary className="flex cursor-pointer items-center justify-between gap-2 font-display text-sm font-semibold text-ink dark:text-moonlight">
              <span className="flex items-center gap-2">
                <Users size={16} aria-hidden />
                {ar ? 'الشخصيات (مع إمكانية الحفظ في ألبومي)' : 'Characters (Save to My Album)'}
              </span>
            </summary>
            <ul className="mt-3 space-y-2.5">
              {storyData.characters.map((c) => {
                const isSaved = Boolean(savedAlbumNames[c.name]);
                return (
                  <li key={c.name} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-dream/15 bg-white/60 p-2.5 text-sm text-ink/80 dark:bg-white/5 dark:text-moonlight/80">
                    <div className="min-w-0 flex-1">
                      <span className="font-semibold text-ink dark:text-moonlight">{c.name}</span> — {c.personality || c.description}
                    </div>
                    <button
                      type="button"
                      onClick={async () => {
                        await saveAlbumCharacter({
                          name: c.name,
                          description: c.description,
                          personality: c.personality,
                          age: c.age,
                          gender: c.gender,
                          referenceImageId: storyData.characterSheetId || storyData.coverImageId || storyData.pages[0]?.imageId,
                        });
                        setSavedAlbumNames((prev) => ({ ...prev, [c.name]: true }));
                      }}
                      className="inline-flex min-h-8 shrink-0 items-center gap-1 rounded-full border border-lantern/45 bg-lantern/15 px-3 py-1 text-xs font-bold text-ink transition hover:bg-lantern/25 dark:text-amber-200"
                    >
                      {isSaved ? <Check size={13} className="text-emerald-500" /> : <BookmarkPlus size={13} className="text-lantern" />}
                      <span>{isSaved ? (ar ? 'محفوظة في ألبومي' : 'Saved in Album') : ar ? 'احفظ في ألبومي' : 'Save to Album'}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </details>

          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              disabled={busyAction !== null}
              onClick={() => runAction('zip', () => exportImagesAsZip(storyData))}
              className="flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-dream/30 bg-white/50 text-xs font-medium text-ink transition hover:border-lantern disabled:opacity-50 dark:bg-white/5 dark:text-moonlight"
            >
              <Download size={16} aria-hidden />
              <span>{busyAction === 'zip' ? (ar ? 'جارٍ التجهيز...' : 'Preparing...') : ar ? 'تنزيل الصور (ZIP)' : 'Download Images (ZIP)'}</span>
            </button>
            <button
              type="button"
              disabled={busyAction !== null}
              onClick={() => runAction('json', () => saveStoryAsJSON(storyData))}
              className="flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-dream/30 bg-white/50 text-xs font-medium text-ink transition hover:border-lantern disabled:opacity-50 dark:bg-white/5 dark:text-moonlight"
            >
              <FileJson size={16} aria-hidden />
              <span>{busyAction === 'json' ? (ar ? 'جارٍ الحفظ...' : 'Saving...') : ar ? 'نسخة احتياطية (JSON)' : 'Save Story (JSON)'}</span>
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              disabled={busyAction !== null}
              onClick={() => runAction('package', () => exportBundle(storyData, 'package', setExportProgress).finally(() => setExportProgress(null)))}
              className="flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-dream/30 bg-white/50 px-2 text-xs font-medium text-ink transition hover:border-lantern disabled:opacity-50 dark:bg-white/5 dark:text-moonlight"
            >
              {busyAction === 'package' ? <Loader2 size={16} className="animate-spin" aria-hidden /> : <Package size={16} aria-hidden />}
              <span>{busyAction === 'package' ? exportProgress || (ar ? 'جارٍ التجهيز...' : 'Preparing...') : ar ? 'حزمة القصة الكاملة (ZIP)' : 'Full story package (ZIP)'}</span>
            </button>
            <button
              type="button"
              disabled={busyAction !== null}
              onClick={() => runAction('anim', () => exportBundle(storyData, 'animation', setExportProgress).finally(() => setExportProgress(null)))}
              className="flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-dream/30 bg-white/50 px-2 text-xs font-medium text-ink transition hover:border-lantern disabled:opacity-50 dark:bg-white/5 dark:text-moonlight"
            >
              {busyAction === 'anim' ? <Loader2 size={16} className="animate-spin" aria-hidden /> : <Film size={16} aria-hidden />}
              <span>{busyAction === 'anim' ? exportProgress || (ar ? 'جارٍ التجهيز...' : 'Preparing...') : ar ? 'حزمة التحريك (Veo / Flow)' : 'Animation pack (Veo / Flow)'}</span>
            </button>
          </div>

          {actionError && <p className="text-sm text-coral">{actionError}</p>}

          <button type="button" onClick={onStartOver} className="mx-auto flex min-h-11 items-center gap-2 text-sm font-medium text-ink/60 underline-offset-4 hover:underline dark:text-moonlight/60">
            <RotateCcw size={14} aria-hidden />
            {ar ? 'قصة جديدة' : 'Start a new story'}
          </button>
        </>
      )}

      {showVideo && (
        <Suspense fallback={null}>
          <VideoExportSheet storyData={storyData} ar={ar} voice={narration.voice} onClose={() => setShowVideo(false)} />
        </Suspense>
      )}

      {show3DViewer && (
        <Book3DViewer
          storyData={storyData}
          ar={ar}
          onClose={() => setShow3DViewer(false)}
        />
      )}

      {showFlipbook && (
        <InteractiveBookReader
          storyData={storyData}
          language={language}
          onClose={() => setShowFlipbook(false)}
          onDownloadPDFWithPreset={handleExportPDFWithPreset}
        />
      )}

      {showClassicFlipbook && (
        <InteractiveFlipbook
          storyData={storyData}
          ar={ar}
          onClose={() => setShowClassicFlipbook(false)}
          onDownloadPDF={handleExportPDF}
        />
      )}

      {showVoiceCloner && (
        <VoiceClonerModal
          language={language}
          onVoiceSelected={(v) => narration.setVoice(v)}
          onClose={() => setShowVoiceCloner(false)}
        />
      )}

      {showPrintPreview && (
        <PrintPreviewModal
          story={storyData}
          ar={ar}
          onClose={() => setShowPrintPreview(false)}
          onStoryUpdated={(updated) => onStoryChange(() => updated)}
        />
      )}

      {magnifierTarget && (
        <ImageMagnifierModal
          src={magnifierTarget.src}
          title={magnifierTarget.title}
          pageText={magnifierTarget.pageText}
          scenePrompt={magnifierTarget.scenePrompt}
          artStyle={storyData.story_info.art_style}
          styleConsistency={storyData.styleConsistency || storyData.story_info.styleConsistency}
          ar={ar}
          onClose={() => setMagnifierTarget(null)}
        />
      )}

      <PrintableStory storyData={storyData} images={allImages} containerId={printableContainerId} />
    </div>
  );
}
