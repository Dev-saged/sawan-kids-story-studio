import { useEffect, useRef, useState } from 'react';
import { feedback } from '../../services/feedback';
import { ELEMENTS, type ChemElement } from './elements';
import { GameShell, ResultBanner, choiceBtn, pickRandom, shuffle, type GameProps } from './gameKit';

interface Question {
  element: ChemElement;
  options: string[];
}

const makeQuestion = (previous?: ChemElement): Question => {
  const element = pickRandom(ELEMENTS.filter((e) => e.symbol !== previous?.symbol));
  const distractors = shuffle(ELEMENTS.filter((e) => e.symbol !== element.symbol))
    .slice(0, 3)
    .map((e) => e.symbol);
  return { element, options: shuffle([element.symbol, ...distractors]) };
};

export default function ChemGame({ language, onBack }: GameProps) {
  const ar = language === 'Arabic';
  const [question, setQuestion] = useState<Question>(() => makeQuestion());
  const [result, setResult] = useState<boolean | null>(null);
  const [score, setScore] = useState(0);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const answer = (symbol: string) => {
    if (result === true) return;
    const ok = symbol === question.element.symbol;
    setResult(ok);
    feedback(ok ? 'good' : 'bad');
    if (ok) {
      setScore((s) => s + 1);
      timer.current = window.setTimeout(() => {
        setQuestion((q) => makeQuestion(q.element));
        setResult(null);
      }, 1000);
    }
  };

  return (
    <GameShell
      language={language}
      onBack={onBack}
      title={ar ? 'تحدي الرمز الكيميائي' : 'Chemical Symbol Challenge'}
      description={ar ? 'اختر الرمز الكيميائي الصحيح للعنصر.' : 'Choose the correct chemical symbol.'}
    >
      <div className="page-corner rounded-3xl border border-dream/20 bg-white/70 p-6 text-center dark:bg-white/5">
        <p className="text-xs font-semibold text-ink/60 dark:text-moonlight/60">{ar ? `النقاط: ${score}` : `Score: ${score}`}</p>
        <p className="mt-3 text-sm text-ink/70 dark:text-moonlight/70">{ar ? 'ما هو رمز عنصر' : 'What is the symbol for'}</p>
        <p className="mb-6 mt-1 font-display text-3xl font-bold text-ink dark:text-moonlight">{ar ? question.element.ar : question.element.en}</p>
        <div className="grid grid-cols-2 gap-3" dir="ltr">
          {question.options.map((symbol) => (
            <button key={symbol} type="button" disabled={result === true} onClick={() => answer(symbol)} className={`${choiceBtn} text-2xl`}>
              {symbol}
            </button>
          ))}
        </div>
      </div>
      {result !== null && <ResultBanner ok={result}>{result ? (ar ? 'إجابة صحيحة!' : 'Correct!') : ar ? 'إجابة خاطئة، حاول مرة أخرى.' : 'Wrong, try again.'}</ResultBanner>}
    </GameShell>
  );
}
