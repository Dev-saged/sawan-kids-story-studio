import { useState, type ComponentType } from 'react';
import { BookOpen, Brain, Calendar, Candy, CheckCircle2, Cog, FlaskConical, Flame, GraduationCap, Lock, Magnet, Mountain, Ruler, Star, Trophy, Zap, type LucideIcon } from 'lucide-react';
import { GAMES_ROSTER } from '../../constants';
import { dailyDone, dailyGameId, totalStars, useProgress } from '../../services/progress';
import type { Language } from '../../types';
import type { Section } from '../layout/NavBar';
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
import QuizMasterGame from './QuizMasterGame';

// Roster id -> playable component. Adding a game = one file + one line here + one roster entry.
const GAME_COMPONENTS: Record<string, ComponentType<GameProps & { onMakeStory?: (idea: string) => void }>> = {
  volcano: VolcanoGame,
  magnet: MagnetGame,
  transformer: TransformerGame,
  'generator-motor': GeneratorMotorGame,
  'magnetic-resonance': MriGame,
  'chemistry-lab': ChemGame,
  'candy-catch': CatchGame,
  'candy-ladder': CandyGame,
  'fault-types': FaultGame,
  'quiz-master': QuizMasterGame,
};

const ICONS: Record<string, LucideIcon> = {
  volcano: Mountain,
  magnet: Magnet,
  transformer: Zap,
  'generator-motor': Cog,
  'magnetic-resonance': Brain,
  'chemistry-lab': FlaskConical,
  'candy-catch': Candy,
  'candy-ladder': Trophy,
  'fault-types': Ruler,
  'quiz-master': GraduationCap,
};

interface Props {
  language: Language;
  onMakeStory?: (idea: string) => void;
  onNavigate?: (section: Section) => void;
}

