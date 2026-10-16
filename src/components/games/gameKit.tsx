import type { ReactNode } from 'react';
import { ArrowLeft } from 'lucide-react';
import type { Language } from '../../types';

export interface GameProps {
  language: Language;
  onBack: () => void;
}

export const shuffle = <T,>(items: readonly T[]): T[] => {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
};

export const pickRandom = <T,>(items: readonly T[]): T => items[Math.floor(Math.random() * items.length)];

export const choiceBtn =
  'rounded-2xl border border-dream/30 bg-white/70 px-4 py-3 text-sm font-semibold text-ink transition enabled:hover:border-lantern enabled:active:scale-[0.98] disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-lantern dark:bg-white/10 dark:text-moonlight';

export const primaryBtn =
  'inline-flex items-center justify-center gap-2 rounded-full bg-lantern px-6 py-3 font-display text-sm font-semibold text-ink shadow-md shadow-lantern/30 transition active:scale-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink';

interface ShellProps extends GameProps {
  title: string;
  description: string;
  children: ReactNode;
}

export function GameShell({ language, onBack, title, description, children }: ShellProps) {
  const ar = language === 'Arabic';
  return (
    <div className="space-y-5" dir={ar ? 'rtl' : 'ltr'}>
      <button type="button" onClick={onBack} className="flex items-center gap-1.5 text-sm font-medium text-ink/70 dark:text-moonlight/70">
        <ArrowLeft size={16} aria-hidden className={ar ? 'rotate-180' : ''} />
        {ar ? 'رجوع للألعاب' : 'Back to games'}
      </button>
      <div>
        <h2 className="font-display text-xl font-semibold text-ink dark:text-moonlight">{title}</h2>
        <p className="mt-1 text-sm text-ink/60 dark:text-moonlight/60">{description}</p>
      </div>
      {children}
    </div>
  );
}

export function ResultBanner({ ok, children }: { ok: boolean; children: ReactNode }) {
  return (
    <p
      role="status"
      className={`rounded-2xl border px-4 py-3 text-center text-sm font-semibold text-ink dark:text-moonlight ${
        ok ? 'border-meadow bg-meadow/15' : 'border-coral bg-coral/10'
      }`}
    >
      {children}
    </p>
  );
}
