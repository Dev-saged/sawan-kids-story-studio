import { useState } from 'react';
import { Check, ChevronLeft, ChevronRight, Feather, Mic, Palette, Sparkles, X } from 'lucide-react';
import { APP_VERSION, BRAND } from '../../config';
import type { Language } from '../../types';
import { LanternSvg } from './BrandIcons';

export const ONBOARDING_STORAGE_KEY = 'sajed_onboarding_v3_seen';

export const hasSeenOnboarding = (): boolean => {
  try {
    return localStorage.getItem(ONBOARDING_STORAGE_KEY) === '1';
  } catch {
    return true;
  }
};

export const markOnboardingSeen = (): void => {
  try {
    localStorage.setItem(ONBOARDING_STORAGE_KEY, '1');
  } catch {
    // ignore storage errors
  }
};

interface OnboardingModalProps {
  language: Language;
  onClose: () => void;
}

const SLIDES = [
  {
    step: 1,
    icon: Feather,
    title: {
      ar: '1. الفكرة والبطل والهوية السريعة',
      en: '1. Idea, Hero & Quick Identity',
    },
    desc: {
      ar: 'اختر هوية جاهزة بضغطة واحدة أو اكتب فكرة قصتك بحرية، وحدد نوع القصة من بين 16 نوعاً سردياً، واجعل طفلك بطل الحكاية بصورته أو من ألبوم الشخصيات المحفوظة.',
      en: 'Pick a one-click identity preset or write your own idea, select from 16 narrative genres, and make your child the hero with their photo or saved character album.',
    },
  },
  {
    step: 2,
    icon: Palette,
    title: {
      ar: '2. الأسلوب الفني وتصميم الغلاف الحي',
      en: '2. Art Style & Live Cover Typography',
    },
    desc: {
      ar: 'استعرض 18 أسلوباً فنياً بمعاينات مرسومة، واضبط أبعاد الصفحات وعددها (حتى 40 صفحة)، وعاين غلاف كتابك مباشرة بـ 12 خطاً عربياً أصيلاً و4 تأثيرات بصرية.',
      en: 'Browse 18 illustrated art styles, choose aspect ratio and page count (up to 40 pages), and preview your cover live with 12 Arabic calligraphic fonts and 4 text effects.',
    },
  },
  {
    step: 3,
    icon: Mic,
    title: {
      ar: '3. السرد الصوتي وبوابة المعاينة الذكية',
      en: '3. Voice Narration & Smart Preview Gate',
    },
    desc: {
      ar: 'اختر من 19 لهجة عربية والفصحى المشكّلة، وحدد صوت الراوي أو سجّل صوت العائلة، مع ميزة معاينة الغلاف والصفحة الأولى قبل إكمال رسم باقي الكتاب.',
      en: 'Select from 19 Arabic dialects and Fusha, pick a narrator or record family voice, and review the cover and Page 1 before painting the rest of the book.',
    },
  },
];

