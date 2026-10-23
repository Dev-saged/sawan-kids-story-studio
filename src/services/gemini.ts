import { AudienceLevel, Character, Language, NameAnalysis, QuizItem, StoryData, StoryParams, StoryPage } from '../types';
import { FIRST_BATCH_PAGES, MAX_IDEA_LENGTH, MAX_STORY_PAGES, NEXT_BATCH_PAGES } from '../constants';
import {
  POSITIVE_ILLUSTRATION_DIRECTIVE,
  STYLE_CONSISTENCY_PRESETS,
  artDirectionLine,
  detectCharacterFruit,
  getStyleLock,
  isNonHumanDescription,
  resolveAudience,
  resolveStyleConsistencyKeywords,
  stripBrandNames,
  type StyleConsistencyPreset,
} from '../shared/modelRules';
import { ApiError, authHeaders, codeFromStatus, postJson, trackApiCall } from './api';
import { base64ToBlob } from './media';

export const API_KEY_MISSING = 'API_KEY_MISSING';

export { STYLE_CONSISTENCY_PRESETS, resolveStyleConsistencyKeywords, type StyleConsistencyPreset };

export interface PromptClassificationInput {
  idea?: string;
  scenePrompt?: string;
  ageGroup?: string;
  audienceLevel?: AudienceLevel;
  adultMode?: boolean;
  heroAgeStage?: 'child' | 'teen' | 'adult';
  heroPhotoId?: string;
  hasHeroPhoto?: boolean;
  artStyle?: string;
  styleConsistency?: string;
  characters?: Character[];
}

export interface PromptClassificationResult {
  targetAudience: 'adult' | 'children';
  audienceLevel: AudienceLevel;
  styleConsistency: string;
  qaModifiers: string;
  toneDirective: string;
  blockedByChildHero: boolean;
}

// تعديلات جودة قصيرة وصادقة (بلا مبالغات)؛ للكبار نضيف نسب بالغة
export const buildQualityAssuranceModifiers = (targetAudience: 'adult' | 'children', _artStyle?: string): string =>
  targetAudience === 'adult'
    ? 'cinematic lighting, sharp focus, detailed textures, realistic adult proportions'
    : 'cinematic lighting, sharp focus, detailed textures, clean coherent anatomy';

const isAdultCharacter = (c: Character): boolean => {
  const n = parseInt(String(c.age ?? '').replace(/[^\d]/g, ''), 10);
  if (!Number.isNaN(n)) return n >= 18;
  return /\b(adult|man|woman)\b|بالغ|رجل|امرأة|امراة/i.test(`${c.age ?? ''} ${c.gender ?? ''}`);
};

// قرار الجمهور حتمي: الاختيار الصريح فقط، أو ألبوم كل شخصياته بالغة. نص الفكرة لا يقلب الجمهور أبداً.
export const classifyStoryPrompt = (input: PromptClassificationInput): PromptClassificationResult => {
  const album = input.characters ?? [];
  const allAlbumAdult = album.length > 0 && album.every(isAdultCharacter);
  const decision = resolveAudience({
    audienceLevel: input.audienceLevel,
    ageGroup: input.ageGroup,
    adultMode: Boolean(input.adultMode) || allAlbumAdult,
    heroAgeStage: input.heroAgeStage,
    heroPhotoId: input.heroPhotoId,
    hasHeroPhoto: input.hasHeroPhoto,
  });
  const targetAudience: 'adult' | 'children' = decision.adult ? 'adult' : 'children';
  return {
    targetAudience,
    audienceLevel: decision.audienceLevel,
    styleConsistency: (input.styleConsistency ?? '').trim() || 'auto',
    qaModifiers: buildQualityAssuranceModifiers(targetAudience, input.artStyle),
    toneDirective: decision.adult
      ? 'Target Audience: ADULTS (18+). Use sophisticated literary prose and depict adult protagonists with mature proportions.'
      : 'Target Audience: CHILDREN. Use warm, imaginative, age-appropriate storytelling and expressive storybook visuals.',
    blockedByChildHero: decision.blockedByChildHero,
  };
};

// القصة "للكبار" بقرار صريح محفوظ في القصة نفسها؛ لا استنتاج من أوصاف الشخصيات
export const isAdultStory = (story: StoryData): boolean =>
  story.audienceLevel === 'adults' ||
  story.story_info?.audienceLevel === 'adults' ||
  story.story_info?.age_group === '18+' ||
  Boolean(story.story_info?.adultMode);

export const getArtStylePrompt = (
  style: string,
  ageGroup?: string,
  styleConsistency?: string,
  audienceLevel?: AudienceLevel
): string => {
  const adult = audienceLevel === 'adults' || ageGroup === '18+';
  const base = artDirectionLine(style, adult);
  const lock = getStyleLock(styleConsistency);
  return lock ? `${base}; ${lock}` : base;
};

const wordsOf = (text: string): string[] => text.trim().split(/\s+/).filter(Boolean);
const countWords = (text: string): number => wordsOf(text).length;
const capWords = (text: string, maxWords: number): string => {
  if (maxWords <= 0) return '';
  const w = wordsOf(text);
  return w.length <= maxWords ? w.join(' ') : w.slice(0, maxWords).join(' ');
};

// فاكهة فقط إن اختارها المستخدم صراحةً، أو كانت شخصية بعينها فاكهة (لا نص الصفحات ولا العنوان)
export const isFruitStory = (story: StoryData): boolean =>
  Boolean(story.story_info?.fruitFantasy) || (story.characters ?? []).some((c) => detectCharacterFruit(c.name, c.description));

const fruitKindOf = (c: Character, story: StoryData): string | null => {
  const own = detectCharacterFruit(c.name, c.description);
  if (own) return own;
  return story.story_info?.fruitFantasy ? 'fruit' : null;
};

