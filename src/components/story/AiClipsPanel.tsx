import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Check, Film, Loader2, Trash2, TriangleAlert } from 'lucide-react';
import type { StoryData } from '../../types';
import { clipsByPage, deleteClipsOf, generateClip, listClips, planClips, storyKey, type StoredClip } from '../../services/videoClips';
import { CLIP_SECONDS, OMNI_USD_PER_SECOND, estimateCostUsd, type ClipPlan } from '../../shared/modelRules';
import ErrorDetails from '../common/ErrorDetails';

interface Props {
  story: StoryData;
  ar: boolean;
  locked: boolean;
  onClips: (clips: Map<number, Blob[]>) => void;
}

const CONCURRENCY = 2;

export default function AiClipsPanel({ story, ar, locked, onClips }: Props) {
  const [stored, setStored] = useState<StoredClip[]>([]);
  const [plans, setPlans] = useState<ClipPlan[] | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [planning, setPlanning] = useState(false);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(0);
  const [total, setTotal] = useState(0);
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ctrlRef = useRef<AbortController | null>(null);

  const refresh = useCallback(async () => {
    const list = await listClips(storyKey(story)).catch(() => [] as StoredClip[]);
    setStored(list);
    onClips(clipsByPage(list));
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [story.id]);

  useEffect(() => {
    void refresh();
    return () => ctrlRef.current?.abort();
  }, [refresh]);

  const readyIds = useMemo(() => new Set(stored.map((c) => c.id)), [stored]);
  const hasImage = (page: number) => Boolean(story.pages.find((p) => p.page === page)?.imageId);
  const pagesOf = useMemo(() => [...new Set((plans ?? []).map((p) => p.page))], [plans]);
  const pageReady = (page: number) => (plans ?? []).filter((p) => p.page === page).every((p) => readyIds.has(p.id));
  const todo = useMemo(() => (plans ?? []).filter((p) => selected.has(p.page) && !readyIds.has(p.id)), [plans, selected, readyIds]);
  const cost = estimateCostUsd(todo.length);

  const makePlan = async () => {
    setPlanning(true);
    setError(null);
    try {
      const list = await planClips(story);
      setPlans(list);
      setSelected(new Set(list.filter((p) => hasImage(p.page)).map((p) => p.page)));
    } catch (err) {
      if ((err as Error).name !== 'AbortError') setError((err as Error).message);
    } finally {
      setPlanning(false);
    }
  };

  const toggle = (page: number) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(page)) next.delete(page);
      else next.add(page);
      return next;
    });

  const generate = async () => {
    if (!plans || !todo.length) return;
    const ctrl = new AbortController();
    ctrlRef.current = ctrl;
    setRunning(true);
    setError(null);
    setDone(0);
    setTotal(todo.length);
    // كل صفحة سلسلة أجزاء متتابعة (الجزء الثاني يمتد من الأول)؛ والصفحات تعمل بالتوازي بحد أقصى
    const groups = pagesOf.filter((pg) => selected.has(pg)).map((pg) => plans.filter((p) => p.page === pg));
    let cursor = 0;
    let failure: Error | null = null;
    const worker = async () => {
      while (cursor < groups.length && !failure && !ctrl.signal.aborted) {
        const group = groups[cursor++];
        let prev: StoredClip | undefined = stored.find((c) => c.id === group[0].id);
        for (const plan of group) {
          if (failure || ctrl.signal.aborted) return;
          const existing = (await listClips(storyKey(story))).find((c) => c.id === plan.id);
          if (existing) {
            prev = existing;
            continue;
          }
          try {
            prev = await generateClip(story, plan, prev, ctrl.signal);
            setDone((d) => d + 1);
            await refresh();
          } catch (err) {
            if ((err as Error).name !== 'AbortError') failure = err as Error;
            return;
          }
        }
      }
    };
    await Promise.all(Array.from({ length: CONCURRENCY }, worker));
    setRunning(false);
    if (failure) setError((failure as Error).message);
    navigator.vibrate?.(failure ? 0 : 30);
  };

  const clear = async () => {
    await deleteClipsOf(storyKey(story));
    await refresh();
  };

  const billing = error && /مدفوع|Billing|billing/.test(error);
  const disabled = locked || running;

  return (
    <div className="space-y-3 rounded-2xl border border-lantern/40 bg-lantern/10 p-3.5" data-testid="ai-clips-panel">
      <p className="text-xs leading-relaxed text-ink/75 dark:text-moonlight/75">
        {ar
          ? `نحرّك رسوم كل صفحة بنموذج Gemini Omni (مقطع ≈ ${CLIP_SECONDS} ثوانٍ، بلا صوت)، وصوت الراوي والترجمة من التطبيق. الخدمة مدفوعة: ≈ $${OMNI_USD_PER_SECOND.toFixed(2)} للثانية.`
          : `Each page illustration is animated with Gemini Omni (~${CLIP_SECONDS}s clip, silent) while narration and captions come from the app. Paid service: ~$${OMNI_USD_PER_SECOND.toFixed(2)}/second.`}
      </p>

      {!plans && (
        <button type="button" onClick={makePlan} disabled={disabled || planning} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl border border-lantern bg-white/70 text-sm font-bold text-ink active:scale-95 disabled:opacity-50 dark:bg-white/10 dark:text-moonlight">
          {planning ? <Loader2 size={16} className="animate-spin" aria-hidden /> : <Film size={16} aria-hidden />}
          {ar ? 'قسّم القصة إلى مقاطع' : 'Split the story into clips'}
        </button>
      )}

      {plans && (
        <>
          <div className="grid grid-cols-4 gap-2" role="group" aria-label={ar ? 'الصفحات المراد تحريكها' : 'Pages to animate'}>
            {pagesOf.map((pg) => {
              const parts = plans.filter((p) => p.page === pg).length;
              const ok = pageReady(pg);
              const missing = !hasImage(pg);
              return (
                <button
                  key={pg}
                  type="button"
                  disabled={disabled || missing}
                  aria-pressed={selected.has(pg)}
                  onClick={() => toggle(pg)}
                  className={`relative flex min-h-12 flex-col items-center justify-center rounded-xl border text-xs font-bold transition disabled:opacity-35 ${
                    selected.has(pg) ? 'border-lantern bg-lantern/25 text-ink dark:text-moonlight' : 'border-dream/30 text-ink/65 dark:text-moonlight/65'
                  }`}
                >
                  <span>{ar ? `ص ${pg}` : `P${pg}`}</span>
                  <span className="text-[10px] font-medium opacity-70">{parts > 1 ? (ar ? `${parts} مقاطع` : `${parts} clips`) : ar ? 'مقطع' : 'clip'}</span>
                  {ok && <Check size={12} className="absolute end-1 top-1 text-emerald-600" aria-label={ar ? 'جاهز' : 'Ready'} />}
                </button>
              );
            })}
          </div>
          <p className="text-[11px] text-ink/60 dark:text-moonlight/60">
            {ar ? 'الصفحات غير المحددة تبقى بحركة الكاميرا المجانية داخل نفس الفيديو.' : 'Unselected pages keep the free camera motion inside the same video.'}
          </p>

          {todo.length > 0 ? (
            <>
              <p className="rounded-xl bg-white/60 px-3 py-2 text-sm font-bold text-ink dark:bg-white/10 dark:text-moonlight" data-testid="ai-clips-cost">
                {ar ? `${todo.length} مقطع جديد ≈ $${cost.toFixed(2)} (تقدير)` : `${todo.length} new clip(s) ≈ $${cost.toFixed(2)} (estimate)`}
              </p>
              <label className="flex cursor-pointer items-start gap-2.5 text-xs text-ink/80 dark:text-moonlight/80">
                <input type="checkbox" checked={agreed} disabled={disabled} onChange={(e) => setAgreed(e.target.checked)} className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--color-lantern)]" />
                <span>{ar ? 'أفهم أن التوليد يُحاسَب على مفتاح Gemini الخاص بي، وأن السعر تقديري وقد يختلف.' : 'I understand generation is billed to my Gemini key and the price is an estimate.'}</span>
              </label>
              <button type="button" onClick={generate} disabled={disabled || !agreed} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-lantern font-display text-sm font-bold text-ink shadow-md active:scale-95 disabled:opacity-45">
                {running ? <Loader2 size={16} className="animate-spin" aria-hidden /> : <Film size={16} aria-hidden />}
                {running ? (ar ? `يُولَّد ${done} / ${total}…` : `Generating ${done} / ${total}…`) : ar ? 'ولّد المقاطع' : 'Generate clips'}
              </button>
            </>
          ) : (
            <p className="text-xs font-semibold text-ink/70 dark:text-moonlight/70">{ar ? 'كل الصفحات المحددة جاهزة. اصنع الفيديو بالأسفل.' : 'All selected pages are ready. Create the video below.'}</p>
          )}
          {running && (
            <button type="button" onClick={() => ctrlRef.current?.abort()} className="min-h-11 w-full rounded-2xl border border-coral/40 text-xs font-semibold text-coral">
              {ar ? 'إيقاف (ما اكتمل يبقى محفوظاً)' : 'Stop (finished clips stay saved)'}
            </button>
          )}
          {stored.length > 0 && !running && (
            <button type="button" onClick={clear} className="flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl text-xs font-semibold text-ink/60 dark:text-moonlight/60">
              <Trash2 size={14} aria-hidden /> {ar ? `حذف ${stored.length} مقطعاً محفوظاً` : `Delete ${stored.length} saved clip(s)`}
            </button>
          )}
        </>
      )}

      {error && (
        <div className="rounded-xl bg-coral/10 px-3 py-2 text-xs text-coral" role="alert">
          <p className="flex items-start gap-1.5">
            <TriangleAlert size={14} className="mt-0.5 shrink-0" aria-hidden />
            <span>{error}</span>
          </p>
          {billing && <p className="mt-1 opacity-80">{ar ? 'يمكنك إلغاء التحديد وتصدير الفيديو بحركة الكاميرا المجانية.' : 'You can deselect pages and export with the free camera motion.'}</p>}
          <ErrorDetails ar={ar} />
        </div>
      )}
    </div>
  );
}

