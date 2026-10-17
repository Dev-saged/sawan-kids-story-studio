import { useSyncExternalStore } from 'react';

// تقدّم الطفل: بطاقات اقرأ وتعلّم، نجوم الألعاب، تحدي اليوم، عدد القصص. يُحفظ محلياً في المتصفح.
const KEY = 'sawan-progress';

export interface GameStat {
  plays: number;
  best: number;
  stars: number;
}

export interface Progress {
  v: 1;
  learn: Record<string, { quiz?: number }>;
  games: Record<string, GameStat>;
  daily: { date: string; done: boolean };
  streak: { last: string; days: number };
  stories: number;
}

const EMPTY: Progress = { v: 1, learn: {}, games: {}, daily: { date: '', done: false }, streak: { last: '', days: 0 }, stories: 0 };

export const todayKey = (d = new Date()): string => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const read = (): Progress => {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return EMPTY;
    const p = JSON.parse(raw) as Partial<Progress>;
    return { ...EMPTY, ...p, v: 1, learn: p.learn ?? {}, games: p.games ?? {}, daily: p.daily ?? EMPTY.daily, streak: p.streak ?? EMPTY.streak };
  } catch {
    return EMPTY;
  }
};

let state: Progress = read();
const listeners = new Set<() => void>();

const commit = (next: Progress) => {
  state = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // التخزين غير متاح: يبقى التقدّم في الذاكرة طوال الجلسة
  }
  listeners.forEach((fn) => fn());
};

export const getProgress = (): Progress => state;
const subscribe = (fn: () => void) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};
export const useProgress = (): Progress => useSyncExternalStore(subscribe, getProgress, getProgress);

export const starsFor = (score: number, max: number): number => {
  if (max <= 0 || score <= 0) return 0;
  const r = score / max;
  return r >= 0.9 ? 3 : r >= 0.6 ? 2 : 1;
};

// يوم متتابع: يزيد إن كان آخر نشاط أمس، ويبدأ من 1 بعد انقطاع
const touchStreak = (s: Progress): Progress => {
  const today = todayKey();
  if (s.streak.last === today) return s;
  const y = new Date();
  y.setDate(y.getDate() - 1);
  return { ...s, streak: { last: today, days: s.streak.last === todayKey(y) ? s.streak.days + 1 : 1 } };
};

export const markLearnRead = (id: string): void => {
  if (state.learn[id]) return;
  commit(touchStreak({ ...state, learn: { ...state.learn, [id]: {} } }));
};

export const recordLearnQuiz = (id: string, score: number, total: number): void => {
  const stars = starsFor(score, total);
  const prev = state.learn[id]?.quiz ?? 0;
  commit(touchStreak({ ...state, learn: { ...state.learn, [id]: { quiz: Math.max(prev, stars) } } }));
};

// تحدي اليوم: لعبة تتبدل كل يوم، وإنجاز أي نتيجة فيها يكمل التحدي
export const DAILY_POOL = ['candy-ladder', 'quiz-master', 'chemistry-lab', 'candy-catch', 'magnet', 'transformer', 'fault-types'] as const;

export const dailyGameId = (d = new Date()): string => {
  const dayNumber = Math.floor(new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() / 86_400_000);
  return DAILY_POOL[dayNumber % DAILY_POOL.length];
};

export const recordGame = (id: string, score: number, max: number): GameStat => {
  const old = state.games[id] ?? { plays: 0, best: 0, stars: 0 };
  const stat: GameStat = { plays: old.plays + 1, best: Math.max(old.best, score), stars: Math.max(old.stars, starsFor(score, max)) };
  const daily = id === dailyGameId() && score > 0 ? { date: todayKey(), done: true } : state.daily;
  commit(touchStreak({ ...state, games: { ...state.games, [id]: stat }, daily }));
  return stat;
};

export const completeDaily = (): void => {
  const today = todayKey();
  if (state.daily.date === today && state.daily.done) return;
  commit(touchStreak({ ...state, daily: { date: today, done: true } }));
};

export const countStory = (): void => commit(touchStreak({ ...state, stories: state.stories + 1 }));

export const totalStars = (p: Progress): number =>
  Object.values(p.games).reduce((n, g) => n + g.stars, 0) + Object.values(p.learn).reduce((n, l) => n + (l.quiz ?? 0), 0);

export const dailyDone = (p: Progress): boolean => p.daily.date === todayKey() && p.daily.done;
