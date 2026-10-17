import { useEffect, useState } from 'react';
import { Camera, Check, Clapperboard, Copy, Loader2, Pencil, Sparkles } from 'lucide-react';
import type { StoryData, StoryPage } from '../../types';
import { animationPrompt } from '../../services/animation';
import { rewriteImagePrompt, type CameraAngle } from '../../services/gemini';
import ErrorDetails from '../common/ErrorDetails';

interface Props {
  story: StoryData;
  page: StoryPage;
  index: number;
  ar: boolean;
  onPaint: (pageNo: number, force?: boolean, prompt?: string) => Promise<void>;
}

const ANGLES: { id: CameraAngle; ar: string; en: string }[] = [
  { id: 'auto', ar: 'زاوية جديدة', en: 'New angle' },
  { id: 'wide', ar: 'لقطة واسعة', en: 'Wide' },
  { id: 'close', ar: 'قريبة', en: 'Close-up' },
  { id: 'low', ar: 'من الأسفل', en: 'Low' },
  { id: 'high', ar: 'من الأعلى', en: 'High' },
  { id: 'side', ar: 'جانبية', en: 'Side' },
  { id: 'back', ar: 'من الخلف', en: 'Behind' },
];

const copyText = async (text: string) => {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
};

// أدوات المشهد: تعديل وصف الصورة، إعادة كتابة الزاوية، إعادة الرسم، ونسخ برومبت التحريك
export default function PageTools({ story, page, index, ar, onPaint }: Props) {
  const [draft, setDraft] = useState(page.image_prompt);
  const [busy, setBusy] = useState<'angle' | 'paint' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<'anim' | 'img' | null>(null);

  useEffect(() => {
    setDraft(page.image_prompt);
    setError(null);
  }, [page.page, page.image_prompt]);

  const dirty = draft.trim() !== page.image_prompt.trim();

  const flash = async (kind: 'anim' | 'img', text: string) => {
    if (await copyText(text)) {
      setCopied(kind);
      setTimeout(() => setCopied(null), 2000);
    } else setError(ar ? 'تعذّر النسخ، انسخ النص يدوياً.' : 'Copy failed; select the text manually.');
  };

  const rewrite = async (angle: CameraAngle) => {
    setBusy('angle');
    setError(null);
    try {
      const next = await rewriteImagePrompt(draft, { angle, text: page.text });
      setDraft(next);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const paint = async () => {
    setBusy('paint');
    setError(null);
    try {
      await onPaint(page.page, true, dirty ? draft.trim() : undefined);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <details className="rounded-2xl border border-dream/20 bg-white/50 p-4 dark:bg-white/5" dir={ar ? 'rtl' : 'ltr'}>
      <summary className="flex min-h-11 cursor-pointer items-center gap-2 font-display text-sm font-semibold text-ink dark:text-moonlight">
        <Pencil size={16} aria-hidden />
        {ar ? 'أدوات هذا المشهد' : 'Scene tools'}
      </summary>

      <div className="mt-3 space-y-3">
        <label className="block text-xs font-semibold text-ink/70 dark:text-moonlight/70" htmlFor={`prompt-${page.page}`}>
          {ar ? 'وصف الصورة (يمكنك تعديله)' : 'Image prompt (editable)'}
        </label>
        <textarea
          id={`prompt-${page.page}`}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={4}
          maxLength={1200}
          dir="ltr"
          className="w-full resize-y rounded-2xl border border-dream/30 bg-white/80 p-3 text-start text-xs leading-relaxed text-ink outline-none focus-visible:ring-2 focus-visible:ring-lantern/50 dark:bg-white/10 dark:text-moonlight"
        />

        <div className="flex flex-wrap gap-1.5" role="group" aria-label={ar ? 'غيّر زاوية الكاميرا' : 'Change camera angle'}>
          {ANGLES.map((a) => (
            <button
              key={a.id}
              type="button"
              disabled={busy !== null}
              onClick={() => rewrite(a.id)}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-dream/30 bg-white/70 px-3.5 text-xs font-semibold text-ink transition hover:border-lantern active:scale-95 disabled:opacity-50 dark:bg-white/10 dark:text-moonlight"
            >
              {busy === 'angle' ? <Loader2 size={13} className="animate-spin" aria-hidden /> : <Camera size={13} aria-hidden />}
              {ar ? a.ar : a.en}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <button
            type="button"
            disabled={busy !== null || page.isGeneratingImage || !draft.trim()}
            onClick={paint}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-lantern px-4 text-xs font-bold text-ink shadow-xs transition hover:brightness-105 active:scale-95 disabled:opacity-50"
          >
            {busy === 'paint' || page.isGeneratingImage ? <Loader2 size={14} className="animate-spin" aria-hidden /> : <Sparkles size={14} aria-hidden />}
            {dirty ? (ar ? 'احفظ وارسم بالوصف الجديد' : 'Save & repaint') : ar ? 'أعد رسم المشهد' : 'Repaint scene'}
          </button>
          <button
            type="button"
            onClick={() => flash('img', draft)}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-dream/30 px-4 text-xs font-semibold text-ink transition hover:border-lantern active:scale-95 dark:text-moonlight"
          >
            {copied === 'img' ? <Check size={14} className="text-emerald-600" aria-hidden /> : <Copy size={14} aria-hidden />}
            {ar ? 'انسخ وصف الصورة' : 'Copy image prompt'}
          </button>
          <button
            type="button"
            onClick={() => flash('anim', animationPrompt(story, { ...page, image_prompt: draft }, index))}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-dream/30 px-4 text-xs font-semibold text-ink transition hover:border-lantern active:scale-95 dark:text-moonlight"
          >
            {copied === 'anim' ? <Check size={14} className="text-emerald-600" aria-hidden /> : <Clapperboard size={14} aria-hidden />}
            {ar ? 'انسخ برومبت التحريك' : 'Copy animation prompt'}
          </button>
        </div>

        {error && (
          <div role="alert" className="text-xs text-coral">
            <p>{error}</p>
            <ErrorDetails ar={ar} />
          </div>
        )}
      </div>
    </details>
  );
}
