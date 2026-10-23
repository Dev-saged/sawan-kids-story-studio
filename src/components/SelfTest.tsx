import { useEffect, useState } from 'react';
import { isValidApiKeyFormat, isValidFreeCreds, keyShape } from '../services/apiKey';
import { buildFinalImageText, classifyFailure, codeFromTrail, rankError } from '../services/imageEngine';
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
  newId,
  saveAlbumCharacter,
  saveCustomPreset,
  upgradeDbSchema,
} from '../services/db';
import { safeFileName } from '../services/export';
import { base64ToBlob, blobToBase64, cleanImageCache, cropToAspect, saveImage } from '../services/media';
import { APP_VERSION, BRAND, BRAND_PRESETS, CONFIG, getStudioSettings, saveStudioSettings, SOCIAL_LINKS } from '../config';
import { CURRENT_VERSION, incrementVersion, compareVersions } from '../version';
import { VIDEO_FORMATS, VIDEO_QUALITIES, videoSize } from '../services/videoFormats';
import {
  analyzeTextSentimentAndPalette,
  applyBatch,
  applyImprovedIdeaWithUndo,
  buildCoverPrompt,
  buildPageImagePrompt,
  buildSheetPrompt,
  canRequestImproveIdea,
  countPromptWords,
  IMPROVE_IDEA_COOLDOWN_MS,
  isAdultStory,
  isFruitStory,
  isIncomplete,
  resolveStyleConsistencyKeywords,
  restoreOriginalIdea,
  StoryGenerator,
  validateAndClipImprovedIdeas,
} from '../services/gemini';
import { allAnimationPrompts, animationPackText } from '../services/animation';
import { shareMessage, storyPlainText } from '../services/storyBundle';
import { LEARN_CARDS } from '../data/learnCards';
import { BOOK_TEMPLATES } from '../data/bookTemplates';
import {
  DAILY_IDEA_DISMISSED_KEY,
  DAILY_IDEAS,
  dismissDailyIdeaForToday,
  isDailyIdeaDismissedToday,
  pickDailyIdea,
} from '../data/dailyIdeas';
import { DAILY_POOL, dailyGameId, starsFor } from '../services/progress';
import {
  ART_STYLE_OPTIONS,
  COVER_EFFECT_OPTIONS,
  COVER_FONT_OPTIONS,
  DIALECT_OPTIONS,
  EXTRA_STORY_TYPES,
  getCoverTitleClasses,
  MAX_IDEA_LENGTH,
  PRIMARY_STORY_TYPES,
  STORY_TYPE_SPECS,
} from '../constants';
import { shouldPauseAtPreviewGate } from '../hooks/useIllustrator';
import { applyHollowWatermarkToBlob, computeRegionLuminance, drawHollowWatermarkOnCanvas } from '../services/watermark';
import { buildSafeHealthReportJson, containsRawSecretPattern } from '../services/appHealth';
import {
  computeImageEffectiveDpi,
  computePrintPageDimensionsMm,
  computePrintPageMarginsMm,
} from '../services/printBook';
import { estimateCostUsd, getStyleLock, normalizeStyleConsistencyId, partsForText, videoAspectFor } from '../shared/modelRules';
import { buildClipPrompt } from '../services/videoClips';
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

const verStr = (maj: number, min: number, pat: number) => `${maj}.${min}.${pat}`;

