import { StoryParams } from '../types';

const DRAFT_KEY = 'sawan_offline_story_draft';

export interface StoryDraft {
  params: StoryParams;
  pageCount: number;
  timestamp: number;
}

export const saveStoryDraft = (params: StoryParams, pageCount: number): void => {
  try {
    const draft: StoryDraft = {
      params,
      pageCount,
      timestamp: Date.now(),
    };
    localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  } catch {
    // ignore
  }
};

export const getStoryDraft = (): StoryDraft | null => {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoryDraft;
    // Expire draft after 48 hours
    if (Date.now() - parsed.timestamp > 48 * 3600 * 1000) {
      clearStoryDraft();
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
};

export const clearStoryDraft = (): void => {
  try {
    localStorage.removeItem(DRAFT_KEY);
  } catch {
    // ignore
  }
};
