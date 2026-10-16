import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { BookSize, StoryData } from '../types';

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
  onProgress?: (msg: string) => void
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

  const pdf = new jsPDF({ orientation: 'portrait', unit: 'px', format: [width, height] });
  let firstPage = true;

  const frame = (inner: string, padding = '60px') =>
    `<div style="width:${width}px;height:${height}px;display:flex;flex-direction:column;padding:${padding};box-sizing:border-box;background:${COLORS.paper};position:relative;font-family:${bodyFont};">${inner}</div>`;

  const addPage = async (html: string) => {
    container.innerHTML = html;
    await Promise.all([waitForImages(container), document.fonts?.ready]);
    const canvas = await html2canvas(container, { scale: 2, useCORS: true, logging: false, backgroundColor: COLORS.paper });
    if (!firstPage) pdf.addPage();
    firstPage = false;
    pdf.addImage(canvas.toDataURL('image/jpeg', 0.9), 'JPEG', 0, 0, width, height);
  };

  const image = (b64: string, style: string) => `<img src="data:image/png;base64,${b64}" alt="" style="${style}" />`;

  try {
    onProgress?.(t('جارٍ تجهيز الغلاف...', 'Preparing cover...'));
    await addPage(
      frame(
        `<div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:48px;">
          <h1 style="font-family:${headFont};font-size:56px;line-height:1.3;text-align:center;margin:0;max-width:90%;word-wrap:break-word;">${esc(story.story_info.title)}</h1>
          ${pages[0]?.generatedImage ? image(pages[0].generatedImage, 'max-width:80%;max-height:50%;border-radius:20px;box-shadow:0 10px 30px rgba(36,27,47,0.18);') : ''}
        </div>`,
        '40px'
      )
    );

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
        <div style="margin-top:auto;text-align:center;font-size:14px;color:${COLORS.faint};">${t('تم إنشاء القصة باستخدام Sawan Kids Story Studio', 'A story created with Sawan Kids Story Studio')}</div>`,
        '80px 100px'
      )
    );

    for (let i = 0; i < pages.length; i++) {
      onProgress?.(t(`جارٍ تجهيز الصفحة ${i + 1}...`, `Preparing page ${i + 1}...`));
      const page = pages[i];
      await addPage(
        frame(
          `<div style="height:55%;display:flex;align-items:center;justify-content:center;margin-bottom:40px;">
            ${page.generatedImage ? image(page.generatedImage, 'max-width:100%;max-height:100%;object-fit:contain;border-radius:24px;box-shadow:0 10px 30px rgba(36,27,47,0.15);') : ''}
          </div>
          <div style="flex:1;display:flex;justify-content:center;">
            <p style="font-size:${isRTL ? 36 : 32}px;line-height:1.8;text-align:${align};color:${COLORS.ink};max-width:90%;margin:0;white-space:pre-wrap;">${esc(page.text)}</p>
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
