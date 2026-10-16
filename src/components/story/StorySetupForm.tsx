import { useState, type FormEvent } from 'react';
import { Clock, FolderOpen, Lightbulb, Sparkles, Wand2 } from 'lucide-react';
import {
  AGE_GROUPS,
  ART_STYLE_OPTIONS,
  ASPECT_RATIO_OPTIONS,
  DIALECT_OPTIONS,
  MAX_IDEA_LENGTH,
  PROMPT_LIMITS,
  SECONDS_PER_PAGE,
  SMART_TIPS,
  STORY_LENGTHS,
  STORY_TYPES,
  SURPRISE_PROMPTS,
} from '../../constants';
import { AgeGroup, ArabicDialect, ArtStyle, AspectRatio, Language, StoryLength, StoryParams, StoryType } from '../../types';

interface Props {
  language: Language;
  onSubmit: (params: StoryParams, pageCount: number) => void;
  onLoadStory: () => void;
  canLoadStory: boolean;
  disabled: boolean;
}

const countWords = (text: string): number => text.trim().split(/\s+/).filter(Boolean).length;

export default function StorySetupForm({ language, onSubmit, onLoadStory, canLoadStory, disabled }: Props) {
  const ar = language === 'Arabic';
  const [idea, setIdea] = useState('');
  const [dialect, setDialect] = useState<ArabicDialect>('Modern Standard');
  const [ageGroup, setAgeGroup] = useState<AgeGroup>('4-6');
  const [storyType, setStoryType] = useState<StoryType>('Bedtime');
  const [length, setLength] = useState<StoryLength>('Short');
  const [artStyle, setArtStyle] = useState<ArtStyle>('Hand-drawn Cartoon');
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('4:3');

  const selectedLength = STORY_LENGTHS.find((l) => l.value === length)!;
  const selectedAge = AGE_GROUPS.find((g) => g.value === ageGroup)!;
  const words = countWords(idea);
  const minWords = PROMPT_LIMITS[ageGroup];
  const tooShort = words > 0 && words < minWords;
  const readingMinutes = Math.max(1, Math.ceil((selectedLength.pages * SECONDS_PER_PAGE) / 60));
  const canSubmit = words >= minWords && !disabled;

  const surprise = () => {
    const pool = SURPRISE_PROMPTS[language];
    setIdea(pool[Math.floor(Math.random() * pool.length)].slice(0, MAX_IDEA_LENGTH));
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    const params: StoryParams = {
      idea,
      language,
      dialect: ar ? dialect : undefined,
      ageGroup,
      storyType,
      length,
      artStyle,
      aspectRatio,
    };
    onSubmit(params, selectedLength.pages);
  };

  const labelCls = 'block text-sm font-semibold text-ink/80 dark:text-moonlight/80 mb-1.5';
  const selectCls =
    'w-full rounded-2xl border border-dream/30 bg-white/70 px-3 py-2.5 text-sm text-ink outline-none transition focus-visible:border-lantern focus-visible:ring-2 focus-visible:ring-lantern/40 dark:bg-white/10 dark:text-moonlight';
  const hintCls = 'mt-1.5 flex items-start gap-1.5 text-xs text-ink/60 dark:text-moonlight/60';

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <div className="mb-1.5 flex items-center justify-between gap-3">
          <label className="text-sm font-semibold text-ink/80 dark:text-moonlight/80" htmlFor="idea">
            {ar ? 'فكرة القصة' : 'Story idea'}
          </label>
          <button
            type="button"
            onClick={surprise}
            className="inline-flex items-center gap-1.5 rounded-full border border-dream/30 px-3 py-1 text-xs font-medium text-ink transition hover:border-lantern focus-visible:outline focus-visible:outline-2 focus-visible:outline-lantern dark:text-moonlight"
          >
            <Sparkles size={14} aria-hidden className="text-lantern" />
            {ar ? 'فاجئني' : 'Surprise me'}
          </button>
        </div>
        <textarea
          id="idea"
          value={idea}
          onChange={(e) => setIdea(e.target.value.slice(0, MAX_IDEA_LENGTH))}
          rows={3}
          placeholder={ar ? 'أرنب صغير يخاف من الظلام...' : 'A little rabbit who is afraid of the dark...'}
          aria-invalid={tooShort}
          className={`${selectCls} resize-none`}
        />
        <div className="mt-1 flex items-center justify-between text-xs text-ink/50 dark:text-moonlight/50">
          <span className={tooShort ? 'font-medium text-coral' : ''}>
            {tooShort
              ? ar ? `أضف تفاصيل أكثر: ${words} من ${minWords} كلمات على الأقل` : `Add more detail: ${words} of at least ${minWords} words`
              : ar ? `${minWords} كلمات على الأقل` : `At least ${minWords} words`}
          </span>
          <span>
            {idea.length}/{MAX_IDEA_LENGTH}
          </span>
        </div>
        <p className={hintCls}>
          <Lightbulb size={14} aria-hidden className="mt-px shrink-0 text-lantern" />
          {SMART_TIPS[language][ageGroup]}
        </p>
      </div>

      {ar && (
        <div>
          <label className={labelCls} htmlFor="dialect">
            {'اللهجة'}
          </label>
          <select id="dialect" className={selectCls} value={dialect} onChange={(e) => setDialect(e.target.value as ArabicDialect)}>
            {DIALECT_OPTIONS.map((d) => (
              <option key={d.value} value={d.value}>
                {d.flag} {d.label}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2 sm:col-span-1">
          <label className={labelCls} htmlFor="ageGroup">
            {ar ? 'الفئة العمرية' : 'Age group'}
          </label>
          <select id="ageGroup" className={selectCls} value={ageGroup} onChange={(e) => setAgeGroup(e.target.value as AgeGroup)}>
            {AGE_GROUPS.map((g) => (
              <option key={g.value} value={g.value}>
                {g.label}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-ink/60 dark:text-moonlight/60">{ar ? selectedAge.desc.ar : selectedAge.desc.en}</p>
        </div>

        <div className="col-span-2 sm:col-span-1">
          <label className={labelCls} htmlFor="storyType">
            {ar ? 'نوع القصة' : 'Story type'}
          </label>
          <select id="storyType" className={selectCls} value={storyType} onChange={(e) => setStoryType(e.target.value as StoryType)}>
            {STORY_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {ar ? t.label.ar : t.label.en}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className={labelCls} htmlFor="length">
            {ar ? 'طول القصة' : 'Length'}
          </label>
          <select id="length" className={selectCls} value={length} onChange={(e) => setLength(e.target.value as StoryLength)}>
            {STORY_LENGTHS.map((l) => (
              <option key={l.value} value={l.value}>
                {ar ? l.label.ar : l.label.en}
              </option>
            ))}
          </select>
          <p className="mt-1 flex items-center gap-1 text-xs text-ink/60 dark:text-moonlight/60">
            <Clock size={12} aria-hidden />
            {ar ? `مدة القراءة التقريبية: ${readingMinutes} د` : `Approx. reading time: ${readingMinutes} min`}
          </p>
        </div>

        <div>
          <label className={labelCls} htmlFor="aspectRatio">
            {ar ? 'شكل الصورة' : 'Picture shape'}
          </label>
          <select id="aspectRatio" className={selectCls} value={aspectRatio} onChange={(e) => setAspectRatio(e.target.value as AspectRatio)}>
            {ASPECT_RATIO_OPTIONS.map((r) => (
              <option key={r.value} value={r.value}>
                {ar ? r.label.ar : r.label.en}
              </option>
            ))}
          </select>
        </div>

        <div className="col-span-2">
          <label className={labelCls} htmlFor="artStyle">
            {ar ? 'الأسلوب الفني' : 'Art style'}
          </label>
          <select id="artStyle" className={selectCls} value={artStyle} onChange={(e) => setArtStyle(e.target.value as ArtStyle)}>
            {ART_STYLE_OPTIONS.map((s) => (
              <option key={s.value} value={s.value}>
                {ar ? s.labelAr : s.value}
              </option>
            ))}
          </select>
        </div>
      </div>

      <button
        type="submit"
        disabled={!canSubmit}
        className="animate-lantern flex w-full items-center justify-center gap-2 rounded-full bg-lantern py-3.5 font-display text-base font-semibold text-ink shadow-lg shadow-lantern/30 transition disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
      >
        <Wand2 size={20} aria-hidden />
        {ar ? 'أنشئ القصة' : 'Create the story'}
      </button>

      {canLoadStory && (
        <button
          type="button"
          onClick={onLoadStory}
          className="mx-auto flex items-center gap-2 rounded-full border border-dream/30 px-5 py-2 text-sm font-medium text-ink transition hover:border-lantern focus-visible:outline focus-visible:outline-2 focus-visible:outline-lantern dark:text-moonlight"
        >
          <FolderOpen size={16} aria-hidden />
          {ar ? 'تحميل القصة المحفوظة' : 'Load saved story'}
        </button>
      )}
    </form>
  );
}
