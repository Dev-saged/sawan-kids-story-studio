import { useState } from 'react';
import { ArrowDown, ArrowUp } from 'lucide-react';
import { feedback } from '../../services/feedback';
import { GameShell, ResultBanner, choiceBtn, primaryBtn, type GameProps } from './gameKit';

const randomTurns = () => Math.floor(Math.random() * 40) + 20;

const makeTurns = (): [number, number] => {
  const primary = randomTurns();
  let secondary = randomTurns();
  while (secondary === primary) secondary = randomTurns();
  return [primary, secondary];
};

const Coil = ({ turns, tone }: { turns: number; tone: string }) => (
  <div className="mt-3 flex justify-center gap-1" aria-hidden>
    {Array.from({ length: Math.min(10, Math.floor(turns / 5)) }, (_, i) => (
      <span key={i} className={`h-8 w-1.5 rounded-full ${tone}`} />
    ))}
  </div>
);

export default function TransformerGame({ language, onBack }: GameProps) {
  const ar = language === 'Arabic';
  const [[primary, secondary], setTurns] = useState<[number, number]>(makeTurns);
  const [result, setResult] = useState<boolean | null>(null);

  const check = (guess: 'up' | 'down') => {
    const ok = guess === (secondary > primary ? 'up' : 'down');
    setResult(ok);
    feedback(ok ? 'good' : 'bad');
  };

  const next = () => {
    setTurns(makeTurns());
    setResult(null);
  };

  const card = (label: string, tag: string, value: number, symbol: string, tone: string, text: string) => (
    <div className="page-corner flex-1 rounded-3xl border border-dream/20 bg-white/70 p-5 text-center dark:bg-white/5">
      <span className="text-xs font-semibold text-lantern">{tag}</span>
      <p className="mt-1 text-xs font-semibold text-ink/70 dark:text-moonlight/70">{label}</p>
      <p className={`my-1 font-mono text-5xl font-bold ${text}`}>{value}</p>
      <p className="text-xs text-ink/60 dark:text-moonlight/60">{ar ? 'لفة' : 'turns'} ({symbol})</p>
      <Coil turns={value} tone={tone} />
    </div>
  );

  return (
    <GameShell
      language={language}
      onBack={onBack}
      title={ar ? 'تحدي المحولات الكهربائية' : 'Transformer Challenge'}
      description={ar ? 'حدد نوع المحول بناءً على عدد اللفات.' : 'Decide the transformer type from the coil turns.'}
    >
      <div className="flex gap-3">
        {card(ar ? 'لفات الملف الابتدائي' : 'Primary coil', ar ? 'دخل' : 'Input', primary, 'Np', 'bg-dream/60', 'text-ink dark:text-moonlight')}
        {card(ar ? 'لفات الملف الثانوي' : 'Secondary coil', ar ? 'خرج' : 'Output', secondary, 'Ns', 'bg-coral/60', 'text-coral')}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <button type="button" disabled={result === true} onClick={() => check('up')} className={`${choiceBtn} flex flex-col items-center gap-1`}>
          <ArrowUp size={20} aria-hidden className="text-meadow" />
          {ar ? 'محول رافع' : 'Step-up'}
        </button>
        <button type="button" disabled={result === true} onClick={() => check('down')} className={`${choiceBtn} flex flex-col items-center gap-1`}>
          <ArrowDown size={20} aria-hidden className="text-coral" />
          {ar ? 'محول خافض' : 'Step-down'}
        </button>
      </div>

      {result !== null && (
        <ResultBanner ok={result}>
          {result
            ? ar
              ? `صحيح! الثانوي (${secondary}) ${secondary > primary ? 'أكبر من' : 'أصغر من'} الابتدائي (${primary}).`
              : `Correct! Secondary (${secondary}) is ${secondary > primary ? 'greater' : 'less'} than primary (${primary}).`
            : ar
            ? 'حاول مرة أخرى.'
            : 'Try again.'}
        </ResultBanner>
      )}

      {result === true && (
        <div className="flex justify-center">
          <button type="button" onClick={next} className={primaryBtn}>
            {ar ? 'سؤال جديد' : 'New question'}
          </button>
        </div>
      )}
    </GameShell>
  );
}
