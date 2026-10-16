import { useCallback, useEffect, useRef, useState } from 'react';
import { NarratorVoice, StoryData } from '../types';
import { activeWordIndex, getPageAudio, getVoice, setVoice as persistVoice, wordTimings, type WordTiming } from '../services/narration';

export type NarrationStatus = 'idle' | 'loading' | 'playing' | 'paused';

// قراءة صوتية متزامنة: تظليل الكلمة المنطوقة + متابعة تلقائية للصفحة التالية
export function useNarration(story: StoryData, pageIndex: number, onAdvance: (next: number) => void) {
  const [status, setStatus] = useState<NarrationStatus>('idle');
  const [wordIndex, setWordIndex] = useState(-1);
  const [voice, setVoiceState] = useState<NarratorVoice>(getVoice);
  const [error, setError] = useState<string | null>(null);
  const [continuous, setContinuous] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const urlRef = useRef<string | null>(null);
  const rafRef = useRef(0);
  const ctrlRef = useRef<AbortController | null>(null);
  const timingsRef = useRef<WordTiming[]>([]);
  const continuousRef = useRef(false);
  const storyRef = useRef(story);
  storyRef.current = story;
  const voiceRef = useRef(voice);
  voiceRef.current = voice;

  const teardown = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    ctrlRef.current?.abort();
    if (audioRef.current) {
      audioRef.current.onended = null;
      audioRef.current.pause();
    }
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    audioRef.current = null;
    urlRef.current = null;
    setWordIndex(-1);
  }, []);

  const tick = useCallback(() => {
    const a = audioRef.current;
    if (!a) return;
    setWordIndex(activeWordIndex(timingsRef.current, a.currentTime));
    rafRef.current = requestAnimationFrame(tick);
  }, []);

  const start = useCallback(
    async (index: number) => {
      teardown();
      const s = storyRef.current;
      const page = s.pages[index];
      if (!page) return;
      const ctrl = new AbortController();
      ctrlRef.current = ctrl;
      setError(null);
      setStatus('loading');
      try {
        const blob = await getPageAudio(s, page, voiceRef.current, ctrl.signal);
        if (ctrl.signal.aborted) return;
        const url = URL.createObjectURL(blob);
        urlRef.current = url;
        const audio = new Audio(url);
        audioRef.current = audio;
        audio.onloadedmetadata = () => {
          timingsRef.current = wordTimings(page.text, audio.duration);
        };
        audio.onended = () => {
          cancelAnimationFrame(rafRef.current);
          setWordIndex(-1);
          if (continuousRef.current && index < storyRef.current.pages.length - 1) onAdvance(index + 1);
          else {
            continuousRef.current = false;
            setContinuous(false);
            setStatus('idle');
          }
        };
        await audio.play();
        setStatus('playing');
        rafRef.current = requestAnimationFrame(tick);
        const next = s.pages[index + 1];
        if (next) getPageAudio(s, next, voiceRef.current).catch(() => undefined);
      } catch (err) {
        if ((err as Error).name === 'AbortError') return;
        setError((err as Error).message);
        setStatus('idle');
        continuousRef.current = false;
        setContinuous(false);
      }
    },
    [onAdvance, teardown, tick]
  );

  const play = useCallback(
    (all = false) => {
      continuousRef.current = all;
      setContinuous(all);
      if (status === 'paused' && audioRef.current) {
        audioRef.current.play().then(() => {
          setStatus('playing');
          rafRef.current = requestAnimationFrame(tick);
        });
        return;
      }
      start(pageIndex);
    },
    [pageIndex, start, status, tick]
  );

  const pause = useCallback(() => {
    audioRef.current?.pause();
    cancelAnimationFrame(rafRef.current);
    setStatus('paused');
  }, []);

  const stop = useCallback(() => {
    continuousRef.current = false;
    setContinuous(false);
    teardown();
    setStatus('idle');
  }, [teardown]);

  const setVoice = useCallback(
    (v: NarratorVoice) => {
      persistVoice(v);
      setVoiceState(v);
      voiceRef.current = v;
      if (status !== 'idle') start(pageIndex);
    },
    [pageIndex, start, status]
  );

  useEffect(() => {
    if (continuousRef.current) start(pageIndex);
    else {
      teardown();
      setStatus('idle');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageIndex]);

  useEffect(() => teardown, [teardown]);

  return { status, wordIndex, voice, setVoice, play, pause, stop, error, continuous };
}
