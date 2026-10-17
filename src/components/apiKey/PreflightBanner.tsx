import { useEffect, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { preflight, type ApiErrorCode } from '../../services/api';
import ErrorDetails from '../common/ErrorDetails';

type Problem = 'AUTH' | 'NOIMAGE' | 'NOTTS' | null;

const TEXT: Record<Exclude<Problem, null>, { ar: string; en: string }> = {
  AUTH: { ar: 'Google رفضت هذا المفتاح. غيّر المفتاح أو تأكد من نسخه كاملاً.', en: 'Google rejected this key. Change it or make sure you copied it fully.' },
  NOIMAGE: {
    ar: 'لا يوجد نموذج صور متاح لهذا المفتاح، فلن تُرسم الصور. جرّب مفتاحاً من مشروع مفوتر.',
    en: 'No image model is available for this key, so pictures will not be drawn. Try a key from a billed project.',
  },
  NOTTS: { ar: 'لا يوجد نموذج صوت متاح لهذا المفتاح، فلن تعمل القراءة بالصوت.', en: 'No voice model is available for this key, so narration will not work.' },
};

// فحص صامت عند فتح الاستوديو: يحذّر قبل أن ينتظر المستخدم دقائق
export default function PreflightBanner({ ar, checkKey }: { ar: boolean; checkKey: string }) {
  const [problem, setProblem] = useState<Problem>(null);

  useEffect(() => {
    const ctrl = new AbortController();
    preflight(ctrl.signal).then((r) => {
      if (ctrl.signal.aborted) return;
      if (!r.ok) setProblem((r.code as ApiErrorCode) === 'AUTH' ? 'AUTH' : null);
      else if (r.listed && !r.models.image.length) setProblem('NOIMAGE');
      else if (r.listed && !r.models.tts.length) setProblem('NOTTS');
      else setProblem(null);
    });
    return () => ctrl.abort();
  }, [checkKey]);

  if (!problem) return null;
  return (
    <div role="alert" className="space-y-1 rounded-2xl border border-coral/30 bg-coral/10 px-4 py-3 text-sm text-coral">
      <p className="flex items-start gap-2">
        <AlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden />
        {ar ? TEXT[problem].ar : TEXT[problem].en}
      </p>
      <ErrorDetails ar={ar} />
    </div>
  );
}
