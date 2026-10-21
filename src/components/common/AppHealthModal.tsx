import { useEffect, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  Check,
  CheckCircle2,
  ClipboardCopy,
  Database,
  HardDrive,
  ImageIcon,
  KeyRound,
  Layers,
  Loader2,
  RefreshCw,
  Server,
  ShieldCheck,
  Trash2,
  Wifi,
  WifiOff,
  X,
} from 'lucide-react';
import {
  buildSafeHealthReportJson,
  collectAppHealthSnapshot,
  formatBytesAr,
  type AppHealthSnapshot,
} from '../../services/appHealth';
import { diagnoseImagePaths, type PathTest } from '../../services/imageEngine';
import { cleanImageCache, previewCleanImageCache, type CleanImageCacheResult } from '../../services/media';

interface AppHealthModalProps {
  ar: boolean;
  onClose: () => void;
  extraActiveImageIds?: Iterable<string>;
}

export default function AppHealthModal({ ar, onClose, extraActiveImageIds }: AppHealthModalProps) {
  const [snapshot, setSnapshot] = useState<AppHealthSnapshot | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [testingPaths, setTestingPaths] = useState<boolean>(false);
  const [pathTests, setPathTests] = useState<PathTest[] | undefined>(undefined);
  const [copied, setCopied] = useState<boolean>(false);
  const [cleanPreview, setCleanPreview] = useState<CleanImageCacheResult | null>(null);
  const [showCleanConfirm, setShowCleanConfirm] = useState<boolean>(false);
  const [cleaning, setCleaning] = useState<boolean>(false);
  const [cleanDoneMsg, setCleanDoneMsg] = useState<string | null>(null);

  const loadSnapshot = async (customTests?: PathTest[]) => {
    setLoading(true);
    try {
      const [snap, preview] = await Promise.all([
        collectAppHealthSnapshot(null, customTests ?? pathTests),
        previewCleanImageCache(extraActiveImageIds),
      ]);
      setSnapshot(snap);
      setCleanPreview(preview);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSnapshot();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleRunPathDiagnostics = async () => {
    setTestingPaths(true);
    try {
      const diag = await diagnoseImagePaths();
      setPathTests(diag.tests);
      await loadSnapshot(diag.tests);
    } finally {
      setTestingPaths(false);
    }
  };

  const handleCopyReport = async () => {
    if (!snapshot) return;
    const safeJson = buildSafeHealthReportJson(snapshot);
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(safeJson);
      } else {
        throw new Error('Clipboard unavailable');
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch {
      try {
        const ta = document.createElement('textarea');
        ta.value = safeJson;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        setCopied(true);
        setTimeout(() => setCopied(false), 2200);
      } catch {
        // ignore
      }
    }
  };

  const handlePrepareClean = async () => {
    const preview = await previewCleanImageCache(extraActiveImageIds);
    setCleanPreview(preview);
    setShowCleanConfirm(true);
    setCleanDoneMsg(null);
  };

  const handleConfirmClean = async () => {
    setCleaning(true);
    try {
      const res = await cleanImageCache(extraActiveImageIds);
      setShowCleanConfirm(false);
      setCleanDoneMsg(
        ar
          ? `تم تنظيف ${res.orphanCount} صورة غير مرتبطة وتوفير ${formatBytesAr(res.orphanBytes, true)} (مع الحفاظ التام على ${res.keptCount} صورة مرتبطة بالقصص والأبطال).`
          : `Cleaned ${res.orphanCount} unreferenced images (${formatBytesAr(res.orphanBytes, false)} freed; ${res.keptCount} active story/hero images preserved).`
      );
      await loadSnapshot();
    } finally {
      setCleaning(false);
    }
  };

  const storeLabels: { key: keyof AppHealthSnapshot['indexedDb']['stores']; ar: string; en: string }[] = [
    { key: 'stories', ar: 'القصص', en: 'Stories' },
    { key: 'images', ar: 'الصور', en: 'Images' },
    { key: 'audio', ar: 'الصوتيات', en: 'Audio' },
    { key: 'children', ar: 'الأبطال', en: 'Child Heroes' },
    { key: 'characters', ar: 'ألبوم الشخصيات', en: 'Characters' },
    { key: 'voice_profiles', ar: 'البصمات الصوتية', en: 'Voice Profiles' },
    { key: 'custom_presets', ar: 'الهويات المخصصة', en: 'Custom Presets' },
  ];

  const categoryLabels: {
    key: keyof AppHealthSnapshot['preflightStatus']['categories'];
    ar: string;
    en: string;
  }[] = [
    { key: 'text', ar: 'النص', en: 'Text' },
    { key: 'image', ar: 'الصورة', en: 'Image' },
    { key: 'tts', ar: 'الصوت (TTS)', en: 'Voice (TTS)' },
    { key: 'music', ar: 'الموسيقى', en: 'Music' },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-3 sm:p-5 backdrop-blur-xs"
      dir={ar ? 'rtl' : 'ltr'}
      role="dialog"
      aria-modal="true"
      aria-labelledby="app-health-title"
    >
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl border border-dream/30 bg-moonlight text-ink shadow-2xl dark:border-white/15 dark:bg-dusk dark:text-moonlight">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 border-b border-dream/20 px-4 py-3.5 sm:px-6 dark:border-white/10">
          <div className="flex items-center gap-2.5">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-lantern/20 text-lantern">
              <Activity size={20} aria-hidden />
            </span>
            <div>
              <h2 id="app-health-title" className="font-display text-base sm:text-lg font-extrabold text-ink dark:text-moonlight">
                {ar ? 'حالة التطبيق' : 'App Health Report'}
              </h2>
              <p className="text-xs font-semibold text-ink/65 dark:text-moonlight/70">
                {ar ? 'تقرير تقني شامل بدون كشف أي مفاتيح سرية' : 'Comprehensive health diagnostics with zero secret exposure'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => loadSnapshot()}
              disabled={loading}
              className="flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-dream/30 bg-white/70 text-ink transition-opacity hover:border-lantern dark:border-white/15 dark:bg-white/10 dark:text-moonlight"
              aria-label={ar ? 'تحديث التقرير' : 'Refresh report'}
            >
              <RefreshCw size={16} className={loading ? 'animate-spin motion-reduce:animate-none' : ''} aria-hidden />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-dream/30 bg-white/70 text-ink transition-opacity hover:border-coral dark:border-white/15 dark:bg-white/10 dark:text-moonlight"
              aria-label={ar ? 'إغلاق' : 'Close'}
            >
              <X size={18} aria-hidden />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 space-y-4 overflow-y-auto p-4 sm:p-6">
          {loading && !snapshot ? (
            <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
              <Loader2 size={28} className="animate-spin motion-reduce:animate-none text-lantern" aria-hidden />
              <p className="font-display text-sm font-bold text-ink/75 dark:text-moonlight/80">
                {ar ? 'نفحص حالة التطبيق والمخازن المحلية...' : 'Checking application health and local stores...'}
              </p>
            </div>
          ) : snapshot ? (
            <>
              {/* 1) الإصدار والاتصال ومصدر المفتاح */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                {/* الإصدار والبناء */}
                <div className="rounded-2xl border border-dream/25 bg-white/75 p-3.5 dark:border-white/10 dark:bg-white/5">
                  <div className="flex items-center gap-1.5 text-xs font-extrabold text-ink/70 dark:text-moonlight/75">
                    <ShieldCheck size={15} className="text-lantern shrink-0" aria-hidden />
                    <span>{ar ? 'الإصدار والبناء' : 'Version & Build'}</span>
                  </div>
                  <p className="mt-1.5 font-display text-sm font-extrabold text-ink dark:text-moonlight">
                    v{snapshot.version.currentVersion} · #{snapshot.version.buildNumber}
                  </p>
                  <p className="mt-0.5 text-[11px] font-semibold text-ink/65 dark:text-moonlight/70">
                    {ar ? `آخر إصدار (version.json): v${snapshot.version.latestVersion}` : `Latest (version.json): v${snapshot.version.latestVersion}`}
                  </p>
                </div>

                {/* مصدر المفتاح (مقنّع) */}
                <div className="rounded-2xl border border-dream/25 bg-white/75 p-3.5 dark:border-white/10 dark:bg-white/5">
                  <div className="flex items-center gap-1.5 text-xs font-extrabold text-ink/70 dark:text-moonlight/75">
                    <KeyRound size={15} className="text-lantern shrink-0" aria-hidden />
                    <span>{ar ? 'مصدر المفتاح' : 'API Key Source'}</span>
                  </div>
                  <p className="mt-1.5 font-display text-sm font-extrabold text-ink dark:text-moonlight">
                    {ar ? snapshot.keyStatus.sourceLabelAr : snapshot.keyStatus.sourceLabelEn}
                  </p>
                  <p className="mt-0.5 font-mono text-[11px] text-ink/65 dark:text-moonlight/70" dir="ltr">
                    {snapshot.keyStatus.maskedHint}
                  </p>
                </div>

                {/* الاتصال و Preflight */}
                <div className="rounded-2xl border border-dream/25 bg-white/75 p-3.5 dark:border-white/10 dark:bg-white/5">
                  <div className="flex items-center gap-1.5 text-xs font-extrabold text-ink/70 dark:text-moonlight/75">
                    {snapshot.online ? (
                      <Wifi size={15} className="text-emerald-600 dark:text-emerald-400 shrink-0" aria-hidden />
                    ) : (
                      <WifiOff size={15} className="text-coral shrink-0" aria-hidden />
                    )}
                    <span>{ar ? 'الاتصال وفحص Preflight' : 'Network & Preflight'}</span>
                  </div>
                  <p className="mt-1.5 font-display text-sm font-extrabold text-ink dark:text-moonlight">
                    {snapshot.online ? (ar ? 'متصل بالإنترنت' : 'Online') : ar ? 'غير متصل (وضع محلي)' : 'Offline'}
                  </p>
                  <p className="mt-0.5 text-[11px] font-bold text-ink/70 dark:text-moonlight/75">
                    Preflight:{' '}
                    <span className={snapshot.preflightStatus.ok ? 'text-emerald-700 dark:text-emerald-400' : 'text-coral'}>
                      {snapshot.preflightStatus.ok ? (ar ? 'ناجح' : 'OK') : snapshot.preflightStatus.code || (ar ? 'غير متاح' : 'Failed')}
                    </span>
                  </p>
                </div>
              </div>

              {/* 2) توفر النماذج لكل فئة (نص، صورة، صوت، موسيقى) */}
              <div className="rounded-2xl border border-dream/25 bg-white/75 p-3.5 dark:border-white/10 dark:bg-white/5 space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-display text-xs sm:text-sm font-extrabold text-ink dark:text-moonlight flex items-center gap-1.5">
                    <Layers size={15} className="text-lantern shrink-0" aria-hidden />
                    <span>{ar ? 'توفر النماذج حسب الفئة' : 'Model Availability by Category'}</span>
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {categoryLabels.map(({ key, ar: labelAr, en: labelEn }) => {
                    const cat = snapshot.preflightStatus.categories[key];
                    return (
                      <div
                        key={key}
                        className="flex flex-col justify-between gap-1.5 rounded-xl border border-dream/20 bg-moonlight/70 p-2.5 dark:border-white/10 dark:bg-black/25"
                      >
                        <div className="flex items-center justify-between gap-1">
                          <span className="text-xs font-extrabold text-ink dark:text-moonlight">{ar ? labelAr : labelEn}</span>
                          <span
                            className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-extrabold ${
                              cat.ready
                                ? 'bg-emerald-700 text-white'
                                : 'bg-stone-700 text-white'
                            }`}
                          >
                            {cat.ready ? (ar ? 'جاهز' : 'Ready') : ar ? 'غير متاح' : 'Unavailable'}
                          </span>
                        </div>
                        <span className="text-[11px] font-semibold text-ink/65 dark:text-moonlight/70">
                          {ar ? `${cat.count} نموذج` : `${cat.count} models`}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 3) صحة محركات الصور في الجلسة (down Map) */}
              <div className="rounded-2xl border border-dream/25 bg-white/75 p-3.5 dark:border-white/10 dark:bg-white/5 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-display text-xs sm:text-sm font-extrabold text-ink dark:text-moonlight flex items-center gap-1.5">
                    <ImageIcon size={15} className="text-lantern shrink-0" aria-hidden />
                    <span>{ar ? 'صحة محركات الصور في الجلسة (down Map)' : 'Session Image Engines Health (down Map)'}</span>
                  </span>
                  {snapshot.imageEnginesSession.lastEngine && (
                    <span className="rounded-md bg-lantern/20 px-2 py-0.5 font-mono text-[11px] font-bold text-ink dark:text-amber-200">
                      {ar ? 'آخر محرك ناجح: ' : 'Last engine: '}
                      {snapshot.imageEnginesSession.lastEngine}
                    </span>
                  )}
                </div>
                {snapshot.imageEnginesSession.engines.length === 0 && snapshot.imageEnginesSession.models.length === 0 ? (
                  <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                    {ar
                      ? 'جميع مسارات ونماذج الصور في الجلسة نشطة وجاهزة (لا يوجد أي محرك في فترة تهدئة).'
                      : 'All session image engines and models are active and healthy (0 in cooldown).'}
                  </p>
                ) : (
                  <div className="space-y-1.5 text-xs">
                    {snapshot.imageEnginesSession.engines.map((e, i) => (
                      <div key={i} className="flex items-center justify-between rounded-xl bg-coral/10 px-3 py-1.5 font-mono text-[11px] text-ink dark:text-moonlight">
                        <span>{e.slot}</span>
                        <span>{e.down ? `${Math.ceil(e.remainingMs / 1000)}s cooldown` : 'ready'}</span>
                      </div>
                    ))}
                    {snapshot.imageEnginesSession.models.map((m, i) => (
                      <div key={i} className="flex items-center justify-between rounded-xl bg-amber-500/15 px-3 py-1.5 font-mono text-[11px] text-ink dark:text-moonlight">
                        <span>{m.slot}</span>
                        <span>{m.down ? `${Math.ceil(m.remainingMs / 1000)}s cooldown` : 'ready'}</span>
                      </div>
                    ))}
                  </div>
                )}

                {snapshot.imagePathTests && snapshot.imagePathTests.length > 0 && (
                  <div className="mt-2 space-y-1.5 border-t border-dream/20 pt-2 dark:border-white/10">
                    <p className="text-xs font-extrabold text-ink dark:text-amber-200">
                      {ar ? 'نتائج فحص مسارات الصور:' : 'Image Path Diagnostic Results:'}
                    </p>
                    {snapshot.imagePathTests.map((t, idx) => (
                      <div
                        key={idx}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-black/5 px-3 py-1.5 font-mono text-[11px] dark:bg-white/5"
                        dir="ltr"
                      >
                        <span className="font-bold">
                          {t.engine}: {t.ok ? 'OK' : 'FAIL'} ({t.ms}ms)
                        </span>
                        {t.detail && <span className="text-ink/70 dark:text-moonlight/70 truncate max-w-xs">{t.detail}</span>}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* 4) حالة IndexedDB واستهلاك التخزين و Service Worker */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {/* IndexedDB */}
                <div className="rounded-2xl border border-dream/25 bg-white/75 p-3.5 dark:border-white/10 dark:bg-white/5 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-display text-xs sm:text-sm font-extrabold text-ink dark:text-moonlight flex items-center gap-1.5">
                      <Database size={15} className="text-lantern shrink-0" aria-hidden />
                      <span>{ar ? 'قاعدة IndexedDB المحلية' : 'IndexedDB Status'}</span>
                    </span>
                    <span className="rounded-md bg-lantern/20 px-2 py-0.5 font-mono text-[11px] font-bold text-ink dark:text-amber-200">
                      v{snapshot.indexedDb.schemaVersion}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5 text-xs">
                    {storeLabels.map(({ key, ar: lAr, en: lEn }) => (
                      <div
                        key={key}
                        className="flex items-center justify-between rounded-lg bg-moonlight/70 px-2.5 py-1 dark:bg-black/25"
                      >
                        <span className="font-semibold text-ink/75 dark:text-moonlight/80">{ar ? lAr : lEn}</span>
                        <span className="font-mono font-extrabold text-ink dark:text-amber-200">
                          {snapshot.indexedDb.stores[key]}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* التخزين و Service Worker */}
                <div className="rounded-2xl border border-dream/25 bg-white/75 p-3.5 dark:border-white/10 dark:bg-white/5 space-y-3">
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2 text-xs font-extrabold text-ink dark:text-moonlight">
                      <span className="flex items-center gap-1.5">
                        <HardDrive size={15} className="text-lantern shrink-0" aria-hidden />
                        <span>{ar ? 'استهلاك التخزين' : 'Storage Usage'}</span>
                      </span>
                      <span className="font-mono text-[11px]">
                        {snapshot.storage.supported
                          ? `${formatBytesAr(snapshot.storage.usageBytes, ar)} / ${formatBytesAr(snapshot.storage.quotaBytes, ar)} (${snapshot.storage.percent}%)`
                          : ar
                            ? 'غير مدعوم'
                            : 'N/A'}
                      </span>
                    </div>
                    <div className="h-2.5 w-full overflow-hidden rounded-full bg-dream/20 dark:bg-white/10">
                      <div
                        className="h-full rounded-full bg-lantern transition-transform origin-right rtl:origin-right ltr:origin-left"
                        style={{
                          transform: `scaleX(${Math.max(0.02, Math.min(1, snapshot.storage.percent / 100))})`,
                        }}
                      />
                    </div>
                  </div>

                  <div className="border-t border-dream/20 pt-2.5 dark:border-white/10 space-y-1">
                    <div className="flex items-center justify-between gap-2 text-xs font-extrabold text-ink dark:text-moonlight">
                      <span className="flex items-center gap-1.5">
                        <Server size={14} className="text-lantern shrink-0" aria-hidden />
                        <span>Service Worker</span>
                      </span>
                      <span className="font-mono text-[11px] font-bold text-emerald-700 dark:text-emerald-400">
                        {snapshot.serviceWorker.state}
                      </span>
                    </div>
                    <p className="text-[11px] font-semibold text-ink/65 dark:text-moonlight/70 break-all">
                      {ar ? 'اسم الكاش: ' : 'Cache: '}
                      <span className="font-mono">
                        {snapshot.serviceWorker.cacheNames.length > 0
                          ? snapshot.serviceWorker.cacheNames.join(', ')
                          : ar
                            ? 'لا يوجد كاش نشط'
                            : 'None'}
                      </span>
                    </p>
                  </div>
                </div>
              </div>

              {/* 5) آخر 5 أخطاء مع المحرك والنموذج */}
              <div className="rounded-2xl border border-dream/25 bg-white/75 p-3.5 dark:border-white/10 dark:bg-white/5 space-y-2">
                <span className="font-display text-xs sm:text-sm font-extrabold text-ink dark:text-moonlight flex items-center gap-1.5">
                  <AlertTriangle size={15} className="text-lantern shrink-0" aria-hidden />
                  <span>{ar ? 'آخر 5 أخطاء مسجلة (مع المحرك والنموذج)' : 'Last 5 Errors (with Engine & Model)'}</span>
                </span>
                {snapshot.lastErrors.length === 0 ? (
                  <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                    {ar ? 'لا توجد أخطاء مسجلة في هذه الجلسة.' : 'No errors recorded in this session.'}
                  </p>
                ) : (
                  <ul className="space-y-1.5">
                    {snapshot.lastErrors.map((err, idx) => (
                      <li
                        key={idx}
                        className="rounded-xl border border-coral/30 bg-coral/10 p-2.5 text-xs text-ink dark:text-moonlight"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2 font-mono text-[11px] font-bold">
                          <span>
                            [{err.code}] {err.engine} · {err.model}
                          </span>
                          <span className="text-ink/65 dark:text-moonlight/70">
                            {new Date(err.at).toLocaleTimeString(ar ? 'ar' : 'en')}
                          </span>
                        </div>
                        {err.detail && (
                          <p className="mt-1 font-mono text-[11px] text-ink/80 dark:text-moonlight/85 break-words" dir="ltr">
                            {err.detail}
                          </p>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* 6) نافذة تأكيد تنظيف الكاش أو رسالة النجاح */}
              {showCleanConfirm && cleanPreview && (
                <div
                  role="alertdialog"
                  aria-label={ar ? 'تأكيد تنظيف الكاش' : 'Confirm cache cleanup'}
                  className="rounded-2xl border border-lantern bg-lantern/15 p-3.5 space-y-2.5"
                >
                  <p className="font-display text-xs sm:text-sm font-extrabold text-ink dark:text-moonlight">
                    {cleanPreview.orphanCount > 0
                      ? ar
                        ? `هل تريد حذف ${cleanPreview.orphanCount} صورة غير مرتبطة بأي قصة أو بطل (الحجم المتوقع: ${formatBytesAr(cleanPreview.orphanBytes, true)})؟ لن يتم المساس أبداً بـ ${cleanPreview.keptCount} صورة مرتبطة بقصصك وأبطالك.`
                        : `Delete ${cleanPreview.orphanCount} unreferenced images (expected size: ${formatBytesAr(cleanPreview.orphanBytes, false)})? All ${cleanPreview.keptCount} story & hero images will be safely kept.`
                      : ar
                        ? `لا توجد أي صور يتيمة للحذف حالياً. جميع الصور الـ ${cleanPreview.keptCount} مرتبطة بقصصك وأبطالك وألبوم الشخصيات.`
                        : `No orphan images found. All ${cleanPreview.keptCount} images are linked to your stories, heroes, and character album.`}
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    {cleanPreview.orphanCount > 0 && (
                      <button
                        type="button"
                        disabled={cleaning}
                        onClick={handleConfirmClean}
                        className="inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-coral px-4 py-2 text-xs font-extrabold text-white transition-opacity hover:opacity-95 disabled:opacity-50"
                      >
                        {cleaning ? <Loader2 size={14} className="animate-spin" aria-hidden /> : <Trash2 size={14} aria-hidden />}
                        <span>{ar ? 'تأكيد التنظيف الآمن' : 'Confirm Safe Cleanup'}</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setShowCleanConfirm(false)}
                      className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-dream/35 bg-white/80 px-4 py-2 text-xs font-bold text-ink dark:border-white/15 dark:bg-white/10 dark:text-moonlight"
                    >
                      <span>{ar ? 'إلغاء' : 'Cancel'}</span>
                    </button>
                  </div>
                </div>
              )}

              {cleanDoneMsg && (
                <div className="flex items-center gap-2 rounded-2xl border border-emerald-500/40 bg-emerald-500/10 p-3 text-xs font-bold text-emerald-800 dark:text-emerald-300">
                  <CheckCircle2 size={16} className="shrink-0" aria-hidden />
                  <span>{cleanDoneMsg}</span>
                </div>
              )}
            </>
          ) : null}
        </div>

        {/* Footer Actions: فحص مسارات الصور + تنظيف الكاش + نسخ التقرير */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-dream/20 bg-white/60 px-4 py-3 sm:px-6 dark:border-white/10 dark:bg-black/25">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleRunPathDiagnostics}
              disabled={testingPaths || loading}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-dream/35 bg-white/85 px-3.5 py-2 text-xs font-extrabold text-ink transition-opacity hover:border-lantern disabled:opacity-50 dark:border-white/15 dark:bg-white/10 dark:text-moonlight"
            >
              {testingPaths ? (
                <Loader2 size={15} className="animate-spin motion-reduce:animate-none text-lantern" aria-hidden />
              ) : (
                <ImageIcon size={15} className="text-lantern" aria-hidden />
              )}
              <span>{testingPaths ? (ar ? 'نفحص المسارات...' : 'Testing paths...') : ar ? 'فحص مسارات الصور' : 'Test image paths'}</span>
            </button>

            <button
              type="button"
              onClick={handlePrepareClean}
              disabled={cleaning || loading}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-dream/35 bg-white/85 px-3.5 py-2 text-xs font-extrabold text-ink transition-opacity hover:border-lantern disabled:opacity-50 dark:border-white/15 dark:bg-white/10 dark:text-moonlight"
            >
              <Trash2 size={15} className="text-lantern" aria-hidden />
              <span>
                {ar ? 'تنظيف الكاش' : 'Clean Cache'}
                {cleanPreview && cleanPreview.orphanCount > 0 ? ` (${cleanPreview.orphanCount})` : ''}
              </span>
            </button>
          </div>

          <button
            type="button"
            onClick={handleCopyReport}
            disabled={!snapshot}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-lantern px-4 py-2 text-xs font-extrabold text-ink shadow-xs transition-opacity hover:opacity-95 disabled:opacity-50"
          >
            {copied ? <Check size={15} aria-hidden /> : <ClipboardCopy size={15} aria-hidden />}
            <span>{copied ? (ar ? 'تم نسخ التقرير النظيف' : 'Clean Report Copied') : ar ? 'نسخ التقرير' : 'Copy Report'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
