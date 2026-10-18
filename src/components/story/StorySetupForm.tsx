import { useState, type FormEvent } from 'react';
import { Clock, FolderOpen, Lightbulb, Mic, Sparkles, Wand2 } from 'lucide-react';
import VoiceDictationModal from './VoiceDictationModal';
import {
  AGE_GROUPS,
  ART_STYLE_OPTIONS,
  ASPECT_RATIO_OPTIONS,
  DIALECT_OPTIONS,
  FIRST_BATCH_PAGES,
  MAX_IDEA_LENGTH,
  MAX_STORY_PAGES,
  MIN_STORY_PAGES,
  PROMPT_LIMITS,
  SECONDS_PER_PAGE,
  SMART_TIPS,
  STORY_LENGTHS,
  STORY_TYPES,
  SURPRISE_PROMPTS,
} from '../../constants';
import { AgeGroup, ArabicDialect, ArtStyle, AspectRatio, ChildProfile, Language, SeriesContext, StoryLength, StoryParams, StoryType } from '../../types';
import HeroPicker from './HeroPicker';
import { BRAND_PRESETS, DEFAULT_PRESET } from '../../config';
import { setVoice as persistVoice } from '../../services/narration';

interface Props {
  // فكرة جاهزة (من بطاقة تعليمية أو لعبة)
  initialIdea?: string;
  language: Language;
  onSubmit: (params: StoryParams, pageCount: number) => void;
  onLoadStory: () => void;
  canLoadStory: boolean;
  disabled: boolean;
  series?: SeriesContext | null;
  onCancelSeries?: () => void;
}

const readPreset = () => {
  let id: string | null = null;
  try {
    id = localStorage.getItem('sajed-preset');
  } catch {
    // ignore
  }
  return BRAND_PRESETS.find((p) => p.id === id) ?? BRAND_PRESETS.find((p) => p.id === DEFAULT_PRESET)!;
};

const countWords = (text: string): number => text.trim().split(/\s+/).filter(Boolean).length;

