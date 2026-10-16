import { useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { Language } from '../../types';

interface Props {
  language: Language;
  onBack: () => void;
}

interface TestObject {
  id: string;
  emoji: string;
  label: { en: string; ar: string };
  magnetic: boolean;
}

const OBJECTS: TestObject[] = [
  { id: 'nail', emoji: '🔩', label: { en: 'Nail', ar: 'مسمار' }, magnetic: true },
  { id: 'paperclip', emoji: '📎', label: { en: 'Paperclip', ar: 'مشبك ورق' }, magnetic: true },
  { id: 'feather', emoji: '🪶', label: { en: 'Feather', ar: 'ريشة' }, magnetic: false },
  { id: 'leaf', emoji: '🍃', label: { en: 'Leaf', ar: 'ورقة شجر' }, magnetic: false },
  { id: 'key', emoji: '🔑', label: { en: 'Key', ar: 'مفتاح' }, magnetic: true },
  { id: 'balloon', emoji: '🎈', label: { en: 'Balloon', ar: 'بالون' }, magnetic: false },
];

export default function MagnetGame({ language, onBack }: Props) {
  const ar = language === 'Arabic';
  const [testedId, setTestedId] = useState<string | null>(null);
  const [result, setResult] = useState<'attract' | 'reject' | null>(null);

  const test = (obj: TestObject) => {
    setTestedId(obj.id);
    setResult(obj.magnetic ? 'attract' : 'reject');
    window.setTimeout(() => {
      setTestedId(null);
      setResult(null);
    }, 1100);
  };

  return (
    <div className="space-y-5" dir={ar ? 'rtl' : 'ltr'}>
      <button type="button" onClick={onBack} className="flex items-center gap-1.5 text-sm font-medium text-ink/70 dark:text-moonlight/70">
        <ArrowLeft size={16} aria-hidden className={ar ? 'rotate-180' : ''} />
        {ar ? 'رجوع للألعاب' : 'Back to games'}
      </button>

      <h2 className="font-display text-xl font-semibold text-ink dark:text-moonlight">{ar ? 'اختبار المغناطيس' : 'Magnet Test'}</h2>
      <p className="text-sm text-ink/60 dark:text-moonlight/60">
        {ar ? 'اضغط على أي شيء لترى هل ينجذب للمغناطيس أم لا.' : 'Tap an object to see whether the magnet pulls it in.'}
      </p>

      <div className="relative flex h-40 items-center justify-center rounded-3xl border border-dream/20 bg-gradient-to-b from-dream/10 to-lantern/10 dark:from-dusk dark:to-ink">
        <div
          className={`text-6xl transition-transform duration-500 ${
            result === 'attract' ? 'scale-125' : result === 'reject' ? '-translate-y-1 rotate-6' : ''
          }`}
          aria-hidden
        >
          🧲
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {OBJECTS.map((obj) => (
          <button
            key={obj.id}
            type="button"
            onClick={() => test(obj)}
            disabled={testedId !== null}
            className={`page-corner flex flex-col items-center gap-1 rounded-2xl border p-3 text-xs font-medium transition disabled:opacity-60 ${
              testedId === obj.id
                ? result === 'attract'
                  ? 'border-lantern bg-lantern/10'
                  : 'border-coral bg-coral/10'
                : 'border-dream/30 bg-white/60 dark:bg-white/5'
            }`}
          >
            <span className="text-3xl" aria-hidden>
              {obj.emoji}
            </span>
            <span className="text-ink dark:text-moonlight">{ar ? obj.label.ar : obj.label.en}</span>
          </button>
        ))}
      </div>

      {result && (
        <p className="text-center text-sm font-medium text-ink/80 dark:text-moonlight/80">
          {result === 'attract'
            ? ar
              ? 'ينجذب! لأنه مصنوع من معدن.'
              : 'Attracted! It’s made of metal.'
            : ar
            ? 'لا ينجذب — المغناطيس لا يجذب إلا الحديد والنيكل والكوبالت.'
            : "Not attracted — magnets only pull iron, nickel, and cobalt."}
        </p>
      )}
    </div>
  );
}