export const fruitThemeBoost = (story: StoryData, character?: Character): string => {
  const c = character ?? story.characters?.[0];
  if (!c) return '';
  const kind = fruitKindOf(c, story);
  return kind ? `a cute ${kind} character with a face and limbs` : '';
};

const LATIN_ONLY = (s: string): string =>
  s
    .replace(/[^\u0000-ɏ‐-―‘-‟]+/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\s+([,.;:])/g, '$1')
    .trim();

// وسم النضج لكل شخصية على حدة: لا يُطبّق على الحيوانات والفواكه والكائنات الخيالية
const buildCharacterMaturityTag = (c: Character, story: StoryData): string => {
  const desc = c.description || '';
  if (isNonHumanDescription(desc) || fruitKindOf(c, story)) return '';
  if (/\b(adult|man|woman|boy|girl|child|kid|toddler|baby|teen|teenager|year-old|years old|elderly|old)\b/i.test(desc)) return '';
  const numAge = parseInt(String(c.age ?? '').replace(/[^\d]/g, ''), 10);
  const female = /\b(female|woman|girl)\b|أنثى|امرأة|امراة|بنت|فتاة/i.test(`${c.gender ?? ''} ${c.age ?? ''}`);
  const male = /\b(male|man|boy)\b|ذكر|رجل|ولد|صبي/i.test(`${c.gender ?? ''} ${c.age ?? ''}`);
  if (!Number.isNaN(numAge)) {
    if (numAge >= 18) return `adult ${numAge}-year-old ${female ? 'woman' : male ? 'man' : 'person'}, `;
    if (numAge >= 13) return `${numAge}-year-old teenage ${female ? 'girl' : male ? 'boy' : 'teen'}, `;
    return '';
  }
  if (isAdultStory(story)) return `adult ${female ? 'woman' : male ? 'man' : 'person'}, `;
  if (story.story_info?.age_group === '13-18') return `teenage ${female ? 'girl' : male ? 'boy' : 'teen'}, `;
  return '';
};

