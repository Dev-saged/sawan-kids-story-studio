import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { Camera, Check, Crown, Loader2, X } from 'lucide-react';
import { ChildProfile } from '../../types';
import { deleteChild, listChildren, saveChild } from '../../services/library';

type Child = ChildProfile & { photoUrl?: string };

interface Props {
  ar: boolean;
  selectedId: string | null;
  onSelect: (child: Child | null) => void;
}

// بطل القصة (طفل أو شاب أو شخص كبير بالغ): صورته مرجع ثابت للرسام في كل الصفحات
export default function HeroPicker({ ar, selectedId, onSelect }: Props) {
  const [children, setChildren] = useState<Child[]>([]);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [ageStage, setAgeStage] = useState<'child' | 'teen' | 'adult'>('child');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    listChildren().then(setChildren);
  }, []);

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  const pick = (e: ChangeEvent<HTMLInputElement>) => {
    setError(null);
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    setFile(f);
    setPreview(URL.createObjectURL(f));
  };

  const add = async () => {
    if (!file || !name.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const child = await saveChild(name, file, ageStage);
      setChildren((c) => [child, ...c]);
      onSelect(child);
      setName('');
      setFile(null);
      setPreview(null);
      setOpen(false);
    } catch (err: any) {
      console.error('Failed to save child photo:', err);
      setError(ar ? 'تعذّر حفظ الصورة، جرب صورة أخرى بحجم أصغر.' : 'Failed to save photo, try a different image.');
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    await deleteChild(id);
    setChildren((c) => c.filter((x) => x.id !== id));
    if (selectedId === id) onSelect(null);
  };

  const stageLabel = (stage?: 'child' | 'teen' | 'adult') => {
    if (stage === 'adult') return ar ? 'بالغ' : 'Adult';
    if (stage === 'teen') return ar ? 'شاب' : 'Teen';
    return ar ? 'طفل' : 'Child';
  };

  return (
    <section className="space-y-3 rounded-3xl border border-lantern/30 bg-gradient-to-br from-star/25 to-transparent p-4 dark:from-lantern/10">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Crown size={18} className="text-lantern" aria-hidden />
          <h3 className="font-display text-sm font-bold text-ink dark:text-moonlight">
            {ar ? 'اجعل بطلك في القصة (طفل أو شخص كبير)' : 'Make your hero (child or adult)'}
          </h3>
          <span className="text-xs text-ink/50 dark:text-moonlight/50">{ar ? '(اختياري)' : '(optional)'}</span>
        </div>
      </div>

      <div className="flex gap-3 overflow-x-auto pb-1 [scrollbar-width:none]">
        {children.map((c) => {
          const active = c.id === selectedId;
          return (
            <div key={c.id} className="relative shrink-0">
              <button
                type="button"
                onClick={() => onSelect(active ? null : c)}
                className={`flex w-22 flex-col items-center gap-1 rounded-2xl p-1.5 transition ${active ? 'bg-lantern/20 ring-2 ring-lantern' : 'hover:bg-dream/10'}`}
                aria-pressed={active}
              >
                <span className="relative h-16 w-16 overflow-hidden rounded-full bg-dream/20">
                  {c.photoUrl && <img src={c.photoUrl} alt="" className="h-full w-full object-cover" />}
                  {active && (
                    <span className="absolute inset-0 flex items-center justify-center bg-lantern/50">
                      <Check size={22} className="text-ink" aria-hidden />
                    </span>
                  )}
                </span>
                <span className="w-full truncate text-center text-xs font-semibold text-ink dark:text-moonlight">{c.name}</span>
                <span className="rounded-md bg-ink/10 px-1.5 py-0.5 text-[10px] font-bold text-ink/80 dark:bg-white/15 dark:text-moonlight">
                  {stageLabel(c.ageStage)}
                </span>
              </button>
              <button
                type="button"
                onClick={() => remove(c.id)}
                className="absolute -top-1 end-0 flex h-7 w-7 items-center justify-center rounded-full bg-white text-ink/60 shadow dark:bg-dusk dark:text-moonlight/60"
                aria-label={ar ? `حذف ${c.name}` : `Remove ${c.name}`}
              >
                <X size={13} />
              </button>
            </div>
          );
        })}
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="flex w-22 shrink-0 flex-col items-center gap-1.5 rounded-2xl p-1.5 text-ink/60 transition hover:bg-dream/10 dark:text-moonlight/60"
        >
          <span className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-dashed border-dream/50">
            <Camera size={22} aria-hidden />
          </span>
          <span className="text-xs font-semibold">{ar ? 'أضف بطلاً' : 'Add hero'}</span>
        </button>
      </div>

      {open && (
        <div className="space-y-2.5 animate-[fadeUp_300ms_ease-out] rounded-2xl border border-dream/20 bg-white/50 p-3 dark:bg-white/5">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full border border-dream/30 bg-white/70 dark:bg-white/10"
              aria-label={ar ? 'اختر صورة' : 'Choose photo'}
            >
              {preview ? <img src={preview} alt="" className="h-full w-full object-cover" /> : <Camera size={20} className="text-dream" aria-hidden />}
            </button>
            <input
              value={name}
              onChange={(e) => setName(e.target.value.slice(0, 40))}
              placeholder={ar ? 'اسم البطل (طفل أو شخص كبير)' : 'Hero name (child or adult)'}
              className="min-h-11 min-w-0 flex-1 rounded-2xl border border-dream/30 bg-white/70 px-3 text-sm text-ink outline-none focus-visible:border-lantern focus-visible:ring-2 focus-visible:ring-lantern/40 dark:bg-white/10 dark:text-moonlight"
            />
            <button
              type="button"
              disabled={!file || !name.trim() || busy}
              onClick={add}
              className="flex min-h-11 shrink-0 items-center gap-1 rounded-2xl bg-lantern px-4 text-sm font-bold text-ink disabled:opacity-40"
            >
              {busy ? <Loader2 size={16} className="animate-spin" aria-hidden /> : <Check size={16} aria-hidden />}
              {ar ? 'حفظ' : 'Save'}
            </button>
            <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={pick} />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold text-ink/75 dark:text-moonlight/80">
              {ar ? 'عمر البطل في الرسم:' : 'Hero age in illustrations:'}
            </span>
            {(
              [
                { id: 'child', ar: 'طفل (ملامح طفولية)', en: 'Child' },
                { id: 'teen', ar: 'شاب / يافع', en: 'Teen / Youth' },
                { id: 'adult', ar: 'شخص كبير / بالغ (18+)', en: 'Adult (18+)' },
              ] as const
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setAgeStage(opt.id)}
                className={`rounded-xl px-3 py-1.5 text-xs font-bold transition ${
                  ageStage === opt.id
                    ? 'bg-ink text-paper dark:bg-lantern dark:text-ink'
                    : 'border border-ink/15 bg-white/80 text-ink/80 hover:bg-ink/5 dark:border-white/15 dark:bg-white/10 dark:text-moonlight'
                }`}
              >
                {ar ? opt.ar : opt.en}
              </button>
            ))}
          </div>
        </div>
      )}
      {error && (
        <p className="text-xs font-semibold text-coral animate-shake">
          {error}
        </p>
      )}
      <p className="text-xs text-ink/55 dark:text-moonlight/55">
        {ar
          ? 'الصورة تُحفظ على جهازك وتُرسل فقط إلى Gemini لرسم البطل (سواء كان طفلاً أو شخصاً كبيراً) بملامحه داخل القصة.'
          : 'The photo is saved on your device and sent only to Gemini to draw the hero (child or adult) in the story.'}
      </p>
    </section>
  );
}
