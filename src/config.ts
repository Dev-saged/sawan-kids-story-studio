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
