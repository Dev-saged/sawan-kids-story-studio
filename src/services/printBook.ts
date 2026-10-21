import { StoryData } from '../types';
import { BRAND } from '../config';
import { getImage, srcToBlob } from './media';
import { applyHollowWatermarkToBlob } from './watermark';

export type PrintPageSize = 'A5' | 'A4' | 'Square21';
export type PrintMarginPreset = 'compact' | 'normal' | 'wide';

export interface PrintBookOptions {
  pageSize?: PrintPageSize;
  marginPreset?: PrintMarginPreset;
  marginMm?: number;
  bleedEnabled?: boolean;
  cropMarks?: boolean;
  showPageNumbers?: boolean;
  includeCovers?: boolean;
  watermarkEnabled?: boolean; // إيقاف افتراضياً للطباعة (false)
}

export const PRINT_TRIM_SIZES_MM: Record<PrintPageSize, { w: number; h: number; labelAr: string; labelEn: string }> = {
  A5: { w: 148, h: 210, labelAr: 'A5 قياسي (148×210 مم)', labelEn: 'A5 Standard (148×210 mm)' },
  A4: { w: 210, h: 297, labelAr: 'A4 كبير (210×297 مم)', labelEn: 'A4 Large (210×297 mm)' },
  Square21: { w: 210, h: 210, labelAr: 'مربع فاخر (21×21 سم)', labelEn: 'Square 21×21 cm (210×210 mm)' },
};

export const PRINT_MARGIN_PRESETS_MM: Record<PrintMarginPreset, number> = {
  compact: 8,
  normal: 12,
  wide: 18,
};

export const DEFAULT_PRINT_OPTIONS: Required<PrintBookOptions> = {
  pageSize: 'A5',
  marginPreset: 'normal',
  marginMm: 12,
  bleedEnabled: true,
  cropMarks: false,
  showPageNumbers: true,
  includeCovers: true,
  watermarkEnabled: false,
};

export interface PrintDimensionsResult {
  trimWidthMm: number;
  trimHeightMm: number;
  bleedMm: number;
  totalWidthMm: number;
  totalHeightMm: number;
}

// ب4: حساب أبعاد الصفحة المليمترية بدقة لكل مقاس مع bleed (3 مم) وبدونه
export const computePrintPageDimensionsMm = (
  pageSize: PrintPageSize = 'A5',
  bleedEnabled = true
): PrintDimensionsResult => {
  const spec = PRINT_TRIM_SIZES_MM[pageSize] ?? PRINT_TRIM_SIZES_MM.A5;
  const bleedMm = bleedEnabled ? 3 : 0;
  return {
    trimWidthMm: spec.w,
    trimHeightMm: spec.h,
    bleedMm,
    totalWidthMm: spec.w + bleedMm * 2,
    totalHeightMm: spec.h + bleedMm * 2,
  };
};

export interface PageMarginsMmResult {
  topMm: number;
  bottomMm: number;
  leftMm: number;
  rightMm: number;
  innerMm: number;
  outerMm: number;
  bindingSide: 'left' | 'right';
}

// ب4: اتجاه التجليد للعربية RTL — الهامش الداخلي (العمود الفقري/التجليد) والخارجي ينعكسان بين الصفحات الفردية والزوجية
export const computePrintPageMarginsMm = (
  pageNumber: number,
  isRtl: boolean,
  baseMarginMm = 12,
  spineGutterExtraMm = 6
): PageMarginsMmResult => {
  const isOdd = Math.abs(Math.floor(pageNumber)) % 2 === 1;
  const innerMm = baseMarginMm + spineGutterExtraMm;
  const outerMm = baseMarginMm;

  // في التجليد العربي (RTL): الصفحة الفردية تكون يمين الكعب (تجليدها من اليمين عند فتح الغلاف أو العكس بالتناوب مع الزوجية)
  // بحيث ينعكس الهامش الداخلي والخارجي تماماً بين الفردية والزوجية، وعكس LTR
  const bindingOnRight = isRtl ? isOdd : !isOdd;
  const rightMm = bindingOnRight ? innerMm : outerMm;
  const leftMm = bindingOnRight ? outerMm : innerMm;

  return {
    topMm: baseMarginMm,
    bottomMm: baseMarginMm,
    leftMm,
    rightMm,
    innerMm,
    outerMm,
    bindingSide: bindingOnRight ? 'right' : 'left',
  };
};

