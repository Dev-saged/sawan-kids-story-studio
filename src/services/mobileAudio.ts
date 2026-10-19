// فك قفل الصوت التلقائي لمتصفحات الهواتف المحمولة (iOS Safari & Android Chrome)
// متصفحات الهواتف تمنع تشغيل الصوت إلا بعد تفاعل لمسي أو نقرة من المستخدم
let audioUnlocked = false;
let globalAudioCtx: AudioContext | null = null;

export const unlockAudio = async (): Promise<boolean> => {
  if (audioUnlocked) return true;
  try {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (AudioContextClass) {
      if (!globalAudioCtx || globalAudioCtx.state === 'closed') {
        globalAudioCtx = new AudioContextClass();
      }
      if (globalAudioCtx.state === 'suspended') {
        await globalAudioCtx.resume();
      }
      // Play a tiny 10ms silent buffer
      const buffer = globalAudioCtx.createBuffer(1, 1, 22050);
      const source = globalAudioCtx.createBufferSource();
      source.buffer = buffer;
      source.connect(globalAudioCtx.destination);
      source.start(0);
    }
    audioUnlocked = true;
    return true;
  } catch (err) {
    console.warn('AudioContext unlock failed:', err);
    return false;
  }
};

export const initMobileAudioUnlock = () => {
  if (typeof window === 'undefined') return;
  const trigger = () => {
    unlockAudio();
    window.removeEventListener('touchstart', trigger, true);
    window.removeEventListener('touchend', trigger, true);
    window.removeEventListener('click', trigger, true);
  };

  window.addEventListener('touchstart', trigger, { capture: true, once: true });
  window.addEventListener('touchend', trigger, { capture: true, once: true });
  window.addEventListener('click', trigger, { capture: true, once: true });
};

// Safe play wrapper that attempts unlock if play is blocked by autoplay policy
export const safePlayAudio = async (audio: HTMLAudioElement): Promise<void> => {
  try {
    await unlockAudio();
    await audio.play();
  } catch (err: unknown) {
    const error = err as Error;
    if (error.name === 'NotAllowedError') {
      console.warn('Audio play prevented by browser policy; awaiting user gesture.');
      throw new Error(
        document.documentElement.lang === 'ar'
          ? 'المتصفح يتطلب نقرة للموافقة على تشغيل الصوت في الهاتف.'
          : 'Tap once to allow audio playback on your mobile browser.'
      );
    }
    throw error;
  }
};
