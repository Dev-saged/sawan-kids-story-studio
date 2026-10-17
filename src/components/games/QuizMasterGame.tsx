import { useState } from 'react';
import { ArrowUp, ArrowDown, BookPlus, Loader2, Sparkles } from 'lucide-react';
import { LEARN_CATEGORIES } from '../../data/learnCards';
import { AGE_GROUPS } from '../../constants';
import { topicQuiz, type QuizLevel } from '../../services/learn';
import { recordGame } from '../../services/progress';
import type { AgeGroup, QuizItem } from '../../types';
import MiniQuiz from '../common/MiniQuiz';
import ErrorDetails from '../common/ErrorDetails';
import { GameShell, primaryBtn, type GameProps } from './gameKit';

const ROUND = 5;
const LEVELS: QuizLevel[] = ['easy', 'medium', 'hard'];
const LEVEL_LABEL: Record<QuizLevel, { ar: string; en: string }> = {
  easy: { ar: 'سهل', en: 'Easy' },
  medium: { ar: 'متوسط', en: 'Medium' },
  hard: { ar: 'صعب', en: 'Hard' },
};

interface Props extends GameProps {
  onMakeStory?: (idea: string) => void;
}

// معلم الأسئلة: موضوع من اختيارك، 5 أسئلة في كل جولة، والصعوبة ترتفع أو تنخفض حسب نتيجتك
export default function QuizMasterGame({ language, onBack, onMakeStory }: Props) {
  const ar = language === 'Arabic';
  const [topic, setTopic] = useState('');
  const [age, setAge] = useState<AgeGroup>('7-9');
  const [level, setLevel] = useState<QuizLevel>('easy');
  const [quiz, setQuiz] = useState<QuizItem[] | null>(null);
  const [round, setRound] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const start = async (nextLevel: QuizLevel, subject = topic) => {
    const t = subject.trim();
    if (t.length < 2 || loading) return;
    setLoading(true);
    setError(null);
    try {
      const items = await topicQuiz(t, nextLevel, ROUND, language, age);
      setLevel(nextLevel);
      setQuiz(items);
      setRound((r) => r + 1);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const finish = (score: number, total: number) => {
    recordGame('quiz-master', score, total);
    const ratio = score / total;
    const at = LEVELS.indexOf(level);
    const to = ratio >= 0.8 ? Math.min(at + 1, 2) : ratio <= 0.4 ? Math.max(at - 1, 0) : at;
    setLevel(LEVELS[to]);
    setNote(to > at ? (ar ? 'ممتاز! سنرفع الصعوبة في الجولة القادمة.' : 'Great! Next round will be harder.') : to < at ? (ar ? 'لا بأس، سنجعل الجولة القادمة أسهل.' : 'No worries, the next round will be easier.') : null);
  };

  const again = () => {
    setQuiz(null);
    setNote(null);
    void start(level);
  };

  const inputCls =
    'min-h-11 w-full rounded-2xl border border-dream/30 bg-white/70 px-4 text-sm text-ink outline-none focus-visible:border-lantern focus-visible:ring-2 focus-visible:ring-lantern/40 dark:bg-white/10 dark:text-moonlight';

  return (
    <GameShell
      language={language}
      onBack={onBack}
      title={ar ? 'معلّم الأسئلة' : 'Quiz Master'}
      description={ar ? 'اختر أي موضوع وأجب عن أسئلة تتكيّف مع مستواك، ويمكنك الاستماع لكل سؤال.' : 'Pick any topic and answer questions that adapt to your level. You can listen to every question.'}
    >
      {!quiz ? (
        <div className="space-y-4 rounded-3xl border border-dream/20 bg-white/70 p-5 dark:bg-white/5">
          <div>
            <label htmlFor="qm-topic" className="mb-1.5 block text-sm font-semibold text-ink/80 dark:text-moonlight/80">
              {ar ? 'الموضوع' : 'Topic'}
            </label>
            <input id="qm-topic" value={topic} onChange={(e) => setTopic(e.target.value)} maxLength={120} className={inputCls} placeholder={ar ? 'مثال: الديناصورات، الفضاء، الأرقام' : 'e.g. dinosaurs, space, numbers'} />
          </div>
          <div className="flex flex-wrap gap-2" role="group" aria-label={ar ? 'مواضيع جاهزة' : 'Ready topics'}>
            {LEARN_CATEGORIES.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setTopic(ar ? c.ar : c.en)}
                className="min-h-11 rounded-full border border-dream/30 bg-white/70 px-3.5 text-xs font-semibold text-ink active:scale-95 dark:bg-white/10 dark:text-moonlight"
              >
                {ar ? c.ar : c.en}
              </button>
            ))}
          </div>
          <label className="flex items-center gap-2 text-xs font-semibold text-ink/65 dark:text-moonlight/65">
            {ar ? 'عمر الطفل' : 'Child age'}
            <select value={age} onChange={(e) => setAge(e.target.value as AgeGroup)} className="min-h-11 rounded-xl border border-dream/30 bg-white/70 px-2 text-xs text-ink dark:bg-white/10 dark:text-moonlight">
              {AGE_GROUPS.map((g) => (
                <option key={g.value} value={g.value}>
                  {g.label}
                </option>
              ))}
            </select>
          </label>
          <button type="button" disabled={loading || topic.trim().length < 2} onClick={() => start('easy')} className={`${primaryBtn} w-full min-h-12 disabled:opacity-50`}>
            {loading ? <Loader2 size={16} className="animate-spin" aria-hidden /> : <Sparkles size={16} aria-hidden />}
            {ar ? 'ابدأ الاختبار' : 'Start the quiz'}
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs font-semibold text-ink/65 dark:text-moonlight/65" dir={ar ? 'rtl' : 'ltr'}>
            <span>
              {topic} · {ar ? `الجولة ${round}` : `Round ${round}`}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-lantern/20 px-3 py-1 text-ink dark:text-moonlight">
              {LEVELS.indexOf(level) === 2 ? <ArrowUp size={12} aria-hidden /> : LEVELS.indexOf(level) === 0 ? <ArrowDown size={12} aria-hidden /> : null}
              {ar ? LEVEL_LABEL[level].ar : LEVEL_LABEL[level].en}
            </span>
          </div>
          <MiniQuiz key={round} quiz={quiz} ar={ar} narrated onFinish={finish} />
          {note && <p role="status" className="rounded-2xl bg-lantern/15 p-3 text-center text-sm font-semibold text-ink dark:text-moonlight">{note}</p>}
          <div className="grid grid-cols-2 gap-2" dir={ar ? 'rtl' : 'ltr'}>
            <button type="button" disabled={loading} onClick={again} className={`${primaryBtn} min-h-12 disabled:opacity-50`}>
              {loading ? <Loader2 size={16} className="animate-spin" aria-hidden /> : null}
              {ar ? 'جولة جديدة' : 'New round'}
            </button>
            <button
              type="button"
              onClick={() => {
                setQuiz(null);
                setNote(null);
              }}
              className="inline-flex min-h-12 items-center justify-center rounded-full border border-dream/30 text-sm font-semibold text-ink dark:text-moonlight"
            >
              {ar ? 'غيّر الموضوع' : 'Change topic'}
            </button>
          </div>
          {onMakeStory && (
            <button
              type="button"
              onClick={() => onMakeStory(ar ? `قصة ممتعة للأطفال عن ${topic} فيها معلومات صحيحة ومغامرة لطيفة` : `A fun children's story about ${topic} with true facts and a gentle adventure`)}
              className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full border border-lantern/50 bg-lantern/15 text-xs font-semibold text-ink dark:text-moonlight"
            >
              <BookPlus size={14} aria-hidden />
              {ar ? 'حوّل الموضوع إلى قصة' : 'Turn this topic into a story'}
            </button>
          )}
        </div>
      )}
      {error && (
        <div role="alert" className="text-sm text-coral">
          <p>{error}</p>
          <ErrorDetails ar={ar} />
        </div>
      )}
    </GameShell>
  );
}
