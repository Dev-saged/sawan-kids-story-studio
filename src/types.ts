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

export type AgeGroup = '3-4' | '4-6' | '7-9' | '9-12';

export type StoryType = 'Bedtime' | 'Adventure' | 'Funny' | 'Educational' | 'Moral';

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
  dialect?: ArabicDialect;
  ageGroup: AgeGroup;
  aspectRatio: AspectRatio;
}

export interface StoryParams {
  idea: string;
  language: Language;
  dialect?: ArabicDialect;
  ageGroup: AgeGroup;
  storyType: StoryType;
  length: StoryLength;
  artStyle: ArtStyle;
  aspectRatio: AspectRatio;
  heroName?: string;
  heroPhotoId?: string;
  series?: SeriesContext;
}

export interface Character {
  name: string;
  description: string;
  personality: string;
  age: string;
  gender: string;
}

export interface StoryPage {
  page: number;
  text: string;
  image_prompt: string;
  narration?: string;
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
  art_style: string;
  aspect_ratio: AspectRatio;
  dialect?: string;
  lessons: string[];
  moral?: string;
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
}

export type NarratorVoice = 'Sulafat' | 'Vindemiatrix' | 'Achernar' | 'Algieba' | 'Charon' | 'Puck' | 'Family';

export interface ChildProfile {
  id: string;
  name: string;
  photoId: string;
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
