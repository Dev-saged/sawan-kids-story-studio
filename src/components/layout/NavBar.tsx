import { BookOpen, BookMarked, Gamepad2, Library, Sparkles, Moon, Sun, Languages } from 'lucide-react';
import { Language } from '../../types';
import { BRAND } from '../../config';

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
      {/* Top utility bar: brand + theme + language */}
      <header className="sticky top-0 z-40 flex items-center justify-between border-b border-dream/20 bg-moonlight/90 px-4 py-3 backdrop-blur dark:bg-dusk/90">
        <div className="font-display flex items-center gap-2 text-lg font-semibold text-ink dark:text-moonlight">
          <span aria-hidden>🏮</span>
          <span>{isAr ? BRAND.name.ar : BRAND.name.en}</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onToggleLanguage}
            className="flex items-center gap-1 rounded-full border border-dream/30 px-3 py-1.5 text-sm font-medium text-ink transition hover:border-lantern focus-visible:outline focus-visible:outline-2 focus-visible:outline-lantern dark:text-moonlight"
            aria-label={isAr ? 'تبديل اللغة' : 'Toggle language'}
          >
            <Languages size={16} aria-hidden />
            {isAr ? 'EN' : 'ع'}
          </button>
          <button
            type="button"
            onClick={onToggleTheme}
            className="rounded-full border border-dream/30 p-1.5 text-ink transition hover:border-lantern focus-visible:outline focus-visible:outline-2 focus-visible:outline-lantern dark:text-moonlight"
            aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
          >
            {theme === 'dark' ? <Sun size={18} aria-hidden /> : <Moon size={18} aria-hidden />}
          </button>
        </div>
      </header>

      {/* Bottom tab bar: thumb-reachable primary navigation */}
      <nav
        className="fixed inset-x-0 bottom-0 z-40 border-t border-dream/20 bg-moonlight/95 pb-[env(safe-area-inset-bottom)] backdrop-blur dark:bg-dusk/95"
        aria-label={isAr ? 'التنقل الرئيسي' : 'Primary navigation'}
      >
        <ul className="mx-auto flex max-w-2xl items-stretch justify-between px-2">
          {ITEMS.map(({ id, icon: Icon, label }) => {
            const isActive = active === id;
            return (
              <li key={id} className="flex-1">
                <button
                  type="button"
                  onClick={() => onNavigate(id)}
                  className={`flex w-full flex-col items-center gap-1 py-2.5 text-xs font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-lantern ${
                    isActive ? 'text-lantern' : 'text-ink/60 dark:text-moonlight/60'
                  }`}
                  aria-current={isActive ? 'page' : undefined}
                >
                  <Icon size={22} aria-hidden strokeWidth={isActive ? 2.4 : 2} />
                  {isAr ? label.ar : label.en}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
}
