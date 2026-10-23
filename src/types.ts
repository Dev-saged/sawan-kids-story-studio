export type Language = 'English' | 'Arabic';

export type ArabicDialect =
  | 'Modern Standard'
  | 'Egyptian'
  | 'Saudi'
  | 'Gulf'
  | 'Palestinian'
  | 'Levantine'
  | 'Syrian'
  | 'Lebanese'
  | 'Jordanian'
  | 'Iraqi'
  | 'Emirati'
  | 'Kuwaiti'
  | 'Moroccan'
  | 'Algerian'
  | 'Tunisian'
  | 'Sudanese'
  | 'Yemeni'
  | 'Libyan'
  | 'Mauritanian';

export type AgeGroup = '3-4' | '4-6' | '7-9' | '9-12' | '13-18' | '18+';

export type AudienceLevel = 'kids' | 'adults';

export type CoverFontStyle =
  | 'kufi'
  | 'diwani'
  | 'naskh'
  | 'display3d'
  | 'lalezar'
  | 'elmessiri'
  | 'readex'
  | 'alexandria'
  | 'harmattan'
  | 'lemonada'
  | 'changa'
  | 'katibeh';

export type CoverTextEffect = 'gold' | 'shadow' | 'outline' | 'plain';

export type AmbientPresetId = 'forest' | 'ocean' | 'rain' | 'night' | 'cozy_fire' | 'cyber' | 'dream';

export type VeoMotionMode = 'cinematic-pack' | 'parallax-script' | 'sweeps-3d' | 'auto-composite';

export type Book3DTheme = 'hardcover' | 'carddeck' | 'grimoire';

export type PDFPreset = 'storybook' | 'minimalist' | 'collector';

export type StoryType =
  | 'Bedtime'
  | 'Adventure'
  | 'Funny'
  | 'Educational'
  | 'Moral'
  | 'Mystery'
  | 'Fantasy'
  | 'SciFi'
  | 'Fable'
  | 'Historical'
  | 'Rhyme'
  | 'Interactive'
  | 'Therapeutic'
  | 'Prophets'
  | 'Folklore'
  | 'Sports';

export interface StoryTypeArc {
  beginning: string;
  middle: string;
  climax: string;
  ending: string;
}

export interface StoryTypeSpec {
  value: StoryType;
  label: { ar: string; en: string };
  desc: { ar: string; en: string };
  isPrimary: boolean;
  tone: string;
  pacing: string;
  arc: StoryTypeArc;
  arcEn?: StoryTypeArc;
  pageRule: string;
}

export type StoryLength = 'Short' | 'Medium' | 'Long' | 'Epic';

export type ArtStyle =
  | '3D Pixar Style'
  | 'Hand-drawn Cartoon'
  | 'Watercolor'
  | 'Claymation'
  | 'Paper Cutout'
  | 'Anime'
  | 'Doodle Sketch'
  | 'Photorealistic'
  | 'Classic Storybook'
  | 'Flat Vector'
  | 'Pastel Dream'
  | 'Pixel Art'
  | 'Chalk Drawing'
  | 'Comic Book'
  | 'Cute Cartoon'
  | 'Educational Line Cartoon'
  | 'Fantasy Fairy Tale'
  | 'Bedtime Story';

export type AspectRatio = '1:1' | '16:9' | '9:16' | '4:3' | '3:4';

// سياق الجزء التالي من سلسلة: نفس الشخصيات ونفس الأسلوب وملخص ما سبق
export interface SeriesContext {
  seriesId: string;
  seriesTitle: string;
  partNumber: number;
  previousTitle: string;
  previousSummary: string;
  characters: Character[];
  characterSheetId?: string;
  heroPhotoId?: string;
  heroName?: string;
  artStyle: ArtStyle;
  styleConsistency?: string;
  dialect?: ArabicDialect;
  ageGroup: AgeGroup;
  audienceLevel?: AudienceLevel;
  aspectRatio: AspectRatio;
}

export interface Character {
  name: string;
  description: string;
  personality: string;
  age: string;
  gender: string;
}

