import { useState, useEffect, type FormEvent } from 'react';
import { Clock, Compass, FileText, FolderOpen, Lightbulb, Mic, Sparkles, Wand2, X } from 'lucide-react';
import VoiceDictationModal from './VoiceDictationModal';
import BookTemplateBrowser from './BookTemplateBrowser';
import { BookTemplate } from '../../data/bookTemplates';
import { getStoryDraft, saveStoryDraft, clearStoryDraft } from '../../services/draftManager';
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
import { AgeGroup, ArabicDialect, ArtStyle, AspectRatio, ChildProfile, CoverFontStyle, Language, SeriesContext, StoryLength, StoryParams, StoryType } from '../../types';
import HeroPicker from './HeroPicker';
import { BRAND_PRESETS, DEFAULT_PRESET } from '../../config';
import { setVoice as persistVoice } from '../../services/narration';

export interface TeenDramaTemplate {
  id: string;
  icon: string;
  title: { ar: string; en: string };
  tagline: { ar: string; en: string };
  badge: { ar: string; en: string };
  emotionalWorld: { ar: string; en: string };
  defaultIdea: { ar: string; en: string };
  artStyle: ArtStyle;
  storyType: StoryType;
  dialect: ArabicDialect;
}

export const TEEN_DRAMA_TEMPLATES: TeenDramaTemplate[] = [
  {
    id: 'fruit-kingdom-saga',
    icon: '🍇',
    title: { ar: 'مملكة الفواكه العتيقة وصراع بذور الخلود', en: 'The Ancient Fruit Kingdom & Eternity Seeds' },
    tagline: { ar: 'صراع العروش والولاء، الشرف، والبحث عن إكسير الحكمة', en: 'Throne conflicts, honor, and ancient secrets in a royal realm' },
    badge: { ar: 'صراع العروش والولاء', en: 'Thrones & Honor' },
    emotionalWorld: { ar: 'الشرف، الوفاء بالعهد، ومسؤولية القيادة', en: 'Honor, solemn vows, and leadership' },
    defaultIdea: {
      ar: 'في عالم تنقسم فيه حضارات الفواكه إلى ممالك متناحرة، يكتشف فارس شاب من عشيرة الرمان سراً دفيناً عن بذور الخلود التي توشك أن تقع في أيدي أمراء الظل، فينطلق في رحلة مصيرية محفوفة بالمخاطر لتوحيد القبائل.',
      en: 'In an epic realm where fruit civilizations rule fractured territories, a young warrior from the Pomegranate Dynasty uncovers a conspiracy to seize the mystical eternity seeds, embarking on a dangerous quest across ancient orchards.',
    },
    artStyle: 'Fantasy Fairy Tale',
    storyType: 'Adventure',
    dialect: 'Modern Standard',
  },
  {
    id: 'cyber-fruit-2099',
    icon: '⚡',
    title: { ar: 'سايبر فروت 2099: حرب الطاقة البيولوجية', en: 'CyberFruit 2099: Bio-Energy War' },
    tagline: { ar: 'أبراج النيون الشاهقة، أسرار الذكاء الحيوي، وسباق النجاة الأخير', en: 'Neon mega-orchards, digital hacking, and bio-tech rebellion' },
    badge: { ar: 'سايبربانك وحرية', en: 'Cyberpunk Freedom' },
    emotionalWorld: { ar: 'التحدي الرقمي، استقلال الذات، وثورة الحرية', en: 'Digital challenge, autonomy, and rebellion for freedom' },
    defaultIdea: {
      ar: 'في مدينة مستقبلية عملاقة تضاء بالنيون، يكتشف فريق من ثوار الفواكه المعدلة جينياً أن مختبرات الطاقة المركزية تستنزف عصير الحياة من البساتين الطبيعية لتغذية الأبراج، فيخوضون معركة اختراق إلكتروني مثيرة.',
      en: 'In a futuristic neon metropolis, a squad of cyber-enhanced fruit heroes discovers that corporate conglomerates are secretly siphoning the vital botanical grid, executing a high-stakes digital hack to liberate the city.',
    },
    artStyle: 'Comic Book',
    storyType: 'Adventure',
    dialect: 'Modern Standard',
  },
  {
    id: 'survival-orchard',
    icon: '🥭',
    title: { ar: 'بساتين المجهول: رحلة البقاء في الغابة المحرمة', en: 'Orchards of the Unknown: Wild Survival' },
    tagline: { ar: 'عواصف غادرة، نباتات عملاقة، واختبار الصداقة الحقيقية في الظروف الصعبة', en: 'Raging storms, wild flora, and true friendship tested in danger' },
    badge: { ar: 'بقاء وصمود', en: 'Wild Survival' },
    emotionalWorld: { ar: 'الصمود أمام الصعاب، الاعتماد على النفس، وقوة الصداقة', en: 'Endurance, self-reliance, and fierce friendship' },
    defaultIdea: {
      ar: 'ينعزل ثلاثة مراهقين في وادي البساتين البرية بعد انهيار الجسر المعلق، ويضطرون للتعاون باستخدام معرفتهم بالثمار الطبيعية وفخاخ الطبيعة للنجاة من عاصفة شتوية مرعبة والعودة إلى ديارهم.',
      en: 'Three resourceful teenagers stranded deep inside a treacherous wild valley must use their botanical survival skills and fierce friendship to endure harsh winter winds and navigate home.',
    },
    artStyle: 'Classic Storybook',
    storyType: 'Adventure',
    dialect: 'Modern Standard',
  },
  {
    id: 'fruit-destiny-drama',
    icon: '🍎',
    title: { ar: 'فلسفة الظل والنور: سر شجرة الحكمة والقدر', en: 'Philosophy of Light & Shadow: Tree of Destiny' },
    tagline: { ar: 'حوارات فكرية عميقة، صراعات أخلاقية، واكتشاف معنى الشجاعة', en: 'Deep character dilemmas, philosophical debates, and integrity' },
    badge: { ar: 'دراما وفلسفة', en: 'Philosophical Drama' },
    emotionalWorld: { ar: 'البحث عن الذات، الأخلاق، واتخاذ القرارات الصعبة', en: 'Self-discovery, moral courage, and tough choices' },
    defaultIdea: {
      ar: 'قصة درامية مؤثرة تدور حول شاب يافع يجد نفسه أمام مفترق طرق أخلاقي بين ولاء عائلته لبستان الأجداد أو الدفاع عن الحقيقة والعدالة لإنقاذ قرية المزارعين الفقراء، متعلماً أن القوة الحقيقية تنبع من الصدق.',
      en: 'A profound character drama following a young protagonist torn between family heritage and standing up for truth, confronting hard moral dilemmas that reveal the authentic meaning of integrity.',
    },
    artStyle: 'Watercolor',
    storyType: 'Moral',
    dialect: 'Modern Standard',
  },
];

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
  const [coverFontStyle, setCoverFontStyle] = useState<CoverFontStyle>('kufi');
  const [showVoiceModal, setShowVoiceModal] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [availableDraft, setAvailableDraft] = useState<ReturnType<typeof getStoryDraft>>(null);
  const [isTeenDrama, setIsTeenDrama] = useState(() => (series?.ageGroup ?? ageGroup) === '13-18');
  const [selectedTeenTemplate, setSelectedTeenTemplate] = useState<string | null>('fruit-kingdom-saga');

  const handleSelectTeenTemplate = (tmpl: TeenDramaTemplate) => {
    setSelectedTeenTemplate(tmpl.id);
    setIdea(tmpl.defaultIdea[ar ? 'ar' : 'en']);
    setAgeGroup('13-18');
    setIsTeenDrama(true);
    setArtStyle(tmpl.artStyle);
    setStoryType(tmpl.storyType);
    if (tmpl.dialect) setDialect(tmpl.dialect);
  };

  // فحص وجود مسودة محفوظة سابقة
  useEffect(() => {
    if (!initialIdea && !series) {
      const d = getStoryDraft();
      if (d && d.params.idea && d.params.idea !== idea) {
        setAvailableDraft(d);
      }
    }
  }, []);

  // حفظ المسودة تلقائياً عند الكتابة لتفادي فقدان التقدم عند انقطاع الاتصال
  useEffect(() => {
    if (idea.trim().length > 15 && !series) {
      const timer = setTimeout(() => {
        saveStoryDraft(
          {
            idea,
            language,
            dialect: ar ? dialect : undefined,
            ageGroup,
            storyType,
            length: pageCount <= 8 ? 'Short' : pageCount <= 16 ? 'Medium' : pageCount <= 28 ? 'Long' : 'Epic',
            artStyle,
            aspectRatio,
            heroName: hero?.name,
            heroPhotoId: hero?.photoId,
          },
          pageCount
        );
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [idea, dialect, ageGroup, storyType, pageCount, artStyle, aspectRatio, hero]);

  const handleRestoreDraft = () => {
    if (!availableDraft) return;
    const p = availableDraft.params;
    setIdea(p.idea);
    if (p.dialect) setDialect(p.dialect as ArabicDialect);
    if (p.ageGroup) setAgeGroup(p.ageGroup);
    if (p.storyType) setStoryType(p.storyType);
    if (p.artStyle) setArtStyle(p.artStyle);
    if (p.aspectRatio) setAspectRatio(p.aspectRatio);
    if (availableDraft.pageCount) setPageCount(availableDraft.pageCount);
    setAvailableDraft(null);
  };

  const handleApplyTemplate = (tmpl: BookTemplate) => {
    setIdea(tmpl.defaultIdea[ar ? 'ar' : 'en']);
    setDialect(tmpl.dialect);
    setAgeGroup(tmpl.ageGroup);
    setArtStyle(tmpl.artStyle);
    setAspectRatio(tmpl.aspectRatio);
    setStoryType(tmpl.storyType);
    setShowTemplates(false);
  };

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
    clearStoryDraft();
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
      coverFontStyle,
    };
    onSubmit(params, pageCount);
  };

  const labelCls = 'block text-sm font-semibold text-ink/80 dark:text-moonlight/80 mb-1.5';
  const selectCls =
    'w-full rounded-2xl border border-dream/30 bg-white/70 px-3 py-2.5 text-sm text-ink outline-none transition focus-visible:border-lantern focus-visible:ring-2 focus-visible:ring-lantern/40 dark:bg-white/10 dark:text-moonlight';
  const hintCls = 'mt-1.5 flex items-start gap-1.5 text-xs text-ink/60 dark:text-moonlight/60';

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* استعادة المسودة السابقة المحفوظة بدون إنترنت */}
      {availableDraft && (
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-dream/40 bg-dream/10 p-3 text-xs" dir={ar ? 'rtl' : 'ltr'}>
          <div className="flex items-center gap-2">
            <FileText size={16} className="text-lantern shrink-0" />
            <span className="font-semibold text-ink dark:text-moonlight">
              {ar ? 'لديك مسودة قصة سابقة محفوظة لم تُكملها بعد.' : 'You have an unsubmitted draft from your previous session.'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleRestoreDraft}
              className="rounded-full bg-lantern px-3 py-1 font-bold text-ink shadow-xs transition hover:brightness-105 active:scale-95"
            >
              {ar ? 'استعادة المسودة' : 'Restore'}
            </button>
            <button
              type="button"
              onClick={() => { clearStoryDraft(); setAvailableDraft(null); }}
              className="p-1 text-ink/50 hover:text-coral dark:text-moonlight/50"
              title={ar ? 'تجاهل' : 'Dismiss'}
            >
              <X size={14} />
            </button>
          </div>
        </div>
      )}

      {/* زر تصفح القوالب الـ 12 الفخمة */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-lantern/35 bg-gradient-to-r from-lantern/15 via-dream/10 to-transparent p-3.5 shadow-xs" dir={ar ? 'rtl' : 'ltr'}>
        <div className="flex items-center gap-2.5">
          <span className="text-xl">✨</span>
          <div>
            <p className="font-display text-xs font-bold text-ink dark:text-moonlight">
              {ar ? 'قوالب جاهزة: فلسطينية، شامية، مصرية، بدوية، فضاء، قبل النوم' : 'Ready Story Themes: Palestinian, Syrian, Space, Dino & Bedtime'}
            </p>
            <p className="text-[11px] text-ink/65 dark:text-moonlight/65">
              {ar ? '12 قالباً فخماً للأطفال بلهجات وأساليب فنية متناسقة' : '12 rich cultural and educational story templates'}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setShowTemplates(!showTemplates)}
          className="inline-flex min-h-9 items-center gap-1.5 rounded-full bg-lantern px-3.5 text-xs font-bold text-ink shadow-xs transition hover:brightness-105 active:scale-95 shrink-0"
        >
          <Compass size={14} />
          <span>{showTemplates ? (ar ? 'إخفاء القوالب' : 'Hide templates') : (ar ? 'تصفح القوالب (12)' : 'Browse (12)')}</span>
        </button>
      </div>

      {showTemplates && (
        <BookTemplateBrowser ar={ar} onSelectTemplate={handleApplyTemplate} onClose={() => setShowTemplates(false)} />
      )}

      {/* مفتاح ونموذج دراما اليافعين (12-18 سنة) Teen Drama Toggle & Emotional World Cards */}
      <div className="space-y-3 rounded-2xl border border-rose-500/35 bg-gradient-to-r from-rose-950/25 via-purple-950/20 to-slate-900/15 p-4 shadow-sm" dir={ar ? 'rtl' : 'ltr'}>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-500/20 text-xl">🎭</span>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-display text-xs sm:text-sm font-bold text-ink dark:text-moonlight">
                  {ar ? 'وضع دراما اليافعين (12-18 سنة)' : 'Teen Drama Mode (12-18 yrs)'}
                </h3>
                <span className="rounded-full bg-rose-500/25 border border-rose-500/40 text-rose-300 dark:text-rose-200 px-2.5 py-0.5 text-[10px] font-bold">
                  {ar ? 'عصري وملحمي' : 'YA Drama'}
                </span>
              </div>
              <p className="text-[11px] text-ink/70 dark:text-moonlight/70">
                {ar ? 'تفعيل 4 عوالم وجدانية وصراعات درامية عميقة تناسب الفئة العمرية 12-18' : 'Enable 4 distinct emotional world templates suitable for 12-18 year olds'}
              </p>
            </div>
          </div>
          <label className="relative inline-flex cursor-pointer items-center shrink-0">
            <input
              type="checkbox"
              checked={isTeenDrama}
              onChange={(e) => {
                const checked = e.target.checked;
                setIsTeenDrama(checked);
                if (checked) {
                  setAgeGroup('13-18');
                  if (!selectedTeenTemplate) {
                    handleSelectTeenTemplate(TEEN_DRAMA_TEMPLATES[0]);
                  }
                }
              }}
              className="peer sr-only"
            />
            <div className="peer h-6 w-11 rounded-full bg-slate-700/70 after:absolute after:start-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all after:content-[''] peer-checked:bg-rose-600 peer-checked:after:translate-x-full peer-checked:after:border-white peer-focus-visible:ring-2 peer-focus-visible:ring-rose-400" />
          </label>
        </div>

        {/* بطاقات العوالم الوجدانية الأربعة عند تفعيل مفتاح دراما اليافعين */}
        {isTeenDrama && (
          <div className="pt-2 border-t border-rose-500/20 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {TEEN_DRAMA_TEMPLATES.map((tmpl) => {
              const active = selectedTeenTemplate === tmpl.id;
              return (
                <button
                  key={tmpl.id}
                  type="button"
                  onClick={() => handleSelectTeenTemplate(tmpl)}
                  className={`flex flex-col text-start p-3.5 rounded-xl border transition active:scale-[0.98] ${
                    active
                      ? 'border-rose-500 bg-rose-500/20 ring-2 ring-rose-500/50 shadow-md text-ink dark:text-moonlight'
                      : 'border-rose-500/25 bg-black/25 hover:bg-black/40 text-ink/80 dark:text-moonlight/80'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="flex items-center gap-1.5 font-bold text-xs text-rose-300">
                      <span className="text-base">{tmpl.icon}</span>
                      <span>{ar ? tmpl.title.ar : tmpl.title.en}</span>
                    </span>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-rose-500/20 border border-rose-500/30 text-rose-200 shrink-0">
                      {ar ? tmpl.badge.ar : tmpl.badge.en}
                    </span>
                  </div>
                  <p className="text-[11px] font-semibold text-amber-300/90 dark:text-amber-200/90 mb-1">
                    {ar ? `الجو الوجداني: ${tmpl.emotionalWorld.ar}` : `Emotional World: ${tmpl.emotionalWorld.en}`}
                  </p>
                  <p className="text-[11px] text-ink/70 dark:text-moonlight/70 leading-relaxed line-clamp-2">
                    {ar ? tmpl.tagline.ar : tmpl.tagline.en}
                  </p>
                </button>
              );
            })}
          </div>
        )}
      </div>
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
          <select
            id="ageGroup"
            disabled={Boolean(series)}
            className={selectCls}
            value={ageGroup}
            onChange={(e) => {
              const val = e.target.value as AgeGroup;
              setAgeGroup(val);
              setIsTeenDrama(val === '13-18');
            }}
          >
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

        <div className="col-span-2 sm:col-span-1">
          <label className={labelCls} htmlFor="coverFontStyle">
            {ar ? 'خط عنوان الغلاف' : 'Cover Title Font'}
          </label>
          <select id="coverFontStyle" className={selectCls} value={coverFontStyle} onChange={(e) => setCoverFontStyle(e.target.value as CoverFontStyle)}>
            <option value="kufi">{ar ? 'الكوفي الهندسي الحديث' : 'Modern Geometric Kufi'}</option>
            <option value="diwani">{ar ? 'الديواني الملكي' : 'Royal Diwani'}</option>
            <option value="naskh">{ar ? 'خط النسخ والقصص' : 'Story Naskh'}</option>
            <option value="display3d">{ar ? 'ثلاثي الأبعاد 3D' : 'Embossed 3D'}</option>
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
