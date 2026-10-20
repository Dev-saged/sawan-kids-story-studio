import type { AmbientPresetId, ArabicDialect, ArtStyle, CoverFontStyle, NarratorVoice } from './types';
import { CURRENT_VERSION } from './version';

export const APP_VERSION = CURRENT_VERSION.version;

export const CONFIG = {
  IMAGE_MAX_DIM: 2048,
  MAX_PROMPT_WORDS: 120,
  WATERMARK_WIDTH_RATIO: 0.04,
  PREVIEW_GATE_DEFAULT: true,
  EXPORT_WATERMARK_DEFAULT: true,
  GITHUB_OWNER: 'Dev-saged',
  GITHUB_REPO: 'sawan-kids-story-studio',
} as const;

// الهوية وروابط التواصل — تعديل هذا الملف فقط يغيّر العلامة في كل التطبيق
export const BRAND = {
  name: { ar: 'استوديو ساجد', en: 'Sajed Studio' },
  fullName: { ar: 'استوديو ساجد لقصص الأطفال', en: 'Sajed Kids Story Studio' },
  author: { ar: 'المهندس ساجد العبادلة', en: 'Eng. Sajed Al-Abadlah' },
  madeIn: { ar: 'صُنع بكل حب من فلسطين — غزة', en: 'Made with love from Palestine — Gaza' },
};

export type SocialKey = 'whatsapp' | 'instagram' | 'facebook' | 'twitter' | 'github';

// رابط فارغ = الأيقونة لا تظهر
export const SOCIAL_LINKS: Record<SocialKey, string> = {
  whatsapp: '+972597857250',
  instagram: 'https://instagram.com/sajedd.0',
  facebook: 'https://facebook.com/saged.t',
  twitter: 'https://x.com/saged_al',
  github: 'https://github.com/Dev-saged',
};

// هويات جاهزة (16 هوية): كل هوية تضبط الأسلوب الفني والراوي واللهجة وخط الغلاف والصوت المحيطي بضغطة واحدة
export interface BrandPreset {
  id: string;
  label: { ar: string; en: string };
  desc: { ar: string; en: string };
  artStyle: ArtStyle;
  voice: NarratorVoice;
  dialect: ArabicDialect;
  coverFont: CoverFontStyle;
  ambientPreset: AmbientPresetId;
  isCustom?: boolean;
  createdAt?: number;
}

