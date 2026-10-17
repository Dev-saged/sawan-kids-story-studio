import { useState, useSyncExternalStore, type FormEvent } from 'react';
import { ImagePlus, ShieldCheck } from 'lucide-react';
import { checkFree, getErrorLog, subscribeErrorLog } from '../../services/api';
import { clearFreeCreds, getFreeCreds, isValidFreeCreds, isWebFreeEnabled, saveFreeCreds, setWebFreeEnabled } from '../../services/apiKey';

interface Props {
  ar: boolean;
  // hint: اقتراح هادئ قبل أي فشل؛ error: يظهر فقط بعد خطأ فوترة أو رفض Cloudflare
  mode: 'hint' | 'error' | 'always';
  onSaved: () => void;
}

const STEPS = {
  ar: [
    'سجّل مجاناً في dash.cloudflare.com (بدون بطاقة).',
    'انسخ «Account ID» من صفحة Workers & Pages (الشريط الجانبي).',
    'من My Profile ← API Tokens ← Create Token اختر قالب «Workers AI» وانسخ الرمز.',
  ],
  en: [
    'Sign up free at dash.cloudflare.com (no card).',
    'Copy the "Account ID" from the Workers & Pages page (sidebar).',
    'My Profile → API Tokens → Create Token, pick the "Workers AI" template and copy the token.',
  ],
};

// مفتاح المحرك الاحتياطي المجاني بلا مفتاح (Pollinations): يرسل وصف المشهد فقط ولا يرسل أي صورة
export function WebFreeToggle({ ar }: { ar: boolean }) {
  const [on, setOn] = useState(isWebFreeEnabled);
  return (
    <label className="flex min-h-11 items-start gap-2 rounded-2xl border border-dream/20 bg-white/50 p-3 text-sm text-ink/80 dark:bg-white/5 dark:text-moonlight/80" dir={ar ? 'rtl' : 'ltr'}>
      <input
        type="checkbox"
        checked={on}
        onChange={(e) => {
          setOn(e.target.checked);
          setWebFreeEnabled(e.target.checked);
        }}
        className="mt-1 size-4 shrink-0"
      />
      <span>
        <strong className="block font-semibold">{ar ? 'محرك احتياطي مجاني بلا مفتاح (Pollinations)' : 'Free no-key backup engine (Pollinations)'}</strong>
        {ar
          ? 'يرسم عندما تفشل بقية المحركات. يرسل وصف المشهد فقط (بلا صور شخصية)، وتظهر على صوره علامة الخدمة المائية، ولا يدعم صورة الطفل المرجعية.'
          : 'Paints when the other engines fail. Sends only the scene description (no personal photos), its images carry the service watermark, and it takes no child-photo reference.'}
      </span>
    </label>
  );
}

