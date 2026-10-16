// Tiny offline feedback layer for games: a synthesized tone (no remote audio files, so it
// works offline and under a strict CSP) plus a short haptic pulse.

type Tone = 'good' | 'bad';

let audioCtx: AudioContext | null = null;

const prefersReducedMotion = (): boolean => {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
};

const playTone = (tone: Tone): void => {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    audioCtx ??= new Ctx();
    if (audioCtx.state === 'suspended') void audioCtx.resume();

    const notes = tone === 'good' ? [660, 880] : [220, 165];
    const now = audioCtx.currentTime;
    notes.forEach((freq, i) => {
      const osc = audioCtx!.createOscillator();
      const gain = audioCtx!.createGain();
      osc.type = tone === 'good' ? 'triangle' : 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, now + i * 0.11);
      gain.gain.exponentialRampToValueAtTime(0.18, now + i * 0.11 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.11 + 0.14);
      osc.connect(gain).connect(audioCtx!.destination);
      osc.start(now + i * 0.11);
      osc.stop(now + i * 0.11 + 0.16);
    });
  } catch {
    // audio is a nicety; never break the game over it
  }
};

export const feedback = (tone: Tone): void => {
  playTone(tone);
  if (prefersReducedMotion()) return;
  try {
    navigator.vibrate?.(tone === 'good' ? 15 : [30, 40, 30]);
  } catch {
    // vibration unsupported
  }
};
