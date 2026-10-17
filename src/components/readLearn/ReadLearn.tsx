import { useMemo, useState, type FormEvent } from 'react';
import { Atom, Bean, Check, ChevronDown, Globe2, HeartPulse, Loader2, PawPrint, Rocket, Search, Send, Sparkles, Star, Sprout } from 'lucide-react';
import { AGE_GROUPS } from '../../constants';
import { LEARN_CARDS, LEARN_CATEGORIES, type LearnCategory } from '../../data/learnCards';
import { askAnything, type Explained } from '../../services/learn';
import { useProgress, markLearnRead } from '../../services/progress';
import type { AgeGroup, Language } from '../../types';
import LearnActions from './LearnActions';
import ErrorDetails from '../common/ErrorDetails';

interface Props {
  language: Language;
  onMakeStory?: (idea: string) => void;
}

const ICONS: Record<LearnCategory, typeof Rocket> = {
  space: Rocket,
  nature: Sprout,
  earth: Globe2,
  animals: PawPrint,
  body: HeartPulse,
  science: Atom,
  habits: Bean,
};

const AGE_KEY = 'sawan-learn-age';
const readAge = (): AgeGroup => {
  try {
    const v = localStorage.getItem(AGE_KEY);
    if (AGE_GROUPS.some((g) => g.value === v)) return v as AgeGroup;
  } catch {
    // ignore
  }
  return '7-9';
};

