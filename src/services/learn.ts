import { postJson } from './api';
import { generateIllustration, narrate } from './gemini';
import { getVoice } from './narration';
import type { AgeGroup, Language, QuizItem } from '../types';

export interface Explained {
  title: string;
  answer: string;
  fun_fact: string;
  image_prompt: string;
  follow_ups: string[];
  quiz: QuizItem[];
}

const toQuiz = (list: { question: string; options: string[]; answer: number }[]): QuizItem[] =>
  list.map((q) => ({ question: q.question, options: q.options, answer: q.answer, page: 0 }));

export const askAnything = async (question: string, language: Language, ageGroup: AgeGroup, signal?: AbortSignal): Promise<Explained> => {
  const data = await postJson<Explained & { quiz: { question: string; options: string[]; answer: number }[] }>(
    '/api/explain',
    { mode: 'ask', question: question.trim().slice(0, 300), language, ageGroup },
    signal,
    2
  );
  return { ...data, quiz: toQuiz(data.quiz ?? []) };
};

export const quizFor = async (title: string, text: string, language: Language, ageGroup: AgeGroup, signal?: AbortSignal): Promise<QuizItem[]> => {
  const data = await postJson<{ quiz: { question: string; options: string[]; answer: number }[] }>(
    '/api/explain',
    { mode: 'quiz', question: title, topicText: text, language, ageGroup },
    signal,
    2
  );
  return toQuiz(data.quiz ?? []);
};

export type QuizLevel = 'easy' | 'medium' | 'hard';

// اختبار حر في موضوع، بمستوى صعوبة يتكيّف مع أداء الطفل
export const topicQuiz = async (topic: string, level: QuizLevel, count: number, language: Language, ageGroup: AgeGroup, signal?: AbortSignal): Promise<QuizItem[]> => {
  const data = await postJson<{ quiz: { question: string; options: string[]; answer: number }[] }>(
    '/api/explain',
    { mode: 'quiz', question: topic.trim().slice(0, 200), level, count, language, ageGroup },
    signal,
    2
  );
  return toQuiz(data.quiz ?? []);
};

const imageCache = new Map<string, string>();
const audioCache = new Map<string, string>();

export const illustrate = async (key: string, prompt: string): Promise<string> => {
  const hit = imageCache.get(key);
  if (hit) return hit;
  const blob = await generateIllustration({
    prompt: `Friendly colorful educational illustration for children, clean composition, no text or letters. ${prompt}`,
    aspectRatio: '4:3',
    kind: 'learn',
  });
  const url = URL.createObjectURL(blob);
  imageCache.set(key, url);
  return url;
};

export const speak = async (key: string, text: string): Promise<string> => {
  const voice = getVoice() === 'Family' ? 'Sulafat' : getVoice();
  const id = `${voice}:${key}`;
  const hit = audioCache.get(id);
  if (hit) return hit;
  const url = URL.createObjectURL(await narrate(text, voice));
  audioCache.set(id, url);
  return url;
};
