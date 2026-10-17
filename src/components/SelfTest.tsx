import { useEffect, useState } from 'react';
import { isValidApiKeyFormat, isValidFreeCreds, keyShape } from '../services/apiKey';
import { classifyFailure, codeFromTrail, rankError } from '../services/imageEngine';
import { codeFromStatus } from '../services/api';
import { activeWordIndex, wordTimings } from '../services/narration';
import { dbDelete, dbGet, dbPut, hashText } from '../services/db';
import { safeFileName } from '../services/export';
import { base64ToBlob, blobToBase64, cropToAspect } from '../services/media';
import { BRAND, SOCIAL_LINKS } from '../config';
import { VIDEO_FORMATS, VIDEO_QUALITIES, videoSize } from '../services/videoFormats';
import { applyBatch, isIncomplete } from '../services/gemini';
import { allAnimationPrompts, animationPackText } from '../services/animation';
import { shareMessage, storyPlainText } from '../services/storyBundle';
import { LEARN_CARDS } from '../data/learnCards';
import { DAILY_POOL, dailyGameId, starsFor } from '../services/progress';
import type { StoryData, StoryPage } from '../types';

interface Result {
  name: string;
  ok: boolean;
  info?: string;
}

// مفاتيح اختبار مركّبة وقت التشغيل (لا نخزّن أي نص يشبه مفتاحاً حقيقياً في الكود)
const FAKE_AQ = `AQ.${'Zz9'.repeat(16)}`;
const FAKE_AIZA = `AIza${'Qq7'.repeat(12)}`;

const page = (n: number, extra: Partial<StoryPage> = {}): StoryPage => ({ page: n, text: `Page ${n} runs and jumps.`, image_prompt: `scene ${n}`, ...extra });
const fixture = (pages: number, planned?: number): StoryData => ({
  story_info: { title: 'Test Story', language: 'English', age_group: '4-6', art_style: 'Watercolor', aspect_ratio: '4:3', lessons: [], moral: 'old' },
  characters: [{ name: 'Sami', description: 'a boy', personality: 'kind', age: '6', gender: 'boy' }],
  pages: Array.from({ length: pages }, (_, i) => page(i + 1)),
  plannedPages: planned,
});

const eq = (a: unknown, b: unknown) => {
  if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`expected ${JSON.stringify(b)} got ${JSON.stringify(a)}`);
};

