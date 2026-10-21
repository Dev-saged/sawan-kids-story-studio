import { useEffect, useState } from 'react';
import { ArrowUpCircle, BookOpen, BookMarked, Gamepad2, HelpCircle, Library, Sparkles, Moon, Sun, Languages, X } from 'lucide-react';
import { Language } from '../../types';
import { APP_VERSION, BRAND } from '../../config';
import { checkForAppUpdate, type UpdateCheckResult } from '../../services/versionCheck';
import { LanternSvg } from '../common/BrandIcons';
import AppHealthModal from '../common/AppHealthModal';

export type Section = 'studio' | 'library' | 'games' | 'learn' | 'names';

interface NavBarProps {
  active: Section;
  onNavigate: (section: Section) => void;
  language: Language;
  onToggleLanguage: () => void;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
}

const ITEMS: { id: Section; icon: typeof BookOpen; label: { en: string; ar: string } }[] = [
  { id: 'studio', icon: Sparkles, label: { en: 'Studio', ar: 'الاستوديو' } },
  { id: 'library', icon: BookMarked, label: { en: 'My Books', ar: 'مكتبتي' } },
  { id: 'games', icon: Gamepad2, label: { en: 'Games', ar: 'الألعاب' } },
  { id: 'learn', icon: BookOpen, label: { en: 'Read & Learn', ar: 'اقرأ وتعلم' } },
  { id: 'names', icon: Library, label: { en: 'Names', ar: 'الأسماء' } },
];

