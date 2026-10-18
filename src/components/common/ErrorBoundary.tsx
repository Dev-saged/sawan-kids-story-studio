import { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home, Copy, Check, Download, ChevronDown, ChevronUp, Terminal } from 'lucide-react';
import { APP_VERSION } from '../../config';
import { getApiRequestHistory, getErrorLog } from '../../services/api';
import { getUserApiKey, keyHint, getFreeCreds } from '../../services/apiKey';
import { getLastEngine } from '../../services/imageEngine';
import { getGeneratorLogs } from '../../services/gemini';

export interface CrashReport {
  timestamp: string;
  appVersion: string;
  url: string;
  userAgent: string;
  language: string;
  screen: {
    width: number;
    height: number;
    pixelRatio: number;
  };
  online: boolean;
  error: {
    name: string;
    message: string;
    stack?: string;
  };
  componentStack?: string;
  appContext: {
    hasUserApiKey: boolean;
    apiKeyHint: string;
    freeEngineConfigured: boolean;
    lastImageEngine?: string | null;
  };
  apiRequestHistory: unknown[];
  errorLog: unknown[];
  generatorLogs: unknown[];
}

interface Props {
  children: ReactNode;
  fallback?: (error: Error, info: ErrorInfo, reset: () => void) => ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  reportJson: string;
  copied: boolean;
  showDetails: boolean;
}