// سطر الشخصية بالإنجليزية فقط (النموذج يرى اسماً لاتينياً + وصفاً)، ضمن حد كلمات
const formatCharacterLine = (c: Character, story: StoryData, maxWords = 18): string => {
  const fallback = isAdultStory(story) ? 'adult protagonist' : 'friendly young hero';
  const baseDesc = LATIN_ONLY((c.description || c.personality || '').replace(/\bVisual anchor:.*$/i, '')) || fallback;
  const fruit = fruitThemeBoost(story, c);
  const tag = buildCharacterMaturityTag(c, story);
  const latinName = LATIN_ONLY(c.name ?? '');
  const firstToken = latinName.toLowerCase().split(' ')[0];
  const startsWithName =
    (Boolean(firstToken) && baseDesc.toLowerCase().startsWith(firstToken)) || /^(?!(?:A|An|The|Adult|Young|Little|Small|Tall)\b)[A-Z][A-Za-z'-]+(?:[,:]|\s)/.test(baseDesc);
  let raw: string;
  if (fruit) raw = `${startsWithName ? '' : latinName ? `${latinName}: ` : ''}${fruit}, ${baseDesc}`;
  else if (startsWithName && tag) {
    const [head, ...tail] = baseDesc.split(' ');
    raw = `${head.replace(/,$/, '')}, ${tag}${tail.join(' ')}`;
  } else raw = `${!startsWithName && latinName ? `${latinName}: ` : ''}${tag}${baseDesc}`;
  return capWords(stripBrandNames(raw), maxWords);
};


// مطابقة الشخصيات الظاهرة في الصفحة (سواء بالاسم الكامل أو بأجزاء الاسم أو الاسم الإنجليزي في الوصف)
export const getCharactersForPage = (story: StoryData, page?: StoryPage): Character[] => {
  const chars = story.characters ?? [];
  if (!chars.length) return [];
  if (!page) return chars;
  const haystack = `${page.text ?? ''} ${page.image_prompt ?? ''}`.toLowerCase();
  const matched = chars.filter((c) => {
    const fullName = c.name?.trim().toLowerCase();
    if (fullName && haystack.includes(fullName)) return true;
    const nameTokens = (fullName || '').split(/\s+/).filter((t) => t.length >= 3);
    if (nameTokens.some((tok) => haystack.includes(tok))) return true;
    const engMatch = /^([a-z]{3,20})\b/i.exec((c.description || '').trim());
    if (engMatch && haystack.includes(engMatch[1].toLowerCase())) return true;
    return false;
  });
  return matched.length > 0 ? matched : chars.slice(0, 2);
};

// أ1 + أ3: تجميع الطلب مع سقف صارم 120 كلمة؛ إن تجاوز نقصّ وصف الشخصيات أولاً ثم الأسلوب، ولا نقصّ المشهد أبداً
const assemblePromptWithWordCap = (
  sceneLine: string,
  charactersLine: string,
  styleLine: string,
  directiveLine: string,
  maxTotalWords = 120
): string => {
  const scene = sceneLine.trim();
  let directive = directiveLine.trim();
  let chars = charactersLine.trim();
  let style = styleLine.trim();

  const total = () => countWords([scene, chars, style, directive].filter(Boolean).join(' '));

  if (total() > maxTotalWords) {
    // 1) قصّ وصف الشخصيات أولاً
    const fixedWithoutChars = countWords([scene, style, directive].filter(Boolean).join(' '));
    const allowedForChars = Math.max(0, maxTotalWords - fixedWithoutChars);
    chars = capWords(chars, allowedForChars);
  }

  if (total() > maxTotalWords) {
    // 2) قصّ الأسلوب ثانياً
    const fixedWithoutStyle = countWords([scene, chars, directive].filter(Boolean).join(' '));
    const allowedForStyle = Math.max(0, maxTotalWords - fixedWithoutStyle);
    style = capWords(style, allowedForStyle);
  }

  if (total() > maxTotalWords) {
    // 3) إذا بقي المجموع أكبر من 120 بسبب طول المشهد، نقلص التوجيه الإيجابي دون المساس بالمشهد أبداً
    chars = '';
    style = '';
    const allowedForDirective = Math.max(0, maxTotalWords - countWords(scene));
    directive = capWords(directive, allowedForDirective);
  }

  return [scene, chars, style, directive].filter(Boolean).join('\n');
};

export type SentimentTone = 'happy' | 'sad' | 'mysterious' | 'tense' | 'wonder' | 'serene';

export interface SentimentPaletteAnalysis {
  sentiment: SentimentTone;
  paletteDescriptor: string;
  label: { ar: string; en: string };
  swatchHex: string;
}

const SENTIMENT_CONFIG: Record<
  SentimentTone,
  {
    paletteDescriptor: string;
    label: { ar: string; en: string };
    swatchHex: string;
    regex: RegExp;
  }
> = {
  happy: {
    paletteDescriptor: 'warm glowing colors, sunlit golden highlights, vibrant joyful palette',
    label: { ar: 'مبهج ودافئ (ألوان متوهجة دافئة)', en: 'Joyful & Warm (Warm Glowing Colors)' },
    swatchHex: '#f59e0b',
    regex:
      /\b(happy|happily|joy|joyful|smile|smiled|smiling|laugh|laughed|laughing|cheer|cheerful|celebrate|celebration|party|dance|dancing|sunny|bright|win|won|victory|hug|hugged|love|loved|excited|delight|play|playing|fun|feast|triumph)\b|سعيد|سعادة|فرح|فرحة|ابتسم|ابتسامة|ضحك|يضحك|تضحك|مرح|احتفال|عيد|رقص|يرقص|مشرق|فوز|انتصار|عناق|حضن|حب|حماس|بهجة|يلعب|تلعب|لعب|سرور|مبتهج/gi,
  },
  sad: {
    paletteDescriptor: 'deep moody shadows, muted atmospheric blues, melancholic cool tones',
    label: { ar: 'حزين وشاعري (ظلال عميقة وباردة)', en: 'Melancholic (Deep Moody Shadows)' },
    swatchHex: '#3b82f6',
    regex:
      /\b(sad|sadly|sadness|cry|cried|crying|tear|tears|lonely|alone|lost|grief|sorrow|miss|missed|missing|rain|rainy|cold|broken|hurt|pain|afraid|fear|weeping|wept|melancholy|gloomy|sigh|sighed)\b|حزين|حزن|بكى|بكت|يبكي|تبكي|دموع|دمعة|وحيد|وحدة|ضاع|ضائع|فقد|شوق|مشتاق|مطر|بارد|مكسور|ألم|جرح|خوف|خائف|كئيب|تنهد|أسى|غصة|وداع/gi,
  },
  tense: {
    paletteDescriptor: 'dramatic high-contrast amber and obsidian shadows, intense storm-lit atmosphere',
    label: { ar: 'مشوّق وحماسي (تباين درامي عالٍ)', en: 'Dramatic & Tense (High-Contrast Shadows)' },
    swatchHex: '#ef4444',
    regex:
      /\b(danger|dangerous|storm|thunder|lightning|chase|chased|escape|battle|fight|fire|monster|threat|urgent|trap|roar|scream|crisis|cliff|falling|clash)\b|خطر|عاصفة|رعد|برق|مطاردة|هرب|يهرب|معركة|قتال|نار|وحش|تهديد|فخ|زئير|صرخة|أزمة|هاوية|انفجار|صراع|مواجهة/gi,
  },
  mysterious: {
    paletteDescriptor: 'enigmatic twilight indigo, dramatic chiaroscuro shadows, mystic glow',
    label: { ar: 'غامض وساحر (نيلي الغسق وظلال غامضة)', en: 'Mysterious (Twilight Indigo & Shadows)' },
    swatchHex: '#6366f1',
    regex:
      /\b(mystery|mysterious|secret|hidden|whisper|whispered|ancient|riddle|puzzle|fog|mist|cave|labyrinth|unknown|clue|locked|shadowy|enigma|cryptic|twilight)\b|غموض|غامض|سر|سري|مخفي|همس|يهمس|قديم|أثري|لغز|أحجية|ضباب|كهف|متاهة|مجهول|مفتاح|باب مغلق|خفي|طلسم/gi,
  },
  wonder: {
    paletteDescriptor: 'luminous iridescent colors, enchanted bioluminescent glow, jewel-toned palette',
    label: { ar: 'خيالي مدهش (ألوان متلألئة ساحرة)', en: 'Magical Wonder (Luminous Iridescent Colors)' },
    swatchHex: '#a855f7',
    regex:
      /\b(magic|magical|enchanted|wonder|miracle|sparkle|sparkling|glow|glowing|galaxy|fairy|dragon|flying|crystal|treasure|portal|spell|cosmic)\b|سحر|سحري|مسحور|عجيب|معجزة|بريق|يتلألأ|مجرة|جنية|تنين|تحليق|بلورة|كريستال|كنز|بوابة|تعويذة|كوني/gi,
  },
  serene: {
    paletteDescriptor: 'soft tranquil pastel hues, gentle moonlit silver and warm lantern glow',
    label: { ar: 'هادئ ومطمئن (ألوان باستيل هادئة)', en: 'Serene & Calm (Soft Tranquil Hues)' },
    swatchHex: '#14b8a6',
    regex:
      /\b(calm|peace|peaceful|quiet|sleep|sleeping|bedtime|moon|breeze|gentle|soft|rest|garden|river|meditate|still|harmony|lullaby)\b|هدوء|هادئ|سلام|طمأنينة|سكينة|نوم|ينام|قمر|نسيم|لطيف|ناعم|راحة|حديقة|نهر|تأمل|تهويدة|أمان/gi,
  },
};

const NEUTRAL_PALETTE = 'balanced natural colors, soft daylight';

// المزاج القادم من النموذج هو المرجع؛ التحليل بالكلمات احتياطي ولا يُطبَّق إلا بدليل كافٍ (نتيجتان فأكثر)
export const analyzeTextSentimentAndPalette = (text: string, scenePrompt = '', mood?: string): SentimentPaletteAnalysis => {
  const cleanText = String(text ?? '');
  const cleanScene = String(scenePrompt ?? '');
  const order: SentimentTone[] = ['happy', 'sad', 'tense', 'mysterious', 'wonder', 'serene'];

  if (mood && (order as string[]).includes(mood)) {
    const c = SENTIMENT_CONFIG[mood as SentimentTone];
    return { sentiment: mood as SentimentTone, paletteDescriptor: c.paletteDescriptor, label: c.label, swatchHex: c.swatchHex };
  }

  let bestTone: SentimentTone = 'serene';
  let bestScore = 0;
  for (const tone of order) {
    const cfg = SENTIMENT_CONFIG[tone];
    const score = (cleanText.match(cfg.regex) ?? []).length * 2 + (cleanScene.match(cfg.regex) ?? []).length;
    if (score > bestScore) {
      bestScore = score;
      bestTone = tone;
    }
  }

  if (bestScore < 2) {
    const night = /\b(night|moon|sleep|stars|evening)\b|ليل|قمر|نوم|مساء/i.test(`${cleanText} ${cleanScene}`);
    const c = SENTIMENT_CONFIG[night ? 'serene' : 'happy'];
    return {
      sentiment: night ? 'serene' : 'happy',
      paletteDescriptor: night ? c.paletteDescriptor : NEUTRAL_PALETTE,
      label: c.label,
      swatchHex: c.swatchHex,
    };
  }

  const chosen = SENTIMENT_CONFIG[bestTone];
  return { sentiment: bestTone, paletteDescriptor: chosen.paletteDescriptor, label: chosen.label, swatchHex: chosen.swatchHex };
};

const styleLineFor = (story: StoryData, palette?: string): string => {
  const adult = isAdultStory(story);
  const base = getArtStylePrompt(
    story.story_info.art_style,
    story.story_info.age_group,
    story.styleConsistency || story.story_info.styleConsistency,
    adult ? 'adults' : 'kids'
  );
  return `Style: ${base}.${palette ? ` Palette: ${palette}.` : ''}`;
};

export const charactersLineFor = (story: StoryData, chars: Character[], maxWords: number): string =>
  chars.length ? `Characters: ${chars.map((c) => formatCharacterLine(c, story, maxWords)).join('; ')}.` : '';

// مصدر واحد للتجميع: Scene ثم Characters ثم Style ثم التوجيه (<= 120 كلمة)، ولا يُضاف شيء بعد السقف
export const buildPageImagePrompt = (story: StoryData, page: StoryPage): string => {
  const adult = isAdultStory(story);
  const defaultScene = adult ? 'A cinematic illustration of the main adult character in the story setting' : 'A colorful storybook illustration';
  const rawScene = (page.image_prompt || page.text || defaultScene).trim().replace(/\.+$/, '');
  const correction = page.correctionNote?.trim() ? ` Correction: ${page.correctionNote.trim().replace(/\.+$/, '')}.` : '';
  const sentiment = analyzeTextSentimentAndPalette(page.text || '', page.image_prompt || '', page.mood);
  return assemblePromptWithWordCap(
    `Scene: ${stripBrandNames(rawScene)}.${correction}`,
    charactersLineFor(story, getCharactersForPage(story, page), 18),
    styleLineFor(story, sentiment.paletteDescriptor),
    POSITIVE_ILLUSTRATION_DIRECTIVE,
    120
  );
};

export const buildCoverPrompt = (story: StoryData): string => {
  const adult = isAdultStory(story);
  const defaultCover = adult ? 'Cinematic book cover illustration featuring the adult protagonist' : 'Heroic book cover illustration';
  const rawCover = (story.cover_image_prompt || story.pages[0]?.image_prompt || defaultCover).trim().replace(/\.+$/, '');
  const genre = ` Genre: ${story.story_info.story_type || 'Adventure'} (no text in image).`;
  const first = story.pages?.[0];
  const sentiment = analyzeTextSentimentAndPalette(`${story.story_info.title || ''} ${first?.text || ''}`, story.cover_image_prompt || first?.image_prompt || '', first?.mood);
  return assemblePromptWithWordCap(
    `Scene: ${stripBrandNames(rawCover)}.${genre}`,
    charactersLineFor(story, (story.characters ?? []).slice(0, 2), 18),
    styleLineFor(story, sentiment.paletteDescriptor),
    POSITIVE_ILLUSTRATION_DIRECTIVE,
    120
  );
};

export const buildSheetPrompt = (story: StoryData, withPhoto: boolean, simplified = false): string => {
  const photoNote = withPhoto ? ' Primary hero matches the attached reference photo.' : '';
  const sceneLine = simplified
    ? `Character reference sheet: Simple front-view model sheet on plain background.${photoNote}`
    : `Character reference sheet: Full-body turnaround model sheet on clean plain background.${photoNote}`;
  return assemblePromptWithWordCap(
    sceneLine,
    charactersLineFor(story, story.characters ?? [], simplified ? 12 : 18),
    styleLineFor(story),
    POSITIVE_ILLUSTRATION_DIRECTIVE,
    120
  );
};

// ب5: بناء وصف مشهد مصحح عند ضغط المستخدم على «الصورة لا تطابق»
export const applySceneCorrection = (originalPrompt: string, correction: string): string => {
  const cleanPrompt = originalPrompt.replace(/\s*Correction:[\s\S]*$/i, '').trim().replace(/\.+$/, '');
  const cleanCorrection = correction.trim().replace(/\.+$/, '');
  if (!cleanCorrection) return cleanPrompt;
  return `${cleanPrompt}. Correction: ${cleanCorrection}.`;
};

// ب6: اقتراح 3 عناوين بديلة بنفس اللغة واللهجة
export const suggestAlternativeTitles = async (story: StoryData, signal?: AbortSignal): Promise<string[]> => {
  const summary = story.pages.slice(0, 5).map((p) => p.text).join(' ').slice(0, 900);
  const data = await postJson<{ titles: string[] }>(
    '/api/suggest-titles',
    {
      currentTitle: story.story_info.title,
      language: story.story_info.language,
      dialect: story.story_info.dialect,
      summary,
    },
    signal,
    2
  );
  if (!Array.isArray(data?.titles) || !data.titles.length) {
    throw new ApiError('FAILED', 'Could not generate title suggestions.', undefined, '/api/suggest-titles');
  }
  return data.titles.slice(0, 3);
};

// ب2: «حسّن فكرتي» — تنقية المدخلات، التحقق من المخرجات وقصّ الطول (40-70 كلمة)، التراجع، وحدّ الطلبات (طلب كل 3 ثوانٍ)
export const IMPROVE_IDEA_COOLDOWN_MS = 3000;

export const sanitizeUserIdeaText = (text: string): string =>
  String(text ?? '')
    .replace(/<[^>]*>/g, '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_IDEA_LENGTH);

export const canRequestImproveIdea = (lastRequestAt: number, now = Date.now()): boolean => {
  if (!lastRequestAt || lastRequestAt <= 0) return true;
  return now - lastRequestAt >= IMPROVE_IDEA_COOLDOWN_MS;
};

export const validateAndClipImprovedIdeas = (
  raw: unknown,
  maxWords = 70,
  maxChars = MAX_IDEA_LENGTH
): string[] => {
  const arr = Array.isArray(raw)
    ? raw
    : raw && typeof raw === 'object' && Array.isArray((raw as { suggestions?: unknown[] }).suggestions)
      ? (raw as { suggestions: unknown[] }).suggestions
      : [];
  const out: string[] = [];
  for (const item of arr) {
    if (typeof item !== 'string') continue;
    const stripped = sanitizeUserIdeaText(item);
    if (!stripped) continue;
    const clippedWords = capWords(stripped, maxWords);
    const bounded = clippedWords.slice(0, maxChars).trim();
    if (countWords(bounded) >= 5) {
      out.push(bounded);
    }
    if (out.length === 3) break;
  }
  return out;
};

export const applyImprovedIdeaWithUndo = (
  currentIdea: string,
  previousOriginal: string | null,
  selectedSuggestion: string
): { nextIdea: string; originalIdea: string } => {
  const originalIdea = previousOriginal !== null ? previousOriginal : currentIdea;
  const nextIdea = sanitizeUserIdeaText(selectedSuggestion);
  return { nextIdea, originalIdea };
};

export const restoreOriginalIdea = (
  originalIdea: string | null,
  currentIdea: string
): { restoredIdea: string; originalIdea: null } => ({
  restoredIdea: originalIdea !== null ? originalIdea : currentIdea,
  originalIdea: null,
});

let lastImproveIdeaRequestAt = 0;
export const resetImproveIdeaCooldownForTests = () => {
  lastImproveIdeaRequestAt = 0;
};

export interface ImproveIdeaParams {
  idea: string;
  language: Language;
  dialect: string;
  storyType: string;
  ageGroup: string;
}

export const improveStoryIdea = async (params: ImproveIdeaParams, signal?: AbortSignal): Promise<string[]> => {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    throw new ApiError('OFFLINE', 'لا يوجد اتصال بالإنترنت حالياً.', undefined, '/api/improve-idea');
  }
  const cleanIdea = sanitizeUserIdeaText(params.idea);
  if (countWords(cleanIdea) < 3) {
    throw new ApiError('FAILED', 'يرجى كتابة 3 كلمات على الأقل قبل تحسين الفكرة.', undefined, '/api/improve-idea');
  }
  const now = Date.now();
  if (!canRequestImproveIdea(lastImproveIdeaRequestAt, now)) {
    throw new ApiError('BUSY', 'يرجى الانتظار 3 ثوانٍ قبل طلب تحسين جديد.', undefined, '/api/improve-idea');
  }
  lastImproveIdeaRequestAt = now;

  const data = await postJson<{ suggestions: string[] }>(
    '/api/improve-idea',
    {
      idea: cleanIdea,
      language: params.language,
      dialect: params.dialect,
      storyType: params.storyType,
      ageGroup: params.ageGroup,
    },
    signal,
    2
  );
  const validated = validateAndClipImprovedIdeas(data, 70, MAX_IDEA_LENGTH);
  if (validated.length < 3) {
    throw new ApiError('FAILED', 'تعذر توليد 3 صياغات محسّنة مكتملة. حاول مرة أخرى.', undefined, '/api/improve-idea');
  }
  return validated;
};

export interface ProgressInfo {
  progress: number;
  message: string;
  preview?: string;
}

// استخراج آخر نص صفحة مكتمل من JSON جزئي أثناء البث
const PAGE_TEXT_RE = /"text"\s*:\s*"((?:[^"\\]|\\.)*)"/g;
const extractPreview = (raw: string): { count: number; last?: string } => {
  let count = 0;
  let last: string | undefined;
  for (const m of raw.matchAll(PAGE_TEXT_RE)) {
    count++;
    try {
      last = JSON.parse(`"${m[1]}"`);
    } catch {
      last = m[1];
    }
  }
  return { count, last };
};

