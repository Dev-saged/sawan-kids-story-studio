import { useCallback, useEffect, useRef, useState } from 'react';
import { Moon, X } from 'lucide-react';
import { getSleepMusic } from '../../services/narration';

interface NarrationControls {
  status: 'idle' | 'loading' | 'playing' | 'paused';
  play: (all?: boolean) => void;
  stop: () => void;
  setRate: (r: number) => void;
}

const DURATIONS = [10, 20, 30];
const SLEEP_RATE = 0.9;
const DIM_OPACITY = 0.8;

// وضع النوم: القصة كاملة بسرعة أبطأ + تهويدة هادئة + تعتيم تدريجي + إيقاف تلقائي
export default function SleepMode({ ar, narration }: { ar: boolean; narration: NarrationControls }) {
  const [open, setOpen] = useState(false);
  const [minutes, setMinutes] = useState(20);
  const [active, setActive] = useState(false);
  const [dim, setDim] = useState(false);
  const musicRef = useRef<HTMLAudioElement | null>(null);
  const musicUrl = useRef<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fade = useRef<ReturnType<typeof setInterval> | null>(null);
  const ctrl = useRef<AbortController | null>(null);
  const nRef = useRef(narration);
  nRef.current = narration;

  const clearTimers = () => {
    if (timer.current) clearTimeout(timer.current);
    if (fade.current) clearInterval(fade.current);
    timer.current = null;
    fade.current = null;
  };

  const release = useCallback(() => {
    musicRef.current?.pause();
    musicRef.current = null;
    if (musicUrl.current) URL.revokeObjectURL(musicUrl.current);
    musicUrl.current = null;
  }, []);

  // إنهاء بتلاشي الصوت تدريجياً
  const finish = useCallback((stopNarration: boolean) => {
    ctrl.current?.abort();
    if (timer.current) clearTimeout(timer.current);
    setDim(false);
    setActive(false);
    nRef.current.setRate(1);
    if (stopNarration) nRef.current.stop();
    const music = musicRef.current;
    if (!music) return;
    if (fade.current) clearInterval(fade.current);
    fade.current = setInterval(() => {
      music.volume = Math.max(0, music.volume - 0.03);
      if (music.volume <= 0.001) {
        if (fade.current) clearInterval(fade.current);
        fade.current = null;
        release();
      }
    }, 250);
  }, [release]);

  const start = async () => {
    setOpen(false);
    setActive(true);
    nRef.current.setRate(SLEEP_RATE);
    nRef.current.play(true);
    requestAnimationFrame(() => setDim(true));
    timer.current = setTimeout(() => finish(true), minutes * 60_000);
    const c = new AbortController();
    ctrl.current = c;
    try {
      const blob = await getSleepMusic(c.signal);
      if (c.signal.aborted) return;
      musicUrl.current = URL.createObjectURL(blob);
      const audio = new Audio(musicUrl.current);
      audio.loop = true;
      audio.volume = 0.2;
      musicRef.current = audio;
      await audio.play();
    } catch {
      // بدون موسيقى: القصة تكفي
    }
  };

  // انتهت القصة قبل المؤقت: نُنهي بهدوء
  const wasPlaying = useRef(false);
  useEffect(() => {
    if (!active) {
      wasPlaying.current = false;
      return;
    }
    if (narration.status === 'playing') wasPlaying.current = true;
    else if (narration.status === 'idle' && wasPlaying.current) finish(false);
  }, [active, narration.status, finish]);

  useEffect(
    () => () => {
      clearTimers();
      ctrl.current?.abort();
      release();
    },
    [release]
  );

  return (
    <>
      {!active && narration.status === 'idle' && (
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-dream/40 px-3.5 text-xs font-semibold text-ink transition hover:border-lantern dark:text-moonlight"
        >
          <Moon size={14} aria-hidden />
          <span>{ar ? 'وضع النوم' : 'Sleep mode'}</span>
        </button>
      )}

      {open && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-end justify-center bg-black/55 backdrop-blur-sm" onClick={() => setOpen(false)}>
          <div
            dir={ar ? 'rtl' : 'ltr'}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg space-y-4 rounded-t-3xl bg-moonlight p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-2xl dark:bg-dusk"
          >
            <div className="flex items-center justify-between">
              <h2 className="flex items-center gap-2 font-display text-lg font-bold text-ink dark:text-moonlight">
                <Moon size={20} className="text-lantern" aria-hidden />
                {ar ? 'وضع النوم' : 'Sleep mode'}
              </h2>
              <button type="button" onClick={() => setOpen(false)} className="flex h-11 w-11 items-center justify-center rounded-full text-ink/70 dark:text-moonlight/70" aria-label={ar ? 'إغلاق' : 'Close'}>
                <X size={20} />
              </button>
            </div>
            <p className="text-sm text-ink/70 dark:text-moonlight/70">
              {ar ? 'القصة كاملة بصوت أبطأ مع تهويدة هادئة، تُعتّم الشاشة تدريجياً ثم تتوقف تلقائياً.' : 'The whole story at a slower pace with a soft lullaby. The screen dims gradually, then everything stops.'}
            </p>
            <div className="flex gap-2" role="group" aria-label={ar ? 'مدة وضع النوم' : 'Sleep duration'}>
              {DURATIONS.map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setMinutes(d)}
                  aria-pressed={minutes === d}
                  className={`min-h-12 flex-1 rounded-2xl border text-sm font-bold transition ${minutes === d ? 'border-lantern bg-lantern/15 text-ink dark:text-moonlight' : 'border-dream/30 text-ink/70 dark:text-moonlight/70'}`}
                >
                  {ar ? `${d} دقيقة` : `${d} min`}
                </button>
              ))}
            </div>
            <button type="button" onClick={start} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-lantern font-display text-sm font-bold text-ink shadow-lg shadow-lantern/30 active:scale-95">
              <Moon size={18} aria-hidden />
              {ar ? 'ابدأ وضع النوم' : 'Start sleep mode'}
            </button>
          </div>
        </div>
      )}

      {active && (
        <div aria-hidden={!dim} className="fixed inset-0 z-40 bg-black transition-opacity ease-linear" style={{ opacity: dim ? DIM_OPACITY : 0, transitionDuration: '60s', pointerEvents: 'none' }}>
          <span className="sr-only">{ar ? 'وضع النوم يعمل' : 'Sleep mode is on'}</span>
        </div>
      )}
      {active && (
        <button
          type="button"
          onClick={() => finish(true)}
          className="fixed bottom-6 start-1/2 z-50 inline-flex min-h-12 -translate-x-1/2 items-center gap-2 rounded-full bg-white/15 px-5 text-sm font-semibold text-white/80 backdrop-blur rtl:translate-x-1/2"
        >
          <X size={16} aria-hidden />
          {ar ? 'إيقاف وضع النوم' : 'Stop sleep mode'}
        </button>
      )}
    </>
  );
}
