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

// طفلك بطل القصة: صورته مرجع ثابت للرسام في كل الصفحات
export default function HeroPicker({ ar, selectedId, onSelect }: Props) {
  const [children, setChildren] = useState<Child[]>([]);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    listChildren().then(setChildren);
  }, []);

  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview);
  }, [preview]);

  const pick = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f || !f.type.startsWith('image/')) return;
    setFile(f);
    setPreview(URL.createObjectURL(f));
  };

  const add = async () => {
    if (!file || !name.trim()) return;
    setBusy(true);
    try {
      const child = await saveChild(name, file);
      setChildren((c) => [child, ...c]);
      onSelect(child);
      setName('');
      setFile(null);
      setPreview(null);
      setOpen(false);
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    await deleteChild(id);
    setChildren((c) => c.filter((x) => x.id !== id));
    if (selectedId === id) onSelect(null);
  };

  return (
    <section className="space-y-3 rounded-3xl border border-lantern/30 bg-gradient-to-br from-star/25 to-transparent p-4 dark:from-lantern/10">
      <div className="flex items-center gap-2">
        <Crown size={18} className="text-lantern" aria-hidden />
        <h3 className="font-display text-sm font-bold text-ink dark:text-moonlight">{ar ? 'اجعل طفلك بطل القصة' : 'Make your child the hero'}</h3>
        <span className="text-xs text-ink/50 dark:text-moonlight/50">{ar ? '(اختياري)' : '(optional)'}</span>
      </div>

      <div className="flex gap-3 overflow-x-auto pb-1 [scrollbar-width:none]">
        {children.map((c) => {
          const active = c.id === selectedId;
          return (
            <div key={c.id} className="relative shrink-0">
              <button
                type="button"
                onClick={() => onSelect(active ? null : c)}
                className={`flex w-20 flex-col items-center gap-1.5 rounded-2xl p-1.5 transition ${active ? 'bg-lantern/20 ring-2 ring-lantern' : 'hover:bg-dream/10'}`}
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
          className="flex w-20 shrink-0 flex-col items-center gap-1.5 rounded-2xl p-1.5 text-ink/60 transition hover:bg-dream/10 dark:text-moonlight/60"
        >
          <span className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-dashed border-dream/50">
            <Camera size={22} aria-hidden />
          </span>
          <span className="text-xs font-semibold">{ar ? 'أضف طفلاً' : 'Add child'}</span>
        </button>
      </div>

      {open && (
        <div className="flex animate-[fadeUp_300ms_ease-out] items-center gap-3">
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
            placeholder={ar ? 'اسم الطفل' : 'Child name'}
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
      )}
      <p className="text-xs text-ink/55 dark:text-moonlight/55">
        {ar ? 'الصورة تُحفظ على جهازك وتُرسل فقط إلى Gemini لرسم طفلك داخل القصة.' : 'The photo is saved on your device and sent only to Gemini to draw your child in the story.'}
      </p>
    </section>
  );
}