const validQuiz = (quiz?: QuizItem[]): QuizItem[] => (quiz ?? []).filter((q) => q?.question && Array.isArray(q.options) && q.options.length >= 2);

const MOODS: SentimentTone[] = ['happy', 'sad', 'tense', 'mysterious', 'wonder', 'serene'];

const cleanPage = (p: Partial<StoryPage>): StoryPage => ({
  page: 0,
  text: (p.text ?? '').trim(),
  narration: (p.narration ?? '').trim() || (p.text ?? '').trim(),
  image_prompt: p.image_prompt ?? '',
  ...(p.mood && MOODS.includes(p.mood) ? { mood: p.mood } : {}),
  ...(p.chapter?.trim() ? { chapter: p.chapter.trim() } : {}),
});

// دفعة صفحات من قصة طويلة
export interface StoryBatch {
  pages: StoryPage[];
  final: boolean;
  quiz?: QuizItem[];
  moral?: string;
  lessons?: string[];
}

export const applyBatch = (s: StoryData, b: StoryBatch): StoryData => {
  const base = s.pages.length;
  const pages = [...s.pages, ...b.pages.map((p, i) => ({ ...p, page: base + i + 1 }))];
  const complete = b.final || pages.length >= (s.plannedPages ?? pages.length);
  return {
    ...s,
    pages,
    plannedPages: complete ? undefined : s.plannedPages,
    ...(b.final
      ? {
          quiz: b.quiz?.length ? b.quiz : s.quiz,
          story_info: { ...s.story_info, moral: b.moral || s.story_info.moral, lessons: b.lessons?.length ? b.lessons : s.story_info.lessons },
        }
      : {}),
  };
};

