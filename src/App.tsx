import { lazy, Suspense, useCallback, useEffect, useRef, useState, type ChangeEvent } from 'react';
import { AlertTriangle, RotateCcw, Upload } from 'lucide-react';
import NavBar, { Section } from './components/layout/NavBar';
import StorySetupForm from './components/story/StorySetupForm';
import GenerationProgress from './components/story/GenerationProgress';
import ApiKeyGate from './components/apiKey/ApiKeyGate';
import PreflightBanner from './components/apiKey/PreflightBanner';
import ErrorDetails from './components/common/ErrorDetails';
import Credits from './components/layout/Credits';
import { useTheme } from './hooks/useTheme';
import { StoryGenerator } from './services/gemini';
import { loadStoryFromJSON } from './services/export';
import { hasAnyStory, hydrateStory, latestStory, loadStory, saveStory } from './services/library';
import { clearApiKey, getApiKey } from './services/apiKey';
import { GenerationStage, Language, SeriesContext, StoryData, StoryParams } from './types';
import { newId } from './services/db';
import { countStory } from './services/progress';

// الأقسام الثقيلة تُحمّل عند فتحها فقط
const StoryReader = lazy(() => import('./components/story/StoryReader'));
const Library = lazy(() => import('./components/library/Library'));
const GamesDashboard = lazy(() => import('./components/games/GamesDashboard'));
const ReadLearn = lazy(() => import('./components/readLearn/ReadLearn'));
const NameMeaning = lazy(() => import('./components/nameMeaning/NameMeaning'));

const LANGUAGE_STORAGE_KEY = 'sawan-language';

const getInitialLanguage = (): Language => {
  const stored = localStorage.getItem(LANGUAGE_STORAGE_KEY);
  return stored === 'Arabic' || stored === 'English' ? stored : 'Arabic';
};

const SectionFallback = () => (
  <div className="space-y-4" aria-busy="true">
    <div className="aspect-[16/9] w-full animate-pulse rounded-3xl bg-dream/15" />
    <div className="h-24 w-full animate-pulse rounded-3xl bg-dream/10" />
  </div>
);

