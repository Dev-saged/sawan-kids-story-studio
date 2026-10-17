import { useEffect, useRef, useState } from 'react';
import { BookPlus, Brain, Image as ImageIcon, Loader2, Volume2 } from 'lucide-react';
import type { AgeGroup, Language, QuizItem } from '../../types';
import { illustrate, quizFor, speak } from '../../services/learn';
import { recordLearnQuiz } from '../../services/progress';
import MiniQuiz from '../common/MiniQuiz';
import ErrorDetails from '../common/ErrorDetails';

interface Props {
  id: string;
  title: string;
  text: string;
  language: Language;
  ageGroup: AgeGroup;
  imagePrompt?: string;
  quiz?: QuizItem[];
  onMakeStory?: (idea: string) => void;
}

type Busy = 'audio' | 'image' | 'quiz' | null;

const btn =
  'inline-flex min-h-11 items-center justify-center gap-1.5 rounded-full border border-dream/30 bg-white/70 px-3.5 text-xs font-semibold text-ink transition hover:border-lantern active:scale-95 disabled:opacity-50 dark:bg-white/10 dark:text-moonlight';

// أدوات بطاقة المعلومة: استمع، ارسم، اختبرني، حوّلها إلى قصة
export default function LearnActions({ id, title, text, language, ageGroup, imagePrompt, quiz: given, onMakeStory }: Props) {
  const ar = language === 'Arabic';
  const [busy, setBusy] = useState<Busy>(null);
  const [error, setError] = useState<string | null>(null);
  const [audio, setAudio] = useState<string | null>(null);
  const [image, setImage] = useState<string | null>(null);
  const [quiz, setQuiz] = useState<QuizItem[] | null>(given?.length ? given : null);
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    if (audio) void audioRef.current?.play().catch(() => undefined);
  }, [audio]);

  const run = async (kind: Exclude<Busy, null>, fn: () => Promise<void>) => {
    setBusy(kind);
    setError(null);
    try {
      await fn();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const idea = ar
    ? `قصة ممتعة وتعليمية للأطفال يكتشف فيها بطل صغير فضولي بمساعدة أصدقائه إجابة هذا السؤال: ${title}`
    : `A fun educational story where a curious little hero and friends discover the answer to this question: ${title}`;

  return (
    <div className="space-y-3" dir={ar ? 'rtl' : 'ltr'}>
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={busy !== null} onClick={() => run('audio', async () => setAudio(await speak(id, `${title}. ${text}`)))} className={btn}>
          {busy === 'audio' ? <Loader2 size={14} className="animate-spin" aria-hidden /> : <Volume2 size={14} aria-hidden />}
          {ar ? 'استمع' : 'Listen'}
        </button>
        <button
          type="button"
          disabled={busy !== null}
          onClick={() => run('image', async () => setImage(await illustrate(id, imagePrompt || `${title}. ${text.slice(0, 260)}`)))}
          className={btn}
        >
          {busy === 'image' ? <Loader2 size={14} className="animate-spin" aria-hidden /> : <ImageIcon size={14} aria-hidden />}
          {ar ? 'ارسم الفكرة' : 'Draw it'}
        </button>
        <button
          type="button"
          disabled={busy !== null}
          onClick={() => (quiz ? setQuiz([...quiz]) : run('quiz', async () => setQuiz(await quizFor(title, text, language, ageGroup))))}
          className={btn}
        >
          {busy === 'quiz' ? <Loader2 size={14} className="animate-spin" aria-hidden /> : <Brain size={14} aria-hidden />}
          {ar ? 'اختبرني' : 'Quiz me'}
        </button>
        {onMakeStory && (
          <button type="button" onClick={() => onMakeStory(idea)} className={`${btn} border-lantern/50 bg-lantern/15`}>
            <BookPlus size={14} aria-hidden />
            {ar ? 'حوّلها إلى قصة' : 'Make it a story'}
          </button>
        )}
      </div>

      {audio && <audio ref={audioRef} src={audio} controls className="h-11 w-full" />}
      {image && <img src={image} alt={title} className="aspect-[4/3] w-full rounded-2xl object-cover" />}
      {quiz && quiz.length > 0 && <MiniQuiz key={quiz.length + title} quiz={quiz} ar={ar} onFinish={(score, total) => recordLearnQuiz(id, score, total)} />}
      {error && (
        <div role="alert" className="text-xs text-coral">
          <p>{error}</p>
          <ErrorDetails ar={ar} />
        </div>
      )}
    </div>
  );
}
