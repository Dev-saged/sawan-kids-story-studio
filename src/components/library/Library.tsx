import { useEffect, useState } from 'react';
import { BookMarked, ImageOff, Trash2 } from 'lucide-react';
import { Language } from '../../types';
import { deleteStory, listStories, type StorySummary } from '../../services/library';

interface Props {
  language: Language;
  onOpen: (id: string) => void;
}

// رف كتب محلي: كل قصة محفوظة بصورها وصوتها وتعمل بدون إنترنت
export default function Library({ language, onOpen }: Props) {
  const ar = language === 'Arabic';
  const [items, setItems] = useState<StorySummary[] | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const refresh = () => listStories().then(setItems);
  useEffect(() => {
    refresh();
  }, []);

  const remove = async (id: string) => {
    await deleteStory(id);
    setConfirmId(null);
    refresh();
  };

  if (!items) {
    return (
      <div className="grid grid-cols-2 gap-4" aria-busy="true">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="aspect-[3/4] animate-pulse rounded-3xl bg-dream/15" />
        ))}
      </div>
    );
  }

  if (!items.length) {
    return (
      <div className="space-y-3 rounded-3xl border border-dream/20 bg-white/60 p-8 text-center dark:bg-white/5">
        <BookMarked size={36} className="mx-auto text-dream" aria-hidden />
        <p className="font-display text-base font-semibold text-ink dark:text-moonlight">{ar ? 'مكتبتك فارغة' : 'Your library is empty'}</p>
        <p className="text-sm text-ink/60 dark:text-moonlight/60">{ar ? 'كل قصة تصنعها تُحفظ هنا تلقائياً مع صورها وصوتها.' : 'Every story you create is saved here automatically with its pictures and voice.'}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4" dir={ar ? 'rtl' : 'ltr'}>
      <h2 className="font-display text-lg font-bold text-ink dark:text-moonlight">
        {ar ? 'مكتبتي' : 'My books'} <span className="text-sm font-medium text-ink/50 dark:text-moonlight/50">({items.length})</span>
      </h2>
      <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        {items.map((s, i) => (
          <li key={s.id} className="group relative animate-[fadeUp_450ms_ease-out_both]" style={{ animationDelay: `${Math.min(i, 8) * 50}ms` }}>
            <button
              type="button"
              onClick={() => onOpen(s.id)}
              className="block w-full overflow-hidden rounded-3xl border border-dream/25 bg-white/80 text-start shadow-xs transition hover:-translate-y-1 hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-lantern active:scale-[0.98] dark:bg-white/5"
            >
              <div className="relative aspect-[3/4] w-full bg-dream/10">
                {s.coverUrl ? (
                  <img src={s.coverUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
                ) : (
                  <div className="flex h-full items-center justify-center text-dream">
                    <ImageOff size={26} aria-hidden />
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
                <p className="absolute inset-x-0 bottom-0 p-3 font-display text-sm font-bold leading-snug text-white line-clamp-2">{s.title}</p>
              </div>
              <p className="px-3 py-2 text-[11px] font-medium text-ink/55 dark:text-moonlight/55">
                {ar ? `${s.pages} صفحات` : `${s.pages} pages`} · {new Date(s.updatedAt).toLocaleDateString(ar ? 'ar' : 'en')}
              </p>
            </button>
            {confirmId === s.id ? (
              <div className="absolute inset-x-2 top-2 flex gap-1.5">
                <button type="button" onClick={() => remove(s.id)} className="min-h-11 flex-1 rounded-full bg-coral text-xs font-bold text-white">
                  {ar ? 'احذف' : 'Delete'}
                </button>
                <button type="button" onClick={() => setConfirmId(null)} className="min-h-11 flex-1 rounded-full bg-white/90 text-xs font-bold text-ink">
                  {ar ? 'تراجع' : 'Cancel'}
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmId(s.id)}
                className="absolute top-2 end-2 flex h-11 w-11 items-center justify-center rounded-full bg-black/45 text-white opacity-90 backdrop-blur transition active:scale-95"
                aria-label={ar ? 'حذف القصة' : 'Delete story'}
              >
                <Trash2 size={16} />
              </button>
            )}
          </li>
        ))}
      </ul>
      <p className="text-center text-xs text-ink/45 dark:text-moonlight/45">
        {ar ? 'محفوظة على هذا الجهاز فقط' : 'Saved on this device only'}
      </p>
    </div>
  );
}