export const isIncomplete = (s: StoryData): boolean => Boolean(s.plannedPages && s.pages.length < s.plannedPages);

// يكتب بقية القصة دفعة بعد دفعة؛ كل دفعة ناجحة تُسلَّم فوراً عبر append فلا يضيع شيء إن انقطع الطلب
export const continueStory = async (
  get: () => StoryData,
  append: (batch: StoryBatch) => void,
  onProgress?: (done: number, total: number) => void,
  signal?: AbortSignal,
  gate?: () => Promise<void>
): Promise<void> => {
  let work = get();
  while (work.plannedPages && work.pages.length < work.plannedPages) {
    await gate?.();
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    const remaining = work.plannedPages - work.pages.length;
    const count = Math.min(NEXT_BATCH_PAGES, remaining);
    const final = remaining <= count;
    const texts = work.pages.map((p) => p.text);
    const data = await postJson<{ pages: Partial<StoryPage>[]; quiz?: QuizItem[]; moral?: string; lessons?: string[] }>(
      '/api/continue-story',
      {
        story: {
          title: work.story_info.title,
          language: work.story_info.language,
          dialect: work.story_info.dialect,
          ageGroup: work.story_info.age_group,
          artStyle: work.story_info.art_style,
          storyType: work.story_info.story_type,
          characters: work.characters,
          earlier: texts.slice(0, -3).map((t) => t.slice(0, 160)),
          recent: texts.slice(-3),
        },
        from: work.pages.length + 1,
        count,
        total: work.plannedPages,
        final,
      },
      signal,
      3
    );
    const pages = (data?.pages ?? []).map(cleanPage).filter((p) => p.text);
    if (!pages.length) throw new ApiError('FAILED', 'Empty batch.', undefined, '/api/continue-story');
    const batch: StoryBatch = { pages, final, quiz: validQuiz(data.quiz), moral: data.moral, lessons: data.lessons };
    work = applyBatch(work, batch);
    append(batch);
    onProgress?.(work.pages.length, work.plannedPages ?? work.pages.length);
  }
};

