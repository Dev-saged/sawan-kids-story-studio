import { useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { Language } from '../../types';
import { recordGame } from '../../services/progress';

interface Props {
  language: Language;
  onBack: () => void;
}

export default function VolcanoGame({ language, onBack }: Props) {
  const ar = language === 'Arabic';
  const [erupting, setErupting] = useState(false);
  const [count, setCount] = useState(0);

  const erupt = () => {
    if (erupting) return;
    setErupting(true);
    setCount((c) => c + 1);
    if (count === 0) recordGame('volcano', 1, 1);
    window.setTimeout(() => setErupting(false), 900);
  };

  return (
    <div className="space-y-5" dir={ar ? 'rtl' : 'ltr'}>
      <button type="button" onClick={onBack} className="flex items-center gap-1.5 text-sm font-medium text-ink/70 dark:text-moonlight/70">
        <ArrowLeft size={16} aria-hidden className={ar ? 'rotate-180' : ''} />
        {ar ? 'رجوع للألعاب' : 'Back to games'}
      </button>

      <h2 className="font-display text-xl font-semibold text-ink dark:text-moonlight">{ar ? 'مختبر البركان' : 'Volcano Lab'}</h2>

      <div className="relative flex h-64 items-end justify-center overflow-hidden rounded-3xl border border-dream/20 bg-gradient-to-b from-dream/10 to-coral/10 dark:from-dusk dark:to-ink">
        {erupting && (
          <div className="animate-erupt absolute bottom-24 text-6xl" aria-hidden>
            🌋💥
          </div>
        )}
        <div className="text-8xl" aria-hidden>
          🌋
        </div>
      </div>

      <button
        type="button"
        onClick={erupt}
        disabled={erupting}
        className="mx-auto flex items-center justify-center rounded-full bg-coral px-6 py-3 font-display text-base font-semibold text-white shadow-lg shadow-coral/30 transition disabled:opacity-60"
      >
        {ar ? 'فجّر البركان!' : 'Erupt the volcano!'}
      </button>

      <p className="text-center text-sm text-ink/60 dark:text-moonlight/60">
        {ar ? `عدد مرات الثوران: ${count}` : `Eruptions so far: ${count}`}
      </p>

      <div className="page-corner rounded-2xl border border-dream/20 bg-white/60 p-4 text-sm leading-relaxed text-ink/80 dark:bg-white/5 dark:text-moonlight/80">
        {ar
          ? 'الصخور المنصهرة تحت الجبل تسمى الصهارة. عندما يتراكم ضغط كافٍ، تندفع للخارج من أعلى البركان!'
          : 'Melted rock under the mountain is called magma. Once enough pressure builds up, it bursts out through the top of the volcano!'}
      </div>
    </div>
  );
}
