import { StoryData } from '../types';
import { BRAND } from '../config';
import { srcToBlob } from './media';

// كتاب جاهز للمطبعة: A5 (148×210 مم) + هامش قص 3 مم من كل جهة، 300 نقطة/بوصة
const TRIM = { w: 148, h: 210 };
const BLEED = 3;
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

const loadBitmap = async (src?: string): Promise<ImageBitmap | null> => {
  if (!src) return null;
  try {
    return await createImageBitmap(await srcToBlob(src));
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

export const generatePrintBook = async (story: StoryData, onProgress?: Progress): Promise<Blob> => {
  const rtl = /arab|عرب/i.test(story.story_info.language ?? '');
  const t = (ar: string, en: string) => (rtl ? ar : en);
  const dpi = lowMemory() ? 200 : 300;
  const mm = dpi / 25.4;
  const pt = dpi / 72;
  const W = Math.round((TRIM.w + BLEED * 2) * mm);
  const H = Math.round((TRIM.h + BLEED * 2) * mm);
  const bleed = BLEED * mm;
  const safe = (BLEED + 12) * mm;
  const head = rtl ? "'Baloo Bhaijaan 2', 'Cairo'" : "'Fredoka', 'Nunito'";
  const body = rtl ? "'Cairo', 'Baloo Bhaijaan 2'" : "'Nunito', 'Fredoka'";

  try {
    await Promise.all([`800 40px ${head}`, `700 40px ${body}`].map((f) => document.fonts.load(f)));
  } catch {
    // الخطوط الاحتياطية تكفي
  }

  const [{ jsPDF }, cover] = await Promise.all([import('jspdf'), loadBitmap(story.coverImage ?? story.pages[0]?.generatedImage)]);
  const pdf = new jsPDF({ unit: 'mm', format: [TRIM.w + BLEED * 2, TRIM.h + BLEED * 2], compress: true });
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d', { alpha: false })!;

  let count = 0;
  const flush = () => {
    if (count > 0) pdf.addPage([TRIM.w + BLEED * 2, TRIM.h + BLEED * 2]);
    pdf.addImage(canvas.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, TRIM.w + BLEED * 2, TRIM.h + BLEED * 2, undefined, 'FAST');
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

  const centered = (text: string, y: number, size: number, weight: number, family: string, color: string, maxW: number, lh = 1.5): number => {
    setText(size, weight, family, color);
    const lines = wrap(ctx, text, maxW);
    lines.forEach((l, i) => ctx.fillText(l, W / 2, y + i * size * pt * lh));
    return y + lines.length * size * pt * lh;
  };

  const brandFooter = (color: string, y: number) => {
    centered(`${t('تصميم وتطوير', 'Designed & developed by')} ${rtl ? BRAND.author.ar : BRAND.author.en}`, y, 8.5, 700, body, color, W - safe * 2);
    centered(rtl ? BRAND.madeIn.ar : BRAND.madeIn.en, y + 5 * mm, 8.5, 700, body, color, W - safe * 2);
  };

  // 1) الغلاف
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
  const titleBottom = centered(story.story_info.title, H - 62 * mm, 30, 800, head, '#ffffff', W - safe * 2, 1.25);
  ctx.shadowBlur = 0;
  if (story.partNumber) centered(t(`الجزء ${story.partNumber}`, `Part ${story.partNumber}`), titleBottom + 2 * mm, 12, 700, body, '#ffd36a', W - safe * 2);
  brandFooter('rgba(255,255,255,0.9)', H - bleed - 14 * mm);
  flush();

  // 2) صفحة العنوان
  paper();
  const ty = centered(story.story_info.title, H * 0.38, 26, 800, head, INK, W - safe * 2, 1.3);
  ctx.fillStyle = GOLD;
  ctx.fillRect(W / 2 - 14 * mm, ty + 6 * mm, 28 * mm, 0.8 * mm);
  brandFooter(SOFT, H - bleed - 22 * mm);
  flush();

  // 3) صفحات القصة
  const bitmaps: (ImageBitmap | null)[] = [];
  for (let i = 0; i < story.pages.length; i++) {
    onProgress?.(t(`نجهّز الصفحة ${i + 1} من ${story.pages.length}...`, `Preparing page ${i + 1} of ${story.pages.length}...`));
    const page = story.pages[i];
    const img = await loadBitmap(page.generatedImage);
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
    // نص الصفحة: يكبر ما أمكن ثم يصغر حتى يتسع
    const boxTop = imgH + 11 * mm;
    const boxBottom = H - bleed - 17 * mm;
    const boxW = W - safe * 2;
    let size = 18;
    let lines: string[] = [];
    for (; size >= 11; size -= 0.5) {
      setText(size, 700, body, INK, rtl ? 'right' : 'left');
      lines = wrap(ctx, page.text, boxW);
      if (lines.length * size * pt * 1.75 <= boxBottom - boxTop) break;
    }
    const x = rtl ? W - safe : safe;
    lines.forEach((l, k) => ctx.fillText(l, x, boxTop + size * pt + k * size * pt * 1.75));
    centered(String(i + 1), H - bleed - 8 * mm, 10, 700, body, GOLD, boxW);
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

  // 5) صفحات رسم فارغة حتى يصبح العدد من مضاعفات 4 (شرط الطباعة) + غلاف خلفي
  while ((count + 1) % 4 !== 0) {
    paper();
    ctx.setLineDash([10 * mm * 0.5, 6 * mm * 0.5]);
    ctx.strokeStyle = '#cbbfe6';
    ctx.lineWidth = 0.6 * mm;
    ctx.strokeRect(safe, safe + 10 * mm, W - safe * 2, H - safe * 2 - 20 * mm);
    ctx.setLineDash([]);
    centered(t('ارسم مشهدك المفضل هنا', 'Draw your favourite scene here'), safe + 6 * mm, 11, 700, body, SOFT, W - safe * 2);
    flush();
  }
  ctx.fillStyle = DUSK;
  ctx.fillRect(0, 0, W, H);
  centered(rtl ? BRAND.name.ar : BRAND.name.en, H * 0.45, 24, 800, head, '#ffd36a', W - safe * 2);
  brandFooter('rgba(255,255,255,0.85)', H * 0.55);
  flush();

  onProgress?.(t('نجمّع ملف الطباعة...', 'Assembling the print file...'));
  return pdf.output('blob');
};
