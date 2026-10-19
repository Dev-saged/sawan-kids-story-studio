import { useState, useSyncExternalStore } from 'react';
import { Check, ClipboardCopy, ImageIcon, Stethoscope } from 'lucide-react';
import { getApiRequestHistory, getErrorLog, subscribeApiHistory, subscribeErrorLog } from '../../services/api';
import { getFreeCreds, isKeyRemembered, keyHint } from '../../services/apiKey';
import { diagnoseImagePaths, getLastEngine, type KeyReport, type PathTest } from '../../services/imageEngine';
import { getGeneratorLogs } from '../../services/gemini';
import { APP_VERSION } from '../../config';

// زر «تفاصيل تقنية»: يعرض النموذج ورسالة Google الفعلية وسجل API ويسمح بنسخها للمطوّر
export default function ErrorDetails({ ar }: { ar: boolean }) {
  const log = useSyncExternalStore(subscribeErrorLog, getErrorLog);
  const apiHistory = useSyncExternalStore(subscribeApiHistory, getApiRequestHistory);
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [diag, setDiag] = useState<{ tests: PathTest[]; keys: KeyReport } | null>(null);
  const [testing, setTesting] = useState(false);
  if (!log.length && !diag && !apiHistory.length) return null;

  const buildReport = () =>
    JSON.stringify(
      {
        app: APP_VERSION,
        key: keyHint(),
        remembered: isKeyRemembered(),
        freeEngine: Boolean(getFreeCreds()),
        lastImageEngine: getLastEngine() ?? undefined,
        keys: diag?.keys,
        imagePaths: diag?.tests,
        errors: log,
        recentApiRequests: apiHistory.slice(0, 12),
        generatorLogs: getGeneratorLogs().slice(-10),
      },
      null,
      2
    );

  const runTests = async () => {
    setTesting(true);
    setDiag(await diagnoseImagePaths());
    setTesting(false);
  };

  const copy = async () => {
    const reportText = buildReport();
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(reportText);
      } else {
        throw new Error('Clipboard API unavailable');
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      try {
        const ta = document.createElement('textarea');
        ta.value = reportText;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch {
        // user can select directly
      }
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
          <pre className="max-h-64 select-all overflow-auto whitespace-pre-wrap break-words rounded-2xl bg-black/80 p-3 text-[11px] leading-relaxed text-green-200">{buildReport()}</pre>
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
