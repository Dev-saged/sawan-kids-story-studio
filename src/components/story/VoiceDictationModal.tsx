import { useState, useRef, useEffect, type ChangeEvent } from 'react';
import { Mic, Square, Sparkles, Copy, Check, Upload, AlertCircle, X, HelpCircle, Loader2 } from 'lucide-react';
import { Language } from '../../types';

interface Props {
  language: Language;
  onApplyText: (text: string) => void;
  onClose: () => void;
}

export default function VoiceDictationModal({ language, onApplyText, onClose }: Props) {
  const ar = language === 'Arabic';
  const [recording, setRecording] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPermHelp, setShowPermHelp] = useState(false);
  const [micState, setMicState] = useState<'prompt' | 'granted' | 'denied' | 'unknown'>('unknown');

  const recognitionRef = useRef<any>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // فحص حالة إذن الميكروفون عند الفتح
  useEffect(() => {
    if (navigator.permissions && navigator.permissions.query) {
      navigator.permissions
        .query({ name: 'microphone' as PermissionName })
        .then((status) => {
          setMicState(status.state as any);
          status.onchange = () => setMicState(status.state as any);
        })
        .catch(() => setMicState('unknown'));
    }
  }, []);

  // تنظيف أي مسار صوتي عند إغلاق النافذة
  useEffect(() => {
    return () => {
      try {
        recognitionRef.current?.stop();
      } catch {
        // ignore
      }
      try {
        if (mediaRecorderRef.current?.state === 'recording') {
          mediaRecorderRef.current.stop();
        }
      } catch {
        // ignore
      }
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const sendAudioToTranscribe = async (blob: Blob) => {
    setProcessing(true);
    setError(null);
    try {
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '');
        reader.onerror = () => reject(reader.error);
      });
      reader.readAsDataURL(blob);
      const base64 = await base64Promise;

      const res = await fetch('/api/transcribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ audio: base64, mimeType: blob.type || 'audio/webm' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Failed to transcribe');
      if (data?.text) {
        setTranscript((prev) => (prev ? `${prev} ${data.text}` : data.text));
      } else {
        setError(ar ? 'لم يتم التقاط أي كلمات واضحة في التسجيل. تحدث بصوت أوضح.' : 'No clear speech detected. Please speak louder.');
      }
    } catch (err: any) {
      setError(err?.message || (ar ? 'تعذّر تفريغ الصوت بالذكاء الاصطناعي.' : 'AI audio transcription failed.'));
    } finally {
      setProcessing(false);
    }
  };

  const startLiveRecording = async () => {
    setError(null);
    audioChunksRef.current = [];

    // محاولة استخدام Web Speech API للنسخ المباشر
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    let speechApiStarted = false;

    if (SpeechRecognition) {
      try {
        const recognition = new SpeechRecognition();
        recognition.lang = ar ? 'ar-SA' : 'en-US';
        recognition.continuous = true;
        recognition.interimResults = true;

        recognition.onresult = (event: any) => {
          let text = '';
          for (let i = 0; i < event.results.length; i++) {
            text += event.results[i][0].transcript;
          }
          if (text) setTranscript(text);
        };

        recognition.onerror = (e: any) => {
          console.warn('SpeechRecognition error:', e?.error);
        };

        recognition.start();
        recognitionRef.current = recognition;
        speechApiStarted = true;
      } catch {
        // SpeechRecognition قد يفشل في بعض المتصفحات، سنعتمد على تسجيل الصوت عبر MediaRecorder و Gemini
      }
    }

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('getUserMedia not supported');
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      setMicState('granted');

      const mimeCandidates = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/webm', 'audio/ogg', 'audio/wav'];
      const mime = mimeCandidates.find((m) => typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(m));

      const mediaRecorder = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(audioChunksRef.current, { type: mediaRecorder.mimeType || 'audio/webm' });
        // إذا لم يعطِ Web Speech API نصاً، نرسله لـ Gemini 2.5 Flash للتفريغ الدقيق
        if (blob.size > 1000 && (!transcript || !speechApiStarted)) {
          await sendAudioToTranscribe(blob);
        }
      };

      mediaRecorder.start();
      setRecording(true);
    } catch (err: any) {
      setRecording(false);
      try {
        recognitionRef.current?.stop();
      } catch {
        // ignore
      }

      if (err?.name === 'NotAllowedError' || err?.name === 'PermissionDeniedError') {
        setMicState('denied');
        setError(
          ar
            ? 'المتصفح حظر إذن الميكروفون ("اسمح بالإذن من إعدادات المتصفح"). انقر على أيقونة القفل في شريط عنوان المتصفح وفعّل الميكروفون، أو استخدم زر مسجل الجهاز أدناه.'
            : 'Browser blocked microphone permission. Click the lock icon in the address bar and allow microphone, or use the device recorder below.'
        );
        setShowPermHelp(true);
      } else {
        setError(
          ar
            ? 'تعذّر تشغيل الميكروفون المباشر. يمكنك استخدام خيار تسجيل الصوت بمسجل الجهاز أدناه.'
            : 'Could not access microphone directly. You can use the device recorder option below.'
        );
      }
    }
  };

  const stopLiveRecording = () => {
    setRecording(false);
    try {
      recognitionRef.current?.stop();
    } catch {
      // ignore
    }
    try {
      if (mediaRecorderRef.current?.state === 'recording') {
        mediaRecorderRef.current.stop();
      }
    } catch {
      // ignore
    }
  };

  const handleDeviceAudio = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    await sendAudioToTranscribe(file);
  };

  const handleCopy = async () => {
    if (!transcript) return;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(transcript);
      } else {
        throw new Error('Clipboard API unavailable');
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      try {
        const ta = document.createElement('textarea');
        ta.value = transcript;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
      } catch {
        // user can select directly
      }
    }
  };

  const handleApply = () => {
    if (!transcript.trim()) return;
    onApplyText(transcript.trim());
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" dir={ar ? 'rtl' : 'ltr'}>
      <div className="relative w-full max-w-lg rounded-3xl border border-dream/30 bg-white p-6 shadow-2xl dark:bg-dusk dark:text-moonlight sm:p-7">
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-5 end-5 rounded-full p-2 text-ink/60 transition hover:bg-dream/20 hover:text-ink dark:text-moonlight/60 dark:hover:text-moonlight"
          aria-label={ar ? 'إغلاق' : 'Close'}
        >
          <X size={20} />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-lantern/20 text-lantern">
            <Mic size={24} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h3 className="font-display text-lg font-bold text-ink dark:text-moonlight">
                {ar ? 'الإملاء الصوتي الذكي' : 'Smart Voice Dictation'}
              </h3>
              {micState === 'granted' && (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                  <Check size={11} />
                  {ar ? 'الميكروفون متاح' : 'Mic ready'}
                </span>
              )}
            </div>
            <p className="text-xs text-ink/60 dark:text-moonlight/60">
              {ar ? 'تحدث بفكرة قصتك، وسيقوم الذكاء الاصطناعي بنسخها وكتابتها تلقائياً' : 'Speak your story idea, and AI will transcribe it to text'}
            </p>
          </div>
        </div>

        {/* Active Recording State Indicator */}
        <div className="mt-6 flex flex-col items-center justify-center rounded-2xl border border-dream/20 bg-dream/5 p-6 text-center">
          {recording ? (
            <div className="flex flex-col items-center gap-3">
              <div className="relative flex h-20 w-20 items-center justify-center">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-coral/30 opacity-75" />
                <button
                  type="button"
                  onClick={stopLiveRecording}
                  className="relative flex h-16 w-16 items-center justify-center rounded-full bg-coral text-white shadow-lg transition active:scale-95"
                  title={ar ? 'اضغط للإيقاف' : 'Click to stop'}
                >
                  <Square size={24} fill="currentColor" />
                </button>
              </div>
              <p className="font-display text-sm font-bold text-coral animate-pulse">
                {ar ? 'نستمع لصوتك الآن... تحدث بحرية' : 'Listening to your voice... Speak freely'}
              </p>
            </div>
          ) : processing ? (
            <div className="flex flex-col items-center gap-3 py-4">
              <Loader2 size={36} className="animate-spin text-lantern" />
              <p className="text-sm font-semibold text-ink dark:text-moonlight">
                {ar ? 'الذكاء الاصطناعي يفرّغ ويدقق كلماتك بدقة...' : 'AI is transcribing your speech accurately...'}
              </p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-4">
              <button
                type="button"
                onClick={startLiveRecording}
                className="flex items-center gap-2 rounded-full bg-lantern px-6 py-3 font-display text-sm font-bold text-ink shadow-md transition hover:brightness-105 active:scale-95"
              >
                <Mic size={18} />
                <span>{transcript ? (ar ? 'تسجيل إضافي' : 'Record more') : ar ? 'بدء التحدث عبر الميكروفون' : 'Start speaking'}</span>
              </button>

              <div className="flex items-center gap-2 text-xs text-ink/60 dark:text-moonlight/60">
                <span>{ar ? 'أو' : 'or'}</span>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="audio/*"
                  // @ts-expect-error mobile capture
                  capture="microphone"
                  onChange={handleDeviceAudio}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex items-center gap-1.5 rounded-full border border-dream/40 bg-white/70 px-3.5 py-1.5 font-medium text-ink transition hover:border-lantern dark:bg-white/10 dark:text-moonlight"
                >
                  <Upload size={13} />
                  <span>{ar ? 'مسجل الهاتف / رفع صوت' : 'Device recorder / audio file'}</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Live / Transcribed Text Box */}
        <div className="mt-4 space-y-2">
          <div className="flex items-center justify-between text-xs font-semibold text-ink/70 dark:text-moonlight/70">
            <span>{ar ? 'النص المنسوخ من صوتك:' : 'Transcribed text:'}</span>
            {transcript && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleCopy}
                  className="inline-flex items-center gap-1 text-lantern hover:underline"
                >
                  {copied ? <Check size={13} /> : <Copy size={13} />}
                  <span>{copied ? (ar ? 'تم النسخ!' : 'Copied!') : ar ? 'نسخ النص' : 'Copy'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setTranscript('')}
                  className="text-ink/40 hover:text-coral dark:text-moonlight/40"
                >
                  {ar ? 'مسح' : 'Clear'}
                </button>
              </div>
            )}
          </div>
          <textarea
            rows={4}
            value={transcript}
            onChange={(e) => setTranscript(e.target.value)}
            placeholder={
              ar
                ? 'سيظهر كلامك هنا فور التحدث... أو يمكنك تعديله وكتابته كما تحب.'
                : 'Your spoken words will appear here... you can also edit them.'
            }
            className="w-full resize-none rounded-2xl border border-dream/30 bg-white/80 p-3.5 text-sm text-ink outline-none transition focus:border-lantern dark:bg-white/10 dark:text-moonlight"
          />
        </div>

        {/* Error / Permission Help */}
        {error && (
          <div className="mt-3 flex items-start gap-2 rounded-2xl border border-coral/30 bg-coral/10 p-3 text-xs text-coral">
            <AlertCircle size={16} className="shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-semibold">{error}</p>
              <button
                type="button"
                onClick={() => setShowPermHelp(!showPermHelp)}
                className="inline-flex items-center gap-1 font-bold underline"
              >
                <HelpCircle size={12} />
                <span>{ar ? 'كيف أفعّل الميكروفون في المتصفح؟' : 'How to enable microphone in browser?'}</span>
              </button>
            </div>
          </div>
        )}

        {showPermHelp && (
          <div className="mt-3 rounded-2xl border border-lantern/30 bg-lantern/10 p-3.5 text-xs text-ink/80 dark:text-moonlight/80 space-y-2">
            <p className="font-bold text-ink dark:text-moonlight">
              {ar ? 'طريقة حل مشكلة "اسمح بالإذن من إعدادات المتصفح":' : 'How to fix browser microphone permission:'}
            </p>
            <ol className="list-decimal list-inside space-y-1 leading-relaxed">
              <li>{ar ? 'انقر على أيقونة القفل أو خيارات الموقع في شريط عنوان المتصفح بأعلى الصفحة.' : 'Click the lock icon in the browser address bar at the top.'}</li>
              <li>{ar ? 'ابحث عن "الميكروفون" (Microphone) وحوله إلى "سماح" (Allow).' : 'Find "Microphone" and switch it to "Allow".'}</li>
              <li>{ar ? 'أو ببساطة اضغط على زر "مسجل الهاتف / رفع صوت" للتسجيل فوراً بدون أي أذونات متصفح!' : 'Or simply use the "Device recorder" button to record without browser permissions!'}</li>
            </ol>
          </div>
        )}

        {/* Actions */}
        <div className="mt-5 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="min-h-11 rounded-full border border-dream/30 px-5 text-xs font-semibold text-ink transition hover:bg-dream/10 dark:text-moonlight"
          >
            {ar ? 'إلغاء' : 'Cancel'}
          </button>
          <button
            type="button"
            disabled={!transcript.trim() || recording || processing}
            onClick={handleApply}
            className="inline-flex min-h-11 items-center gap-2 rounded-full bg-lantern px-6 text-xs font-bold text-ink shadow-sm transition hover:brightness-105 active:scale-95 disabled:opacity-40"
          >
            <Sparkles size={14} />
            <span>{ar ? 'إدراج في فكرة القصة' : 'Insert into story idea'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
