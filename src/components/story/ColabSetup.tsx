import { useCallback, useEffect, useState } from 'react';
import { CircleCheck, CircleDashed, Loader2, TriangleAlert } from 'lucide-react';
import { clearColabConfig, fetchColabStatus, isWorkerOnline, loadColabConfig, normalizeQueueUrl, saveColabConfig, type ColabConfig, type ColabStatus } from '../../services/colabQueue';

interface Props {
  ar: boolean;
  disabled: boolean;
  onConfig: (cfg: ColabConfig | null) => void;
}

type Probe = { state: 'idle' } | { state: 'busy' } | { state: 'ok'; status: ColabStatus } | { state: 'error'; message: string };

const field = 'min-h-11 w-full rounded-xl border border-dream/30 bg-white/70 px-3 text-sm text-ink placeholder:text-ink/40 dark:bg-white/10 dark:text-moonlight';

export default function ColabSetup({ ar, disabled, onConfig }: Props) {
  const saved = loadColabConfig();
  const [url, setUrl] = useState(saved?.url ?? '');
  const [token, setToken] = useState(saved?.token ?? '');
  const [cfg, setCfg] = useState<ColabConfig | null>(saved);
  const [probe, setProbe] = useState<Probe>({ state: 'idle' });

  const test = useCallback(
    async (target: ColabConfig | null) => {
      if (!target) return;
      setProbe({ state: 'busy' });
      try {
        setProbe({ state: 'ok', status: await fetchColabStatus(target) });
      } catch (err) {
        setProbe({ state: 'error', message: (err as Error).message });
      }
    },
    []
  );

  useEffect(() => {
    onConfig(cfg);
    if (cfg) void test(cfg);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const urlOk = Boolean(normalizeQueueUrl(url));
  const tokenOk = token.trim().length >= 16;

  const save = () => {
    const next = saveColabConfig(url, token);
    setCfg(next);
    onConfig(next);
    void test(next);
  };

  const forget = () => {
    clearColabConfig();
    setCfg(null);
    setUrl('');
    setToken('');
    setProbe({ state: 'idle' });
    onConfig(null);
  };

  return (
    <details className="rounded-xl border border-dream/25 bg-white/40 p-2.5 dark:bg-white/5" open={!cfg}>
      <summary className="flex min-h-11 cursor-pointer items-center gap-2 text-xs font-bold text-ink dark:text-moonlight">
        {probe.state === 'ok' ? (
          isWorkerOnline(probe.status) ? <CircleCheck size={15} className="text-emerald-600" aria-hidden /> : <CircleDashed size={15} className="text-amber-600" aria-hidden />
        ) : probe.state === 'busy' ? (
          <Loader2 size={15} className="animate-spin" aria-hidden />
        ) : (
          <CircleDashed size={15} className="opacity-60" aria-hidden />
        )}
        <span data-testid="colab-status">
          {!cfg
            ? ar ? 'إعداد اتصال Colab' : 'Set up Colab connection'
            : probe.state === 'ok'
              ? isWorkerOnline(probe.status)
                ? ar ? 'دفتر Colab متصل ويعمل' : 'Colab notebook is online'
                : ar ? 'الطابور يعمل لكن دفتر Colab غير مشغَّل' : 'Queue is up, but the Colab notebook is not running'
              : probe.state === 'error'
                ? ar ? 'تعذّر الاتصال بالطابور' : 'Cannot reach the queue'
                : ar ? 'إعداد اتصال Colab' : 'Colab connection'}
        </span>
      </summary>
      <div className="mt-2 space-y-2">
        <input dir="ltr" inputMode="url" autoComplete="off" spellCheck={false} className={field} placeholder="https://sawan-video-queue.xxx.workers.dev" aria-label={ar ? 'رابط الطابور' : 'Queue URL'} value={url} disabled={disabled} onChange={(e) => setUrl(e.target.value)} />
        <input dir="ltr" type="password" autoComplete="off" spellCheck={false} className={field} placeholder="APP_TOKEN" aria-label={ar ? 'رمز الوصول' : 'Access token'} value={token} disabled={disabled} onChange={(e) => setToken(e.target.value)} />
        <div className="flex gap-2">
          <button type="button" onClick={save} disabled={disabled || !urlOk || !tokenOk} className="min-h-11 flex-1 rounded-xl bg-lantern text-xs font-bold text-ink active:scale-95 disabled:opacity-40">
            {ar ? 'حفظ واختبار' : 'Save & test'}
          </button>
          {cfg && (
            <button type="button" onClick={() => test(cfg)} disabled={disabled || probe.state === 'busy'} className="min-h-11 rounded-xl border border-dream/30 px-3 text-xs font-semibold text-ink/75 active:scale-95 disabled:opacity-40 dark:text-moonlight/75">
              {ar ? 'فحص' : 'Check'}
            </button>
          )}
          {cfg && (
            <button type="button" onClick={forget} disabled={disabled} className="min-h-11 rounded-xl px-3 text-xs font-semibold text-coral active:scale-95 disabled:opacity-40">
              {ar ? 'نسيان' : 'Forget'}
            </button>
          )}
        </div>
        {probe.state === 'ok' && (
          <p className="text-[11px] text-ink/65 dark:text-moonlight/65">
            {ar ? `في الطابور: ${probe.status.queued} بانتظار · ${probe.status.running} قيد التوليد` : `Queue: ${probe.status.queued} waiting · ${probe.status.running} running`}
          </p>
        )}
        {probe.state === 'error' && (
          <p className="flex items-start gap-1.5 text-[11px] text-coral" role="alert">
            <TriangleAlert size={13} className="mt-0.5 shrink-0" aria-hidden />
            <span>{probe.message}</span>
          </p>
        )}
        <p className="text-[11px] leading-relaxed text-ink/55 dark:text-moonlight/55">
          {ar ? 'الرابط والرمز يُحفظان على جهازك فقط. خطوات النشر في cloudflare/video-queue/README.md وتشغيل الدفتر في colab/.' : 'URL and token stay on this device only. Deploy steps: cloudflare/video-queue/README.md; notebook: colab/.'}
        </p>
      </div>
    </details>
  );
}