export const BRAND_PRESETS: BrandPreset[] = [
  { id: 'classic', label: { ar: 'كلاسيكي دافئ', en: 'Warm Classic' }, desc: { ar: 'كتاب حكايات تقليدي بفصحى رصينة', en: 'Traditional storybook in eloquent Fusha' }, artStyle: 'Classic Storybook', voice: 'Sulafat', dialect: 'Modern Standard', coverFont: 'naskh', ambientPreset: 'cozy_fire' },
  { id: 'cinema', label: { ar: 'سينمائي بيكسار', en: '3D Cinematic' }, desc: { ar: 'ثلاثي الأبعاد بإضاءة سينمائية ساحرة', en: '3D animated render with cinematic light' }, artStyle: '3D Pixar Style', voice: 'Algieba', dialect: 'Modern Standard', coverFont: 'display3d', ambientPreset: 'dream' },
  { id: 'dream', label: { ar: 'أحلام مائية', en: 'Watercolor Dream' }, desc: { ar: 'ألوان مائية ناعمة وراوية حنونة', en: 'Soft watercolor with gentle narrator' }, artStyle: 'Watercolor', voice: 'Vindemiatrix', dialect: 'Modern Standard', coverFont: 'naskh', ambientPreset: 'rain' },
  { id: 'night', label: { ar: 'همسات قبل النوم', en: 'Bedtime Lullaby' }, desc: { ar: 'ألوان ليلية هادئة وصوت دافئ مطمئن', en: 'Calm moonlit colors and soothing voice' }, artStyle: 'Bedtime Story', voice: 'Achernar', dialect: 'Modern Standard', coverFont: 'elmessiri', ambientPreset: 'night' },
  { id: 'hakaya', label: { ar: 'حكايا فلسطينية', en: 'Palestinian Tales' }, desc: { ar: 'رسم يدوي أصيل ولهجة فلسطينية دافئة', en: 'Hand-drawn folk art in Palestinian dialect' }, artStyle: 'Hand-drawn Cartoon', voice: 'Charon', dialect: 'Palestinian', coverFont: 'kufi', ambientPreset: 'forest' },
  { id: 'shami', label: { ar: 'ليالي الشام', en: 'Levantine Nights' }, desc: { ar: 'حكايات شامية عذبة بأسلوب قصصي ساحر', en: 'Warm Levantine storytelling and fairy art' }, artStyle: 'Fantasy Fairy Tale', voice: 'Sulafat', dialect: 'Syrian', coverFont: 'diwani', ambientPreset: 'night' },
  { id: 'egyptian', label: { ar: 'حدوتة مصرية', en: 'Egyptian Hadouta' }, desc: { ar: 'خفة ظل مصرية ورسوم كرتونية مبهجة', en: 'Playful Egyptian charm and cute cartoon' }, artStyle: 'Cute Cartoon', voice: 'Puck', dialect: 'Egyptian', coverFont: 'lemonada', ambientPreset: 'dream' },
  { id: 'khaleeji', label: { ar: 'مجلس الخليج', en: 'Gulf Heritage' }, desc: { ar: 'سوالف خليجية أصيلة بألوان دافئة', en: 'Authentic Gulf tales with warm colors' }, artStyle: 'Classic Storybook', voice: 'Algieba', dialect: 'Saudi', coverFont: 'kufi', ambientPreset: 'cozy_fire' },
  { id: 'maghrebi', label: { ar: 'أزقة المغرب', en: 'Moroccan Mosaic' }, desc: { ar: 'قصاصات فنية زاهية بلهجة مغربية', en: 'Vibrant paper art in Moroccan dialect' }, artStyle: 'Paper Cutout', voice: 'Vindemiatrix', dialect: 'Moroccan', coverFont: 'katibeh', ambientPreset: 'ocean' },
  { id: 'anime_hero', label: { ar: 'أنمي المغامرات', en: 'Anime Quest' }, desc: { ar: 'رسوم أنمي مشرقة وإيقاع حماسي', en: 'Sparkling anime art and energetic voice' }, artStyle: 'Anime', voice: 'Puck', dialect: 'Modern Standard', coverFont: 'changa', ambientPreset: 'forest' },
  { id: 'clay_world', label: { ar: 'عالم الصلصال', en: 'Claymation Studio' }, desc: { ar: 'دمى صلصال ثلاثية الأبعاد بلمسة يدوية', en: 'Tactile stop-motion plasticine world' }, artStyle: 'Claymation', voice: 'Charon', dialect: 'Jordanian', coverFont: 'lalezar', ambientPreset: 'dream' },
  { id: 'comic_cyber', label: { ar: 'كوميكس المستقبل', en: 'Cyber Comic' }, desc: { ar: 'قصص مصورة جريئة لليافعين والمبتكرين', en: 'Bold graphic novel style with cyber vibe' }, artStyle: 'Comic Book', voice: 'Algieba', dialect: 'Modern Standard', coverFont: 'alexandria', ambientPreset: 'cyber' },
  { id: 'pastel_calm', label: { ar: 'طيف الباستيل', en: 'Pastel Serenity' }, desc: { ar: 'تدرجات باستيل حالمة للقصص الوجدانية', en: 'Gentle pastel washes for emotional tales' }, artStyle: 'Pastel Dream', voice: 'Achernar', dialect: 'Lebanese', coverFont: 'readex', ambientPreset: 'rain' },
  { id: 'chalk_school', label: { ar: 'سبورة المعرفة', en: 'Chalkboard Discovery' }, desc: { ar: 'رسم طباشير تعليمي ممتع ومبسط', en: 'Playful chalkboard art for learning' }, artStyle: 'Chalk Drawing', voice: 'Sulafat', dialect: 'Modern Standard', coverFont: 'harmattan', ambientPreset: 'dream' },
  { id: 'pixel_arcade', label: { ar: 'بيكسل المغامرين', en: 'Pixel Arcade' }, desc: { ar: 'فن البكسل الكلاسيكي للألغاز والتحديات', en: 'Retro 16-bit pixel art for puzzle quests' }, artStyle: 'Pixel Art', voice: 'Puck', dialect: 'Kuwaiti', coverFont: 'changa', ambientPreset: 'cyber' },
  { id: 'iraqi_tigris', label: { ar: 'حكايات دجلة', en: 'Tigris Folklore' }, desc: { ar: 'تراث عراقي عريق وخطوط زخرفية أصيلة', en: 'Rich Iraqi folklore and classic ink art' }, artStyle: 'Doodle Sketch', voice: 'Charon', dialect: 'Iraqi', coverFont: 'diwani', ambientPreset: 'ocean' },
];

export const DEFAULT_PRESET = 'classic';

export interface StudioSettings {
  previewFirstGate: boolean;
  watermarkEnabled: boolean;
  watermarkText: string;
}

const SETTINGS_STORAGE_KEY = 'sajed_studio_settings_v1';

export const getStudioSettings = (): StudioSettings => {
  try {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) {
      return {
        previewFirstGate: CONFIG.PREVIEW_GATE_DEFAULT,
        watermarkEnabled: CONFIG.EXPORT_WATERMARK_DEFAULT,
        watermarkText: '',
      };
    }
    const parsed = JSON.parse(raw);
    return {
      previewFirstGate: typeof parsed.previewFirstGate === 'boolean' ? parsed.previewFirstGate : CONFIG.PREVIEW_GATE_DEFAULT,
      watermarkEnabled: typeof parsed.watermarkEnabled === 'boolean' ? parsed.watermarkEnabled : CONFIG.EXPORT_WATERMARK_DEFAULT,
      watermarkText: typeof parsed.watermarkText === 'string' ? parsed.watermarkText : '',
    };
  } catch {
    return {
      previewFirstGate: CONFIG.PREVIEW_GATE_DEFAULT,
      watermarkEnabled: CONFIG.EXPORT_WATERMARK_DEFAULT,
      watermarkText: '',
    };
  }
};

export const saveStudioSettings = (patch: Partial<StudioSettings>): StudioSettings => {
  const next = { ...getStudioSettings(), ...patch };
  try {
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // ignore storage quota errors
  }
  return next;
};

export const getEffectiveWatermarkText = (isArabic = true): string => {
  const custom = getStudioSettings().watermarkText.trim();
  if (custom) return custom;
  return isArabic ? BRAND.name.ar : BRAND.name.en;
};

