import { useEffect, useState } from 'react';
import { isValidApiKeyFormat } from '../services/apiKey';
import { codeFromStatus } from '../services/api';
import { activeWordIndex, wordTimings } from '../services/narration';
import { dbDelete, dbGet, dbPut, hashText } from '../services/db';
import { safeFileName } from '../services/export';
import { base64ToBlob, blobToBase64 } from '../services/media';
import { BRAND, SOCIAL_LINKS } from '../config';
import { VIDEO_FORMATS, VIDEO_QUALITIES, videoSize } from '../services/videoFormats';

interface Result {
  name: string;
  ok: boolean;
  info?: string;
}

// مفاتيح اختبار مركّبة وقت التشغيل (لا نخزّن أي نص يشبه مفتاحاً حقيقياً في الكود)
const FAKE_AQ = `AQ.${'Zz9'.repeat(16)}`;
const FAKE_AIZA = `AIza${'Qq7'.repeat(12)}`;

const eq = (a: unknown, b: unknown) => {
  if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`expected ${JSON.stringify(b)} got ${JSON.stringify(a)}`);
};

const TESTS: { name: string; run: () => void | Promise<void> }[] = [
  { name: 'مفتاح AIza مقبول', run: () => eq(isValidApiKeyFormat(FAKE_AIZA), true) },
  { name: 'مفتاح AQ. بنقطة مقبول', run: () => eq(isValidApiKeyFormat(FAKE_AQ), true) },
  { name: 'مفتاح بين علامات اقتباس مقبول', run: () => eq(isValidApiKeyFormat(`"${FAKE_AQ}"`), true) },
  { name: 'مفتاح فيه مسافة أو قصير مرفوض', run: () => eq([isValidApiKeyFormat('AQ.abc def 1234567890123456'), isValidApiKeyFormat('abc')], [false, false]) },
  { name: 'رموز الحالة → رموز الأخطاء', run: () => eq([429, 401, 404, 503, 400].map(codeFromStatus), ['QUOTA', 'AUTH', 'NOMODEL', 'BUSY', 'FAILED']) },
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
