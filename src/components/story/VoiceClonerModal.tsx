import { useState, useRef, useEffect } from 'react';
import { Mic, Square, Sparkles, Check, Play, Pause, Trash2, X, AudioWaveform, ShieldCheck, Loader2 } from 'lucide-react';
import { Language, NarratorVoice } from '../../types';
import {
  saveClonedVoiceProfile,
  getClonedVoiceProfile,
  deleteClonedVoiceProfile,
  synthesizeClonedVoiceNarration,
  type ClonedVoiceProfile,
} from '../../services/voiceClone';

interface Props {
  language: Language;
  onVoiceSelected: (voice: NarratorVoice) => void;
  onClose: () => void;
}

const SAMPLE_TEXT = {
  ar: '«كان يا ما كان في قديم الزمان، قصة مليئة بالأمل والخير والمغامرات الجميلة للأبطال الصغار.»',
  en: '"Once upon a time in a faraway realm, a heartwarming tale of courage and magical wonder began for our young hero."',
};

export default function VoiceClonerModal({ language, onVoiceSelected, onClose }: Props) {
  const ar = language === 'Arabic';
  const [profile, setProfile] = useState<ClonedVoiceProfile | null>(null);
  const [name, setName] = useState('');
  const [recording, setRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [recordedUrl, setRecordedUrl] = useState<string | null>(null);
  const [isPlayingRecorded, setIsPlayingRecorded] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [testPlaying, setTestPlaying] = useState(false);
  const [testLoading, setTestLoading] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<number | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animFrameRef = useRef<number>(0);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sampleAudioPlayerRef = useRef<HTMLAudioElement | null>(null);
  const testAudioPlayerRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    getClonedVoiceProfile().then((p) => {
      if (p) {
        setProfile(p);
        setName(p.name);
      } else {
        setName(ar ? 'صوت أبي/أمي' : 'Parent Voice');
      }
    });

    return () => {
      cleanupAudio();
    };
  }, [ar]);

  const cleanupAudio = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    cancelAnimationFrame(animFrameRef.current);
    try {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop();
      }
    } catch {
      // ignore
    }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    try {
      audioContextRef.current?.close();
    } catch {
      // ignore
    }
    sampleAudioPlayerRef.current?.pause();
    testAudioPlayerRef.current?.pause();
    if (recordedUrl) URL.revokeObjectURL(recordedUrl);
  };

  const drawVisualizer = () => {
    const canvas = canvasRef.current;
    const analyser = analyserRef.current;
    if (!canvas || !analyser) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const render = () => {
      animFrameRef.current = requestAnimationFrame(render);
      analyser.getByteFrequencyData(dataArray);

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const barWidth = (canvas.width / 32) - 2;
      let x = 0;

      for (let i = 0; i < 32; i++) {
        const val = dataArray[i * 2] || 0;
        const barHeight = Math.max(4, (val / 255) * canvas.height * 0.9);

        // Gradient coloring: lantern amber to dream violet
        const gradient = ctx.createLinearGradient(0, canvas.height, 0, 0);
        gradient.addColorStop(0, '#ffc94a');
        gradient.addColorStop(1, '#6b46c1');

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.roundRect(x, canvas.height - barHeight, barWidth, barHeight, [4, 4, 0, 0]);
        ctx.fill();

        x += barWidth + 2;
      }
    };

    render();
  };

  const startRecording = async () => {
    setError(null);
    setRecordedBlob(null);
    if (recordedUrl) {
      URL.revokeObjectURL(recordedUrl);
      setRecordedUrl(null);
    }
    audioChunksRef.current = [];

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      streamRef.current = stream;

      const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const audioCtx = new AudioContextClass();
      audioContextRef.current = audioCtx;

      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 64;
      source.connect(analyser);
      analyserRef.current = analyser;

      drawVisualizer();

      const mimeType = MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : MediaRecorder.isTypeSupported('audio/mp4')
          ? 'audio/mp4'
          : 'audio/ogg';

      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      recorder.onstop = () => {
        const completeBlob = new Blob(audioChunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        setRecordedBlob(completeBlob);
        const url = URL.createObjectURL(completeBlob);
        setRecordedUrl(url);
        stream.getTracks().forEach((t) => t.stop());
        cancelAnimationFrame(animFrameRef.current);
      };

      recorder.start(250);
      setRecording(true);
      setRecordingSeconds(0);

      timerRef.current = window.setInterval(() => {
        setRecordingSeconds((prev) => {
          if (prev >= 25) {
            stopRecording();
            return prev;
          }
          return prev + 1;
        });
      }, 1000);
    } catch (err) {
      setError(ar ? 'تعذّر الوصول إلى الميكروفون. يرجى السماح بصلاحية الميكروفون.' : 'Unable to access microphone. Please grant permission.');
    }
  };

  const stopRecording = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    setRecording(false);
  };

  const handleAnalyzeAndSave = async () => {
    if (!recordedBlob) return;
    setAnalyzing(true);
    setError(null);
    try {
      const saved = await saveClonedVoiceProfile(name, recordedBlob);
      setProfile(saved);
      onVoiceSelected('ClonedVoice');
    } catch (err) {
      setError(ar ? 'حدث خطأ أثناء معالجة واستنساخ الصوت. حاول مرة أخرى.' : 'Error analyzing voice sample. Please retry.');
    } finally {
      setAnalyzing(false);
    }
  };

  const handleDeleteProfile = async () => {
    await deleteClonedVoiceProfile();
    setProfile(null);
    setRecordedBlob(null);
    if (recordedUrl) URL.revokeObjectURL(recordedUrl);
    setRecordedUrl(null);
  };

  const playRecordedSample = () => {
    if (!recordedUrl) return;
    if (isPlayingRecorded) {
      sampleAudioPlayerRef.current?.pause();
      setIsPlayingRecorded(false);
    } else {
      if (!sampleAudioPlayerRef.current) {
        sampleAudioPlayerRef.current = new Audio(recordedUrl);
        sampleAudioPlayerRef.current.onended = () => setIsPlayingRecorded(false);
      } else {
        sampleAudioPlayerRef.current.src = recordedUrl;
      }
      sampleAudioPlayerRef.current.play().then(() => setIsPlayingRecorded(true)).catch(() => setIsPlayingRecorded(false));
    }
  };

  const handleTestClonedVoice = async () => {
    if (testPlaying) {
      testAudioPlayerRef.current?.pause();
      setTestPlaying(false);
      return;
    }

    setTestLoading(true);
    setError(null);
    try {
      const testPhrase = ar
        ? 'أهلاً بك يا بطلي الصغير! أنا أقرأ لك هذه القصة بصوتي المستنسخ بكل حب وسعادة.'
        : 'Welcome, little hero! I am now reading this magical story to you with my cloned voice.';
      const blob = await synthesizeClonedVoiceNarration(testPhrase);
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      testAudioPlayerRef.current = audio;
      audio.onended = () => {
        setTestPlaying(false);
        URL.revokeObjectURL(url);
      };
      await audio.play();
      setTestPlaying(true);
    } catch (err) {
      setError(ar ? 'تعذّر تجربة الصوت المستنسخ الآن.' : 'Could not test cloned voice now.');
    } finally {
      setTestLoading(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        dir={ar ? 'rtl' : 'ltr'}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg max-h-[92vh] overflow-y-auto rounded-3xl border border-dream/20 bg-moonlight p-5 shadow-2xl dark:bg-dusk dark:text-moonlight"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-dream/20 pb-3">
          <div className="flex items-center gap-2.5">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-lantern/25 text-ink dark:text-moonlight">
              <AudioWaveform size={22} className="text-lantern" />
            </span>
            <div>
              <h3 className="font-display text-base font-bold text-ink dark:text-moonlight">
                {ar ? 'استنساخ الصوت الذكي (Smart Voice Cloning)' : 'Smart Voice Cloning'}
              </h3>
              <p className="text-xs text-ink/65 dark:text-moonlight/65">
                {ar ? 'سجّل عينة واحدة ليروي الذكاء الاصطناعي القصة كاملة بصوتك' : 'Record once, AI narrates the entire story in your voice'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-full text-ink/60 hover:bg-black/5 dark:text-moonlight/60 dark:hover:bg-white/10"
            aria-label={ar ? 'إغلاق' : 'Close'}
          >
            <X size={20} />
          </button>
        </div>

        {/* Existing Profile Card */}
        {profile && (
          <div className="mt-4 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-ink dark:text-moonlight">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                <ShieldCheck className="text-emerald-500 shrink-0" size={20} />
                <div>
                  <h4 className="font-bold text-sm">{profile.name}</h4>
                  <p className="text-xs opacity-80 mt-0.5">
                    {ar ? profile.timbreLabel.ar : profile.timbreLabel.en} · {profile.pitchAverageHz}Hz
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleDeleteProfile}
                className="flex items-center gap-1 text-xs text-coral hover:underline"
                title={ar ? 'حذف البصمة' : 'Delete profile'}
              >
                <Trash2 size={13} />
                {ar ? 'حذف' : 'Delete'}
              </button>
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  onVoiceSelected('ClonedVoice');
                  onClose();
                }}
                className="flex-1 flex min-h-11 items-center justify-center gap-2 rounded-xl bg-lantern font-display text-xs font-bold text-ink shadow-xs active:scale-95"
              >
                <Check size={16} />
                {ar ? 'اعتماد صوتي لقراءة القصة الآن' : 'Use this voice to narrate now'}
              </button>
              <button
                type="button"
                onClick={handleTestClonedVoice}
                disabled={testLoading}
                className="flex min-h-11 items-center justify-center gap-1.5 rounded-xl border border-dream/30 px-3 text-xs font-semibold hover:bg-dream/10 active:scale-95"
              >
                {testLoading ? <Loader2 size={14} className="animate-spin" /> : testPlaying ? <Pause size={14} /> : <Play size={14} />}
                {ar ? 'استمع لعيّنة الذكاء الاصطناعي' : 'Test AI Narration'}
              </button>
            </div>
          </div>
        )}

        {/* Recording instructions */}
        <div className="mt-4 space-y-3">
          <div className="rounded-2xl border border-dream/20 bg-dream/5 p-3.5 text-xs text-ink/80 dark:text-moonlight/80">
            <p className="font-bold mb-1 flex items-center gap-1.5 text-ink dark:text-moonlight">
              <Sparkles size={14} className="text-lantern" />
              {ar ? 'كيف يعمل استنساخ الصوت؟' : 'How does voice cloning work?'}
            </p>
            <p className="leading-relaxed">
              {ar
                ? 'لا داعي لقراءة القصة صفحة بصفحة! اقرأ العبارة النموذجية بالأسفل بنبرتك الطبيعية لمدة 10 ثوانٍ، وسيقوم النظام بتحليل طبقة صوتك وإيقاعك وحفظها لتقرأ كل قصة لاحقة تلقائياً بصوتك.'
                : 'No need to read page by page! Read the sample phrase below naturally for 10-15 seconds. The AI analyzes your timbre and pitch, and narrates every story automatically in your simulated voice.'}
            </p>
          </div>

          {/* Sample sentence to read */}
          <div className="rounded-2xl border border-lantern/30 bg-lantern/10 p-3.5 text-center">
            <span className="text-[11px] font-bold uppercase tracking-wider text-ink/60 dark:text-moonlight/60 block mb-1">
              {ar ? 'العبارة المقترحة للقراءة' : 'Sample phrase to read aloud'}
            </span>
            <p className="font-display text-sm font-semibold text-ink dark:text-moonlight leading-relaxed">
              {SAMPLE_TEXT[language === 'Arabic' ? 'ar' : 'en']}
            </p>
          </div>

          {/* Voice Profile Name Input */}
          <div>
            <label className="block text-xs font-semibold text-ink/75 dark:text-moonlight/75 mb-1">
              {ar ? 'اسم البصمة الصوتية (مثل: صوت أبي، صوت ماما):' : 'Voice profile label:'}
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={ar ? 'صوت أبي ساجد' : 'Dad Voice'}
              className="w-full rounded-xl border border-dream/30 bg-white/50 px-3 py-2 text-sm text-ink outline-none focus:border-lantern dark:bg-white/5 dark:text-moonlight"
            />
          </div>

          {/* Canvas Waveform */}
          <div className="relative flex flex-col items-center justify-center rounded-2xl border border-dream/20 bg-black/40 p-3">
            <canvas ref={canvasRef} width={340} height={60} className="w-full h-15 rounded-lg" />
            {recording && (
              <div className="absolute top-2 right-3 flex items-center gap-1.5 text-xs font-bold text-coral animate-pulse">
                <span className="h-2 w-2 rounded-full bg-coral" />
                {recordingSeconds}s / 25s
              </div>
            )}
            {!recording && !recordedBlob && (
              <span className="absolute text-xs text-moonlight/50">
                {ar ? 'الموجات الصوتية ستظهر هنا أثناء التسجيل' : 'Audio frequencies will appear here'}
              </span>
            )}
          </div>

          {/* Record Actions */}
          <div className="flex flex-col items-center gap-2">
            {!recording ? (
              <button
                type="button"
                onClick={startRecording}
                className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-coral font-display text-sm font-bold text-white shadow-md transition active:scale-95"
              >
                <Mic size={18} />
                {profile ? (ar ? 'تسجيل عينة صوتية جديدة وتحديث البصمة' : 'Record New Sample') : ar ? 'بدء تسجيل عينة الصوت' : 'Start Recording Sample'}
              </button>
            ) : (
              <button
                type="button"
                onClick={stopRecording}
                className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-ink text-white font-display text-sm font-bold shadow-md transition active:scale-95 dark:bg-moonlight dark:text-ink"
              >
                <Square size={18} />
                {ar ? `إيقاف وحفظ العينة (${recordingSeconds} ثانية)` : `Stop & Save Sample (${recordingSeconds}s)`}
              </button>
            )}

            {/* Recorded Audio Preview & Analysis Trigger */}
            {recordedBlob && !recording && (
              <div className="w-full space-y-2 mt-1">
                <div className="flex items-center justify-between rounded-xl border border-dream/20 bg-white/40 p-2.5 dark:bg-white/5">
                  <button
                    type="button"
                    onClick={playRecordedSample}
                    className="flex items-center gap-2 text-xs font-bold text-ink dark:text-moonlight"
                  >
                    {isPlayingRecorded ? <Pause size={16} /> : <Play size={16} />}
                    {ar ? 'الاستماع إلى العينة المسجلة' : 'Listen to recorded sample'}
                  </button>
                  <span className="text-xs text-ink/50 dark:text-moonlight/50">
                    {Math.round(recordedBlob.size / 1024)} KB
                  </span>
                </div>

                <button
                  type="button"
                  onClick={handleAnalyzeAndSave}
                  disabled={analyzing}
                  className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-lantern font-display text-sm font-bold text-ink shadow-md transition active:scale-95 disabled:opacity-50"
                >
                  {analyzing ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      {ar ? 'جارٍ تحليل النبرة والترددات وحفظ البصمة...' : 'Analyzing pitch & saving profile...'}
                    </>
                  ) : (
                    <>
                      <Sparkles size={16} />
                      {ar ? 'تحليل واستنساخ الصوت وحفظ البصمة' : 'Analyze & Clone Voice'}
                    </>
                  )}
                </button>
              </div>
            )}
          </div>

          {error && (
            <p className="rounded-xl bg-coral/10 p-2.5 text-center text-xs text-coral">
              {error}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
