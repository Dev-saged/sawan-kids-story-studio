import { useState } from 'react';
import { GAMES_ROSTER } from '../../constants';
import { Language } from '../../types';
import VolcanoGame from './VolcanoGame';
import MagnetGame from './MagnetGame';

interface Props {
  language: Language;
}

export default function GamesDashboard({ language }: Props) {
  const ar = language === 'Arabic';
  const [activeGame, setActiveGame] = useState<string | null>(null);

  if (activeGame === 'volcano') return <VolcanoGame language={language} onBack={() => setActiveGame(null)} />;
  if (activeGame === 'magnet') return <MagnetGame language={language} onBack={() => setActiveGame(null)} />;

  return (
    <div className="space-y-4" dir={ar ? 'rtl' : 'ltr'}>
      <div>
        <h2 className="font-display text-xl font-semibold text-ink dark:text-moonlight">{ar ? 'الألعاب' : 'Games'}</h2>
        <p className="mt-1 text-sm text-ink/60 dark:text-moonlight/60">
          {ar ? 'تعلّم العلوم عن طريق اللعب.' : 'Learn science by playing.'}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {GAMES_ROSTER.map((game) => (
          <button
            key={game.id}
            type="button"
            disabled={!game.available}
            onClick={() => setActiveGame(game.id)}
            className="page-corner flex flex-col items-start gap-1.5 rounded-2xl border border-dream/20 bg-white/70 p-4 text-start transition enabled:hover:border-lantern disabled:opacity-50 dark:bg-white/5"
          >
            <span className="text-3xl" aria-hidden>
              {game.emoji}
            </span>
            <span className="font-display text-sm font-semibold text-ink dark:text-moonlight">
              {ar ? game.title.ar : game.title.en}
            </span>
            <span className="text-xs text-ink/60 dark:text-moonlight/60">
              {game.available ? (ar ? 'العب الآن' : 'Play now') : ar ? 'قريبًا' : 'Coming soon'}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
