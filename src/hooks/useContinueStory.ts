import { useCallback, useEffect, useRef, useState } from 'react';
import { StoryData } from '../types';
import { applyBatch, continueStory, isIncomplete } from '../services/gemini';

type Updater = (fn: (s: StoryData) => StoryData) => void;

// استئناف قصة طويلة: كل دفعة تُضاف للقصة فور وصولها فتُرسم صفحاتها دون انتظار البقية
export function useContinueStory(story: StoryData, update: Updater) {
  const storyRef = useRef(story);
  storyRef.current = story;
  const ctrlRef = useRef<AbortController | null>(null);
  const runningRef = useRef(false);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const start = useCallback(async () => {
    if (runningRef.current) return;
    runningRef.current = true;
    setRunning(true);
    setError(null);
    const ctrl = new AbortController();
    ctrlRef.current = ctrl;
    try {
      await continueStory(() => storyRef.current, (batch) => update((s) => applyBatch(s, batch)), undefined, ctrl.signal);
    } catch (err) {
      if ((err as Error).name !== 'AbortError') setError((err as Error).message);
    } finally {
      runningRef.current = false;
      setRunning(false);
    }
  }, [update]);

  useEffect(() => {
    setError(null);
    return () => ctrlRef.current?.abort();
  }, [story.id]);

  return { incomplete: isIncomplete(story), running, error, start, remaining: Math.max(0, (story.plannedPages ?? story.pages.length) - story.pages.length) };
}
