// صيغ الفيديو وجوداته: أبعاد زوجية دائماً (متطلب H.264) ونسب دقيقة
export type VideoFormatId = 'landscape' | 'reels' | 'square' | 'feed';
export type VideoQualityId = 'sd' | 'hd' | 'fhd';

export interface VideoFormat {
  id: VideoFormatId;
  ratio: number;
  // مساحة التصميم الافتراضية: كل المقاسات والخطوط في المصيّر محسوبة عليها ثم تُكبَّر لدقة الإخراج
  design: { w: number; h: number };
  label: { ar: string; en: string };
  hint: { ar: string; en: string };
}

export interface VideoQuality {
  id: VideoQualityId;
  short: number;
  label: { ar: string; en: string };
  hint: { ar: string; en: string };
}

export const VIDEO_FORMATS: VideoFormat[] = [
  { id: 'landscape', ratio: 16 / 9, design: { w: 1280, h: 720 }, label: { ar: 'أفقي 16:9', en: 'Landscape 16:9' }, hint: { ar: 'يوتيوب والتلفاز', en: 'YouTube & TV' } },
  { id: 'reels', ratio: 9 / 16, design: { w: 720, h: 1280 }, label: { ar: 'ريلز 9:16', en: 'Reels 9:16' }, hint: { ar: 'ريلز وتيك توك وشورتس وستوري', en: 'Reels, TikTok, Shorts, Stories' } },
  { id: 'square', ratio: 1, design: { w: 720, h: 720 }, label: { ar: 'مربع 1:1', en: 'Square 1:1' }, hint: { ar: 'فيسبوك وانستقرام ولينكدإن', en: 'Facebook, Instagram, LinkedIn' } },
  { id: 'feed', ratio: 4 / 5, design: { w: 720, h: 900 }, label: { ar: 'عمودي 4:5', en: 'Portrait 4:5' }, hint: { ar: 'منشور انستقرام وفيسبوك', en: 'Instagram & Facebook feed' } },
];

export const VIDEO_QUALITIES: VideoQuality[] = [
  { id: 'sd', short: 480, label: { ar: '480p اقتصادية', en: '480p Light' }, hint: { ar: 'أسرع وأصغر حجماً', en: 'Fastest, smallest' } },
  { id: 'hd', short: 720, label: { ar: '720p متوازنة', en: '720p Balanced' }, hint: { ar: 'مناسبة لمعظم المنصات', en: 'Fits most platforms' } },
  { id: 'fhd', short: 1080, label: { ar: '1080p عالية', en: '1080p High' }, hint: { ar: 'أفضل جودة، تحتاج جهازاً قوياً', en: 'Best quality, needs a strong device' } },
];

const even = (n: number) => Math.round(n / 2) * 2;

export const getFormat = (id: VideoFormatId): VideoFormat => VIDEO_FORMATS.find((f) => f.id === id) ?? VIDEO_FORMATS[0];
export const getQuality = (id: VideoQualityId): VideoQuality => VIDEO_QUALITIES.find((q) => q.id === id) ?? VIDEO_QUALITIES[1];

// البعد الأقصر = جودة الفيديو (480/720/1080)
export const videoSize = (format: VideoFormatId, quality: VideoQualityId): { width: number; height: number } => {
  const { ratio } = getFormat(format);
  const short = getQuality(quality).short;
  return ratio >= 1 ? { width: even(short * ratio), height: short } : { width: short, height: even(short / ratio) };
};

export const bitrateFor = (width: number, height: number, fps: number): number => Math.min(12_000_000, Math.max(1_500_000, Math.round(width * height * fps * 0.1)));

// أعلى جودة يتحملها الجهاز بحسب الذاكرة (سقف حماية من انهيار المتصفح)
export const maxQuality = (): VideoQualityId => {
  const mem = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
  if (mem && mem <= 2) return 'sd';
  if (mem && mem <= 4) return 'hd';
  return 'fhd';
};