// بطاقة تفعيل الصور المجانية: حساب Cloudflare يكفي لأكثر من 100 صورة يومياً
export default function FreeEngineCard({ ar, mode, onSaved }: Props) {
  const log = useSyncExternalStore(subscribeErrorLog, getErrorLog);
  const [account, setAccount] = useState('');
  const [token, setToken] = useState('');
  const [remember, setRemember] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [done, setDone] = useState(() => Boolean(getFreeCreds()));

  const needsHelp = log.some((e) => (e.where.includes('generate-image') || e.where === 'image-engine') && (e.code === 'BILLING' || e.code === 'FREE_AUTH'));
  if (mode === 'error' && !needsHelp) return null;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!isValidFreeCreds(account, token)) {
      setMessage(ar ? 'رقم الحساب يتكون من 32 حرفاً وأرقاماً (a-f و 0-9)، والرمز طويل بلا مسافات.' : 'Account ID is 32 hex characters; the token is long with no spaces.');
      return;
    }
    saveFreeCreds(account, token, remember);
    setBusy(true);
    setMessage(null);
    const result = await checkFree();
    setBusy(false);
    if (result.ok) {
      setDone(true);
      setAccount('');
      setToken('');
      onSaved();
      return;
    }
    if (result.code === 'FREE_AUTH') clearFreeCreds();
    const base: Record<string, string> = {
      FREE_AUTH: ar ? 'Cloudflare رفضت البيانات. تأكد من Account ID ومن صلاحية Workers AI للرمز.' : 'Cloudflare rejected the details. Check the Account ID and Workers AI permission.',
      FREE_QUOTA: ar ? 'البيانات صحيحة لكن حصة اليوم المجانية مستهلكة. تتجدد 00:00 UTC.' : 'Details are valid but today\'s free allowance is used up. Resets 00:00 UTC.',
      OFFLINE: ar ? 'لا يوجد اتصال بالإنترنت.' : 'You are offline.',
    };
    if (result.code === 'FREE_QUOTA') {
      setDone(true);
      onSaved();
    }
    setMessage(base[result.code] ?? (ar ? 'تعذّر الاختبار. أعد المحاولة.' : 'The check failed. Try again.'));
  };

  if (done && mode !== 'always') {
    return (
      <p className="flex items-center gap-2 rounded-2xl bg-meadow/15 px-4 py-2 text-sm text-ink/80 dark:text-moonlight/80" dir={ar ? 'rtl' : 'ltr'}>
        <ShieldCheck size={16} aria-hidden />
        {ar ? 'الصور المجانية (Cloudflare) مفعّلة.' : 'Free images (Cloudflare) are enabled.'}
      </p>
    );
  }

  const input = 'w-full rounded-2xl border border-dream/30 bg-white/70 px-4 py-2.5 font-mono text-sm text-ink outline-none focus-visible:border-lantern focus-visible:ring-2 focus-visible:ring-lantern/40 dark:bg-white/10 dark:text-moonlight';

  return (
    <details open={mode === 'error'} className="rounded-2xl border border-lantern/40 bg-lantern/10 p-4 text-sm text-ink dark:text-moonlight" dir={ar ? 'rtl' : 'ltr'}>
      <summary className="flex min-h-11 cursor-pointer items-center gap-2 font-semibold">
        <ImagePlus size={18} aria-hidden />
        {ar ? 'ارسم الصور مجاناً بدون فوترة (Cloudflare)' : 'Draw images for free, no billing (Cloudflare)'}
      </summary>
      <p className="mt-2 text-ink/75 dark:text-moonlight/75">
        {ar
          ? 'حساب Cloudflare المجاني يرسم أكثر من 100 صورة يومياً، أي أكثر من قصتين كاملتين. الصور تُقصّ لنسبة القصة، ولا تدعم صورة الطفل المرجعية.'
          : 'A free Cloudflare account draws 100+ images a day, enough for 2+ full stories. Images are cropped to the story ratio and take no child-photo reference.'}
      </p>
      <ol className="mt-2 list-decimal space-y-1 ps-5 text-ink/75 dark:text-moonlight/75">
        {STEPS[ar ? 'ar' : 'en'].map((s) => (
          <li key={s}>{s}</li>
        ))}
      </ol>
      <form onSubmit={submit} className="mt-3 space-y-2">
        <input value={account} onChange={(e) => setAccount(e.target.value)} dir="ltr" autoComplete="off" spellCheck={false} placeholder="Account ID" aria-label="Cloudflare Account ID" className={input} />
        <input value={token} onChange={(e) => setToken(e.target.value)} type="password" dir="ltr" autoComplete="off" spellCheck={false} placeholder="API Token" aria-label="Cloudflare API Token" className={input} />
        <label className="flex min-h-11 items-center gap-2">
          <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} className="size-4" />
          {ar ? 'تذكّر على هذا الجهاز' : 'Remember on this device'}
        </label>
        {message && <p className="text-coral">{message}</p>}
        <button type="submit" disabled={busy || !account.trim() || !token.trim()} className="min-h-11 w-full rounded-full bg-lantern py-2.5 font-display font-semibold text-ink transition disabled:cursor-not-allowed disabled:opacity-50">
          {busy ? (ar ? 'نختبر برسم صورة صغيرة...' : 'Testing with a tiny image...') : ar ? 'احفظ واختبر' : 'Save and test'}
        </button>
      </form>
      <div className="mt-3">
        <WebFreeToggle ar={ar} />
      </div>
    </details>
  );
}
