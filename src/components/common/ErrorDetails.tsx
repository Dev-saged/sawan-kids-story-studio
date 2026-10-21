import { useState, useSyncExternalStore } from 'react';
import { Activity, Check, ClipboardCopy, ImageIcon, Stethoscope } from 'lucide-react';
import { getApiRequestHistory, getErrorLog, subscribeApiHistory, subscribeErrorLog } from '../../services/api';
import { getFreeCreds, isKeyRemembered, keyHint } from '../../services/apiKey';
import {
  diagnoseImagePaths,
  getDrawnImagesLog,
  getLastEngine,
  subscribeDrawnImages,
  type KeyReport,
  type PathTest,
} from '../../services/imageEngine';
import { getGeneratorLogs } from '../../services/gemini';
import { APP_VERSION } from '../../config';
import { buildSafeHealthReportJson } from '../../services/appHealth';
import AppHealthModal from './AppHealthModal';

// زر «تفاصيل تقنية»: يعرض لكل صورة المحرك الذي رسمها (gemini / flux / pollinations) وأول 300 حرف من الطلب الفعلي، إضافةً لسجل الأخطاء وزر «حالة التطبيق»
export default function ErrorDetails({ ar, alwaysShow = false }: { ar: boolean; alwaysShow?: boolean }) {
  const log = useSyncExternalStore(subscribeErrorLog, getErrorLog);
  const apiHistory = useSyncExternalStore(subscribeApiHistory, getApiRequestHistory);
  const drawnImages = useSyncExternalStore(subscribeDrawnImages, getDrawnImagesLog);
  const [open, setOpen] = useState(false);
  const [showHealthModal, setShowHealthModal] = useState(false);
  const [copied, setCopied] = useState(false);
  const [diag, setDiag] = useState<{ tests: PathTest[]; keys: KeyReport } | null>(null);
  const [testing, setTesting] = useState(false);
  if (!alwaysShow && !log.length && !diag && !apiHistory.length && !drawnImages.length) return null;

  const buildReport = () =>
    buildSafeHealthReportJson({
      app: APP_VERSION,
      key: keyHint(),
      remembered: isKeyRemembered(),
      freeEngine: Boolean(getFreeCreds()),
      lastImageEngine: getLastEngine() ?? undefined,
      drawnImages: drawnImages.slice(0, 20).map((img) => ({
        kind: img.kind,
        engine: img.engine,
        model: img.model,
        promptFirst300Chars: img.promptSnippet.slice(0, 300),
        at: img.timestamp,
      })),
      keys: diag?.keys,
      imagePaths: diag?.tests,
      errors: log.slice(0, 5),
      recentApiRequests: apiHistory.slice(0, 12),
      generatorLogs: getGeneratorLogs().slice(-10),
    });

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
      <div className="flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="inline-flex min-h-11 items-center gap-1.5 text-xs font-semibold text-ink/60 underline-offset-4 hover:underline dark:text-moonlight/60"
        >
          <Stethoscope size={14} aria-hidden />
          {ar ? 'تفاصيل تقنية' : 'Technical details'}
        </button>
        <button
          type="button"
          onClick={() => setShowHealthModal(true)}
          className="inline-flex min-h-11 items-center gap-1.5 text-xs font-bold text-lantern underline-offset-4 hover:underline"
        >
          <Activity size={14} aria-hidden />
          {ar ? 'حالة التطبيق' : 'App Health'}
        </button>
      </div>
      {open && (
        <div className="mt-1 space-y-2">
          {drawnImages.length > 0 && (
            <div className="rounded-2xl border border-dream/25 bg-black/75 p-3 text-[11px] text-amber-100 space-y-1.5" dir={ar ? 'rtl' : 'ltr'}>
              <p className="font-bold text-amber-300">
                {ar ? 'سجل الصور المرسومة (المحرك + أول 300 حرف من الطلب المرسل فعلاً):' : 'Drawn Images Log (Engine + First 300 chars of sent prompt):'}
              </p>
              <ul className="space-y-1.5 max-h-44 overflow-auto">
                {drawnImages.slice(0, 12).map((img) => (
                  <li key={img.id} className="rounded-xl bg-white/5 p-2 font-mono text-[10px]" dir="ltr">
                    <div className="flex items-center justify-between gap-2 text-emerald-300 font-bold">
                      <span>[{img.kind}] engine: {img.engine}</span>
                      <span className="text-white/60">{img.model}</span>
                    </div>
                    <p className="mt-1 text-white/85 break-words">{img.promptSnippet.slice(0, 300)}</p>
                  </li>
                ))}
              </ul>
            </div>
          )}
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
      {showHealthModal && <AppHealthModal ar={ar} onClose={() => setShowHealthModal(false)} />}
    </div>
  );
}

