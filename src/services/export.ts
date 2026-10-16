import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { PageImage, StoryData } from '../types';

const safeFileName = (title: string, fallback: string): string =>
  (title || fallback).trim().replace(/[\\/:*?"<>|]+/g, '-').slice(0, 80) || fallback;

// Rendering via html2canvas (instead of jsPDF's native text API) sidesteps Arabic
// font-shaping/RTL issues entirely: the browser lays out the real DOM correctly,
// and we just photograph it.
export const exportStoryAsPDF = async (storyData: StoryData, containerId: string): Promise<void> => {
  const container = document.getElementById(containerId);
  if (!container) throw new Error('Printable story container not found.');

  const pageNodes = Array.from(container.querySelectorAll<HTMLElement>('[data-print-page]'));
  if (pageNodes.length === 0) throw new Error('No pages available to export.');

  const firstCanvas = await html2canvas(pageNodes[0], { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
  const pdf = new jsPDF({
    orientation: firstCanvas.width >= firstCanvas.height ? 'landscape' : 'portrait',
    unit: 'px',
    format: [firstCanvas.width, firstCanvas.height],
  });

  for (let i = 0; i < pageNodes.length; i++) {
    const canvas = i === 0 ? firstCanvas : await html2canvas(pageNodes[i], { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
    const imgData = canvas.toDataURL('image/jpeg', 0.92);
    if (i > 0) {
      pdf.addPage([canvas.width, canvas.height], canvas.width >= canvas.height ? 'landscape' : 'portrait');
    }
    pdf.addImage(imgData, 'JPEG', 0, 0, canvas.width, canvas.height);
  }

  pdf.save(`${safeFileName(storyData.story_info.title, 'story')}.pdf`);
};

export const exportImagesAsZip = async (storyData: StoryData, images: PageImage[]): Promise<void> => {
  const zip = new JSZip();
  images
    .slice()
    .sort((a, b) => a.page - b.page)
    .forEach((img) => {
      zip.file(`page-${String(img.page).padStart(2, '0')}.png`, img.base64, { base64: true });
    });

  const blob = await zip.generateAsync({ type: 'blob' });
  saveAs(blob, `${safeFileName(storyData.story_info.title, 'story')}-images.zip`);
};

export const saveStoryAsJSON = (storyData: StoryData, images: PageImage[]): void => {
  const payload = JSON.stringify({ storyData, images }, null, 2);
  const blob = new Blob([payload], { type: 'application/json' });
  saveAs(blob, `${safeFileName(storyData.story_info.title, 'story')}.json`);
};

export const loadStoryFromJSON = (file: File): Promise<{ storyData: StoryData; images: PageImage[] }> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result as string);
        if (!parsed.storyData?.pages || !Array.isArray(parsed.images)) {
          throw new Error('Invalid story file format.');
        }
        resolve(parsed);
      } catch (err) {
        reject(new Error(`Failed to read story file: ${(err as Error).message}`));
      }
    };
    reader.onerror = () => reject(new Error('Failed to read file.'));
    reader.readAsText(file);
  });
};
