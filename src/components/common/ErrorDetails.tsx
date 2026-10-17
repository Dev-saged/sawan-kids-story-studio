import { useState, useSyncExternalStore } from 'react';
import { Check, ClipboardCopy, ImageIcon, Stethoscope } from 'lucide-react';
import { getErrorLog, subscribeErrorLog } from '../../services/api';
import { getFreeCreds, keyHint } from '../../services/apiKey';
import { diagnoseImagePaths, directAvailable, type PathTest } from '../../services/imageEngine';
import { APP_VERSION } from '../../config';

// زر «تفاصيل تقنية»: يعرض النموذج ورسالة Google الفعلية ويسمح بنسخها للمطوّر
export default function ErrorDetails({ ar }: { ar: boolean }) {
  const log = useSyncExternalStore(subscribeErrorLog, getErrorLog);
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [tests, setTests] = useState<PathTest[] | null>(null);
  const [testing, setTesting] = useState(false);
  if (!log.length && !tests) return null;

  const report = JSON.stringify({ app: APP_VERSION, key: keyHint(), freeEngine: Boolean(getFreeCreds()), directPath: directAvailable(), imagePaths: tests ?? undefined, errors: log }, null, 2);

  const runTests = async () => {
    setTesting(true);
    setTests(await diagnoseImagePaths());
    setTesting(false);
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(report);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // التحديد اليدوي متاح في الصندوق
    }
  };

  return (
    <div className="w-full text-start" dir="ltr">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="mx-auto flex min-h-11 items-center gap-1.5 text-xs font-semibold text-ink/60 underline-offset-4 hover:underline dark:text-moonlight/60"
      >
        <Stethoscope size={14} aria-hidden />
        {ar ? 'تفاصيل تقنية' : 'Technical details'}
      </button>
      {open && (
        <div className="mt-1 space-y-2">
          <pre className="max-h-64 select-all overflow-auto whitespace-pre-wrap break-words rounded-2xl bg-black/80 p-3 text-[11px] leading-relaxed text-green-200">{report}</pre>
          <button type="button" onClick={runTests} disabled={testing} className="flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl border border-dream/30 text-sm font-semibold text-ink active:scale-95 disabled:opacity-60 dark:text-moonlight">
            <ImageIcon size={16} aria-hidden />
            {testing ? (ar ? 'نختبر مسارات الصور...' : 'Testing image paths...') : ar ? 'فحص مسارات الصور' : 'Test image paths'}
          </button>
          <button type="button" onClick={copy} className="flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl border border-dream/30 text-sm font-semibold text-ink active:scale-95 dark:text-moonlight">
            {copied ? <Check size={16} aria-hidden /> : <ClipboardCopy size={16} aria-hidden />}
            {copied ? (ar ? 'تم النسخ' : 'Copied') : ar ? 'نسخ التفاصيل' : 'Copy details'}
          </button>
        </div>
      )}
    </div>
  );
}
