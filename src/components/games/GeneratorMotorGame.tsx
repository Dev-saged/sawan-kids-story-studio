import { useState } from 'react';
import { Check } from 'lucide-react';
import { feedback } from '../../services/feedback';
import { GameShell, ResultBanner, primaryBtn, type GameProps } from './gameKit';
import { recordGame } from '../../services/progress';

interface Part {
  id: string;
  en: string;
  ar: string;
}

const GENERATOR_PARTS: Part[] = [
  { id: 'coil', en: 'Coil (wire)', ar: 'ملف (سلك)' },
  { id: 'magnet', en: 'Magnet', ar: 'مغناطيس' },
  { id: 'motion', en: 'Motion source', ar: 'مصدر حركة' },
  { id: 'battery', en: 'Battery', ar: 'بطارية' },
];
const GENERATOR_CORRECT = ['coil', 'magnet', 'motion'];

const MOTOR_PARTS: Part[] = [
  { id: 'coil', en: 'Coil (wire)', ar: 'ملف (سلك)' },
  { id: 'magnet', en: 'Magnet', ar: 'مغناطيس' },
  { id: 'battery', en: 'Electric source (battery)', ar: 'مصدر كهرباء (بطارية)' },
  { id: 'lamp', en: 'Lamp', ar: 'مصباح' },
];
const MOTOR_CORRECT = ['coil', 'magnet', 'battery'];

const isExact = (selected: string[], correct: string[]) => selected.length === correct.length && correct.every((id) => selected.includes(id));

interface CardProps {
  title: string;
  parts: Part[];
  selected: string[];
  ar: boolean;
  accent: string;
  verdict: boolean | null;
  onToggle: (id: string) => void;
}

function DeviceCard({ title, parts, selected, ar, accent, verdict, onToggle }: CardProps) {
  return (
    <fieldset
      className={`page-corner rounded-3xl border bg-white/70 p-4 dark:bg-white/5 ${
        verdict === null ? 'border-dream/20' : verdict ? 'border-meadow' : 'border-coral'
      }`}
    >
      <legend className={`px-2 font-display text-base font-semibold ${accent}`}>{title}</legend>
      <div className="space-y-1">
        {parts.map((part) => {
          const checked = selected.includes(part.id);
          return (
            <label key={part.id} className="flex cursor-pointer items-center gap-3 rounded-xl p-2 text-sm font-medium text-ink hover:bg-dream/10 dark:text-moonlight">
              <input type="checkbox" checked={checked} onChange={() => onToggle(part.id)} className="peer sr-only" />
              <span
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md border-2 transition peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-lantern ${
                  checked ? 'border-lantern bg-lantern text-ink' : 'border-dream/50'
                }`}
              >
                {checked && <Check size={14} aria-hidden />}
              </span>
              {ar ? part.ar : part.en}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

export default function GeneratorMotorGame({ language, onBack }: GameProps) {
  const ar = language === 'Arabic';
  const [generator, setGenerator] = useState<string[]>([]);
  const [motor, setMotor] = useState<string[]>([]);
  const [verdict, setVerdict] = useState<{ generator: boolean; motor: boolean } | null>(null);

  const toggle = (setter: (fn: (s: string[]) => string[]) => void) => (id: string) => {
    setter((list) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]));
    setVerdict(null);
  };

  const check = () => {
    const v = { generator: isExact(generator, GENERATOR_CORRECT), motor: isExact(motor, MOTOR_CORRECT) };
    setVerdict(v);
    recordGame('generator-motor', v.generator && v.motor ? 1 : 0, 1);
    feedback(v.generator && v.motor ? 'good' : 'bad');
  };

  const allOk = verdict?.generator && verdict.motor;

  return (
    <GameShell
      language={language}
      onBack={onBack}
      title={ar ? 'المولد مقابل المحرك' : 'Generator vs Motor'}
      description={ar ? 'اختر الأجزاء الصحيحة لكل جهاز.' : 'Select the correct parts for each device.'}
    >
      <div className="grid gap-4 md:grid-cols-2">
        <DeviceCard
          title={ar ? 'المولد الكهربائي' : 'Electric generator'}
          parts={GENERATOR_PARTS}
          selected={generator}
          ar={ar}
          accent="text-dream"
          verdict={verdict ? verdict.generator : null}
          onToggle={toggle(setGenerator)}
        />
        <DeviceCard
          title={ar ? 'المحرك الكهربائي' : 'Electric motor'}
          parts={MOTOR_PARTS}
          selected={motor}
          ar={ar}
          accent="text-coral"
          verdict={verdict ? verdict.motor : null}
          onToggle={toggle(setMotor)}
        />
      </div>

      <div className="flex justify-center">
        <button type="button" onClick={check} className={primaryBtn}>
          {ar ? 'تحقق' : 'Check'}
        </button>
      </div>

      {verdict && (
        <ResultBanner ok={Boolean(allOk)}>
          {allOk
            ? ar
              ? 'ممتاز! فهمك للطاقة الكهربائية رائع.'
              : 'Excellent! You understand electrical energy well.'
            : ar
            ? 'حاول مرة أخرى وفكّر في مصدر الطاقة.'
            : 'Try again — think about the energy source.'}
        </ResultBanner>
      )}
    </GameShell>
  );
}
