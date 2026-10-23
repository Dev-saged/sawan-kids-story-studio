import type { ArtStyle, AudienceLevel } from '../src/types.ts';

// قواعد مشتركة بين الخادم والعميل: الأساليب الفنية، ثبات الأسلوب، قرار الجمهور.
// ملف خالٍ من أي اعتماد على المتصفح ليستورده server.ts مباشرة.

export interface ArtDirection {
  labelAr: string;
  medium: string;
  palette: string;
  lighting: string;
  texture: string;
}

// وصف بصري وصفي لكل أسلوب (بلا مبالغات تسويقية ولا أسماء استوديوهات): الوسيط، الألوان، الإضاءة، الملمس
export const ART_DIRECTION: Record<ArtStyle, ArtDirection> = {
  'Cute Cartoon': {
    labelAr: 'كرتون لطيف',
    medium: 'polished 2D cartoon illustration with smooth clean outlines and expressive round faces',
    palette: 'bright cheerful saturated colors',
    lighting: 'soft even daylight with gentle shading',
    texture: 'clean flat color fills',
  },
  'Hand-drawn Cartoon': {
    labelAr: 'كرتون مرسوم باليد',
    medium: 'hand-drawn ink and brush cartoon illustration with organic outlines',
    palette: 'warm harmonious colors',
    lighting: 'natural soft light',
    texture: 'visible brush strokes and paper grain',
  },
  Watercolor: {
    labelAr: 'ألوان مائية',
    medium: 'fine-art watercolor illustration with delicate ink line detail',
    palette: 'luminous translucent washes in harmonious tones',
    lighting: 'warm atmospheric glow',
    texture: 'cold-press paper grain and soft bleeding edges',
  },
  '3D Pixar Style': {
    labelAr: 'ثلاثي الأبعاد (بيكسار)',
    medium: 'feature-film 3D animated render with friendly rounded shapes and expressive eyes',
    palette: 'rich vibrant colors',
    lighting: 'soft volumetric cinematic lighting',
    texture: 'tactile fabric and fur detail with gentle subsurface skin',
  },
  'Pastel Dream': {
    labelAr: 'باستيل حالم',
    medium: 'soft pastel fine-art illustration with delicate brushwork',
    palette: 'velvety muted pastel gradients',
    lighting: 'dreamy diffused glow',
    texture: 'powdery pastel grain',
  },
  'Doodle Sketch': {
    labelAr: 'رسومات خربشية',
    medium: 'expressive ink-and-wash sketch illustration with loose confident pen lines',
    palette: 'light watercolor accents on cream paper',
    lighting: 'simple natural light',
    texture: 'cross-hatching and sketchbook paper',
  },
  Anime: {
    labelAr: 'أنمي',
    medium: 'cinematic anime key visual with crisp cel shading and large expressive eyes',
    palette: 'vivid luminous colors',
    lighting: 'dramatic rim light and glowing sunlight',
    texture: 'detailed painted backgrounds',
  },
  'Paper Cutout': {
    labelAr: 'قصاصات ورقية',
    medium: 'layered handmade paper cut-out diorama',
    palette: 'bold craft-paper colors',
    lighting: 'soft studio light with dimensional drop shadows',
    texture: 'visible paper fibers and cut edges',
  },
  'Educational Line Cartoon': {
    labelAr: 'كرتون تعليمي خطي',
    medium: 'clear educational line cartoon with bold clean outlines',
    palette: 'bright friendly flat colors',
    lighting: 'even flat lighting',
    texture: 'smooth vector fills',
  },
  Claymation: {
    labelAr: 'صلصال / ستوب موشن',
    medium: 'handmade clay stop-motion frame with sculpted characters',
    palette: 'warm saturated clay colors',
    lighting: 'miniature set studio lighting',
    texture: 'tactile fingerprint marks on plasticine',
  },
  'Flat Vector': {
    labelAr: 'فلات فيكتور',
    medium: 'modern flat vector illustration with bold geometric shapes',
    palette: 'balanced harmonious palette',
    lighting: 'soft gradient light',
    texture: 'crisp clean edges',
  },
  'Fantasy Fairy Tale': {
    labelAr: 'خيال قصصي',
    medium: 'enchanted fantasy painterly illustration with lush environments',
    palette: 'rich jewel-toned colors',
    lighting: 'golden magical glow with floating light particles',
    texture: 'detailed painterly brushwork',
  },
  'Bedtime Story': {
    labelAr: 'قصة قبل النوم',
    medium: 'cozy painterly picture-book illustration of a calm night scene',
    palette: 'deep indigo with warm amber accents',
    lighting: 'moonlight and warm lantern glow',
    texture: 'soft gouache texture',
  },
  'Classic Storybook': {
    labelAr: 'كتاب قصص كلاسيكي',
    medium: 'classic picture-book illustration in gouache and fine ink with expressive characters',
    palette: 'warm earthy colors',
    lighting: 'gentle storybook light',
    texture: 'rich brushwork on textured paper',
  },
  'Pixel Art': {
    labelAr: 'بكسل آرت',
    medium: '16-bit pixel art scene with crisp pixel sprites',
    palette: 'limited vibrant retro palette',
    lighting: 'flat pixel lighting with simple highlights',
    texture: 'sharp square pixels',
  },
  'Chalk Drawing': {
    labelAr: 'رسم بالطباشير',
    medium: 'pastel chalk drawing on a dark slate board',
    palette: 'vibrant hand-blended chalk colors',
    lighting: 'warm chalk highlights',
    texture: 'dusty chalk strokes on slate',
  },
  'Comic Book': {
    labelAr: 'قصص مصورة',
    medium: 'dynamic graphic novel illustration with bold ink outlines',
    palette: 'vivid saturated colors',
    lighting: 'dramatic cel shading with halftone accents',
    texture: 'inked linework',
  },
  Photorealistic: {
    labelAr: 'واقعي',
    medium: 'cinematic photorealistic photograph, 85mm lens, shallow depth of field',
    palette: 'natural film color grading',
    lighting: 'soft natural light',
    texture: 'lifelike skin and fabric detail',
  },
};

