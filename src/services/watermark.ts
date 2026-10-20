import { BRAND, CONFIG, getStudioSettings } from '../config';

export interface WatermarkOptions {
  isArabic?: boolean;
  customText?: string;
  forceEnable?: boolean;
  corner?: 'bottom-right' | 'bottom-left';
}

// حساب متوسط سطوع البكسلات (0..255) في منطقة العلامة المائية
export const computeRegionLuminance = (pixels: Uint8ClampedArray): number => {
  if (!pixels.length) return 0;
  let sum = 0;
  let count = 0;
  for (let i = 0; i < pixels.length; i += 4) {
    const r = pixels[i];
    const g = pixels[i + 1];
    const b = pixels[i + 2];
    sum += 0.299 * r + 0.587 * g + 0.114 * b;
    count++;
  }
  return count > 0 ? sum / count : 0;
};

// التأكد من تحميل الخط العربي قبل الرسم على Canvas
const ensureWatermarkFontLoaded = async (fontSizePx: number): Promise<void> => {
  try {
    if (typeof document !== 'undefined' && document.fonts && typeof document.fonts.load === 'function') {
      await Promise.race([
        document.fonts.load(`700 ${Math.max(12, Math.round(fontSizePx))}px "Cairo"`),
        new Promise((resolve) => setTimeout(resolve, 600)),
      ]);
    }
  } catch {
    // ignore font loading timeout
  }
};

// ب8: رسم علامة حقوق مفرغة ذكية على Canvas بحجم 4% من عرض الصورة ومسافة 2% من الحافة وتكيّف تلقائي مع سطوع الخلفية (>140)
export const drawHollowWatermarkOnCanvas = async (
  canvas: HTMLCanvasElement,
  opts: WatermarkOptions = {}
): Promise<HTMLCanvasElement> => {
  const settings = getStudioSettings();
  if (!opts.forceEnable && !settings.watermarkEnabled) {
    return canvas;
  }

  const width = canvas.width;
  const height = canvas.height;
  if (width < 16 || height < 16) return canvas;

  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  const isArabic = opts.isArabic ?? true;
  const text = (
    opts.customText?.trim() ||
    settings.watermarkText.trim() ||
    (isArabic ? BRAND.name.ar : BRAND.name.en)
  ).trim();
  if (!text) return canvas;

  // حجم الخط = 4% من عرض الصورة، والمسافة = 2% من الحافة
  const fontSize = Math.max(10, Math.round(width * CONFIG.WATERMARK_WIDTH_RATIO));
  const margin = Math.max(4, Math.round(width * 0.02));

  await ensureWatermarkFontLoaded(fontSize);

  ctx.save();
  ctx.font = `700 ${fontSize}px "Cairo", "Baloo Bhaijaan 2", sans-serif`;
  ctx.textBaseline = 'bottom';

  const metrics = ctx.measureText(text);
  const textWidth = Math.min(width - margin * 2, Math.max(fontSize * 2, Math.ceil(metrics.width)));
  const textHeight = Math.ceil(fontSize * 1.25);

  const corner = opts.corner ?? (isArabic ? 'bottom-left' : 'bottom-right');
  const boxX = corner === 'bottom-right' ? Math.max(0, width - margin - textWidth) : margin;
  const boxY = Math.max(0, height - margin - textHeight);

  // قياس متوسط السطوع تحت منطقة العلامة
  let luminance = 60;
  try {
    const sampleW = Math.max(1, Math.min(width - boxX, textWidth));
    const sampleH = Math.max(1, Math.min(height - boxY, textHeight));
    const imgData = ctx.getImageData(boxX, boxY, sampleW, sampleH);
    luminance = computeRegionLuminance(imgData.data);
  } catch {
    luminance = 60;
  }

  // إن كانت الخلفية فاتحة (>140) فالحدود داكنة والداخل أبيض شفاف (0.25)، والعكس على الخلفية الداكنة
  const isLightBg = luminance > 140;
  ctx.fillStyle = isLightBg ? 'rgba(255, 255, 255, 0.25)' : 'rgba(15, 23, 42, 0.25)';
  ctx.strokeStyle = isLightBg ? 'rgba(15, 23, 42, 0.65)' : 'rgba(255, 255, 255, 0.65)';
  ctx.lineWidth = Math.max(1.2, fontSize * 0.08);
  ctx.lineJoin = 'round';
  ctx.miterLimit = 2;

  if (corner === 'bottom-right') {
    ctx.textAlign = 'right';
    const x = width - margin;
    const y = height - margin;
    ctx.strokeText(text, x, y);
    ctx.fillText(text, x, y);
  } else {
    ctx.textAlign = 'left';
    const x = margin;
    const y = height - margin;
    ctx.strokeText(text, x, y);
    ctx.fillText(text, x, y);
  }

  ctx.restore();
  return canvas;
};

export const applyHollowWatermarkToBlob = async (
  blob: Blob,
  opts: WatermarkOptions = {},
  outputType = 'image/png'
): Promise<Blob> => {
  const settings = getStudioSettings();
  if (!opts.forceEnable && !settings.watermarkEnabled) {
    return blob;
  }
  const bmp = await createImageBitmap(blob);
  const canvas = document.createElement('canvas');
  canvas.width = bmp.width;
  canvas.height = bmp.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    bmp.close();
    return blob;
  }
  ctx.drawImage(bmp, 0, 0);
  bmp.close();

  await drawHollowWatermarkOnCanvas(canvas, opts);

  return new Promise<Blob>((resolve) => {
    canvas.toBlob((out) => resolve(out || blob), outputType, 0.92);
  });
};

export const applyHollowWatermarkToDataUrl = async (
  srcUrl: string,
  opts: WatermarkOptions = {},
  outputType = 'image/jpeg'
): Promise<string> => {
  const settings = getStudioSettings();
  if (!opts.forceEnable && !settings.watermarkEnabled) {
    return srcUrl;
  }
  try {
    const res = await fetch(srcUrl);
    const blob = await res.blob();
    const watermarked = await applyHollowWatermarkToBlob(blob, opts, outputType);
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(watermarked);
    });
  } catch {
    return srcUrl;
  }
};