export interface GeneratorLogEntry {
  timestamp: string;
  level: 'info' | 'warn' | 'error';
  stage: string;
  message: string;
  data?: unknown;
}

const generatorLogs: GeneratorLogEntry[] = [];
export const getGeneratorLogs = (): GeneratorLogEntry[] => [...generatorLogs];

export class StoryGenerator {
  private isPaused = false;
  private resumeResolver: (() => void) | null = null;

  private log(level: 'info' | 'warn' | 'error', stage: string, message: string, data?: unknown): void {
    const entry: GeneratorLogEntry = {
      timestamp: new Date().toISOString(),
      level,
      stage,
      message,
      data,
    };
    generatorLogs.push(entry);
    if (generatorLogs.length > 60) generatorLogs.shift();
    const prefix = `[StoryGenerator][${stage}]`;
    if (level === 'error') console.error(prefix, message, data ?? '');
    else if (level === 'warn') console.warn(prefix, message, data ?? '');
    else console.info(prefix, message, data ?? '');
  }

  public pause(): void {
    this.log('info', 'lifecycle', 'Story generation paused by user.');
    this.isPaused = true;
  }

  public resume(): void {
    this.log('info', 'lifecycle', 'Story generation resumed by user.');
    this.isPaused = false;
    if (this.resumeResolver) {
      this.resumeResolver();
      this.resumeResolver = null;
    }
  }

  private waitIfPaused(): Promise<void> {
    if (!this.isPaused) return Promise.resolve();
    return new Promise((resolve) => {
      this.resumeResolver = resolve;
    });
  }