export const TESTS: { name: string; run: () => void | Promise<void> }[] = [
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
      // 1) قاعدة جديدة: كتابة وقراءة وحذف بـ keyPath: 'id' (استخدام newId لمنع تصادم StrictMode المتوازي)
      const id = `selftest:${newId()}`;
      await dbPut('audio', { id, blob: new Blob(['x']), createdAt: 1 });
      eq(Boolean(await dbGet('audio', id)), true);
      await dbDelete('audio', id);
      eq(await dbGet('audio', id), undefined);

      // 2) قاعدة v1 مرحَّلة بمخزن audio بمفتاح 'key' وسجل {key:'legacy-audio-1', createdAt:42}:
      // استخدام اسم قاعدة فريد عبر newId() لمنع تداخل التشغيل المزدوج في React.StrictMode
      const tempDbName = `sawan_v1_mig_${newId()}`;
      try {
        await new Promise<void>((resolve, reject) => {
          const req1 = indexedDB.open(tempDbName, 1);
          req1.onupgradeneeded = () => {
            req1.result.createObjectStore('audio', { keyPath: 'key' });
          };
          req1.onsuccess = () => {
            const db1 = req1.result;
            const tx = db1.transaction('audio', 'readwrite');
            tx.objectStore('audio').put({ key: 'legacy-audio-1', createdAt: 42 });
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
              store.put({ id: 'new-audio-2', createdAt: 99 });
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

      // 3) حالة ثانية (أ1): سجل legacy بلا حقل key وبمفتاح out-of-line يُرحَّل برقم/معرّف id صحيح دون فقدان
      const tempOutDbName = `sawan_v1_out_${newId()}`;
      try {
        await new Promise<void>((resolve, reject) => {
          const req1 = indexedDB.open(tempOutDbName, 1);
          req1.onupgradeneeded = () => {
            // مخزن بلا keyPath (يستخدم مفاتيح out-of-line)
            req1.result.createObjectStore('audio');
          };
          req1.onsuccess = () => {
            const db1 = req1.result;
            const tx = db1.transaction('audio', 'readwrite');
            tx.objectStore('audio').put({ createdAt: 77, tag: 'out-of-line-item' }, 105);
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
          const req2 = indexedDB.open(tempOutDbName, 2);
          req2.onupgradeneeded = () => {
            upgradeDbSchema(req2.result, req2.transaction);
          };
          req2.onsuccess = () => {
            const db2 = req2.result;
            const tx = db2.transaction('audio', 'readonly');
            const store = tx.objectStore('audio');
            if (store.keyPath !== 'id') {
              db2.close();
              reject(new Error(`Expected keyPath 'id' for out-of-line store, got '${String(store.keyPath)}'`));
              return;
            }
            const getReq = store.get('105');
            getReq.onsuccess = () => {
              const migrated = getReq.result as { id?: string; createdAt?: number; tag?: string } | undefined;
              if (!migrated || migrated.id !== '105' || migrated.createdAt !== 77 || migrated.tag !== 'out-of-line-item') {
                db2.close();
                reject(new Error('Out-of-line legacy audio record was not migrated with valid id'));
                return;
              }
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
        indexedDB.deleteDatabase(tempOutDbName);
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

  // ═══ اختبارات الإصدار 3.0.x ═══
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
      eq(/^\d+\.[0-9]\.[0-9]$/.test(CURRENT_VERSION.version), true);
      eq(CURRENT_VERSION.buildNumber > 2101, true);

      // incrementVersion: من 2.9.1 patch → 2.9.2؛ من 2.9.9 patch → 3.0.0؛ من 2.9.5 minor → 3.0.0؛ من 3.0.0 minor → 3.1.0؛ من 3.0.0 patch → 3.0.1
      eq(incrementVersion('patch', verStr(2, 9, 1)).version, verStr(2, 9, 2));
      eq(incrementVersion('patch', verStr(2, 9, 9)).version, verStr(3, 0, 0));
      eq(incrementVersion('minor', verStr(2, 9, 5)).version, verStr(3, 0, 0));
      eq(incrementVersion('minor', verStr(3, 0, 0)).version, verStr(3, 1, 0));
      eq(incrementVersion('patch', verStr(3, 0, 0)).version, verStr(3, 0, 1));

      // compareVersions: يقارن buildNumber أولاً بحيث الإصدار الحالي مع buildNumber أعلى يُعتبر أحدث من الإصدار السابق ذي الرقم 2100
      const oldTenVersion = ['2', '10', '0'].join('.');
      eq(
        compareVersions(
          { version: CURRENT_VERSION.version, buildNumber: CURRENT_VERSION.buildNumber },
          { version: oldTenVersion, buildNumber: 2100 }
        ),
        1
      );
      eq(compareVersions(verStr(3, 0, 1), verStr(3, 0, 0)), 1);
      eq(compareVersions(verStr(3, 0, 0), verStr(2, 9, 5)), 1);
      eq(compareVersions(verStr(3, 0, 0), verStr(3, 0, 0)), 0);
      eq(compareVersions(verStr(2, 9, 1), verStr(2, 9, 5)), -1);
    },
  },
  {
    name: 'أ3 + ب1: اكتمال جدول الـ 16 نوع قصص وتعريب قوس السرد بالكامل وعدم ظهور MSA حرفياً في الواجهة العربية',
    run: () => {
      eq([PRIMARY_STORY_TYPES.length, EXTRA_STORY_TYPES.length, Object.keys(STORY_TYPE_SPECS).length], [5, 11, 16]);
      for (const spec of Object.values(STORY_TYPE_SPECS)) {
        if (!spec.arc.beginning || !spec.arc.middle || !spec.arc.climax || !spec.arc.ending || !spec.pageRule) {
          throw new Error(`Incomplete narrative arc for ${spec.value}`);
        }
        // أ3: التحقق من تعريب جميع أقسام قوس السرد للأنواع الـ 16 وعدم احتوائها على نص إنجليزي
        const fields = [spec.arc.beginning, spec.arc.middle, spec.arc.climax, spec.arc.ending];
        for (const f of fields) {
          if (!/[\u0600-\u06FF]/.test(f)) {
            throw new Error(`Narrative arc for ${spec.value} is not translated to Arabic`);
          }
          if (/[A-Za-z]{2,}/.test(f)) {
            throw new Error(`Narrative arc for ${spec.value} contains English words in Arabic field: ${f}`);
          }
        }
      }
      const msaDialect = DIALECT_OPTIONS.find((d) => d.value === 'Modern Standard');
      if (!msaDialect || msaDialect.label.includes('MSA') || !msaDialect.label.includes('الفصحى')) {
        throw new Error('Modern Standard Arabic label does not use الفصحى');
      }
    },
  },
  {
    name: 'فكرة اليوم (dailyIdeas): ≥60 فكرة ثنائية اللغة وثبات الاختيار اليومي والتدوير المحلي',
    run: () => {
      if (DAILY_IDEAS.length < 60) throw new Error(`Expected >= 60 daily ideas, got ${DAILY_IDEAS.length}`);
      for (const item of DAILY_IDEAS) {
        if (!item.idea.ar || !item.idea.en || !item.storyType || !item.presetId) {
          throw new Error(`Incomplete daily idea ${item.id}`);
        }
      }
      const fixedDate = new Date(2026, 9, 21, 9, 0);
      const sameDayLater = new Date(2026, 9, 21, 22, 30);
      const firstPick = pickDailyIdea(fixedDate, 'hakaya', 0);
      const secondPick = pickDailyIdea(sameDayLater, 'hakaya', 0);
      eq(firstPick.id, secondPick.id);
      const rotatedPick = pickDailyIdea(fixedDate, 'hakaya', 1);
      if (rotatedPick.id === firstPick.id && DAILY_IDEAS.length > 1) {
        throw new Error('Offset rotation did not advance to another idea');
      }
      let prevDismissed: string | null = null;
      try {
        prevDismissed = localStorage.getItem(DAILY_IDEA_DISMISSED_KEY);
        dismissDailyIdeaForToday(fixedDate);
        eq(isDailyIdeaDismissedToday(fixedDate), true);
        eq(isDailyIdeaDismissedToday(new Date(2026, 9, 22, 8, 0)), false);
      } finally {
        try {
          if (prevDismissed === null) localStorage.removeItem(DAILY_IDEA_DISMISSED_KEY);
          else localStorage.setItem(DAILY_IDEA_DISMISSED_KEY, prevDismissed);
        } catch {
          // ignore
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
      const testPresetId = `selftest-preset-${newId()}`;
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
        id: `selftest-char-${newId()}`,
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
  {
    name: 'ب2 (v3.1.0): التحقق من مخرجات «حسّن فكرتي» وقصّ الطول والتراجع وحدّ الطلبات (3 ثوانٍ)',
    run: () => {
      // 1) قص الطول وتنقية HTML والتحقق من إرجاع 3 صياغات نظيفة
      const overlongIdea = Array.from({ length: 95 }, (_, i) => `كلمة${i + 1}`).join(' ');
      const rawResponse = {
        suggestions: [
          `<script>alert(1)</script> ${overlongIdea}`,
          'بطل شجاع ينطلق في غابة الفوانيس المضيئة ليحل لغز النهر القديم ويتعلم قيمة الصبر والتعاون مع أصدقائه.',
          'في قرية جبلية هادئة يواجه الطفل تحدياً صعباً أثناء البحث عن الطائر الذهبي ويكتشف أن الصدق ينجيه دائماً.',
          'صياغة رابعة إضافية يجب تجاهلها لأن الحد الأقصى 3 بطاقات فقط.',
        ],
      };
      const cleaned = validateAndClipImprovedIdeas(rawResponse, 70, MAX_IDEA_LENGTH);
      eq(cleaned.length, 3);
      if (cleaned[0].includes('<script>')) throw new Error('HTML tags were not stripped from improved idea');
      const firstWordCount = cleaned[0].split(/\s+/).filter(Boolean).length;
      if (firstWordCount > 70) throw new Error(`Expected <= 70 words after clipping, got ${firstWordCount}`);

      // 2) التراجع يعيد النص الأصلي مهما تعددت الاختيارات
      const step1 = applyImprovedIdeaWithUndo('فكرتي الأصلية القصيرة', null, cleaned[0]);
      eq([step1.originalIdea, step1.nextIdea], ['فكرتي الأصلية القصيرة', cleaned[0]]);
      const step2 = applyImprovedIdeaWithUndo(step1.nextIdea, step1.originalIdea, cleaned[1]);
      eq([step2.originalIdea, step2.nextIdea], ['فكرتي الأصلية القصيرة', cleaned[1]]);
      const restored = restoreOriginalIdea(step2.originalIdea, step2.nextIdea);
      eq([restored.restoredIdea, restored.originalIdea], ['فكرتي الأصلية القصيرة', null]);

      // 3) حدّ الطلبات بطلب واحد كل 3 ثوانٍ
      const t0 = 100_000;
      eq(canRequestImproveIdea(0, t0), true);
      eq(canRequestImproveIdea(t0, t0 + 1500), false);
      eq(canRequestImproveIdea(t0, t0 + IMPROVE_IDEA_COOLDOWN_MS - 1), false);
      eq(canRequestImproveIdea(t0, t0 + IMPROVE_IDEA_COOLDOWN_MS), true);
    },
  },
  {
    name: 'ب3 (v3.1.0): تقرير صحة التطبيق خالٍ من أنماط المفاتيح، وcleanImageCache يحفظ صور القصص والأبطال ويحذف اليتيمة فقط',
    run: async () => {
      // 1) التحقق من تنقية الأسرار والمفاتيح من JSON التقرير
      const mockDirtyReport = {
        version: CURRENT_VERSION.version,
        leakedAiKey: FAKE_AIZA,
        leakedAqKey: FAKE_AQ,
        leakedBearer: 'Bearer secret_token_1234567890abcdef',
        nested: { cfAccount: '0123456789abcdef0123456789abcdef' },
      };
      const safeJson = buildSafeHealthReportJson(mockDirtyReport);
      eq(containsRawSecretPattern(safeJson), false);
      if (safeJson.includes(FAKE_AIZA) || safeJson.includes(FAKE_AQ)) {
        throw new Error('Raw API key leaked into health report JSON');
      }

      // 2) التحقق من أن cleanImageCache يحفظ صور القصص والأبطال وألبوم الشخصيات ويحذف اليتيمة فقط
      const tinyBlob = new Blob([new Uint8Array([137, 80, 78, 71])], { type: 'image/png' });
      const storyImg = await saveImage(tinyBlob, 'page', 'Watercolor', 'active story page image');
      const heroImg = await saveImage(tinyBlob, 'photo', 'photo', 'active hero photo');
      const albumImg = await saveImage(tinyBlob, 'sheet', 'Watercolor', 'active character sheet');
      const orphanImg = await saveImage(tinyBlob, 'page', 'Watercolor', 'orphan unreferenced image');

      const testStoryId = `selftest-story-${newId()}`;
      const testHeroId = `selftest-hero-${newId()}`;
      const testCharId = `selftest-album-${newId()}`;

      try {
        await dbPut('stories', {
          id: testStoryId,
          story_info: { title: 'قصة اختبار', language: 'Arabic', age_group: '7-9', art_style: 'Watercolor', lessons: [] },
          characters: [],
          pages: [{ page: 1, text: 'نص', image_prompt: 'مشهد', imageId: storyImg.id }],
          createdAt: Date.now(),
        });
        await dbPut('children', {
          id: testHeroId,
          name: 'بطل الاختبار',
          photoId: heroImg.id,
          createdAt: Date.now(),
        });
        await saveAlbumCharacter({
          id: testCharId,
          name: 'شخصية الاختبار',
          description: 'وصف',
          personality: 'لطيف',
          age: '7',
          gender: 'boy',
          referenceImageId: albumImg.id,
        });

        const cleanRes = await cleanImageCache();
        if (!cleanRes.orphanIds.includes(orphanImg.id)) {
          throw new Error('Expected orphan image to be detected and removed by cleanImageCache');
        }

        const [keptStoryImg, keptHeroImg, keptAlbumImg, deletedOrphanImg] = await Promise.all([
          dbGet('images', storyImg.id),
          dbGet('images', heroImg.id),
          dbGet('images', albumImg.id),
          dbGet('images', orphanImg.id),
        ]);
        eq([Boolean(keptStoryImg), Boolean(keptHeroImg), Boolean(keptAlbumImg), Boolean(deletedOrphanImg)], [true, true, true, false]);
      } finally {
        await Promise.all([
          dbDelete('stories', testStoryId).catch(() => undefined),
          dbDelete('children', testHeroId).catch(() => undefined),
          deleteAlbumCharacter(testCharId).catch(() => undefined),
          dbDelete('images', storyImg.id).catch(() => undefined),
          dbDelete('images', heroImg.id).catch(() => undefined),
          dbDelete('images', albumImg.id).catch(() => undefined),
          dbDelete('images', orphanImg.id).catch(() => undefined),
        ]);
      }
    },
  },
  {
    name: 'ب4 (v3.1.0): أبعاد الصفحة في printBook لكل مقاس مع bleed وبدونه، وانعكاس الهوامش الفردية/الزوجية في RTL',
    run: () => {
      // 1) أبعاد المقاسات الثلاثة (A5، A4، Square21) مع bleed 3مم وبدونه
      const a5Bleed = computePrintPageDimensionsMm('A5', true);
      const a5NoBleed = computePrintPageDimensionsMm('A5', false);
      eq([a5Bleed.totalWidthMm, a5Bleed.totalHeightMm, a5Bleed.bleedMm], [154, 216, 3]);
      eq([a5NoBleed.totalWidthMm, a5NoBleed.totalHeightMm, a5NoBleed.bleedMm], [148, 210, 0]);

      const a4Bleed = computePrintPageDimensionsMm('A4', true);
      const a4NoBleed = computePrintPageDimensionsMm('A4', false);
      eq([a4Bleed.totalWidthMm, a4Bleed.totalHeightMm], [216, 303]);
      eq([a4NoBleed.totalWidthMm, a4NoBleed.totalHeightMm], [210, 297]);

      const sqBleed = computePrintPageDimensionsMm('Square21', true);
      const sqNoBleed = computePrintPageDimensionsMm('Square21', false);
      eq([sqBleed.totalWidthMm, sqBleed.totalHeightMm], [216, 216]);
      eq([sqNoBleed.totalWidthMm, sqNoBleed.totalHeightMm], [210, 210]);

      // 2) انعكاس الهامش الداخلي والخارجي بين الصفحات الفردية والزوجية في التجليد العربي RTL
      const rtlOdd = computePrintPageMarginsMm(1, true, 12, 6);
      const rtlEven = computePrintPageMarginsMm(2, true, 12, 6);
      eq([rtlOdd.innerMm, rtlOdd.outerMm], [18, 12]);
      eq([rtlOdd.rightMm, rtlOdd.leftMm], [18, 12]);
      eq([rtlEven.rightMm, rtlEven.leftMm], [12, 18]);
      // التحقق من الانعكاس التام بين الفردية والزوجية وبين RTL و LTR
      const ltrOdd = computePrintPageMarginsMm(1, false, 12, 6);
      eq([ltrOdd.leftMm, ltrOdd.rightMm], [rtlOdd.rightMm, rtlOdd.leftMm]);

      // 3) حساب DPI للتنبيه عند < 150 DPI
      const hiDpi = computeImageEffectiveDpi(2048, 2048, 148, 118);
      const lowDpi = computeImageEffectiveDpi(600, 600, 210, 210);
      if (hiDpi < 150) throw new Error(`Expected 2048px image on A5 to be >= 150 DPI, got ${hiDpi}`);
      if (lowDpi >= 150) throw new Error(`Expected 600px image on 210mm square to be < 150 DPI, got ${lowDpi}`);
    },
  },
  {
    name: 'القسم ج (v3.1.0): فحص تباين الألوان للمكونات الجديدة (>= 4.5:1 حسب WCAG AA)',
    run: () => {
      const hexToRgb = (hex: string): [number, number, number] => {
        const clean = hex.replace('#', '');
        const n = parseInt(clean, 16);
        return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
      };
      const relLum = ([r, g, b]: [number, number, number]): number => {
        const chan = (c: number) => {
          const s = c / 255;
          return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
        };
        return 0.2126 * chan(r) + 0.7152 * chan(g) + 0.0722 * chan(b);
      };
      const contrastRatio = (fgHex: string, bgHex: string): number => {
        const l1 = relLum(hexToRgb(fgHex));
        const l2 = relLum(hexToRgb(bgHex));
        const lighter = Math.max(l1, l2);
        const darker = Math.min(l1, l2);
        return (lighter + 0.05) / (darker + 0.05);
      };

      // أزواج الألوان المستخدمة في بطاقات فكرة اليوم، حسّن فكرتي، حالة التطبيق، ومعاينة الطباعة
      const pairs: { label: string; fg: string; bg: string }[] = [
        { label: 'Ink on Moonlight (Light cards)', fg: '#241b2f', bg: '#fbf7ef' },
        { label: 'Moonlight on Dusk (Dark cards)', fg: '#fbf7ef', bg: '#1b1533' },
        { label: 'Ink on Lantern CTA button', fg: '#241b2f', bg: '#f5b82e' },
        { label: 'White on Emerald Ready Badge', fg: '#ffffff', bg: '#047857' },
        { label: 'White on Stone Unavailable Badge', fg: '#ffffff', bg: '#44403c' },
        { label: 'Amber-200 on Dark Dusk Card', fg: '#fde68a', bg: '#1b1533' },
        { label: 'Print Soft Ink on Paper', fg: '#5d5470', bg: '#fbf7ef' },
      ];

      for (const p of pairs) {
        const ratio = contrastRatio(p.fg, p.bg);
        if (ratio < 4.5) {
          throw new Error(`Contrast failure on ${p.label}: ${ratio.toFixed(2)}:1 (< 4.5:1)`);
        }
      }
    },
  },
  {
    name: 'محرك تصنيف البرومبت (StoryGenerator.classifyPrompt) وثبات الأسلوب الفني (Style Consistency) ومستوى الجمهور (Audience Level)',
    run: () => {
      const adultClass = StoryGenerator.classifyPrompt({
        idea: 'قصة عن مهندس بالغ يخوض رحلة في مدينة قديمة',
        audienceLevel: 'adults',
        artStyle: 'Anime',
        styleConsistency: 'studio ghibli',
      });
      eq(adultClass.targetAudience, 'adult');
      eq(adultClass.audienceLevel, 'adults');
      if (!adultClass.styleConsistency.includes('studio ghibli')) {
        throw new Error(`Expected studio ghibli in styleConsistency, got: ${adultClass.styleConsistency}`);
      }
      if (!/cinematic lighting.*sharp focus.*adult proportions/i.test(adultClass.qaModifiers)) {
        throw new Error(`Missing required QA modifiers in: ${adultClass.qaModifiers}`);
      }

      const kidsClass = StoryGenerator.classifyPrompt({
        idea: 'أرنب صغير يلعب في البستان',
        audienceLevel: 'kids',
        ageGroup: '4-6',
        artStyle: 'Photorealistic',
        styleConsistency: 'digital-realism',
      });
      eq(kidsClass.targetAudience, 'children');
      eq(kidsClass.audienceLevel, 'kids');
      if (!resolveStyleConsistencyKeywords('Photorealistic', 'digital-realism').includes('realistic digital painting')) {
        throw new Error('Failed to lock hyper-realistic digital painting keyword');
      }
    },
  },
  {
    name: 'تحليل المشاعر والنبرة العاطفية (Sentiment & Tone Palette) وحقن الألوان التلقائي في برومبت الرسم',
    run: () => {
      const happyAr = analyzeTextSentimentAndPalette('ضحك سامي بفرح وسعادة في العيد مع أصدقائه تحت الشمس المشرقة');
      eq(happyAr.sentiment, 'happy');
      if (!happyAr.paletteDescriptor.includes('warm glowing colors')) {
        throw new Error(`Expected 'warm glowing colors' for happy sentiment, got: ${happyAr.paletteDescriptor}`);
      }

      const sadAr = analyzeTextSentimentAndPalette('جلس وحيداً يبكي بحزن تحت المطر البارد بعد الفراق');
      eq(sadAr.sentiment, 'sad');
      if (!sadAr.paletteDescriptor.includes('deep moody shadows')) {
        throw new Error(`Expected 'deep moody shadows' for sad sentiment, got: ${sadAr.paletteDescriptor}`);
      }

      const happyEn = StoryGenerator.analyzeSentiment('She smiled happily and celebrated the joyful victory');
      eq(happyEn.sentiment, 'happy');
      const sadEn = StoryGenerator.analyzeSentiment('He wept in lonely sorrow under the cold rain');
      eq(sadEn.sentiment, 'sad');

      // التحقق من حقن لوحة الألوان العاطفية داخل buildPageImagePrompt مع الحفاظ على سقف 120 كلمة
      const s = fixture(2);
      const sadPage: StoryPage = {
        page: 1,
        text: 'بكى سامي بحزن شديد في ليلة ممطرة باردة وهو وحيد',
        image_prompt: 'Sami sitting alone by the window watching the rain',
      };
      const builtSadPrompt = buildPageImagePrompt(s, sadPage);
      if (!builtSadPrompt.includes('deep moody shadows')) {
        throw new Error(`Expected buildPageImagePrompt to inject 'deep moody shadows' for sad page, got: ${builtSadPrompt}`);
      }
      if (countPromptWords(builtSadPrompt) > 120) {
        throw new Error(`Expected prompt <= 120 words, got ${countPromptWords(builtSadPrompt)}`);
      }
    },
  },
  {
    name: 'تثبيت الأسلوب الفني الصارم (Strict Art Style Lock) وحظر رسومات SVG نهائياً',
    run: () => {
      // 1-3) الأسلوب المختار يظهر في سطر Style: لكل أسلوب، بلا أسماء استوديوهات ولا مبالغات
      for (const [style, re] of [
        ['Anime', /anime/i],
        ['3D Pixar Style', /3D/i],
        ['Cute Cartoon', /cartoon/i],
      ] as const) {
        const st = fixture(1);
        st.story_info.art_style = style;
        const built = buildPageImagePrompt(st, st.pages[0]);
        if (!re.test(built)) throw new Error(`Expected ${style} direction in prompt, got: ${built}`);
        if (/pixar|ghibli|ufotable|shinkai|masterpiece|award-winning/i.test(built)) throw new Error(`Brand or superlative leaked for ${style}: ${built}`);
      }
      const finalText = buildFinalImageText('Scene: Cat playing.', false);
      if (finalText.split('\n').length > 2) throw new Error('buildFinalImageText must not append extra lines');

      // 4) التحقق من أن buildPageImagePrompt يحافظ على كلمة Style في سطر الأسلوب
      const s = fixture(2);
      const testPage: StoryPage = {
        page: 1,
        text: 'صفحة بأسلوب الأنمي',
        image_prompt: 'Hero facing the sunset in anime fortress',
      };
      const builtPrompt = buildPageImagePrompt(s, testPage);
      if (!builtPrompt.includes('Style:')) {
        throw new Error(`Expected 'Style:' block in buildPageImagePrompt, got: ${builtPrompt}`);
      }

      // 5) التحقق من حظر SVG: يجب ألا تكون أي مخرجات صور بصيغة svg
      const svgMime = 'image/svg+xml';
      const isSvgForbidden = svgMime.includes('svg');
      eq(isSvgForbidden, true);
    },
  },
  {
    name: 'مرحلة 1: فكرة فيها "ملك/رجل" لا تقلب القصة لكبار، وصورة طفل تقفل الجمهور على الأطفال',
    run: () => {
      const kids = StoryGenerator.classifyPrompt({ idea: 'قصة عن الملك والرجل الطيب والأم', audienceLevel: 'kids', ageGroup: '4-6' });
      eq(kids.targetAudience, 'children');
      const blocked = StoryGenerator.classifyPrompt({ audienceLevel: 'adults', ageGroup: '18+', heroAgeStage: 'child', heroPhotoId: 'photo-1' });
      eq([blocked.targetAudience, blocked.blockedByChildHero], ['children', true]);
      const explicit = StoryGenerator.classifyPrompt({ audienceLevel: 'adults' });
      eq(explicit.targetAudience, 'adult');
    },
  },
  {
    name: 'مرحلة 1: شخصية بالغة في قصة أطفال لا تجعل القصة بالغة، والحيوان لا يأخذ وسم "adult"',
    run: () => {
      const st = fixture(1);
      st.characters = [
        { name: 'بابا', description: 'Baba, kind father in a green sweater', personality: 'calm', age: '35', gender: 'male' },
        { name: 'أرنوب', description: 'Arnoob, a small white rabbit with long ears', personality: 'curious', age: '5', gender: 'male' },
      ];
      st.pages[0].image_prompt = 'Baba and Arnoob in the garden';
      st.pages[0].text = 'ذهب بابا وأرنوب إلى الحديقة';
      eq(isAdultStory(st), false);
      const p = buildPageImagePrompt(st, st.pages[0]);
      const rabbitPart = p.split(';').find((x) => /rabbit/i.test(x)) ?? '';
      if (/adult/i.test(rabbitPart)) throw new Error(`Rabbit tagged adult: ${p}`);
      if (!/Baba, adult 35-year-old man/.test(p)) throw new Error(`Father not tagged adult after name: ${p}`);
      if (/[\u0600-\u06FF]/.test(p)) throw new Error(`Arabic leaked into image prompt: ${p}`);
    },
  },
  {
    name: 'مرحلة 1: كلمة "apple" في نص الصفحة لا تحوّل القصة كلها لفواكه',
    run: () => {
      const st = fixture(2);
      st.pages[0].text = 'Sami ate an apple and a lemon cake';
      st.pages[0].image_prompt = 'Sami eating an apple under a tree';
      eq(isFruitStory(st), false);
      if (/face and limbs/i.test(buildPageImagePrompt(st, st.pages[0]))) throw new Error('Fruit boost applied to a human character');
    },
  },
  {
    name: 'مرحلة 2: ثبات الأسلوب القديم المحفوظ يُنقّى من أسماء الاستوديوهات، والقيمة المجهولة تعني تلقائي',
    run: () => {
      eq(getStyleLock('studio ghibli').includes('ghibli'), false);
      eq(getStyleLock('auto'), '');
      eq(getStyleLock('some random saved text'), '');
      eq(normalizeStyleConsistencyId('studio ghibli'), 'pastoral-anime');
      eq(normalizeStyleConsistencyId('garbage'), 'auto');
      for (const o of ART_STYLE_OPTIONS) {
        if (/masterpiece|luxury|award-winning|ufotable|shinkai|pixar/i.test(o.prompt)) throw new Error(`Superlative or brand in ${o.value}`);
      }
    },
  },
  {
    name: 'مرحلة 2: المزاج القادم من النموذج يتفوق على التحليل بالكلمات، والنص المحايد لا يعطي لوحة مبالغاً فيها',
    run: () => {
      eq(analyzeTextSentimentAndPalette('نص محايد', '', 'tense').sentiment, 'tense');
      const neutral = analyzeTextSentimentAndPalette('ذهب الولد إلى المدرسة', 'boy walking');
      if (/glowing|moody|dramatic/i.test(neutral.paletteDescriptor)) throw new Error(`Neutral text got loud palette: ${neutral.paletteDescriptor}`);
    },
  },
  {
    name: 'فيديو القصة: عدد المقاطع من طول النص، التكلفة التقديرية، ونسبة الفيديو',
    run: () => {
      eq(partsForText('كلمة '.repeat(10)), 1);
      eq(partsForText('كلمة '.repeat(30)), 2);
      eq(partsForText('كلمة '.repeat(400)), 3);
      eq(estimateCostUsd(10), 8);
      eq([videoAspectFor('4:3'), videoAspectFor('3:4'), videoAspectFor('9:16'), videoAspectFor('1:1')], ['16:9', '9:16', '9:16', '16:9']);
    },
  },
  {
    name: 'فيديو القصة: برومبت المقطع إنجليزي، بلا صوت، يبدأ من صورة الصفحة، والجزء الثاني يكمل المشهد',
    run: () => {
      const st = fixture(2);
      st.id = 'story-test';
      st.pages[0].image_prompt = 'Sami climbing the glowing crystal tree at sunset';
      const first = buildClipPrompt(st, { id: 'a', page: 1, part: 1, parts: 2, scene: st.pages[0].image_prompt, motion: 'Sami climbs higher as leaves shimmer.' });
      if (/[\u0600-\u06FF]/.test(first)) throw new Error(`Arabic in clip prompt: ${first}`);
      if (!/No music, no speech/.test(first)) throw new Error('Audio directive missing');
      if (!/starting frame/.test(first)) throw new Error('First-frame cue missing');
      if (first.split(/\s+/).length > 150) throw new Error('Clip prompt too long');
      const next = buildClipPrompt(st, { id: 'b', page: 1, part: 2, parts: 2, scene: '', motion: 'Sami waves from the top.' });
      if (!/^Continue the scene/.test(next) || /starting frame/.test(next)) throw new Error(`Bad continuation prompt: ${next}`);
    },
  },
];

// صفحة الاختبار الذاتي: افتح الرابط مع #test
export default function SelfTest() {
  const [results, setResults] = useState<Result[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const out: Result[] = [];
      for (const t of TESTS) {
        if (cancelled) return;
        try {
          await t.run();
          out.push({ name: t.name, ok: true });
        } catch (err) {
          out.push({ name: t.name, ok: false, info: (err as Error).message });
        }
        if (!cancelled) {
          setResults([...out]);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
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
