import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { BookSize, PageImage, StoryData } from '../types';
import { generatePDFBlob } from './pdf';

const SAVED_STORY_KEY = 'sawan-saved-story';

const safeFileName = (title: string, fallback: string): string =>
  (title || fallback).trim().replace(/[\\/:*?"<>|]+/g, '-').slice(0, 80) || fallback;

export const hasSavedStory = (): boolean => {
  try {
    return Boolean(localStorage.getItem(SAVED_STORY_KEY));
  } catch {
    return false;
  }
};

export const loadStoryLocally = (): StoryData | null => {
  try {
    const raw = localStorage.getItem(SAVED_STORY_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed.story_info && Array.isArray(parsed.pages)) {
      return parsed as StoryData;
    }
    return null;
  } catch {
    return null;
  }
};

export const saveStoryLocally = (story: StoryData): void => {
  try {
    localStorage.setItem(SAVED_STORY_KEY, JSON.stringify(story));
  } catch (err) {
    console.warn('Failed to save story locally:', err);
  }
};

export const clearSavedStory = (): void => {
  try {
    localStorage.removeItem(SAVED_STORY_KEY);
  } catch {
    // ignore
  }
};

export const exportStoryAsPDF = async (
  storyData: StoryData,
  containerIdOrSize?: string | BookSize,
  onProgress?: (msg: string) => void
): Promise<void> => {
  const isRTL = storyData.story_info.language?.toLowerCase().includes('arabic');
  const size: BookSize = containerIdOrSize === 'Square' ? 'Square' : 'A4';

  // Check if a printable DOM container exists (e.g. from PrintableStory)
  const container =
    typeof containerIdOrSize === 'string' && containerIdOrSize !== 'A4' && containerIdOrSize !== 'Square'
      ? document.getElementById(containerIdOrSize)
      : null;

  if (container) {
    onProgress?.('Preparing storybook layout...');

    if (document.fonts) {
      try {
        await document.fonts.ready;
      } catch {
        // continue
      }
    }

    const imgElements = Array.from(container.querySelectorAll<HTMLImageElement>('img'));
    await Promise.all(
      imgElements.map((img) => {
        if (img.complete && img.naturalWidth !== 0) return Promise.resolve();
        return new Promise<void>((resolve) => {
          img.onload = () => resolve();
          img.onerror = () => resolve();
          setTimeout(resolve, 3000);
        });
      })
    );

    const pageNodes = Array.from(container.querySelectorAll<HTMLElement>('[data-print-page]'));
    if (pageNodes.length > 0) {
      let pdf: jsPDF | null = null;
      const total = pageNodes.length;

      for (let i = 0; i < total; i++) {
        onProgress?.(`Processing page ${i + 1} of ${total}...`);
        const node = pageNodes[i];

        const canvas = await html2canvas(node, {
          scale: 2,
          useCORS: true,
          allowTaint: true,
          backgroundColor: '#ffffff',
          logging: false,
        });

        const imgData = canvas.toDataURL('image/jpeg', 0.94);
        const orientation = canvas.width >= canvas.height ? 'landscape' : 'portrait';

        if (i === 0) {
          pdf = new jsPDF({
            orientation,
            unit: 'px',
            format: [canvas.width, canvas.height],
            compress: true,
          });
          pdf.addImage(imgData, 'JPEG', 0, 0, canvas.width, canvas.height, undefined, 'FAST');
        } else if (pdf) {
          pdf.addPage([canvas.width, canvas.height], orientation);
          pdf.addImage(imgData, 'JPEG', 0, 0, canvas.width, canvas.height, undefined, 'FAST');
        }
      }

      if (pdf) {
        onProgress?.('Saving PDF file...');
        pdf.save(`${safeFileName(storyData.story_info.title, 'story')}.pdf`);
        return;
      }
    }
  }

  // Fallback to pdf.ts generatePDFBlob
  const blob = await generatePDFBlob(storyData, size, isRTL, onProgress);
  saveAs(blob, `${safeFileName(storyData.story_info.title, 'story')}.pdf`);
};

export const exportImagesAsZip = async (storyData: StoryData, images?: PageImage[]): Promise<void> => {
  const zip = new JSZip();
  const allImages: { page: number; base64: string }[] = [];

  if (images && images.length > 0) {
    allImages.push(...images);
  } else {
    storyData.pages.forEach((p) => {
      if (p.generatedImage) {
        allImages.push({ page: p.page, base64: p.generatedImage });
      }
    });
  }

  if (allImages.length === 0) {
    throw new Error('No images available to export.');
  }

  allImages
    .slice()
    .sort((a, b) => a.page - b.page)
    .forEach((img) => {
      const ext = img.base64.startsWith('/9j/')
        ? 'jpg'
        : img.base64.startsWith('PHN2') || img.base64.startsWith('PD94')
        ? 'svg'
        : 'png';
      zip.file(`page-${String(img.page).padStart(2, '0')}.${ext}`, img.base64, { base64: true });
    });

  const blob = await zip.generateAsync({ type: 'blob' });
  saveAs(blob, `${safeFileName(storyData.story_info.title, 'story')}-images.zip`);
};

export const saveStoryAsJSON = (storyData: StoryData, images?: PageImage[]): void => {
  let storyToSave = storyData;
  if (images && images.length > 0) {
    const imgMap = new Map(images.map((img) => [img.page, img.base64]));
    storyToSave = {
      ...storyData,
      pages: storyData.pages.map((p) => ({
        ...p,
        generatedImage: p.generatedImage || imgMap.get(p.page),
      })),
    };
  }
  const payload = JSON.stringify(storyToSave, null, 2);
  const blob = new Blob([payload], { type: 'application/json' });
  saveAs(blob, `${safeFileName(storyData.story_info.title, 'story')}.json`);
};

export const loadStoryFromJSON = (file: File): Promise<StoryData> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result as string);
        // Format 1: New format (StoryData directly)
        if (parsed.story_info && Array.isArray(parsed.pages)) {
          resolve(parsed as StoryData);
          return;
        }
        // Format 2: Legacy format { storyData, images }
        if (parsed.storyData && Array.isArray(parsed.storyData.pages)) {
          const story: StoryData = parsed.storyData;
          if (Array.isArray(parsed.images)) {
            const imgMap = new Map((parsed.images as PageImage[]).map((img) => [img.page, img.base64]));
            story.pages = story.pages.map((p) => ({
              ...p,
              generatedImage: p.generatedImage || imgMap.get(p.page),
            }));
          }
          resolve(story);
          return;
        }
        throw new Error('Invalid story file format.');
      } catch (err) {
        reject(new Error(`Failed to read story file: ${(err as Error).message}`));
      }
    };
    reader.onerror = () => reject(new Error('Failed to read file.'));
    reader.readAsText(file);
  });
};
