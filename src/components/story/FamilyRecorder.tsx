import { useEffect, useRef, useState } from 'react';
import { Check, Mic, Square } from 'lucide-react';
import { hasFamilyAudio, saveFamilyAudio } from '../../services/narration';

interface Props {
  ar: boolean;
  storyId?: string;
  pageNo: number;
  onSaved: () => void;
}

const MIME = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/webm'];

// تسجيل صوت الأب أو الأم للصفحة الحالية (يُستخدم عند اختيار «صوت العائلة»)
export default function FamilyRecorder({ ar, storyId, pageNo, onSaved }: Props) {
  const [recording, setRecording] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunks = useRef<Blob[]>([]);

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
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      streamRef.current = stream;
      const mime = MIME.find((m) => MediaRecorder.isTypeSupported(m));
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
    } catch {
      setError(ar ? 'لم نستطع تشغيل الميكروفون. اسمح بالإذن من إعدادات المتصفح.' : 'Could not start the microphone. Allow access in browser settings.');
    }
  };

  const stop = () => {
    recRef.current?.stop();
    setRecording(false);
  };

  return (
    <div className="flex w-full flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={recording ? stop : start}
        aria-pressed={recording}
        className={`inline-flex min-h-11 items-center gap-1.5 rounded-full px-4 text-xs font-bold transition active:scale-95 ${recording ? 'bg-coral text-white' : 'bg-lantern text-ink'}`}
      >
        {recording ? <Square size={13} fill="currentColor" aria-hidden /> : <Mic size={14} aria-hidden />}
        {recording ? (ar ? 'إيقاف التسجيل' : 'Stop recording') : saved ? (ar ? 'أعد تسجيل هذه الصفحة' : 'Re-record this page') : ar ? 'سجّل صوتك لهذه الصفحة' : 'Record this page'}
      </button>
      {saved && !recording && (
        <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600">
          <Check size={14} aria-hidden />
          {ar ? 'محفوظ' : 'Saved'}
        </span>
      )}
      {error && <span className="text-xs text-coral">{error}</span>}
    </div>
  );
}
