import { useRef, useState } from 'react';
import { ArrowRight, CheckCircle2, Shield, Trophy, XCircle } from 'lucide-react';
import { feedback } from '../../services/feedback';
import { GameShell, choiceBtn, pickRandom, primaryBtn, shuffle, type GameProps } from './gameKit';

interface Answer {
  ar: string;
  en: string;
  correct?: true;
}
interface Question {
  ar: string;
  en: string;
  answers: Answer[];
}

const a = (ar: string, en: string, correct?: true): Answer => ({ ar, en, correct });

const QUESTIONS: Question[] = [
  { ar: 'ما نوع حدود الصفائح التي تُكوّن البراكين المخروطية؟', en: 'Which plate boundary forms composite volcanoes?', answers: [a('تقاربية', 'Convergent', true), a('تباعدية', 'Divergent'), a('انزلاقية', 'Transform'), a('ساكنة', 'Stable')] },
  { ar: 'ما الرمز الكيميائي للكالسيوم؟', en: 'What is the chemical symbol for Calcium?', answers: [a('Ca', 'Ca', true), a('Mg', 'Mg'), a('Na', 'Na'), a('Cl', 'Cl')] },
  { ar: 'أي كوكب يُعرف بالكوكب الأحمر؟', en: 'Which planet is known as the Red Planet?', answers: [a('المريخ', 'Mars', true), a('الأرض', 'Earth'), a('زحل', 'Saturn'), a('عطارد', 'Mercury')] },
  { ar: 'ما العنصر الذي تتكون منه حشوة قلم الرصاص؟', en: 'What is pencil lead made of?', answers: [a('الكربون (الجرافيت)', 'Carbon (graphite)', true), a('الرصاص', 'Lead'), a('الحديد', 'Iron'), a('الذهب', 'Gold')] },
  { ar: 'أي جزء من الزهرة يتحول إلى ثمرة؟', en: 'Which part of the flower becomes the fruit?', answers: [a('المبيض', 'Ovary', true), a('البتلات', 'Petals'), a('السداة', 'Stamen'), a('الجذر', 'Root')] },
  { ar: 'ما الغاز الذي نتنفسه للحياة؟', en: 'What gas do we breathe to live?', answers: [a('الأكسجين', 'Oxygen', true), a('الهيدروجين', 'Hydrogen'), a('الهيليوم', 'Helium'), a('النيتروجين', 'Nitrogen')] },
  { ar: 'ما أكبر حيوان في العالم؟', en: 'What is the largest animal in the world?', answers: [a('الحوت الأزرق', 'Blue whale', true), a('الفيل', 'Elephant'), a('الزرافة', 'Giraffe'), a('القرش', 'Shark')] },
  { ar: 'كم عدد ألوان قوس قزح؟', en: 'How many colors are in a rainbow?', answers: [a('7', '7', true), a('5', '5'), a('6', '6'), a('8', '8')] },
  { ar: 'كم عدد أرجل العنكبوت؟', en: 'How many legs does a spider have?', answers: [a('8', '8', true), a('6', '6'), a('10', '10'), a('4', '4')] },
  { ar: 'ما أكبر كوكب في مجموعتنا الشمسية؟', en: 'Which is the largest planet in our solar system?', answers: [a('المشتري', 'Jupiter', true), a('زحل', 'Saturn'), a('الأرض', 'Earth'), a('نبتون', 'Neptune')] },
  { ar: 'ماذا يصنع النحل؟', en: 'What do bees make?', answers: [a('العسل', 'Honey', true), a('الحرير', 'Silk'), a('الحليب', 'Milk'), a('السكر', 'Sugar')] },
  { ar: 'ماذا يُسمّى الماء كيميائيًا؟', en: 'What is H2O?', answers: [a('الماء', 'Water', true), a('الملح', 'Salt'), a('الهواء', 'Air'), a('السكر', 'Sugar')] },
  { ar: 'أي جزء من النبات يمتص الماء من التربة؟', en: 'Which part of a plant takes in water from the soil?', answers: [a('الجذور', 'Roots', true), a('الأوراق', 'Leaves'), a('الأزهار', 'Flowers'), a('الثمار', 'Fruits')] },
  { ar: 'ما أقرب نجم إلى الأرض؟', en: 'Which is the closest star to Earth?', answers: [a('الشمس', 'The Sun', true), a('القمر', 'The Moon'), a('المريخ', 'Mars'), a('النجم القطبي', 'The North Star')] },
  { ar: 'كم عدد القارات في العالم؟', en: 'How many continents are there?', answers: [a('7', '7', true), a('5', '5'), a('6', '6'), a('8', '8')] },
  { ar: 'ما القوة التي تشدّ الأشياء نحو الأرض؟', en: 'What force pulls things down to the ground?', answers: [a('الجاذبية', 'Gravity', true), a('المغناطيسية', 'Magnetism'), a('الاحتكاك', 'Friction'), a('الرياح', 'Wind')] },
  { ar: 'أي حيوان يُلقّب بملك الغابة؟', en: 'Which animal is called the king of the jungle?', answers: [a('الأسد', 'Lion', true), a('النمر', 'Tiger'), a('الفيل', 'Elephant'), a('الدب', 'Bear')] },
  { ar: 'ما أصلب مادة طبيعية؟', en: 'What is the hardest natural material?', answers: [a('الألماس', 'Diamond', true), a('الذهب', 'Gold'), a('الحديد', 'Iron'), a('الكوارتز', 'Quartz')] },
  { ar: 'كم ساعة في اليوم الواحد؟', en: 'How many hours are in one day?', answers: [a('24', '24', true), a('12', '12'), a('48', '48'), a('60', '60')] },
  { ar: 'أي عضو يضخّ الدم في الجسم؟', en: 'Which organ pumps blood around the body?', answers: [a('القلب', 'Heart', true), a('الرئتان', 'Lungs'), a('الدماغ', 'Brain'), a('المعدة', 'Stomach')] },
];

