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
    <div className="space-y-4 rounded-3xl border border-dream/20 bg-white/60 p-6 text-center dark:bg-white/5">
      <div className="flex justify-center text-lantern" aria-hidden>
        <LanternSvg className="w-10 h-10" />
      </div>
      <p className="font-display text-lg font-medium text-ink dark:text-moonlight">{message}</p>

      <div className="h-3 w-full overflow-hidden rounded-full bg-dream/20" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
        <div className="h-full rounded-full bg-lantern transition-all duration-500" style={{ width: `${progress}%` }} />
      </div>
      <p className="text-sm text-ink/60 dark:text-moonlight/60">{progress}%</p>

      {preview && (
        <p key={preview.slice(0, 24)} dir={ar ? 'rtl' : 'ltr'} className="mx-auto max-w-md animate-[fadeUp_500ms_ease-out] rounded-2xl bg-dream/10 px-4 py-3 text-start text-sm leading-relaxed text-ink/80 dark:text-moonlight/80">
          {preview}
        </p>
      )}

      <button
        type="button"
        onClick={isPaused ? onResume : onPause}
        className="mx-auto flex items-center gap-2 rounded-full border border-dream/30 px-5 py-2 text-sm font-medium text-ink transition hover:border-lantern focus-visible:outline focus-visible:outline-2 focus-visible:outline-lantern dark:text-moonlight"
      >
        {isPaused ? <Play size={16} aria-hidden /> : <Pause size={16} aria-hidden />}
        {isPaused ? (ar ? 'استئناف' : 'Resume') : ar ? 'إيقاف مؤقت' : 'Pause'}
      </button>
    </div>
  );
}
