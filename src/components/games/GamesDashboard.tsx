import { useState } from 'react';
import { GAMES_ROSTER } from '../../constants';
import { Language } from '../../types';
import type { ComponentType } from 'react';
import type { GameProps } from './gameKit';
import VolcanoGame from './VolcanoGame';
import MagnetGame from './MagnetGame';
import TransformerGame from './TransformerGame';
import GeneratorMotorGame from './GeneratorMotorGame';
import MriGame from './MriGame';
import ChemGame from './ChemGame';
import CatchGame from './CatchGame';
import CandyGame from './CandyGame';
import FaultGame from './FaultGame';

// Roster id -> playable component. Adding a game = one file + one line here + one roster entry.
const GAME_COMPONENTS: Record<string, ComponentType<GameProps>> = {
  volcano: VolcanoGame,
  magnet: MagnetGame,
  transformer: TransformerGame,
  'generator-motor': GeneratorMotorGame,
  'magnetic-resonance': MriGame,
  'chemistry-lab': ChemGame,
  'candy-catch': CatchGame,
  'candy-ladder': CandyGame,
  'fault-types': FaultGame,
};

interface Props {
  language: Language;
}

export default function GamesDashboard({ language }: Props) {
  const ar = language === 'Arabic';
  const [activeGame, setActiveGame] = useState<string | null>(null);

  const ActiveGame = activeGame ? GAME_COMPONENTS[activeGame] : undefined;
  if (ActiveGame) return <ActiveGame language={language} onBack={() => setActiveGame(null)} />;

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
