import { useEffect, useRef, useState } from 'react';
import { feedback } from '../../services/feedback';
import { ELEMENTS, type ChemElement } from './elements';
import { GameShell, pickRandom, primaryBtn, type GameProps } from './gameKit';
import { recordGame } from '../../services/progress';

interface Falling {
  id: number;
  symbol: string;
  x: number; // % from the start edge
  y: number; // px from the top
  speed: number; // px per second
}

const DURATION = 30;
const SPAWN_MS = 800;
const ITEM_SIZE = 48;
const TARGET_BIAS = 0.4; // share of spawns that are the target, so a round isn't mostly decoys
const BEST_KEY = 'sawan-catch-best';

const readBest = (): number => {
  try {
    return Number(localStorage.getItem(BEST_KEY)) || 0;
  } catch {
    return 0;
  }
};

export default function CatchGame({ language, onBack }: GameProps) {
  const ar = language === 'Arabic';
  const [phase, setPhase] = useState<'idle' | 'playing' | 'over'>('idle');
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(DURATION);
  const [target, setTarget] = useState<ChemElement>(ELEMENTS[0]);
  const [items, setItems] = useState<Falling[]>([]);
  const [best, setBest] = useState(readBest);

  const fieldRef = useRef<HTMLDivElement>(null);
  const targetRef = useRef(target);
  const scoreRef = useRef(0);
  const nextId = useRef(0);

  const start = () => {
    const chosen = pickRandom(ELEMENTS);
    targetRef.current = chosen;
    scoreRef.current = 0;
    setTarget(chosen);
    setScore(0);
    setTimeLeft(DURATION);
    setItems([]);
    setPhase('playing');
  };

  // Frame-rate independent loop: movement uses elapsed time, and the clock is derived from the
  // same timestamp, so a slow phone can't stretch the round.
  useEffect(() => {
    if (phase !== 'playing') return;
    const begin = performance.now();
    let last = begin;
    let lastSpawn = begin - SPAWN_MS;
    let shownSecond = DURATION;
    let raf = 0;

    const tick = (now: number) => {
      const elapsed = (now - begin) / 1000;
      const dt = (now - last) / 1000;
      last = now;
      const height = fieldRef.current?.clientHeight ?? 360;

      let spawned: Falling | null = null;
      if (now - lastSpawn >= SPAWN_MS) {
        lastSpawn = now;
        spawned = {
          id: nextId.current++,
          symbol: Math.random() < TARGET_BIAS ? targetRef.current.symbol : pickRandom(ELEMENTS).symbol,
          x: Math.random() * 80 + 5,
          y: -ITEM_SIZE,
          speed: 110 + Math.random() * 110,
        };
      }
      setItems((prev) => {
        const moved = prev.map((i) => ({ ...i, y: i.y + i.speed * dt })).filter((i) => i.y < height);
        return spawned ? [...moved, spawned] : moved;
      });

      const left = Math.max(0, Math.ceil(DURATION - elapsed));
      if (left !== shownSecond) {
        shownSecond = left;
        setTimeLeft(left);
      }
      if (elapsed >= DURATION) {
        setPhase('over');
        return;
      }
      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [phase]);

  useEffect(() => {
    if (phase === 'over') recordGame('candy-catch', scoreRef.current, 100);
  }, [phase]);

  useEffect(() => {
    if (phase !== 'over' || scoreRef.current <= best) return;
    setBest(scoreRef.current);
    try {
      localStorage.setItem(BEST_KEY, String(scoreRef.current));
    } catch {
      // best score just won't persist
    }
  }, [phase, best]);

  const tap = (item: Falling) => {
    if (phase !== 'playing') return;
    const hit = item.symbol === targetRef.current.symbol;
    scoreRef.current = hit ? scoreRef.current + 10 : Math.max(0, scoreRef.current - 5);
    setScore(scoreRef.current);
    setItems((prev) => prev.filter((i) => i.id !== item.id));
    feedback(hit ? 'good' : 'bad');
  };

  const stat = 'flex flex-col items-center text-lg font-bold text-ink dark:text-moonlight';
  const statLabel = 'text-xs font-medium text-ink/60 dark:text-moonlight/60';

  return (
    <GameShell
      language={language}
      onBack={onBack}
      title={ar ? 'التقاط العناصر الكيميائية' : 'Chemical Catch'}
      description={ar ? 'اضغط على الرمز الكيميائي الصحيح بسرعة!' : 'Tap the correct chemical symbol fast!'}
    >
      <div className="flex items-center justify-between gap-3">
        <div className={stat}>
          <span className={statLabel}>{ar ? 'النقاط' : 'Score'}</span>
          {score}
        </div>
        {phase === 'playing' && (
          <div className="rounded-2xl border border-lantern bg-lantern/10 px-4 py-2 text-center">
            <span className={statLabel}>{ar ? 'التقط' : 'Catch'}</span>
            <p className="font-display text-base font-bold text-ink dark:text-moonlight">
              {ar ? target.ar : target.en} ({target.symbol})
            </p>
          </div>
        )}
        <div className={`${stat} ${timeLeft < 10 && phase === 'playing' ? 'text-coral' : ''}`}>
          <span className={statLabel}>{ar ? 'الوقت' : 'Time'}</span>
          {timeLeft}
        </div>
      </div>

      <div
        ref={fieldRef}
        dir="ltr"
        className="relative h-[360px] touch-none select-none overflow-hidden rounded-3xl border border-dashed border-dream/40 bg-gradient-to-b from-dream/10 to-lantern/10 dark:from-dusk dark:to-ink"
      >
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            onPointerDown={(e) => {
              e.preventDefault();
              tap(item);
            }}
            className="absolute top-0 flex items-center justify-center rounded-full border-2 border-dream bg-white font-bold text-ink shadow-md active:scale-90 dark:bg-dusk dark:text-moonlight"
            style={{ left: `${item.x}%`, width: ITEM_SIZE, height: ITEM_SIZE, transform: `translateY(${item.y}px)` }}
            aria-label={item.symbol}
          >
            {item.symbol}
          </button>
        ))}

        {phase !== 'playing' && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-moonlight/80 p-4 text-center backdrop-blur-sm dark:bg-dusk/80" dir={ar ? 'rtl' : 'ltr'}>
            {phase === 'over' && (
              <>
                <p className="font-display text-2xl font-bold text-ink dark:text-moonlight">{ar ? 'انتهى الوقت!' : "Time's up!"}</p>
                <p className="text-sm font-semibold text-ink/80 dark:text-moonlight/80">
                  {ar ? `نقاطك: ${score} — أفضل نتيجة: ${best}` : `Your score: ${score} — Best: ${best}`}
                </p>
              </>
            )}
            <button type="button" onClick={start} className={primaryBtn}>
              {phase === 'over' ? (ar ? 'العب مرة أخرى' : 'Play again') : ar ? 'ابدأ اللعب' : 'Start game'}
            </button>
          </div>
        )}
      </div>
    </GameShell>
  );
}
