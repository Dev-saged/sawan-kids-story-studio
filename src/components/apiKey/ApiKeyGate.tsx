import { useState, type FormEvent } from 'react';
import { KeyRound } from 'lucide-react';
import { clearApiKey, isValidApiKeyFormat, saveApiKey } from '../../services/apiKey';
import { preflight } from '../../services/api';
import { Language } from '../../types';

interface Props {
  language: Language;
  onSaved: () => void;
}

export default function ApiKeyGate({ language, onSaved }: Props) {
  const ar = language === 'Arabic';
  const [key, setKey] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!isValidApiKeyFormat(key)) {
      setError(ar ? 'المفتاح فارغ أو قصير أو فيه مسافات. انسخه كاملًا.' : 'The key is empty, too short or contains spaces. Copy the full key.');
      return;
    }
    saveApiKey(key);
    setChecking(true);
    const result = await preflight();
    setChecking(false);
    if (!result.ok && result.code === 'AUTH') {
      clearApiKey();
      setError(ar ? 'Google رفضت هذا المفتاح. تأكد أنه مفتاح Gemini API صالح ومنسوخ كاملاً.' : 'Google rejected this key. Make sure it is a valid Gemini API key copied in full.');
      return;
    }
    setKey('');
    setError(null);
    onSaved();
  };

  return (
    <div className="space-y-5 rounded-3xl border border-dream/20 bg-white/60 p-6 dark:bg-white/5" dir={ar ? 'rtl' : 'ltr'}>
      <div className="text-center">
        <KeyRound className="mx-auto text-lantern" size={32} aria-hidden />
        <h2 className="mt-2 font-display text-lg font-semibold text-ink dark:text-moonlight">
          {ar ? 'أدخل مفتاح Gemini الخاص بك' : 'Enter your Gemini API key'}
        </h2>
        <p className="mt-2 text-sm text-ink/70 dark:text-moonlight/70">
          {ar
            ? 'المفتاح يُحفظ في هذا التبويب فقط ويُمسح عند إغلاقه، ولا يُرسل إلا إلى Google.'
            : 'The key is kept only in this tab and cleared when you close it. It is sent only to Google.'}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        <label htmlFor="api-key" className="block text-sm font-semibold text-ink/80 dark:text-moonlight/80">
          {ar ? 'مفتاح API' : 'API key'}
        </label>
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
          placeholder="AIza… / AQ.…"
          className="w-full rounded-2xl border border-dream/30 bg-white/70 px-4 py-2.5 font-mono text-sm text-ink outline-none focus-visible:border-lantern focus-visible:ring-2 focus-visible:ring-lantern/40 dark:bg-white/10 dark:text-moonlight"
        />
        {error && <p className="text-sm text-coral">{error}</p>}
        <button
          type="submit"
          disabled={!key.trim() || checking}
          className="w-full rounded-full bg-lantern py-3 font-display text-base font-semibold text-ink transition disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
        >
          {checking ? (ar ? 'نتحقق من المفتاح...' : 'Checking key...') : ar ? 'متابعة' : 'Continue'}
        </button>
      </form>

      <a
        href="https://aistudio.google.com/apikey"
        target="_blank"
        rel="noopener noreferrer"
        className="block text-center text-sm font-medium text-ink/70 underline-offset-4 hover:underline dark:text-moonlight/70"
      >
        {ar ? 'احصل على مفتاح من Google AI Studio' : 'Get a key from Google AI Studio'}
      </a>
    </div>
  );
}
