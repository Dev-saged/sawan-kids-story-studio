import { Activity, Magnet, Radio, RotateCcw } from 'lucide-react';
import { useState } from 'react';
import { GameShell, primaryBtn, type GameProps } from './gameKit';
import { recordGame } from '../../services/progress';

// Fixed "random" starting angles so protons don't jump around on every re-render.
const SCRAMBLED = [20, -35, 140, 200, -80, 310];

export default function MriGame({ language, onBack }: GameProps) {
  const ar = language === 'Arabic';
  const [step, setStep] = useState(0); // 0 scattered · 1 aligned · 2 pulsed · 3 signal read

  const steps = [
    { icon: Magnet, label: ar ? '1. ترتيب البروتونات' : '1. Align protons' },
    { icon: Radio, label: ar ? '2. تشغيل نبضة RF' : '2. Apply RF pulse' },
    { icon: Activity, label: ar ? '3. قراءة الإشارة' : '3. Read signal' },
  ];

  const messages = [
    '',
    ar ? 'البروتونات اتجهت مع المجال المغناطيسي القوي!' : 'Protons aligned with the strong magnetic field!',
    ar ? 'النبضة أثّرت على البروتونات وغيّرت اتجاهها!' : 'The RF pulse tipped the protons over!',
    ar ? 'تم استقبال الإشارة وتكوين الصورة!' : 'Signal received and the image formed!',
  ];

  const angle = (i: number) => (step === 0 ? SCRAMBLED[i] : step === 2 ? 90 : 0);
  const protonTone = ['bg-dream/40', 'bg-dream', 'bg-coral', 'bg-meadow'][step];

  return (
    <GameShell
      language={language}
      onBack={onBack}
      title={ar ? 'مغامرة الرنين المغناطيسي' : 'MRI Adventure'}
      description={ar ? 'رتّب البروتونات وشغّل النبضة لتفهم فكرة الرنين المغناطيسي.' : 'Align protons and apply an RF pulse to see how MRI works.'}
    >
      <div className="grid grid-cols-3 gap-2">
        {steps.map(({ icon: Icon, label }, i) => {
          const isDone = step > i;
          const isNext = step === i;
          return (
            <button
              key={label}
              type="button"
              disabled={!isNext}
              onClick={() => {
                setStep(i + 1);
                if (i + 1 === 3) recordGame('magnetic-resonance', 1, 1);
              }}
              className={`flex flex-col items-center gap-1 rounded-2xl border px-2 py-3 text-xs font-semibold text-ink transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-lantern dark:text-moonlight ${
                isDone ? 'border-meadow bg-meadow/15' : isNext ? 'animate-lantern border-lantern bg-lantern/15' : 'border-dream/20 opacity-50'
              }`}
            >
              <Icon size={18} aria-hidden />
              {label}
            </button>
          );
        })}
      </div>

      <div className="page-corner flex min-h-[260px] flex-col items-center justify-center gap-6 rounded-3xl border border-dashed border-dream/40 bg-white/60 p-6 dark:bg-white/5">
        <div className="flex flex-wrap justify-center gap-5" aria-hidden>
          {SCRAMBLED.map((_, i) => (
            <span
              key={i}
              className={`flex h-12 w-12 items-center justify-center rounded-full text-2xl font-bold text-ink transition-all duration-700 ${protonTone}`}
              style={{ transform: `rotate(${angle(i)}deg)` }}
            >
              ↑
            </span>
          ))}
        </div>
        <p role="status" className="min-h-[3rem] text-center text-sm font-semibold text-ink dark:text-moonlight">
          {messages[step]}
        </p>
      </div>

      {step === 3 && (
        <div className="flex justify-center">
          <button type="button" onClick={() => setStep(0)} className={primaryBtn}>
            <RotateCcw size={16} aria-hidden />
            {ar ? 'إعادة المحاكاة' : 'Reset simulation'}
          </button>
        </div>
      )}
    </GameShell>
  );
}
