import { useState } from 'react';
import { ChevronRight, Filter, Compass } from 'lucide-react';
import { BOOK_TEMPLATES, BookTemplate } from '../../data/bookTemplates';

interface Props {
  ar: boolean;
  onSelectTemplate: (template: BookTemplate) => void;
  onClose?: () => void;
}

export default function BookTemplateBrowser({ ar, onSelectTemplate, onClose }: Props) {
  const [selectedFilter, setSelectedFilter] = useState<string>('all');

  const filters = [
    { id: 'all', label: ar ? 'الكل (12 قالب)' : 'All (12 Templates)' },
    { id: 'cultural', label: ar ? 'نكهات عربية وتراثية' : 'Arab & Cultural' },
    { id: 'science', label: ar ? 'علوم وفضاء (STEM)' : 'Science & Space' },
    { id: 'bedtime', label: ar ? 'قبل النوم وهادئة' : 'Bedtime & Calm' },
    { id: 'adventure', label: ar ? 'مغامرات وخيال' : 'Adventure & Fantasy' },
  ];

  const filtered = BOOK_TEMPLATES.filter((t) => {
    if (selectedFilter === 'all') return true;
    if (selectedFilter === 'cultural') return ['palestinian', 'syrian', 'egyptian', 'bedouin'].includes(t.flavor);
    if (selectedFilter === 'science') return ['space', 'science', 'nature'].includes(t.flavor);
    if (selectedFilter === 'bedtime') return ['bedtime', 'ocean'].includes(t.flavor);
    if (selectedFilter === 'adventure') return ['fantasy', 'values', 'food'].includes(t.flavor);
    return true;
  });

  return (
    <div className="space-y-4 rounded-3xl border border-dream/30 bg-gradient-to-br from-dream/10 via-white/80 to-dream/5 p-5 shadow-lg dark:from-dusk dark:via-[#1c1a26] dark:to-dusk dark:text-moonlight sm:p-6" dir={ar ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-lantern/20 text-lantern">
            <Compass size={22} />
          </div>
          <div>
            <h3 className="font-display text-base sm:text-lg font-bold text-ink dark:text-moonlight">
              {ar ? 'اختر قالباً جاهزاً لقصتك (12 قالباً فخماً)' : 'Choose a Story Template (12 Rich Presets)'}
            </h3>
            <p className="text-xs text-ink/65 dark:text-moonlight/65">
              {ar ? 'قوالب بنكهة فلسطينية وشامية ومصرية وبدوية، وقصص فضاء وخيال وقبل النوم' : 'Palestinian, Syrian, Egyptian, Bedouin, Space & Bedtime themes'}
            </p>
          </div>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="text-xs font-semibold text-ink/60 hover:text-coral dark:text-moonlight/60"
          >
            {ar ? 'إغلاق' : 'Close'}
          </button>
        )}
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">
        <Filter size={14} className="text-ink/40 shrink-0 me-1" />
        {filters.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setSelectedFilter(f.id)}
            className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
              selectedFilter === f.id
                ? 'bg-lantern text-ink shadow-xs'
                : 'border border-dream/30 bg-white/70 text-ink/75 hover:bg-dream/20 dark:bg-white/10 dark:text-moonlight/75'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Grid of Templates */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
        {filtered.map((tmpl) => (
          <div
            key={tmpl.id}
            className="group relative flex flex-col justify-between rounded-2xl border border-dream/25 bg-white/90 p-4 transition-all duration-200 hover:-translate-y-1 hover:border-lantern hover:shadow-md dark:bg-white/5"
          >
            <div className="space-y-2">
              <div className="flex items-start justify-between gap-2">
                <span className="text-2xl" role="img" aria-label={tmpl.badge.en}>
                  {tmpl.icon}
                </span>
                <span
                  className="rounded-full px-2.5 py-0.5 text-[11px] font-bold"
                  style={{
                    backgroundColor: `${tmpl.accentColor}18`,
                    color: tmpl.accentColor,
                  }}
                >
                  {ar ? tmpl.badge.ar : tmpl.badge.en}
                </span>
              </div>

              <div>
                <h4 className="font-display text-sm font-bold text-ink transition group-hover:text-lantern dark:text-moonlight">
                  {ar ? tmpl.title.ar : tmpl.title.en}
                </h4>
                <p className="mt-1 line-clamp-2 text-xs text-ink/65 dark:text-moonlight/65 leading-relaxed">
                  {ar ? tmpl.tagline.ar : tmpl.tagline.en}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-1.5 pt-1 text-[11px] font-medium text-ink/50 dark:text-moonlight/50">
                <span className="rounded-md bg-dream/10 px-1.5 py-0.5 dark:bg-white/10">
                  {ar ? `سن ${tmpl.ageGroup}` : `Age ${tmpl.ageGroup}`}
                </span>
                <span className="rounded-md bg-dream/10 px-1.5 py-0.5 dark:bg-white/10">
                  {tmpl.artStyle}
                </span>
                {tmpl.dialect !== 'Modern Standard' && (
                  <span className="rounded-md bg-dream/10 px-1.5 py-0.5 dark:bg-white/10">
                    {tmpl.dialect}
                  </span>
                )}
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-dream/15 flex items-center justify-between">
              <span className="text-[11px] font-semibold text-ink/60 dark:text-moonlight/60">
                {ar ? `البطل: ${tmpl.suggestedHeroName.ar}` : `Hero: ${tmpl.suggestedHeroName.en}`}
              </span>
              <button
                type="button"
                onClick={() => onSelectTemplate(tmpl)}
                className="inline-flex items-center gap-1 rounded-full bg-lantern/90 px-3 py-1.5 text-xs font-bold text-ink shadow-xs transition hover:bg-lantern active:scale-95"
              >
                <span>{ar ? 'استخدم القالب' : 'Use template'}</span>
                <ChevronRight size={13} className={ar ? 'rotate-180' : ''} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