  public static classifyPrompt(params: Partial<StoryParams>): PromptClassificationResult {
    return classifyStoryPrompt({
      idea: params.idea,
      ageGroup: params.ageGroup,
      audienceLevel: params.audienceLevel,
      adultMode: params.adultMode,
      heroAgeStage: params.heroAgeStage,
      heroPhotoId: params.series?.heroPhotoId ?? params.heroPhotoId,
      artStyle: params.artStyle,
      styleConsistency: params.styleConsistency,
      characters: params.customCharacters ?? params.series?.characters,
    });
  }

  public classifyPrompt(params: Partial<StoryParams>): PromptClassificationResult {
    return StoryGenerator.classifyPrompt(params);
  }

  public static analyzeSentiment(text: string, scenePrompt = ''): SentimentPaletteAnalysis {
    return analyzeTextSentimentAndPalette(text, scenePrompt);
  }

  public analyzeSentiment(text: string, scenePrompt = ''): SentimentPaletteAnalysis {
    return analyzeTextSentimentAndPalette(text, scenePrompt);
  }

  public async generate(rawParams: StoryParams, pageCount: number, onProgress: (info: ProgressInfo) => void): Promise<StoryData> {
    const classification = this.classifyPrompt(rawParams);
    const isClassifiedAdult = classification.targetAudience === 'adult';
    const params: StoryParams = {
      ...rawParams,
      idea: rawParams.idea.trim().slice(0, MAX_IDEA_LENGTH),
      audienceLevel: classification.audienceLevel,
      adultMode: isClassifiedAdult,
      ageGroup: isClassifiedAdult ? '18+' : rawParams.ageGroup === '18+' ? '7-9' : rawParams.ageGroup,
      styleConsistency: classification.styleConsistency,
    };
    const total = Math.min(Math.max(Math.round(pageCount) || 6, 3), MAX_STORY_PAGES);
    pageCount = total > 16 ? FIRST_BATCH_PAGES : total;
    if (!params.idea) throw new Error('Story idea cannot be empty.');
    const ar = params.language === 'Arabic';

    this.log('info', 'init', `Starting story generation: ${total} pages planned (batch 1: ${pageCount} pages).`, {
      language: params.language,
      dialect: params.dialect,
      artStyle: params.artStyle,
      styleConsistency: params.styleConsistency,
      storyType: params.storyType,
      ageGroup: params.ageGroup,
      audienceLevel: params.audienceLevel,
      targetAudience: classification.targetAudience,
      qaModifiers: classification.qaModifiers,
    });

    onProgress({ progress: 6, message: ar ? 'نجهّز فكرة القصة...' : 'Preparing your story...' });
    await this.waitIfPaused();

    if (navigator.onLine === false) {
      this.log('error', 'network', 'Device is offline.');
      throw new ApiError('OFFLINE');
    }

    const MAX_RETRIES = 3;
    let story: StoryData | null = null;
    let lastError: unknown = null;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        if (attempt > 0) {
          const backoffMs = Math.min(1500 * Math.pow(2, attempt) + Math.random() * 800, 10000);
          this.log('warn', 'retry', `Quota or rate limit encountered. Applying exponential backoff: waiting ${Math.round(backoffMs)}ms before retry ${attempt + 1}/${MAX_RETRIES + 1}...`);
          onProgress({
            progress: 8,
            message: ar
              ? `ننتظر لحظات لتخفيف الضغط على النموذج (${attempt + 1}/${MAX_RETRIES + 1})...`
              : `Stabilizing rate limit, retrying in ${Math.round(backoffMs / 1000)}s...`,
          });
          await new Promise((resolve) => setTimeout(resolve, backoffMs));
          await this.waitIfPaused();
        }

        this.log('info', 'request', `Sending /api/generate-story request (attempt ${attempt + 1})...`);
        const finishTracking = trackApiCall('/api/generate-story', 'POST', `attempt ${attempt + 1}, pages: ${pageCount}/${total}`);
        const res = await fetch('/api/generate-story', {
          method: 'POST',
          headers: authHeaders(),
          body: JSON.stringify({
            params,
            pageCount,
            totalPages: total,
            classification,
          }),
        });

        if (res.status === 429) {
          let errorData: any = {};
          try {
            errorData = await res.json();
          } catch {
            // ignore
          }
          finishTracking(429, errorData.error || 'Rate limit', 'QUOTA');
          this.log('warn', 'quota', `Received 429 Quota Exceeded from Gemini: ${errorData.error || 'Rate limit'}`);
          lastError = new ApiError('QUOTA', errorData.error, errorData.trail, '/api/generate-story');
          continue;
        }

        if (!res.ok || !res.body) {
          let errorData: any = {};
          try {
            errorData = await res.json();
          } catch {
            // ignore
          }
          const code = errorData.code ?? codeFromStatus(res.status);
          finishTracking(res.status, errorData.error, code);
          this.log('error', 'http_error', `Received HTTP ${res.status} from /api/generate-story`, errorData);
          throw new ApiError(code, errorData.error, errorData.trail, '/api/generate-story');
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let raw = '';
        let candidateStory: StoryData | null = null;

        const handle = (line: string) => {
          if (!line.trim()) return;
          const msg = JSON.parse(line);
          if (msg.t === 'chunk') {
            raw += msg.d;
            const { count, last } = extractPreview(raw);
            onProgress({
              progress: Math.min(94, 12 + Math.round((count / total) * 82)),
              message: ar ? `نكتب الصفحة ${Math.min(count + 1, pageCount)} من ${total}...` : `Writing page ${Math.min(count + 1, pageCount)} of ${total}...`,
              preview: last,
            });
          } else if (msg.t === 'reset') {
            raw = '';
          } else if (msg.t === 'done') {
            candidateStory = msg.story;
          } else if (msg.t === 'error') {
            const errCode = msg.code ?? 'FAILED';
            finishTracking(errCode === 'QUOTA' ? 429 : 500, msg.error, errCode);
            throw new ApiError(errCode, msg.error, msg.trail, '/api/generate-story');
          }
        };

        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() ?? '';
          lines.forEach(handle);
          await this.waitIfPaused();
        }
        handle(buffer);

        if (!candidateStory) {
          finishTracking(500, 'Empty story response', 'FAILED');
          throw new ApiError('FAILED', 'Empty story stream response', undefined, '/api/generate-story');
        }

        finishTracking(200);
        story = candidateStory;
        break;
      } catch (err: any) {
        lastError = err;
        const retryable = err instanceof ApiError && (err.code === 'QUOTA' || err.code === 'BUSY' || err.code === 'FAILED');
        if (retryable && attempt < MAX_RETRIES) {
          continue;
        }
        if (attempt >= MAX_RETRIES || !retryable) {
          this.log('error', 'exhausted', `Story generation failed after ${attempt + 1} attempt(s).`, err);
          throw err;
        }
      }
    }

    const parsed = story as StoryData | null;
    if (!parsed?.pages?.length || !parsed?.characters?.length) throw (lastError as Error) ?? new ApiError('FAILED');

    const albumRefId = params.customCharacters?.find((c) => c.referenceImageId)?.referenceImageId;

    let result: StoryData = {
      ...parsed,
      plannedPages: total > pageCount ? total : undefined,
      characterSheetId:
        params.series?.characterSheetId ??
        albumRefId ??
        parsed.characterSheetId ??
        `seed-${Date.now()}-${Math.floor(Math.random() * 89999 + 10000)}`,
      coverFontStyle: params.coverFontStyle,
      coverTextEffect: params.coverTextEffect,
      audienceLevel: params.audienceLevel,
      styleConsistency: params.styleConsistency,
      story_info: {
        ...parsed.story_info,
        age_group: params.ageGroup || parsed.story_info.age_group,
        audienceLevel: params.audienceLevel,
        adultMode: params.adultMode ?? params.ageGroup === '18+',
        lessons: parsed.story_info.lessons ?? [],
        art_style: params.artStyle,
        styleConsistency: params.styleConsistency,
        aspect_ratio: params.aspectRatio,
        dialect: params.dialect,
        story_type: params.storyType,
        fruitFantasy: params.fruitFantasy,
        themeTopic: params.themeTopic,
        coverFontStyle: params.coverFontStyle,
        coverTextEffect: params.coverTextEffect,
      },
      heroPhotoId: params.series?.heroPhotoId ?? params.heroPhotoId,
      ...(params.series
        ? {
            characters: params.series.characters,
            characterSheetId: params.series.characterSheetId,
            seriesId: params.series.seriesId,
            seriesTitle: params.series.seriesTitle,
            partNumber: params.series.partNumber,
          }
        : {}),
      quiz: validQuiz(parsed.quiz),
      pages: parsed.pages.slice(0, pageCount).map((p, i) => ({ ...cleanPage(p), page: i + 1 })),
    };

    if (isIncomplete(result)) {
      let current = result;
      try {
        await continueStory(
          () => current,
          (batch) => {
            current = applyBatch(current, batch);
          },
          (done, all) =>
            onProgress({
              progress: Math.min(97, 12 + Math.round((done / all) * 85)),
              message: ar ? `نكتب الفصل التالي... ${done} من ${all}` : `Writing the next chapter... ${done} of ${all}`,
              preview: current.pages[current.pages.length - 1]?.text,
            }),
          undefined,
          () => this.waitIfPaused()
        );
      } catch {
        // الخطأ مسجّل في «تفاصيل تقنية»؛ نكمل بما كُتب
      }
      result = current;
    }

    onProgress({ progress: 100, message: ar ? 'القصة جاهزة!' : 'Story ready!' });
    return result;
  }
}