// ب4: حساب الدقة الفعلية (DPI) للصورة بالنسبة لمقاس الطباعة المختار للتنبيه إذا كانت أقل من 150 DPI
export const computeImageEffectiveDpi = (
  imageWidthPx: number,
  imageHeightPx: number,
  printWidthMm: number,
  printHeightMm: number
): number => {
  if (imageWidthPx <= 0 || imageHeightPx <= 0 || printWidthMm <= 0 || printHeightMm <= 0) return 0;
  const widthInches = printWidthMm / 25.4;
  const heightInches = printHeightMm / 25.4;
  const dpiX = imageWidthPx / widthInches;
  const dpiY = imageHeightPx / heightInches;
  return Math.round(Math.min(dpiX, dpiY));
};

// ب4: تحميل الصورة الكاملة الأصلية المحفوظة بدقة 2048px من IndexedDB مباشرة
export const loadFullResBlobForPrint = async (imageId?: string, fallbackSrc?: string): Promise<Blob | null> => {
  if (imageId) {
    const stored = await getImage(imageId);
    if (stored?.blob) return stored.blob;
  }
  if (fallbackSrc) {
    try {
      return await srcToBlob(fallbackSrc);
    } catch {
      return null;
    }
  }
  return null;
};

const PAPER = '#fbf7ef';
const INK = '#241b2f';
const SOFT = '#5d5470';
const GOLD = '#c98a00';
const DUSK = '#1b1533';

type Ctx = CanvasRenderingContext2D;
type Progress = (msg: string) => void;

const lowMemory = () => {
  const mem = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
  return Boolean(mem && mem <= 4);
};

const loadBitmapFromSource = async (
  imageId?: string,
  fallbackSrc?: string,
  watermarkEnabled = false,
  isArabic = true
): Promise<ImageBitmap | null> => {
  try {
    const raw = await loadFullResBlobForPrint(imageId, fallbackSrc);
    if (!raw) return null;
    const processed = watermarkEnabled ? await applyHollowWatermarkToBlob(raw, { isArabic }) : raw;
    return await createImageBitmap(processed);
  } catch {
    return null;
  }
};

// ملء مستطيل بقص مركزي (cover)
const coverFit = (ctx: Ctx, img: ImageBitmap, x: number, y: number, w: number, h: number) => {
  const k = Math.max(w / img.width, h / img.height);
  const sw = w / k;
  const sh = h / k;
  ctx.drawImage(img, (img.width - sw) / 2, (img.height - sh) / 2, sw, sh, x, y, w, h);
};

const wrap = (ctx: Ctx, text: string, maxWidth: number): string[] => {
  const lines: string[] = [];
  for (const para of text.split(/\n+/)) {
    let line = '';
    for (const word of para.split(/\s+/).filter(Boolean)) {
      const next = line ? `${line} ${word}` : word;
      if (line && ctx.measureText(next).width > maxWidth) {
        lines.push(line);
        line = word;
      } else line = next;
    }
    if (line) lines.push(line);
  }
  return lines;
};

