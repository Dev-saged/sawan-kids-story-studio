import { useEffect, useRef, useState } from 'react';
import { Clapperboard, Download, Loader2, Music2, Share2, X } from 'lucide-react';
import { saveAs } from 'file-saver';
import { NarratorVoice, StoryData, VeoMotionMode } from '../../types';
import { exportStoryVideo, type VideoResult } from '../../services/video';
import { maxQuality, VIDEO_FORMATS, VIDEO_QUALITIES, type VideoFormatId, type VideoQualityId } from '../../services/videoFormats';
import { safeFileName } from '../../services/export';
import { BRAND } from '../../config';
import ErrorDetails from '../common/ErrorDetails';

interface Props {
  storyData: StoryData;
  ar: boolean;
  voice: NarratorVoice;
  onClose: () => void;
}

export default function VideoExportSheet({ storyData, ar, voice, onClose }: Props) {
  const allowed = VIDEO_QUALITIES.findIndex((q) => q.id === maxQuality());
  const [format, setFormat] = useState<VideoFormatId>('landscape');
  const [quality, setQuality] = useState<VideoQualityId>(VIDEO_QUALITIES[Math.min(1, allowed)].id);
  const [veoMotionMode, setVeoMotionMode] = useState<VeoMotionMode>('auto-composite');
  const [withMusic, setWithMusic] = useState(true);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<VideoResult | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const ctrlRef = useRef<AbortController | null>(null);

  const missing = storyData.pages.filter((p) => !p.generatedImage).length;
  const fileName = `${safeFileName(storyData.story_info.title, 'story')}-${format}-${result?.height ? Math.min(result.width, result.height) : 0}p.${result?.ext ?? 'mp4'}`;

  useEffect(
    () => () => {
      ctrlRef.current?.abort();
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    },
    [previewUrl]
  );

  const start = async () => {
    const ctrl = new AbortController();
    ctrlRef.current = ctrl;
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const res = await exportStoryVideo(
        storyData,
        { format, quality, veoMotionMode, withMusic, voice, brand: ar ? `${BRAND.name.ar} · ${BRAND.author.ar}` : `${BRAND.name.en} · ${BRAND.author.en}`, tagline: ar ? BRAND.madeIn.ar : BRAND.madeIn.en },
        (p, m) => {
          setProgress(p);
          setMessage(m);
        },
        ctrl.signal
      );
      setResult(res);
      setPreviewUrl(URL.createObjectURL(res.blob));
      navigator.vibrate?.(30);
    } catch (err) {
      if ((err as Error).name !== 'AbortError') setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const share = async () => {
    if (!result) return;
    const file = new File([result.blob], fileName, { type: result.blob.type });
    try {
      if (navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file], title: storyData.story_info.title });
      else saveAs(result.blob, fileName);
    } catch {
      // ignore
    }
  };

  const option = (active: boolean) =>
    `flex min-h-12 flex-1 items-center justify-center gap-2 rounded-2xl border px-3 text-sm font-semibold transition ${
      active ? 'border-lantern bg-lantern/15 text-ink dark:text-moonlight' : 'border-dream/30 text-ink/70 dark:text-moonlight/70'
    }`;

  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-end justify-center bg-black/55 backdrop-blur-sm sm:items-center" onClick={busy ? undefined : onClose}>
      <div
        dir={ar ? 'rtl' : 'ltr'}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[92vh] w-full max-w-lg space-y-4 overflow-y-auto rounded-t-3xl bg-moonlight p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-2xl sm:rounded-3xl dark:bg-dusk"
      >
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 font-display text-lg font-bold text-ink dark:text-moonlight">
            <Clapperboard size={20} className="text-lantern" aria-hidden />
            {ar ? 'فيديو القصة' : 'Story video'}
          </h2>
          <button type="button" onClick={onClose} disabled={busy} className="flex h-11 w-11 items-center justify-center rounded-full text-ink/70 disabled:opacity-30 dark:text-moonlight/70" aria-label={ar ? 'إغلاق' : 'Close'}>
            <X size={20} />
          </button>
        </div>

        {!result && (
          <>
            <p className="text-sm text-ink/70 dark:text-moonlight/70">
              {ar
                ? 'فيديو سينمائي: صور القصة بحركة كاميرا، صوت الراوي، النص مكتوب ومتزامن كلمة بكلمة، انتقالات وموشن وموسيقى مولّدة بالذكاء الاصطناعي.'
                : 'Cinematic video: moving illustrations, narration, word-by-word synced captions, transitions, motion and AI-composed music.'}
            </p>
            <div role="radiogroup" aria-label={ar ? 'صيغة الفيديو' : 'Video format'} className="grid grid-cols-2 gap-2">
              {VIDEO_FORMATS.map((f) => (
                <button key={f.id} type="button" role="radio" aria-checked={format === f.id} disabled={busy} className={`${option(format === f.id)} flex-col !items-start gap-0.5 py-2 text-start`} onClick={() => setFormat(f.id)}>
                  <span className="flex items-center gap-2">
                    <span aria-hidden className="inline-block rounded-[3px] border-2 border-current" style={{ width: f.ratio >= 1 ? 22 : 22 * f.ratio, height: f.ratio >= 1 ? 22 / f.ratio : 22 }} />
                    {ar ? f.label.ar : f.label.en}
                  </span>
                  <span className="text-[11px] font-medium opacity-70">{ar ? f.hint.ar : f.hint.en}</span>
                </button>
              ))}
            </div>
            <div role="radiogroup" aria-label={ar ? 'جودة الفيديو' : 'Video quality'} className="flex gap-2">
              {VIDEO_QUALITIES.map((q, i) => (
                <button key={q.id} type="button" role="radio" aria-checked={quality === q.id} disabled={busy || i > allowed} className={`${option(quality === q.id)} flex-col gap-0.5 py-2 disabled:opacity-35`} onClick={() => setQuality(q.id)}>
                  {ar ? q.label.ar : q.label.en}
                  <span className="text-[11px] font-medium opacity-70">{ar ? q.hint.ar : q.hint.en}</span>
                </button>
              ))}
            </div>
            {allowed < VIDEO_QUALITIES.length - 1 && (
              <p className="text-xs text-ink/60 dark:text-moonlight/60">{ar ? 'الجودات الأعلى معطّلة لحماية ذاكرة هذا الجهاز.' : 'Higher qualities are disabled to protect this device memory.'}</p>
            )}

            {/* وضعيات حركة الكاميرا Veo 3 */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-ink/80 dark:text-moonlight/80">
                {ar ? 'نمط حركة كاميرا Veo 3:' : 'Veo 3 Camera Motion Mode:'}
              </label>
              <div role="radiogroup" aria-label={ar ? 'نمط حركة كاميرا Veo 3' : 'Veo 3 Camera Motion Mode'} className="flex flex-col gap-1.5">
                {(
                  [
                    {
                      id: 'auto-composite',
                      title: { ar: '🎬 مونتاج آلي شامل (دمج جميع حركات Veo 3 تلقائياً)', en: '🎬 Full Auto Production (Combines All Veo 3 Motions)' },
                      desc: { ar: 'تبديل آلي ذكي بين الحركة السينمائية و2.5D والمسح متعدد الزوايا لكل مشهد', en: 'Smart automated switching between Cinematic, 2.5D Depth, and 3D Sweeps per scene' },
                    },
                    {
                      id: 'cinematic-pack',
                      title: { ar: '1: حزمة مؤثرات سينمائية كاملة', en: '1: Full Cinematic Effects Pack' },
                      desc: { ar: 'تحريك كاميرا احترافي، زوم تدريجي وتفاعل عمق المشهد', en: 'Pro camera moves, smooth zoom, and dynamic scene depth' },
                    },
                    {
                      id: 'parallax-script',
                      title: { ar: '2: حركة 2.5D ديناميكية مع تأثير المنظر', en: '2: 2.5D Dynamic Motion with Parallax Effect' },
                      desc: { ar: 'إحساس ثلاثي الأبعاد مع طبقات هواء وتحريك بارالاكس', en: '3D spatial feel with multi-layer depth & parallax' },
                    },
                    {
                      id: 'sweeps-3d',
                      title: { ar: '3: مسح ثلاثي الأبعاد متعدد الزوايا', en: '3: Multi-Angle 3D Camera Sweeps' },
                      desc: { ar: 'مسح كاميرا واسع النطاق يحيط بالشخصيات بمرونة', en: 'Sweeping orbital camera angles around scene heroes' },
                    },
                  ] as const
                ).map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    role="radio"
                    aria-checked={veoMotionMode === m.id}
                    disabled={busy}
                    onClick={() => setVeoMotionMode(m.id)}
                    className={`${option(veoMotionMode === m.id)} flex-col !items-start gap-0.5 py-2 text-start`}
                  >
                    <span className="text-xs font-bold">{ar ? m.title.ar : m.title.en}</span>
                    <span className="text-[11px] font-medium opacity-70">{ar ? m.desc.ar : m.desc.en}</span>
                  </button>
                ))}
              </div>
            </div>
            <label className="flex min-h-12 cursor-pointer items-center justify-between rounded-2xl border border-dream/30 px-4 text-sm font-semibold text-ink dark:text-moonlight">
              <span className="flex items-center gap-2">
                <Music2 size={18} className="text-dream" aria-hidden />
                {ar ? 'موسيقى خلفية مولّدة' : 'AI background music'}
              </span>
              <input type="checkbox" checked={withMusic} disabled={busy} onChange={(e) => setWithMusic(e.target.checked)} className="h-5 w-5 accent-[var(--color-lantern)]" />
            </label>
            {missing > 0 && (
              <p className="rounded-2xl bg-coral/10 px-4 py-2.5 text-xs text-coral">
                {ar ? `${missing} صفحة بدون صورة بعد — ستستخدم الصورة السابقة. انتظر اكتمال الرسم لأفضل نتيجة.` : `${missing} page(s) have no picture yet — the previous picture will be used.`}
              </p>
            )}
          </>
        )}

        {busy && (
          <div className="space-y-2" aria-live="polite">
            <div className="h-3 w-full overflow-hidden rounded-full bg-dream/20" role="progressbar" aria-valuenow={Math.round(progress * 100)} aria-valuemin={0} aria-valuemax={100}>
              <div className="h-full rounded-full bg-lantern transition-[width] duration-300" style={{ width: `${Math.round(progress * 100)}%` }} />
            </div>
            <p className="flex items-center gap-2 text-sm text-ink/70 dark:text-moonlight/70">
              <Loader2 size={14} className="animate-spin text-lantern" aria-hidden />
              {message}
            </p>
            <p className="text-xs text-ink/50 dark:text-moonlight/50">{ar ? 'نُبقي الشاشة مضاءة تلقائياً أثناء التصدير؛ لا تغادر هذه الصفحة حتى ينتهي.' : 'The screen stays awake during export; stay on this page until it finishes.'}</p>
          </div>
        )}

        {error && (
          <div className="rounded-2xl bg-coral/10 px-4 py-2.5 text-sm text-coral">
            <p>{error}</p>
            <ErrorDetails ar={ar} />
          </div>
        )}

        {result && previewUrl && (
          <div className="space-y-3">
            <video src={previewUrl} controls playsInline className="w-full rounded-2xl bg-black" />
            {result.musicFailed && (
              <p className="text-xs text-ink/60 dark:text-moonlight/60">{ar ? 'تعذّر توليد الموسيقى الآن، فصدر الفيديو بصوت الراوي فقط.' : 'Music could not be generated now; the video has narration only.'}</p>
            )}
            <div className="flex gap-2">
              <button type="button" onClick={() => saveAs(result.blob, fileName)} className="flex min-h-12 flex-1 items-center justify-center gap-2 rounded-2xl bg-lantern font-display text-sm font-bold text-ink shadow-sm active:scale-95">
                <Download size={18} aria-hidden /> {ar ? 'تنزيل الفيديو' : 'Download video'}
              </button>
              <button type="button" onClick={share} className="flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-dream/30 px-4 text-sm font-semibold text-ink active:scale-95 dark:text-moonlight">
                <Share2 size={18} aria-hidden /> {ar ? 'مشاركة' : 'Share'}
              </button>
            </div>
          </div>
        )}

        {!result && (
          <div className="flex gap-2">
            {busy ? (
              <button type="button" onClick={() => ctrlRef.current?.abort()} className="flex min-h-12 flex-1 items-center justify-center rounded-2xl border border-coral/40 text-sm font-semibold text-coral">
                {ar ? 'إلغاء' : 'Cancel'}
              </button>
            ) : (
              <button type="button" onClick={start} className="flex min-h-12 flex-1 items-center justify-center gap-2 rounded-2xl bg-lantern font-display text-sm font-bold text-ink shadow-lg shadow-lantern/30 active:scale-95">
                <Clapperboard size={18} aria-hidden /> {ar ? 'اصنع الفيديو' : 'Create video'}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
