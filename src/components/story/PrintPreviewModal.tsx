import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  Download,
  Loader2,
  Printer,
  RefreshCw,
  Ruler,
  Scissors,
  X,
} from 'lucide-react';
import { StoryData, StoryPage } from '../../types';
import { BRAND, CONFIG } from '../../config';
import {
  computeImageEffectiveDpi,
  computePrintPageDimensionsMm,
  computePrintPageMarginsMm,
  DEFAULT_PRINT_OPTIONS,
  PRINT_MARGIN_PRESETS_MM,
  PRINT_TRIM_SIZES_MM,
  type PrintBookOptions,
  type PrintMarginPreset,
  type PrintPageSize,
} from '../../services/printBook';
import { getImage, objectUrlFor, reencode, saveImage, srcToBlob } from '../../services/media';
import { exportPrintBook } from '../../services/export';
import { buildPageImagePrompt } from '../../services/gemini';
import { generateIllustration } from '../../services/imageEngine';
import { saveStory } from '../../services/library';

interface PrintPreviewModalProps {
  story: StoryData;
  ar: boolean;
  onClose: () => void;
  onStoryUpdated?: (updated: StoryData) => void;
}

interface PageImageMeta {
  url: string;
  width: number;
  height: number;
}

const measureImageBlob = async (blob: Blob, id: string): Promise<PageImageMeta> => {
  const url = objectUrlFor(id, blob);
  if (typeof createImageBitmap === 'function') {
    try {
      const bmp = await createImageBitmap(blob);
      const w = bmp.width;
      const h = bmp.height;
      bmp.close();
      return { url, width: w, height: h };
    } catch {
      // fallback to Image element
    }
  }
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ url, width: img.naturalWidth || 1024, height: img.naturalHeight || 1024 });
    img.onerror = () => resolve({ url, width: 1024, height: 1024 });
    img.src = url;
  });
};