export default function App() {
  const [language, setLanguage] = useState<Language>(getInitialLanguage);
  const [theme, toggleTheme] = useTheme();
  const [section, setSection] = useState<Section>('studio');
  const [hasKey, setHasKey] = useState<boolean>(() => Boolean(getApiKey()));
  const [keyEpoch, setKeyEpoch] = useState('0');
  const [noKey, setNoKey] = useState(false);

  const [stage, setStage] = useState<GenerationStage>('idle');
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState('');
  const [preview, setPreview] = useState<string | undefined>();
  const [isPaused, setIsPaused] = useState(false);
  const [storyData, setStoryData] = useState<StoryData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [canLoad, setCanLoad] = useState(false);
  const [series, setSeries] = useState<SeriesContext | null>(null);
  // فكرة قادمة من بطاقة تعليمية أو لعبة؛ تملأ نموذج القصة الجديدة
  const [prefill, setPrefill] = useState<{ idea: string; n: number } | null>(null);

  const generatorRef = useRef<StoryGenerator | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    document.documentElement.dir = language === 'Arabic' ? 'rtl' : 'ltr';
    document.documentElement.lang = language === 'Arabic' ? 'ar' : 'en';
    localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
  }, [language]);

  useEffect(() => {
    hasAnyStory().then(setCanLoad);
  }, [stage]);

  // حفظ تلقائي في المكتبة (مؤجّل لتجميع التحديثات)
  useEffect(() => {
    if (!storyData?.id) return;
    const t = setTimeout(() => saveStory(storyData), 600);
    return () => clearTimeout(t);
  }, [storyData]);

  const openStory = async (data: StoryData) => {
    const ready = await hydrateStory(data);
    setStoryData(ready);
    setStage('done');
    setError(null);
    setSection('studio');
    saveStory(ready);
  };

  const runGeneration = async (params: StoryParams, pageCount: number) => {
    setError(null);
    setStage('writing');
    setProgress(0);
    setPreview(undefined);
    setIsPaused(false);
    try {
      const generator = new StoryGenerator();
      generatorRef.current = generator;
      const data = await generator.generate(params, pageCount, (info) => {
        setProgress(info.progress);
        setMessage(info.message);
        if (info.preview) setPreview(info.preview);
      });
      await openStory(data);
      countStory();
      setSeries(null);
      setPrefill(null);
    } catch (err) {
      setError((err as Error).message);
      setStage('error');
    }
  };

  const updateStory = useCallback((updater: (s: StoryData) => StoryData) => setStoryData((prev) => (prev ? updater(prev) : prev)), []);

  const handlePause = () => {
    generatorRef.current?.pause();
    setIsPaused(true);
  };

  const handleResume = () => {
    generatorRef.current?.resume();
    setIsPaused(false);
  };

  // الجزء التالي: نفس الشخصيات وورقة المراجع والأسلوب + ملخص ما سبق
  const handleNextPart = (story: StoryData) => {
    const seriesId = story.seriesId ?? newId();
    const seriesTitle = story.seriesTitle ?? story.story_info.title;
    const partNumber = (story.partNumber ?? 1) + 1;
    setStoryData((prev) => (prev ? { ...prev, seriesId, seriesTitle, partNumber: prev.partNumber ?? 1 } : prev));
    setSeries({
      seriesId,
      seriesTitle,
      partNumber,
      previousTitle: story.story_info.title,
      previousSummary: story.pages.map((p) => p.text).join(' ').slice(0, 1800),
      characters: story.characters,
      characterSheetId: story.characterSheetId,
      heroPhotoId: story.heroPhotoId,
      artStyle: story.story_info.art_style as SeriesContext['artStyle'],
      dialect: story.story_info.dialect as SeriesContext['dialect'],
      ageGroup: story.story_info.age_group as SeriesContext['ageGroup'],
      aspectRatio: story.story_info.aspect_ratio,
    });
    setStage('idle');
    setError(null);
    setProgress(0);
  };

  // «حاول مرة أخرى» يحتفظ بسياق السلسلة إن وُجد
  const retryAfterError = () => {
    setStage('idle');
    setError(null);
    setProgress(0);
  };

  const startOver = () => {
    setSeries(null);
    setStage('idle');
    setStoryData(null);
    setError(null);
    setProgress(0);
  };

  // من «اقرأ وتعلّم» أو الألعاب إلى استوديو القصص بفكرة جاهزة؛ لا نقطع قصة قيد الكتابة
  const handleMakeStory = (idea: string) => {
    setSection('studio');
    if (stage === 'writing' || stage === 'illustrating') return;
    if (stage !== 'idle') startOver();
    setPrefill((p) => ({ idea, n: (p?.n ?? 0) + 1 }));
  };

  const handleChangeKey = () => {
    clearApiKey();
    setHasKey(false);
    setKeyEpoch(String(Date.now()));
  };

  const handleKeySaved = () => {
    setHasKey(true);
    setNoKey(false);
    setKeyEpoch(String(Date.now()));
  };

  const ar = language === 'Arabic';

  const handleLoadSaved = async () => {
    const saved = await latestStory();
    if (saved) await openStory(saved);
    else setError(ar ? 'تعذّر قراءة القصة المحفوظة.' : 'Could not read the saved story.');
  };

  const handleOpenFromLibrary = async (id: string) => {
    const story = await loadStory(id);
    if (story) await openStory(story);
  };

  const handleImportFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      await openStory(await loadStoryFromJSON(file));
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return (
    <div className="flex min-h-screen flex-col pb-[calc(4.75rem+env(safe-area-inset-bottom,0px))] md:pb-0">
      <NavBar
        active={section}
        onNavigate={setSection}
        language={language}
        onToggleLanguage={() => setLanguage((l) => (l === 'Arabic' ? 'English' : 'Arabic'))}
        theme={theme}
        onToggleTheme={toggleTheme}
      />

      <main className="mx-auto w-full max-w-4xl flex-1 px-3.5 pb-[calc(5.5rem+env(safe-area-inset-bottom,0px))] pt-4 sm:px-6 md:pb-16">
        <Suspense fallback={<SectionFallback />}>
          {section === 'studio' && !hasKey && <ApiKeyGate language={language} onSaved={handleKeySaved} noKey={noKey} />}

          {section === 'studio' && hasKey && (
            <>
              {stage === 'idle' && (
                <div className="space-y-5">
                  <PreflightBanner
                    ar={ar}
                    checkKey={keyEpoch}
                    onNeedKey={() => {
                      setNoKey(true);
                      setHasKey(false);
                    }}
                  />
                  <StorySetupForm key={`${series?.partNumber ?? 0}-${prefill?.n ?? 0}`} initialIdea={prefill?.idea} language={language} onSubmit={runGeneration} onLoadStory={handleLoadSaved} canLoadStory={canLoad} disabled={false} series={series} onCancelSeries={() => setSeries(null)} />
                  {error && (
                    <div role="alert" className="text-center text-sm text-coral">
                      <p>{error}</p>
                      <ErrorDetails ar={ar} />
                    </div>
                  )}
                  <div className="flex flex-col items-center gap-3">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-ink/60 underline-offset-4 hover:underline dark:text-moonlight/60"
                    >
                      <Upload size={14} aria-hidden />
                      {ar ? 'استيراد قصة محفوظة (JSON)' : 'Import a saved story (JSON)'}
                    </button>
                    <button type="button" onClick={handleChangeKey} className="min-h-11 text-sm font-medium text-ink/60 underline-offset-4 hover:underline dark:text-moonlight/60">
                      {ar ? 'تغيير مفتاح API' : 'Change API key'}
                    </button>
                    <input ref={fileInputRef} type="file" accept="application/json" className="hidden" onChange={handleImportFile} />
                  </div>
                </div>
              )}

              {(stage === 'writing' || stage === 'illustrating') && (
                <GenerationProgress progress={progress} message={message} preview={preview} isPaused={isPaused} onPause={handlePause} onResume={handleResume} language={language} />
              )}

              {stage === 'error' && (
                <div className="space-y-4 rounded-3xl border border-coral/30 bg-coral/5 p-6 text-center">
                  <AlertTriangle className="mx-auto text-coral" size={32} aria-hidden />
                  <p className="text-sm text-ink dark:text-moonlight">{error}</p>
                  <ErrorDetails ar={ar} />
                  <button
                    type="button"
                    onClick={retryAfterError}
                    className="mx-auto flex min-h-11 items-center gap-2 rounded-full border border-dream/30 px-5 text-sm font-medium text-ink dark:text-moonlight"
                  >
                    <RotateCcw size={16} aria-hidden />
                    {ar ? 'حاول مرة أخرى' : 'Try again'}
                  </button>
                </div>
              )}

              {stage === 'done' && storyData && (
                <StoryReader key={storyData.id} storyData={storyData} language={language} onStoryChange={updateStory} onStartOver={startOver} onNextPart={handleNextPart} onNavigate={setSection} />
              )}
            </>
          )}

          {section === 'library' && <Library language={language} onOpen={handleOpenFromLibrary} />}
          {section === 'games' && <GamesDashboard language={language} onMakeStory={handleMakeStory} onNavigate={setSection} />}
          {section === 'learn' && <ReadLearn language={language} onMakeStory={handleMakeStory} />}
          {section === 'names' && (hasKey ? <NameMeaning language={language} /> : <ApiKeyGate language={language} onSaved={handleKeySaved} />)}
        </Suspense>
        <Credits language={language} />
      </main>
    </div>
  );
}