const CRASH_STORAGE_KEY = 'sawan_last_crash_report';
const CRASH_HISTORY_KEY = 'sawan_crash_reports_history';

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      reportJson: '',
      copied: false,
      showDetails: false,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    const isAr = typeof document !== 'undefined' && (document.documentElement.lang === 'ar' || localStorage.getItem('sawan-language') === 'Arabic');
    const report: CrashReport = {
      timestamp: new Date().toISOString(),
      appVersion: APP_VERSION,
      url: typeof window !== 'undefined' ? window.location.href : '',
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
      language: isAr ? 'Arabic' : 'English',
      screen: {
        width: typeof window !== 'undefined' ? window.innerWidth : 0,
        height: typeof window !== 'undefined' ? window.innerHeight : 0,
        pixelRatio: typeof window !== 'undefined' ? window.devicePixelRatio : 1,
      },
      online: typeof navigator !== 'undefined' ? navigator.onLine : true,
      error: {
        name: error.name || 'Error',
        message: error.message || 'Unknown error',
        stack: error.stack,
      },
      componentStack: errorInfo.componentStack || undefined,
      appContext: {
        hasUserApiKey: Boolean(getUserApiKey()),
        apiKeyHint: keyHint(),
        freeEngineConfigured: Boolean(getFreeCreds()),
        lastImageEngine: getLastEngine(),
      },
      apiRequestHistory: getApiRequestHistory().slice(0, 20),
      errorLog: getErrorLog().slice(0, 10),
      generatorLogs: getGeneratorLogs().slice(-20),
    };

    const reportJson = JSON.stringify(report, null, 2);

    // تسجيل التقرير في localStorage للمطوّر
    try {
      localStorage.setItem(CRASH_STORAGE_KEY, reportJson);

      const existingHistoryRaw = localStorage.getItem(CRASH_HISTORY_KEY);
      const history = existingHistoryRaw ? JSON.parse(existingHistoryRaw) : [];
      history.unshift({
        timestamp: report.timestamp,
        error: report.error.message,
        appVersion: report.appVersion,
      });
      localStorage.setItem(CRASH_HISTORY_KEY, JSON.stringify(history.slice(0, 5)));
    } catch {
      // ignore localStorage quota errors
    }

    console.error('[ErrorBoundary] Captured technical crash report:', report);

    this.setState({
      errorInfo,
      reportJson,
    });
  }

  resetError = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      reportJson: '',
      copied: false,
    });
  };

  handleReload = () => {
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  };

  handleGoHome = () => {
    if (typeof window !== 'undefined') {
      window.location.hash = '';
      window.location.reload();
    }
  };

  handleCopyReport = async () => {
    const text = this.state.reportJson;
    if (!text) return;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        throw new Error('Clipboard API not available');
      }
      this.setState({ copied: true });
      setTimeout(() => this.setState({ copied: false }), 2500);
    } catch {
      // Fallback: use temporary textarea for copy in restricted iframe environments
      try {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        this.setState({ copied: true });
        setTimeout(() => this.setState({ copied: false }), 2500);
      } catch {
        // user can select the text directly
      }
    }
  };

  handleDownloadReport = () => {
    if (!this.state.reportJson) return;
    try {
      const blob = new Blob([this.state.reportJson], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `sawan_diagnostic_report_${Date.now()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      // ignore
    }
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    if (this.props.fallback && this.state.error && this.state.errorInfo) {
      return this.props.fallback(this.state.error, this.state.errorInfo, this.resetError);
    }

    const isAr = typeof document !== 'undefined' && (document.documentElement.lang === 'ar' || localStorage.getItem('sawan-language') === 'Arabic');
    const { error, reportJson, copied, showDetails } = this.state;

    return (
      <div
        className="min-h-screen w-full bg-sand/30 dark:bg-[#121118] px-4 py-8 flex items-center justify-center font-sans"
        dir={isAr ? 'rtl' : 'ltr'}
      >
        <div className="w-full max-w-2xl rounded-3xl border border-coral/30 bg-white p-6 shadow-2xl dark:bg-[#1c1a24] dark:text-moonlight sm:p-8 space-y-6">
          {/* Header */}
          <div className="flex items-start gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-coral/15 text-coral">
              <AlertTriangle size={32} />
            </div>
            <div className="space-y-1 min-w-0 flex-1">
              <h1 className="font-display text-xl sm:text-2xl font-bold text-ink dark:text-moonlight leading-snug">
                {isAr ? 'حدث خطأ غير متوقع في التطبيق' : 'An unexpected error occurred'}
              </h1>
              <p className="text-xs sm:text-sm text-ink/70 dark:text-moonlight/70 leading-relaxed">
                {isAr
                  ? 'تم تسجيل تفاصيل الخطأ وسياق النظام وسجل طلبات API في تقرير تشخيصي. يمكنك نسخ التقرير وإرساله للمطوّر لحله مباشرة.'
                  : 'Error details, component stack, and API request history were recorded to a diagnostic report. You can copy-paste it to solve the issue.'}
              </p>
            </div>
          </div>

          {/* Error Message Snippet */}
          <div className="rounded-2xl border border-coral/25 bg-coral/5 p-4 text-xs font-mono text-coral overflow-x-auto whitespace-pre-wrap break-words">
            <span className="font-bold">{error?.name || 'Error'}: </span>
            {error?.message || 'Unknown runtime error'}
          </div>

          {/* Primary Action Buttons */}
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={this.resetError}
              className="inline-flex min-h-11 items-center gap-2 rounded-full bg-lantern px-5 text-xs font-bold text-ink shadow-sm transition hover:brightness-105 active:scale-95"
            >
              <RefreshCw size={14} />
              <span>{isAr ? 'إعادة المحاولة' : 'Try again'}</span>
            </button>

            <button
              type="button"
              onClick={this.handleReload}
              className="inline-flex min-h-11 items-center gap-2 rounded-full border border-dream/30 bg-dream/10 px-4 text-xs font-semibold text-ink transition hover:bg-dream/20 dark:text-moonlight"
            >
              <span>{isAr ? 'تحديث الصفحة' : 'Reload page'}</span>
            </button>

            <button
              type="button"
              onClick={this.handleGoHome}
              className="inline-flex min-h-11 items-center gap-2 rounded-full border border-dream/30 px-4 text-xs font-semibold text-ink/75 transition hover:bg-dream/10 dark:text-moonlight/75"
            >
              <Home size={14} />
              <span>{isAr ? 'العودة للرئيسية' : 'Home'}</span>
            </button>
          </div>

          {/* Technical Diagnostic Report Accordion */}
          <div className="rounded-2xl border border-dream/20 bg-dream/5 dark:bg-white/5 overflow-hidden">
            <button
              type="button"
              onClick={() => this.setState({ showDetails: !showDetails })}
              className="flex w-full items-center justify-between p-4 text-xs font-bold text-ink/80 transition hover:bg-dream/10 dark:text-moonlight/80"
            >
              <div className="flex items-center gap-2">
                <Terminal size={15} className="text-lantern" />
                <span>{isAr ? 'التقرير التشخيصي والتفاصيل التقنية (Diagnostic Report)' : 'Technical Diagnostic Report'}</span>
              </div>
              {showDetails ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>

            {showDetails && (
              <div className="p-4 pt-0 space-y-3" dir="ltr">
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="font-mono text-[11px] text-ink/60 dark:text-moonlight/60">
                    Saved to localStorage: <code className="text-lantern">{CRASH_STORAGE_KEY}</code>
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={this.handleDownloadReport}
                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-ink/75 hover:text-ink dark:text-moonlight/75"
                      title={isAr ? 'تنزيل ملف JSON' : 'Download JSON'}
                    >
                      <Download size={13} />
                      <span>JSON</span>
                    </button>
                    <button
                      type="button"
                      onClick={this.handleCopyReport}
                      className="inline-flex items-center gap-1 rounded-full bg-lantern/20 px-3 py-1 font-semibold text-lantern transition hover:bg-lantern/30"
                    >
                      {copied ? <Check size={13} /> : <Copy size={13} />}
                      <span>{copied ? (isAr ? 'تم النسخ!' : 'Copied!') : isAr ? 'نسخ التقرير' : 'Copy report'}</span>
                    </button>
                  </div>
                </div>

                <pre className="max-h-72 select-all overflow-auto rounded-xl bg-black/85 p-3.5 font-mono text-[11px] leading-relaxed text-emerald-300 shadow-inner">
                  {reportJson}
                </pre>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }
}

export default ErrorBoundary;
