import { useState, type FormEvent } from 'react';
import { Sparkles } from 'lucide-react';
import { analyzeNameMeaning } from '../../services/gemini';
import { Language, NameAnalysis } from '../../types';

interface Props {
  language: Language;
}

export default function NameMeaning({ language }: Props) {
  const ar = language === 'Arabic';
  const [name, setName] = useState('');
  const [result, setResult] = useState<NameAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim() || loading) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const analysis = await analyzeNameMeaning(name, language);
      setResult(analysis);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6" dir={ar ? 'rtl' : 'ltr'}>
      <div>
        <h2 className="font-display text-xl font-semibold text-ink dark:text-moonlight">
          {ar ? 'معاني الأسماء' : 'Name Meanings'}
        </h2>
        <p className="mt-1 text-sm text-ink/60 dark:text-moonlight/60">
          {ar ? 'اكتشف معنى اسم طفلك وصفاته الجميلة.' : "Discover the meaning behind your child's name."}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={ar ? 'اكتب اسمًا...' : 'Type a name...'}
          className="flex-1 rounded-2xl border border-dream/30 bg-white/70 px-4 py-2.5 text-sm text-ink outline-none focus-visible:border-lantern focus-visible:ring-2 focus-visible:ring-lantern/40 dark:bg-white/10 dark:text-moonlight"
        />
        <button
          type="submit"
          disabled={!name.trim() || loading}
          className="flex items-center gap-1.5 rounded-2xl bg-lantern px-4 py-2.5 text-sm font-semibold text-ink transition disabled:opacity-50"
        >
          <Sparkles size={16} aria-hidden />
          {ar ? 'حلّل' : 'Analyze'}
        </button>
      </form>

      {loading && <p className="text-sm text-ink/60 dark:text-moonlight/60">{ar ? 'جارٍ التحليل...' : 'Analyzing...'}</p>}
      {error && <p className="text-sm text-coral">{error}</p>}

      {result && (
        <div className="page-corner space-y-3 rounded-3xl border border-dream/20 bg-white/70 p-5 dark:bg-white/5">
          <h3 className="font-display text-lg font-semibold text-ink dark:text-moonlight">{name}</h3>
          <p className="text-sm text-ink/80 dark:text-moonlight/80">
            <span className="font-semibold">{ar ? 'المعنى: ' : 'Meaning: '}</span>
            {result.meaning}
          </p>
          <p className="text-sm text-ink/80 dark:text-moonlight/80">
            <span className="font-semibold">{ar ? 'الأصل: ' : 'Origin: '}</span>
            {result.origin}
          </p>
          <div className="flex flex-wrap gap-2 pt-1">
            {result.traits.map((trait) => (
              <span key={trait} className="rounded-full bg-dream/20 px-3 py-1 text-xs font-medium text-ink dark:text-moonlight">
                {trait}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
