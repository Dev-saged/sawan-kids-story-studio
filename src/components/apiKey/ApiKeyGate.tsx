import { useState, useEffect, type FormEvent } from 'react';
import { Info, Sparkles, ExternalLink, ShieldCheck, ArrowRight } from 'lucide-react';
import { clearApiKey, isValidApiKeyFormat, saveApiKey, setSharedServerSession } from '../../services/apiKey';
import { preflight } from '../../services/api';
import { Language } from '../../types';

interface Props {
  language: Language;
  onSaved: () => void;
  noKey?: boolean;
}

export default function ApiKeyGate({ language, onSaved, noKey }: Props) {
  const ar = language === 'Arabic';
  const [key, setKey] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [remember, setRemember] = useState(true);

  // فحص وجود المفتاح المشارك في رابط URL للتفعيل التلقائي (shared-key=...)
  useEffect(() => {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const sharedKey = urlParams.get('shared-key') || urlParams.get('shared_key') || urlParams.get('key');
      if (sharedKey && isValidApiKeyFormat(sharedKey.trim())) {
        const cleanKey = sharedKey.trim();
        saveApiKey(cleanKey, true).then(() => {
          try {
            localStorage.setItem('sawan-shared-key', cleanKey);
          } catch {
            // ignore
          }
          onSaved();
        });
      }
    } catch {
      // ignore
    }
  }, [onSaved]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const cleanKey = key.trim();
    if (!isValidApiKeyFormat(cleanKey)) {
      setError(
        ar
          ? 'المفتاح فارغ أو قصير جداً أو يحتوي على مسافات. انسخ المفتاح كاملاً من Google AI Studio.'
          : 'The key is empty, too short or contains spaces. Please paste the full key from Google AI Studio.'
      );
      return;
    }

    setChecking(true);
    await saveApiKey(cleanKey, remember);
    const result = await preflight();
    setChecking(false);

    if (!result.ok && result.code === 'AUTH') {
      clearApiKey();
      setError(
        ar
          ? 'Google رفضت هذا المفتاح (غير صالح أو منسوخ بشكل غير صحيح). يرجى التأكد من نسخه كاملاً من Google AI Studio.'
          : 'Google rejected this key. Please make sure it is a valid Gemini API key copied in full from Google AI Studio.'
      );
      return;
    }

    setKey('');
    setError(null);
    onSaved();
  };

  const handleContinueShared = async () => {
    setChecking(true);
    setError(null);
    const result = await preflight();
    setChecking(false);
    if (!result.ok && result.code === 'NOKEY') {
      setError(
        ar
          ? 'الخادم لا يملك مفتاح Gemini حالياً. يرجى إدخال مفتاحك الخاص أعلاه للبدء.'
          : 'The server currently has no Gemini key configured. Please enter your own key above.'
      );
      return;
    }
    setSharedServerSession();
    onSaved();
  };

  return (
    <div className="mx-auto max-w-lg space-y-6 pt-4 sm:pt-10" dir={ar ? 'rtl' : 'ltr'}>
      {/* Centered Modal Card matching Google AI Studio prompt aesthetic */}
      <div className="relative rounded-3xl border border-dream/20 bg-white p-7 shadow-xl dark:bg-dusk/90 sm:p-9">
        {/* Top Info Icon in Circle */}
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border-2 border-ink/15 text-ink dark:border-moonlight/25 dark:text-moonlight">
          <Info size={30} strokeWidth={1.8} />
        </div>

        {/* Title */}
        <div className="mt-5 text-center">
          <h2 className="font-display text-xl font-bold tracking-tight text-ink dark:text-moonlight sm:text-2xl">
            {ar ? 'تفعيل الوصول إلى Google Gemini' : 'Connect to Google Gemini'}
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-ink/75 dark:text-moonlight/75">
            {ar
              ? 'لتوليد القصص وسرد الصوت ورسم صور الأطفال عالية الدقة بواسطة Gemini 2.5 مباشرة من داخل متصفحك مجاناً وبلا أي علامات مائية، يرجى إدخال مفتاح Gemini API الخاص بك.'
              : 'To create illustrated stories, voice narration, and high-quality children illustrations using Gemini 2.5 directly in your browser without watermarks, please enter your Gemini API key.'}
          </p>

          {noKey && (
            <p role="alert" className="mt-3 rounded-2xl border border-coral/30 bg-coral/10 p-3 text-xs font-semibold text-coral">
              {ar
                ? 'ملاحظة: الخادم ليس لديه مفتاح حالياً، لذا يلزم إدخال مفتاحك لتبدأ التوليد فوراً.'
                : 'Note: The server currently has no key configured. Enter your key to start generating immediately.'}
            </p>
          )}
        </div>

        {/* Free Key Helper Link */}
        <div className="mt-5 rounded-2xl bg-dream/10 p-3.5 text-center border border-dream/20">
          <a
            href="https://aistudio.google.com/apikey"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 font-display text-xs sm:text-sm font-bold text-lantern transition hover:underline"
          >
            <Sparkles size={15} />
            <span>{ar ? 'احصل على مفتاح مجاني بنقرة واحدة من Google AI Studio' : 'Get a free key in 1 click from Google AI Studio'}</span>
            <ExternalLink size={13} />
          </a>
        </div>

        {/* Key Form */}
        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label htmlFor="api-key" className="block text-xs font-bold uppercase tracking-wider text-ink/70 dark:text-moonlight/70">
              {ar ? 'مفتاح Gemini API' : 'Gemini API Key'}
            </label>
            <div className="mt-1.5 relative">
              <input
                id="api-key"
                type="password"
                value={key}
                onChange={(e) => {
                  setKey(e.target.value);
                  setError(null);
                }}
                autoComplete="off"
                autoCapitalize="none"
                spellCheck={false}
                dir="ltr"
                placeholder="AIzaSy... أو AQ...."
                className="w-full rounded-2xl border border-dream/30 bg-white/90 px-4 py-3 font-mono text-sm text-ink outline-none transition focus:border-lantern focus:ring-2 focus:ring-lantern/30 dark:bg-white/10 dark:text-moonlight"
              />
            </div>
          </div>

          {/* Remember Key Checkbox */}
          <label className="flex items-center gap-2.5 text-xs text-ink/80 dark:text-moonlight/80 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
              className="size-4 rounded text-lantern focus:ring-lantern"
            />
            <span className="flex items-center gap-1.5">
              <ShieldCheck size={14} className="text-emerald-600 dark:text-emerald-400" />
              <span>{ar ? 'تذكّر المفتاح على هذا الجهاز (مشفّر بأمان بتقنية AES-GCM)' : 'Remember key on this device (securely encrypted)'}</span>
            </span>
          </label>

          {error && (
            <p role="alert" className="text-xs font-semibold text-coral animate-shake">
              {error}
            </p>
          )}

          {/* Action Buttons matching screenshot style */}
          <div className="pt-2 space-y-2.5">
            <button
              type="submit"
              disabled={!key.trim() || checking}
              className="w-full rounded-full bg-lantern py-3.5 px-6 font-display text-sm font-bold text-ink shadow-sm transition hover:brightness-105 active:scale-98 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {checking ? (
                ar ? 'جارٍ التحقق من المفتاح...' : 'Checking key...'
              ) : (
                <span className="flex items-center justify-center gap-2">
                  <span>{ar ? 'متابعة إلى التطبيق' : 'Continue to the app'}</span>
                  <ArrowRight size={16} className={ar ? 'rotate-180' : ''} />
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={handleContinueShared}
              className="w-full rounded-full border border-dream/30 bg-transparent py-2.5 text-xs font-semibold text-ink/70 transition hover:bg-dream/10 hover:text-ink dark:text-moonlight/70 dark:hover:text-moonlight"
            >
              {ar ? 'المتابعة بالخادم المشترك (تجربة التطبيق)' : 'Continue with shared server (trial mode)'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