const TESTS: { name: string; run: () => void | Promise<void> }[] = [
  { name: 'مفتاح AIza مقبول', run: () => eq(isValidApiKeyFormat(FAKE_AIZA), true) },
  { name: 'مفتاح AQ. بنقطة مقبول', run: () => eq(isValidApiKeyFormat(FAKE_AQ), true) },
  { name: 'مفتاح بين علامات اقتباس مقبول', run: () => eq(isValidApiKeyFormat(`"${FAKE_AQ}"`), true) },
  { name: 'مفتاح فيه مسافة أو قصير مرفوض', run: () => eq([isValidApiKeyFormat('AQ.abc def 1234567890123456'), isValidApiKeyFormat('abc')], [false, false]) },
  { name: 'رموز الحالة → رموز الأخطاء', run: () => eq([429, 401, 404, 503, 400].map(codeFromStatus), ['QUOTA', 'AUTH', 'NOMODEL', 'BUSY', 'FAILED']) },
  { name: 'بيانات Cloudflare: الصيغة', run: () => eq([isValidFreeCreds('a1'.repeat(16), 'x'.repeat(40)), isValidFreeCreds('xyz', 'x'.repeat(40)), isValidFreeCreds('a1'.repeat(16), 'short')], [true, false, false]) },
  {
    name: 'تصنيف فشل Gemini: حصة صفرية ≠ حصة مؤقتة ≠ مفتاح مرفوض',
    run: () =>
      eq(
        [
          classifyFailure(429, 'RESOURCE_EXHAUSTED ... limit: 0, model: gemini-2.5-flash-image'),
          classifyFailure(429, 'RESOURCE_EXHAUSTED retry in 20s'),
          classifyFailure(400, 'API key not valid. Please pass a valid API key.'),
          classifyFailure(404, 'models/x is not found'),
          classifyFailure(503, 'UNAVAILABLE'),
        ],
        ['billing', 'quota', 'auth', 'missing', 'busy']
      ),
  },
  {
    name: 'أنفع رمز خطأ للمستخدم عند فشل كل المحركات',
    run: () =>
      eq(
        [
          codeFromTrail([{ model: 'm', kind: 'billing', status: 429, message: '' }]),
          codeFromTrail([{ model: 'm', kind: 'billing', status: 429, message: '' }, { model: 'n', kind: 'quota', status: 429, message: '' }]),
          codeFromTrail([{ model: 'm', kind: 'auth', status: 400, message: '' }]),
          codeFromTrail([]),
          rankError('BILLING') < rankError('NOKEY') && rankError('NOKEY') < rankError('AUTH'),
        ],
        ['BILLING', 'QUOTA', 'AUTH', 'FAILED', true]
      ),
  },

  { name: 'شكل المفتاح لا يكشفه', run: () => eq([keyShape(''), keyShape('MY_GEMINI_API_KEY'), keyShape(FAKE_AQ).includes('Zz9')], ['none', 'placeholder', false]) },
  {
    name: 'قص مربع إلى 16:9',
    run: async () => {
      const c = document.createElement('canvas');
      c.width = 200;
      c.height = 200;
      c.getContext('2d')!.fillRect(0, 0, 200, 200);
      const src = await new Promise<Blob>((res) => c.toBlob((b) => res(b!), 'image/png'));
      const out = await createImageBitmap(await cropToAspect(src, '16:9'));
      if (Math.abs(out.width / out.height - 16 / 9) > 0.03) throw new Error(`ratio ${out.width}x${out.height}`);
    },
  },
  { name: 'hashText ثابت ومختلف', run: () => eq([hashText('أ') === hashText('أ'), hashText('أ') === hashText('ب')], [true, false]) },
  {
    name: 'توقيت الكلمات يغطي المدة',
    run: () => {
      const t = wordTimings('كان يا ما كان في قديم الزمان.', 6);
      eq(t.length, 7);
      if (Math.abs(t[t.length - 1].end - (6 - 0.3)) > 0.01) throw new Error('last end off');
      eq(activeWordIndex(t, 0.2) >= 0, true);
    },
  },
  { name: 'اسم ملف آمن', run: () => eq(safeFileName('a/b:c*?', 'x'), 'a-b-c-') },
  {
    name: 'Base64 ↔ Blob',
    run: async () => {
      const b = base64ToBlob('SGVsbG8=', 'text/plain');
      eq(await blobToBase64(b), 'SGVsbG8=');
    },
  },
  {
    name: 'IndexedDB كتابة/قراءة/حذف',
    run: async () => {
      const id = `selftest:${Date.now()}`;
      await dbPut('audio', { id, blob: new Blob(['x']), createdAt: 1 });
      eq(Boolean(await dbGet('audio', id)), true);
      await dbDelete('audio', id);
      eq(await dbGet('audio', id), undefined);
    },
  },
  {
    name: 'صيغ الفيديو: أبعاد زوجية ونسب صحيحة',
    run: () => {
      for (const f of VIDEO_FORMATS) for (const q of VIDEO_QUALITIES) {
        const { width, height } = videoSize(f.id, q.id);
        if (width % 2 || height % 2) throw new Error(`odd size ${f.id}/${q.id}`);
        if (Math.abs(width / height - f.ratio) > 0.01) throw new Error(`ratio ${f.id}/${q.id}`);
      }
    },
  },
  {
    name: 'قصة طويلة: دفعة نهائية تكمل الصفحات وتحدّث العبرة',
    run: () => {
      const s0 = fixture(6, 10);
      eq(isIncomplete(s0), true);
      const s1 = applyBatch(s0, { pages: [page(0, { chapter: 'Ch' }), page(0), page(0), page(0)], final: true, moral: 'new', quiz: [{ question: 'q', options: ['a', 'b'], answer: 0, page: 1 }] });
      eq([s1.pages.length, s1.pages[6].page, s1.pages[9].page, s1.plannedPages, s1.story_info.moral, isIncomplete(s1)], [10, 7, 10, undefined, 'new', false]);
    },
  },
  {
    name: 'قصة طويلة: دفعة وسطى تبقي القصة قابلة للاستئناف',
    run: () => {
      const s1 = applyBatch(fixture(6, 20), { pages: [page(0), page(0)], final: false });
      eq([s1.pages.length, s1.plannedPages, isIncomplete(s1)], [8, 20, true]);
    },
  },
  {
    name: 'برومبت التحريك: كاميرا متغيرة وصوت بلا موسيقى',
    run: () => {
      const story = fixture(3);
      const prompts = allAnimationPrompts(story);
      eq(prompts.length, 3);
      if (!prompts.every((p) => /NO music/.test(p) && /Animate this exact illustration/.test(p))) throw new Error('rules missing');
      if (new Set(prompts.map((p) => /Camera: ([^.]+)\./.exec(p)?.[1])).size !== 3) throw new Error('cameras repeat');
      const pack = animationPackText(story, ['page-01.png', null, 'page-03.png']);
      eq([pack.includes('page-01.png'), pack.includes('(not drawn yet)')], [true, true]);
    },
  },
  {
    name: 'المشاركة والنص: العنوان والفصول',
    run: () => {
      const story = fixture(2);
      story.pages[1] = page(2, { chapter: 'Chapter Two' });
      eq([shareMessage(story).includes('Test Story'), storyPlainText(story).includes('## Chapter Two')], [true, true]);
    },
  },
  {
    name: 'بطاقات اقرأ وتعلّم: 40+ وفريدة وثنائية اللغة',
    run: () => {
      if (LEARN_CARDS.length < 40) throw new Error(`only ${LEARN_CARDS.length}`);
      eq(new Set(LEARN_CARDS.map((c) => c.id)).size, LEARN_CARDS.length);
      if (!LEARN_CARDS.every((c) => c.title.ar && c.title.en && c.body.ar.length > 40 && c.body.en.length > 40)) throw new Error('missing text');
    },
  },
  {
    name: 'التقدّم: نجوم وتحدي اليوم',
    run: () => {
      eq([starsFor(0, 5), starsFor(2, 5), starsFor(3, 5), starsFor(5, 5)], [0, 1, 2, 3]);
      eq([DAILY_POOL.includes(dailyGameId() as (typeof DAILY_POOL)[number]), dailyGameId(new Date(2026, 0, 1)) === dailyGameId(new Date(2026, 0, 1, 23, 59))], [true, true]);
    },
  },
  { name: 'الهوية والروابط موجودة', run: () => eq([Boolean(BRAND.name.ar), Boolean(SOCIAL_LINKS.whatsapp)], [true, true]) },
];

// صفحة الاختبار الذاتي: افتح الرابط مع #test
export default function SelfTest() {
  const [results, setResults] = useState<Result[]>([]);

  useEffect(() => {
    (async () => {
      const out: Result[] = [];
      for (const t of TESTS) {
        try {
          await t.run();
          out.push({ name: t.name, ok: true });
        } catch (err) {
          out.push({ name: t.name, ok: false, info: (err as Error).message });
        }
        setResults([...out]);
      }
    })();
  }, []);

  const failed = results.filter((r) => !r.ok).length;
  return (
    <main dir="rtl" className="mx-auto max-w-xl space-y-3 p-5 font-mono text-sm" data-selftest={results.length === TESTS.length ? (failed ? 'fail' : 'pass') : 'running'}>
      <h1 className="font-display text-lg font-bold">اختبار ذاتي — {results.length - failed}/{TESTS.length}</h1>
      <ul className="space-y-1.5">
        {results.map((r) => (
          <li key={r.name} className={r.ok ? 'text-green-600' : 'text-red-500'}>
            {r.ok ? '✓' : '✗'} {r.name}
            {r.info ? ` — ${r.info}` : ''}
          </li>
        ))}
      </ul>
    </main>
  );
}
