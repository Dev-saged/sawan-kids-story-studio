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
  | 'Yemeni';

export type AgeGroup = '3-4' | '4-6' | '7-9' | '9-12';

export type StoryType = 'Bedtime' | 'Adventure' | 'Funny' | 'Educational' | 'Moral';

export type StoryLength = 'Short' | 'Medium';

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
  | 'Comic Book';

export type AspectRatio = '1:1' | '16:9' | '9:16' | '4:3' | '3:4';

export interface StoryParams {
  idea: string;
  language: Language;
  dialect?: ArabicDialect;
  ageGroup: AgeGroup;
  storyType: StoryType;
  length: StoryLength;
  artStyle: ArtStyle;
  aspectRatio: AspectRatio;
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
}

export interface StoryInfo {
  title: string;
  language: string;
  age_group: string;
  art_style: string;
  lessons: string[];
}

export interface StoryData {
  story_info: StoryInfo;
  characters: Character[];
  pages: StoryPage[];
}

export interface PageImage {
  page: number;
  base64: string;
}

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
