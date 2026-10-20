import { dbGet, dbPut, dbDelete } from './db';
import { NarratorVoice } from '../types';
import { narrate } from './gemini';

export interface ClonedVoiceProfile {
  id: string;
  name: string;
  sampleAudio: Blob;
  pitchAverageHz: number;
  timbreLabel: { ar: string; en: string };
  matchedVoice: NarratorVoice;
  createdAt: number;
}

const CLONED_VOICE_ID = 'user_cloned_voice_v1';

// تحليل الطيف الترددي للصوت عبر Web Audio API لاستخراج النبرة
export const analyzeVoiceAudio = async (blob: Blob): Promise<{ pitchHz: number; matchedVoice: NarratorVoice; timbre: { ar: string; en: string } }> => {
  try {
    const arrayBuffer = await blob.arrayBuffer();
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new AudioContextClass();
    const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
    const channelData = audioBuffer.getChannelData(0);

    // حساب التردد الأساسي التقريبي (Zero-Crossing Rate & Peak Energy)
    let zeroCrossings = 0;
    let sumEnergy = 0;
    for (let i = 1; i < channelData.length; i++) {
      if ((channelData[i] >= 0 && channelData[i - 1] < 0) || (channelData[i] < 0 && channelData[i - 1] >= 0)) {
        zeroCrossings++;
      }
      sumEnergy += Math.abs(channelData[i]);
    }
    const duration = audioBuffer.duration || 1;
    const estimatedPitchHz = Math.round((zeroCrossings / 2) / duration);
    await ctx.close();

    // مطابقة النبرة المستنسخة بأقرب خامة صوتية طبيعية
    if (estimatedPitchHz < 140) {
      return {
        pitchHz: estimatedPitchHz,
        matchedVoice: 'Charon',
        timbre: { ar: 'صوت رخيم ودافئ (نبرة عميقة)', en: 'Deep & Resonant Timbre' },
      };
    } else if (estimatedPitchHz < 190) {
      return {
        pitchHz: estimatedPitchHz,
        matchedVoice: 'Algieba',
        timbre: { ar: 'صوت حكواتي هادئ ومتزن', en: 'Smooth Storyteller Timbre' },
      };
    } else if (estimatedPitchHz < 240) {
      return {
        pitchHz: estimatedPitchHz,
        matchedVoice: 'Sulafat',
        timbre: { ar: 'صوت دافئ وحنون', en: 'Warm & Gentle Timbre' },
      };
    } else {
      return {
        pitchHz: estimatedPitchHz,
        matchedVoice: 'Vindemiatrix',
        timbre: { ar: 'صوت رقيق ومشرق', en: 'Soft & Bright Timbre' },
      };
    }
  } catch (err) {
    console.warn('Audio analysis fallback to default profile:', err);
    return {
      pitchHz: 165,
      matchedVoice: 'Sulafat',
      timbre: { ar: 'صوت دافئ متوازن', en: 'Balanced Warm Timbre' },
    };
  }
};

// حفظ واسترجاع إعداد مطابقة أقرب صوت جاهز لنبرة المستخدم
export const saveClonedVoiceProfile = async (name: string, audioBlob: Blob): Promise<ClonedVoiceProfile> => {
  const analysis = await analyzeVoiceAudio(audioBlob);
  const profile: ClonedVoiceProfile = {
    id: CLONED_VOICE_ID,
    name: name.trim() || 'نبرتي المطابقة',
    sampleAudio: audioBlob,
    pitchAverageHz: analysis.pitchHz,
    matchedVoice: analysis.matchedVoice,
    timbreLabel: analysis.timbre,
    createdAt: Date.now(),
  };
  await dbPut('voice_profiles', profile);
  notifyClonedVoiceChange();
  return profile;
};

const profileListeners = new Set<() => void>();
export const subscribeClonedVoice = (fn: () => void) => {
  profileListeners.add(fn);
  return () => {
    profileListeners.delete(fn);
  };
};

const notifyClonedVoiceChange = () => {
  profileListeners.forEach((fn) => {
    try {
      fn();
    } catch {
      // ignore
    }
  });
};

export const getClonedVoiceProfile = async (): Promise<ClonedVoiceProfile | null> => {
  try {
    const profile = await dbGet<ClonedVoiceProfile>('voice_profiles', CLONED_VOICE_ID);
    return profile ?? null;
  } catch {
    return null;
  }
};

export const hasClonedVoiceProfile = async (): Promise<boolean> => {
  const p = await getClonedVoiceProfile();
  return Boolean(p);
};

export const deleteClonedVoiceProfile = async (): Promise<void> => {
  try {
    await dbDelete('voice_profiles', CLONED_VOICE_ID);
    notifyClonedVoiceChange();
  } catch {
    // ignore
  }
};

// توليد قراءة الصفحة تلقائياً بالصوت المستنسخ المحاكي
export const synthesizeClonedVoiceNarration = async (text: string, signal?: AbortSignal): Promise<Blob> => {
  const profile = await getClonedVoiceProfile();
  const voice = profile?.matchedVoice || 'Sulafat';
  return narrate(text, voice, signal);
};
