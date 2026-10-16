import { useState, type FormEvent } from 'react';
import { KeyRound } from 'lucide-react';
import { isValidApiKeyFormat, saveApiKey } from '../../services/apiKey';
import { Language } from '../../types';

interface Props {
  language: Language;
  onSaved: () => void;
}

export default function ApiKeyGate({ language, onSaved }: Props) {
  const ar = language === 'Arabic';
  const [key, setKey] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!isValidApiKeyFormat(key)) {
      setError(ar ? 'صيغة المفتاح غير صحيحة. تأكد من نسخه كاملًا.' : 'Invalid key format. Make sure you copied the full key.');
      return;
    }
    saveApiKey(key);
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
          placeholder="AIza..."
          className="w-full rounded-2xl border border-dream/30 bg-white/70 px-4 py-2.5 font-mono text-sm text-ink outline-none focus-visible:border-lantern focus-visible:ring-2 focus-visible:ring-lantern/40 dark:bg-white/10 dark:text-moonlight"
        />
        {error && <p className="text-sm text-coral">{error}</p>}
        <button
          type="submit"
          disabled={!key.trim()}
          className="w-full rounded-full bg-lantern py-3 font-display text-base font-semibold text-ink transition disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
        >
          {ar ? 'متابعة' : 'Continue'}
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
