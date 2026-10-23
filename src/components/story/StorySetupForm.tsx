import { useState, useEffect, useRef, type FormEvent, type TouchEvent } from 'react';
import {
  AlertTriangle,
  BookmarkPlus,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Clock,
  Compass,
  Crown,
  Eye,
  Feather,
  FileText,
  Film,
  FolderOpen,
  Frame,
  HelpCircle,
  Layers,
  Lightbulb,
  Mic,
  Palette,
  PenTool,
  RefreshCw,
  Rocket,
  RotateCcw,
  Settings2,
  ShieldCheck,
  Smile,
  Smartphone,
  Sparkles,
  Square,
  Trash2,
  Users,
  Volume2,
  Wand2,
  WifiOff,
  X,
} from 'lucide-react';
import VoiceDictationModal from './VoiceDictationModal';
import BookTemplateBrowser from './BookTemplateBrowser';
import LuxurySelect, { type LuxuryOption } from '../common/LuxurySelect';
import { DialectBadgeSvg, StyleThumb, TemplateIconSvg } from '../common/BrandIcons';
import OnboardingModal, { hasSeenOnboarding } from '../common/OnboardingModal';
import { BookTemplate } from '../../data/bookTemplates';
import {
  dismissDailyIdeaForToday,
  isDailyIdeaDismissedToday,
  pickDailyIdea,
} from '../../data/dailyIdeas';
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
  AudienceLevel,
  ChildProfile,
  CoverFontStyle,
  CoverTextEffect,
  Language,
  NarratorVoice,
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
  saveAlbumCharacter,
  saveCustomPreset,
} from '../../services/db';
import { getVoice, setVoice as persistVoice, VOICE_OPTIONS } from '../../services/narration';
import {
  applyImprovedIdeaWithUndo,
  canRequestImproveIdea,
  IMPROVE_IDEA_COOLDOWN_MS,
  improveStoryIdea,
   resolveStyleConsistencyKeywords,
  restoreOriginalIdea,
  sanitizeUserIdeaText,
  STYLE_CONSISTENCY_PRESETS,
} from '../../services/gemini';
import { ApiError } from '../../services/api';

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

export type WizardStep = 1 | 2 | 3;

export const WIZARD_STATE_STORAGE_KEY = 'sajed_wizard_state_v3';

interface PersistedWizardState {
  wizardStep: WizardStep;
  idea: string;
  dialect: ArabicDialect;
  ageGroup: AgeGroup;
  audienceLevel?: AudienceLevel;
  storyType: StoryType;
  pageCount: number;
  artStyle: ArtStyle;
  styleConsistency?: string;
  aspectRatio: AspectRatio;
  presetId: string;
  coverFontStyle: CoverFontStyle;
  coverTextEffect: CoverTextEffect;
  ambientPreset: AmbientPresetId;
  selectedVoice: NarratorVoice;
  isTeenDrama: boolean;
  selectedTeenTemplate: string | null;
  isFruitFantasy: boolean;
  selectedFruitTemplate: string | null;
  hero: ChildProfile | null;
  selectedAlbumCharIds: string[];
}

