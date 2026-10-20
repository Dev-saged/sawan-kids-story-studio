import { useState, useEffect, type FormEvent } from 'react';
import { BookmarkPlus, Check, ChevronDown, ChevronUp, Clock, Compass, Crown, Eye, Feather, FileText, Film, FolderOpen, Frame, Lightbulb, Mic, Palette, PenTool, Rocket, ShieldCheck, Smile, Smartphone, Sparkles, Square, Trash2, Users, Wand2, X } from 'lucide-react';
import VoiceDictationModal from './VoiceDictationModal';
import BookTemplateBrowser from './BookTemplateBrowser';
import LuxurySelect, { type LuxuryOption } from '../common/LuxurySelect';
import { DialectBadgeSvg, TemplateIconSvg } from '../common/BrandIcons';
import { BookTemplate } from '../../data/bookTemplates';
import { getStoryDraft, saveStoryDraft, clearStoryDraft } from '../../services/draftManager';
import {
  AGE_GROUPS,
  ART_STYLE_OPTIONS,
  ASPECT_RATIO_OPTIONS,
  COVER_EFFECT_OPTIONS,
  COVER_FONT_OPTIONS,
  DIALECT_OPTIONS,
  EXTRA_STORY_TYPES,
  FIRST_BATCH_PAGES,
  getCoverTitleClasses,
  MAX_IDEA_LENGTH,
  MAX_STORY_PAGES,
  MIN_STORY_PAGES,
  PRIMARY_STORY_TYPES,
  PROMPT_LIMITS,
  SECONDS_PER_PAGE,
  SMART_TIPS,
  STORY_LENGTHS,
  STORY_TYPE_SPECS,
  SURPRISE_PROMPTS,
} from '../../constants';
import {
  AgeGroup,
  AmbientPresetId,
  ArabicDialect,
  ArtStyle,
  AspectRatio,
  ChildProfile,
  CoverFontStyle,
  CoverTextEffect,
  Language,
  SavedCharacter,
  SeriesContext,
  StoryLength,
  StoryParams,
  StoryType,
} from '../../types';
import HeroPicker from './HeroPicker';
import { BRAND, BRAND_PRESETS, DEFAULT_PRESET, getStudioSettings, saveStudioSettings, type BrandPreset } from '../../config';
import {
  deleteAlbumCharacter,
  deleteCustomPreset,
  listAlbumCharacters,
  listCustomPresets,
  saveCustomPreset,
} from '../../services/db';
import { getVoice, setVoice as persistVoice } from '../../services/narration';

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
    id: 'highschool-identity-drama',
    icon: 'backpack',
    title: { ar: 'صراع الهوية والقبول: أسرار الثانوية', en: 'High School Identity & Belonging' },
    tagline: { ar: 'البحث عن الذات، مواجهة التنمر، وتحدي توقعات الآخرين', en: 'Self-discovery, overcoming peer pressure, and inner courage' },
    badge: { ar: 'هوية وانتماء', en: 'Identity & Voice' },
    emotionalWorld: { ar: 'الحيرة الوجودية، الرغبة في التعبير، والبحث عن الصداقة الحقيقية', en: 'Existential angst, authentic voice, and finding true loyalty' },
    defaultIdea: {
      ar: 'ينتقل طالب جديد يملك موهبة سرية في الموسيقى إلى مدرسة ثانوية كبرى، حيث يواجه ضغوط التأقلم بين المجموعات المختلفة ويتعلم الشجاعة ليكون نفسه دون خوف.',
      en: 'A transfer student with a hidden musical talent navigates high school social hierarchies, choosing authenticity over superficial popularity.',
    },
    artStyle: 'Comic Book',
    storyType: 'Moral',
    dialect: 'Modern Standard',
  },
  {
    id: 'cyber-future-rebellion',
    icon: 'bolt',
    title: { ar: 'سايبر 2099: ثورة الجيل القادم', en: 'Cyber 2099: Next-Gen Rebellion' },
    tagline: { ar: 'عالم رقمي غامض، شبكات نيون، ونضال من أجل استقلال القرار', en: 'Neon mega-cities, ethical hacking, and fighting for personal autonomy' },
    badge: { ar: 'حرية واستقلال', en: 'Digital Autonomy' },
    emotionalWorld: { ar: 'التحدي، الشغف بالحرية، والمسؤولية الأخلاقية للتكنولوجيا', en: 'Tech rebellion, passion for freedom, and ethical responsibility' },
    defaultIdea: {
      ar: 'فريق من المراهقين العباقرة في البرمجة يكتشفون خوارزمية لتوجيه المشاعر والآراء في مدينتهم الذكية، فيخوضون مغامرة رقمية لحماية خصوصية وإرادة زملائهم.',
      en: 'A group of tech-savvy teens uncovers an AI emotion-manipulation system in their futuristic city, orchestrating a clever digital rescue for personal freedom.',
    },
    artStyle: 'Comic Book',
    storyType: 'Adventure',
    dialect: 'Modern Standard',
  },
  {
    id: 'wilderness-survival-bonds',
    icon: 'tent',
    title: { ar: 'اختبار العاصفة: البقاء والتضامن', en: 'Wilderness Survival: The Test' },
    tagline: { ar: 'عواصف جبلية، اعتماد على النفس، واكتشاف القوة الكامنة', en: 'Mountain storms, intense resilience, and unbreakable team trust' },
    badge: { ar: 'صمود وقيادة', en: 'Resilience & Trust' },
    emotionalWorld: { ar: 'الصمود أمام الصعاب، الاعتماد على الذات، وتقدير قيمة الرفاق', en: 'Grit under pressure, self-reliance, and deep emotional bonds' },
    defaultIdea: {
      ar: 'تتقطع الأسباب بأربعة مراهقين في رحلة استكشافية جبلية إثر عاصفة مفاجئة، فيتجاوزون الخلافات الشخصية بالتعاون والثقة المتبادلة للعودة بسلام.',
      en: 'Four teenagers stranded in a sudden wilderness blizzard must put aside rivalries and rely on leadership and trust to navigate home safely.',
    },
    artStyle: 'Watercolor',
    storyType: 'Adventure',
    dialect: 'Modern Standard',
  },
  {
    id: 'philosophical-destiny-dilemma',
    icon: 'compass',
    title: { ar: 'بوصلة الحقيقة: صراع القرارات الصعبة', en: 'Compass of Truth: Moral Dilemmas' },
    tagline: { ar: 'أسئلة حائرة حول العدالة، التضحية، واختيار الطريق الأصوب', en: 'Deep character choices, moral courage, and standing up for truth' },
    badge: { ar: 'حقيقة وعدالة', en: 'Moral Courage' },
    emotionalWorld: { ar: 'التأمل العميق، صراع الواجب والشغف، والنزاهة الداخلية', en: 'Deep introspection, duty vs passion, and unshakeable integrity' },
    defaultIdea: {
      ar: 'يجد شاب يافع نفسه أمام قرار حاسم بين حماية مصلحة شخصية لقريب له أو قول الحقيقة للجميع لإنقاذ صديق مظلوم، متعلماً أن القوة الحقيقية تكمن في الصدق.',
      en: 'A 16-year-old faces a defining moral dilemma between protecting a family privilege and testifying to the truth, revealing the authentic meaning of integrity.',
    },
    artStyle: '3D Pixar Style',
    storyType: 'Moral',
    dialect: 'Modern Standard',
  },
];

