import { useCallback, useEffect, useRef, useState } from 'react';
import { StoryData } from '../types';
import { applyBatch, continueStory, isIncomplete } from '../services/gemini';
import { postJson } from '../services/api';

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

  const appendBranch = useCallback(
    async (branchIdea: string) => {
      const s = storyRef.current;
      const texts = s.pages.map((p) => p.text);
      const data = await postJson<{ pages: Partial<StoryData['pages'][0]>[] }>(
        '/api/continue-story',
        {
          story: {
            title: s.story_info.title,
            language: s.story_info.language,
            dialect: s.story_info.dialect,
            ageGroup: s.story_info.age_group,
            artStyle: s.story_info.art_style,
            characters: s.characters,
            earlier: texts.slice(0, -2).map((t) => t.slice(0, 160)),
            recent: [...texts.slice(-2), `Interactive branch choice: "${branchIdea}". Continue the story excitingly based on this decision.`],
          },
          from: s.pages.length + 1,
          count: 2,
          total: s.pages.length + 2,
          final: true,
        }
      );
      if (data?.pages?.length) {
        const newPages = data.pages.map((p, i) => ({
          page: s.pages.length + i + 1,
          text: (p.text ?? '').trim(),
          narration: (p.narration ?? p.text ?? '').trim(),
          image_prompt: p.image_prompt ?? '',
        }));
        update((prev) => ({
          ...prev,
          pages: [...prev.pages, ...newPages],
        }));
      }
    },
    [update]
  );

  return {
    incomplete: isIncomplete(story),
    running,
    error,
    start,
    appendBranch,
    remaining: Math.max(0, (story.plannedPages ?? story.pages.length) - story.pages.length),
  };
}

