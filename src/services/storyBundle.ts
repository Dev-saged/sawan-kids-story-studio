import { saveAs } from 'file-saver';
import type { StoryData } from '../types';
import { BRAND } from '../config';
import { srcToBlob } from './media';
import { serializeStory } from './library';
import { animationPackText, animationPrompt } from './animation';
import { safeFileName } from './export';

const isAr = (s: StoryData) => /arab|عرب/i.test(s.story_info.language ?? '');
const extFor = (type: string) => (type.includes('webp') ? 'webp' : type.includes('jpeg') ? 'jpg' : 'png');
const pad = (n: number) => String(n).padStart(2, '0');

// نص القصة الكامل (صفحة لكل فقرة) للملفات والمشاركة
export const storyPlainText = (s: StoryData): string => {
  const ar = isAr(s);
  const lines = [s.story_info.title, ''];
  if (s.characters.length) {
    lines.push(ar ? 'الشخصيات:' : 'Characters:');
    s.characters.forEach((c) => lines.push(`- ${c.name}: ${c.personality || c.description}`));
    lines.push('');
  }
  s.pages.forEach((p) => {
    if (p.chapter) lines.push(`## ${p.chapter}`, '');
    lines.push(`${ar ? 'صفحة' : 'Page'} ${p.page}`, p.text, '');
  });
  if (s.story_info.moral) lines.push(`${ar ? 'العبرة' : 'Moral'}: ${s.story_info.moral}`, '');
  lines.push(`${BRAND.fullName[ar ? 'ar' : 'en']} — ${BRAND.author[ar ? 'ar' : 'en']}`);
  return lines.join('\n');
};

// رسالة المشاركة: عنوان + مقطع من الصفحة الأولى + العبرة، قصيرة كي تتسع في كل التطبيقات
export const shareMessage = (s: StoryData): string => {
  const ar = isAr(s);
  const first = (s.pages[0]?.text ?? '').trim();
  const snippet = first.length > 220 ? `${first.slice(0, 220).trim()}…` : first;
  return [
    s.story_info.title,
    snippet,
    s.story_info.moral ? `${ar ? 'العبرة' : 'Moral'}: ${s.story_info.moral}` : '',
    `${ar ? 'صُنعت في' : 'Made with'} ${BRAND.fullName[ar ? 'ar' : 'en']}`,
  ]
    .filter(Boolean)
    .join('\n\n');
};

export const appLink = (): string => (typeof location !== 'undefined' ? location.origin : '');

export type ShareChannel = 'whatsapp' | 'facebook' | 'telegram' | 'native' | 'copy';

export const canNativeShare = (): boolean => typeof navigator !== 'undefined' && typeof navigator.share === 'function';