export default function StorySetupForm({ initialIdea, language, onSubmit, onLoadStory, canLoadStory, disabled, series, onCancelSeries }: Props) {
  const ar = language === 'Arabic';
  const [idea, setIdea] = useState(() => (initialIdea ?? '').slice(0, MAX_IDEA_LENGTH));
  const [dialect, setDialect] = useState<ArabicDialect>(() => series?.dialect ?? readPreset().dialect);
  const [ageGroup, setAgeGroup] = useState<AgeGroup>(() => series?.ageGroup ?? '4-6');
  const [storyType, setStoryType] = useState<StoryType>('Bedtime');
  const [pageCount, setPageCount] = useState(6);
  const [artStyle, setArtStyle] = useState<ArtStyle>(() => series?.artStyle ?? readPreset().artStyle);
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>(() => series?.aspectRatio ?? '4:3');
  const [hero, setHero] = useState<ChildProfile | null>(null);
  const [presetId, setPresetId] = useState<string>(() => readPreset().id);
  const [showVoiceModal, setShowVoiceModal] = useState(false);

  // الهوية تضبط الأسلوب الفني واللهجة وصوت الراوي معاً
  const applyPreset = (id: string) => {
    const preset = BRAND_PRESETS.find((p) => p.id === id);
    if (!preset) return;
    setPresetId(id);
    setArtStyle(preset.artStyle);
    setDialect(preset.dialect);
    persistVoice(preset.voice);
    try {
      localStorage.setItem('sajed-preset', id);
    } catch {
      // ignore
    }
  };

  const length: StoryLength = pageCount <= 8 ? 'Short' : pageCount <= 16 ? 'Medium' : pageCount <= 28 ? 'Long' : 'Epic';
  const selectedAge = AGE_GROUPS.find((g) => g.value === ageGroup)!;
  const words = countWords(idea);
  const minWords = PROMPT_LIMITS[ageGroup];
  const tooShort = words > 0 && words < minWords;
  const readingMinutes = Math.max(1, Math.ceil((pageCount * SECONDS_PER_PAGE) / 60));
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
      heroName: series?.heroName ?? hero?.name,
      heroPhotoId: series?.heroPhotoId ?? hero?.photoId,
      series: series ?? undefined,
    };
    onSubmit(params, pageCount);
  };

  const labelCls = 'block text-sm font-semibold text-ink/80 dark:text-moonlight/80 mb-1.5';
  const selectCls =
    'w-full rounded-2xl border border-dream/30 bg-white/70 px-3 py-2.5 text-sm text-ink outline-none transition focus-visible:border-lantern focus-visible:ring-2 focus-visible:ring-lantern/40 dark:bg-white/10 dark:text-moonlight';
  const hintCls = 'mt-1.5 flex items-start gap-1.5 text-xs text-ink/60 dark:text-moonlight/60';

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {series && (
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-lantern/40 bg-lantern/10 px-4 py-3 text-sm" dir={ar ? 'rtl' : 'ltr'}>
          <span className="font-display font-bold text-ink dark:text-moonlight">
            {ar ? `الجزء ${series.partNumber} من «${series.seriesTitle}»` : `Part ${series.partNumber} of “${series.seriesTitle}”`}
            <span className="block text-xs font-medium text-ink/60 dark:text-moonlight/60">{ar ? 'نفس الشخصيات والأسلوب، اكتب فكرة المغامرة الجديدة.' : 'Same characters and style — write the new adventure idea.'}</span>
          </span>
          {onCancelSeries && (
            <button type="button" onClick={onCancelSeries} className="min-h-11 shrink-0 rounded-full border border-dream/30 px-4 text-xs font-semibold text-ink dark:text-moonlight">
              {ar ? 'إلغاء' : 'Cancel'}
            </button>
          )}
        </div>
      )}
      <div>
        <div className="mb-1.5 flex items-center justify-between gap-3">
          <label className="text-sm font-semibold text-ink/80 dark:text-moonlight/80" htmlFor="idea">
            {ar ? 'فكرة القصة' : 'Story idea'}
          </label>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowVoiceModal(true)}
              className="inline-flex items-center gap-1.5 rounded-full border border-dream/30 bg-dream/10 px-3 py-1 text-xs font-semibold text-ink transition hover:border-lantern hover:bg-dream/20 dark:text-moonlight"
              title={ar ? 'تسجيل فكرة القصة بصوتك وتفريغها تلقائياً' : 'Speak your story idea with smart voice dictation'}
            >
              <Mic size={14} className="text-lantern" />
              <span>{ar ? 'إملاء صوتي' : 'Voice dictation'}</span>
            </button>
            <button
              type="button"
              onClick={surprise}
              className="inline-flex items-center gap-1.5 rounded-full border border-dream/30 px-3 py-1 text-xs font-medium text-ink transition hover:border-lantern focus-visible:outline focus-visible:outline-2 focus-visible:outline-lantern dark:text-moonlight"
            >
              <Sparkles size={14} aria-hidden className="text-lantern" />
              {ar ? 'فاجئني' : 'Surprise me'}
            </button>
          </div>
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

      {!series && <HeroPicker ar={ar} selectedId={hero?.id ?? null} onSelect={setHero} />}

      {!series && (
      <div>
        <span className={labelCls}>{ar ? 'هوية القصة' : 'Story identity'}</span>
        <div role="radiogroup" aria-label={ar ? 'هوية القصة' : 'Story identity'} className="-mx-1 flex snap-x gap-2 overflow-x-auto px-1 pb-1">
          {BRAND_PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              role="radio"
              aria-checked={presetId === p.id}
              onClick={() => applyPreset(p.id)}
              className={`min-h-12 min-w-[8.5rem] shrink-0 snap-start rounded-2xl border px-3 py-2 text-start transition active:scale-95 ${
                presetId === p.id ? 'border-lantern bg-lantern/15' : 'border-dream/30 bg-white/50 dark:bg-white/5'
              }`}
            >
              <span className="block font-display text-sm font-bold text-ink dark:text-moonlight">{ar ? p.label.ar : p.label.en}</span>
              <span className="block text-[11px] leading-snug text-ink/60 dark:text-moonlight/60">{ar ? p.desc.ar : p.desc.en}</span>
            </button>
          ))}
        </div>
      </div>
      )}

      {ar && !series && (
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
          <select id="ageGroup" disabled={Boolean(series)} className={selectCls} value={ageGroup} onChange={(e) => setAgeGroup(e.target.value as AgeGroup)}>
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

        <div className="col-span-2">
          <label className={labelCls} htmlFor="length">
            {ar ? `طول القصة: ${pageCount} صفحة` : `Story length: ${pageCount} pages`}
          </label>
          <div className="mb-2 flex flex-wrap gap-1.5" role="group" aria-label={ar ? 'أطوال جاهزة' : 'Length presets'}>
            {STORY_LENGTHS.map((l) => (
              <button
                key={l.value}
                type="button"
                onClick={() => setPageCount(l.pages)}
                aria-pressed={pageCount === l.pages}
                className={`min-h-11 rounded-full border px-3.5 text-xs font-semibold transition active:scale-95 ${
                  pageCount === l.pages ? 'border-lantern bg-lantern text-ink' : 'border-dream/30 bg-white/70 text-ink dark:bg-white/10 dark:text-moonlight'
                }`}
              >
                {ar ? l.label.ar : l.label.en}
              </button>
            ))}
          </div>
          <input
            id="length"
            type="range"
            min={MIN_STORY_PAGES}
            max={MAX_STORY_PAGES}
            step={1}
            value={pageCount}
            onChange={(e) => setPageCount(Number(e.target.value))}
            className="h-11 w-full accent-lantern"
          />
          <p className="mt-1 flex items-center gap-1 text-xs text-ink/60 dark:text-moonlight/60">
            <Clock size={12} aria-hidden />
            {ar ? `مدة القراءة التقريبية: ${readingMinutes} د` : `Approx. reading time: ${readingMinutes} min`}
            {pageCount > FIRST_BATCH_PAGES && <span>{ar ? ' · تُكتب القصة الطويلة على دفعات بفصول، ويمكن استئنافها إن انقطعت' : ' · long stories are written in chapters and can be resumed'}</span>}
          </p>
        </div>

        <div>
          <label className={labelCls} htmlFor="aspectRatio">
            {ar ? 'شكل الصورة' : 'Picture shape'}
          </label>
          <select id="aspectRatio" disabled={Boolean(series)} className={selectCls} value={aspectRatio} onChange={(e) => setAspectRatio(e.target.value as AspectRatio)}>
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
          <select id="artStyle" disabled={Boolean(series)} className={selectCls} value={artStyle} onChange={(e) => setArtStyle(e.target.value as ArtStyle)}>
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

      {showVoiceModal && (
        <VoiceDictationModal
          language={language}
          onApplyText={(spokenText) => {
            setIdea((prev) => (prev ? `${prev} ${spokenText}` : spokenText).slice(0, MAX_IDEA_LENGTH));
          }}
          onClose={() => setShowVoiceModal(false)}
        />
      )}
    </form>
  );
}