export default function GamesDashboard({ language, onMakeStory, onNavigate }: Props) {
  const ar = language === 'Arabic';
  const [activeGame, setActiveGame] = useState<string | null>(null);
  const progress = useProgress();

  const ActiveGame = activeGame ? GAME_COMPONENTS[activeGame] : undefined;
  if (ActiveGame) return <ActiveGame language={language} onBack={() => setActiveGame(null)} onMakeStory={onMakeStory} />;

  const dailyId = dailyGameId();
  const daily = GAMES_ROSTER.find((g) => g.id === dailyId);
  const finishedDaily = dailyDone(progress);
  const DailyIcon = ICONS[dailyId] ?? Trophy;

  return (
    <div className="space-y-5" dir={ar ? 'rtl' : 'ltr'}>
      <div>
        <h2 className="font-display text-xl font-semibold text-ink dark:text-moonlight">{ar ? 'الألعاب' : 'Games'}</h2>
        <p className="mt-1 text-sm text-ink/60 dark:text-moonlight/60">{ar ? 'تعلّم العلوم عن طريق اللعب واجمع النجوم.' : 'Learn science by playing and collect stars.'}</p>
      </div>

      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded-2xl bg-lantern/15 p-3">
          <Star size={18} className="mx-auto fill-lantern text-lantern" aria-hidden />
          <p className="mt-1 font-display text-lg font-bold text-ink dark:text-moonlight">{totalStars(progress)}</p>
          <p className="text-[11px] text-ink/60 dark:text-moonlight/60">{ar ? 'نجوم' : 'stars'}</p>
        </div>
        <div className="rounded-2xl bg-coral/10 p-3">
          <Flame size={18} className="mx-auto text-coral" aria-hidden />
          <p className="mt-1 font-display text-lg font-bold text-ink dark:text-moonlight">{progress.streak.days}</p>
          <p className="text-[11px] text-ink/60 dark:text-moonlight/60">{ar ? 'أيام متتالية' : 'day streak'}</p>
        </div>
        <div className="rounded-2xl bg-dream/15 p-3">
          <BookOpen size={18} className="mx-auto text-dream" aria-hidden />
          <p className="mt-1 font-display text-lg font-bold text-ink dark:text-moonlight">{Object.keys(progress.learn).length}</p>
          <p className="text-[11px] text-ink/60 dark:text-moonlight/60">{ar ? 'بطاقات قرأتها' : 'cards read'}</p>
        </div>
      </div>

      {daily && (
        <button
          type="button"
          onClick={() => setActiveGame(dailyId)}
          className={`flex w-full items-center gap-3 rounded-3xl border p-4 text-start transition active:scale-[0.99] ${finishedDaily ? 'border-meadow bg-meadow/10' : 'border-lantern/50 bg-gradient-to-br from-star/30 to-white/70 dark:from-lantern/10 dark:to-white/5'}`}
        >
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-lantern/25 text-ink dark:text-moonlight">
            {finishedDaily ? <CheckCircle2 size={22} className="text-meadow" aria-hidden /> : <Calendar size={22} aria-hidden />}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-display text-sm font-bold text-ink dark:text-moonlight">{ar ? 'تحدي اليوم' : "Today's challenge"}</span>
            <span className="flex items-center gap-1.5 text-xs text-ink/65 dark:text-moonlight/65">
              <DailyIcon size={13} aria-hidden />
              {ar ? daily.title.ar : daily.title.en} · {finishedDaily ? (ar ? 'أنجزته، أحسنت!' : 'Done, well played!') : ar ? 'العبها لتحافظ على أيامك المتتالية' : 'play it to keep your streak'}
            </span>
          </span>
        </button>
      )}

      <div className="grid grid-cols-2 gap-3">
        {GAMES_ROSTER.map((game) => {
          const Icon = game.available ? (ICONS[game.id] ?? Trophy) : Lock;
          const stat = progress.games[game.id];
          return (
            <button
              key={game.id}
              type="button"
              disabled={!game.available}
              onClick={() => setActiveGame(game.id)}
              className="page-corner flex min-h-32 flex-col items-start gap-1.5 rounded-2xl border border-dream/20 bg-white/70 p-4 text-start transition enabled:hover:border-lantern enabled:active:scale-[0.98] disabled:opacity-50 dark:bg-white/5"
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-dream/15 text-dream">
                <Icon size={22} aria-hidden />
              </span>
              <span className="font-display text-sm font-semibold text-ink dark:text-moonlight">{ar ? game.title.ar : game.title.en}</span>
              {game.available && stat ? (
                <span className="flex items-center gap-0.5" aria-label={ar ? `${stat.stars} من 3 نجوم` : `${stat.stars} of 3 stars`}>
                  {[1, 2, 3].map((n) => (
                    <Star key={n} size={13} className={n <= stat.stars ? 'fill-lantern text-lantern' : 'text-dream/35'} aria-hidden />
                  ))}
                </span>
              ) : (
                <span className="text-xs text-ink/60 dark:text-moonlight/60">{game.available ? (ar ? 'العب الآن' : 'Play now') : ar ? 'قريبًا' : 'Coming soon'}</span>
              )}
            </button>
          );
        })}
      </div>

      {onNavigate && (
        <div className="grid grid-cols-2 gap-3">
          <button type="button" onClick={() => onNavigate('learn')} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-dream/30 bg-white/60 text-xs font-semibold text-ink dark:bg-white/5 dark:text-moonlight">
            <BookOpen size={16} aria-hidden />
            {ar ? 'اقرأ وتعلّم' : 'Read & Learn'}
          </button>
          <button type="button" onClick={() => onNavigate('studio')} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-dream/30 bg-white/60 text-xs font-semibold text-ink dark:bg-white/5 dark:text-moonlight">
            <GraduationCap size={16} aria-hidden />
            {ar ? 'اكتب قصة جديدة' : 'Write a story'}
          </button>
        </div>
      )}
    </div>
  );
}
