import { NarratorVoice, StoryData, StoryPage } from '../types';
import { dbDelete, dbGet, dbPut, hashText } from './db';
import { generateMusic, narrate } from './gemini';
import { getClonedVoiceProfile } from './voiceClone';

interface AudioRecord {
  id: string;
  blob: Blob;
  createdAt: number;
}

export const VOICE_OPTIONS: { value: NarratorVoice; label: { ar: string; en: string } }[] = [
  { value: 'Sulafat', label: { ar: 'راوية دافئة', en: 'Warm storyteller (F)' } },
  { value: 'Vindemiatrix', label: { ar: 'راوية حنونة', en: 'Gentle storyteller (F)' } },
  { value: 'Achernar', label: { ar: 'راوية هادئة', en: 'Soft storyteller (F)' } },
  { value: 'Algieba', label: { ar: 'راوٍ حكواتي', en: 'Smooth narrator (M)' } },
  { value: 'Charon', label: { ar: 'راوٍ رزين', en: 'Deep narrator (M)' } },
  { value: 'Puck', label: { ar: 'راوٍ مرح', en: 'Playful narrator (M)' } },
  { value: 'ClonedVoice', label: { ar: '🎙️ بصمتي الصوتية المستنسخة', en: '🎙️ Cloned Voice (AI)' } },
  { value: 'Family', label: { ar: 'صوت العائلة (تسجيلك)', en: 'Family voice (your recording)' } },
];

const VOICE_KEY = 'sawan-voice';

export const getVoice = (): NarratorVoice => {
  try {
    const v = localStorage.getItem(VOICE_KEY) as NarratorVoice | null;
    return v && VOICE_OPTIONS.some((o) => o.value === v) ? v : 'Sulafat';
  } catch {
    return 'Sulafat';
  }
};

export const setVoice = (v: NarratorVoice) => {
  try {
    localStorage.setItem(VOICE_KEY, v);
  } catch {
    // ignore
  }
};

export const isArabicStory = (story: StoryData): boolean => /arab|عرب/i.test(story.story_info.language ?? '');

const cached = async (id: string, make: () => Promise<Blob>): Promise<Blob> => {
  try {
    const hit = await dbGet<AudioRecord>('audio', id);
    if (hit?.blob) return hit.blob;
  } catch {
    // ignore
  }
  const blob = await make();
  dbPut<AudioRecord>('audio', { id, blob, createdAt: Date.now() }).catch(() => undefined);
  return blob;
};

// كل صفحة تُولَّد مرة واحدة لكل صوت، ثم تُقرأ من القاعدة
const audioId = (page: StoryPage, voice: NarratorVoice) => `tts:${voice}:${hashText(page.narration || page.text)}`;

// ===== صوت العائلة: تسجيل الأب أو الأم لكل صفحة، محفوظ مع القصة =====
const familyId = (storyId: string | undefined, pageNo: number) => `fam:${storyId ?? 'draft'}:${pageNo}`;

export class FamilyVoiceMissing extends Error {
  constructor(public pageNo: number) {
    super(document.documentElement.lang === 'ar' ? `سجّل صوتك للصفحة ${pageNo} أولاً من زر الميكروفون.` : `Record your voice for page ${pageNo} first using the microphone button.`);
  }
}

export const saveFamilyAudio = (storyId: string | undefined, pageNo: number, blob: Blob) => dbPut<AudioRecord>('audio', { id: familyId(storyId, pageNo), blob, createdAt: Date.now() });

export const hasFamilyAudio = async (storyId: string | undefined, pageNo: number): Promise<boolean> => {
  try {
    return Boolean((await dbGet<AudioRecord>('audio', familyId(storyId, pageNo)))?.blob);
  } catch {
    return false;
  }
};

export const getPageAudio = async (storyId: string | undefined, page: StoryPage, voice: NarratorVoice, signal?: AbortSignal): Promise<Blob> => {
  if (voice === 'Family') {
    const rec = await dbGet<AudioRecord>('audio', familyId(storyId, page.page)).catch(() => undefined);
    if (!rec?.blob) throw new FamilyVoiceMissing(page.page);
    return rec.blob;
  }
  if (voice === 'ClonedVoice') {
    const profile = await getClonedVoiceProfile();
    const effectiveVoice = profile?.matchedVoice || 'Sulafat';
    return cached(audioId(page, 'ClonedVoice'), () => narrate(page.narration || page.text, effectiveVoice, signal));
  }
  return cached(audioId(page, voice), () => narrate(page.narration || page.text, voice, signal));
};

// حذف الصوت المحفوظ لصفحة (ليُولَّد من جديد عند الطلب)
export const dropPageAudio = (page: StoryPage, voice: NarratorVoice): Promise<void> => dbDelete('audio', audioId(page, voice)).then(() => undefined, () => undefined);

export const getStoryMusic = (story: StoryData, signal?: AbortSignal): Promise<Blob> => {
  const prompt = story.music_prompt || `A gentle instrumental soundtrack for a ${story.story_info.art_style} children story titled "${story.story_info.title}"`;
  return cached(`music:${hashText(prompt)}`, () => generateMusic(prompt, signal));
};

// موسيقى النوم: تهويدة بطيئة تُولَّد مرة واحدة وتُحفظ
export const getSleepMusic = (signal?: AbortSignal): Promise<Blob> =>
  cached('music:sleep-v1', () =>
    generateMusic('A very slow, soft lullaby for sleeping children: music box and gentle harp over warm pads, dreamy, around 50 bpm, no sudden changes, instrumental only.', signal)
  );

export interface WordTiming {
  word: string;
  start: number;
  end: number;
}

const PAUSE = /[.!?؟،,؛;:…]$/;

// توقيت تقريبي لكل كلمة بحسب طولها والوقفات
export const wordTimings = (text: string, duration: number, lead = 0.18, tail = 0.3): WordTiming[] => {
  const words = text.split(/\s+/).filter(Boolean);
  if (!words.length || !duration) return [];
  const weights = words.map((w) => w.replace(/[ً-ْٰ]/g, '').length + 1.5 + (PAUSE.test(w) ? 3 : 0));
  const total = weights.reduce((a, b) => a + b, 0);
  const span = Math.max(0.5, duration - lead - tail);
  let t = lead;
  return words.map((word, i) => {
    const d = (weights[i] / total) * span;
    const timing = { word, start: t, end: t + d };
    t += d;
    return timing;
  });
};

export const activeWordIndex = (timings: WordTiming[], time: number): number => {
  for (let i = 0; i < timings.length; i++) if (time < timings[i].end) return time >= timings[i].start ? i : i - 1;
  return timings.length - 1;
};

export const audioDuration = (blob: Blob): Promise<number> =>
  new Promise((resolve) => {
    const a = new Audio();
    const url = URL.createObjectURL(blob);
    a.preload = 'metadata';
    a.onloadedmetadata = () => {
      const d = a.duration;
      URL.revokeObjectURL(url);
      resolve(Number.isFinite(d) ? d : 0);
    };
    a.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(0);
    };
    a.src = url;
  });