export default function NavBar({ active, onNavigate, language, onToggleLanguage, theme, onToggleTheme }: NavBarProps) {
  const isAr = language === 'Arabic';
  const [updateInfo, setUpdateInfo] = useState<UpdateCheckResult | null>(null);
  const [dismissedUpdate, setDismissedUpdate] = useState(false);
  const [showHealthModal, setShowHealthModal] = useState(false);

  useEffect(() => {
    let alive = true;
    checkForAppUpdate().then((res) => {
      if (alive && res.hasUpdate) setUpdateInfo(res);
    });
    return () => {
      alive = false;
    };
  }, []);

  return (
    <>
      {updateInfo?.hasUpdate && !dismissedUpdate && (
        <div
          dir="rtl"
          role="status"
          className="flex items-center justify-between gap-2 border-b border-lantern/30 bg-lantern/15 px-4 py-1 text-xs font-bold text-ink dark:text-amber-200"
        >
          <div className="flex items-center gap-2">
            <ArrowUpCircle size={15} className="text-lantern shrink-0" aria-hidden />
            <span>
              {isAr
                ? `يتوفر إصدار أحدث من ${BRAND.name.ar} (v${updateInfo.latestVersion})`
                : `يتوفر إصدار أحدث (v${updateInfo.latestVersion})`}
            </span>
            {updateInfo.releaseUrl && (
              <a
                href={updateInfo.releaseUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-11 items-center px-2 underline decoration-lantern underline-offset-4 hover:text-lantern"
              >
                {isAr ? 'عرض التحديث' : 'View update'}
              </a>
            )}
          </div>
          <button
            type="button"
            onClick={() => setDismissedUpdate(true)}
            className="flex min-h-11 min-w-11 items-center justify-center rounded-xl text-ink/70 hover:text-ink dark:text-amber-200/80 dark:hover:text-amber-100"
            aria-label={isAr ? 'إغلاق الإشعار' : 'Dismiss update notice'}
          >
            <X size={15} aria-hidden />
          </button>
        </div>
      )}
      {/* Top luxury header bar: brand + desktop nav + theme + language */}
      <header className="sticky top-0 z-40 border-b border-dream/20 bg-moonlight/85 px-3.5 py-2.5 backdrop-blur-xl transition-colors dark:border-white/10 dark:bg-dusk/85 sm:px-6">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-3">
          {/* Brand Emblem */}
          <button
            type="button"
            onClick={() => onNavigate('studio')}
            className="group flex min-h-11 items-center gap-2.5 text-start focus-visible:outline-none"
          >
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-lantern via-amber-400 to-amber-600 text-ink shadow-md shadow-lantern/25 transition-transform group-hover:scale-105">
              <LanternSvg className="w-6 h-6" />
            </span>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-display text-base sm:text-lg font-extrabold tracking-tight text-ink dark:text-moonlight truncate">
                  {isAr ? BRAND.name.ar : BRAND.name.en}
                </span>
                <span className="rounded-md border border-lantern/40 bg-lantern/15 px-1.5 py-0.5 font-mono text-[10px] font-bold text-ink dark:text-amber-200">
                  v{APP_VERSION}
                </span>
              </div>
              <span className="hidden sm:block text-[11px] font-medium text-ink/60 dark:text-moonlight/60 truncate">
                {isAr ? BRAND.fullName.ar : BRAND.fullName.en}
              </span>
            </div>
          </button>

          {/* Desktop Navigation Tabs (md and up) */}
          <nav
            className="hidden md:flex items-center gap-1 rounded-2xl border border-dream/25 bg-white/60 p-1 shadow-xs dark:border-white/10 dark:bg-white/5"
            aria-label={isAr ? 'التنقل الرئيسي' : 'Primary navigation'}
          >
            {ITEMS.map(({ id, icon: Icon, label }) => {
              const isActive = active === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => onNavigate(id)}
                  aria-current={isActive ? 'page' : undefined}
                  className={`flex min-h-11 items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold transition-transform ${
                    isActive
                      ? 'bg-lantern text-ink shadow-sm'
                      : 'text-ink/75 hover:bg-dream/15 hover:text-ink dark:text-moonlight/75 dark:hover:bg-white/10 dark:hover:text-moonlight'
                  }`}
                >
                  <Icon size={15} strokeWidth={isActive ? 2.5 : 2} />
                  <span>{isAr ? label.ar : label.en}</span>
                </button>
              );
            })}
          </nav>

          {/* Language, Theme & App Health (?) Controls */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              data-testid="open-app-health-btn"
              onClick={() => setShowHealthModal(true)}
              title={isAr ? 'حالة التطبيق' : 'App Health Report'}
              aria-label={isAr ? 'حالة التطبيق' : 'App Health Report'}
              className="flex min-h-11 min-w-11 items-center justify-center rounded-2xl border border-dream/30 bg-white/75 text-ink shadow-2xs transition hover:border-lantern active:scale-95 dark:border-white/15 dark:bg-white/10 dark:text-moonlight"
            >
              <HelpCircle size={17} className="text-lantern" aria-hidden />
            </button>
            <button
              type="button"
              onClick={onToggleLanguage}
              className="flex min-h-11 items-center gap-1.5 rounded-2xl border border-dream/30 bg-white/75 px-3.5 py-2 text-xs font-bold text-ink shadow-2xs transition hover:border-lantern active:scale-95 dark:border-white/15 dark:bg-white/10 dark:text-moonlight"
              aria-label={isAr ? 'تبديل اللغة' : 'Toggle language'}
            >
              <Languages size={15} className="text-lantern" aria-hidden />
              <span>{isAr ? 'English' : 'العربية'}</span>
            </button>
            <button
              type="button"
              onClick={onToggleTheme}
              className="flex min-h-11 min-w-11 items-center justify-center rounded-2xl border border-dream/30 bg-white/75 text-ink shadow-2xs transition hover:border-lantern active:scale-95 dark:border-white/15 dark:bg-white/10 dark:text-moonlight"
              aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
            >
              {theme === 'dark' ? <Sun size={17} className="text-amber-300" aria-hidden /> : <Moon size={17} className="text-ink/80" aria-hidden />}
            </button>
          </div>
        </div>
      </header>
      {showHealthModal && <AppHealthModal ar={isAr} onClose={() => setShowHealthModal(false)} />}

      {/* Mobile Bottom Dock: floating glassmorphic navigation for phones */}
      <nav
        className="fixed inset-x-0 bottom-0 z-40 border-t border-dream/25 bg-moonlight/92 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden dark:border-white/10 dark:bg-[#161129]/94 shadow-[0_-8px_30px_rgba(0,0,0,0.18)]"
        aria-label={isAr ? 'التنقل الرئيسي للهاتف' : 'Mobile navigation'}
      >
        <ul className="mx-auto flex max-w-md items-stretch justify-around px-1.5 py-1">
          {ITEMS.map(({ id, icon: Icon, label }) => {
            const isActive = active === id;
            return (
              <li key={id} className="flex-1">
                <button
                  type="button"
                  onClick={() => onNavigate(id)}
                  className={`relative flex min-h-11 w-full flex-col items-center justify-center gap-1 rounded-2xl py-2 text-[11px] font-bold transition-transform active:scale-95 ${
                    isActive
                      ? 'text-ink dark:text-amber-300'
                      : 'text-ink/60 hover:text-ink/85 dark:text-moonlight/60 dark:hover:text-moonlight/85'
                  }`}
                  aria-current={isActive ? 'page' : undefined}
                >
                  {isActive && (
                    <span className="absolute inset-x-2 top-1 h-7 rounded-xl bg-lantern/20 dark:bg-lantern/20 -z-10" />
                  )}
                  <Icon
                    size={20}
                    aria-hidden
                    strokeWidth={isActive ? 2.5 : 1.9}
                    className={isActive ? 'text-lantern' : ''}
                  />
                  <span className="truncate max-w-[4.5rem]">{isAr ? label.ar : label.en}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
}