export { generateIllustration, SkippedImage, type ImageRequest } from './imageEngine';

export const narrate = async (text: string, voice: string, signal?: AbortSignal): Promise<Blob> => {
  const data = await postJson<{ base64: string; mimeType: string }>('/api/narrate', { text, voice }, signal);
  if (!data?.base64) throw new ApiError('FAILED');
  return base64ToBlob(data.base64, data.mimeType || 'audio/wav');
};

export const generateMusic = async (prompt: string, signal?: AbortSignal): Promise<Blob> => {
  const data = await postJson<{ base64: string; mimeType: string }>('/api/music', { prompt }, signal, 2);
  if (!data?.base64) throw new ApiError('FAILED');
  return base64ToBlob(data.base64, data.mimeType || 'audio/mpeg');
};

export type CameraAngle = 'auto' | 'wide' | 'close' | 'low' | 'high' | 'side' | 'back';

export const rewriteImagePrompt = async (current: string, opts: { angle?: CameraAngle; instruction?: string; text?: string }, signal?: AbortSignal): Promise<string> => {
  const data = await postJson<{ prompt: string }>('/api/rewrite-prompt', { prompt: current, ...opts }, signal, 2);
  if (!data?.prompt) throw new ApiError('FAILED', 'Empty rewrite.', undefined, '/api/rewrite-prompt');
  return data.prompt;
};

export const analyzeName = async (name: string, language: Language): Promise<NameAnalysis> => {
  const trimmed = name.trim().slice(0, 60);
  if (!trimmed) throw new Error('Please enter a name first.');
  return postJson<NameAnalysis>('/api/analyze-name', { name: trimmed, language }, undefined, 2);
};

export const analyzeNameMeaning = analyzeName;
export const countPromptWords = (text: string): number => text.trim().split(/\s+/).filter(Boolean).length;

