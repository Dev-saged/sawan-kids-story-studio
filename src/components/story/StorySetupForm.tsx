import { useState, type FormEvent } from 'react';
import { Wand2 } from 'lucide-react';
import { AGE_GROUPS, ART_STYLE_OPTIONS, DIALECT_OPTIONS, MAX_IDEA_LENGTH, STORY_LENGTHS, STORY_TYPES } from '../../constants';
import { AgeGroup, ArabicDialect, ArtStyle, Language, StoryLength, StoryParams, StoryType } from '../../types';

interface Props {
  language: Language;
  onSubmit: (params: StoryParams, pageCount: number) => void;
  disabled: boolean;
}

const isAr = (language: Language) => language === 'Arabic';

export default function StorySetupForm({ language, onSubmit, disabled }: Props) {
  const ar = isAr(language);
  const [idea, setIdea] = useState('');
  const [dialect, setDialect] = useState<ArabicDialect>('Modern Standard');
  const [ageGroup, setAgeGroup] = useState<AgeGroup>('4-6');
  const [storyType, setStoryType] = useState<StoryType>('Bedtime');
  const [length, setLength] = useState<StoryLength>('Short');
  const [artStyle, setArtStyle] = useState<ArtStyle>('Hand-drawn Cartoon');

  const selectedLength = STORY_LENGTHS.find((l) => l.value === length)!;
  const canSubmit = idea.trim().length > 0 && !disabled;

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
      aspectRatio: '4:3',
    };
    onSubmit(params, selectedLength.pages);
  };

  const labelCls = 'block text-sm font-semibold text-ink/80 dark:text-moonlight/80 mb-1.5';
  const selectCls =
    'w-full rounded-2xl border border-dream/30 bg-white/70 px-3 py-2.5 text-sm text-ink outline-none transition focus-visible:border-lantern focus-visible:ring-2 focus-visible:ring-lantern/40 dark:bg-white/10 dark:text-moonlight';

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <label className={labelCls} htmlFor="idea">
          {ar ? 'فكرة القصة' : 'Story idea'}
        </label>
        <textarea
          id="idea"
          value={idea}
          onChange={(e) => setIdea(e.target.value.slice(0, MAX_IDEA_LENGTH))}
          rows={3}
          placeholder={ar ? 'أرنب صغير يخاف من الظلام...' : 'A little rabbit who is afraid of the dark...'}
          className={`${selectCls} resize-none`}
        />
        <p className="mt-1 text-end text-xs text-ink/50 dark:text-moonlight/50">
          {idea.length}/{MAX_IDEA_LENGTH}
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
                {d.label}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div>
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
        </div>

        <div>
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
        </div>

        <div>
          <label className={labelCls} htmlFor="artStyle">
            {ar ? 'الأسلوب الفني' : 'Art style'}
          </label>
          <select id="artStyle" className={selectCls} value={artStyle} onChange={(e) => setArtStyle(e.target.value as ArtStyle)}>
            {ART_STYLE_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s}
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
    </form>
  );
}