// شخصية محفوظة في ألبوم المستخدم (مخزن characters في IndexedDB v3)
export interface SavedCharacter extends Character {
  id: string;
  referenceImageId?: string;
  createdAt: number;
}

export interface StoryParams {
  idea: string;
  language: Language;
  dialect?: ArabicDialect;
  ageGroup: AgeGroup;
  audienceLevel?: AudienceLevel;
  storyType: StoryType;
  length: StoryLength;
  artStyle: ArtStyle;
  styleConsistency?: string;
  aspectRatio: AspectRatio;
  heroName?: string;
  heroPhotoId?: string;
  heroAgeStage?: 'child' | 'teen' | 'adult';
  adultMode?: boolean;
  series?: SeriesContext;
  coverFontStyle?: CoverFontStyle;
  coverTextEffect?: CoverTextEffect;
  fruitFantasy?: boolean;
  themeTopic?: string;
  customCharacters?: SavedCharacter[];
}

export interface StoryPage {
  page: number;
  text: string;
  image_prompt: string;
  narration?: string;
  // ملاحظة تصحيح من المستخدم للمشهد عند عدم التطابق
  correctionNote?: string;
  // عنوان الفصل: على أول صفحة في كل فصل فقط
  chapter?: string;
  // رابط عرض (blob:) وقت التشغيل، أو base64 قديم
  generatedImage?: string;
  imageId?: string;
  isGeneratingImage?: boolean;
  imageError?: boolean;
}

export interface StoryInfo {
  title: string;
  language: string;
  age_group: string;
  audienceLevel?: AudienceLevel;
  art_style: string;
  styleConsistency?: string;
  aspect_ratio: AspectRatio;
  dialect?: string;
  story_type?: StoryType;
  lessons: string[];
  moral?: string;
  coverFontStyle?: CoverFontStyle;
  coverTextEffect?: CoverTextEffect;
  fruitFantasy?: boolean;
  themeTopic?: string;
  adultMode?: boolean;
}

export interface QuizItem {
  question: string;
  options: string[];
  answer: number;
  page: number;
}

export interface StoryData {
  id?: string;
  createdAt?: number;
  updatedAt?: number;
  story_info: StoryInfo;
  characters: Character[];
  pages: StoryPage[];
  cover_image_prompt?: string;
  music_prompt?: string;
  coverImage?: string;
  coverImageId?: string;
  characterSheetId?: string;
  heroPhotoId?: string;
  quiz?: QuizItem[];
  quizScore?: number;
  seriesId?: string;
  seriesTitle?: string;
  partNumber?: number;
  // العدد المستهدف لقصة طويلة تُكتب على دفعات؛ أقل من ذلك يعني قصة غير مكتملة تُستأنف
  plannedPages?: number;
  coverFontStyle?: CoverFontStyle;
  coverTextEffect?: CoverTextEffect;
  audienceLevel?: AudienceLevel;
  styleConsistency?: string;
}

export type NarratorVoice = 'Sulafat' | 'Vindemiatrix' | 'Achernar' | 'Algieba' | 'Charon' | 'Puck' | 'Family' | 'ClonedVoice';

export interface ChildProfile {
  id: string;
  name: string;
  photoId: string;
  ageStage?: 'child' | 'teen' | 'adult';
  createdAt: number;
}

// Legacy v1.2 save format (images stored beside the story); kept only so old JSON files still import.
export interface PageImage {
  page: number;
  base64: string;
}

export type BookSize = 'A4' | 'Square';

export interface NameAnalysis {
  meaning: string;
  origin: string;
  traits: string[];
}

export type GenerationStage = 'idle' | 'writing' | 'illustrating' | 'done' | 'error';

export interface ReadLearnArticle {
  id: string;
  emoji: string;
  title: { en: string; ar: string };
  summary: { en: string; ar: string };
  body: { en: string; ar: string };
}

export interface GameDefinition {
  id: string;
  emoji: string;
  title: { en: string; ar: string };
  description: { en: string; ar: string };
  available: boolean;
}
