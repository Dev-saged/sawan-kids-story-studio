import { useState, useRef, useEffect, useMemo, type ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Check, Search, X } from 'lucide-react';

export interface LuxuryOption<T extends string = string> {
  value: T;
  label: string;
  sublabel?: string;
  icon?: ReactNode;
  badge?: string;
  fontClassName?: string;
}

interface LuxurySelectProps<T extends string = string> {
  id?: string;
  label?: string;
  value: T;
  options: LuxuryOption<T>[];
  onChange: (value: T) => void;
  disabled?: boolean;
  ar?: boolean;
  searchable?: boolean;
  placeholder?: string;
  hint?: ReactNode;
}

export default function LuxurySelect<T extends string = string>({
  id,
  label,
  value,
  options,
  onChange,
  disabled = false,
  ar = true,
  searchable,
  placeholder,
  hint,
}: LuxurySelectProps<T>) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const rootRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const selected = useMemo(
    () => options.find((o) => o.value === value) ?? options[0],
    [options, value]
  );

  const showSearch = searchable ?? options.length > 7;

  const filteredOptions = useMemo(() => {
    if (!query.trim()) return options;
    const q = query.trim().toLowerCase();
    return options.filter(
      (o) =>
        o.label.toLowerCase().includes(q) ||
        (o.sublabel && o.sublabel.toLowerCase().includes(q)) ||
        o.value.toLowerCase().includes(q)
    );
  }, [options, query]);

  useEffect(() => {
    if (!open) {
      setQuery('');
      return;
    }
    const handleOutside = (e: MouseEvent | TouchEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('touchstart', handleOutside);
    document.addEventListener('keydown', handleKey);
    if (showSearch) {
      setTimeout(() => searchInputRef.current?.focus(), 60);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('touchstart', handleOutside);
      document.removeEventListener('keydown', handleKey);
    };
  }, [open, showSearch]);

  return (
    <div ref={rootRef} className="relative w-full" dir={ar ? 'rtl' : 'ltr'}>
      {label && (
        <label
          htmlFor={id}
          onClick={() => !disabled && setOpen((p) => !p)}
          className="mb-1.5 block text-xs sm:text-sm font-bold tracking-wide text-ink/85 dark:text-moonlight/90 cursor-pointer select-none"
        >
          {label}
        </label>
      )}

      <button
        id={id}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => !disabled && setOpen((p) => !p)}
        className={`group relative flex min-h-12 w-full items-center justify-between gap-2.5 rounded-2xl border px-3.5 py-2.5 text-start transition-all duration-200 select-none ${
          disabled
            ? 'cursor-not-allowed opacity-55 border-dream/20 bg-white/40 dark:bg-white/5'
            : open
              ? 'border-lantern bg-white shadow-[0_0_0_3px_rgba(240,162,2,0.22)] dark:bg-[#251d42] dark:border-lantern'
              : 'border-dream/30 bg-white/85 hover:border-lantern/70 hover:bg-white shadow-xs dark:bg-white/[0.07] dark:hover:bg-white/[0.11] dark:border-white/15'
        }`}
      >
        <div className="flex min-w-0 flex-1 items-center gap-2.5">
          {selected?.icon && (
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-lantern/15 text-base text-lantern dark:bg-lantern/20">
              {selected.icon}
            </span>
          )}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span
                className={`block truncate text-sm font-bold text-ink dark:text-moonlight ${
                  selected?.fontClassName ?? ''
                }`}
              >
                {selected ? selected.label : placeholder ?? ''}
              </span>
              {selected?.badge && (
                <span className="shrink-0 rounded-full bg-lantern/20 border border-lantern/40 px-2 py-0.5 text-[10px] font-bold text-lantern">
                  {selected.badge}
                </span>
              )}
            </div>
            {selected?.sublabel && (
              <span className="block truncate text-[11px] text-ink/60 dark:text-moonlight/60 mt-0.5">
                {selected.sublabel}
              </span>
            )}
          </div>
        </div>

        <span
          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-ink/5 text-ink/70 transition-transform duration-200 group-hover:bg-lantern/20 group-hover:text-lantern dark:bg-white/10 dark:text-moonlight/75 ${
            open ? 'rotate-180 bg-lantern/25 text-lantern' : ''
          }`}
        >
          <ChevronDown size={16} />
        </span>
      </button>

      {hint && (
        <div className="mt-1.5 text-xs text-ink/60 dark:text-moonlight/65">
          {hint}
        </div>
      )}

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.98 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            className="absolute z-50 mt-2 w-full overflow-hidden rounded-2xl border border-lantern/40 bg-white/98 shadow-2xl backdrop-blur-xl dark:border-lantern/35 dark:bg-[#1a1430]/98"
            role="listbox"
          >
            {showSearch && (
              <div className="border-b border-dream/20 p-2.5 dark:border-white/10">
                <div className="relative flex items-center">
                  <Search
                    size={15}
                    className="pointer-events-none absolute start-3 text-ink/45 dark:text-moonlight/45"
                  />
                  <input
                    ref={searchInputRef}
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder={ar ? 'ابحث سريعاً...' : 'Quick search...'}
                    className="w-full rounded-xl border border-dream/25 bg-ink/[0.03] py-2 pe-8 ps-9 text-xs font-medium text-ink outline-none focus:border-lantern dark:border-white/15 dark:bg-white/5 dark:text-moonlight"
                  />
                  {query && (
                    <button
                      type="button"
                      onClick={() => setQuery('')}
                      className="absolute end-2.5 rounded-full p-0.5 text-ink/50 hover:text-ink dark:text-moonlight/50 dark:hover:text-moonlight"
                    >
                      <X size={13} />
                    </button>
                  )}
                </div>
              </div>
            )}

            <div className="max-h-68 overflow-y-auto overscroll-contain p-1.5 space-y-1 custom-scrollbar">
              {filteredOptions.length === 0 ? (
                <div className="py-6 text-center text-xs text-ink/50 dark:text-moonlight/50">
                  {ar ? 'لا توجد نتائج مطابقة' : 'No matching options'}
                </div>
              ) : (
                filteredOptions.map((opt) => {
                  const isSelected = opt.value === value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      onClick={() => {
                        onChange(opt.value);
                        setOpen(false);
                      }}
                      className={`flex w-full items-center justify-between gap-2.5 rounded-xl px-3 py-2.5 text-start transition-all ${
                        isSelected
                          ? 'bg-gradient-to-r from-lantern/25 via-lantern/15 to-transparent text-ink font-bold border border-lantern/40 dark:text-moonlight'
                          : 'text-ink/85 hover:bg-dream/15 dark:text-moonlight/85 dark:hover:bg-white/10 border border-transparent'
                      }`}
                    >
                      <div className="flex min-w-0 flex-1 items-center gap-2.5">
                        {opt.icon && (
                          <span
                            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-base ${
                              isSelected
                                ? 'bg-lantern text-ink shadow-xs'
                                : 'bg-ink/5 text-ink/80 dark:bg-white/10 dark:text-moonlight'
                            }`}
                          >
                            {opt.icon}
                          </span>
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span
                              className={`block truncate text-sm ${
                                isSelected ? 'font-extrabold text-ink dark:text-amber-300' : 'font-semibold'
                              } ${opt.fontClassName ?? ''}`}
                            >
                              {opt.label}
                            </span>
                            {opt.badge && (
                              <span className="shrink-0 rounded-full bg-lantern/20 px-2 py-0.5 text-[10px] font-bold text-lantern">
                                {opt.badge}
                              </span>
                            )}
                          </div>
                          {opt.sublabel && (
                            <span className="block truncate text-[11px] text-ink/55 dark:text-moonlight/55 mt-0.5">
                              {opt.sublabel}
                            </span>
                          )}
                        </div>
                      </div>

                      {isSelected && (
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-lantern text-ink shadow-xs">
                          <Check size={13} strokeWidth={3} />
                        </span>
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