export const shareStory = async (s: StoryData, channel: ShareChannel): Promise<void> => {
  const text = shareMessage(s);
  const url = appLink();
  const open = (href: string) => {
    window.open(href, '_blank', 'noopener,noreferrer');
  };
  if (channel === 'whatsapp') return open(`https://wa.me/?text=${encodeURIComponent(url ? `${text}\n${url}` : text)}`);
  if (channel === 'telegram') return open(`https://t.me/share/url?url=${encodeURIComponent(url || 'https://t.me')}&text=${encodeURIComponent(text)}`);
  if (channel === 'facebook') return open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}&quote=${encodeURIComponent(text)}`);
  if (channel === 'copy') {
    await navigator.clipboard.writeText(url ? `${text}\n${url}` : text);
    return;
  }
  // المشاركة الأصلية: نرفق الغلاف إن أمكن، وإلا نص فقط
  let files: File[] = [];
  try {
    if (s.coverImage) {
      const blob = await srcToBlob(s.coverImage);
      files = [new File([blob], `${safeFileName(s.story_info.title, 'story')}.${extFor(blob.type)}`, { type: blob.type })];
    }
  } catch {
    files = [];
  }
  const data: ShareData = { title: s.story_info.title, text, ...(url ? { url } : {}) };
  if (files.length && navigator.canShare?.({ files })) data.files = files;
  try {
    await navigator.share(data);
  } catch (err) {
    if ((err as Error).name !== 'AbortError') throw err;
  }
};

type Progress = (msg: string) => void;

interface PackedImage {
  name: string;
  blob: Blob;
}

const collectImages = async (s: StoryData, onProgress?: Progress): Promise<{ cover: PackedImage | null; pages: (PackedImage | null)[] }> => {
  const ar = isAr(s);
  let cover: PackedImage | null = null;
  if (s.coverImage) {
    const blob = await srcToBlob(s.coverImage);
    cover = { name: `cover.${extFor(blob.type)}`, blob };
  }
  const pages: (PackedImage | null)[] = [];
  for (const p of s.pages) {
    onProgress?.(ar ? `نجمع الصورة ${p.page} من ${s.pages.length}...` : `Collecting image ${p.page} of ${s.pages.length}...`);
    if (!p.generatedImage) {
      pages.push(null);
      continue;
    }
    const blob = await srcToBlob(p.generatedImage);
    pages.push({ name: `page-${pad(p.page)}.${extFor(blob.type)}`, blob });
  }
  return { cover, pages };
};

const readme = (s: StoryData, mode: 'package' | 'animation'): string => {
  const ar = isAr(s);
  if (mode === 'animation') {
    return ar
      ? `حزمة التحريك — ${s.story_info.title}\n\n1) افتح Flow أو Veo بحسابك.\n2) ارفع صورة المشهد من مجلد images.\n3) الصق برومبت المشهد نفسه من ملف prompts/scene-XX.txt (أو من animation-prompts.txt).\n4) ولّد مقطعاً مدته 6 ثوانٍ ثم اجمع المقاطع بالترتيب.\n\nالتعليمات الصوتية مضمّنة في كل برومبت: مؤثرات بيئية فقط، بلا موسيقى ولا حوار.`
      : `Animation pack — ${s.story_info.title}\n\n1) Open Flow or Veo with your account.\n2) Upload the scene image from the images folder.\n3) Paste the matching prompt from prompts/scene-XX.txt (or animation-prompts.txt).\n4) Generate a 6-second clip, then join the clips in order.\n\nAudio rules are built into every prompt: ambient effects only, no music, no dialogue.`;
  }
  return ar
    ? `حزمة القصة — ${s.story_info.title}\n\nstory.txt: النص الكامل\nstory.json: نسخة احتياطية كاملة تُستورد من المكتبة\nimages/: الغلاف وصور المشاهد\nanimation-prompts.txt: برومبتات تحريك كل مشهد (Veo / Flow)\nimage-prompts.txt: أوصاف الصور لإعادة التوليد في أي أداة`
    : `Story package — ${s.story_info.title}\n\nstory.txt: full text\nstory.json: full backup, importable from the library\nimages/: cover and scene images\nanimation-prompts.txt: per-scene animation prompts (Veo / Flow)\nimage-prompts.txt: image prompts for regenerating in any tool`;
};

export const imagePromptsText = (s: StoryData): string =>
  [
    `IMAGE PROMPTS — ${s.story_info.title}`,
    `Art style: ${s.story_info.art_style} · Aspect ratio: ${s.story_info.aspect_ratio}`,
    '',
    s.cover_image_prompt ? `=== Cover ===\n${s.cover_image_prompt}\n` : '',
    ...s.pages.map((p) => `=== Scene ${pad(p.page)} ===\n${p.image_prompt}\n`),
  ]
    .filter((v) => v !== '')
    .join('\n');

// حزمة كاملة: نص + JSON + صور + برومبتات؛ أو حزمة تحريك: صور + برومبتات لكل مشهد
export const exportBundle = async (s: StoryData, mode: 'package' | 'animation', onProgress?: Progress): Promise<void> => {
  const ar = isAr(s);
  const { cover, pages } = await collectImages(s, onProgress);
  if (mode === 'animation' && !pages.some(Boolean)) throw new Error(ar ? 'ارسم مشهداً واحداً على الأقل أولاً.' : 'Paint at least one scene first.');

  const { default: JSZip } = await import('jszip');
  const zip = new JSZip();
  const images = zip.folder('images')!;
  if (cover) images.file(cover.name, cover.blob);
  pages.forEach((img) => img && images.file(img.name, img.blob));

  zip.file('README.txt', readme(s, mode));
  zip.file('animation-prompts.txt', animationPackText(s, pages.map((img) => img?.name ?? null)));
  const prompts = zip.folder('prompts')!;
  s.pages.forEach((p, i) => prompts.file(`scene-${pad(p.page)}.txt`, animationPrompt(s, p, i)));

  if (mode === 'package') {
    onProgress?.(ar ? 'نكتب ملف القصة...' : 'Writing story files...');
    zip.file('story.txt', storyPlainText(s));
    zip.file('image-prompts.txt', imagePromptsText(s));
    zip.file('story.json', await serializeStory(s));
  }

  onProgress?.(ar ? 'نضغط الحزمة...' : 'Compressing...');
  const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
  saveAs(blob, `${safeFileName(s.story_info.title, 'story')}-${mode === 'package' ? 'package' : 'animation-pack'}.zip`);
};
