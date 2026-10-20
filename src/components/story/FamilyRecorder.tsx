import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { Check, Mic, Square, Upload, AlertCircle } from 'lucide-react';
import { hasFamilyAudio, saveFamilyAudio } from '../../services/narration';

interface Props {
  ar: boolean;
  storyId?: string;
  pageNo: number;
  onSaved: () => void;
}

const MIME = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/webm', 'audio/ogg', 'audio/wav'];

// تسجيل صوت الأب أو الأم للصفحة الحالية (يُستخدم عند اختيار «صوت العائلة»)
export default function FamilyRecorder({ ar, storyId, pageNo, onSaved }: Props) {
  const [recording, setRecording] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunks = useRef<Blob[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let alive = true;
    hasFamilyAudio(storyId, pageNo).then((v) => alive && setSaved(v));
    return () => {
      alive = false;
    };
  }, [storyId, pageNo]);

  useEffect(
    () => () => {
      if (recRef.current?.state === 'recording') recRef.current.stop();
      streamRef.current?.getTracks().forEach((t) => t.stop());
    },
    []
  );

  const start = async () => {
    setError(null);
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('getUserMedia not supported in this context');
      }
      // طلب إذن بسيط ومباشر بدون شروط صارمة
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mime = MIME.find((m) => typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(m));
      const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      chunks.current = [];
      rec.ondataavailable = (e) => e.data.size && chunks.current.push(e.data);
      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunks.current, { type: rec.mimeType || 'audio/webm' });
        if (blob.size > 0) {
          await saveFamilyAudio(storyId, pageNo, blob);
          setSaved(true);
          onSaved();
        }
      };
      rec.start();
      recRef.current = rec;
      setRecording(true);
    } catch (err: any) {
      if (err?.name === 'NotAllowedError' || err?.name === 'PermissionDeniedError') {
        setError(
          ar
            ? 'المتصفح حظر إذن الميكروفون ("اسمح بالإذن من إعدادات المتصفح"). اضغط على أيقونة القفل في شريط عنوان المتصفح وفعّل الميكروفون، أو استخدم زر مسجل الجهاز أدناه للتسجيل فوراً.'
            : 'Microphone permission blocked ("allow in browser settings"). Click the lock icon in the address bar to allow microphone, or use the device recorder button below.'
        );
      } else {
        setError(
          ar
            ? 'المتصفح يمنع الميكروفون المباشر. اضغط الزر أدناه للتسجيل عبر تطبيق الصوت بجهازك أو رفع ملف صوتي.'
            : 'Microphone direct access is restricted. Tap below to record using your device recorder or upload audio.'
        );
      }
    }
  };

  const stop = () => {
    recRef.current?.stop();
    setRecording(false);
  };

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      await saveFamilyAudio(storyId, pageNo, file);
      setSaved(true);
      setError(null);
      onSaved();
    } catch {
      setError(ar ? 'تعذّر حفظ الملف الصوتي.' : 'Could not save audio file.');
    }
  };

  return (
    <div className="flex w-full flex-col gap-2">
      <div className="flex w-full flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={recording ? stop : start}
          aria-pressed={recording}
          className={`inline-flex min-h-11 items-center gap-1.5 rounded-full px-4 text-xs font-bold transition active:scale-95 ${
            recording ? 'bg-coral text-white animate-pulse' : 'bg-lantern text-ink hover:brightness-105'
          }`}
        >
          {recording ? <Square size={13} fill="currentColor" aria-hidden /> : <Mic size={14} aria-hidden />}
          {recording
            ? ar
              ? 'إيقاف التسجيل'
              : 'Stop recording'
            : saved
            ? ar
              ? 'أعد تسجيل هذه الصفحة'
              : 'Re-record this page'
            : ar
            ? 'سجّل صوتك لهذه الصفحة'
            : 'Record this page'}
        </button>

        {/* خيار التسجيل بالنظام أو رفع ملف صوتي مباشرة (يعمل دائماً حتى لو منع الإطار الميكروفون) */}
        <input
          ref={fileInputRef}
          type="file"
          accept="audio/*"
          // @ts-expect-error capture is supported on mobile devices
          capture="microphone"
          onChange={handleFileChange}
          className="hidden"
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-dream/30 bg-dream/10 px-3.5 text-xs font-semibold text-ink/80 transition hover:bg-dream/20 dark:text-moonlight/80"
          title={ar ? 'تسجيل عبر مسجل الجهاز أو رفع ملف MP3/WAV' : 'Record via device voice app or upload audio'}
        >
          <Upload size={13} aria-hidden />
          <span>{ar ? 'رفع تسجيل أو استخدام مسجل الجهاز' : 'Upload or device recorder'}</span>
        </button>

        {saved && !recording && (
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
            <Check size={14} aria-hidden />
            {ar ? 'صوتك محفوظ لهذه الصفحة' : 'Saved for this page'}
          </span>
        )}
      </div>

      {error && (
        <div className="flex items-start gap-1.5 rounded-xl bg-coral/10 p-2 text-xs text-coral">
          <AlertCircle size={14} className="shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