const normalize = (t: string) => t.toLowerCase().replace(/[ً-ٟـ]/g, '').replace(/[أإآ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه');

export default function ReadLearn({ language, onMakeStory }: Props) {
  const ar = language === 'Arabic';
  const progress = useProgress();
  const [openId, setOpenId] = useState<string | null>(null);
  const [cat, setCat] = useState<LearnCategory | 'all'>('all');
  const [query, setQuery] = useState('');
  const [age, setAge] = useState<AgeGroup>(readAge);

  const [question, setQuestion] = useState('');
  const [asking, setAsking] = useState(false);
  const [askError, setAskError] = useState<string | null>(null);
  const [result, setResult] = useState<(Explained & { key: string }) | null>(null);

  const changeAge = (v: AgeGroup) => {
    setAge(v);
    try {
      localStorage.setItem(AGE_KEY, v);
    } catch {
      // ignore
    }
  };

  const cards = useMemo(() => {
    const q = normalize(query.trim());
    return LEARN_CARDS.filter((c) => (cat === 'all' || c.cat === cat) && (!q || normalize(`${c.title.ar} ${c.title.en} ${c.body.ar} ${c.body.en}`).includes(q)));
  }, [cat, query]);

  const ask = async (text: string) => {
    const q = text.trim();
    if (q.length < 3 || asking) return;
    setQuestion(q);
    setAsking(true);
    setAskError(null);
    try {
      const data = await askAnything(q, language, age);
      setResult({ ...data, key: `ask-${Date.now()}` });
    } catch (err) {
      setAskError((err as Error).message);
    } finally {
      setAsking(false);
    }
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    void ask(question);
  };

  const readCount = LEARN_CARDS.filter((c) => progress.learn[c.id]).length;
  const inputCls =
    'min-h-11 w-full rounded-2xl border border-dream/30 bg-white/70 px-4 text-sm text-ink outline-none transition focus-visible:border-lantern focus-visible:ring-2 focus-visible:ring-lantern/40 dark:bg-white/10 dark:text-moonlight';

  return (
    <div className="space-y-5" dir={ar ? 'rtl' : 'ltr'}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-semibold text-ink dark:text-moonlight">{ar ? 'اقرأ وتعلّم' : 'Read & Learn'}</h2>
          <p className="mt-1 text-sm text-ink/60 dark:text-moonlight/60">
            {ar ? `${LEARN_CARDS.length} بطاقة معلومات، وأجب عن أي سؤال يخطر ببالك.` : `${LEARN_CARDS.length} fact cards, plus answers to any question you can think of.`}
          </p>
        </div>
        <div className="shrink-0 rounded-2xl bg-lantern/15 px-3 py-2 text-center">
          <p className="font-display text-sm font-bold text-ink dark:text-moonlight">
            {readCount}/{LEARN_CARDS.length}
          </p>
          <p className="text-[11px] text-ink/60 dark:text-moonlight/60">{ar ? 'قرأتها' : 'read'}</p>
        </div>
      </div>

      {/* اسأل أي سؤال */}
      <section className="space-y-3 rounded-3xl border border-lantern/40 bg-gradient-to-br from-star/25 to-white/70 p-4 dark:from-lantern/10 dark:to-white/5" aria-label={ar ? 'اسأل أي سؤال' : 'Ask anything'}>
        <h3 className="flex items-center gap-2 font-display text-sm font-bold text-ink dark:text-moonlight">
          <Sparkles size={16} className="text-lantern" aria-hidden />
          {ar ? 'اسأل أي سؤال' : 'Ask me anything'}
        </h3>
        <form onSubmit={submit} className="flex gap-2">
          <input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            maxLength={300}
            className={inputCls}
            placeholder={ar ? 'مثال: لماذا تدور الأرض؟' : 'e.g. Why does the Earth spin?'}
            aria-label={ar ? 'سؤالك' : 'Your question'}
          />
          <button
            type="submit"
            disabled={asking || question.trim().length < 3}
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-lantern text-ink transition active:scale-95 disabled:opacity-50"
            aria-label={ar ? 'اسأل' : 'Ask'}
          >
            {asking ? <Loader2 size={18} className="animate-spin" aria-hidden /> : <Send size={18} className="rtl:-scale-x-100" aria-hidden />}
          </button>
        </form>
        <label className="flex items-center gap-2 text-xs font-semibold text-ink/65 dark:text-moonlight/65">
          {ar ? 'عمر الطفل' : 'Child age'}
          <select
            value={age}
            onChange={(e) => changeAge(e.target.value as AgeGroup)}
            className="min-h-11 rounded-xl border border-dream/30 bg-white/70 px-2 text-xs text-ink dark:bg-white/10 dark:text-moonlight"
          >
            {AGE_GROUPS.map((g) => (
              <option key={g.value} value={g.value}>
                {g.label}
              </option>
            ))}
          </select>
        </label>

        {askError && (
          <div role="alert" className="text-xs text-coral">
            <p>{askError}</p>
            <ErrorDetails ar={ar} />
          </div>
        )}

        {result && (
          <article className="space-y-3 rounded-2xl bg-white/80 p-4 dark:bg-white/5">
            <h4 className="font-display text-base font-bold text-ink dark:text-moonlight">{result.title}</h4>
            <p className="text-sm leading-relaxed text-ink/85 dark:text-moonlight/85">{result.answer}</p>
            {result.fun_fact && (
              <p className="rounded-xl bg-lantern/15 p-3 text-xs leading-relaxed text-ink dark:text-moonlight">
                <span className="font-bold">{ar ? 'هل تعلم؟ ' : 'Did you know? '}</span>
                {result.fun_fact}
              </p>
            )}
            <LearnActions
              key={result.key}
              id={result.key}
              title={result.title}
              text={result.answer}
              language={language}
              ageGroup={age}
              imagePrompt={result.image_prompt}
              quiz={result.quiz}
              onMakeStory={onMakeStory}
            />
            {result.follow_ups.length > 0 && (
              <div className="flex flex-wrap gap-2" role="group" aria-label={ar ? 'أسئلة قد تهمك' : 'You may also wonder'}>
                {result.follow_ups.map((f) => (
                  <button key={f} type="button" disabled={asking} onClick={() => ask(f)} className="min-h-11 rounded-full border border-dream/30 bg-white/70 px-3.5 text-start text-xs font-medium text-ink transition hover:border-lantern active:scale-95 dark:bg-white/10 dark:text-moonlight">
                    {f}
                  </button>
                ))}
              </div>
            )}
          </article>
        )}
      </section>

      {/* بحث وتصنيف */}
      <div className="space-y-3">
        <div className="relative">
          <Search size={16} className="pointer-events-none absolute inset-y-0 start-3 my-auto text-ink/40 dark:text-moonlight/40" aria-hidden />
          <input value={query} onChange={(e) => setQuery(e.target.value)} className={`${inputCls} ps-9`} placeholder={ar ? 'ابحث في البطاقات' : 'Search the cards'} aria-label={ar ? 'بحث' : 'Search'} />
        </div>
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1" role="group" aria-label={ar ? 'التصنيفات' : 'Categories'}>
          {[{ id: 'all' as const, ar: 'الكل', en: 'All' }, ...LEARN_CATEGORIES].map((c) => {
            const Icon = c.id === 'all' ? Star : ICONS[c.id];
            return (
              <button
                key={c.id}
                type="button"
                aria-pressed={cat === c.id}
                onClick={() => setCat(c.id)}
                className={`inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-xs font-semibold transition active:scale-95 ${
                  cat === c.id ? 'border-lantern bg-lantern text-ink' : 'border-dream/30 bg-white/70 text-ink dark:bg-white/10 dark:text-moonlight'
                }`}
              >
                <Icon size={14} aria-hidden />
                {ar ? c.ar : c.en}
              </button>
            );
          })}
        </div>
      </div>

      {cards.length === 0 && <p className="py-6 text-center text-sm text-ink/60 dark:text-moonlight/60">{ar ? 'لا توجد بطاقة بهذا الاسم. جرّب «اسأل أي سؤال» أعلاه.' : 'No card matches. Try "Ask me anything" above.'}</p>}

      <ul className="space-y-3">
        {cards.map((card) => {
          const isOpen = openId === card.id;
          const Icon = ICONS[card.cat];
          const read = Boolean(progress.learn[card.id]);
          const stars = progress.learn[card.id]?.quiz ?? 0;
          const title = ar ? card.title.ar : card.title.en;
          const body = ar ? card.body.ar : card.body.en;
          return (
            <li key={card.id} className="page-corner overflow-hidden rounded-2xl border border-dream/20 bg-white/70 dark:bg-white/5">
              <button
                type="button"
                onClick={() => {
                  setOpenId(isOpen ? null : card.id);
                  if (!isOpen) markLearnRead(card.id);
                }}
                className="flex min-h-14 w-full items-center gap-3 p-4 text-start"
                aria-expanded={isOpen}
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-dream/15 text-dream">
                  <Icon size={20} aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-display text-base font-semibold text-ink dark:text-moonlight">{title}</span>
                  {!isOpen && <span className="block truncate text-sm text-ink/60 dark:text-moonlight/60">{ar ? card.summary.ar : card.summary.en}</span>}
                </span>
                {stars > 0 && (
                  <span className="flex shrink-0 items-center gap-0.5 text-lantern" aria-label={ar ? `${stars} نجوم` : `${stars} stars`}>
                    {Array.from({ length: stars }, (_, i) => (
                      <Star key={i} size={12} className="fill-current" aria-hidden />
                    ))}
                  </span>
                )}
                {read && stars === 0 && <Check size={16} className="shrink-0 text-meadow" aria-hidden />}
                <ChevronDown size={16} className={`shrink-0 text-ink/40 transition dark:text-moonlight/40 ${isOpen ? 'rotate-180' : ''}`} aria-hidden />
              </button>
              {isOpen && (
                <div className="space-y-3 px-4 pb-4">
                  <p className="text-sm leading-relaxed text-ink/85 dark:text-moonlight/85">{body}</p>
                  <LearnActions id={card.id} title={title} text={body} language={language} ageGroup={age} onMakeStory={onMakeStory} />
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