const loadPersistedWizardState = (): Partial<PersistedWizardState> | null => {
  try {
    const raw = localStorage.getItem(WIZARD_STATE_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PersistedWizardState>;
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
};

const savePersistedWizardState = (state: PersistedWizardState): void => {
  try {
    localStorage.setItem(WIZARD_STATE_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignore storage errors
  }
};

interface Props {
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
  const savedWizard = !initialIdea && !series ? loadPersistedWizardState() : null;

  const [wizardStep, setWizardStep] = useState<WizardStep>(() => {
    const st = savedWizard?.wizardStep;
    return st === 1 || st === 2 || st === 3 ? st : 1;
  });
  const [showAllSteps, setShowAllSteps] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(() => !hasSeenOnboarding());
  const [stepValidationError, setStepValidationError] = useState(false);
  const [showAdvancedOptions, setShowAdvancedOptions] = useState(false);

  const [idea, setIdea] = useState(() => (initialIdea ?? savedWizard?.idea ?? '').slice(0, MAX_IDEA_LENGTH));
  const [dialect, setDialect] = useState<ArabicDialect>(() => series?.dialect ?? savedWizard?.dialect ?? readPreset().dialect);
  const [ageGroup, setAgeGroup] = useState<AgeGroup>(() => series?.ageGroup ?? savedWizard?.ageGroup ?? '4-6');
  const [audienceLevel, setAudienceLevel] = useState<AudienceLevel>(() => {
    if (series?.audienceLevel) return series.audienceLevel;
    if (savedWizard?.audienceLevel) return savedWizard.audienceLevel;
    return (series?.ageGroup ?? savedWizard?.ageGroup) === '18+' ? 'adults' : 'kids';
  });
  const [storyType, setStoryType] = useState<StoryType>(() => savedWizard?.storyType ?? 'Bedtime');
  const [pageCount, setPageCount] = useState<number>(() => savedWizard?.pageCount ?? 6);
  const [artStyle, setArtStyle] = useState<ArtStyle>(() => series?.artStyle ?? savedWizard?.artStyle ?? readPreset().artStyle);
  const [styleConsistency, setStyleConsistency] = useState<string>(() => series?.styleConsistency ?? savedWizard?.styleConsistency ?? 'auto');
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>(() => series?.aspectRatio ?? savedWizard?.aspectRatio ?? '4:3');
  const [hero, setHero] = useState<ChildProfile | null>(() => savedWizard?.hero ?? null);
  const [presetId, setPresetId] = useState<string>(() => savedWizard?.presetId ?? readPreset().id);
  const [coverFontStyle, setCoverFontStyle] = useState<CoverFontStyle>(() => savedWizard?.coverFontStyle ?? readPreset().coverFont ?? 'kufi');
  const [coverTextEffect, setCoverTextEffect] = useState<CoverTextEffect>(() => savedWizard?.coverTextEffect ?? 'gold');
  const [ambientPreset, setAmbientPreset] = useState<AmbientPresetId>(() => savedWizard?.ambientPreset ?? readPreset().ambientPreset ?? 'night');
  const [selectedVoice, setSelectedVoice] = useState<NarratorVoice>(() => savedWizard?.selectedVoice ?? getVoice());
  const [showMoreStoryTypes, setShowMoreStoryTypes] = useState(false);
  const [customPresets, setCustomPresets] = useState<BrandPreset[]>([]);
  const [showSaveIdentity, setShowSaveIdentity] = useState(false);
  const [customIdentityName, setCustomIdentityName] = useState('');
  const [albumCharacters, setAlbumCharacters] = useState<SavedCharacter[]>([]);
  const [selectedAlbumCharIds, setSelectedAlbumCharIds] = useState<string[]>(() => savedWizard?.selectedAlbumCharIds ?? []);
  const [studioSettings, setStudioSettings] = useState(() => getStudioSettings());
  const [showVoiceModal, setShowVoiceModal] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [availableDraft, setAvailableDraft] = useState<ReturnType<typeof getStoryDraft>>(null);
  const [isTeenDrama, setIsTeenDrama] = useState<boolean>(() => savedWizard?.isTeenDrama ?? (series?.ageGroup ?? ageGroup) === '13-18');
  const [selectedTeenTemplate, setSelectedTeenTemplate] = useState<string | null>(
    () => savedWizard?.selectedTeenTemplate ?? TEEN_DRAMA_TEMPLATES[0].id
  );
  const [isFruitFantasy, setIsFruitFantasy] = useState<boolean>(() => savedWizard?.isFruitFantasy ?? false);
  const [selectedFruitTemplate, setSelectedFruitTemplate] = useState<string | null>(
    () => savedWizard?.selectedFruitTemplate ?? FRUIT_FANTASY_TEMPLATES[0].id
  );
  const [showAddCharForm, setShowAddCharForm] = useState(false);
  const [newCharName, setNewCharName] = useState('');
  const [newCharMaturity, setNewCharMaturity] = useState<'adult' | 'teen' | 'child'>('adult');
  const [newCharGender, setNewCharGender] = useState<'male' | 'female'>('male');
  const [newCharDesc, setNewCharDesc] = useState('');
  const [dailyIdeaDismissed, setDailyIdeaDismissed] = useState<boolean>(() => isDailyIdeaDismissedToday());
  const [dailyIdeaOffset, setDailyIdeaOffset] = useState<number>(0);

  const currentDailyIdea = pickDailyIdea(new Date(), presetId, dailyIdeaOffset);
  const dailyIdeaGenreObj = [...PRIMARY_STORY_TYPES, ...EXTRA_STORY_TYPES].find((t) => t.value === currentDailyIdea.storyType);
  const dailyIdeaGenreLabel = dailyIdeaGenreObj ? (ar ? dailyIdeaGenreObj.label.ar : dailyIdeaGenreObj.label.en) : currentDailyIdea.storyType;

  const handleApplyDailyIdea = () => {
    setIdea(currentDailyIdea.idea[ar ? 'ar' : 'en'].slice(0, MAX_IDEA_LENGTH));
    setStoryType(currentDailyIdea.storyType);
    setStepValidationError(false);
    setWizardStep(1);
    setTimeout(() => ideaInputRef.current?.focus(), 60);
  };

  const handleDismissDailyIdea = () => {
    dismissDailyIdeaForToday();
    setDailyIdeaDismissed(true);
  };

  // ب2: حالة «حسّن فكرتي» (3 بطاقات + تراجع + حد 3 ثوانٍ + حالات تحميل/فشل/عدم اتصال)
  const [improvedIdeas, setImprovedIdeas] = useState<string[]>([]);
  const [improvingIdea, setImprovingIdea] = useState<boolean>(false);
  const [improveError, setImproveError] = useState<string | null>(null);
  const [improveOffline, setImproveOffline] = useState<boolean>(false);
  const [originalIdeaBeforeImprove, setOriginalIdeaBeforeImprove] = useState<string | null>(null);
  const [lastImproveClickAt, setLastImproveClickAt] = useState<number>(0);
  const [cooldownActive, setCooldownActive] = useState<boolean>(false);

  useEffect(() => {
    if (!cooldownActive) return;
    const t = setTimeout(() => setCooldownActive(false), IMPROVE_IDEA_COOLDOWN_MS);
    return () => clearTimeout(t);
  }, [cooldownActive, lastImproveClickAt]);

  const handleImproveIdea = async () => {
    const clean = sanitizeUserIdeaText(idea);
    if (clean.split(/\s+/).filter(Boolean).length < 3 || improvingIdea) return;
    const now = Date.now();
    if (!canRequestImproveIdea(lastImproveClickAt, now)) {
      return;
    }
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      setImproveOffline(true);
      setImproveError(
        ar
          ? 'لا يوجد اتصال بالإنترنت حالياً. تحقّق من الشبكة ثم أعد المحاولة.'
          : 'You are currently offline. Please check your connection and try again.'
      );
      return;
    }
    setLastImproveClickAt(now);
    setCooldownActive(true);
    setImprovingIdea(true);
    setImproveError(null);
    setImproveOffline(false);
    try {
      const results = await improveStoryIdea({
        idea: clean,
        language,
        dialect: ar ? dialect : 'Modern Standard',
        storyType,
        ageGroup,
      });
      setImprovedIdeas(results);
    } catch (err) {
      const isOff = err instanceof ApiError && err.code === 'OFFLINE';
      setImproveOffline(isOff);
      setImproveError(
        isOff
          ? ar
            ? 'لا يوجد اتصال بالإنترنت حالياً. تحقّق من الشبكة ثم أعد المحاولة.'
            : 'You are currently offline. Please check your connection and try again.'
          : ar
            ? 'تعذّر تحسين الفكرة في هذه اللحظة. يمكنك المحاولة مرة أخرى.'
            : 'Could not improve your idea right now. Please try again.'
      );
    } finally {
      setImprovingIdea(false);
    }
  };

  const handleSelectImprovedIdea = (suggestion: string) => {
    const { nextIdea, originalIdea } = applyImprovedIdeaWithUndo(idea, originalIdeaBeforeImprove, suggestion);
    setOriginalIdeaBeforeImprove(originalIdea);
    setIdea(nextIdea);
    setStepValidationError(false);
  };

  const handleUndoImprovedIdea = () => {
    const { restoredIdea, originalIdea } = restoreOriginalIdea(originalIdeaBeforeImprove, idea);
    setIdea(restoredIdea);
    setOriginalIdeaBeforeImprove(originalIdea);
  };

  const ideaInputRef = useRef<HTMLTextAreaElement | null>(null);
  const touchStartXRef = useRef<number | null>(null);

  useEffect(() => {
    listCustomPresets().then(setCustomPresets).catch(() => undefined);
    listAlbumCharacters().then(setAlbumCharacters).catch(() => undefined);
  }, []);

  // البند 5: حفظ حالة المعالج (الخطوة الحالية وقيم الحقول) في localStorage داخل try/catch
  useEffect(() => {
    if (series) return;
    savePersistedWizardState({
      wizardStep,
      idea,
      dialect,
      ageGroup,
      audienceLevel,
      storyType,
      pageCount,
      artStyle,
      styleConsistency,
      aspectRatio,
      presetId,
      coverFontStyle,
      coverTextEffect,
      ambientPreset,
      selectedVoice,
      isTeenDrama,
      selectedTeenTemplate,
      isFruitFantasy,
      selectedFruitTemplate,
      hero,
      selectedAlbumCharIds,
    });
  }, [
    wizardStep,
    idea,
    dialect,
    ageGroup,
    audienceLevel,
    storyType,
    pageCount,
    artStyle,
    styleConsistency,
    aspectRatio,
    presetId,
    coverFontStyle,
    coverTextEffect,
    ambientPreset,
    selectedVoice,
    isTeenDrama,
    selectedTeenTemplate,
    isFruitFantasy,
    selectedFruitTemplate,
    hero,
    selectedAlbumCharIds,
    series,
  ]);

  const handleSelectTeenTemplate = (tmpl: TeenDramaTemplate) => {
    setSelectedTeenTemplate(tmpl.id);
    setIdea(tmpl.defaultIdea[ar ? 'ar' : 'en']);
    setStepValidationError(false);
    setAgeGroup('13-18');
    setIsTeenDrama(true);
    setArtStyle(tmpl.artStyle);
    setStoryType(tmpl.storyType);
    if (tmpl.dialect) setDialect(tmpl.dialect);
  };

  const handleSelectFruitTemplate = (tmpl: FruitFantasyTemplate) => {
    setSelectedFruitTemplate(tmpl.id);
    setIdea(tmpl.defaultIdea[ar ? 'ar' : 'en']);
    setStepValidationError(false);
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
    setStepValidationError(false);
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
    setStepValidationError(false);
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
    setSelectedVoice(preset.voice);
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

  const handleVoiceChange = (voice: NarratorVoice) => {
    setSelectedVoice(voice);
    persistVoice(voice);
  };

  const handleSaveCustomIdentity = async () => {
    const trimmed = customIdentityName.trim() || (ar ? `هويتي (${artStyle})` : `My Identity (${artStyle})`);
    const saved = await saveCustomPreset({
      id: `custom-${Date.now()}`,
      label: { ar: trimmed, en: trimmed },
      desc: { ar: `${artStyle} · ${dialect}`, en: `${artStyle} · ${dialect}` },
      artStyle,
      voice: selectedVoice,
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
      prev.includes(charId) ? prev.filter((id) => id !== charId) : [...prev, charId].slice(0, 4)
    );
  };

  const handleQuickAddCharacter = async () => {
    const trimmedName = newCharName.trim();
    if (!trimmedName) return;
    const ageVal = newCharMaturity === 'adult' ? '28 (adult)' : newCharMaturity === 'teen' ? '16 (teen)' : '7 (child)';
    const genderVal =
      newCharMaturity === 'adult'
        ? newCharGender === 'male'
          ? 'Adult Man'
          : 'Adult Woman'
        : newCharMaturity === 'teen'
          ? newCharGender === 'male'
            ? 'Teen Boy'
            : 'Teen Girl'
          : newCharGender === 'male'
            ? 'Child Boy'
            : 'Child Girl';
    const defaultDesc =
      newCharMaturity === 'adult'
        ? newCharGender === 'male'
          ? `Full-grown adult man (28 years old) with mature facial structure, expressive eyes, and stylish dark coat`
          : `Full-grown adult woman (26 years old) with graceful mature features, expressive eyes, and elegant attire`
        : newCharMaturity === 'teen'
          ? `Expressive teenager (16 years old) with modern stylish jacket`
          : `Cheerful young child (7 years old) with bright adventure outfit`;
    const combinedDesc = newCharDesc.trim() ? `${defaultDesc} — ${newCharDesc.trim()}` : defaultDesc;
    const saved = await saveAlbumCharacter({
      name: trimmedName,
      description: combinedDesc,
      personality: newCharDesc.trim() || (ar ? 'شخصية رئيسية مميزة وحضور قوي' : 'Charismatic main character'),
      age: ageVal,
      gender: genderVal,
    });
    const updated = await listAlbumCharacters();
    setAlbumCharacters(updated);
    setSelectedAlbumCharIds((prev) => [saved.id, ...prev.filter((id) => id !== saved.id)].slice(0, 4));
    if (newCharMaturity === 'adult' && ageGroup !== '18+') {
      setAgeGroup('18+');
      setIsTeenDrama(false);
    }
    setNewCharName('');
    setNewCharDesc('');
    setShowAddCharForm(false);
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

  const transitionToStep = (targetStep: WizardStep) => {
    // التحقق من الفكرة (حد أدنى للكلمات) قبل الانتقال من الخطوة 1
    if (wizardStep === 1 && targetStep > 1 && words < minWords) {
      setStepValidationError(true);
      ideaInputRef.current?.focus();
      return;
    }
    setStepValidationError(false);
    const applyChange = () => setWizardStep(targetStep);
    const docWithVT = typeof document !== 'undefined' ? (document as Document & { startViewTransition?: (cb: () => void) => void }) : null;
    if (docWithVT?.startViewTransition) {
      try {
        docWithVT.startViewTransition(applyChange);
        return;
      } catch {
        // fallback below
      }
    }
    applyChange();
  };

  const handleTouchStart = (e: TouchEvent<HTMLFormElement>) => {
    touchStartXRef.current = e.touches[0]?.clientX ?? null;
  };

  const handleTouchEnd = (e: TouchEvent<HTMLFormElement>) => {
    if (showAllSteps || touchStartXRef.current === null) return;
    const endX = e.changedTouches[0]?.clientX ?? touchStartXRef.current;
    const deltaX = endX - touchStartXRef.current;
    touchStartXRef.current = null;
    if (Math.abs(deltaX) < 70) return;
    // في الواجهة العربية RTL: السحب لليمين (deltaX > 0) ينقل للخطوة التالية، ولليسار للسابقة
    const isNextSwipe = ar ? deltaX > 0 : deltaX < 0;
    if (isNextSwipe && wizardStep < 3) {
      transitionToStep((wizardStep + 1) as WizardStep);
    } else if (!isNextSwipe && wizardStep > 1) {
      transitionToStep((wizardStep - 1) as WizardStep);
    }
  };

  const surprise = () => {
    const pool = SURPRISE_PROMPTS[language];
    setIdea(pool[Math.floor(Math.random() * pool.length)].slice(0, MAX_IDEA_LENGTH));
    setStepValidationError(false);
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!showAllSteps && wizardStep < 3) {
      transitionToStep((wizardStep + 1) as WizardStep);
      return;
    }
    if (!canSubmit) {
      setStepValidationError(true);
      if (wizardStep !== 1) setWizardStep(1);
      return;
    }
    clearStoryDraft();
    const chosenAlbumChars = albumCharacters.filter((c) => selectedAlbumCharIds.includes(c.id));
    const hasAdultAlbumChar = chosenAlbumChars.some((c) => /adult|18\+|2\d|3\d|بالغ|كبير|رجل|امرأة/i.test(`${c.age} ${c.gender} ${c.description}`));
    const isAdultStoryMode = audienceLevel === 'adults' || ageGroup === '18+' || hero?.ageStage === 'adult' || hasAdultAlbumChar;
    const effectiveAudienceLevel: AudienceLevel = isAdultStoryMode ? 'adults' : 'kids';
    const resolvedStyleConsistency = resolveStyleConsistencyKeywords(artStyle, styleConsistency);
    const params: StoryParams = {
      idea,
      language,
      dialect: ar ? dialect : undefined,
      ageGroup: isAdultStoryMode ? '18+' : ageGroup,
      audienceLevel: effectiveAudienceLevel,
      storyType,
      length,
      artStyle,
      styleConsistency: resolvedStyleConsistency,
      aspectRatio,
      heroName: series?.heroName ?? hero?.name,
      heroPhotoId: series?.heroPhotoId ?? hero?.photoId,
      heroAgeStage: hero?.ageStage ?? (isAdultStoryMode ? 'adult' : ageGroup === '13-18' ? 'teen' : 'child'),
      adultMode: isAdultStoryMode,
      series: series ?? undefined,
      coverFontStyle,
      coverTextEffect,
      fruitFantasy: isFruitFantasy,
      customCharacters: chosenAlbumChars.length > 0 ? chosenAlbumChars : undefined,
    };
    onSubmit(params, pageCount);
  };

  const hintCls = 'mt-1.5 flex items-start gap-1.5 text-xs text-ink/60 dark:text-moonlight/60';
  const currentStyleLabel = ART_STYLE_OPTIONS.find((s) => s.value === artStyle)?.labelAr ?? artStyle;
  const currentDialectLabel = DIALECT_OPTIONS.find((d) => d.value === dialect)?.label ?? dialect;
  const currentVoiceLabel = VOICE_OPTIONS.find((v) => v.value === selectedVoice)?.label[ar ? 'ar' : 'en'] ?? selectedVoice;
  const allStoryTypes = [...PRIMARY_STORY_TYPES, ...EXTRA_STORY_TYPES];
  const currentStoryTypeObj = allStoryTypes.find((t) => t.value === storyType);
  const currentStoryTypeLabel = currentStoryTypeObj ? (ar ? currentStoryTypeObj.label.ar : currentStoryTypeObj.label.en) : storyType;
  const currentPresetObj = allPresets.find((p) => p.id === presetId);
  const currentPresetLabel = currentPresetObj ? (ar ? currentPresetObj.label.ar : currentPresetObj.label.en) : presetId;
  const currentFontObj = COVER_FONT_OPTIONS.find((f) => f.value === coverFontStyle);
  const currentFontLabel = currentFontObj ? (ar ? currentFontObj.label.ar : currentFontObj.label.en) : coverFontStyle;

  // البند 2: أسماء الخطوات في الشريط العلوي قصيرة («الفكرة»، «الشكل»، «التفاصيل») مع الرقم في دائرة ولا تُقصّ
  const STEPS: { id: WizardStep; title: { ar: string; en: string } }[] = [
    { id: 1, title: { ar: 'الفكرة', en: 'Idea' } },
    { id: 2, title: { ar: 'الشكل', en: 'Style' } },
    { id: 3, title: { ar: 'التفاصيل', en: 'Details' } },
  ];

  const liveCoverTitle = idea.trim()
    ? idea.trim().split(/\s+/).slice(0, 7).join(' ')
    : ar
      ? 'حكاية النجوم في بستان الأحلام'
      : 'The Secret of the Starlit Orchard';

  return (
    <form
      onSubmit={handleSubmit}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      className="space-y-4"
      dir={ar ? 'rtl' : 'ltr'}
    >
      {showOnboarding && <OnboardingModal language={language} onClose={() => setShowOnboarding(false)} />}

      {/* ب1: بطاقة «فكرة اليوم» القابلة للإغلاق في أعلى شاشة الاستوديو (تُختار محلياً بلا أي طلب API) */}
      {!dailyIdeaDismissed && !series && (
        <div
          data-testid="daily-idea-card"
          className="luxury-card relative overflow-hidden border border-lantern/40 bg-gradient-to-r from-lantern/15 via-white/80 to-dream/10 p-3 sm:p-4 dark:from-lantern/10 dark:via-white/[0.04] dark:to-dream/10"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="inline-flex items-center gap-1 rounded-full bg-lantern px-2.5 py-0.5 text-[11px] font-extrabold text-ink shadow-2xs">
                  <Sparkles size={12} aria-hidden />
                  <span>{ar ? 'فكرة اليوم' : 'Idea of the Day'}</span>
                </span>
                <span className="rounded-full border border-lantern/35 bg-lantern/10 px-2 py-0.5 text-[11px] font-bold text-ink dark:text-amber-200">
                  {ar ? currentDailyIdea.title.ar : currentDailyIdea.title.en}
                </span>
                <span className="rounded-md bg-dream/15 px-2 py-0.5 text-[10px] font-bold text-ink/75 dark:text-moonlight/80">
                  {dailyIdeaGenreLabel}
                </span>
              </div>
              <p className="text-xs sm:text-sm font-medium leading-relaxed text-ink/90 dark:text-moonlight/90">
                {ar ? currentDailyIdea.idea.ar : currentDailyIdea.idea.en}
              </p>
            </div>
            <button
              type="button"
              onClick={handleDismissDailyIdea}
              className="flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-xl text-ink/55 transition hover:bg-black/5 hover:text-coral dark:text-moonlight/60 dark:hover:bg-white/10"
              aria-label={ar ? 'إغلاق فكرة اليوم' : 'Dismiss daily idea'}
              title={ar ? 'إغلاق لليوم' : 'Dismiss for today'}
            >
              <X size={16} aria-hidden />
            </button>
          </div>

          <div className="mt-2.5 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleApplyDailyIdea}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-lantern px-3.5 py-1.5 text-xs font-extrabold text-ink shadow-2xs transition hover:brightness-105 active:scale-95"
            >
              <Wand2 size={14} aria-hidden />
              <span>{ar ? 'ابدأ بهذه الفكرة' : 'Start with this idea'}</span>
            </button>
            <button
              type="button"
              onClick={() => setDailyIdeaOffset((prev) => prev + 1)}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-dream/35 bg-white/75 px-3.5 py-1.5 text-xs font-bold text-ink transition hover:border-lantern active:scale-95 dark:border-white/15 dark:bg-white/5 dark:text-moonlight"
            >
              <Sparkles size={13} className="text-lantern" aria-hidden />
              <span>{ar ? 'فكرة أخرى' : 'Another idea'}</span>
            </button>
          </div>
        </div>
      )}

      {/* شريط معالج الاستوديو العلوي من 3 خطوات («الفكرة»، «الشكل»، «التفاصيل») */}
      <div className="luxury-card p-3 sm:p-4 space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <span className="font-display text-xs sm:text-sm font-extrabold text-ink dark:text-moonlight">
            {ar ? 'معالج صناعة القصة' : 'Story Studio Wizard'}
          </span>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setShowAllSteps((v) => !v)}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-dream/30 bg-white/70 px-2.5 text-xs font-bold text-ink transition hover:border-lantern dark:border-white/15 dark:bg-white/5 dark:text-moonlight"
            >
              <Layers size={14} className="text-lantern" aria-hidden />
              <span>{showAllSteps ? (ar ? 'وضع الخطوات' : 'Steps') : (ar ? 'كل الخيارات' : 'All')}</span>
            </button>
            <button
              type="button"
              onClick={() => setShowOnboarding(true)}
              className="inline-flex min-h-11 min-w-11 items-center justify-center gap-1.5 rounded-xl border border-dream/30 bg-white/70 px-2.5 text-xs font-bold text-ink transition hover:border-lantern dark:border-white/15 dark:bg-white/5 dark:text-moonlight"
              aria-label={ar ? 'دليل استخدام الاستوديو' : 'Studio guide'}
            >
              <HelpCircle size={15} className="text-lantern" aria-hidden />
              <span className="hidden sm:inline">{ar ? 'كيف يعمل؟' : 'Guide'}</span>
            </button>
          </div>
        </div>

        {!showAllSteps && (
          <div className="grid grid-cols-3 gap-2" role="tablist" aria-label={ar ? 'خطوات إعداد القصة' : 'Story setup steps'}>
            {STEPS.map((st) => {
              const active = wizardStep === st.id;
              const completed = st.id === 1 ? words >= minWords && wizardStep > 1 : st.id < wizardStep;
              return (
                <button
                  key={st.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => transitionToStep(st.id)}
                  className={`flex min-h-11 items-center justify-center gap-2 rounded-2xl border px-2 py-2 transition-transform active:scale-98 ${
                    active
                      ? 'border-lantern bg-lantern text-ink shadow-xs'
                      : completed
                        ? 'border-lantern/45 bg-lantern/15 text-ink dark:text-moonlight'
                        : 'border-dream/25 bg-white/65 text-ink/80 hover:border-lantern/40 dark:border-white/10 dark:bg-white/5 dark:text-moonlight/80'
                  }`}
                >
                  <span
                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full font-mono text-xs font-extrabold ${
                      active
                        ? 'bg-ink text-lantern'
                        : completed
                          ? 'bg-emerald-600 text-white'
                          : 'bg-lantern/20 text-ink dark:text-amber-200'
                    }`}
                  >
                    {completed ? <Check size={13} aria-hidden /> : st.id}
                  </span>
                  <span className="font-display text-xs sm:text-sm font-extrabold whitespace-nowrap">
                    {ar ? st.title.ar : st.title.en}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* استعادة المسودة السابقة المحفوظة بدون إنترنت */}
      {availableDraft && (
        <div className="flex flex-wrap items-center justify-between gap-2.5 rounded-2xl border border-dream/40 bg-dream/10 p-3 text-xs">
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
              className="min-h-11 rounded-full bg-lantern px-4 py-1.5 font-bold text-ink shadow-xs transition hover:brightness-105 active:scale-95"
            >
              {ar ? 'استعادة المسودة' : 'Restore'}
            </button>
            <button
              type="button"
              onClick={() => {
                clearStoryDraft();
                setAvailableDraft(null);
              }}
              className="flex min-h-11 min-w-11 items-center justify-center rounded-xl text-ink/55 hover:text-coral dark:text-moonlight/55"
              title={ar ? 'تجاهل' : 'Dismiss'}
              aria-label={ar ? 'تجاهل المسودة' : 'Dismiss draft'}
            >
              <X size={15} />
            </button>
          </div>
        </div>
      )}

      {series && (
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-lantern/40 bg-lantern/10 px-4 py-3 text-sm">
          <span className="font-display font-bold text-ink dark:text-moonlight">
            {ar ? `الجزء ${series.partNumber} من «${series.seriesTitle}»` : `Part ${series.partNumber} of “${series.seriesTitle}”`}
            <span className="block text-xs font-medium text-ink/60 dark:text-moonlight/60">
              {ar ? 'نفس الشخصيات والأسلوب، اكتب فكرة المغامرة الجديدة.' : 'Same characters and style — write the new adventure idea.'}
            </span>
          </span>
          {onCancelSeries && (
            <button
              type="button"
              onClick={onCancelSeries}
              className="min-h-11 shrink-0 rounded-full border border-dream/30 px-4 text-xs font-semibold text-ink dark:text-moonlight"
            >
              {ar ? 'إلغاء' : 'Cancel'}
            </button>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          الخطوة 1: «الفكرة»
          1) حقل الفكرة أول عنصر بعد شريط الخطوات (قبل الهوية والقوالب)
          2) الطفل البطل (HeroPicker + ألبوم الشخصيات)
          3) صف «أوضاع خاصة» مضغوط (القوالب، دراما المراهقين، فواكه الفانتازيا)
         ═══════════════════════════════════════════════════════════════════ */}
      {(wizardStep === 1 || showAllSteps) && (
        <div className="space-y-4 animate-[fadeUp_220ms_ease-out]">
          {/* 1. حقل الفكرة والإلهام (أول عنصر بعد شريط الخطوات) */}
          <div className="luxury-card p-4 sm:p-5 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label className="font-display text-sm sm:text-base font-extrabold text-ink dark:text-moonlight flex items-center gap-2" htmlFor="idea">
                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-lantern/20 text-sm text-lantern">
                  <PenTool size={15} />
                </span>
                <span>{ar ? 'فكرة القصة وأحداثها' : 'Story Idea & Plot'}</span>
              </label>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setShowVoiceModal(true)}
                  className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-dream/35 bg-dream/10 px-3 py-1.5 text-xs font-bold text-ink transition hover:border-lantern hover:bg-dream/20 active:scale-95 dark:text-moonlight"
                  title={ar ? 'تسجيل فكرة القصة بصوتك وتفريغها تلقائياً' : 'Speak your story idea with smart voice dictation'}
                >
                  <Mic size={14} className="text-lantern" />
                  <span>{ar ? 'إملاء صوتي' : 'Voice'}</span>
                </button>
                <button
                  type="button"
                  onClick={surprise}
                  className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-lantern/40 bg-lantern/15 px-3 py-1.5 text-xs font-bold text-ink transition hover:bg-lantern/25 active:scale-95 dark:text-amber-200"
                >
                  <Sparkles size={14} aria-hidden className="text-lantern" />
                  <span>{ar ? 'فاجئني بفكرة' : 'Surprise Me'}</span>
                </button>
              </div>
            </div>

            {/* مستوى الجمهور (Audience Level: Kids / Adults) + شريط الفئة العمرية */}
            <div className="space-y-2 rounded-2xl border border-dream/25 bg-dream/5 p-3 dark:border-white/10 dark:bg-white/[0.03]">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label
                  htmlFor="audienceLevelSelect"
                  className="font-display text-xs sm:text-sm font-extrabold text-ink dark:text-moonlight flex items-center gap-1.5"
                >
                  <Users size={15} className="text-lantern shrink-0" aria-hidden />
                  <span>{ar ? 'مستوى الجمهور (Audience Level):' : 'Audience Level (Kids / Adults):'}</span>
                </label>

                <div className="flex flex-wrap items-center gap-2">
                  <div
                    className="inline-flex rounded-xl border border-dream/30 bg-white/85 p-1 dark:border-white/15 dark:bg-white/10"
                    role="group"
                    aria-label={ar ? 'مستوى الجمهور' : 'Audience Level'}
                  >
                    <button
                      type="button"
                      data-testid="audience-kids-btn"
                      onClick={() => {
                        setAudienceLevel('kids');
                        if (ageGroup === '18+') setAgeGroup('7-9');
                      }}
                      className={`min-h-11 rounded-lg px-3.5 py-1.5 text-xs font-extrabold transition ${
                        audienceLevel === 'kids' && ageGroup !== '18+'
                          ? 'bg-lantern text-ink shadow-2xs'
                          : 'text-ink hover:bg-lantern/15 dark:text-moonlight'
                      }`}
                    >
                      {ar ? 'أطفال (Kids)' : 'Kids'}
                    </button>
                    <button
                      type="button"
                      data-testid="adult-story-mode-btn"
                      onClick={() => {
                        setAudienceLevel('adults');
                        setAgeGroup('18+');
                        setIsTeenDrama(false);
                      }}
                      className={`min-h-11 rounded-lg px-3.5 py-1.5 text-xs font-extrabold transition ${
                        audienceLevel === 'adults' || ageGroup === '18+'
                          ? 'bg-lantern text-ink shadow-2xs'
                          : 'text-ink hover:bg-lantern/15 dark:text-moonlight'
                      }`}
                    >
                      {ar ? 'بالغين / للكبار (Adults 18+)' : 'Adults (18+)'}
                    </button>
                  </div>

                  <select
                    id="audienceLevelSelect"
                    data-testid="audience-level-select"
                    value={audienceLevel === 'adults' || ageGroup === '18+' ? 'adults' : 'kids'}
                    onChange={(e) => {
                      const nextLevel = e.target.value === 'adults' ? 'adults' : 'kids';
                      setAudienceLevel(nextLevel);
                      if (nextLevel === 'adults') {
                        setAgeGroup('18+');
                        setIsTeenDrama(false);
                      } else if (ageGroup === '18+') {
                        setAgeGroup('7-9');
                      }
                    }}
                    aria-label={ar ? 'اختيار مستوى الجمهور' : 'Select Audience Level'}
                    className="min-h-11 rounded-xl border border-dream/35 bg-white px-3 py-1.5 text-xs font-extrabold text-ink outline-none focus:border-lantern dark:border-white/15 dark:bg-black/40 dark:text-moonlight"
                  >
                    <option value="kids">{ar ? 'أطفال ويافعين (Kids)' : 'Kids (Children)'}</option>
                    <option value="adults">{ar ? 'بالغين / قصة للكبار (Adults)' : 'Adults (Mature 18+)'}</option>
                  </select>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-dream/15 pt-2 dark:border-white/10">
                <span className="text-[11px] font-bold text-ink/75 dark:text-moonlight/80">
                  {audienceLevel === 'adults' || ageGroup === '18+'
                    ? ar
                      ? 'وضع الكبار مفعّل: حبكة عميقة، لغة أدبية راقية، ورسم شخصيات بالغة ناضجة بدقة سينمائية.'
                      : 'Adults mode active: sophisticated literary tone, complex plot, and full-grown adult character proportions.'
                    : ar
                      ? 'وضع الأطفال مفعّل: سرد قصصي دافئ ومشوق يناسب الفئة العمرية المختارة.'
                      : 'Kids mode active: warm, imaginative storytelling tailored to the selected age group.'}
                </span>
                <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label={ar ? 'الفئة العمرية السريعة' : 'Quick age group'}>
                  <button
                    type="button"
                    onClick={() => {
                      setAudienceLevel('kids');
                      if (ageGroup === '18+' || ageGroup === '13-18') setAgeGroup('7-9');
                      setIsTeenDrama(false);
                    }}
                    className={`min-h-11 rounded-xl px-3 py-1 text-xs font-extrabold transition ${
                      ageGroup !== '13-18' && ageGroup !== '18+'
                        ? 'bg-lantern text-ink shadow-2xs'
                        : 'border border-ink/15 bg-white/80 text-ink hover:border-lantern dark:border-white/15 dark:bg-white/10 dark:text-moonlight'
                    }`}
                  >
                    {ar ? 'أطفال (3-12)' : 'Kids (3-12)'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAudienceLevel('kids');
                      setAgeGroup('13-18');
                      setIsTeenDrama(true);
                    }}
                    className={`min-h-11 rounded-xl px-3 py-1 text-xs font-extrabold transition ${
                      ageGroup === '13-18'
                        ? 'bg-lantern text-ink shadow-2xs'
                        : 'border border-ink/15 bg-white/80 text-ink hover:border-lantern dark:border-white/15 dark:bg-white/10 dark:text-moonlight'
                    }`}
                  >
                    {ar ? 'يافعين (13-18)' : 'Teens (13-18)'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAudienceLevel('adults');
                      setAgeGroup('18+');
                      setIsTeenDrama(false);
                    }}
                    className={`min-h-11 rounded-xl px-3 py-1 text-xs font-extrabold transition ${
                      ageGroup === '18+'
                        ? 'bg-lantern text-ink shadow-2xs ring-2 ring-lantern/50'
                        : 'border border-ink/15 bg-white/80 text-ink hover:border-lantern dark:border-white/15 dark:bg-white/10 dark:text-moonlight'
                    }`}
                  >
                    {ar ? 'للكبار (18+)' : 'Adults (18+)'}
                  </button>
                </div>
              </div>
            </div>

            <textarea
              ref={ideaInputRef}
              id="idea"
              value={idea}
              onChange={(e) => {
                setIdea(e.target.value.slice(0, MAX_IDEA_LENGTH));
                if (stepValidationError) setStepValidationError(false);
              }}
              rows={3}
              placeholder={
                ageGroup === '18+'
                  ? ar
                    ? 'اكتب فكرة قصتك للكبار أو عن شخص كبير تعرفه (مثال: شاب طموح يخوض رحلة غامضة في مدينة قديمة...)'
                    : 'Write your adult story idea or about an adult character you know...'
                  : ar
                    ? 'أرنب صغير شجاع يكتشف سر النجوم المضيئة في البستان...'
                    : 'A brave little rabbit who discovers the secret of glowing stars...'
              }
              aria-invalid={tooShort || stepValidationError}
              className={`w-full rounded-2xl border bg-white/90 px-3.5 py-2.5 text-sm sm:text-base leading-relaxed text-ink outline-none transition focus:ring-2 dark:bg-white/[0.06] dark:text-moonlight resize-none ${
                tooShort || stepValidationError
                  ? 'border-coral focus:border-coral focus:ring-coral/30'
                  : 'border-dream/30 focus:border-lantern focus:ring-lantern/30 dark:border-white/15'
              }`}
            />

            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <span
                className={
                  words === 0
                    ? stepValidationError
                      ? 'font-bold text-coral'
                      : 'font-medium text-ink/65 dark:text-moonlight/65'
                    : tooShort
                      ? 'font-bold text-coral'
                      : 'font-bold text-emerald-700 dark:text-emerald-400'
                }
              >
                {words === 0
                  ? ar
                    ? `اكتب فكرتك (${minWords} كلمات على الأقل للانتقال للخطوة التالية)`
                    : `Write your idea (at least ${minWords} words to continue)`
                  : tooShort
                    ? ar
                      ? `أضف تفاصيل أكثر: ${words} من ${minWords} كلمات على الأقل`
                      : `Add more detail: ${words} of at least ${minWords} words`
                    : ar
                      ? `عدد الكلمات ممتاز (${words} كلمة)`
                      : `Great detail (${words} words)`}
              </span>
              <span className="font-mono text-[11px] text-ink/60 dark:text-moonlight/60">
                {idea.length}/{MAX_IDEA_LENGTH}
              </span>
            </div>

            {/* ب2: زر «حسّن فكرتي» + زر التراجع + حالات التحميل والفشل وعدم الاتصال والبطاقات الـ3 */}
            <div className="space-y-2.5 pt-1">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    data-testid="improve-idea-btn"
                    disabled={words < 3 || improvingIdea || cooldownActive || disabled}
                    onClick={handleImproveIdea}
                    className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-lantern/50 bg-lantern/15 px-3.5 py-2 text-xs font-extrabold text-ink shadow-2xs transition-opacity hover:bg-lantern/25 disabled:cursor-not-allowed disabled:opacity-50 dark:text-amber-200"
                  >
                    <Wand2 size={14} className="text-lantern shrink-0" aria-hidden />
                    <span>{ar ? 'حسّن فكرتي' : 'Improve my idea'}</span>
                  </button>

                  {originalIdeaBeforeImprove !== null && (
                    <button
                      type="button"
                      data-testid="undo-improve-idea-btn"
                      onClick={handleUndoImprovedIdea}
                      className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-dream/35 bg-white/75 px-3 py-2 text-xs font-bold text-ink transition-opacity hover:border-lantern dark:border-white/15 dark:bg-white/10 dark:text-moonlight"
                    >
                      <RotateCcw size={13} className="text-lantern shrink-0" aria-hidden />
                      <span>{ar ? 'تراجع للنص الأصلي' : 'Undo to original'}</span>
                    </button>
                  )}
                </div>

                {words < 3 && (
                  <span className="text-[11px] font-semibold text-ink/65 dark:text-moonlight/70">
                    {ar ? 'يُفعَّل بعد كتابة 3 كلمات على الأقل' : 'Enabled after at least 3 words'}
                  </span>
                )}
              </div>

              {/* حالة التحميل: 3 بطاقات Skeleton تحترم prefers-reduced-motion */}
              {improvingIdea && (
                <div
                  role="status"
                  aria-live="polite"
                  className="grid grid-cols-1 gap-2 sm:grid-cols-3"
                >
                  {[0, 1, 2].map((idx) => (
                    <div
                      key={idx}
                      className="space-y-2 rounded-2xl border border-lantern/30 bg-white/70 p-3 dark:border-white/10 dark:bg-white/5"
                    >
                      <div className="h-3.5 w-24 animate-pulse motion-reduce:animate-none rounded-md bg-lantern/30" />
                      <div className="h-3 w-full animate-pulse motion-reduce:animate-none rounded-md bg-dream/20" />
                      <div className="h-3 w-5/6 animate-pulse motion-reduce:animate-none rounded-md bg-dream/20" />
                      <div className="h-3 w-4/6 animate-pulse motion-reduce:animate-none rounded-md bg-dream/20" />
                    </div>
                  ))}
                </div>
              )}

              {/* حالة الفشل أو عدم الاتصال */}
              {!improvingIdea && improveError && (
                <div
                  role="alert"
                  className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-coral/40 bg-coral/10 px-3.5 py-2.5 text-xs font-bold text-ink dark:text-moonlight"
                >
                  <div className="flex items-center gap-2">
                    {improveOffline ? (
                      <WifiOff size={15} className="text-coral shrink-0" aria-hidden />
                    ) : (
                      <AlertTriangle size={15} className="text-coral shrink-0" aria-hidden />
                    )}
                    <span>{improveError}</span>
                  </div>
                  <button
                    type="button"
                    disabled={cooldownActive}
                    onClick={handleImproveIdea}
                    className="inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-lantern px-3 py-1.5 text-xs font-extrabold text-ink transition-opacity hover:opacity-95 disabled:opacity-50"
                  >
                    <RefreshCw size={13} aria-hidden />
                    <span>{ar ? 'إعادة المحاولة' : 'Retry'}</span>
                  </button>
                </div>
              )}

              {/* البطاقات الـ3 للصياغات المحسّنة */}
              {!improvingIdea && improvedIdeas.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-display text-xs font-extrabold text-ink dark:text-amber-200">
                      {ar ? 'اختر إحدى الصياغات المحسّنة لاستبدال فكرتك:' : 'Pick an improved version to replace your idea:'}
                    </span>
                    <button
                      type="button"
                      onClick={() => setImprovedIdeas([])}
                      className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl text-ink/60 hover:text-ink dark:text-moonlight/60 dark:hover:text-moonlight"
                      aria-label={ar ? 'إخفاء الاقتراحات' : 'Hide suggestions'}
                    >
                      <X size={14} aria-hidden />
                    </button>
                  </div>
                  <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
                    {improvedIdeas.map((suggestion, idx) => {
                      const isSelected = idea.trim() === suggestion.trim();
                      return (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => handleSelectImprovedIdea(suggestion)}
                          className={`flex min-h-11 flex-col justify-between gap-2 rounded-2xl border p-3 text-start transition-opacity ${
                            isSelected
                              ? 'border-lantern bg-lantern/15 shadow-xs'
                              : 'border-dream/30 bg-white/80 hover:border-lantern/60 dark:border-white/15 dark:bg-white/5'
                          }`}
                        >
                          <p className="text-xs leading-relaxed text-ink dark:text-moonlight">{suggestion}</p>
                          <div className="flex items-center justify-between gap-2 border-t border-dream/15 pt-1.5 text-[11px] font-extrabold text-ink/75 dark:border-white/10 dark:text-amber-200">
                            <span>
                              {ar ? `صياغة ${idx + 1}` : `Option ${idx + 1}`} ({suggestion.split(/\s+/).filter(Boolean).length}{' '}
                              {ar ? 'كلمة' : 'words'})
                            </span>
                            <span className="inline-flex items-center gap-1 text-lantern">
                              {isSelected ? <Check size={13} aria-hidden /> : <Sparkles size={12} aria-hidden />}
                              <span>{isSelected ? (ar ? 'مُختارة' : 'Selected') : ar ? 'استخدم هذه' : 'Use this'}</span>
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            <p className={hintCls}>
              <Lightbulb size={14} aria-hidden className="mt-0.5 shrink-0 text-lantern" />
              <span>{SMART_TIPS[language][ageGroup]}</span>
            </p>
          </div>

          {/* 2. البطل (طفل أو شخص كبير) + بناء شخصيات القصة المخصصة */}
          {!series && (
            <HeroPicker
              ar={ar}
              selectedId={hero?.id ?? null}
              onSelect={(selectedHero) => {
                setHero(selectedHero);
                if (selectedHero?.ageStage === 'adult') {
                  setAgeGroup('18+');
                  setIsTeenDrama(false);
                } else if (selectedHero?.ageStage === 'teen') {
                  setAgeGroup('13-18');
                }
              }}
            />
          )}

          {!series && (
            <div className="luxury-card p-3.5 sm:p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <span className="font-display text-xs sm:text-sm font-extrabold text-ink dark:text-moonlight flex items-center gap-1.5">
                    <Users size={15} className="text-lantern" />
                    <span>{ar ? 'شخصيات القصة (أضف شخصاً كبيراً أو طفلاً بالاسم والملامح)' : 'Story Characters (Add Adult or Child Characters)'}</span>
                  </span>
                  <p className="text-[11px] text-ink/65 dark:text-moonlight/70">
                    {ar
                      ? 'حدد أبطال قصتك وأعمارهم (شخص كبير بالغ، شاب، أو طفل) ليتم رسمهم بدقة وثبات في جميع الصفحات.'
                      : 'Define your characters and their maturity (adult, teen, or child) for accurate illustrations on every page.'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowAddCharForm((v) => !v)}
                  className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-xl bg-lantern px-3.5 py-1.5 text-xs font-extrabold text-ink shadow-2xs transition hover:brightness-105 active:scale-95"
                >
                  <BookmarkPlus size={14} aria-hidden />
                  <span>{showAddCharForm ? (ar ? 'إغلاق' : 'Close') : ar ? '+ أضف شخصية للقصة' : '+ Add Character'}</span>
                </button>
              </div>

              {showAddCharForm && (
                <div className="space-y-2.5 rounded-2xl border border-lantern/40 bg-lantern/10 p-3 dark:bg-white/5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <input
                      type="text"
                      value={newCharName}
                      onChange={(e) => setNewCharName(e.target.value.slice(0, 40))}
                      placeholder={ar ? 'اسم الشخصية (مثال: طارق، ليلى...)' : 'Character name (e.g., Tariq, Layla)'}
                      className="min-h-11 rounded-xl border border-dream/35 bg-white px-3 text-xs sm:text-sm font-bold text-ink outline-none focus:border-lantern dark:border-white/15 dark:bg-black/30 dark:text-moonlight"
                    />
                    <input
                      type="text"
                      value={newCharDesc}
                      onChange={(e) => setNewCharDesc(e.target.value.slice(0, 180))}
                      placeholder={ar ? 'الملامح واللباس والدور (مثال: مهندس بلحية خفيفة ومعطف كحلي)' : 'Appearance, outfit & role (e.g., bearded architect in navy coat)'}
                      className="min-h-11 rounded-xl border border-dream/35 bg-white px-3 text-xs sm:text-sm text-ink outline-none focus:border-lantern dark:border-white/15 dark:bg-black/30 dark:text-moonlight"
                    />
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {(
                        [
                          { id: 'adult', ar: 'شخص كبير / بالغ (18+)', en: 'Adult (18+)' },
                          { id: 'teen', ar: 'شاب / شابة (13-18)', en: 'Teen (13-18)' },
                          { id: 'child', ar: 'طفل / طفلة', en: 'Child' },
                        ] as const
                      ).map((m) => (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => setNewCharMaturity(m.id)}
                          className={`min-h-9 rounded-xl px-2.5 py-1 text-xs font-extrabold transition ${
                            newCharMaturity === m.id
                              ? 'bg-ink text-paper dark:bg-lantern dark:text-ink'
                              : 'border border-ink/20 bg-white/85 text-ink dark:border-white/15 dark:bg-white/10 dark:text-moonlight'
                          }`}
                        >
                          {ar ? m.ar : m.en}
                        </button>
                      ))}
                      {(
                        [
                          { id: 'male', ar: 'ذكر', en: 'Male' },
                          { id: 'female', ar: 'أنثى', en: 'Female' },
                        ] as const
                      ).map((g) => (
                        <button
                          key={g.id}
                          type="button"
                          onClick={() => setNewCharGender(g.id)}
                          className={`min-h-9 rounded-xl px-2.5 py-1 text-xs font-extrabold transition ${
                            newCharGender === g.id
                              ? 'bg-lantern text-ink'
                              : 'border border-ink/20 bg-white/85 text-ink dark:border-white/15 dark:bg-white/10 dark:text-moonlight'
                          }`}
                        >
                          {ar ? g.ar : g.en}
                        </button>
                      ))}
                    </div>
                    <button
                      type="button"
                      disabled={!newCharName.trim()}
                      onClick={handleQuickAddCharacter}
                      className="inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-lantern px-4 py-1.5 text-xs font-extrabold text-ink shadow-2xs disabled:opacity-40"
                    >
                      <Check size={14} aria-hidden />
                      <span>{ar ? 'حفظ وإدراج في القصة' : 'Save & Include'}</span>
                    </button>
                  </div>
                </div>
              )}

              {albumCharacters.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {albumCharacters.map((c) => {
                    const selected = selectedAlbumCharIds.includes(c.id);
                    const isAdultChar = /adult|18\+|2\d|3\d|بالغ|كبير/i.test(`${c.age} ${c.gender}`);
                    return (
                      <div
                        key={c.id}
                        className={`flex items-center justify-between gap-2 rounded-2xl border p-2.5 transition ${
                          selected
                            ? 'border-lantern bg-lantern/15 shadow-xs'
                            : 'border-dream/25 bg-white/60 dark:border-white/10 dark:bg-white/5'
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => toggleAlbumCharacter(c.id)}
                          className="flex min-h-11 flex-1 items-center gap-2 text-start"
                        >
                          <span
                            className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs font-bold ${
                              selected ? 'border-lantern bg-lantern text-ink' : 'border-dream/40 text-ink/60 dark:text-moonlight/60'
                            }`}
                          >
                            {selected ? <Check size={14} /> : c.name.slice(0, 1)}
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5">
                              <p className="font-display text-xs font-extrabold text-ink dark:text-moonlight truncate">{c.name}</p>
                              <span className="rounded-md bg-ink/10 px-1.5 py-0.5 text-[10px] font-bold text-ink dark:bg-white/15 dark:text-moonlight">
                                {isAdultChar ? (ar ? 'بالغ 18+' : 'Adult') : c.age}
                              </span>
                            </div>
                            <p className="text-[11px] text-ink/60 dark:text-moonlight/60 truncate">{c.personality || c.description}</p>
                          </div>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteAlbumCharacter(c.id)}
                          className="flex min-h-11 min-w-11 items-center justify-center rounded-xl text-ink/45 hover:text-coral dark:text-moonlight/45"
                          aria-label={ar ? 'حذف من الألبوم' : 'Remove from album'}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* 3. صف «أوضاع خاصة» مضغوط (القوالب، دراما المراهقين، فواكه الفانتازيا) */}
          <div className="luxury-card p-3.5 sm:p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <span className="font-display text-xs sm:text-sm font-extrabold text-ink dark:text-moonlight flex items-center gap-1.5">
                <Sparkles size={15} className="text-lantern" aria-hidden />
                <span>{ar ? 'أوضاع خاصة وقوالب جاهزة' : 'Special Modes & Templates'}</span>
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {/* القوالب الجاهزة */}
              <div className="flex items-center justify-between gap-2 rounded-2xl border border-lantern/40 bg-lantern/10 px-3 py-2">
                <div className="min-w-0">
                  <span className="block font-display text-xs font-extrabold text-ink dark:text-moonlight">
                    {ar ? 'القوالب الجاهزة' : 'Story Templates'}
                  </span>
                  <span className="block text-[10px] font-semibold text-ink/70 dark:text-moonlight/75">
                    {ar ? '16 قالباً ثقافياً وتعليمياً' : '16 cultural & learning themes'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowTemplates((v) => !v)}
                  className="inline-flex min-h-11 shrink-0 items-center gap-1 rounded-xl bg-lantern px-3 text-xs font-extrabold text-ink shadow-2xs transition hover:brightness-105 active:scale-95"
                >
                  <Compass size={14} aria-hidden />
                  <span>{showTemplates ? (ar ? 'إخفاء' : 'Hide') : (ar ? 'تصفح' : 'Browse')}</span>
                </button>
              </div>

              {/* دراما المراهقين (YA Drama) - تباين >= 4.5:1 ومفتاح مطفأ بلون محايد فاتح ومنطقة لمس >= 44px */}
              <label className="flex min-h-11 cursor-pointer items-center justify-between gap-2 rounded-2xl border border-rose-500/40 bg-rose-500/10 px-3 py-2 dark:bg-rose-950/35">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="font-display text-xs font-extrabold text-ink dark:text-moonlight">
                      {ar ? 'دراما المراهقين' : 'Teen Drama'}
                    </span>
                    <span className="rounded-md bg-rose-800 px-1.5 py-0.5 text-[10px] font-extrabold text-white">
                      12-18
                    </span>
                  </div>
                  <span className="block text-[10px] font-semibold text-ink/75 dark:text-moonlight/80">
                    {ar ? '4 عوالم وجدانية عميقة' : '4 YA emotional worlds'}
                  </span>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={isTeenDrama}
                  aria-label={ar ? 'تفعيل وضع دراما المراهقين' : 'Toggle Teen Drama mode'}
                  onClick={() => {
                    const next = !isTeenDrama;
                    setIsTeenDrama(next);
                    if (next) {
                      setAgeGroup('13-18');
                      if (!selectedTeenTemplate) {
                        handleSelectTeenTemplate(TEEN_DRAMA_TEMPLATES[0]);
                      }
                    }
                  }}
                  className="inline-flex min-h-11 min-w-12 shrink-0 items-center justify-center rounded-xl px-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-rose-500"
                >
                  <span
                    className={`relative inline-flex h-6 w-11 items-center rounded-full border transition-colors ${
                      isTeenDrama
                        ? 'border-rose-700 bg-rose-600'
                        : 'border-stone-400 bg-stone-200 dark:border-stone-500 dark:bg-stone-300'
                    }`}
                  >
                    <span
                      className={`inline-block h-5 w-5 rounded-full bg-white shadow-xs transition-transform ${
                        isTeenDrama
                          ? ar
                            ? '-translate-x-5'
                            : 'translate-x-5'
                          : 'translate-x-0.5 rtl:-translate-x-0.5'
                      }`}
                    />
                  </span>
                </button>
              </label>

              {/* فواكه الفانتازيا (Fruit Fantasy) - تباين >= 4.5:1 ومفتاح مطفأ بلون محايد فاتح ومنطقة لمس >= 44px */}
              <label className="flex min-h-11 cursor-pointer items-center justify-between gap-2 rounded-2xl border border-amber-500/45 bg-amber-500/10 px-3 py-2 dark:bg-amber-950/35">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="font-display text-xs font-extrabold text-ink dark:text-moonlight">
                      {ar ? 'فواكه الفانتازيا' : 'Fruit Fantasy'}
                    </span>
                    <span className="rounded-md bg-amber-900 px-1.5 py-0.5 text-[10px] font-extrabold text-white">
                      {ar ? 'فانتازيا' : 'Fruit'}
                    </span>
                  </div>
                  <span className="block text-[10px] font-semibold text-ink/75 dark:text-moonlight/80">
                    {ar ? 'أبطال الفواكه المجسدة' : 'Anthropomorphic heroes'}
                  </span>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={isFruitFantasy}
                  aria-label={ar ? 'تفعيل وضع فواكه الفانتازيا' : 'Toggle Fruit Fantasy mode'}
                  onClick={() => {
                    const next = !isFruitFantasy;
                    setIsFruitFantasy(next);
                    if (next && !selectedFruitTemplate) {
                      handleSelectFruitTemplate(FRUIT_FANTASY_TEMPLATES[0]);
                    }
                  }}
                  className="inline-flex min-h-11 min-w-12 shrink-0 items-center justify-center rounded-xl px-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-500"
                >
                  <span
                    className={`relative inline-flex h-6 w-11 items-center rounded-full border transition-colors ${
                      isFruitFantasy
                        ? 'border-amber-700 bg-amber-600'
                        : 'border-stone-400 bg-stone-200 dark:border-stone-500 dark:bg-stone-300'
                    }`}
                  >
                    <span
                      className={`inline-block h-5 w-5 rounded-full bg-white shadow-xs transition-transform ${
                        isFruitFantasy
                          ? ar
                            ? '-translate-x-5'
                            : 'translate-x-5'
                          : 'translate-x-0.5 rtl:-translate-x-0.5'
                      }`}
                    />
                  </span>
                </button>
              </label>
            </div>

            {showTemplates && (
              <BookTemplateBrowser ar={ar} onSelectTemplate={handleApplyTemplate} onClose={() => setShowTemplates(false)} />
            )}

            {isTeenDrama && (
              <div className="pt-2 border-t border-rose-500/20 grid grid-cols-1 sm:grid-cols-2 gap-2">
                {TEEN_DRAMA_TEMPLATES.map((tmpl) => {
                  const active = selectedTeenTemplate === tmpl.id;
                  return (
                    <button
                      key={tmpl.id}
                      type="button"
                      onClick={() => handleSelectTeenTemplate(tmpl)}
                      className={`flex min-h-11 flex-col text-start p-3 rounded-xl border transition-transform active:scale-[0.98] ${
                        active
                          ? 'border-rose-500 bg-rose-500/20 ring-1 ring-rose-500/50 text-ink dark:text-moonlight'
                          : 'border-rose-500/25 bg-white/70 hover:bg-white dark:bg-black/25 dark:hover:bg-black/40 text-ink/85 dark:text-moonlight/85'
                      }`}
                    >
                      <span className="flex items-center gap-1.5 font-bold text-xs text-rose-700 dark:text-rose-300">
                        <TemplateIconSvg name={tmpl.icon} className="w-4 h-4 shrink-0" />
                        <span>{ar ? tmpl.title.ar : tmpl.title.en}</span>
                      </span>
                      <p className="mt-0.5 text-[11px] text-ink/70 dark:text-moonlight/70 line-clamp-1">
                        {ar ? tmpl.tagline.ar : tmpl.tagline.en}
                      </p>
                    </button>
                  );
                })}
              </div>
            )}

            {isFruitFantasy && (
              <div className="pt-2 border-t border-amber-500/20 grid grid-cols-1 sm:grid-cols-2 gap-2">
                {FRUIT_FANTASY_TEMPLATES.map((tmpl) => {
                  const active = selectedFruitTemplate === tmpl.id;
                  return (
                    <button
                      key={tmpl.id}
                      type="button"
                      onClick={() => handleSelectFruitTemplate(tmpl)}
                      className={`flex min-h-11 flex-col text-start p-3 rounded-xl border transition-transform active:scale-[0.98] ${
                        active
                          ? 'border-amber-500 bg-amber-500/20 ring-1 ring-amber-500/50 text-ink dark:text-moonlight'
                          : 'border-amber-500/25 bg-white/70 hover:bg-white dark:bg-black/25 dark:hover:bg-black/40 text-ink/85 dark:text-moonlight/85'
                      }`}
                    >
                      <span className="flex items-center gap-1.5 font-bold text-xs text-amber-800 dark:text-amber-300">
                        <TemplateIconSvg name={tmpl.icon} className="w-4 h-4 shrink-0" />
                        <span>{ar ? tmpl.title.ar : tmpl.title.en}</span>
                      </span>
                      <p className="mt-0.5 text-[11px] text-ink/70 dark:text-moonlight/70 line-clamp-1">
                        {ar ? tmpl.tagline.ar : tmpl.tagline.en}
                      </p>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          الخطوة 2: «الشكل»
          1) الهوية السريعة (مع StyleThumb + الاسم + 3 رموز: راوٍ، لهجة، خط)
          2) نوع القصة (5 ظاهرة + «المزيد»)
          3) الأسلوب الفني (18 أسلوباً بمعاينات StyleThumb SVG)
          4) خط الغلاف وتأثيره مع المعاينة المباشرة الحية للغلاف (تجمع العنوان والأسلوب والخط)
         ═══════════════════════════════════════════════════════════════════ */}
      {(wizardStep === 2 || showAllSteps) && (
        <div className="space-y-4 animate-[fadeUp_220ms_ease-out]">
          {/* 1. الهوية السريعة للقصة */}
          {!series && (
            <div className="luxury-card p-3.5 sm:p-4 space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-display text-xs sm:text-sm font-extrabold text-ink dark:text-moonlight">
                  {ar ? `الهوية السريعة (${allPresets.length} هوية جاهزة)` : `Quick Identity (${allPresets.length} Presets)`}
                </span>
                <button
                  type="button"
                  onClick={() => setShowSaveIdentity((v) => !v)}
                  className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-lantern/45 bg-lantern/15 px-3 py-1 text-xs font-bold text-ink transition hover:bg-lantern/25 active:scale-95 dark:text-amber-200"
                >
                  <BookmarkPlus size={14} className="text-lantern" />
                  <span>{ar ? 'احفظ هويتي' : 'Save Identity'}</span>
                </button>
              </div>

              {showSaveIdentity && (
                <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-lantern/35 bg-lantern/10 p-2">
                  <input
                    type="text"
                    value={customIdentityName}
                    onChange={(e) => setCustomIdentityName(e.target.value.slice(0, 40))}
                    placeholder={ar ? 'اسم الهوية (مثلاً: هويتي المسائية)...' : 'Identity name...'}
                    className="min-h-11 flex-1 rounded-xl border border-dream/30 bg-white/90 px-3 text-xs text-ink outline-none focus:border-lantern dark:border-white/15 dark:bg-black/30 dark:text-moonlight"
                  />
                  <button
                    type="button"
                    onClick={handleSaveCustomIdentity}
                    className="min-h-11 rounded-xl bg-lantern px-4 text-xs font-extrabold text-ink shadow-2xs active:scale-95"
                  >
                    {ar ? 'حفظ' : 'Save'}
                  </button>
                </div>
              )}

              <div
                role="radiogroup"
                aria-label={ar ? 'هوية القصة' : 'Story identity'}
                className="-mx-1 flex snap-x gap-2 overflow-x-auto px-1 pb-1.5 custom-scrollbar"
              >
                {allPresets.map((p) => {
                  const isSelected = presetId === p.id;
                  const presetDialectInfo = DIALECT_OPTIONS.find((d) => d.value === p.dialect);
                  const presetFontInfo = COVER_FONT_OPTIONS.find((f) => f.value === (p.coverFont ?? 'kufi'));
                  const presetVoiceInfo = VOICE_OPTIONS.find((v) => v.value === p.voice);
                  return (
                    <div
                      key={p.id}
                      className={`relative min-w-[11.5rem] shrink-0 snap-start rounded-2xl border p-2.5 text-start transition-transform ${
                        isSelected
                          ? 'border-lantern bg-gradient-to-br from-lantern/25 via-lantern/10 to-transparent shadow-xs ring-1 ring-lantern/40'
                          : 'border-dream/25 bg-white/65 hover:border-lantern/50 dark:border-white/10 dark:bg-white/[0.05]'
                      }`}
                    >
                      <button
                        type="button"
                        role="radio"
                        aria-checked={isSelected}
                        onClick={() => applyPreset(p.id)}
                        className="flex min-h-14 w-full flex-col justify-between gap-2 text-start"
                      >
                        <div className="flex items-center gap-2">
                          <StyleThumb style={p.artStyle} className="h-9 w-12 shrink-0 rounded-lg shadow-2xs" />
                          <span className="font-display text-xs font-extrabold text-ink dark:text-moonlight leading-snug line-clamp-2">
                            {ar ? p.label.ar : p.label.en}
                          </span>
                        </div>
                        {/* 3 رموز صغيرة: أيقونة راوٍ + شارة اللهجة + عيّنة الخط */}
                        <div className="flex items-center justify-between gap-1 border-t border-dream/15 pt-1.5 text-[10px] font-bold text-ink/75 dark:text-moonlight/75">
                          <span className="inline-flex items-center gap-1 truncate">
                            <Volume2 size={11} className="text-lantern shrink-0" aria-hidden />
                            <span className="truncate">{presetVoiceInfo ? (ar ? presetVoiceInfo.label.ar.split(' ')[0] : presetVoiceInfo.value) : p.voice}</span>
                          </span>
                          <DialectBadgeSvg code={presetDialectInfo?.flag ?? 'MSA'} ar={ar} />
                          <span className={`rounded bg-lantern/15 px-1.5 py-0.5 text-[10px] text-ink dark:text-amber-200 ${presetFontInfo?.className ?? ''}`}>
                            {ar ? 'أبجد' : 'Aa'}
                          </span>
                        </div>
                      </button>
                      {p.isCustom && (
                        <button
                          type="button"
                          onClick={() => handleDeleteCustomIdentity(p.id)}
                          className="absolute top-1 end-1 flex min-h-11 min-w-11 items-center justify-center rounded-full text-ink/45 hover:text-coral dark:text-moonlight/45"
                          aria-label={ar ? 'حذف الهوية' : 'Delete preset'}
                        >
                          <X size={13} />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 2. نوع القصة (5 ظاهرة + «المزيد») */}
          <div className="luxury-card p-3.5 sm:p-4 space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <label className="font-display text-xs sm:text-sm font-extrabold text-ink dark:text-moonlight">
                {ar ? 'نوع القصة (16 نوعاً)' : 'Story Genre (16 Types)'}
              </label>
              <button
                type="button"
                onClick={() => setShowMoreStoryTypes((v) => !v)}
                className="inline-flex min-h-11 items-center gap-1 rounded-full border border-dream/35 bg-dream/10 px-3 py-1 text-xs font-bold text-ink transition hover:border-lantern dark:text-moonlight"
              >
                <span>
                  {showMoreStoryTypes
                    ? ar
                      ? 'إخفاء الإضافية'
                      : 'Fewer'
                    : ar
                      ? `المزيد (+${EXTRA_STORY_TYPES.length})`
                      : `More (+${EXTRA_STORY_TYPES.length})`}
                </span>
                {showMoreStoryTypes ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>
            </div>

            <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5">
              {(showMoreStoryTypes ? [...PRIMARY_STORY_TYPES, ...EXTRA_STORY_TYPES] : PRIMARY_STORY_TYPES).map((t) => {
                const active = storyType === t.value;
                return (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => setStoryType(t.value)}
                    aria-pressed={active}
                    className={`flex min-h-12 flex-col items-start justify-center rounded-xl border p-2 text-start transition-transform active:scale-95 ${
                      active
                        ? 'border-lantern bg-lantern/20 text-ink shadow-2xs ring-1 ring-lantern/40 dark:text-moonlight'
                        : 'border-dream/25 bg-white/65 text-ink/80 hover:border-lantern/45 dark:border-white/10 dark:bg-white/5 dark:text-moonlight/85'
                    }`}
                  >
                    <span className="font-display text-xs font-extrabold leading-tight">{ar ? t.label.ar : t.label.en}</span>
                    <span className="mt-0.5 text-[10px] leading-tight text-ink/60 dark:text-moonlight/60 line-clamp-1">
                      {ar ? t.desc.ar : t.desc.en}
                    </span>
                  </button>
                );
              })}
            </div>

            {STORY_TYPE_SPECS[storyType] && (
              <div
                dir={ar ? 'rtl' : 'ltr'}
                className="rounded-xl border border-dream/20 bg-dream/5 px-3 py-1.5 text-[11px] text-ink/75 dark:text-moonlight/75 [unicode-bidi:plaintext]"
              >
                <span className="font-bold text-lantern">{ar ? 'قوس السرد: ' : 'Arc: '}</span>
                <span dir={ar ? 'rtl' : 'ltr'} className="[unicode-bidi:plaintext]">
                  {ar
                    ? `${STORY_TYPE_SPECS[storyType].arc.beginning} ← ${STORY_TYPE_SPECS[storyType].arc.middle} ← ${STORY_TYPE_SPECS[storyType].arc.climax} ← ${STORY_TYPE_SPECS[storyType].arc.ending}`
                    : `${STORY_TYPE_SPECS[storyType].arcEn?.beginning ?? STORY_TYPE_SPECS[storyType].arc.beginning} → ${STORY_TYPE_SPECS[storyType].arcEn?.middle ?? STORY_TYPE_SPECS[storyType].arc.middle} → ${STORY_TYPE_SPECS[storyType].arcEn?.climax ?? STORY_TYPE_SPECS[storyType].arc.climax} → ${STORY_TYPE_SPECS[storyType].arcEn?.ending ?? STORY_TYPE_SPECS[storyType].arc.ending}`}
                </span>
              </div>
            )}
          </div>

          {/* 3. الأسلوب الفني (18 أسلوباً بمعاينات StyleThumb SVG مضغوطة لتناسب موبايل 390px) + قفل ثبات الأسلوب الفني (Style Consistency) */}
          <div className="luxury-card p-3.5 sm:p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <label className="font-display text-xs sm:text-sm font-extrabold text-ink dark:text-moonlight flex items-center gap-1.5">
                <Palette size={15} className="text-lantern" aria-hidden />
                <span>{ar ? 'الأسلوب الفني (18 أسلوباً)' : 'Art Style (18 Styles)'}</span>
              </label>
              <span className="text-xs font-bold text-lantern">{ar ? currentStyleLabel : artStyle}</span>
            </div>

            <div
              role="radiogroup"
              aria-label={ar ? 'الأسلوب الفني' : 'Art style'}
              className="grid grid-cols-3 sm:grid-cols-6 gap-1.5"
            >
              {ART_STYLE_OPTIONS.map((s) => {
                const active = artStyle === s.value;
                return (
                  <button
                    key={s.value}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    disabled={Boolean(series)}
                    onClick={() => setArtStyle(s.value)}
                    className={`flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl border p-1.5 text-center transition-transform active:scale-95 ${
                      active
                        ? 'border-lantern bg-lantern/20 text-ink shadow-2xs ring-2 ring-lantern/45 dark:text-moonlight'
                        : 'border-dream/25 bg-white/65 text-ink/80 hover:border-lantern/45 dark:border-white/10 dark:bg-white/5 dark:text-moonlight/85'
                    }`}
                  >
                    <StyleThumb style={s.value} className="h-8 w-11 shrink-0 rounded-md shadow-2xs" />
                    <span className="font-display text-[10px] font-extrabold leading-tight line-clamp-1">
                      {ar ? s.labelAr : s.value}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* قفل ثبات الأسلوب الفني (Style Consistency Parameter) */}
            <div className="space-y-2 rounded-2xl border border-lantern/35 bg-lantern/10 p-3 dark:bg-white/5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label
                  htmlFor="styleConsistencySelect"
                  className="font-display text-xs font-extrabold text-ink dark:text-moonlight flex items-center gap-1.5"
                >
                  <ShieldCheck size={15} className="text-lantern shrink-0" aria-hidden />
                  <span>{ar ? 'تثبيت الهوية البصرية (Style Consistency):' : 'Style Consistency Lock:'}</span>
                </label>
                <select
                  id="styleConsistencySelect"
                  data-testid="style-consistency-select"
                  value={styleConsistency}
                  onChange={(e) => setStyleConsistency(e.target.value)}
                  className="min-h-11 rounded-xl border border-dream/35 bg-white px-3 py-1.5 text-xs font-extrabold text-ink outline-none focus:border-lantern dark:border-white/15 dark:bg-black/40 dark:text-moonlight"
                >
                  {STYLE_CONSISTENCY_PRESETS.map((preset) => (
                    <option key={preset.id} value={preset.id}>
                      {ar ? preset.label.ar : preset.label.en}
                    </option>
                  ))}
                </select>
              </div>
              <p className="text-[11px] font-medium text-ink/75 dark:text-moonlight/80">
                {ar
                  ? `الكلمات المقفلة لضمان فخامة وثبات الرسم: ${resolveStyleConsistencyKeywords(artStyle, styleConsistency)}`
                  : `Locked theme keywords: ${resolveStyleConsistencyKeywords(artStyle, styleConsistency)}`}
              </p>
            </div>
          </div>

          {/* 4. خط الغلاف وتأثيره مع المعاينة المباشرة للغلاف (تجمع العنوان والأسلوب والخط بـ SVG/CSS) */}
          <div className="luxury-card p-3.5 sm:p-4 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-end">
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

              <div className="space-y-1.5">
                <span className="block font-display text-xs font-extrabold text-ink dark:text-moonlight">
                  {ar ? 'تأثير نص العنوان' : 'Cover Title Effect'}
                </span>
                <div className="grid grid-cols-4 gap-1.5" role="radiogroup" aria-label={ar ? 'تأثير العنوان' : 'Title effect'}>
                  {COVER_EFFECT_OPTIONS.map((ef) => {
                    const active = coverTextEffect === ef.value;
                    return (
                      <button
                        key={ef.value}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        onClick={() => setCoverTextEffect(ef.value)}
                        className={`min-h-11 rounded-xl border px-2 py-1.5 text-xs font-bold transition ${
                          active
                            ? 'border-lantern bg-lantern text-ink shadow-2xs'
                            : 'border-dream/30 bg-white/70 text-ink/80 hover:border-lantern/50 dark:border-white/15 dark:bg-white/5 dark:text-moonlight'
                        }`}
                      >
                        {ar ? ef.label.ar : ef.label.en}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* البند 5: معاينة مباشرة للغلاف تجمع العنوان والأسلوب والخط (SVG/CSS بلا صور خارجية) */}
            <div
              data-testid="live-cover-preview"
              className="relative overflow-hidden rounded-2xl border border-lantern/40 bg-gradient-to-br from-[#1b1533] via-[#261c47] to-[#120e24] p-3.5 text-white shadow-md"
            >
              <div className="flex items-center justify-between gap-2 pb-2 text-[11px] font-bold text-amber-200/90">
                <span className="inline-flex items-center gap-1.5">
                  <Crown size={13} className="text-lantern" aria-hidden />
                  <span>{ar ? 'معاينة حية للغلاف (العنوان + الأسلوب + الخط)' : 'Live Cover Preview (Title + Art Style + Font)'}</span>
                </span>
                <span className="rounded-full border border-lantern/40 bg-lantern/20 px-2 py-0.5 text-[10px] text-amber-200">
                  {ar ? `${currentStyleLabel} · ${currentFontLabel}` : `${artStyle} · ${currentFontLabel}`}
                </span>
              </div>

              <div className="relative flex items-center gap-3 rounded-xl border border-white/15 bg-black/35 p-3">
                {/* الرسم المصغر للأسلوب الفني المختار كإطار كتاب مصور بـ SVG */}
                <div className="relative shrink-0 overflow-hidden rounded-xl border-2 border-lantern/50 shadow-md">
                  <StyleThumb style={artStyle} className="h-20 w-24 sm:h-24 sm:w-28" />
                </div>

                {/* العنوان الحي بالخط والتأثير المختارين مع شارات النوع والبطل */}
                <div className="min-w-0 flex-1 text-center sm:text-start space-y-1.5">
                  <p className={`text-base sm:text-xl leading-relaxed break-words ${getCoverTitleClasses(coverFontStyle, coverTextEffect)}`}>
                    {liveCoverTitle}
                  </p>
                  <div className="flex flex-wrap items-center justify-center sm:justify-start gap-1.5 text-[10px] font-semibold text-white/80">
                    <span className="rounded-md bg-white/10 px-2 py-0.5">{currentStoryTypeLabel}</span>
                    {hero?.name && (
                      <span className="rounded-md bg-lantern/25 px-2 py-0.5 text-amber-200">
                        {ar ? `البطل: ${hero.name}` : `Hero: ${hero.name}`}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          الخطوة 3: «التفاصيل»
          1) اللهجة والصوت
          2) الفئة العمرية + النسبة (AspectRatio)
          3) طول القصة (عدد الصفحات)
          4) «خيارات متقدمة» مطوية افتراضياً (معاينة الغلاف أولاً، العلامة المفرغة، نص العلامة)
          5) بطاقة الملخص + زر «أنشئ القصة» (يظهر في الخطوة 3 فقط)
         ═══════════════════════════════════════════════════════════════════ */}
      {(wizardStep === 3 || showAllSteps) && (
        <div className="space-y-4 animate-[fadeUp_220ms_ease-out]">
          <div className="luxury-card p-3.5 sm:p-5 space-y-4">
            {/* 1. اللهجة والصوت */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {ar && !series && (
                <LuxurySelect<ArabicDialect>
                  id="dialect"
                  ar={ar}
                  label="اللهجة العربية للسرد والحوار"
                  value={dialect}
                  onChange={setDialect}
                  searchable
                  options={DIALECT_OPTIONS.map((d): LuxuryOption<ArabicDialect> => ({
                    value: d.value,
                    label: d.label,
                    icon: <DialectBadgeSvg code={d.flag} ar={ar} />,
                    badge: d.value === 'Modern Standard' ? (ar ? 'فصحى' : 'MSA') : undefined,
                  }))}
                />
              )}

              <LuxurySelect<NarratorVoice>
                id="narratorVoice"
                ar={ar}
                label={ar ? 'صوت الراوي (القراءة الصوتية)' : 'Narrator Voice'}
                value={selectedVoice}
                onChange={handleVoiceChange}
                searchable={false}
                options={VOICE_OPTIONS.map((v): LuxuryOption<NarratorVoice> => ({
                  value: v.value,
                  label: ar ? v.label.ar : v.label.en,
                  icon: <Volume2 size={15} className="text-lantern" />,
                }))}
              />
            </div>

            {/* 2. الفئة العمرية + النسبة */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-dream/20 dark:border-white/10">
              <LuxurySelect<AgeGroup>
                id="ageGroup"
                ar={ar}
                disabled={Boolean(series)}
                label={ar ? 'الفئة العمرية' : 'Age Group'}
                value={ageGroup}
                onChange={(val) => {
                  setAgeGroup(val);
                  setAudienceLevel(val === '18+' ? 'adults' : 'kids');
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

              <LuxurySelect<AspectRatio>
                id="aspectRatio"
                ar={ar}
                disabled={Boolean(series)}
                label={ar ? 'نسبة أبعاد الصفحات' : 'Illustration Aspect Ratio'}
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

            {/* 3. طول القصة وعدد الصفحات */}
            <div className="pt-2 border-t border-dream/20 dark:border-white/10">
              <div className="mb-2 flex items-center justify-between">
                <label className="font-display text-xs sm:text-sm font-extrabold text-ink dark:text-moonlight" htmlFor="length">
                  {ar ? `طول القصة: ${pageCount} صفحة` : `Story Length: ${pageCount} pages`}
                </label>
                <span className="inline-flex items-center gap-1 text-xs font-bold text-ink/70 dark:text-amber-200">
                  <Clock size={13} className="text-lantern" aria-hidden />
                  <span>{ar ? `~${readingMinutes} دقائق قراءة` : `~${readingMinutes} min read`}</span>
                </span>
              </div>

              <div className="mb-2 grid grid-cols-2 sm:grid-cols-4 gap-1.5" role="group" aria-label={ar ? 'أطوال جاهزة' : 'Length presets'}>
                {STORY_LENGTHS.map((l) => {
                  const active = pageCount === l.pages;
                  return (
                    <button
                      key={l.value}
                      type="button"
                      onClick={() => setPageCount(l.pages)}
                      aria-pressed={active}
                      className={`min-h-11 rounded-xl border px-2.5 py-1.5 text-xs font-bold transition-transform active:scale-95 ${
                        active
                          ? 'border-lantern bg-lantern text-ink shadow-2xs'
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
                className="h-11 w-full cursor-pointer accent-lantern"
              />
              {pageCount > FIRST_BATCH_PAGES && (
                <p className="mt-0.5 text-[11px] text-ink/60 dark:text-moonlight/60">
                  {ar ? 'تُكتب القصة الطويلة على دفعات بفصول متتابعة، ويمكن استئنافها في أي وقت.' : 'Long stories are generated in chapters and can be resumed anytime.'}
                </p>
              )}
            </div>

            {/* 4. قسم «خيارات متقدمة» مطوي افتراضياً (معاينة الغلاف أولاً، العلامة المفرغة، نص العلامة) */}
            <div className="pt-2 border-t border-dream/20 dark:border-white/10">
              <button
                type="button"
                aria-expanded={showAdvancedOptions}
                onClick={() => setShowAdvancedOptions((v) => !v)}
                className="flex min-h-11 w-full items-center justify-between gap-2 rounded-2xl border border-dream/25 bg-white/60 px-3.5 py-2 text-xs font-extrabold text-ink transition hover:border-lantern dark:border-white/10 dark:bg-white/5 dark:text-moonlight"
              >
                <span className="flex items-center gap-2">
                  <Settings2 size={15} className="text-lantern" aria-hidden />
                  <span>{ar ? 'خيارات متقدمة (معاينة الغلاف أولاً والعلامة المفرغة)' : 'Advanced Options (Preview Gate & Watermark)'}</span>
                </span>
                {showAdvancedOptions ? <ChevronUp size={16} aria-hidden /> : <ChevronDown size={16} aria-hidden />}
              </button>

              {showAdvancedOptions && (
                <div className="mt-2.5 grid grid-cols-1 sm:grid-cols-2 gap-2.5 animate-[fadeUp_180ms_ease-out]">
                  {/* مربعا الاختيار داخل label بـ min-height: 44px وبحجم لمس 44x44px */}
                  <label className="flex min-h-14 cursor-pointer items-center justify-between gap-3 rounded-2xl border border-dream/25 bg-white/65 p-3 dark:border-white/10 dark:bg-white/5">
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
                    <span className="flex min-h-11 min-w-11 shrink-0 items-center justify-center">
                      <input
                        type="checkbox"
                        checked={studioSettings.previewFirstGate}
                        onChange={(e) => updateSettings({ previewFirstGate: e.target.checked })}
                        className="h-6 w-6 cursor-pointer accent-lantern"
                        aria-label={ar ? 'معاينة الغلاف والصفحة 1 أولاً' : 'Preview Cover & Page 1 First'}
                      />
                    </span>
                  </label>

                  <div className="rounded-2xl border border-dream/25 bg-white/65 p-3 space-y-2 dark:border-white/10 dark:bg-white/5">
                    <label className="flex min-h-11 cursor-pointer items-center justify-between gap-3">
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
                      <span className="flex min-h-11 min-w-11 shrink-0 items-center justify-center">
                        <input
                          type="checkbox"
                          checked={studioSettings.watermarkEnabled}
                          onChange={(e) => updateSettings({ watermarkEnabled: e.target.checked })}
                          className="h-6 w-6 cursor-pointer accent-lantern"
                          aria-label={ar ? 'تفعيل العلامة المائية عند التصدير' : 'Enable export watermark'}
                        />
                      </span>
                    </label>
                    {studioSettings.watermarkEnabled && (
                      <input
                        type="text"
                        value={studioSettings.watermarkText}
                        onChange={(e) => updateSettings({ watermarkText: e.target.value.slice(0, 50) })}
                        placeholder={ar ? `النص الافتراضي: ${BRAND.name.ar}` : `Default: ${BRAND.name.en}`}
                        className="min-h-11 w-full rounded-xl border border-dream/30 bg-white/85 px-3 py-1.5 text-xs text-ink outline-none focus:border-lantern dark:border-white/15 dark:bg-black/30 dark:text-moonlight"
                      />
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* 5. بطاقة الملخص (الفكرة، الهوية، النوع، الطول، الأسلوب، اللهجة) */}
            <div className="rounded-2xl border border-lantern/35 bg-lantern/10 p-3.5 text-xs space-y-1.5">
              <div className="font-display font-extrabold text-ink dark:text-amber-200">
                {ar ? 'ملخص إعدادات القصة:' : 'Story Summary:'}
              </div>
              <p className="text-ink/85 dark:text-moonlight/85 line-clamp-2">
                <span className="font-bold">{ar ? 'الفكرة: ' : 'Idea: '}</span>
                <span>{idea.trim() || (ar ? 'لم تُكتب بعد' : 'Not written yet')}</span>
              </p>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] font-semibold text-ink/80 dark:text-moonlight/80">
                <span>{ar ? `الهوية: ${currentPresetLabel}` : `Identity: ${currentPresetLabel}`}</span>
                <span aria-hidden="true">·</span>
                <span>{ar ? `النوع: ${currentStoryTypeLabel}` : `Genre: ${currentStoryTypeLabel}`}</span>
                <span aria-hidden="true">·</span>
                <span>{ar ? `الأسلوب: ${currentStyleLabel}` : `Style: ${artStyle}`}</span>
                <span aria-hidden="true">·</span>
                <span>{ar ? `${currentDialectLabel} (${currentVoiceLabel})` : `${currentVoiceLabel}`}</span>
                <span aria-hidden="true">·</span>
                <span>{ar ? `الطول: ${pageCount} صفحات (${aspectRatio})` : `Length: ${pageCount}p (${aspectRatio})`}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* شريط سفلي ثابت للتنقل بين الخطوات (position: sticky مع مراعاة الشريط السفلي للتنقل و safe-area)
          البند 2: زر «أنشئ القصة» يظهر في الخطوة 3 فقط، وفي الخطوتين 1 و2 يظهر «التالي» فقط */}
      <div className="sticky bottom-[calc(4.35rem+env(safe-area-inset-bottom,0px))] md:bottom-3 z-30 rounded-2xl border border-dream/30 bg-moonlight/95 p-2.5 pb-[calc(0.625rem+env(safe-area-inset-bottom,0px))] md:pb-2.5 shadow-lg backdrop-blur-xl dark:border-white/15 dark:bg-dusk/95">
        {!showAllSteps ? (
          <div className="flex items-center justify-between gap-2.5">
            {wizardStep > 1 && (
              <button
                type="button"
                onClick={() => transitionToStep((wizardStep - 1) as WizardStep)}
                className="inline-flex min-h-12 items-center justify-center gap-1.5 rounded-xl border border-dream/35 bg-white/80 px-4 text-xs sm:text-sm font-bold text-ink transition hover:border-lantern dark:border-white/15 dark:bg-white/10 dark:text-moonlight"
              >
                {ar ? <ChevronRight size={16} aria-hidden /> : <ChevronLeft size={16} aria-hidden />}
                <span>{ar ? 'السابق' : 'Previous'}</span>
              </button>
            )}

            {wizardStep < 3 ? (
              <button
                type="button"
                onClick={() => transitionToStep((wizardStep + 1) as WizardStep)}
                className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-lantern via-amber-400 to-lantern px-5 font-display text-sm sm:text-base font-extrabold text-ink shadow-md shadow-lantern/25 transition hover:brightness-105 active:scale-[0.99]"
              >
                <span>
                  {wizardStep === 1
                    ? ar
                      ? 'التالي: الشكل والأسلوب'
                      : 'Next: Style & Cover'
                    : ar
                      ? 'التالي: التفاصيل والإنشاء'
                      : 'Next: Details & Create'}
                </span>
                {ar ? <ChevronLeft size={18} aria-hidden /> : <ChevronRight size={18} aria-hidden />}
              </button>
            ) : (
              <button
                type="submit"
                disabled={!canSubmit}
                className="animate-lantern inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-lantern via-amber-400 to-lantern px-5 py-3 font-display text-sm sm:text-base font-extrabold text-ink shadow-lg shadow-lantern/30 transition hover:brightness-105 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none"
              >
                <Wand2 size={20} aria-hidden />
                <span>{ar ? 'أنشئ القصة المصورة الآن' : 'Create Illustrated Story Now'}</span>
              </button>
            )}
          </div>
        ) : (
          <button
            type="submit"
            disabled={!canSubmit}
            className="animate-lantern flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-lantern via-amber-400 to-lantern py-3 font-display text-sm sm:text-base font-extrabold text-ink shadow-lg shadow-lantern/30 transition hover:brightness-105 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none"
          >
            <Wand2 size={20} aria-hidden />
            <span>{ar ? 'أنشئ القصة المصورة الآن' : 'Create Illustrated Story Now'}</span>
          </button>
        )}
      </div>

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
            setStepValidationError(false);
          }}
          onClose={() => setShowVoiceModal(false)}
        />
      )}
    </form>
  );
}
