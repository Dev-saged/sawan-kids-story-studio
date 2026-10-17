import { useEffect, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { preflight, type ApiErrorCode } from '../../services/api';
import ErrorDetails from '../common/ErrorDetails';
import FreeEngineCard from './FreeEngineCard';

type Problem = 'AUTH' | 'NOKEY' | 'NOIMAGE' | 'NOTTS' | null;

const TEXT: Record<Exclude<Problem, null>, { ar: string; en: string }> = {
  AUTH: { ar: 'Google رفضت هذا المفتاح. غيّر المفتاح أو تأكد من نسخه كاملاً.', en: 'Google rejected this key. Change it or make sure you copied it fully.' },
  NOKEY: {
    ar: 'الخادم بلا مفتاح Gemini، فلن تعمل كتابة القصة. أدخل مفتاحك الخاص (ترسم الصور من جهازك مباشرة)، أو أضف GEMINI_API_KEY في AI Studio من Settings ثم Secrets.',
    en: 'The server has no Gemini key, so story writing will not work. Enter your own key (images are drawn straight from your device), or add GEMINI_API_KEY in AI Studio under Settings, then Secrets.',
  },
  NOIMAGE: {
    ar: 'لا يوجد نموذج صور متاح لهذا المفتاح، فلن تُرسم الصور. فعّل الصور المجانية أدناه أو استخدم مفتاحاً من مشروع مفوتر.',
    en: 'No image model is available for this key, so pictures will not be drawn. Enable free images below or use a key from a billed project.',
  },
  NOTTS: { ar: 'لا يوجد نموذج صوت متاح لهذا المفتاح، فلن تعمل القراءة بالصوت.', en: 'No voice model is available for this key, so narration will not work.' },
};

// فحص صامت عند فتح الاستوديو: يحذّر قبل أن ينتظر المستخدم دقائق
export default function PreflightBanner({ ar, checkKey, onNeedKey }: { ar: boolean; checkKey: string; onNeedKey?: () => void }) {
  const [problem, setProblem] = useState<Problem>(null);
  const [freeOff, setFreeOff] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const ctrl = new AbortController();
    preflight(ctrl.signal).then((r) => {
      if (ctrl.signal.aborted) return;
      setFreeOff(r.ok && r.free?.configured === false);
      if (!r.ok) setProblem((r.code as ApiErrorCode) === 'AUTH' ? 'AUTH' : (r.code as ApiErrorCode) === 'NOKEY' ? 'NOKEY' : null);
      else if (r.listed && !r.models.image.length && !r.free?.configured) setProblem('NOIMAGE');
      else if (r.listed && !r.models.tts.length) setProblem('NOTTS');
      else setProblem(null);
    });
    return () => ctrl.abort();
  }, [checkKey, tick]);

  return (
    <>
      {problem && (
        <div role="alert" className="space-y-1 rounded-2xl border border-coral/30 bg-coral/10 px-4 py-3 text-sm text-coral">
          <p className="flex items-start gap-2">
            <AlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden />
            {ar ? TEXT[problem].ar : TEXT[problem].en}
          </p>
          {problem === 'NOKEY' && onNeedKey && (
            <button type="button" onClick={onNeedKey} className="min-h-11 w-full rounded-full bg-lantern py-2 font-display font-semibold text-ink active:scale-95">
              {ar ? 'أدخل مفتاحي' : 'Enter my key'}
            </button>
          )}
          <ErrorDetails ar={ar} />
        </div>
      )}
      {freeOff && <FreeEngineCard ar={ar} mode="hint" onSaved={() => setTick((n) => n + 1)} />}
    </>
  );
}