export default function OnboardingModal({ language, onClose }: OnboardingModalProps) {
  const ar = language === 'Arabic';
  const [index, setIndex] = useState(0);
  const current = SLIDES[index];
  const Icon = current.icon;

  const finish = () => {
    markOnboardingSeen();
    onClose();
  };

  return (
    <div
      dir={ar ? 'rtl' : 'ltr'}
      role="dialog"
      aria-modal="true"
      aria-labelledby="onboarding-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4 backdrop-blur-sm animate-[fadeUp_220ms_ease-out]"
    >
      <div className="luxury-card relative w-full max-w-lg overflow-hidden border border-lantern/35 bg-moonlight p-6 shadow-2xl dark:bg-dusk sm:p-7">
        <div className="flex items-center justify-between gap-3 border-b border-dream/20 pb-4">
          <div className="flex items-center gap-2.5">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-lantern text-ink shadow-xs">
              <LanternSvg className="h-5 w-5" />
            </span>
            <div className="text-start">
              <h2 id="onboarding-title" className="font-display text-base font-extrabold text-ink dark:text-moonlight">
                {ar ? `مرحباً بك في ${BRAND.name.ar}` : `Welcome to ${BRAND.name.en}`}
              </h2>
              <p className="text-[11px] font-semibold text-ink/60 dark:text-moonlight/60">
                {ar ? `معالج القصص التفاعلي (الإصدار v${APP_VERSION})` : `Interactive 3-Step Story Wizard (v${APP_VERSION})`}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={finish}
            className="flex min-h-11 min-w-11 items-center justify-center rounded-2xl border border-dream/25 text-ink/70 transition hover:border-lantern hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-lantern dark:text-moonlight/70 dark:hover:text-moonlight"
            aria-label={ar ? 'إغلاق نافذة الترحيب' : 'Close welcome guide'}
          >
            <X size={18} aria-hidden />
          </button>
        </div>

        {/* Step Indicator Dots */}
        <div className="mt-5 flex items-center justify-center gap-2" role="tablist" aria-label={ar ? 'خطوات الدليل' : 'Guide steps'}>
          {SLIDES.map((s, i) => (
            <button
              key={s.step}
              type="button"
              role="tab"
              aria-selected={i === index}
              onClick={() => setIndex(i)}
              className={`min-h-11 px-3 rounded-xl font-display text-xs font-bold transition ${
                i === index
                  ? 'bg-lantern text-ink shadow-xs'
                  : 'bg-dream/15 text-ink/70 hover:bg-dream/25 dark:text-moonlight/75'
              }`}
            >
              {ar ? `الخطوة ${s.step}` : `Step ${s.step}`}
            </button>
          ))}
        </div>

        {/* Slide Content */}
        <div className="mt-4 rounded-2xl border border-dream/25 bg-white/75 p-5 text-center dark:bg-white/5">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-lantern/20 text-lantern">
            <Icon size={28} aria-hidden />
          </div>
          <h3 className="mt-3 font-display text-lg font-extrabold text-ink dark:text-moonlight">
            {ar ? current.title.ar : current.title.en}
          </h3>
          <p className="mt-2 text-sm leading-relaxed text-ink/80 dark:text-moonlight/80">
            {ar ? current.desc.ar : current.desc.en}
          </p>
        </div>

        {/* Actions */}
        <div className="mt-5 flex items-center justify-between gap-2.5">
          <button
            type="button"
            onClick={finish}
            className="min-h-11 rounded-xl px-4 text-xs font-bold text-ink/65 underline-offset-4 hover:underline dark:text-moonlight/65"
          >
            {ar ? 'تخطي الدليل' : 'Skip guide'}
          </button>

          <div className="flex items-center gap-2">
            {index > 0 && (
              <button
                type="button"
                onClick={() => setIndex((i) => Math.max(0, i - 1))}
                className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-dream/30 px-4 text-xs font-bold text-ink transition hover:border-lantern dark:text-moonlight"
              >
                {ar ? <ChevronRight size={15} aria-hidden /> : <ChevronLeft size={15} aria-hidden />}
                <span>{ar ? 'السابق' : 'Previous'}</span>
              </button>
            )}

            {index < SLIDES.length - 1 ? (
              <button
                type="button"
                onClick={() => setIndex((i) => Math.min(SLIDES.length - 1, i + 1))}
                className="inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-lantern px-5 font-display text-xs font-bold text-ink shadow-xs transition hover:brightness-105"
              >
                <span>{ar ? 'التالي' : 'Next'}</span>
                {ar ? <ChevronLeft size={15} aria-hidden /> : <ChevronRight size={15} aria-hidden />}
              </button>
            ) : (
              <button
                type="button"
                onClick={finish}
                className="inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-lantern px-5 font-display text-xs font-bold text-ink shadow-xs transition hover:brightness-105"
              >
                <Sparkles size={15} aria-hidden />
                <span>{ar ? 'ابدأ صناعة القصص' : 'Start creating'}</span>
                <Check size={15} aria-hidden />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