const KID_WORDS_RE = /\b(cute|cheerful|friendly|children'?s?)\s+/gi;

// سطر أسلوب واحد (<= 28 كلمة) يُستعمل في كل برومبت صورة؛ للكبار تُحذف الصفات الطفولية
export const artDirectionLine = (style?: string, adult = false): string => {
  const d = ART_DIRECTION[(style as ArtStyle) || 'Classic Storybook'] ?? ART_DIRECTION['Classic Storybook'];
  const line = [d.medium, d.palette, d.lighting, d.texture].join(', ');
  return adult ? line.replace(KID_WORDS_RE, '') : line;
};

// ───────────── ثبات الأسلوب (Style Lock) ─────────────
export interface StyleConsistencyPreset {
  id: string;
  label: { ar: string; en: string };
  keywords: string;
  aliases?: string[];
}

export const STYLE_CONSISTENCY_PRESETS: StyleConsistencyPreset[] = [
  { id: 'auto', label: { ar: 'تلقائي حسب الأسلوب الفني المختار', en: 'Automatic (follow the chosen art style)' }, keywords: '' },
  {
    id: 'pastoral-anime',
    label: { ar: 'أنمي ريفي دافئ بخلفيات مرسومة يدوياً', en: 'Warm pastoral anime with hand-painted backgrounds' },
    keywords: 'hand-painted lush backgrounds, soft naturalistic light, gentle cel-shaded characters',
    aliases: ['studio ghibli'],
  },
  {
    id: 'cinematic-anime',
    label: { ar: 'أنمي سينمائي عالي التفاصيل', en: 'High-detail cinematic anime' },
    keywords: 'high-detail cinematic anime key visual, crisp cel shading, luminous rim light, atmospheric backgrounds',
    aliases: ['makoto shinkai anime'],
  },
  {
    id: 'digital-realism',
    label: { ar: 'رسم رقمي واقعي', en: 'Realistic digital painting' },
    keywords: 'realistic digital painting, lifelike skin and fabric textures, shallow depth of field',
    aliases: ['hyper-realistic digital painting'],
  },
  {
    id: 'feature-3d',
    label: { ar: 'ثلاثي الأبعاد سينمائي', en: 'Cinematic 3D render' },
    keywords: 'feature-film 3D render, volumetric light, detailed surface textures, soft subsurface skin',
    aliases: ['pixar 3d animation'],
  },
  {
    id: 'concept-art',
    label: { ar: 'كونسبت آرت ملحمي', en: 'Epic concept art' },
    keywords: 'epic cinematic concept art, dramatic chiaroscuro lighting, intricate environment detail',
    aliases: ['cinematic concept art'],
  },
  {
    id: 'fine-watercolor',
    label: { ar: 'ألوان مائية فنية', en: 'Fine-art watercolor' },
    keywords: 'fine-art watercolor, luminous washes, cold-press paper texture, delicate ink detail',
    aliases: ['luxury watercolor storybook'],
  },
  {
    id: 'graphic-novel',
    label: { ar: 'رواية مصورة', en: 'Graphic novel' },
    keywords: 'graphic novel illustration, bold ink linework, dramatic cel shading, heroic framing',
    aliases: ['graphic novel comic'],
  },
];

const BRAND_NAMES_RE = /\b(studio\s+ghibli|ghibli|ufotable|makoto\s+shinkai|shinkai|pixar|disney|dreamworks)\b/gi;

// يحذف أسماء الاستوديوهات والعلامات من أي نص مرسل للنماذج (قصص قديمة محفوظة قد تحملها)
export const stripBrandNames = (text: string): string =>
  text
    .replace(BRAND_NAMES_RE, '')
    .replace(/\b(masterpiece|luxury|award-winning)\s+/gi, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+,/g, ',')
    .replace(/,\s*,/g, ',')
    .trim();

const findPreset = (raw: string): StyleConsistencyPreset | undefined =>
  STYLE_CONSISTENCY_PRESETS.find(
    (p) =>
      p.id === raw ||
      p.aliases?.includes(raw) ||
      (p.keywords && stripBrandNames(p.keywords).toLowerCase() === stripBrandNames(raw).toLowerCase())
  );

// يحوّل أي قيمة محفوظة قديمة (معرّف قديم أو كلمات كاملة) إلى معرّف قالب صالح أو 'auto'
export const normalizeStyleConsistencyId = (value?: string): string => {
  const raw = (value ?? '').trim().toLowerCase();
  return (raw && findPreset(raw)?.id) || 'auto';
};

// يعيد كلمات القفل فقط إذا اختار المستخدم قالباً معروفاً؛ وإلا '' (الأسلوب نفسه يكفي)
export const getStyleLock = (styleConsistency?: string): string => {
  const raw = (styleConsistency ?? '').trim().toLowerCase();
  if (!raw || raw === 'auto') return '';
  return findPreset(raw)?.keywords ?? '';
};

// للعرض في الواجهة: الكلمات المقفلة، أو وصف الأسلوب نفسه عند الوضع التلقائي
export const resolveStyleConsistencyKeywords = (artStyle?: string, styleConsistency?: string): string =>
  getStyleLock(styleConsistency) || artDirectionLine(artStyle);

// ───────────── قرار الجمهور (مصدر واحد للخادم والعميل) ─────────────
export interface AudienceInput {
  audienceLevel?: AudienceLevel;
  ageGroup?: string;
  adultMode?: boolean;
  heroAgeStage?: 'child' | 'teen' | 'adult';
  heroPhotoId?: string;
  hasHeroPhoto?: boolean;
}

export interface AudienceDecision {
  adult: boolean;
  audienceLevel: AudienceLevel;
  ageGroup: string;
  blockedByChildHero: boolean;
}

// القصة "كبار" فقط عند اختيار صريح؛ وبطل صورته طفل يقفل الجمهور على الأطفال دائماً
export const resolveAudience = (input: AudienceInput): AudienceDecision => {
  const requestedAdult =
    input.audienceLevel === 'adults' || input.ageGroup === '18+' || input.adultMode === true || input.heroAgeStage === 'adult';
  const hasPhoto = Boolean(input.heroPhotoId) || Boolean(input.hasHeroPhoto);
  const childPhotoHero = hasPhoto && input.heroAgeStage === 'child';
  const adult = requestedAdult && !childPhotoHero;
  const ageGroup = adult ? '18+' : input.ageGroup === '18+' ? '7-9' : input.ageGroup || '4-6';
  return {
    adult,
    audienceLevel: adult ? 'adults' : 'kids',
    ageGroup,
    blockedByChildHero: requestedAdult && childPhotoHero,
  };
};

// ───────────── وصف الشخصيات ─────────────
const ANIMAL_RE =
  /\b(rabbit|bunny|cat|kitten|dog|puppy|bird|owl|bear|fox|lion|tiger|elephant|monkey|deer|sheep|lamb|duck|frog|turtle|fish|mouse|wolf|horse|dragon|robot|fairy|creature|animal|squirrel|hedgehog|panda|giraffe|penguin|butterfly|bee)\b/i;

export const isNonHumanDescription = (desc: string): boolean => ANIMAL_RE.test(desc);

const FRUIT_WORDS: [string, RegExp][] = [
  ['pomegranate', /\b(pomegranate)\b|(^|[^؀-ۿ])(ال)?(رمان|رمانة|جلنار)($|[^؀-ۿ])/i],
  ['lemon', /\b(lemon|citrus)\b|(^|[^؀-ۿ])(ال)?(ليمون|ليمونة)($|[^؀-ۿ])/i],
  ['mango', /\b(mango)\b|(^|[^؀-ۿ])(ال)?(مانجو|مانجا)($|[^؀-ۿ])/i],
  ['apple', /\b(apple)\b|(^|[^؀-ۿ])(ال)?(تفاح|تفاحة)($|[^؀-ۿ])/i],
  ['apricot', /\b(apricot)\b|(^|[^؀-ۿ])(ال)?(مشمش|مشمشة)($|[^؀-ۿ])/i],
  ['strawberry', /\b(strawberry|berry)\b|(^|[^؀-ۿ])(ال)?(فراولة|توت)($|[^؀-ۿ])/i],
  ['orange', /\b(orange|tangerine)\b|(^|[^؀-ۿ])(ال)?(برتقال|برتقالة)($|[^؀-ۿ])/i],
  ['banana', /\b(banana)\b|(^|[^؀-ۿ])(ال)?(موز|موزة)($|[^؀-ۿ])/i],
  ['peach', /\b(peach)\b|(^|[^؀-ۿ])(ال)?(خوخ|خوخة)($|[^؀-ۿ])/i],
  ['grape', /\b(grape)\b|(^|[^؀-ۿ])(ال)?(عنب|عنبة)($|[^؀-ۿ])/i],
  ['watermelon', /\b(watermelon)\b|(^|[^؀-ۿ])(ال)?(بطيخ|بطيخة)($|[^؀-ۿ])/i],
  ['fig', /\b(fig)\b|(^|[^؀-ۿ])(ال)?(تين|تينة)($|[^؀-ۿ])/i],
  ['fruit', /\b(fruit)\b|(^|[^؀-ۿ])(ال)?(فاكهة|فواكه)($|[^؀-ۿ])/i],
];

// نوع الفاكهة للشخصية نفسها (اسمها ووصفها فقط) أو null؛ بحدود كلمات كاملة
export const detectCharacterFruit = (name: string, description: string): string | null => {
  const text = ` ${name ?? ''} ${description ?? ''} `;
  // وصف حيوان/إنسان صريح ("rabbit holding an apple") لا يجعل الشخصية فاكهة
  const head = (description ?? '').split(/[,;.]/)[0] ?? '';
  const hit = FRUIT_WORDS.find(([, re]) => re.test(text));
  if (!hit) return null;
  if (isNonHumanDescription(head) && !/\bfruit character\b|\bfruit\b.*\bwith (a )?face\b/i.test(description)) {
    const fruitAsSubject = new RegExp(`\\b${hit[0]}\\b[^,.;]*\\b(character|hero|prince|princess|kid|child)\\b`, 'i');
    if (!fruitAsSubject.test(description)) return null;
  }
  return hit[0];
};

// نسبة التقاط صور الصفحات: القصص 4:3 تُرسم 16:9 (لقطة أوسع للفيديو) ويُقصّ العرض عند الطباعة والقراءة؛ غيرها دون تغيير
export const captureAspectFor = (storyAspect: string | undefined): string => (!storyAspect || storyAspect === '4:3' ? '16:9' : storyAspect);
export const isWideCapture = (storyAspect: string | undefined): boolean => captureAspectFor(storyAspect) !== (storyAspect || '4:3');
