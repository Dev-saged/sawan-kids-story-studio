import { useState } from 'react';
import { CheckCircle2, RotateCcw, Star, XCircle } from 'lucide-react';
import { StoryData } from '../../types';
import { toSrc } from '../../services/media';

interface Props {
  storyData: StoryData;
  ar: boolean;
  onScore: (score: number) => void;
}

// أسئلة الفهم في نهاية القصة + الدرس المستفاد + نجوم
export default function QuizCard({ storyData, ar, onScore }: Props) {
  const quiz = storyData.quiz ?? [];
  const [answers, setAnswers] = useState<(number | null)[]>(() => quiz.map(() => null));
  if (!quiz.length && !storyData.story_info.moral) return null;

  const done = answers.every((a) => a !== null);
  const score = answers.filter((a, i) => a === quiz[i]?.answer).length;

  const choose = (qi: number, oi: number) => {
    if (answers[qi] !== null) return;
    const next = answers.map((a, i) => (i === qi ? oi : a));
    setAnswers(next);
    navigator.vibrate?.(oi === quiz[qi].answer ? 18 : [10, 40, 10]);
    if (next.every((a) => a !== null)) onScore(next.filter((a, i) => a === quiz[i].answer).length);
  };

  return (
    <section className="space-y-4 rounded-3xl border border-lantern/30 bg-gradient-to-br from-star/30 to-white/70 p-5 dark:from-lantern/10 dark:to-white/5" dir={ar ? 'rtl' : 'ltr'}>
      {storyData.story_info.moral && (
        <div className="rounded-2xl bg-white/70 p-4 text-center dark:bg-white/10">
          <p className="font-display text-xs font-bold text-lantern">{ar ? 'ماذا تعلّمنا؟' : 'What did we learn?'}</p>
          <p className="mt-1 text-base font-semibold text-ink dark:text-moonlight">{storyData.story_info.moral}</p>
        </div>
      )}

      {quiz.length > 0 && (
        <>
          <h3 className="font-display text-base font-bold text-ink dark:text-moonlight">{ar ? 'هل فهمت القصة؟' : 'Did you understand the story?'}</h3>
          <ol className="space-y-4">
            {quiz.map((q, qi) => {
              const img = toSrc(storyData.pages.find((p) => p.page === q.page)?.generatedImage);
              return (
                <li key={qi} className="overflow-hidden rounded-2xl border border-dream/20 bg-white/80 dark:bg-white/5">
                  {img && <img src={img} alt="" className="aspect-[16/7] w-full object-cover" loading="lazy" />}
                  <div className="space-y-2.5 p-4">
                    <p className="text-sm font-semibold text-ink dark:text-moonlight">
                      {qi + 1}. {q.question}
                    </p>
                    <div className="grid gap-2">
                      {q.options.map((opt, oi) => {
                        const picked = answers[qi] === oi;
                        const reveal = answers[qi] !== null;
                        const correct = oi === q.answer;
                        const tone = reveal
                          ? correct
                            ? 'border-meadow bg-meadow/15 text-ink dark:text-moonlight'
                            : picked
                            ? 'border-coral bg-coral/10 text-ink dark:text-moonlight'
                            : 'border-dream/20 opacity-60'
                          : 'border-dream/30 hover:border-lantern active:scale-[0.98]';
                        return (
                          <button
                            key={oi}
                            type="button"
                            disabled={reveal}
                            onClick={() => choose(qi, oi)}
                            className={`flex min-h-11 items-center justify-between gap-2 rounded-xl border px-3.5 py-2.5 text-start text-sm transition ${tone}`}
                          >
                            <span>{opt}</span>
                            {reveal && correct && <CheckCircle2 size={18} className="shrink-0 text-meadow" aria-hidden />}
                            {reveal && picked && !correct && <XCircle size={18} className="shrink-0 text-coral" aria-hidden />}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>

          {done && (
            <div className="flex flex-col items-center gap-2 rounded-2xl bg-white/80 p-4 text-center dark:bg-white/10">
              <div className="flex gap-1" aria-label={`${score}/${quiz.length}`}>
                {quiz.map((_, i) => (
                  <Star key={i} size={30} className={i < score ? 'fill-lantern text-lantern' : 'text-dream/40'} aria-hidden />
                ))}
              </div>
              <p className="font-display text-sm font-bold text-ink dark:text-moonlight">
                {score === quiz.length ? (ar ? 'رائع! أنت بطل القراءة' : 'Amazing! Reading champion!') : ar ? `أحسنت! ${score} من ${quiz.length}` : `Well done! ${score} of ${quiz.length}`}
              </p>
              <button
                type="button"
                onClick={() => setAnswers(quiz.map(() => null))}
                className="inline-flex min-h-11 items-center gap-1.5 rounded-full px-4 text-xs font-semibold text-ink/70 hover:text-ink dark:text-moonlight/70"
              >
                <RotateCcw size={14} aria-hidden />
                {ar ? 'أعد المحاولة' : 'Try again'}
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
}