// رسم علامات القص (Crop Marks) عند زوايا القطع فقط عندما يكون الخيار مفعّلاً
const drawCropMarksOnCanvas = (ctx: Ctx, W: number, H: number, bleedPx: number, mmPx: number) => {
  if (bleedPx <= 0) return;
  const markLen = Math.max(bleedPx * 0.85, 2.2 * mmPx);
  const offset = Math.max(0.6 * mmPx, 2);
  ctx.save();
  ctx.strokeStyle = 'rgba(36, 27, 47, 0.75)';
  ctx.lineWidth = Math.max(1, 0.25 * mmPx);

  const trimLeft = bleedPx;
  const trimRight = W - bleedPx;
  const trimTop = bleedPx;
  const trimBottom = H - bleedPx;

  ctx.beginPath();
  // Top-left
  ctx.moveTo(0, trimTop);
  ctx.lineTo(Math.max(0, trimLeft - offset), trimTop);
  ctx.moveTo(trimLeft, 0);
  ctx.lineTo(trimLeft, Math.max(0, trimTop - offset));
  // Top-right
  ctx.moveTo(W, trimTop);
  ctx.lineTo(Math.min(W, trimRight + offset), trimTop);
  ctx.moveTo(trimRight, 0);
  ctx.lineTo(trimRight, Math.max(0, trimTop - offset));
  // Bottom-left
  ctx.moveTo(0, trimBottom);
  ctx.lineTo(Math.max(0, trimLeft - offset), trimBottom);
  ctx.moveTo(trimLeft, H);
  ctx.lineTo(trimLeft, Math.min(H, trimBottom + offset));
  // Bottom-right
  ctx.moveTo(W, trimBottom);
  ctx.lineTo(Math.min(W, trimRight + offset), trimBottom);
  ctx.moveTo(trimRight, H);
  ctx.lineTo(trimRight, Math.min(H, trimBottom + offset));
  ctx.stroke();
  void markLen;
  ctx.restore();
};

