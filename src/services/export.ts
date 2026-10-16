import { saveAs } from 'file-saver';
import { BookSize, StoryData } from '../types';
import { srcToBlob } from './media';
import { serializeStory } from './library';

export const safeFileName = (title: string, fallback: string): string =>
  (title || fallback).trim().replace(/[\\/:*?"<>|]+/g, '-').slice(0, 80) || fallback;

const extFor = (type: string) => (type.includes('webp') ? 'webp' : type.includes('jpeg') ? 'jpg' : 'png');

// المكتبات الثقيلة تُحمّل عند الحاجة فقط
export const exportStoryAsPDF = async (storyData: StoryData, containerIdOrSize?: string | BookSize, onProgress?: (msg: string) => void): Promise<void> => {
  const isRTL = /arab|عرب/i.test(storyData.story_info.language ?? '');
  const size: BookSize = containerIdOrSize === 'Square' ? 'Square' : 'A4';
  const container =
    typeof containerIdOrSize === 'string' && containerIdOrSize !== 'A4' && containerIdOrSize !== 'Square'
      ? document.getElementById(containerIdOrSize)
      : null;

  if (container) {
    onProgress?.(isRTL ? 'نجهّز صفحات الكتاب...' : 'Preparing storybook layout...');
    const [{ default: jsPDF }, { default: html2canvas }] = await Promise.all([import('jspdf'), import('html2canvas')]);
    try {
      await document.fonts?.ready;
    } catch {
      // continue
    }

    const imgElements = Array.from(container.querySelectorAll<HTMLImageElement>('img'));
    await Promise.all(
      imgElements.map((img) =>
        img.complete && img.naturalWidth !== 0
          ? Promise.resolve()
          : new Promise<void>((resolve) => {
              img.onload = () => resolve();
              img.onerror = () => resolve();
              setTimeout(resolve, 3000);
            })
      )
    );

    const pageNodes = Array.from(container.querySelectorAll<HTMLElement>('[data-print-page]'));
    if (pageNodes.length > 0) {
      let pdf: InstanceType<typeof jsPDF> | null = null;
      for (let i = 0; i < pageNodes.length; i++) {
        onProgress?.(isRTL ? `معالجة الصفحة ${i + 1} من ${pageNodes.length}...` : `Processing page ${i + 1} of ${pageNodes.length}...`);
        const canvas = await html2canvas(pageNodes[i], { scale: 2, useCORS: true, allowTaint: true, backgroundColor: '#ffffff', logging: false });
        const imgData = canvas.toDataURL('image/jpeg', 0.94);
        const orientation = canvas.width >= canvas.height ? 'landscape' : 'portrait';
        if (!pdf) pdf = new jsPDF({ orientation, unit: 'px', format: [canvas.width, canvas.height], compress: true });
        else pdf.addPage([canvas.width, canvas.height], orientation);
        pdf.addImage(imgData, 'JPEG', 0, 0, canvas.width, canvas.height, undefined, 'FAST');
      }
      if (pdf) {
        onProgress?.(isRTL ? 'نحفظ ملف PDF...' : 'Saving PDF file...');
        pdf.save(`${safeFileName(storyData.story_info.title, 'story')}.pdf`);
        return;
      }
    }
  }

  const { generatePDFBlob } = await import('./pdf');
  const blob = await generatePDFBlob(storyData, size, isRTL, onProgress);
  saveAs(blob, `${safeFileName(storyData.story_info.title, 'story')}.pdf`);
};

export const exportImagesAsZip = async (storyData: StoryData): Promise<void> => {
  const entries = [
    ...(storyData.coverImage ? [{ name: 'cover', src: storyData.coverImage }] : []),
    ...storyData.pages.filter((p) => p.generatedImage).map((p) => ({ name: `page-${String(p.page).padStart(2, '0')}`, src: p.generatedImage! })),
  ];
  if (entries.length === 0) throw new Error(/arab|عرب/i.test(storyData.story_info.language) ? 'لا توجد صور بعد.' : 'No images available to export.');

  const { default: JSZip } = await import('jszip');
  const zip = new JSZip();
  for (const e of entries) {
    const blob = await srcToBlob(e.src);
    zip.file(`${e.name}.${extFor(blob.type)}`, blob);
  }
  const blob = await zip.generateAsync({ type: 'blob' });
  saveAs(blob, `${safeFileName(storyData.story_info.title, 'story')}-images.zip`);
};

export const saveStoryAsJSON = async (storyData: StoryData): Promise<void> => {
  const blob = new Blob([await serializeStory(storyData)], { type: 'application/json' });
  saveAs(blob, `${safeFileName(storyData.story_info.title, 'story')}.json`);
};

// يرجع قصة خام؛ التطبيق يتولى ترحيل الصور (hydrateStory)
export const loadStoryFromJSON = (file: File): Promise<StoryData> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result as string);
        if (parsed.story_info && Array.isArray(parsed.pages)) return resolve(parsed as StoryData);
        if (parsed.storyData && Array.isArray(parsed.storyData.pages)) {
          const story: StoryData = parsed.storyData;
          if (Array.isArray(parsed.images)) {
            const imgMap = new Map((parsed.images as { page: number; base64: string }[]).map((img) => [img.page, img.base64]));
            story.pages = story.pages.map((p) => ({ ...p, generatedImage: p.generatedImage || imgMap.get(p.page) }));
          }
          return resolve(story);
        }
        throw new Error('Invalid story file format.');
      } catch (err) {
        reject(new Error(`Failed to read story file: ${(err as Error).message}`));
      }
    };
    reader.onerror = () => reject(new Error('Failed to read file.'));
    reader.readAsText(file);
  });
