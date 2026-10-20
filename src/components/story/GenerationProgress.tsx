import { Pause, Play } from 'lucide-react';
import { Language } from '../../types';
import { LanternSvg } from '../common/BrandIcons';

interface Props {
  progress: number;
  message: string;
  preview?: string;
  isPaused: boolean;
  onPause: () => void;
  onResume: () => void;
  language: Language;
}

export default function GenerationProgress({ progress, message, preview, isPaused, onPause, onResume, language }: Props) {
  const ar = language === 'Arabic';

  return (
    <div dir={ar ? 'rtl' : 'ltr'} className="space-y-5 rounded-3xl border border-dream/25 bg-white/75 p-6 text-center shadow-sm dark:bg-white/5">
      <div className="flex justify-center text-lantern" aria-hidden>
        <LanternSvg className="h-11 w-11" />
      </div>
      <p className="font-display text-lg font-bold text-ink dark:text-moonlight">{message}</p>

      <div
        className="h-3.5 w-full overflow-hidden rounded-full bg-dream/20"
        role="progressbar"
        aria-valuenow={progress}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={ar ? 'نسبة تقدم إنشاء القصة' : 'Story generation progress'}
      >
        <div
          className="h-full w-full origin-right rounded-full bg-lantern transition-transform duration-500 ltr:origin-left"
          style={{ transform: `scaleX(${Math.max(0.02, Math.min(1, progress / 100))})` }}
        />
      </div>
      <p className="font-mono text-xs font-bold text-ink/70 dark:text-moonlight/70">{progress}%</p>

      {/* هيكل كتاب مفتوح (Skeleton Spread) يوضح إعداد الصفحات والرسوم بحركات opacity/transform خفيفة */}
      <div className="mx-auto grid max-w-2xl grid-cols-1 gap-3 sm:grid-cols-2" aria-hidden="true">
        <div className="flex aspect-[4/3] flex-col justify-between rounded-2xl border border-dream/20 bg-dream/10 p-4 animate-pulse">
          <div className="h-3 w-1/3 rounded-md bg-dream/25" />
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-lantern/15 text-lantern/60">
            <LanternSvg className="h-8 w-8" />
          </div>
          <div className="space-y-2">
            <div className="h-2.5 w-full rounded-md bg-dream/20" />
            <div className="h-2.5 w-2/3 rounded-md bg-dream/20" />
          </div>
        </div>

        <div className="flex aspect-[4/3] flex-col justify-between rounded-2xl border border-dream/20 bg-white/60 p-4 dark:bg-white/5">
          <div className="flex items-center justify-between">
            <span className="h-3 w-16 rounded-md bg-lantern/30" />
            <span className="h-3 w-8 rounded-md bg-dream/25" />
          </div>
          {preview ? (
            <p
              key={preview.slice(0, 24)}
              dir={ar ? 'rtl' : 'ltr'}
              className="line-clamp-4 animate-[fadeUp_400ms_ease-out] text-start text-xs leading-relaxed text-ink/85 dark:text-moonlight/85"
            >
              {preview}
            </p>
          ) : (
            <div className="space-y-2.5 animate-pulse">
              <div className="h-2.5 w-full rounded-md bg-dream/20" />
              <div className="h-2.5 w-11/12 rounded-md bg-dream/20" />
              <div className="h-2.5 w-4/5 rounded-md bg-dream/20" />
              <div className="h-2.5 w-3/5 rounded-md bg-dream/15" />
            </div>
          )}
          <div className="h-2 w-1/4 rounded-md bg-dream/20" />
        </div>
      </div>

      <button
        type="button"
        onClick={isPaused ? onResume : onPause}
        className="mx-auto flex min-h-11 items-center gap-2 rounded-full border border-dream/35 px-6 py-2.5 text-sm font-bold text-ink transition hover:border-lantern focus-visible:outline focus-visible:outline-2 focus-visible:outline-lantern dark:text-moonlight"
      >
        {isPaused ? <Play size={16} aria-hidden /> : <Pause size={16} aria-hidden />}
        {isPaused ? (ar ? 'استئناف التوليد' : 'Resume generation') : ar ? 'إيقاف مؤقت' : 'Pause'}
      </button>
    </div>
  );
}
