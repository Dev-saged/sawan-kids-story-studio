import { BookOpen, BookMarked, Gamepad2, Library, Sparkles, Moon, Sun, Languages } from 'lucide-react';
import { Language } from '../../types';
import { APP_VERSION, BRAND } from '../../config';
import { LanternSvg } from '../common/BrandIcons';

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

  return (
    <>
      {/* Top luxury header bar: brand + desktop nav + theme + language */}
      <header className="sticky top-0 z-40 border-b border-dream/20 bg-moonlight/85 px-3.5 py-2.5 backdrop-blur-xl transition-colors dark:border-white/10 dark:bg-dusk/85 sm:px-6">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-3">
          {/* Brand Emblem */}
          <button
            type="button"
            onClick={() => onNavigate('studio')}
            className="group flex items-center gap-2.5 text-start focus-visible:outline-none"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-lantern via-amber-400 to-amber-600 text-ink shadow-md shadow-lantern/25 transition-transform group-hover:scale-105">
              <LanternSvg className="w-6 h-6" />
            </span>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-display text-base sm:text-lg font-extrabold tracking-tight text-ink dark:text-moonlight truncate">
                  {isAr ? BRAND.name.ar : BRAND.name.en}
                </span>
                <span className="rounded-full border border-lantern/40 bg-lantern/15 px-2 py-0.5 font-mono text-[10px] font-bold text-lantern">
                  v{APP_VERSION}
                </span>
              </div>
              <span className="hidden sm:block text-[11px] font-medium text-ink/55 dark:text-moonlight/55 truncate">
                {isAr ? 'استوديو القصص المصورة والذكية للأطفال واليافعين' : 'Interactive Illustrated Story Studio'}
              </span>
            </div>
          </button>

          {/* Desktop Navigation Pills (md and up) */}
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
                  className={`flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold transition-all ${
                    isActive
                      ? 'bg-lantern text-ink shadow-sm'
                      : 'text-ink/70 hover:bg-dream/15 hover:text-ink dark:text-moonlight/70 dark:hover:bg-white/10 dark:hover:text-moonlight'
                  }`}
                >
                  <Icon size={15} strokeWidth={isActive ? 2.5 : 2} />
                  <span>{isAr ? label.ar : label.en}</span>
                </button>
              );
            })}
          </nav>

          {/* Language & Theme Controls */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={onToggleLanguage}
              className="flex min-h-10 items-center gap-1.5 rounded-2xl border border-dream/30 bg-white/75 px-3 py-1.5 text-xs font-bold text-ink shadow-2xs transition hover:border-lantern active:scale-95 dark:border-white/15 dark:bg-white/10 dark:text-moonlight"
              aria-label={isAr ? 'تبديل اللغة' : 'Toggle language'}
            >
              <Languages size={15} className="text-lantern" aria-hidden />
              <span>{isAr ? 'English' : 'العربية'}</span>
            </button>
            <button
              type="button"
              onClick={onToggleTheme}
              className="flex h-10 w-10 items-center justify-center rounded-2xl border border-dream/30 bg-white/75 text-ink shadow-2xs transition hover:border-lantern active:scale-95 dark:border-white/15 dark:bg-white/10 dark:text-moonlight"
              aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
            >
              {theme === 'dark' ? <Sun size={17} className="text-amber-300" aria-hidden /> : <Moon size={17} className="text-ink/80" aria-hidden />}
            </button>
          </div>
        </div>
      </header>

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
                  className={`relative flex w-full flex-col items-center justify-center gap-1 rounded-2xl py-2 text-[11px] font-bold transition-all active:scale-95 ${
                    isActive
                      ? 'text-ink dark:text-amber-300'
                      : 'text-ink/55 hover:text-ink/80 dark:text-moonlight/55 dark:hover:text-moonlight/85'
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