export default function PrintPreviewModal({ story: initialStory, ar, onClose, onStoryUpdated }: PrintPreviewModalProps) {
  const [story, setStory] = useState<StoryData>(initialStory);
  const [pageSize, setPageSize] = useState<PrintPageSize>(DEFAULT_PRINT_OPTIONS.pageSize);
  const [marginPreset, setMarginPreset] = useState<PrintMarginPreset>(DEFAULT_PRINT_OPTIONS.marginPreset);
  const [bleedEnabled, setBleedEnabled] = useState<boolean>(DEFAULT_PRINT_OPTIONS.bleedEnabled);
  const [cropMarks, setCropMarks] = useState<boolean>(DEFAULT_PRINT_OPTIONS.cropMarks);
  const [showPageNumbers, setShowPageNumbers] = useState<boolean>(DEFAULT_PRINT_OPTIONS.showPageNumbers);
  const [includeCovers, setIncludeCovers] = useState<boolean>(DEFAULT_PRINT_OPTIONS.includeCovers);
  // إيقاف افتراضياً للطباعة
  const [watermarkEnabled, setWatermarkEnabled] = useState<boolean>(false);

  const [imageMetas, setImageMetas] = useState<Record<string, PageImageMeta>>({});
  const [coverMeta, setCoverMeta] = useState<PageImageMeta | null>(null);
  const [regeneratingPage, setRegeneratingPage] = useState<number | null>(null);
  const [exporting, setExporting] = useState<boolean>(false);
  const [exportProgress, setExportProgress] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const [exportDone, setExportDone] = useState<boolean>(false);

  const isRtlStory = /arab|عرب/i.test(story.story_info.language ?? '');
  const baseMarginMm = PRINT_MARGIN_PRESETS_MM[marginPreset];
  const dims = useMemo(() => computePrintPageDimensionsMm(pageSize, bleedEnabled), [pageSize, bleedEnabled]);

  // تحميل الصور الكاملة المحفوظة بـ 2048px من IndexedDB مباشرة
  useEffect(() => {
    let alive = true;
    const loadFullResImages = async () => {
      // الغلاف
      const coverId = story.coverImageId ?? story.pages[0]?.imageId;
      if (coverId) {
        const storedCover = await getImage(coverId);
        if (alive && storedCover?.blob) {
          setCoverMeta(await measureImageBlob(storedCover.blob, `print-cover-${coverId}`));
        }
      } else if (story.coverImage) {
        try {
          const b = await srcToBlob(story.coverImage);
          if (alive) setCoverMeta(await measureImageBlob(b, `print-cover-fallback`));
        } catch {
          // ignore
        }
      }

      // صفحات القصة
      const metas: Record<string, PageImageMeta> = {};
      for (const p of story.pages) {
        const key = String(p.page);
        if (p.imageId) {
          const rec = await getImage(p.imageId);
          if (rec?.blob) {
            metas[key] = await measureImageBlob(rec.blob, `print-page-${p.imageId}`);
            continue;
          }
        }
        if (p.generatedImage) {
          try {
            const b = await srcToBlob(p.generatedImage);
            metas[key] = await measureImageBlob(b, `print-page-fallback-${p.page}`);
          } catch {
            // ignore
          }
        }
      }
      if (alive) setImageMetas(metas);
    };
    loadFullResImages();
    return () => {
      alive = false;
    };
  }, [story]);

  // فحص دقة كل صفحة مقابل المقاس المختار (الصورة تحتل عرض الصفحة × 56% من الارتفاع)
  const pageDpiMap = useMemo(() => {
    const map: Record<number, number> = {};
    const imgHeightMm = dims.totalHeightMm * 0.56;
    for (const p of story.pages) {
      const meta = imageMetas[String(p.page)];
      if (meta) {
        map[p.page] = computeImageEffectiveDpi(meta.width, meta.height, dims.totalWidthMm, imgHeightMm);
      }
    }
    return map;
  }, [story.pages, imageMetas, dims]);

  const lowDpiPages = useMemo(
    () => story.pages.filter((p) => pageDpiMap[p.page] !== undefined && pageDpiMap[p.page] < 150),
    [story.pages, pageDpiMap]
  );

  // إعادة توليد صورة الصفحة بدقة عالية 2048px وحفظها في IndexedDB
  const handleRegenerateHighResPage = async (page: StoryPage) => {
    if (regeneratingPage !== null) return;
    setRegeneratingPage(page.page);
    setExportError(null);
    try {
      const prompt = buildPageImagePrompt(story, page);
      const rawBlob = await generateIllustration({
        prompt,
        aspectRatio: story.story_info.aspect_ratio || '4:3',
        kind: `page-${page.page}-hires`,
        artStyle: story.story_info.art_style,
      });
      const hiResBlob = await reencode(rawBlob, CONFIG.IMAGE_MAX_DIM, 'image/webp', 0.92);
      const saved = await saveImage(hiResBlob, 'page', story.story_info.art_style, page.image_prompt);
      const updatedStory: StoryData = {
        ...story,
        pages: story.pages.map((p) =>
          p.page === page.page ? { ...p, imageId: saved.id, generatedImage: saved.url } : p
        ),
      };
      setStory(updatedStory);
      await saveStory(updatedStory);
      onStoryUpdated?.(updatedStory);
    } catch (err) {
      setExportError((err as Error).message);
    } finally {
      setRegeneratingPage(null);
    }
  };

  const handleExportPdf = async () => {
    setExporting(true);
    setExportError(null);
    setExportDone(false);
    setExportProgress(ar ? 'نجهّز ملف الطباعة...' : 'Preparing print PDF...');
    const options: PrintBookOptions = {
      pageSize,
      marginPreset,
      marginMm: baseMarginMm,
      bleedEnabled,
      cropMarks,
      showPageNumbers,
      includeCovers,
      watermarkEnabled,
    };
    try {
      await exportPrintBook(story, setExportProgress, options);
      setExportDone(true);
      setTimeout(() => setExportDone(false), 3500);
    } catch (err) {
      setExportError((err as Error).message);
    } finally {
      setExporting(false);
      setExportProgress(null);
    }
  };

  // تجميع الصفحات في أزواج مزدوجة (Spreads) مع مراعاة اتجاه التجليد العربي RTL
  const pageSpreads = useMemo(() => {
    const spreads: StoryPage[][] = [];
    for (let i = 0; i < story.pages.length; i += 2) {
      spreads.push(story.pages.slice(i, i + 2));
    }
    return spreads;
  }, [story.pages]);

  const aspectRatioCss = `${dims.totalWidthMm} / ${dims.totalHeightMm}`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-2.5 sm:p-5 backdrop-blur-xs"
      dir={ar ? 'rtl' : 'ltr'}
      role="dialog"
      aria-modal="true"
      aria-labelledby="print-preview-title"
    >
      <div className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-3xl border border-dream/30 bg-moonlight text-ink shadow-2xl dark:border-white/15 dark:bg-dusk dark:text-moonlight">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 border-b border-dream/20 px-4 py-3 sm:px-6 dark:border-white/10">
          <div className="flex items-center gap-2.5">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-lantern/20 text-lantern">
              <Printer size={20} aria-hidden />
            </span>
            <div>
              <h2 id="print-preview-title" className="font-display text-base sm:text-lg font-extrabold text-ink dark:text-moonlight">
                {ar ? 'معاينة الطباعة' : 'Print Preview'}
              </h2>
              <p className="text-xs font-semibold text-ink/65 dark:text-moonlight/70">
                {story.story_info.title} · {dims.totalWidthMm}×{dims.totalHeightMm} mm (
                {isRtlStory ? (ar ? 'تجليد عربي RTL' : 'RTL Binding') : ar ? 'تجليد إنجليزي LTR' : 'LTR Binding'})
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-dream/30 bg-white/75 text-ink transition-opacity hover:border-coral dark:border-white/15 dark:bg-white/10 dark:text-moonlight"
            aria-label={ar ? 'إغلاق معاينة الطباعة' : 'Close print preview'}
          >
            <X size={18} aria-hidden />
          </button>
        </div>

        {/* Controls Bar */}
        <div className="border-b border-dream/20 bg-white/70 px-4 py-3 sm:px-6 dark:border-white/10 dark:bg-white/5 space-y-3">
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
            {/* المقاس (A5, A4, Square21) */}
            <div className="space-y-1">
              <span className="flex items-center gap-1.5 text-xs font-extrabold text-ink dark:text-moonlight">
                <Ruler size={14} className="text-lantern" aria-hidden />
                <span>{ar ? 'مقاس الكتاب' : 'Book Size'}</span>
              </span>
              <div className="grid grid-cols-3 gap-1.5">
                {(['A5', 'A4', 'Square21'] as PrintPageSize[]).map((sz) => (
                  <button
                    key={sz}
                    type="button"
                    onClick={() => setPageSize(sz)}
                    className={`min-h-11 rounded-xl border px-2 py-1.5 text-xs font-extrabold transition-opacity ${
                      pageSize === sz
                        ? 'border-lantern bg-lantern text-ink shadow-2xs'
                        : 'border-dream/30 bg-white/80 text-ink hover:border-lantern/60 dark:border-white/15 dark:bg-white/10 dark:text-moonlight'
                    }`}
                  >
                    {sz === 'Square21' ? (ar ? 'مربع 21×21' : '21×21 cm') : sz}
                  </button>
                ))}
              </div>
            </div>

            {/* الهوامش */}
            <div className="space-y-1">
              <span className="flex items-center gap-1.5 text-xs font-extrabold text-ink dark:text-moonlight">
                <BookOpen size={14} className="text-lantern" aria-hidden />
                <span>{ar ? 'الهوامش (مع انعكاس التجليد)' : 'Margins (with Spine Gutter)'}</span>
              </span>
              <div className="grid grid-cols-3 gap-1.5">
                {(
                  [
                    { id: 'compact', ar: 'ضيقة (8مم)', en: 'Compact (8mm)' },
                    { id: 'normal', ar: 'قياسية (12مم)', en: 'Normal (12mm)' },
                    { id: 'wide', ar: 'واسعة (18مم)', en: 'Wide (18mm)' },
                  ] as { id: PrintMarginPreset; ar: string; en: string }[]
                ).map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setMarginPreset(m.id)}
                    className={`min-h-11 rounded-xl border px-2 py-1.5 text-xs font-extrabold transition-opacity ${
                      marginPreset === m.id
                        ? 'border-lantern bg-lantern text-ink shadow-2xs'
                        : 'border-dream/30 bg-white/80 text-ink hover:border-lantern/60 dark:border-white/15 dark:bg-white/10 dark:text-moonlight'
                    }`}
                  >
                    {ar ? m.ar : m.en}
                  </button>
                ))}
              </div>
            </div>

            {/* مفاتيح التشغيل/الإيقاف */}
            <div className="space-y-1">
              <span className="flex items-center gap-1.5 text-xs font-extrabold text-ink dark:text-moonlight">
                <Scissors size={14} className="text-lantern" aria-hidden />
                <span>{ar ? 'خيارات المطبعة' : 'Press Options'}</span>
              </span>
              <div className="flex flex-wrap gap-1.5">
                {[
                  {
                    id: 'bleed',
                    checked: bleedEnabled,
                    toggle: () => setBleedEnabled((v) => !v),
                    ar: 'منطقة القص 3مم (Bleed)',
                    en: '3mm Bleed',
                  },
                  {
                    id: 'crop',
                    checked: cropMarks,
                    toggle: () => setCropMarks((v) => !v),
                    ar: 'علامات القص (Crop Marks)',
                    en: 'Crop Marks',
                  },
                  {
                    id: 'pagenums',
                    checked: showPageNumbers,
                    toggle: () => setShowPageNumbers((v) => !v),
                    ar: 'أرقام الصفحات',
                    en: 'Page Numbers',
                  },
                  {
                    id: 'covers',
                    checked: includeCovers,
                    toggle: () => setIncludeCovers((v) => !v),
                    ar: 'غلاف أمامي وخلفي',
                    en: 'Front & Back Covers',
                  },
                  {
                    id: 'watermark',
                    checked: watermarkEnabled,
                    toggle: () => setWatermarkEnabled((v) => !v),
                    ar: 'العلامة المفرغة',
                    en: 'Hollow Watermark',
                  },
                ].map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    role="switch"
                    aria-checked={opt.checked}
                    onClick={opt.toggle}
                    className={`inline-flex min-h-11 items-center gap-1.5 rounded-xl border px-2.5 py-1 text-[11px] font-extrabold transition-opacity ${
                      opt.checked
                        ? 'border-lantern bg-lantern/20 text-ink dark:text-amber-200'
                        : 'border-dream/30 bg-white/75 text-ink/70 dark:border-white/15 dark:bg-white/5 dark:text-moonlight/70'
                    }`}
                  >
                    <span
                      className={`h-2.5 w-2.5 rounded-full ${
                        opt.checked ? 'bg-emerald-600 dark:bg-emerald-400' : 'bg-stone-400'
                      }`}
                    />
                    <span>{ar ? opt.ar : opt.en}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* تنبيه واضح إن كانت دقة أي صورة أقل من 150 DPI للمقاس المختار */}
          {lowDpiPages.length > 0 && (
            <div
              role="alert"
              className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-amber-600/50 bg-amber-500/15 px-3.5 py-2.5 text-xs font-bold text-ink dark:text-amber-100"
            >
              <div className="flex items-center gap-2">
                <AlertTriangle size={16} className="text-amber-600 dark:text-amber-300 shrink-0" aria-hidden />
                <span>
                  {ar
                    ? `تنبيه دقة الطباعة: يوجد ${lowDpiPages.length} صفحة بدقة أقل من 150 DPI للمقاس (${PRINT_TRIM_SIZES_MM[pageSize].labelAr}). يمكنك إعادة توليدها بدقة 2048px من زر الصفحة أدناه.`
                    : `Print resolution notice: ${lowDpiPages.length} page(s) are under 150 DPI for ${PRINT_TRIM_SIZES_MM[pageSize].labelEn}. Use the button on the page card below to regenerate at 2048px.`}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Vertical Scroll Spreads Preview */}
        <div className="flex-1 space-y-6 overflow-y-auto bg-stone-200/75 p-4 sm:p-6 dark:bg-black/45">
          {/* الغلاف الأمامي والخلفي في المعاينة */}
          {includeCovers && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-extrabold text-ink/75 dark:text-moonlight/80">
                <span>{ar ? 'الغلاف الأمامي والخلفي (أمامي يمين · خلفي يسار في التجليد العربي)' : 'Front & Back Covers'}</span>
                <span className="font-mono text-[11px]">
                  {dims.totalWidthMm}×{dims.totalHeightMm} mm
                </span>
              </div>
              <div
                className="grid grid-cols-1 gap-4 sm:grid-cols-2"
                dir={isRtlStory ? 'rtl' : 'ltr'}
              >
                {/* الغلاف الأمامي */}
                <div
                  style={{ aspectRatio: aspectRatioCss }}
                  className="relative overflow-hidden rounded-xl border border-stone-400/70 bg-[#1b1533] text-white shadow-lg"
                >
                  {(coverMeta?.url || story.coverImage) && (
                    <img
                      src={coverMeta?.url || story.coverImage}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent" />
                  {cropMarks && bleedEnabled && (
                    <div className="pointer-events-none absolute inset-2 border border-dashed border-white/60" />
                  )}
                  <div className="absolute inset-x-0 bottom-0 p-4 text-center space-y-1">
                    <span className="inline-block rounded-md bg-lantern px-2 py-0.5 text-[10px] font-extrabold text-ink">
                      {ar ? 'غلاف أمامي' : 'Front Cover'}
                    </span>
                    <h3 className="font-display text-base sm:text-lg font-extrabold text-white">
                      {story.story_info.title}
                    </h3>
                    <p className="text-[10px] text-white/80">
                      {isRtlStory ? BRAND.author.ar : BRAND.author.en}
                    </p>
                  </div>
                </div>

                {/* الغلاف الخلفي */}
                <div
                  style={{ aspectRatio: aspectRatioCss }}
                  className="relative flex flex-col items-center justify-center overflow-hidden rounded-xl border border-stone-400/70 bg-[#1b1533] p-6 text-center text-white shadow-lg"
                >
                  {cropMarks && bleedEnabled && (
                    <div className="pointer-events-none absolute inset-2 border border-dashed border-white/60" />
                  )}
                  <span className="mb-2 inline-block rounded-md bg-white/15 px-2 py-0.5 text-[10px] font-bold text-amber-200">
                    {ar ? 'غلاف خلفي' : 'Back Cover'}
                  </span>
                  <p className="font-display text-base font-extrabold text-amber-300">
                    {isRtlStory ? BRAND.name.ar : BRAND.name.en}
                  </p>
                  <p className="mt-1 text-xs text-white/80">
                    {isRtlStory ? BRAND.madeIn.ar : BRAND.madeIn.en}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* الأزواج المزدوجة لصفحات الكتاب (Spreads) */}
          {pageSpreads.map((pair, spreadIdx) => (
            <div key={spreadIdx} className="space-y-2">
              <div className="flex items-center justify-between text-xs font-extrabold text-ink/75 dark:text-moonlight/80">
                <span>
                  {ar
                    ? `الزوج المزدوج ${spreadIdx + 1} (${isRtlStory ? 'من اليمين لليسار — RTL' : 'من اليسار لليمين — LTR'})`
                    : `Spread ${spreadIdx + 1} (${isRtlStory ? 'RTL Spread' : 'LTR Spread'})`}
                </span>
                <span className="font-mono text-[11px]">
                  {ar
                    ? `هامش داخلي (كعب): ${baseMarginMm + 6}مم · خارجي: ${baseMarginMm}مم`
                    : `Inner spine: ${baseMarginMm + 6}mm · Outer: ${baseMarginMm}mm`}
                </span>
              </div>

              <div
                className="grid grid-cols-1 gap-0.5 overflow-hidden rounded-2xl border border-stone-400/80 bg-stone-400/60 shadow-xl sm:grid-cols-2"
                dir={isRtlStory ? 'rtl' : 'ltr'}
              >
                {pair.map((p) => {
                  const meta = imageMetas[String(p.page)];
                  const dpi = pageDpiMap[p.page] ?? 300;
                  const isLowDpi = dpi < 150;
                  const margins = computePrintPageMarginsMm(p.page, isRtlStory, baseMarginMm, 6);
                  const padLeftPct = Math.round(((dims.bleedMm + margins.leftMm) / dims.totalWidthMm) * 100);
                  const padRightPct = Math.round(((dims.bleedMm + margins.rightMm) / dims.totalWidthMm) * 100);

                  return (
                    <div
                      key={p.page}
                      data-testid={`print-preview-page-${p.page}`}
                      style={{ aspectRatio: aspectRatioCss }}
                      className="relative flex flex-col justify-between overflow-hidden bg-[#fbf7ef] text-[#241b2f]"
                    >
                      {/* علامات القص في المعاينة */}
                      {cropMarks && bleedEnabled && (
                        <div
                          className="pointer-events-none absolute inset-1.5 z-20 border border-dashed border-stone-700/60"
                          title={ar ? 'حدود القص (Trim Box)' : 'Trim Box'}
                        />
                      )}

                      {/* مؤشر كعب التجليد (Spine Gutter) */}
                      <div
                        className={`pointer-events-none absolute inset-y-0 z-10 w-2 bg-gradient-to-r ${
                          margins.bindingSide === 'right'
                            ? 'right-0 from-transparent to-black/15'
                            : 'left-0 from-black/15 to-transparent'
                        }`}
                      />

                      {/* صورة الصفحة (56% من الارتفاع) */}
                      <div className="relative h-[56%] w-full overflow-hidden bg-stone-200">
                        {meta?.url || p.generatedImage ? (
                          <img
                            src={meta?.url || p.generatedImage}
                            alt=""
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-xs font-bold text-stone-500">
                            {ar ? 'بلا صورة' : 'No illustration'}
                          </div>
                        )}

                        {/* شارة DPI وزر إعادة التوليد بدقة عالية */}
                        <div className="absolute top-2 start-2 end-2 z-20 flex flex-wrap items-center justify-between gap-1.5">
                          <span
                            className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 font-mono text-[10px] font-extrabold shadow-xs ${
                              isLowDpi
                                ? 'bg-amber-600 text-white'
                                : 'bg-black/65 text-emerald-300'
                            }`}
                          >
                            {isLowDpi && <AlertTriangle size={11} aria-hidden />}
                            <span>
                              {dpi} DPI {meta ? `(${meta.width}×${meta.height}px)` : ''}
                            </span>
                          </span>

                          <button
                            type="button"
                            disabled={regeneratingPage !== null}
                            onClick={() => handleRegenerateHighResPage(p)}
                            className="inline-flex min-h-11 items-center gap-1 rounded-xl bg-black/75 px-2.5 py-1 text-[11px] font-extrabold text-amber-200 backdrop-blur-xs transition-opacity hover:bg-lantern hover:text-ink disabled:opacity-50"
                          >
                            {regeneratingPage === p.page ? (
                              <Loader2 size={12} className="animate-spin" aria-hidden />
                            ) : (
                              <RefreshCw size={12} aria-hidden />
                            )}
                            <span>
                              {regeneratingPage === p.page
                                ? ar
                                  ? 'نرسم 2048px...'
                                  : 'Painting 2048px...'
                                : isLowDpi
                                  ? ar
                                    ? 'أعد التوليد بدقة عالية'
                                    : 'Regenerate Hi-Res'
                                  : ar
                                    ? 'تحديث بدقة 2048px'
                                    : 'Refresh 2048px'}
                            </span>
                          </button>
                        </div>
                      </div>

                      {/* نص الصفحة مع الهوامش المنعكسة (الداخلي والخارجي) */}
                      <div
                        className="flex flex-1 flex-col justify-between py-3"
                        style={{
                          paddingLeft: `${padLeftPct}%`,
                          paddingRight: `${padRightPct}%`,
                        }}
                        dir={isRtlStory ? 'rtl' : 'ltr'}
                      >
                        <p className="text-xs sm:text-sm font-bold leading-relaxed text-[#241b2f] line-clamp-5">
                          {p.text}
                        </p>

                        <div className="flex items-center justify-between border-t border-stone-300/80 pt-1.5 text-[10px] font-bold text-[#5d5470]">
                          <span>
                            {ar
                              ? `تجليد: ${margins.bindingSide === 'right' ? 'يمين (داخلي)' : 'يسار (داخلي)'}`
                              : `Spine: ${margins.bindingSide}`}
                          </span>
                          {showPageNumbers && (
                            <span className="font-display text-xs font-extrabold text-[#c98a00]">
                              {p.page}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-dream/20 bg-white/80 px-4 py-3 sm:px-6 dark:border-white/10 dark:bg-black/35">
          <div className="text-xs font-bold text-ink/75 dark:text-moonlight/80">
            {exportError ? (
              <span className="text-coral">{exportError}</span>
            ) : exportProgress ? (
              <span className="text-lantern">{exportProgress}</span>
            ) : (
              <span>
                {ar
                  ? `المقاس النهائي للتصدير: ${dims.totalWidthMm}×${dims.totalHeightMm} مم · العلامة المفرغة: ${watermarkEnabled ? 'مفعّلة' : 'متوقفة للطباعة'}`
                  : `Export size: ${dims.totalWidthMm}×${dims.totalHeightMm} mm · Watermark: ${watermarkEnabled ? 'On' : 'Off for print'}`}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-dream/35 bg-white/80 px-4 py-2 text-xs font-extrabold text-ink dark:border-white/15 dark:bg-white/10 dark:text-moonlight"
            >
              <span>{ar ? 'إغلاق' : 'Close'}</span>
            </button>

            <button
              type="button"
              data-testid="export-print-pdf-btn"
              disabled={exporting}
              onClick={handleExportPdf}
              className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-lantern px-5 py-2 font-display text-xs sm:text-sm font-extrabold text-ink shadow-sm transition-opacity hover:opacity-95 disabled:opacity-50"
            >
              {exporting ? (
                <>
                  <Loader2 size={16} className="animate-spin motion-reduce:animate-none" aria-hidden />
                  <span>{exportProgress || (ar ? 'نصدّر كتاب الطباعة...' : 'Exporting print book...')}</span>
                </>
              ) : exportDone ? (
                <>
                  <CheckCircle2 size={16} className="text-emerald-800" aria-hidden />
                  <span>{ar ? 'تم تصدير ملف الطباعة!' : 'Print PDF Exported!'}</span>
                </>
              ) : (
                <>
                  <Download size={16} aria-hidden />
                  <span>{ar ? 'تصدير PDF للطباعة' : 'Export Print PDF'}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