export const generatePrintBook = async (
  story: StoryData,
  onProgressOrOptions?: Progress | PrintBookOptions,
  maybeProgress?: Progress
): Promise<Blob> => {
  const optsInput: PrintBookOptions =
    typeof onProgressOrOptions === 'function' || !onProgressOrOptions ? {} : onProgressOrOptions;
  const onProgress: Progress | undefined =
    typeof onProgressOrOptions === 'function' ? onProgressOrOptions : maybeProgress;

  const pageSize: PrintPageSize = optsInput.pageSize ?? DEFAULT_PRINT_OPTIONS.pageSize;
  const marginPreset: PrintMarginPreset = optsInput.marginPreset ?? DEFAULT_PRINT_OPTIONS.marginPreset;
  const baseMarginMm = optsInput.marginMm ?? PRINT_MARGIN_PRESETS_MM[marginPreset] ?? 12;
  const bleedEnabled = optsInput.bleedEnabled ?? DEFAULT_PRINT_OPTIONS.bleedEnabled;
  const cropMarks = optsInput.cropMarks ?? DEFAULT_PRINT_OPTIONS.cropMarks;
  const showPageNumbers = optsInput.showPageNumbers ?? DEFAULT_PRINT_OPTIONS.showPageNumbers;
  const includeCovers = optsInput.includeCovers ?? DEFAULT_PRINT_OPTIONS.includeCovers;
  // العلامة المفرغة متوقفة افتراضياً للطباعة
  const watermarkEnabled = optsInput.watermarkEnabled ?? false;

  const dims = computePrintPageDimensionsMm(pageSize, bleedEnabled);
  const rtl = /arab|عرب/i.test(story.story_info.language ?? '');
  const t = (ar: string, en: string) => (rtl ? ar : en);
  const dpi = lowMemory() ? 200 : 300;
  const mm = dpi / 25.4;
  const pt = dpi / 72;
  const W = Math.round(dims.totalWidthMm * mm);
  const H = Math.round(dims.totalHeightMm * mm);
  const bleedPx = dims.bleedMm * mm;
  const safe = (dims.bleedMm + baseMarginMm) * mm;
  const head = rtl ? "'Baloo Bhaijaan 2', 'Cairo'" : "'Fredoka', 'Nunito'";
  const body = rtl ? "'Cairo', 'Baloo Bhaijaan 2'" : "'Nunito', 'Fredoka'";

  try {
    await Promise.all([`800 40px ${head}`, `700 40px ${body}`].map((f) => document.fonts.load(f)));
  } catch {
    // الخطوط الاحتياطية تكفي
  }

  const [{ jsPDF }, cover] = await Promise.all([
    import('jspdf'),
    includeCovers
      ? loadBitmapFromSource(
          story.coverImageId ?? story.pages[0]?.imageId,
          story.coverImage ?? story.pages[0]?.generatedImage,
          watermarkEnabled,
          rtl
        )
      : Promise.resolve(null),
  ]);

  const pdfFormat: [number, number] = [dims.totalWidthMm, dims.totalHeightMm];
  const pdf = new jsPDF({
    orientation: dims.totalWidthMm > dims.totalHeightMm ? 'landscape' : 'portrait',
    unit: 'mm',
    format: pdfFormat,
    compress: true,
  });
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d', { alpha: false })!;

  let count = 0;
  const flush = () => {
    if (cropMarks) {
      drawCropMarksOnCanvas(ctx, W, H, bleedPx, mm);
    }
    if (count > 0) {
      pdf.addPage(pdfFormat, dims.totalWidthMm > dims.totalHeightMm ? 'landscape' : 'portrait');
    }
    pdf.addImage(
      canvas.toDataURL('image/jpeg', 0.92),
      'JPEG',
      0,
      0,
      dims.totalWidthMm,
      dims.totalHeightMm,
      undefined,
      'FAST'
    );
    count++;
  };

  const setText = (size: number, weight: number, family: string, color: string, align: CanvasTextAlign = 'center') => {
    ctx.font = `${weight} ${size * pt}px ${family}, sans-serif`;
    ctx.fillStyle = color;
    ctx.textAlign = align;
    ctx.textBaseline = 'alphabetic';
    ctx.direction = rtl ? 'rtl' : 'ltr';
  };

  const paper = () => {
    ctx.fillStyle = PAPER;
    ctx.fillRect(0, 0, W, H);
  };

  const centered = (
    text: string,
    y: number,
    size: number,
    weight: number,
    family: string,
    color: string,
    maxW: number,
    lh = 1.5
  ): number => {
    setText(size, weight, family, color);
    const lines = wrap(ctx, text, maxW);
    lines.forEach((l, i) => ctx.fillText(l, W / 2, y + i * size * pt * lh));
    return y + lines.length * size * pt * lh;
  };

  const brandFooter = (color: string, y: number) => {
    centered(
      `${t('تصميم وتطوير', 'Designed & developed by')} ${rtl ? BRAND.author.ar : BRAND.author.en}`,
      y,
      8.5,
      700,
      body,
      color,
      W - safe * 2
    );
    centered(rtl ? BRAND.madeIn.ar : BRAND.madeIn.en, y + 5 * mm, 8.5, 700, body, color, W - safe * 2);
  };

  if (includeCovers) {
    // 1) الغلاف الأمامي
    onProgress?.(t('نجهّز الغلاف...', 'Preparing the cover...'));
    if (cover) coverFit(ctx, cover, 0, 0, W, H);
    else {
      const g = ctx.createLinearGradient(0, 0, W, H);
      g.addColorStop(0, '#3a2a6b');
      g.addColorStop(1, DUSK);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
    }
    const shade = ctx.createLinearGradient(0, H * 0.45, 0, H);
    shade.addColorStop(0, 'rgba(10,6,24,0)');
    shade.addColorStop(1, 'rgba(10,6,24,0.88)');
    ctx.fillStyle = shade;
    ctx.fillRect(0, H * 0.45, W, H * 0.55);
    ctx.shadowColor = 'rgba(0,0,0,0.6)';
    ctx.shadowBlur = 14 * pt;
    const titleBottom = centered(
      story.story_info.title,
      H - 62 * mm,
      30,
      800,
      head,
      '#ffffff',
      W - safe * 2,
      1.25
    );
    ctx.shadowBlur = 0;
    if (story.partNumber)
      centered(
        t(`الجزء ${story.partNumber}`, `Part ${story.partNumber}`),
        titleBottom + 2 * mm,
        12,
        700,
        body,
        '#ffd36a',
        W - safe * 2
      );
    brandFooter('rgba(255,255,255,0.9)', H - bleedPx - 14 * mm);
    flush();

    // 2) صفحة العنوان الداخلية
    paper();
    const ty = centered(story.story_info.title, H * 0.38, 26, 800, head, INK, W - safe * 2, 1.3);
    ctx.fillStyle = GOLD;
    ctx.fillRect(W / 2 - 14 * mm, ty + 6 * mm, 28 * mm, 0.8 * mm);
    brandFooter(SOFT, H - bleedPx - 22 * mm);
    flush();
  }

  // 3) صفحات القصة مع هوامش متناظرة (RTL / LTR) وصور 2048px الأصلية من IndexedDB
  const bitmaps: (ImageBitmap | null)[] = [];
  for (let i = 0; i < story.pages.length; i++) {
    onProgress?.(
      t(`نجهّز الصفحة ${i + 1} من ${story.pages.length}...`, `Preparing page ${i + 1} of ${story.pages.length}...`)
    );
    const page = story.pages[i];
    const pageNo = i + 1;
    const pageMargins = computePrintPageMarginsMm(pageNo, rtl, baseMarginMm, 6);
    const leftSafePx = (dims.bleedMm + pageMargins.leftMm) * mm;
    const rightSafePx = (dims.bleedMm + pageMargins.rightMm) * mm;

    const img = await loadBitmapFromSource(page.imageId, page.generatedImage, watermarkEnabled, rtl);
    bitmaps.push(img);
    paper();
    const imgH = Math.round(H * 0.56);
    if (img) coverFit(ctx, img, 0, 0, W, imgH);
    else {
      const g = ctx.createLinearGradient(0, 0, W, imgH);
      g.addColorStop(0, '#d9cff5');
      g.addColorStop(1, '#f5e6c8');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, imgH);
    }

    const boxTop = imgH + 11 * mm;
    const boxBottom = H - bleedPx - 17 * mm;
    const boxW = W - leftSafePx - rightSafePx;
    let size = 18;
    let lines: string[] = [];
    for (; size >= 11; size -= 0.5) {
      setText(size, 700, body, INK, rtl ? 'right' : 'left');
      lines = wrap(ctx, page.text, boxW);
      if (lines.length * size * pt * 1.75 <= boxBottom - boxTop) break;
    }
    const x = rtl ? W - rightSafePx : leftSafePx;
    lines.forEach((l, k) => ctx.fillText(l, x, boxTop + size * pt + k * size * pt * 1.75));
    if (showPageNumbers) {
      centered(String(pageNo), H - bleedPx - 8 * mm, 10, 700, body, GOLD, boxW);
    }
    flush();
  }
  bitmaps.forEach((b) => b?.close());
  cover?.close();

  // 4) الدرس المستفاد
  paper();
  const moral = story.story_info.moral || story.story_info.lessons?.[0];
  if (moral) {
    ctx.fillStyle = GOLD;
    ctx.beginPath();
    const cx = W / 2;
    const cy = H * 0.3;
    for (let k = 0; k < 10; k++) {
      const r = (k % 2 ? 4 : 9) * mm;
      const a = (Math.PI / 5) * k - Math.PI / 2;
      ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
    }
    ctx.closePath();
    ctx.fill();
    const my = centered(t('ماذا تعلمنا؟', 'What did we learn?'), H * 0.4, 22, 800, head, INK, W - safe * 2);
    centered(moral, my + 8 * mm, 17, 700, body, SOFT, W - safe * 2, 1.7);
  }
  centered(t('النهاية', 'The End'), H * 0.78, 26, 800, head, INK, W - safe * 2);
  flush();

  if (includeCovers) {
    // 5) صفحات رسم فارغة حتى يصبح العدد من مضاعفات 4 (شرط الطباعة) + غلاف خلفي
    while ((count + 1) % 4 !== 0) {
      paper();
      ctx.setLineDash([10 * mm * 0.5, 6 * mm * 0.5]);
      ctx.strokeStyle = '#cbbfe6';
      ctx.lineWidth = 0.6 * mm;
      ctx.strokeRect(safe, safe + 10 * mm, W - safe * 2, H - safe * 2 - 20 * mm);
      ctx.setLineDash([]);
      centered(
        t('ارسم مشهدك المفضل هنا', 'Draw your favourite scene here'),
        safe + 6 * mm,
        11,
        700,
        body,
        SOFT,
        W - safe * 2
      );
      flush();
    }
    ctx.fillStyle = DUSK;
    ctx.fillRect(0, 0, W, H);
    centered(rtl ? BRAND.name.ar : BRAND.name.en, H * 0.45, 24, 800, head, '#ffd36a', W - safe * 2);
    brandFooter('rgba(255,255,255,0.85)', H * 0.55);
    flush();
  }

  onProgress?.(t('نجمّع ملف الطباعة...', 'Assembling the print file...'));
  return pdf.output('blob');
};
