import type { ArabicDialect, ArtStyle, NarratorVoice } from './types';

export const APP_VERSION = '2.1.0';

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

// هويات جاهزة: كل هوية تضبط الأسلوب الفني والراوي واللهجة بضغطة واحدة (بيع هوية جديدة = إضافة سطر هنا)
export interface BrandPreset {
  id: string;
  label: { ar: string; en: string };
  desc: { ar: string; en: string };
  artStyle: ArtStyle;
  voice: NarratorVoice;
  dialect: ArabicDialect;
}

export const BRAND_PRESETS: BrandPreset[] = [
  { id: 'classic', label: { ar: 'كلاسيكي دافئ', en: 'Warm Classic' }, desc: { ar: 'كتاب حكايات تقليدي بفصحى رصينة', en: 'Traditional storybook' }, artStyle: 'Classic Storybook', voice: 'Sulafat', dialect: 'Modern Standard' },
  { id: 'cinema', label: { ar: 'سينمائي', en: 'Cinematic' }, desc: { ar: 'ثلاثي الأبعاد بإضاءة سينمائية', en: '3D with cinematic light' }, artStyle: '3D Pixar Style', voice: 'Algieba', dialect: 'Modern Standard' },
  { id: 'dream', label: { ar: 'أحلام مائية', en: 'Watercolor Dream' }, desc: { ar: 'ألوان مائية ناعمة وراوية حنونة', en: 'Soft watercolor, gentle narrator' }, artStyle: 'Watercolor', voice: 'Vindemiatrix', dialect: 'Modern Standard' },
  { id: 'night', label: { ar: 'قبل النوم', en: 'Bedtime' }, desc: { ar: 'ألوان هادئة وصوت هادئ', en: 'Calm colors, soft voice' }, artStyle: 'Bedtime Story', voice: 'Achernar', dialect: 'Modern Standard' },
  { id: 'hakaya', label: { ar: 'حكايا فلسطينية', en: 'Palestinian Tales' }, desc: { ar: 'رسم يدوي ولهجة فلسطينية', en: 'Hand-drawn, Palestinian dialect' }, artStyle: 'Hand-drawn Cartoon', voice: 'Charon', dialect: 'Palestinian' },
];

export const DEFAULT_PRESET = 'classic';
