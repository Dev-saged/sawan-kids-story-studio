import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { BookSize, PDFPreset, StoryData } from '../types';
import { toSrc } from './media';
import { BRAND } from '../config';

const SIZES: Record<BookSize, { width: number; height: number }> = {
  A4: { width: 794, height: 1123 },
  Square: { width: 800, height: 800 },
};

const COLORS = { paper: '#f6f1fa', ink: '#241b2f', soft: '#5d5470', faint: '#a99be0', accent: '#f0a202' };

// Story text and titles come from the model (or an imported file) — never inject them as raw HTML.
const esc = (value: string): string =>
  value.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);

const waitForImages = (root: HTMLElement): Promise<unknown> =>
  Promise.all(
    Array.from(root.querySelectorAll('img')).map((img) =>
      img.complete ? Promise.resolve() : new Promise((resolve) => { img.onload = img.onerror = resolve; })
    )
  );

export const generatePDFBlob = async (
  story: StoryData,
  bookSize: BookSize,
  isRTL: boolean,
  onProgress?: (msg: string) => void,
  pdfPreset: PDFPreset = 'storybook'
): Promise<Blob> => {
  const { width, height } = SIZES[bookSize];
  const pages = story.pages;
  const lessons = story.story_info.lessons ?? [];

  const headFont = isRTL ? "'Baloo Bhaijaan 2', 'Cairo', Arial, sans-serif" : "'Fredoka', Arial, sans-serif";
  const bodyFont = isRTL ? "'Cairo', Arial, sans-serif" : "'Nunito', Arial, sans-serif";
  const align = isRTL ? 'right' : 'left';
  const t = (ar: string, en: string) => (isRTL ? ar : en);

  const container = document.createElement('div');
  Object.assign(container.style, {
    position: 'fixed',
    left: '-9999px',
    top: '0',
    width: `${width}px`,
    backgroundColor: COLORS.paper,
    color: COLORS.ink,
  });
  container.dir = isRTL ? 'rtl' : 'ltr';
  container.setAttribute('aria-hidden', 'true');
  document.body.appendChild(container);

  const templateClass = pdfPreset === 'storybook' ? 'pdf-classic' : pdfPreset === 'minimalist' ? 'pdf-minimal' : 'pdf-modern';
  container.className = templateClass;

  const pdf = new jsPDF({ orientation: 'portrait', unit: 'px', format: [width, height] });
  let firstPage = true;

  const styleTag = `
    <style>
      .pdf-classic { font-family: ${bodyFont}; background-color: #f6f1fa; color: #241b2f; }
      .pdf-classic .pdf-cover-title { font-family: ${headFont}; font-size: 58px; line-height: 1.3; color: #241b2f; font-weight: 800; }
      .pdf-classic .pdf-page-text { font-size: ${isRTL ? 36 : 32}px; line-height: 1.85; color: #241b2f; }

      .pdf-modern { font-family: ${headFont}; background-color: #0f172a; color: #f8fafc; }
      .pdf-modern .pdf-cover-title { font-family: ${headFont}; font-size: 64px; line-height: 1.2; color: #f59e0b; font-weight: 900; }
      .pdf-modern .pdf-page-text { font-size: ${isRTL ? 38 : 34}px; line-height: 1.75; color: #f8fafc; }

      .pdf-minimal { font-family: ${bodyFont}; background-color: #ffffff; color: #111827; }
      .pdf-minimal .pdf-cover-title { font-family: ${bodyFont}; font-size: 48px; line-height: 1.35; color: #111827; font-weight: 700; letter-spacing: -0.02em; }
      .pdf-minimal .pdf-page-text { font-size: ${isRTL ? 32 : 28}px; line-height: 1.9; color: #374151; }
    </style>
  `;

  const frame = (inner: string, padding = '60px') =>
    `<div class="${templateClass}" style="width:${width}px;height:${height}px;display:flex;flex-direction:column;padding:${padding};box-sizing:border-box;position:relative;">${styleTag}${inner}</div>`;

  const addPage = async (html: string) => {
    container.innerHTML = html;
    await Promise.all([waitForImages(container), document.fonts?.ready]);
    const canvas = await html2canvas(container, { scale: 2, useCORS: true, logging: false, backgroundColor: COLORS.paper });
    if (!firstPage) pdf.addPage();
    firstPage = false;
    pdf.addImage(canvas.toDataURL('image/jpeg', 0.9), 'JPEG', 0, 0, width, height);
  };

  const image = (img: string, style: string) => `<img src="${esc(toSrc(img) ?? '')}" alt="" style="${style}" />`;

  try {
    onProgress?.(t('جارٍ تجهيز الغلاف...', 'Preparing cover...'));
    await addPage(
      frame(
        `<div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:48px;">
          <h1 class="pdf-cover-title" style="text-align:center;margin:0;max-width:90%;word-wrap:break-word;">${esc(story.story_info.title)}</h1>
          ${(story.coverImage || pages[0]?.generatedImage) ? image((story.coverImage || pages[0].generatedImage)!, 'max-width:80%;max-height:50%;border-radius:20px;box-shadow:0 10px 30px rgba(36,27,47,0.18);') : ''}
        </div>`,
        '40px'
      )
    );

    if (pdfPreset === 'storybook') {
      onProgress?.(t('جارٍ تجهيز المقدمة...', 'Preparing introduction...'));
      await addPage(
        frame(
          `<div style="flex:1;display:flex;align-items:center;justify-content:center;">
            <p style="font-family:${bodyFont};font-size:36px;line-height:1.8;text-align:center;color:${COLORS.soft};max-width:80%;margin:0;">
              ${t('تم إنشاء هذه القصة لتنمية خيال الأطفال وإسعادهم.', 'This story was created to inspire imagination and joy.')}
            </p>
          </div>`
        )
      );

      onProgress?.(t('جارٍ تجهيز الفهرس...', 'Preparing table of contents...'));
      const toc = pages
        .map(
          (_, i) => `<li style="margin-bottom:20px;font-size:26px;display:flex;align-items:center;">
            <span>${t(`المشهد ${i + 1}`, `Scene ${i + 1}`)}</span>
            <span style="flex:1;border-bottom:2px dotted ${COLORS.faint};margin:0 15px;position:relative;top:-6px;"></span>
            <span>${t(`صفحة ${i + 4}`, `Page ${i + 4}`)}</span>
          </li>`
        )
        .join('');
      await addPage(
        frame(
          `<h2 style="font-family:${headFont};font-size:40px;margin:0 0 50px;text-align:${align};border-bottom:2px solid ${COLORS.faint};padding-bottom:15px;">${t('المحتويات:', 'Contents:')}</h2>
          <ul style="list-style:none;padding:0;margin:0;color:${COLORS.soft};">${toc}</ul>
          <div style="margin-top:auto;text-align:center;font-size:14px;color:${COLORS.faint};">${t(`تم إنشاء القصة باستخدام ${BRAND.fullName.ar} — تصميم وتطوير ${BRAND.author.ar} · ${BRAND.madeIn.ar}`, `Created with ${BRAND.fullName.en} — by ${BRAND.author.en} · ${BRAND.madeIn.en}`)}</div>`,
          '80px 100px'
        )
      );
    } else if (pdfPreset === 'collector' && story.characters?.length) {
      onProgress?.(t('جارٍ تجهيز بطاقات الشخصيات...', 'Preparing character sheet...'));
      const charItems = story.characters
        .map(
          (c) => `<div style="padding:20px;background:#fff;border-radius:16px;box-shadow:0 4px 12px rgba(0,0,0,0.05);margin-bottom:16px;">
            <h3 style="font-family:${headFont};font-size:28px;margin:0 0 8px;color:${COLORS.ink};">${esc(c.name)}</h3>
            <p style="font-size:20px;color:${COLORS.soft};margin:0;">${esc(c.description)}</p>
          </div>`
        )
        .join('');
      await addPage(
        frame(
          `<h2 style="font-family:${headFont};font-size:36px;margin:0 0 30px;text-align:${align};border-bottom:2px solid ${COLORS.accent};padding-bottom:12px;">${t('شخصيات القصة:', 'Story Characters:')}</h2>
          <div style="display:flex;flex-direction:column;gap:16px;">${charItems}</div>
          <div style="margin-top:auto;text-align:center;font-size:14px;color:${COLORS.faint};">${t(`حقوق النشر © ${BRAND.fullName.ar} — ${BRAND.author.ar}`, `Copyright © ${BRAND.fullName.en} — ${BRAND.author.en}`)}</div>`,
          '60px 80px'
        )
      );
    }

    for (let i = 0; i < pages.length; i++) {
      onProgress?.(t(`جارٍ تجهيز الصفحة ${i + 1}...`, `Preparing page ${i + 1}...`));
      const page = pages[i];
      await addPage(
        frame(
          `<div style="height:55%;display:flex;align-items:center;justify-content:center;margin-bottom:40px;">
            ${page.generatedImage ? image(page.generatedImage, 'max-width:100%;max-height:100%;object-fit:contain;border-radius:24px;box-shadow:0 10px 30px rgba(36,27,47,0.15);') : ''}
          </div>
          <div style="flex:1;display:flex;justify-content:center;">
            <p class="pdf-page-text" style="text-align:${align};max-width:90%;margin:0;white-space:pre-wrap;">${esc(page.text)}</p>
          </div>
          <div style="position:absolute;bottom:40px;left:0;right:0;text-align:center;font-size:18px;color:${COLORS.faint};font-weight:600;">${i + 1}</div>`,
          '60px 80px'
        )
      );
    }

    if (lessons.length > 0) {
      onProgress?.(t('جارٍ تجهيز الخاتمة...', 'Preparing final page...'));
      const items = lessons
        .map((l) => `<li style="margin-bottom:24px;font-size:28px;display:flex;align-items:center;gap:15px;"><span style="color:${COLORS.accent};">&#9679;</span>${esc(l)}</li>`)
        .join('');
      await addPage(
        frame(
          `<div style="flex:1;display:flex;align-items:center;justify-content:center;">
            <div style="width:80%;background:#fff;padding:60px;border-radius:30px;box-shadow:0 20px 40px rgba(36,27,47,0.08);">
              <h2 style="font-family:${headFont};font-size:48px;margin:0 0 50px;text-align:center;">${t('ماذا تعلمنا من القصة؟', 'What did we learn?')}</h2>
              <ul style="list-style:none;padding:0;margin:0;color:${COLORS.soft};text-align:${align};">${items}</ul>
            </div>
          </div>`,
          '80px'
        )
      );
    }
  } finally {
    document.body.removeChild(container);
  }

  return pdf.output('blob');
};
