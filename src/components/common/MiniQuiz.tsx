import { useState } from 'react';
import { CheckCircle2, Loader2, RotateCcw, Star, Volume2, XCircle } from 'lucide-react';
import type { QuizItem } from '../../types';
import { feedback } from '../../services/feedback';
import { speak } from '../../services/learn';

interface Props {
  quiz: QuizItem[];
  ar: boolean;
  onFinish?: (score: number, total: number) => void;
  // زر استماع للسؤال بصوت الراوي
  narrated?: boolean;
}

// اختبار قصير عام: سؤال واحد في كل مرة مع تصحيح فوري ونجوم في النهاية
export default function MiniQuiz({ quiz, ar, onFinish, narrated }: Props) {
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [finished, setFinished] = useState(false);
  const [voicing, setVoicing] = useState(false);

  const q = quiz[index];
  if (!q) return null;

  const choose = (i: number) => {
    if (picked !== null) return;
    setPicked(i);
    const ok = i === q.answer;
    feedback(ok ? 'good' : 'bad');
    if (ok) setScore((s) => s + 1);
  };

  const next = () => {
    if (index + 1 < quiz.length) {
      setIndex(index + 1);
      setPicked(null);
      return;
    }
    setFinished(true);
    onFinish?.(score, quiz.length);
  };

  const listen = async () => {
    if (voicing) return;
    setVoicing(true);
    try {
      const url = await speak(`quiz-${q.question}`, `${q.question}. ${q.options.join('. ')}`);
      await new Audio(url).play();
    } catch {
      // الصوت إضافة؛ السؤال يبقى مقروءاً على الشاشة
    } finally {
      setVoicing(false);
    }
  };

  const restart = () => {
    setIndex(0);
    setPicked(null);
    setScore(0);
    setFinished(false);
  };

  if (finished) {
    const stars = score === quiz.length ? 3 : score >= Math.ceil(quiz.length / 2) ? 2 : score > 0 ? 1 : 0;
    return (
      <div className="space-y-3 rounded-2xl bg-lantern/10 p-4 text-center" dir={ar ? 'rtl' : 'ltr'} role="status">
        <div className="flex justify-center gap-1" aria-hidden>
          {[1, 2, 3].map((n) => (
            <Star key={n} size={28} className={n <= stars ? 'fill-lantern text-lantern' : 'text-dream/40'} />
          ))}
        </div>
        <p className="font-display text-sm font-bold text-ink dark:text-moonlight">
          {ar ? `أجبت صحيحاً على ${score} من ${quiz.length}` : `You got ${score} of ${quiz.length} right`}
        </p>
        <button type="button" onClick={restart} className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-dream/30 px-4 text-xs font-semibold text-ink dark:text-moonlight">
          <RotateCcw size={14} aria-hidden />
          {ar ? 'أعد المحاولة' : 'Try again'}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-2xl bg-white/70 p-4 dark:bg-white/5" dir={ar ? 'rtl' : 'ltr'}>
      <p className="text-xs font-semibold text-ink/55 dark:text-moonlight/55">
        {index + 1} / {quiz.length}
      </p>
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-semibold text-ink dark:text-moonlight">{q.question}</p>
        {narrated && (
          <button type="button" onClick={listen} disabled={voicing} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-dream/30 text-ink active:scale-95 dark:text-moonlight" aria-label={ar ? 'استمع للسؤال' : 'Listen to the question'}>
            {voicing ? <Loader2 size={16} className="animate-spin" aria-hidden /> : <Volume2 size={16} aria-hidden />}
          </button>
        )}
      </div>
      <div className="grid gap-2">
        {q.options.map((opt, i) => {
          const reveal = picked !== null;
          const correct = i === q.answer;
          const tone = reveal
            ? correct
              ? 'border-meadow bg-meadow/15'
              : picked === i
                ? 'border-coral bg-coral/10'
                : 'border-dream/20 opacity-60'
            : 'border-dream/30 hover:border-lantern';
          return (
            <button
              key={i}
              type="button"
              disabled={reveal}
              onClick={() => choose(i)}
              className={`flex min-h-11 items-center justify-between gap-2 rounded-xl border px-3 py-2 text-start text-sm text-ink transition active:scale-[0.99] dark:text-moonlight ${tone}`}
            >
              <span>{opt}</span>
              {reveal && correct && <CheckCircle2 size={16} className="shrink-0 text-meadow" aria-hidden />}
              {reveal && !correct && picked === i && <XCircle size={16} className="shrink-0 text-coral" aria-hidden />}
            </button>
          );
        })}
      </div>
      {picked !== null && (
        <button type="button" onClick={next} className="min-h-11 w-full rounded-xl bg-lantern px-4 text-sm font-bold text-ink active:scale-[0.99]">
          {index + 1 < quiz.length ? (ar ? 'التالي' : 'Next') : ar ? 'النتيجة' : 'See result'}
        </button>
      )}
    </div>
  );
}