export interface FruitFantasyTemplate {
  id: string;
  icon: string;
  title: { ar: string; en: string };
  tagline: { ar: string; en: string };
  badge: { ar: string; en: string };
  emotionalWorld: { ar: string; en: string };
  characterPersona: { ar: string; en: string };
  defaultIdea: { ar: string; en: string };
  artStyle: ArtStyle;
  storyType: StoryType;
  dialect: ArabicDialect;
}

export const FRUIT_FANTASY_TEMPLATES: FruitFantasyTemplate[] = [
  {
    id: 'pomegranate-knight-citadel',
    icon: 'pomegranate',
    title: { ar: 'قلعة الرمان وصراع بذور الحكمة', en: 'Pomegranate Citadel & Wisdom Seeds' },
    tagline: { ar: 'فارس الرمان الشجاع ورحلة توحيد قبائل الفواكه في المملكة', en: 'The brave Pomegranate Knight seeking true unity in the Orchard Realm' },
    badge: { ar: 'الولاء والقيادة', en: 'Loyalty & Valor' },
    emotionalWorld: { ar: 'مسؤولية الحماية، الشرف، والرباط الوجداني بين القبائل', en: 'Protective duty, honor, and deep bonds between orchard clans' },
    characterPersona: { ar: 'فارس الرمان (شخصية مجسدة بشرية الملامح بعباءة حب الرمان ويرتدي درعاً عضويّاً ذهبياً)', en: 'Ruby Pomegranate Knight with vibrant seeds armor and noble heart' },
    defaultIdea: {
      ar: 'في مملكة بساتين الفواكه السحرية، يخوض فارس الرمان الشجاع "جلنار" ومساعدته اللطيفة "مشمشة" مغامرة مشوقة للبحث عن بذور الحكمة القديمة لجمع شمل قبائل الفواكه وإعادة الحياة للبستان المقدس.',
      en: 'In the enchanted Orchard Realm, Julnar the Pomegranate Knight and his loyal friend Apricot embark on a quest for the ancient Wisdom Seeds to unite the fruit clans and restore life to the Sacred Tree.',
    },
    artStyle: '3D Pixar Style',
    storyType: 'Adventure',
    dialect: 'Modern Standard',
  },
  {
    id: 'citrus-cyber-rebellion',
    icon: 'citrus',
    title: { ar: 'ثورة الليمون الذكي: سايبر فروت', en: 'CyberFruit: The Citrus Hackers' },
    tagline: { ar: 'فريق الليمون المبتكر في مواجهة آلات امتصاص العصير المستقبلية', en: 'Cyber-enhanced citrus heroes hacking the bio-grid to free the neon orchard' },
    badge: { ar: 'الابتكار والحرية', en: 'Innovation & Freedom' },
    emotionalWorld: { ar: 'الشغف بالعلم، الإصرار على الحرية، وتحدي الصعاب التقنية', en: 'Passion for discovery, insistence on autonomy, and techno-grit' },
    characterPersona: { ar: 'المهندس ليمون (شخصية حيوية مجسدة بنظارات نيون وسترة تقنية مضاءة)', en: 'Citrus Hacker Lemon with neon goggles and bio-energy circuits' },
    defaultIdea: {
      ar: 'في مدينة الفواكه المستقبلية التكنولوجية، يكتشف المخترع ليمون الذكي وسريعة البديهة "توتة" مخططاً لاستهلاك طاقة الفواكه العضوية، فيبتكران شبكة حماية أثيرية لحماية بساتين الطبيعة.',
      en: 'In a futuristic techno fruit metropolis, inventive Lemon Hacker and agile Berry team up to construct a bio-energy protective shield, freeing natural orchards from automated energy drained systems.',
    },
    artStyle: 'Comic Book',
    storyType: 'Adventure',
    dialect: 'Modern Standard',
  },
  {
    id: 'exotic-mango-survival',
    icon: 'mango',
    title: { ar: 'وادي المانجو: رحلة البقاء والاستكشاف', en: 'Wild Mango Valley: Untamed Discovery' },
    tagline: { ar: 'رحالة المانجو الشجاع ومغامرة الصمود أمام العواصف العاتية', en: 'Exotic Mango Explorer trekking through wild botanical storms with friends' },
    badge: { ar: 'الصمود والاستكشاف', en: 'Resilience & Courage' },
    emotionalWorld: { ar: 'الشجاعة في مواجهة المجهول، التضامن، واكتشاف القوة الذاتية', en: 'Courage facing the wild unknown, solidarity, and inner strength' },
    characterPersona: { ar: 'المستكشف مانجو (شخصية مجسدة بقميص مغامر وقبعة خيزران)', en: 'Exotic Mango Explorer with botanical trekking gear' },
    defaultIdea: {
      ar: 'يتعرض الرحالة مانجو وأصدقاؤه الفضوليون لعاصفة استوائية تجرفهم إلى الوادي المحرم، فيستخدمون ثمارهم العضوية وذكاءهم للبقاء على قيد الحياة ومساعدة سكان الغابة.',
      en: 'Stranded in the forbidden mist valley after a tropical storm, Mango Explorer and his botanical companions rely on their fruit instincts and teamwork to survive and guide forest creatures home.',
    },
    artStyle: 'Classic Storybook',
    storyType: 'Adventure',
    dialect: 'Modern Standard',
  },
  {
    id: 'royal-apple-destiny',
    icon: 'apple',
    title: { ar: 'حكيم التفاح وشجرة القدر والضوء', en: 'Royal Apple Sage & The Destiny Tree' },
    tagline: { ar: 'حكيم التفاح الذهبي ورحلة البحث عن معنى العدالة والصدق', en: 'The Royal Apple Sage unraveling ancient moral riddles in the sacred library' },
    badge: { ar: 'الحكمة والعدالة', en: 'Wisdom & Integrity' },
    emotionalWorld: { ar: 'التأمل الأخلاقي، التسامح، والبحث عن الصدق والجمال الداخلي', en: 'Moral discernment, empathy, and seeking truth beyond appearances' },
    characterPersona: { ar: 'الحكيم تفاحة (شخصية مجسدة برداء حكماء زمردي وتاج أوراق شجر)', en: 'Royal Apple Sage with emerald robes and golden leaf crown' },
    defaultIdea: {
      ar: 'في مكتبة شجرة القدر السحرية، يواجه الحكيم تفاحة ومساعدوه لغزاً أخلاقياً حول أسرار بستان المعرفة، ليتعلم الجميع أن الجمال الحقيقي يكمن في نقاء القلوب والنوايا.',
      en: 'Inside the mystical Destiny Tree library, Royal Apple Sage and his companions solve an ancient moral riddle, learning that true splendor resides in pure intentions and honesty.',
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
  const [coverFontStyle, setCoverFontStyle] = useState<CoverFontStyle>(() => readPreset().coverFont ?? 'kufi');
  const [coverTextEffect, setCoverTextEffect] = useState<CoverTextEffect>('gold');
  const [ambientPreset, setAmbientPreset] = useState<AmbientPresetId>(() => readPreset().ambientPreset ?? 'night');
  const [showMoreStoryTypes, setShowMoreStoryTypes] = useState(false);
  const [customPresets, setCustomPresets] = useState<BrandPreset[]>([]);
  const [showSaveIdentity, setShowSaveIdentity] = useState(false);
  const [customIdentityName, setCustomIdentityName] = useState('');
  const [albumCharacters, setAlbumCharacters] = useState<SavedCharacter[]>([]);
  const [selectedAlbumCharIds, setSelectedAlbumCharIds] = useState<string[]>([]);
  const [studioSettings, setStudioSettings] = useState(() => getStudioSettings());
  const [showVoiceModal, setShowVoiceModal] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [availableDraft, setAvailableDraft] = useState<ReturnType<typeof getStoryDraft>>(null);
  const [isTeenDrama, setIsTeenDrama] = useState(() => (series?.ageGroup ?? ageGroup) === '13-18');
  const [selectedTeenTemplate, setSelectedTeenTemplate] = useState<string | null>('fruit-kingdom-saga');
  const [isFruitFantasy, setIsFruitFantasy] = useState(false);
  const [selectedFruitTemplate, setSelectedFruitTemplate] = useState<string | null>('pomegranate-knight-citadel');

  useEffect(() => {
    listCustomPresets().then(setCustomPresets).catch(() => undefined);
    listAlbumCharacters().then(setAlbumCharacters).catch(() => undefined);
  }, []);

  const handleSelectTeenTemplate = (tmpl: TeenDramaTemplate) => {
    setSelectedTeenTemplate(tmpl.id);
    setIdea(tmpl.defaultIdea[ar ? 'ar' : 'en']);
    setAgeGroup('13-18');
    setIsTeenDrama(true);
    setArtStyle(tmpl.artStyle);
    setStoryType(tmpl.storyType);
    if (tmpl.dialect) setDialect(tmpl.dialect);
  };

  const handleSelectFruitTemplate = (tmpl: FruitFantasyTemplate) => {
    setSelectedFruitTemplate(tmpl.id);
    setIdea(tmpl.defaultIdea[ar ? 'ar' : 'en']);
    setIsFruitFantasy(true);
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

  const allPresets = [...customPresets, ...BRAND_PRESETS];

  // ب3: الهوية تضبط الأسلوب الفني واللهجة وصوت الراوي وخط الغلاف والصوت المحيطي معاً
  const applyPreset = (id: string) => {
    const preset = allPresets.find((p) => p.id === id);
    if (!preset) return;
    setPresetId(id);
    setArtStyle(preset.artStyle);
    setDialect(preset.dialect);
    persistVoice(preset.voice);
    if (preset.coverFont) setCoverFontStyle(preset.coverFont);
    if (preset.ambientPreset) {
      setAmbientPreset(preset.ambientPreset);
      try {
        localStorage.setItem('sajed-ambient-preset', preset.ambientPreset);
      } catch {
        // ignore
      }
    }
    try {
      localStorage.setItem('sajed-preset', id);
    } catch {
      // ignore
    }
  };

  const handleSaveCustomIdentity = async () => {
    const trimmed = customIdentityName.trim() || (ar ? `هويتي (${artStyle})` : `My Identity (${artStyle})`);
    const saved = await saveCustomPreset({
      id: `custom-${Date.now()}`,
      label: { ar: trimmed, en: trimmed },
      desc: { ar: `${artStyle} · ${dialect}`, en: `${artStyle} · ${dialect}` },
      artStyle,
      voice: getVoice(),
      dialect,
      coverFont: coverFontStyle,
      ambientPreset,
      isCustom: true,
      createdAt: Date.now(),
    });
    const updated = await listCustomPresets();
    setCustomPresets(updated);
    setPresetId(saved.id);
    setCustomIdentityName('');
    setShowSaveIdentity(false);
  };

  const handleDeleteCustomIdentity = async (id: string) => {
    await deleteCustomPreset(id);
    setCustomPresets(await listCustomPresets());
  };

  const toggleAlbumCharacter = (charId: string) => {
    setSelectedAlbumCharIds((prev) =>
      prev.includes(charId) ? prev.filter((id) => id !== charId) : [...prev, charId].slice(0, 3)
    );
  };

  const handleDeleteAlbumCharacter = async (charId: string) => {
    await deleteAlbumCharacter(charId);
    setSelectedAlbumCharIds((prev) => prev.filter((id) => id !== charId));
    setAlbumCharacters(await listAlbumCharacters());
  };

  const updateSettings = (patch: Partial<typeof studioSettings>) => {
    setStudioSettings(saveStudioSettings(patch));
  };

  const length: StoryLength = pageCount <= 8 ? 'Short' : pageCount <= 16 ? 'Medium' : pageCount <= 28 ? 'Long' : 'Epic';
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
    const chosenAlbumChars = albumCharacters.filter((c) => selectedAlbumCharIds.includes(c.id));
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
      coverTextEffect,
      fruitFantasy: isFruitFantasy,
      customCharacters: chosenAlbumChars.length > 0 ? chosenAlbumChars : undefined,
    };
    onSubmit(params, pageCount);
  };

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
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-lantern/20 text-lantern">
            <Sparkles size={16} />
          </span>
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
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-500/20 text-rose-300">
              <Compass size={20} />
            </span>
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
                      <TemplateIconSvg name={tmpl.icon} className="w-4 h-4 shrink-0" />
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

      {/* مفتاح ونموذج فواكه الفانتازيا Fruit Fantasy Mode Toggle & Anthropomorphic Character Templates */}
      <div className="space-y-3 rounded-2xl border border-amber-500/35 bg-gradient-to-r from-amber-950/25 via-orange-950/20 to-slate-900/15 p-4 shadow-sm" dir={ar ? 'rtl' : 'ltr'}>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/20 text-amber-300">
              <TemplateIconSvg name="apple" className="w-5 h-5" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-display text-xs sm:text-sm font-bold text-ink dark:text-moonlight">
                  {ar ? 'وضع فواكه الفانتازيا (شخصيات الفواكه الملونة)' : 'Fruit Fantasy Mode (Anthropomorphic Fruits)'}
                </h3>
                <span className="rounded-full bg-amber-500/25 border border-amber-500/40 text-amber-300 dark:text-amber-200 px-2.5 py-0.5 text-[10px] font-bold">
                  {ar ? 'فانتازيا مجسدة' : 'Fruit Fantasy'}
                </span>
              </div>
              <p className="text-[11px] text-ink/70 dark:text-moonlight/70">
                {ar ? 'تفعيل 4 عوالم وجدانية لشخصيات الفواكه الملونة ذات السمات القيادية والبطولية' : 'Enable 4 unique emotional world templates featuring anthropomorphic fruit heroes'}
              </p>
            </div>
          </div>
          <label className="relative inline-flex cursor-pointer items-center shrink-0">
            <input
              type="checkbox"
              checked={isFruitFantasy}
              onChange={(e) => {
                const checked = e.target.checked;
                setIsFruitFantasy(checked);
                if (checked && !selectedFruitTemplate) {
                  handleSelectFruitTemplate(FRUIT_FANTASY_TEMPLATES[0]);
                }
              }}
              className="peer sr-only"
            />
            <div className="peer h-6 w-11 rounded-full bg-slate-700/70 after:absolute after:start-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all after:content-[''] peer-checked:bg-amber-600 peer-checked:after:translate-x-full peer-checked:after:border-white peer-focus-visible:ring-2 peer-focus-visible:ring-amber-400" />
          </label>
        </div>

        {/* بطاقات قوالب الفواكه الأربعة */}
        {isFruitFantasy && (
          <div className="pt-2 border-t border-amber-500/20 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {FRUIT_FANTASY_TEMPLATES.map((tmpl) => {
              const active = selectedFruitTemplate === tmpl.id;
              return (
                <button
                  key={tmpl.id}
                  type="button"
                  onClick={() => handleSelectFruitTemplate(tmpl)}
                  className={`flex flex-col text-start p-3.5 rounded-xl border transition active:scale-[0.98] ${
                    active
                      ? 'border-amber-500 bg-amber-500/20 ring-2 ring-amber-500/50 shadow-md text-ink dark:text-moonlight'
                      : 'border-amber-500/25 bg-black/25 hover:bg-black/40 text-ink/80 dark:text-moonlight/80'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="flex items-center gap-1.5 font-bold text-xs text-amber-300">
                      <TemplateIconSvg name={tmpl.icon} className="w-4 h-4 shrink-0" />
                      <span>{ar ? tmpl.title.ar : tmpl.title.en}</span>
                    </span>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/30 text-amber-200 shrink-0">
                      {ar ? tmpl.badge.ar : tmpl.badge.en}
                    </span>
                  </div>
                  <p className="text-[11px] font-semibold text-rose-300/90 dark:text-rose-200/90 mb-1">
                    {ar ? `الشخصية: ${tmpl.characterPersona.ar}` : `Hero: ${tmpl.characterPersona.en}`}
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
      {/* قسم فكرة القصة والإلهام */}
      <div className="luxury-card p-4 sm:p-6 space-y-3" dir={ar ? 'rtl' : 'ltr'}>
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          <label className="font-display text-sm sm:text-base font-extrabold text-ink dark:text-moonlight flex items-center gap-2" htmlFor="idea">
            <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-lantern/20 text-sm text-lantern">
              <PenTool size={14} />
            </span>
            <span>{ar ? 'فكرة القصة وأحداثها' : 'Story Idea & Plot'}</span>
          </label>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowVoiceModal(true)}
              className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-dream/35 bg-dream/10 px-3.5 py-1.5 text-xs font-bold text-ink transition hover:border-lantern hover:bg-dream/20 active:scale-95 dark:text-moonlight"
              title={ar ? 'تسجيل فكرة القصة بصوتك وتفريغها تلقائياً' : 'Speak your story idea with smart voice dictation'}
            >
              <Mic size={14} className="text-lantern" />
              <span>{ar ? 'إملاء صوتي' : 'Voice Dictation'}</span>
            </button>
            <button
              type="button"
              onClick={surprise}
              className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-lantern/40 bg-lantern/15 px-3.5 py-1.5 text-xs font-bold text-ink transition hover:bg-lantern/25 active:scale-95 dark:text-amber-200"
            >
              <Sparkles size={14} aria-hidden className="text-lantern" />
              <span>{ar ? 'فاجئني بفكرة' : 'Surprise Me'}</span>
            </button>
          </div>
        </div>

        <textarea
          id="idea"
          value={idea}
          onChange={(e) => setIdea(e.target.value.slice(0, MAX_IDEA_LENGTH))}
          rows={3}
          placeholder={ar ? 'أرنب صغير شجاع يكتشف سر النجوم المضيئة في البستان...' : 'A brave little rabbit who discovers the secret of glowing stars...'}
          aria-invalid={tooShort}
          className="w-full rounded-2xl border border-dream/30 bg-white/90 px-4 py-3 text-sm sm:text-base leading-relaxed text-ink outline-none transition focus:border-lantern focus:ring-2 focus:ring-lantern/30 dark:border-white/15 dark:bg-white/[0.06] dark:text-moonlight resize-none"
        />

        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-ink/60 dark:text-moonlight/60">
          <span className={tooShort ? 'font-bold text-coral' : 'font-medium text-emerald-600 dark:text-emerald-400'}>
            {tooShort
              ? ar ? `أضف تفاصيل أكثر: ${words} من ${minWords} كلمات على الأقل` : `Add more detail: ${words} of at least ${minWords} words`
              : ar ? `عدد الكلمات ممتاز (${words} كلمة)` : `Great detail (${words} words)`}
          </span>
          <span className="font-mono text-[11px]">
            {idea.length}/{MAX_IDEA_LENGTH}
          </span>
        </div>

        <p className={hintCls}>
          <Lightbulb size={14} aria-hidden className="mt-0.5 shrink-0 text-lantern" />
          <span>{SMART_TIPS[language][ageGroup]}</span>
        </p>
      </div>

      {!series && <HeroPicker ar={ar} selectedId={hero?.id ?? null} onSelect={setHero} />}

      {/* ب7: ألبوم الشخصيات المحفوظة (IndexedDB characters store) */}
      {!series && albumCharacters.length > 0 && (
        <div className="luxury-card p-4 sm:p-5 space-y-3" dir={ar ? 'rtl' : 'ltr'}>
          <div className="flex items-center justify-between gap-2">
            <span className="font-display text-sm font-extrabold text-ink dark:text-moonlight flex items-center gap-2">
              <Users size={16} className="text-lantern" />
              <span>{ar ? 'من ألبومي (شخصيات محفوظة جاهزة للمشاركة)' : 'From My Character Album'}</span>
            </span>
            <span className="text-[11px] font-semibold text-ink/60 dark:text-moonlight/60">
              {ar ? `اختر حتى 3 شخصيات (${selectedAlbumCharIds.length}/3)` : `Pick up to 3 (${selectedAlbumCharIds.length}/3)`}
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {albumCharacters.map((c) => {
              const selected = selectedAlbumCharIds.includes(c.id);
              return (
                <div
                  key={c.id}
                  className={`flex items-center justify-between gap-2 rounded-2xl border p-3 transition ${
                    selected
                      ? 'border-lantern bg-lantern/15 shadow-xs'
                      : 'border-dream/25 bg-white/60 dark:border-white/10 dark:bg-white/5'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => toggleAlbumCharacter(c.id)}
                    className="flex flex-1 items-center gap-2.5 text-start"
                  >
                    <span
                      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs font-bold ${
                        selected ? 'border-lantern bg-lantern text-ink' : 'border-dream/40 text-ink/60 dark:text-moonlight/60'
                      }`}
                    >
                      {selected ? <Check size={14} /> : c.name.slice(0, 1)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="font-display text-xs font-extrabold text-ink dark:text-moonlight truncate">{c.name}</p>
                      <p className="text-[11px] text-ink/60 dark:text-moonlight/60 truncate">{c.personality || c.description}</p>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteAlbumCharacter(c.id)}
                    className="rounded-lg p-1.5 text-ink/45 hover:text-coral dark:text-moonlight/45"
                    aria-label={ar ? 'حذف من الألبوم' : 'Remove from album'}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* قسم الهوية الجاهزة وخصائص القصة بالقوائم المنسدلة الفخمة */}
      <div className="luxury-card p-4 sm:p-6 space-y-5" dir={ar ? 'rtl' : 'ltr'}>
        {!series && (
          <div className="space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-display text-sm font-extrabold text-ink dark:text-moonlight">
                {ar
                  ? `الهوية السريعة للقصة (${allPresets.length} هوية تضبط الأسلوب والراوي واللهجة والخط والصوت المحيطي)`
                  : `Quick Story Identity (${allPresets.length} Presets)`}
              </span>
              <button
                type="button"
                onClick={() => setShowSaveIdentity((v) => !v)}
                className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-lantern/45 bg-lantern/15 px-3 py-1 text-xs font-bold text-ink transition hover:bg-lantern/25 active:scale-95 dark:text-amber-200"
              >
                <BookmarkPlus size={14} className="text-lantern" />
                <span>{ar ? 'احفظ هويتي' : 'Save My Identity'}</span>
              </button>
            </div>

            {showSaveIdentity && (
              <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-lantern/35 bg-lantern/10 p-2.5">
                <input
                  type="text"
                  value={customIdentityName}
                  onChange={(e) => setCustomIdentityName(e.target.value.slice(0, 40))}
                  placeholder={ar ? 'اسم الهوية (مثلاً: هويتي المسائية)...' : 'Identity name...'}
                  className="min-h-9 flex-1 rounded-xl border border-dream/30 bg-white/90 px-3 text-xs text-ink outline-none focus:border-lantern dark:border-white/15 dark:bg-black/30 dark:text-moonlight"
                />
                <button
                  type="button"
                  onClick={handleSaveCustomIdentity}
                  className="min-h-9 rounded-xl bg-lantern px-3.5 text-xs font-extrabold text-ink shadow-2xs active:scale-95"
                >
                  {ar ? 'حفظ' : 'Save'}
                </button>
              </div>
            )}

            <div role="radiogroup" aria-label={ar ? 'هوية القصة' : 'Story identity'} className="-mx-1 flex snap-x gap-2.5 overflow-x-auto px-1 pb-2 custom-scrollbar">
              {allPresets.map((p) => {
                const isSelected = presetId === p.id;
                return (
                  <div
                    key={p.id}
                    className={`relative min-h-14 min-w-[10.5rem] shrink-0 snap-start rounded-2xl border px-3.5 py-2.5 text-start transition-all ${
                      isSelected
                        ? 'border-lantern bg-gradient-to-br from-lantern/25 via-lantern/10 to-transparent shadow-sm ring-1 ring-lantern/40'
                        : 'border-dream/25 bg-white/65 hover:border-lantern/50 dark:border-white/10 dark:bg-white/[0.05]'
                    }`}
                  >
                    <button
                      type="button"
                      role="radio"
                      aria-checked={isSelected}
                      onClick={() => applyPreset(p.id)}
                      className="w-full text-start"
                    >
                      <span className="block font-display text-xs sm:text-sm font-extrabold text-ink dark:text-moonlight pe-5">
                        {ar ? p.label.ar : p.label.en}
                      </span>
                      <span className="mt-0.5 block text-[11px] leading-snug text-ink/60 dark:text-moonlight/60">
                        {ar ? p.desc.ar : p.desc.en}
                      </span>
                    </button>
                    {p.isCustom && (
                      <button
                        type="button"
                        onClick={() => handleDeleteCustomIdentity(p.id)}
                        className="absolute top-2 end-2 rounded-full p-1 text-ink/45 hover:text-coral dark:text-moonlight/45"
                        aria-label={ar ? 'حذف الهوية' : 'Delete preset'}
                      >
                        <X size={12} />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ب1: 16 نوع قصص (5 أساسية + زر المزيد للـ 11 الباقية) مع عرض البنية السردية */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <label className="font-display text-xs sm:text-sm font-extrabold text-ink dark:text-moonlight">
              {ar ? 'نوع القصة والبنية السردية (16 نوعاً)' : 'Story Genre & Narrative Arc (16 Types)'}
            </label>
            <button
              type="button"
              onClick={() => setShowMoreStoryTypes((v) => !v)}
              className="inline-flex min-h-8 items-center gap-1 rounded-full border border-dream/35 bg-dream/10 px-3 py-1 text-xs font-bold text-ink transition hover:border-lantern dark:text-moonlight"
            >
              <span>
                {showMoreStoryTypes
                  ? ar
                    ? 'إخفاء الأنواع الإضافية'
                    : 'Show fewer'
                  : ar
                    ? `المزيد (+${EXTRA_STORY_TYPES.length})`
                    : `More (+${EXTRA_STORY_TYPES.length})`}
              </span>
              {showMoreStoryTypes ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            {(showMoreStoryTypes ? [...PRIMARY_STORY_TYPES, ...EXTRA_STORY_TYPES] : PRIMARY_STORY_TYPES).map((t) => {
              const active = storyType === t.value;
              return (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setStoryType(t.value)}
                  aria-pressed={active}
                  className={`flex flex-col items-start justify-between rounded-2xl border p-2.5 text-start transition active:scale-95 ${
                    active
                      ? 'border-lantern bg-lantern/20 text-ink shadow-xs ring-1 ring-lantern/40 dark:text-moonlight'
                      : 'border-dream/25 bg-white/65 text-ink/80 hover:border-lantern/45 dark:border-white/10 dark:bg-white/5 dark:text-moonlight/85'
                  }`}
                >
                  <span className="font-display text-xs font-extrabold">{ar ? t.label.ar : t.label.en}</span>
                  <span className="mt-1 text-[10px] leading-snug text-ink/60 dark:text-moonlight/60 line-clamp-2">
                    {ar ? t.desc.ar : t.desc.en}
                  </span>
                </button>
              );
            })}
          </div>

          {STORY_TYPE_SPECS[storyType] && (
            <div className="rounded-xl border border-dream/20 bg-dream/5 px-3 py-2 text-[11px] text-ink/70 dark:text-moonlight/70">
              <span className="font-bold text-lantern">{ar ? 'قوس السرد: ' : 'Narrative Arc: '}</span>
              <span>
                {STORY_TYPE_SPECS[storyType].arc.beginning} ← {STORY_TYPE_SPECS[storyType].arc.middle} ←{' '}
                {STORY_TYPE_SPECS[storyType].arc.climax} ← {STORY_TYPE_SPECS[storyType].arc.ending}
              </span>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {ar && !series && (
            <div className="sm:col-span-2">
              <LuxurySelect<ArabicDialect>
                id="dialect"
                ar={ar}
                label="اللهجة العربية المفضلة للسرد والحوار"
                value={dialect}
                onChange={setDialect}
                searchable
                options={DIALECT_OPTIONS.map((d): LuxuryOption<ArabicDialect> => ({
                  value: d.value,
                  label: d.label,
                  icon: <DialectBadgeSvg code={d.flag} />,
                  badge: d.value === 'Modern Standard' ? 'فصحى' : undefined,
                }))}
              />
            </div>
          )}

          <LuxurySelect<AgeGroup>
            id="ageGroup"
            ar={ar}
            disabled={Boolean(series)}
            label={ar ? 'الفئة العمرية' : 'Age Group'}
            value={ageGroup}
            onChange={(val) => {
              setAgeGroup(val);
              setIsTeenDrama(val === '13-18');
            }}
            searchable={false}
            options={AGE_GROUPS.map((g): LuxuryOption<AgeGroup> => ({
              value: g.value,
              label: g.label,
              sublabel: ar ? g.desc.ar : g.desc.en,
              icon: (
                <span className="text-lantern">
                  {g.value === '3-4' ? (
                    <Smile size={15} />
                  ) : g.value === '4-6' ? (
                    <Sparkles size={15} />
                  ) : g.value === '7-9' ? (
                    <Users size={15} />
                  ) : g.value === '9-12' ? (
                    <Rocket size={15} />
                  ) : (
                    <Compass size={15} />
                  )}
                </span>
              ),
            }))}
          />

          <LuxurySelect<ArtStyle>
            id="artStyle"
            ar={ar}
            disabled={Boolean(series)}
            label={ar ? 'الأسلوب الفني للرسومات (18 أسلوباً)' : 'Illustration Art Style (18 Styles)'}
            value={artStyle}
            onChange={setArtStyle}
            searchable
            options={ART_STYLE_OPTIONS.map((s): LuxuryOption<ArtStyle> => ({
              value: s.value,
              label: ar ? s.labelAr : s.value,
              sublabel: ar ? s.value : undefined,
              icon: <Palette size={15} className="text-lantern" />,
            }))}
          />

          <LuxurySelect<CoverFontStyle>
            id="coverFontStyle"
            ar={ar}
            label={ar ? 'خط عنوان الغلاف (12 خطاً عربياً)' : 'Cover Title Font (12 Fonts)'}
            value={coverFontStyle}
            onChange={setCoverFontStyle}
            searchable
            options={COVER_FONT_OPTIONS.map((f): LuxuryOption<CoverFontStyle> => ({
              value: f.value,
              label: ar ? f.label.ar : f.label.en,
              sublabel: ar ? f.sublabel.ar : f.sublabel.en,
              fontClassName: f.className,
              icon: <Feather size={15} className="text-lantern" />,
            }))}
          />

          <LuxurySelect<AspectRatio>
            id="aspectRatio"
            ar={ar}
            disabled={Boolean(series)}
            label={ar ? 'أبعاد وشكل لوحة الرسم' : 'Illustration Aspect Ratio'}
            value={aspectRatio}
            onChange={setAspectRatio}
            searchable={false}
            options={ASPECT_RATIO_OPTIONS.map((r): LuxuryOption<AspectRatio> => ({
              value: r.value,
              label: ar ? r.label.ar : r.label.en,
              badge: r.value,
              icon: (
                <span className="text-lantern">
                  {r.value === '1:1' ? (
                    <Square size={15} />
                  ) : r.value === '16:9' ? (
                    <Film size={15} />
                  ) : r.value === '9:16' ? (
                    <Smartphone size={15} />
                  ) : (
                    <Frame size={15} />
                  )}
                </span>
              ),
            }))}
          />
        </div>

        {/* ب2: تأثيرات النص (ذهبي / ظل / حدود / عادي) + معاينة حية للعنوان أثناء الاختيار */}
        <div className="rounded-2xl border border-dream/25 bg-gradient-to-br from-[#1b1533] via-[#261c47] to-[#120e24] p-4 text-white space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-bold text-amber-200 flex items-center gap-1.5">
              <Crown size={14} className="text-lantern" />
              <span>{ar ? 'تأثير نص الغلاف ومعاينة الخط الحية' : 'Cover Title Effect & Live Preview'}</span>
            </span>
            <div className="flex flex-wrap items-center gap-1.5" role="radiogroup" aria-label={ar ? 'تأثير العنوان' : 'Title effect'}>
              {COVER_EFFECT_OPTIONS.map((ef) => {
                const active = coverTextEffect === ef.value;
                return (
                  <button
                    key={ef.value}
                    type="button"
                    onClick={() => setCoverTextEffect(ef.value)}
                    aria-pressed={active}
                    className={`rounded-full px-3 py-1 text-[11px] font-bold transition ${
                      active
                        ? 'bg-lantern text-ink shadow-xs'
                        : 'bg-white/10 text-white/80 hover:bg-white/20'
                    }`}
                  >
                    {ar ? ef.label.ar : ef.label.en}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="rounded-xl border border-white/10 bg-black/30 px-4 py-4 text-center">
            <p className={`text-xl sm:text-2xl leading-relaxed ${getCoverTitleClasses(coverFontStyle, coverTextEffect)}`}>
              {idea.trim()
                ? idea.trim().split(/\s+/).slice(0, 6).join(' ')
                : ar
                  ? 'حكاية النجوم في بستان الأحلام'
                  : 'The Secret of the Starlit Orchard'}
            </p>
          </div>
        </div>

        {/* ب4 + ب8: إعدادات توفير الحصة (معاينة الغلاف والصفحة 1) وعلامة الحقوق المفرغة عند التصدير */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-dream/20 dark:border-white/10">
          <div className="flex items-center justify-between gap-3 rounded-2xl border border-dream/25 bg-white/55 p-3 dark:border-white/10 dark:bg-white/5">
            <div className="flex items-start gap-2">
              <Eye size={16} className="mt-0.5 text-lantern shrink-0" />
              <div>
                <p className="font-display text-xs font-bold text-ink dark:text-moonlight">
                  {ar ? 'معاينة الغلاف والصفحة 1 أولاً' : 'Preview Cover & Page 1 First'}
                </p>
                <p className="text-[11px] text-ink/60 dark:text-moonlight/60">
                  {ar ? 'يتوقف بعد الصفحة 1 لتوفير الحصة حتى تضغط «أكمل»' : 'Pauses after page 1 to save quota until you confirm'}
                </p>
              </div>
            </div>
            <input
              type="checkbox"
              checked={studioSettings.previewFirstGate}
              onChange={(e) => updateSettings({ previewFirstGate: e.target.checked })}
              className="h-5 w-5 accent-lantern cursor-pointer shrink-0"
              aria-label={ar ? 'معاينة الغلاف والصفحة 1 أولاً' : 'Preview Cover & Page 1 First'}
            />
          </div>

          <div className="rounded-2xl border border-dream/25 bg-white/55 p-3 space-y-2 dark:border-white/10 dark:bg-white/5">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-start gap-2">
                <ShieldCheck size={16} className="mt-0.5 text-lantern shrink-0" />
                <div>
                  <p className="font-display text-xs font-bold text-ink dark:text-moonlight">
                    {ar ? 'علامة حقوق مفرغة عند التصدير' : 'Hollow Watermark on Export'}
                  </p>
                  <p className="text-[11px] text-ink/60 dark:text-moonlight/60">
                    {ar ? 'تُضاف عند التصدير فقط وتبقى الصور الأصلية نظيفة' : 'Applied only on export; DB images stay clean'}
                  </p>
                </div>
              </div>
              <input
                type="checkbox"
                checked={studioSettings.watermarkEnabled}
                onChange={(e) => updateSettings({ watermarkEnabled: e.target.checked })}
                className="h-5 w-5 accent-lantern cursor-pointer shrink-0"
                aria-label={ar ? 'تفعيل العلامة المائية عند التصدير' : 'Enable export watermark'}
              />
            </div>
            {studioSettings.watermarkEnabled && (
              <input
                type="text"
                value={studioSettings.watermarkText}
                onChange={(e) => updateSettings({ watermarkText: e.target.value.slice(0, 50) })}
                placeholder={ar ? `النص الافتراضي: ${BRAND.name.ar}` : `Default: ${BRAND.name.en}`}
                className="w-full rounded-xl border border-dream/30 bg-white/85 px-3 py-1.5 text-xs text-ink outline-none focus:border-lantern dark:border-white/15 dark:bg-black/30 dark:text-moonlight"
              />
            )}
          </div>
        </div>

        {/* طول القصة وعدد الصفحات */}
        <div className="pt-2 border-t border-dream/20 dark:border-white/10">
          <div className="mb-2 flex items-center justify-between">
            <label className="font-display text-xs sm:text-sm font-extrabold text-ink dark:text-moonlight" htmlFor="length">
              {ar ? `طول القصة: ${pageCount} صفحة` : `Story Length: ${pageCount} pages`}
            </label>
            <span className="inline-flex items-center gap-1 rounded-full bg-lantern/15 border border-lantern/30 px-2.5 py-0.5 text-[11px] font-bold text-lantern">
              <Clock size={12} aria-hidden />
              <span>{ar ? `~${readingMinutes} دقائق قراءة` : `~${readingMinutes} min read`}</span>
            </span>
          </div>

          <div className="mb-3 grid grid-cols-2 sm:grid-cols-4 gap-2" role="group" aria-label={ar ? 'أطوال جاهزة' : 'Length presets'}>
            {STORY_LENGTHS.map((l) => {
              const active = pageCount === l.pages;
              return (
                <button
                  key={l.value}
                  type="button"
                  onClick={() => setPageCount(l.pages)}
                  aria-pressed={active}
                  className={`min-h-10 rounded-xl border px-3 py-2 text-xs font-bold transition-all active:scale-95 ${
                    active
                      ? 'border-lantern bg-lantern text-ink shadow-xs'
                      : 'border-dream/30 bg-white/70 text-ink/80 hover:border-lantern/50 dark:border-white/15 dark:bg-white/5 dark:text-moonlight/85'
                  }`}
                >
                  {ar ? l.label.ar : l.label.en}
                </button>
              );
            })}
          </div>

          <input
            id="length"
            type="range"
            min={MIN_STORY_PAGES}
            max={MAX_STORY_PAGES}
            step={1}
            value={pageCount}
            onChange={(e) => setPageCount(Number(e.target.value))}
            className="h-9 w-full cursor-pointer accent-lantern"
          />
          {pageCount > FIRST_BATCH_PAGES && (
            <p className="mt-1 text-[11px] text-ink/60 dark:text-moonlight/60">
              {ar ? 'تُكتب القصة الطويلة على دفعات بفصول متتابعة، ويمكن استئنافها في أي وقت.' : 'Long stories are generated in chapters and can be resumed anytime.'}
            </p>
          )}
        </div>
      </div>

      {/* زر الإنشاء الملكي */}
      <button
        type="submit"
        disabled={!canSubmit}
        className="animate-lantern flex min-h-14 w-full items-center justify-center gap-2.5 rounded-2xl bg-gradient-to-r from-lantern via-amber-400 to-lantern py-4 font-display text-base sm:text-lg font-extrabold text-ink shadow-xl shadow-lantern/30 transition hover:brightness-105 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
      >
        <Wand2 size={22} aria-hidden />
        <span>{ar ? 'أنشئ القصة المصورة الآن' : 'Create Illustrated Story Now'}</span>
      </button>

      {canLoadStory && (
        <button
          type="button"
          onClick={onLoadStory}
          className="mx-auto flex min-h-11 items-center gap-2 rounded-full border border-dream/35 bg-white/60 px-6 py-2.5 text-xs sm:text-sm font-bold text-ink shadow-2xs transition hover:border-lantern dark:border-white/15 dark:bg-white/5 dark:text-moonlight"
        >
          <FolderOpen size={16} className="text-lantern" aria-hidden />
          <span>{ar ? 'فتح آخر قصة محفوظة' : 'Open Last Saved Story'}</span>
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
