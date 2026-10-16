import { useState } from 'react';
import { Check } from 'lucide-react';
import { feedback } from '../../services/feedback';
import { GameShell, ResultBanner, type GameProps } from './gameKit';

const FAULTS = [
  { id: 'normal', en: 'Normal fault', ar: 'الصدع العادي' },
  { id: 'reverse', en: 'Reverse fault', ar: 'الصدع المعكوس' },
  { id: 'strike', en: 'Strike-slip fault', ar: 'الصدع الانزلاقي' },
];

const FORCES = [
  { id: 'tension', en: 'Tension force', ar: 'قوى شد' },
  { id: 'compression', en: 'Compression force', ar: 'قوى ضغط' },
  { id: 'shear', en: 'Shear force', ar: 'قوى قص' },
];

const CORRECT: Record<string, string> = { normal: 'tension', reverse: 'compression', strike: 'shear' };

export default function FaultGame({ language, onBack }: GameProps) {
  const ar = language === 'Arabic';
  const [selected, setSelected] = useState<string | null>(null);
  const [matched, setMatched] = useState<string[]>([]);
  const [result, setResult] = useState<boolean | null>(null);

  const chooseForce = (forceId: string) => {
    if (!selected) return;
    const ok = CORRECT[selected] === forceId;
    setResult(ok);
    feedback(ok ? 'good' : 'bad');
    if (ok) {
      setMatched((m) => [...m, selected]);
      setSelected(null);
    }
  };

  const done = matched.length === FAULTS.length;
  const usedForces = matched.map((id) => CORRECT[id]);

  const column = 'rounded-3xl border border-dream/20 bg-white/70 p-4 dark:bg-white/5';
  const heading = 'mb-3 border-b border-dream/20 pb-2 font-display text-base font-semibold text-ink dark:text-moonlight';

  return (
    <GameShell
      language={language}
      onBack={onBack}
      title={ar ? 'مطابقة أنواع الصدوع' : 'Fault Types Matching'}
      description={ar ? 'اختر نوع الصدع ثم القوة المسببة له.' : 'Pick a fault type, then the force that causes it.'}
    >
      <div className="grid grid-cols-2 gap-3">
        <div className={column}>
          <h3 className={heading}>{ar ? 'أنواع الصدوع' : 'Fault types'}</h3>
          <div className="space-y-2">
            {FAULTS.map((f) => {
              const isDone = matched.includes(f.id);
              return (
                <button
                  key={f.id}
                  type="button"
                  disabled={isDone}
                  onClick={() => {
                    setSelected(f.id);
                    setResult(null);
                  }}
                  className={`flex w-full items-center justify-between gap-2 rounded-2xl border px-3 py-3 text-start text-sm font-semibold text-ink transition disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-lantern dark:text-moonlight ${
                    selected === f.id ? 'border-lantern bg-lantern/15' : 'border-dream/30 bg-white/60 dark:bg-white/5'
                  }`}
                >
                  {ar ? f.ar : f.en}
                  {isDone && <Check size={16} aria-hidden className="text-meadow" />}
                </button>
              );
            })}
          </div>
        </div>

        <div className={column}>
          <h3 className={heading}>{ar ? 'القوى المسببة' : 'Forces'}</h3>
          <div className="space-y-2">
            {FORCES.map((f) => (
              <button
                key={f.id}
                type="button"
                disabled={!selected || usedForces.includes(f.id)}
                onClick={() => chooseForce(f.id)}
                className="w-full rounded-2xl border border-dream/30 bg-white/60 px-3 py-3 text-start text-sm font-semibold text-ink transition enabled:hover:border-lantern disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-lantern dark:bg-white/5 dark:text-moonlight"
              >
                {ar ? f.ar : f.en}
              </button>
            ))}
          </div>
        </div>
      </div>

      {done ? (
        <ResultBanner ok>{ar ? 'أحسنت! طابقت كل الصدوع بنجاح.' : 'Great job! You matched every fault.'}</ResultBanner>
      ) : (
        result !== null && <ResultBanner ok={result}>{result ? (ar ? 'إجابة صحيحة!' : 'Correct!') : ar ? 'حاول مرة أخرى.' : 'Try again.'}</ResultBanner>
      )}
    </GameShell>
  );
}
