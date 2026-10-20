import { useEffect, useState } from 'react';
import { isValidApiKeyFormat, isValidFreeCreds, keyShape } from '../services/apiKey';
import { classifyFailure, codeFromTrail, rankError } from '../services/imageEngine';
import { codeFromStatus } from '../services/api';
import { activeWordIndex, wordTimings } from '../services/narration';
import {
  dbDelete,
  dbGet,
  dbPut,
  deleteAlbumCharacter,
  deleteCustomPreset,
  hashText,
  listAlbumCharacters,
  listCustomPresets,
  saveAlbumCharacter,
  saveCustomPreset,
  upgradeDbSchema,
} from '../services/db';
import { safeFileName } from '../services/export';
import { base64ToBlob, blobToBase64, cropToAspect } from '../services/media';
import { APP_VERSION, BRAND, BRAND_PRESETS, CONFIG, getStudioSettings, saveStudioSettings, SOCIAL_LINKS } from '../config';
import { CURRENT_VERSION, incrementVersion, compareVersions } from '../version';
import { VIDEO_FORMATS, VIDEO_QUALITIES, videoSize } from '../services/videoFormats';
import {
  applyBatch,
  buildCoverPrompt,
  buildPageImagePrompt,
  buildSheetPrompt,
  countPromptWords,
  isFruitStory,
  isIncomplete,
} from '../services/gemini';
import { allAnimationPrompts, animationPackText } from '../services/animation';
import { shareMessage, storyPlainText } from '../services/storyBundle';
import { LEARN_CARDS } from '../data/learnCards';
import { BOOK_TEMPLATES } from '../data/bookTemplates';
import { DAILY_POOL, dailyGameId, starsFor } from '../services/progress';
import {
  ART_STYLE_OPTIONS,
  COVER_EFFECT_OPTIONS,
  COVER_FONT_OPTIONS,
  EXTRA_STORY_TYPES,
  getCoverTitleClasses,
  PRIMARY_STORY_TYPES,
  STORY_TYPE_SPECS,
} from '../constants';
import { shouldPauseAtPreviewGate } from '../hooks/useIllustrator';
import { applyHollowWatermarkToBlob, computeRegionLuminance, drawHollowWatermarkOnCanvas } from '../services/watermark';
import type { StoryData, StoryPage } from '../types';

interface Result {
  name: string;
  ok: boolean;
  info?: string;
}

// مفاتيح اختبار مركّبة وقت التشغيل (لا نخزّن أي نص يشبه مفتاحاً حقيقياً في الكود)
const FAKE_AQ = `AQ.${'Zz9'.repeat(16)}`;
const FAKE_AIZA = `AIza${'Qq7'.repeat(12)}`;