const MAX_LEVEL = 25;
const SAFE_LEVELS = [5, 10, 18];

const MESSAGES = {
  win: {
    ar: ['رائع! واصل التقدم', 'أحسنت! إجابة مذهلة', 'أنت بطل البونبون', 'اقتربت من القمة'],
    en: ['Great! Keep climbing', 'Well done! Amazing answer', 'You are a candy champion', 'Almost at the top'],
  },
  lose: {
    ar: ['لا بأس، جرّب مرة أخرى', 'المهم أنك تتعلم', 'المرة القادمة ستنجح', 'لا تيأس، حاول من جديد'],
    en: ["It's okay, try again", 'What matters is that you learn', "You'll get it next time", "Don't give up, go again"],
  },
};

type Phase = 'start' | 'playing' | 'feedback' | 'won';

export default function CandyGame({ language, onBack }: GameProps) {
  const ar = language === 'Arabic';
  const [phase, setPhase] = useState<Phase>('start');
  const [level, setLevel] = useState(0);
  const [safeLevel, setSafeLevel] = useState(0);
  const [question, setQuestion] = useState<Question>(QUESTIONS[0]);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [wasCorrect, setWasCorrect] = useState(false);
  const [message, setMessage] = useState('');
  const deck = useRef<Question[]>([]);

  // A shuffled deck means no question repeats until the whole pool has been seen.
  const nextQuestion = () => {
    if (deck.current.length === 0) deck.current = shuffle(QUESTIONS);
    const q = deck.current.pop()!;
    setQuestion(q);
    setAnswers(shuffle(q.answers));
    setPhase('playing');
  };

  const answer = (choice: Answer) => {
    if (phase !== 'playing') return;
    const ok = Boolean(choice.correct);
    setWasCorrect(ok);
    feedback(ok ? 'good' : 'bad');
    setMessage(pickRandom(MESSAGES[ok ? 'win' : 'lose'][ar ? 'ar' : 'en']));

    if (!ok) {
      setLevel(safeLevel);
      setPhase('feedback');
      return;
    }
    const next = level + 1;
    setLevel(next);
    if (SAFE_LEVELS.includes(next)) setSafeLevel(next);
    setPhase(next >= MAX_LEVEL ? 'won' : 'feedback');
  };

  const restart = () => {
    setLevel(0);
    setSafeLevel(0);
    nextQuestion();
  };

  return (
    <GameShell
      language={language}
      onBack={onBack}
      title={ar ? 'من سيربح البونبون' : 'Who Will Win the Candy'}
      description={ar ? 'أجب عن الأسئلة واصعد سلم البونبون!' : 'Answer questions and climb the candy ladder!'}
    >
      <div className="space-y-2 rounded-3xl border border-dream/20 bg-white/70 p-4 dark:bg-white/5">
        <div className="flex items-center justify-between text-xs font-semibold text-ink/80 dark:text-moonlight/80">
          <span className="flex items-center gap-1">
            <Trophy size={14} aria-hidden className="text-lantern" />
            {ar ? `المستوى ${level} / ${MAX_LEVEL}` : `Level ${level} / ${MAX_LEVEL}`}
          </span>
          <span className="flex items-center gap-1">
            <Shield size={14} aria-hidden className="text-lantern" />
            {ar ? `المستوى الآمن: ${safeLevel || '—'}` : `Safe level: ${safeLevel || '—'}`}
          </span>
        </div>
        <div
          className="grid items-end gap-0.5"
          style={{ gridTemplateColumns: `repeat(${MAX_LEVEL}, minmax(0, 1fr))` }}
          role="progressbar"
          aria-valuenow={level}
          aria-valuemin={0}
          aria-valuemax={MAX_LEVEL}
        >
          {Array.from({ length: MAX_LEVEL }, (_, i) => {
            const lvl = i + 1;
            const safe = SAFE_LEVELS.includes(lvl);
            return (
              <span
                key={lvl}
                className={`rounded-sm transition-colors ${safe ? 'h-5 border border-lantern' : 'h-3'} ${
                  lvl <= level ? 'bg-lantern' : 'bg-dream/20'
                } ${lvl === level ? 'ring-2 ring-ink dark:ring-moonlight' : ''}`}
              />
            );
          })}
        </div>
      </div>

      <div className="page-corner flex min-h-[320px] flex-col justify-center rounded-3xl border border-dream/20 bg-white/70 p-5 dark:bg-white/5">
        {phase === 'start' && (
          <div className="text-center">
            <p className="mb-4 text-5xl" aria-hidden>
              🍬
            </p>
            <button type="button" onClick={restart} className={primaryBtn}>
              {ar ? 'ابدأ اللعبة' : 'Start game'}
            </button>
          </div>
        )}

        {phase === 'playing' && (
          <div className="space-y-5">
            <p className="text-center font-display text-lg font-semibold leading-relaxed text-ink dark:text-moonlight">{ar ? question.ar : question.en}</p>
            <div className="grid gap-3">
              {answers.map((choice) => (
                <button key={choice.en} type="button" onClick={() => answer(choice)} className={choiceBtn}>
                  {ar ? choice.ar : choice.en}
                </button>
              ))}
            </div>
          </div>
        )}

        {(phase === 'feedback' || phase === 'won') && (
          <div className="flex flex-col items-center gap-3 text-center" role="status">
            {wasCorrect ? <CheckCircle2 size={56} aria-hidden className="text-meadow" /> : <XCircle size={56} aria-hidden className="text-coral" />}
            <h3 className="font-display text-xl font-bold text-ink dark:text-moonlight">
              {phase === 'won'
                ? ar
                  ? 'وصلت إلى القمة!'
                  : 'You reached the top!'
                : wasCorrect
                ? ar
                  ? 'إجابة صحيحة!'
                  : 'Correct answer!'
                : ar
                ? 'إجابة خاطئة'
                : 'Wrong answer'}
            </h3>
            <p className="text-sm text-ink/70 dark:text-moonlight/70">{message}</p>
            <p className="text-sm font-medium text-ink dark:text-moonlight">
              {wasCorrect
                ? ar
                  ? `صعدت إلى المستوى ${level}`
                  : `Promoted to level ${level}`
                : ar
                ? `عدت إلى المستوى الآمن ${safeLevel}`
                : `Back to safe level ${safeLevel}`}
            </p>
            {phase === 'won' ? (
              <button type="button" onClick={restart} className={primaryBtn}>
                {ar ? 'العب من جديد' : 'Play again'}
              </button>
            ) : (
              <button type="button" onClick={nextQuestion} className={primaryBtn}>
                {wasCorrect ? (ar ? 'السؤال التالي' : 'Next question') : ar ? 'تابع' : 'Continue'}
                <ArrowRight size={16} aria-hidden className={ar ? 'rotate-180' : ''} />
              </button>
            )}
          </div>
        )}
      </div>
    </GameShell>
  );
}
