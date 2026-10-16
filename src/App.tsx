import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { AlertTriangle, RotateCcw, Upload } from 'lucide-react';
import NavBar, { Section } from './components/layout/NavBar';
import StorySetupForm from './components/story/StorySetupForm';
import GenerationProgress from './components/story/GenerationProgress';
import StoryReader from './components/story/StoryReader';
import GamesDashboard from './components/games/GamesDashboard';
import ReadLearn from './components/readLearn/ReadLearn';
import NameMeaning from './components/nameMeaning/NameMeaning';
import ApiKeyGate from './components/apiKey/ApiKeyGate';
import { useTheme } from './hooks/useTheme';
import { StoryGenerator } from './services/gemini';
import { hasSavedStory, loadStoryFromJSON, loadStoryLocally } from './services/export';
import { clearApiKey, getApiKey } from './services/apiKey';
import { GenerationStage, Language, StoryData, StoryPage, StoryParams } from './types';

const LANGUAGE_STORAGE_KEY = 'sawan-language';

const getInitialLanguage = (): Language => {
  const stored = localStorage.getItem(LANGUAGE_STORAGE_KEY);
  return stored === 'Arabic' || stored === 'English' ? stored : 'English';
};

export default function App() {
  const [language, setLanguage] = useState<Language>(getInitialLanguage);
  const [theme, toggleTheme] = useTheme();
  const [section, setSection] = useState<Section>('studio');
  const [hasKey, setHasKey] = useState<boolean>(() => Boolean(getApiKey()));

  const [stage, setStage] = useState<GenerationStage>('idle');
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState('');
  const [isPaused, setIsPaused] = useState(false);
  const [storyData, setStoryData] = useState<StoryData | null>(null);
  const [storyKey, setStoryKey] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const generatorRef = useRef<StoryGenerator | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    document.documentElement.dir = language === 'Arabic' ? 'rtl' : 'ltr';
    document.documentElement.lang = language === 'Arabic' ? 'ar' : 'en';
    localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
  }, [language]);

  // Text first; pictures are painted page by page inside the reader (per-visitor key, real AI images only).
  const openStory = (data: StoryData) => {
    setStoryData(data);
    setStoryKey((k) => k + 1);
    setStage('done');
    setError(null);
  };

  const runGeneration = async (params: StoryParams, pageCount: number) => {
    setError(null);
    setStage('writing');
    setProgress(0);
    setIsPaused(false);

    try {
      const generator = new StoryGenerator();
      generatorRef.current = generator;

      const data = await generator.generate(params, pageCount, (p, m) => {
        setProgress(p);
        setMessage(m);
      });
      openStory(data);
    } catch (err) {
      setError((err as Error).message);
      setStage('error');
    }
  };

  const updatePages = (updater: (pages: StoryPage[]) => StoryPage[]) =>
    setStoryData((prev) => (prev ? { ...prev, pages: updater(prev.pages) } : prev));

  const handlePause = () => {
    generatorRef.current?.pause();
    setIsPaused(true);
  };

  const handleResume = () => {
    generatorRef.current?.resume();
    setIsPaused(false);
  };

  const startOver = () => {
    setStage('idle');
    setStoryData(null);
    setError(null);
    setProgress(0);
  };

  const handleImportClick = () => fileInputRef.current?.click();

  const handleChangeKey = () => {
    clearApiKey();
    setHasKey(false);
  };

  const handleLoadSaved = () => {
    const saved = loadStoryLocally();
    if (saved) openStory(saved);
    else setError(language === 'Arabic' ? 'تعذّر قراءة القصة المحفوظة.' : 'Could not read the saved story.');
  };

  const handleImportFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      openStory(await loadStoryFromJSON(file));
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const ar = language === 'Arabic';

  return (
    <div className="flex min-h-screen flex-col">
      <NavBar
        active={section}
        onNavigate={setSection}
        language={language}
        onToggleLanguage={() => setLanguage((l) => (l === 'Arabic' ? 'English' : 'Arabic'))}
        theme={theme}
        onToggleTheme={toggleTheme}
      />

      <main className="mx-auto w-full max-w-2xl flex-1 px-4 pb-28 pt-6">
        {section === 'studio' && !hasKey && <ApiKeyGate language={language} onSaved={() => setHasKey(true)} />}

        {section === 'studio' && hasKey && (
          <>
            {stage === 'idle' && (
              <div className="space-y-5">
                <StorySetupForm
                  language={language}
                  onSubmit={runGeneration}
                  onLoadStory={handleLoadSaved}
                  canLoadStory={hasSavedStory()}
                  disabled={false}
                />
                {error && (
                  <p role="alert" className="text-center text-sm text-coral">
                    {error}
                  </p>
                )}
                <div className="flex flex-col items-center gap-3">
                  <button
                    type="button"
                    onClick={handleImportClick}
                    className="inline-flex items-center gap-1.5 text-sm font-medium text-ink/60 underline-offset-4 hover:underline dark:text-moonlight/60"
                  >
                    <Upload size={14} aria-hidden />
                    {ar ? 'استيراد قصة محفوظة (JSON)' : 'Import a saved story (JSON)'}
                  </button>
                  <button
                    type="button"
                    onClick={handleChangeKey}
                    className="text-sm font-medium text-ink/60 underline-offset-4 hover:underline dark:text-moonlight/60"
                  >
                    {ar ? 'تغيير مفتاح API' : 'Change API key'}
                  </button>
                  <input ref={fileInputRef} type="file" accept="application/json" className="hidden" onChange={handleImportFile} />
                </div>
              </div>
            )}

            {(stage === 'writing' || stage === 'illustrating') && (
              <GenerationProgress
                progress={progress}
                message={message}
                isPaused={isPaused}
                onPause={handlePause}
                onResume={handleResume}
                language={language}
              />
            )}

            {stage === 'error' && (
              <div className="space-y-4 rounded-3xl border border-coral/30 bg-coral/5 p-6 text-center">
                <AlertTriangle className="mx-auto text-coral" size={32} aria-hidden />
                <p className="text-sm text-ink dark:text-moonlight">{error}</p>
                <button
                  type="button"
                  onClick={startOver}
                  className="mx-auto flex items-center gap-2 rounded-full border border-dream/30 px-5 py-2 text-sm font-medium text-ink dark:text-moonlight"
                >
                  <RotateCcw size={16} aria-hidden />
                  {ar ? 'حاول مرة أخرى' : 'Try again'}
                </button>
              </div>
            )}

            {stage === 'done' && storyData && (
              <StoryReader key={storyKey} storyData={storyData} language={language} onPagesChange={updatePages} onStartOver={startOver} />
            )}
          </>
        )}

        {section === 'games' && <GamesDashboard language={language} />}
        {section === 'learn' && <ReadLearn language={language} />}
        {section === 'names' &&
          (hasKey ? <NameMeaning language={language} /> : <ApiKeyGate language={language} onSaved={() => setHasKey(true)} />)}
      </main>
    </div>
  );
}