const page = (n: number, extra: Partial<StoryPage> = {}): StoryPage => ({
  page: n,
  text: `Page ${n} runs and jumps with Sami.`,
  image_prompt: `Sami running happily across green hills in scene ${n}`,
  ...extra,
});
const fixture = (pages: number, planned?: number): StoryData => ({
  story_info: {
    title: 'Test Story',
    language: 'English',
    age_group: '4-6',
    art_style: 'Watercolor',
    aspect_ratio: '4:3',
    lessons: [],
    moral: 'old',
  },
  characters: [{ name: 'Sami', description: 'a cheerful 6-year-old boy with curly brown hair and blue jacket', personality: 'kind', age: '6', gender: 'boy' }],
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
      // 1) قاعدة جديدة: كتابة وقراءة وحذف بـ keyPath: 'id'
      const id = `selftest:${Date.now()}`;
      await dbPut('audio', { id, blob: new Blob(['x']), createdAt: 1 });
      eq(Boolean(await dbGet('audio', id)), true);
      await dbDelete('audio', id);
      eq(await dbGet('audio', id), undefined);

      // 2) قاعدة v1 مرحَّلة (حيث كان مخزن audio بـ keyPath: 'key'): التحقق من نسخ السجلات إلى keyPath: 'id' دون فقدان
      const tempDbName = `sawan_v1_mig_${Date.now()}`;
      try {
        await new Promise<void>((resolve, reject) => {
          const req1 = indexedDB.open(tempDbName, 1);
          req1.onupgradeneeded = () => {
            req1.result.createObjectStore('audio', { keyPath: 'key' });
          };
          req1.onsuccess = () => {
            const db1 = req1.result;
            const tx = db1.transaction('audio', 'readwrite');
            tx.objectStore('audio').put({ key: 'legacy-audio-1', blob: new Blob(['legacy']), createdAt: 42 });
            tx.oncomplete = () => {
              db1.close();
              resolve();
            };
            tx.onerror = () => {
              db1.close();
              reject(tx.error);
            };
          };
          req1.onerror = () => reject(req1.error);
        });

        await new Promise<void>((resolve, reject) => {
          const req2 = indexedDB.open(tempDbName, 2);
          req2.onupgradeneeded = () => {
            upgradeDbSchema(req2.result, req2.transaction);
          };
          req2.onsuccess = () => {
            const db2 = req2.result;
            const tx = db2.transaction('audio', 'readwrite');
            const store = tx.objectStore('audio');
            if (store.keyPath !== 'id') {
              db2.close();
              reject(new Error(`Expected keyPath 'id', got '${String(store.keyPath)}'`));
              return;
            }
            const getReq = store.get('legacy-audio-1');
            getReq.onsuccess = () => {
              const migrated = getReq.result as { id?: string; createdAt?: number } | undefined;
              if (!migrated || migrated.id !== 'legacy-audio-1' || migrated.createdAt !== 42) {
                db2.close();
                reject(new Error('Legacy audio record was not migrated to keyPath id'));
                return;
              }
              store.put({ id: 'new-audio-2', blob: new Blob(['new']), createdAt: 99 });
              store.delete('legacy-audio-1');
            };
            tx.oncomplete = () => {
              db2.close();
              resolve();
            };
            tx.onerror = () => {
              db2.close();
              reject(tx.error);
            };
          };
          req2.onerror = () => reject(req2.error);
        });
      } finally {
        indexedDB.deleteDatabase(tempDbName);
      }
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
  { name: 'الهوية والروابط موجودة', run: () => eq([Boolean(BRAND.name.ar), Boolean(SOCIAL_LINKS.whatsapp), Boolean(CONFIG.GITHUB_OWNER), Boolean(CONFIG.GITHUB_REPO)], [true, true, true, true]) },

  // ═══ اختبارات الإصدار 3.0.0 ═══
  {
    name: 'أ7 (1): طول طلب الصورة لأي صفحة من القوالب <= 120 كلمة + الغلاف وورقة الشخصيات دون قص المشهد',
    run: () => {
      if (BOOK_TEMPLATES.length < 12) throw new Error(`Expected at least 12 templates, got ${BOOK_TEMPLATES.length}`);
      for (const tmpl of BOOK_TEMPLATES) {
        const scenePrompt = `Wide storybook shot of سراج and ياسمين exploring ${tmpl.defaultIdea.en} under warm golden light`;
        const st: StoryData = {
          story_info: {
            title: tmpl.title.ar,
            language: 'Arabic',
            dialect: tmpl.dialect,
            age_group: tmpl.ageGroup,
            story_type: tmpl.storyType,
            art_style: tmpl.artStyle,
            aspect_ratio: tmpl.aspectRatio,
            lessons: ['الشجاعة', 'التعاون'],
          },
          cover_image_prompt: tmpl.coverPromptTemplate || `Heroic composition showing the protagonists in ${tmpl.defaultIdea.en}`,
          characters: [
            {
              name: 'سراج',
              description: 'A brave 8-year-old boy with warm olive skin, curly dark hair, wearing an embroidered vest and carrying a brass lantern',
              personality: 'curious and brave',
              age: '8',
              gender: 'boy',
            },
            {
              name: 'ياسمين',
              description: 'A cheerful 7-year-old girl with braided hair, bright brown eyes, wearing a green dress and woven scarf',
              personality: 'clever',
              age: '7',
              gender: 'girl',
            },
            {
              name: 'حكيم',
              description: 'A wise elderly mentor with a silver beard, warm smile, wooden staff, and traditional cloak',
              personality: 'wise',
              age: '65',
              gender: 'man',
            },
          ],
          pages: [
            {
              page: 1,
              text: `${tmpl.defaultIdea.ar} مشى سراج مع ياسمين وحكيم في المشهد الأول.`,
              image_prompt: scenePrompt,
            },
          ],
        };
        const pagePrompt = buildPageImagePrompt(st, st.pages[0]);
        const coverPrompt = buildCoverPrompt(st);
        const sheetPrompt = buildSheetPrompt(st, true);
        const wPage = countPromptWords(pagePrompt);
        const wCover = countPromptWords(coverPrompt);
        const wSheet = countPromptWords(sheetPrompt);
        if (wPage > 120) throw new Error(`template ${tmpl.id} page prompt has ${wPage} words (>120)`);
        if (wCover > 120) throw new Error(`template ${tmpl.id} cover prompt has ${wCover} words (>120)`);
        if (wSheet > 120) throw new Error(`template ${tmpl.id} sheet prompt has ${wSheet} words (>120)`);
        if (!pagePrompt.startsWith(`Scene: ${scenePrompt}.`)) {
          throw new Error(`template ${tmpl.id} scene was truncated or altered`);
        }
      }
    },
  },
  {
    name: 'أ7 (2): وصف المشهد يظهر في أول 40 حرفاً من الطلب ولا يحوي الحقول المحذوفة',
    run: () => {
      const st = fixture(2);
      st.pages[0].image_prompt = 'Sami climbing the glowing crystal tree at sunset';
      const prompt = buildPageImagePrompt(st, st.pages[0]);
      if (!prompt.slice(0, 40).startsWith('Scene: Sami climbing')) {
        throw new Error(`Scene not in first 40 chars: "${prompt.slice(0, 40)}"`);
      }
      if (/GLOBAL SEED|STYLE LOCK|Visual anchor|NEGATIVE/i.test(prompt)) {
        throw new Error('Forbidden legacy tokens found in prompt');
      }
    },
  },
  {
    name: 'أ3 + أ4: فحص الفواكه من الشخصيات/النص وتوحيد الـ 18 أسلوباً بدون قوائم سلبية',
    run: () => {
      const st = fixture(1);
      st.characters[0] = { name: 'رمان', description: 'a ruby pomegranate hero', personality: 'brave', age: '7', gender: 'boy' };
      eq(isFruitStory(st), true);
      const p = buildPageImagePrompt(st, st.pages[0]);
      if (/fruit kingdom/i.test(p)) throw new Error('Forbidden fruit kingdom environment forced');
      if (!/cute pomegranate character with a face and limbs/i.test(p)) throw new Error('Fruit boost missing from character line');
      eq(ART_STYLE_OPTIONS.length, 18);
      for (const s of ART_STYLE_OPTIONS) {
        if (countPromptWords(s.prompt) > 30) throw new Error(`Style ${s.value} exceeds 30 words`);
      }
    },
  },
  {
    name: 'القسم ب + أ8: نظام الإصدارات (0..9 للخانات الفرعية، incrementVersion، وأولوية buildNumber في compareVersions)',
    run: () => {
      eq(APP_VERSION, CURRENT_VERSION.version);
      eq(CURRENT_VERSION.version, '3.0.0');
      eq(CURRENT_VERSION.buildNumber >= 2101, true);

      // incrementVersion: من 2.9.1 patch → 2.9.2؛ من 2.9.9 patch → 3.0.0؛ من 2.9.5 minor → 3.0.0؛ من 3.0.0 minor → 3.1.0
      eq(incrementVersion('patch', '2.9.1').version, '2.9.2');
      eq(incrementVersion('patch', '2.9.9').version, '3.0.0');
      eq(incrementVersion('minor', '2.9.5').version, '3.0.0');
      eq(incrementVersion('minor', '3.0.0').version, '3.1.0');

      // compareVersions: يقارن buildNumber أولاً بحيث 3.0.0 مع buildNumber أعلى يُعتبر أحدث من الإصدار السابق ذي الرقم 2100
      const oldTenVersion = ['2', '10', '0'].join('.');
      eq(
        compareVersions(
          { version: '3.0.0', buildNumber: CURRENT_VERSION.buildNumber },
          { version: oldTenVersion, buildNumber: 2100 }
        ),
        1
      );
      eq(compareVersions('3.0.0', '2.9.5'), 1);
      eq(compareVersions('3.0.0', '3.0.0'), 0);
      eq(compareVersions('2.9.1', '2.9.5'), -1);
    },
  },
  {
    name: 'ب1: اكتمال جدول الـ 16 نوع قصص (5 أساسية + 11 إضافية) وبنيتها السردية',
    run: () => {
      eq([PRIMARY_STORY_TYPES.length, EXTRA_STORY_TYPES.length, Object.keys(STORY_TYPE_SPECS).length], [5, 11, 16]);
      for (const spec of Object.values(STORY_TYPE_SPECS)) {
        if (!spec.arc.beginning || !spec.arc.middle || !spec.arc.climax || !spec.arc.ending || !spec.pageRule) {
          throw new Error(`Incomplete narrative arc for ${spec.value}`);
        }
      }
    },
  },
  {
    name: 'ب2: خطوط الغلاف الـ 12 وتأثيرات النص الـ 4 ومعاينة الفئات',
    run: () => {
      eq([COVER_FONT_OPTIONS.length, COVER_EFFECT_OPTIONS.length], [12, 4]);
      for (const f of COVER_FONT_OPTIONS) {
        for (const ef of COVER_EFFECT_OPTIONS) {
          const cls = getCoverTitleClasses(f.value, ef.value);
          if (!cls.includes(f.className) || !cls.includes(ef.className)) {
            throw new Error(`Missing class for ${f.value}/${ef.value}`);
          }
        }
      }
    },
  },
  {
    name: 'ب3: اكتمال الـ 16 هوية في BRAND_PRESETS وحفظ/استرجاع الهويات المخصصة في IndexedDB',
    run: async () => {
      eq(BRAND_PRESETS.length, 16);
      for (const p of BRAND_PRESETS) {
        if (!p.artStyle || !p.voice || !p.dialect || !p.coverFont || !p.ambientPreset) {
          throw new Error(`Preset ${p.id} missing required identity fields`);
        }
      }
      const testPresetId = `selftest-preset-${Date.now()}`;
      await saveCustomPreset({
        id: testPresetId,
        label: { ar: 'هوية اختبار', en: 'Test Identity' },
        desc: { ar: 'وصف', en: 'Desc' },
        artStyle: 'Watercolor',
        voice: 'Sulafat',
        dialect: 'Palestinian',
        coverFont: 'kufi',
        ambientPreset: 'forest',
      });
      const list = await listCustomPresets();
      eq(list.some((item) => item.id === testPresetId), true);
      await deleteCustomPreset(testPresetId);
      const after = await listCustomPresets();
      eq(after.some((item) => item.id === testPresetId), false);
    },
  },
  {
    name: 'ب4: منطق بوابة المعاينة بعد الغلاف والصفحة 1 وإعدادات الاستوديو',
    run: () => {
      eq(
        [
          shouldPauseAtPreviewGate(true, false, true, true, 6, 5),
          shouldPauseAtPreviewGate(true, true, true, true, 6, 5),
          shouldPauseAtPreviewGate(false, false, true, true, 6, 5),
          shouldPauseAtPreviewGate(true, false, true, true, 1, 0),
        ],
        [true, false, false, false]
      );
      const orig = getStudioSettings();
      const updated = saveStudioSettings({ previewFirstGate: !orig.previewFirstGate });
      eq(updated.previewFirstGate, !orig.previewFirstGate);
      saveStudioSettings(orig);
    },
  },
  {
    name: 'ب5: زر «الصورة لا تطابق» يدمج Correction بعد المشهد مباشرة ويبقى <= 120 كلمة',
    run: () => {
      const st = fixture(1);
      st.pages[0].correctionNote = 'The cat on the fence must be pure white';
      const corrected = buildPageImagePrompt(st, st.pages[0]);
      if (!corrected.startsWith('Scene: Sami running happily across green hills in scene 1. Correction: The cat on the fence must be pure white.')) {
        throw new Error(`Unexpected corrected prompt start: ${corrected.slice(0, 120)}`);
      }
      if (countPromptWords(corrected) > 120) throw new Error('Corrected prompt exceeded 120 words');
    },
  },
  {
    name: 'ب6 + ب7: حفظ واسترجاع وحذف شخصية في ألبوم الشخصيات (IndexedDB characters)',
    run: async () => {
      const saved = await saveAlbumCharacter({
        id: `selftest-char-${Date.now()}`,
        name: 'فارس الرمان',
        description: 'A brave pomegranate knight with ruby armor',
        personality: 'شجاع وحكيم',
        age: '8',
        gender: 'boy',
        referenceImageId: 'ref-img-test',
      });
      const all = await listAlbumCharacters();
      const found = all.find((c) => c.id === saved.id);
      eq([Boolean(found), found?.referenceImageId], [true, 'ref-img-test']);
      await deleteAlbumCharacter(saved.id);
      const after = await listAlbumCharacters();
      eq(after.some((c) => c.id === saved.id), false);
    },
  },
  {
    name: 'ب8: تطبيق العلامة المائية المفرغة عند التصدير وإنتاج صورة غير فارغة بتباين متكيف',
    run: async () => {
      const canvas = document.createElement('canvas');
      canvas.width = 400;
      canvas.height = 300;
      const ctx = canvas.getContext('2d')!;
      // خلفية داكنة
      ctx.fillStyle = '#111122';
      ctx.fillRect(0, 0, 400, 300);
      const darkData = ctx.getImageData(300, 260, 80, 30);
      const darkLum = computeRegionLuminance(darkData.data);
      if (darkLum >= 135) throw new Error(`Expected dark luminance < 135, got ${darkLum}`);

      const srcBlob = await new Promise<Blob>((res) => canvas.toBlob((b) => res(b!), 'image/png'));
      const watermarkedBlob = await applyHollowWatermarkToBlob(srcBlob, {
        forceEnable: true,
        customText: BRAND.name.ar,
        isArabic: true,
      });
      if (watermarkedBlob.size === 0) throw new Error('Watermarked blob is empty');
      const bmp = await createImageBitmap(watermarkedBlob);
      eq([bmp.width, bmp.height], [400, 300]);

      // التحقق من الرسم المباشر على Canvas
      await drawHollowWatermarkOnCanvas(canvas, { forceEnable: true, customText: BRAND.name.en, isArabic: false });
      const dataUrl = canvas.toDataURL('image/png');
      if (!dataUrl.startsWith('data:image/png;base64,') || dataUrl.length < 100) {
        throw new Error('Canvas watermark output invalid');
      }
    },
  },
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
      <h1 className="font-display text-lg font-bold">اختبار ذاتي (v{APP_VERSION}) — {results.length - failed}/{TESTS.length}</h1>
      <ul className="space-y-1.5">
        {results.map((r) => (
          <li key={r.name} className={r.ok ? 'text-green-600' : 'text-red-500'}>
            [{r.ok ? 'PASS' : 'FAIL'}] {r.name}
            {r.info ? ` — ${r.info}` : ''}
          </li>
        ))}
      </ul>
    </main>
  );
}
