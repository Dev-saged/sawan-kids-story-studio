import express, { type Request, type Response } from 'express';
import fs from 'fs';
import crypto from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Modality, Type, type Schema } from '@google/genai';
import {
  NO_SIZE_IMAGE_MODELS,
  POSITIVE_ILLUSTRATION_DIRECTIVE,
  SHARED_ART_STYLE_OPTIONS,
  STORY_TYPE_SPECS,
  buildSharedSystemInstruction,
} from './src/shared/modelRules.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json({ limit: '30mb' }));

// سلاسل النماذج الفعلية المعتمدة: كل نموذج له حصة مستقلة (RPD / TPM)
const MODELS = {
  text: [
    'gemini-3-flash-preview',
    'gemini-3.8-flash',
    'gemini-2.5-flash',
    'gemini-3.1-flash-lite-preview',
    'gemini-2.5-flash-lite',
    'gemini-3.1-pro-preview',
    'gemini-2.5-pro',
    'gemini-flash-latest',
    'gemini-flash-lite-latest',
  ],
  image: [
    'gemini-2.5-flash-image',
    'gemini-3.1-flash-image-preview',
    'gemini-3.1-flash-lite-image',
    'gemini-nano-banana-2.1',
    'gemini-3-pro-image-preview',
    'gemini-3-pro-image',
  ],
  tts: [
    'gemini-2.5-flash-preview-tts',
    'gemini-2.5-pro-preview-tts',
  ],
  music: ['lyria-3-clip-preview'],
};
const VOICES = new Set(['Sulafat', 'Vindemiatrix', 'Achernar', 'Algieba', 'Charon', 'Puck', 'Kore', 'Leda']);
const ASPECTS = new Set(['1:1', '16:9', '9:16', '4:3', '3:4']);
// أي صيغة مفتاح (AIza… / AQ.… / مستقبلية): نمنع المسافات فقط، وجوجل تحكم بالصلاحية
const KEY_PATTERN = /^\S{16,300}$/;

const getEnvApiKey = (): string => {
  let key = process.env.GEMINI_API_KEY;
  if (!key || key === 'MY_GEMINI_API_KEY' || key.trim() === '') {
    const candidatePaths = [
      '/app/.dev.env.json',
      path.resolve(__dirname, '../.dev.env.json'),
      path.resolve(process.cwd(), '../.dev.env.json'),
      path.resolve(process.cwd(), '.dev.env.json'),
    ];
    for (const p of candidatePaths) {
      try {
        if (fs.existsSync(p)) {
          const content = JSON.parse(fs.readFileSync(p, 'utf-8'));
          if (content.GEMINI_API_KEY && content.GEMINI_API_KEY !== 'MY_GEMINI_API_KEY') {
            key = content.GEMINI_API_KEY;
            break;
          }
        }
      } catch {
        // continue
      }
    }
  }

  if ((!key || key === 'MY_GEMINI_API_KEY') && process.env.VITE_GEMINI_API_KEY && !process.env.VITE_GEMINI_API_KEY.includes('your_gemini')) {
    key = process.env.VITE_GEMINI_API_KEY;
  }

  if (!key || key === 'MY_GEMINI_API_KEY') {
    throw Object.assign(new Error('GEMINI_API_KEY is not configured on the server.'), { status: 401, code: 'NOKEY' });
  }

  return key.trim();
};

interface Session {
  ai: GoogleGenAI;
  fp: string;
  source: 'user' | 'env';
}

const sessions = new Map<string, Session>();

const makeSession = (apiKey: string, source: 'user' | 'env'): Session => {
  const fp = crypto.createHash('sha1').update(apiKey).digest('hex').slice(0, 12);
  let session = sessions.get(fp);
  if (!session) {
    if (sessions.size > 50) sessions.clear();
    session = { ai: new GoogleGenAI({ apiKey, httpOptions: { headers: { 'User-Agent': 'aistudio-build' } } }), fp, source };
    sessions.set(fp, session);
  }
  return session;
};

// مفتاح الزائر له الأولوية؛ إن أرسل مفتاحاً بصيغة خاطئة نرفضه صراحةً بدل الرجوع الصامت لمفتاح البيئة
const getSession = (req: Request): Session => {
  const header = req.get('x-goog-api-key')?.trim();
  if (header && !KEY_PATTERN.test(header)) throw Object.assign(new Error('API key format is invalid.'), { status: 401 });
  const apiKey = header || getEnvApiKey();
  return makeSession(apiKey, header ? 'user' : 'env');
};

// إرجاع جلسة الزائر متبوعة بجلسة الخادم (إن وُجدت وكانت مختلفة) للتبديل التلقائي عند نفاد الكوتا
const getCandidateSessions = (req: Request): Session[] => {
  const list: Session[] = [];
  const header = req.get('x-goog-api-key')?.trim();
  if (header) {
    if (!KEY_PATTERN.test(header)) throw Object.assign(new Error('API key format is invalid.'), { status: 401 });
    list.push(makeSession(header, 'user'));
  }
  try {
    const envKey = getEnvApiKey();
    if (!header || envKey !== header) {
      list.push(makeSession(envKey, 'env'));
    }
  } catch {
    // لا يوجد مفتاح بيئة احتياطي
  }
  if (!list.length) {
    throw Object.assign(new Error('GEMINI_API_KEY is not configured on the server.'), { status: 401, code: 'NOKEY' });
  }
  return list;
};

const getAiClient = (req: Request): GoogleGenAI => getSession(req).ai;

type ErrorKind = 'auth' | 'quota' | 'busy' | 'missing' | 'skip';
type ErrorCode = 'AUTH' | 'NOKEY' | 'QUOTA' | 'BILLING' | 'NOMODEL' | 'BUSY' | 'FAILED' | 'FREE_AUTH' | 'FREE_QUOTA';

interface TrailItem {
  model: string;
  kind: ErrorKind;
  status: number;
  message: string;
  zero?: boolean;
}

const classify = (err: any): ErrorKind => {
  const status = Number(err?.status ?? err?.code ?? 0);
  const msg = String(err?.message ?? '');
  if (/API_KEY_INVALID|API key not valid|API key format/i.test(msg) || status === 401) return 'auth';
  if (/PERMISSION_DENIED|permission denied/i.test(msg) || status === 403) return 'missing';
  if (status === 429 || /RESOURCE_EXHAUSTED|quota|rate limit|limit of requests|token limit/i.test(msg)) return 'quota';
  if (status === 404 || /NOT_FOUND|is not found|not supported for/i.test(msg)) return 'missing';
  if (status >= 500 || /UNAVAILABLE|overloaded|ECONNRESET|ETIMEDOUT|fetch failed|Failed to call the Gemini API/i.test(msg)) return 'busy';
  return 'skip';
};

// حصة صفرية = النموذج غير مشمول بالخطة المجانية (limit: 0 صراحةً)، وليست حصة مؤقتة
const isZeroQuota = (msg: string) => /limit:\s*0\b/i.test(msg);

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// الفحص على الرسالة الكاملة قبل القص: عبارة limit: 0 أو daily limit تأتي في الرسالة
const isDailyQuota = (msg: string) =>
  /daily limit|limit:\s*0\b|requests today|limit of requests|tomorrow|select a different model/i.test(msg);

// كوتا الدقيقة (RPM / TPM): الانتقال الفوري للنموذج التالي أفضل من الانتظار وتكرار الضرب على نفس النموذج
const isMinuteQuota = (msg: string) =>
  /per minute|in a few minutes|token limit|rate limit|RESOURCE_EXHAUSTED|quota/i.test(msg);

// ذاكرة تبريد لكل (مفتاح + نموذج) لمنع ضرب النماذج المستنفدة في كل طلب جديد
const modelCooldowns = new Map<string, number>();
const DAILY_COOLDOWN_MS = 30 * 60 * 1000; // 30 دقيقة للحد اليومي أو النموذج غير المدعوم
const MINUTE_COOLDOWN_MS = 75 * 1000; // 75 ثانية لكوتا الدقيقة (TPM / RPM)
const BUSY_COOLDOWN_MS = 15 * 1000; // 15 ثانية عند فشل البوابة المؤقت

const isModelCooledDown = (fp: string, model: string): boolean => {
  const until = modelCooldowns.get(`${fp}:${model}`) ?? 0;
  if (until <= Date.now()) {
    if (until > 0) modelCooldowns.delete(`${fp}:${model}`);
    return false;
  }
  return true;
};

const markModelCooldown = (fp: string, model: string, ms: number): void => {
  modelCooldowns.set(`${fp}:${model}`, Date.now() + ms);
};

const trailItem = (model: string, err: any): TrailItem => {
  const full = String(err?.message ?? err).replace(/\s+/g, ' ');
  return { model, kind: classify(err), status: Number(err?.status ?? err?.code ?? 0) || 0, message: full.slice(0, 480), zero: isZeroQuota(full) };
};

// يحدد الرمز الأدق للمستخدم من سجل محاولات كل النماذج (BILLING خاص بالصور فقط حتى لا يظهر خطأ الصور في الصوت أو النص)
const failure = (label: string, trail: TrailItem[], last: any): Error => {
  const quota = trail.filter((t) => t.kind === 'quota');
  let code: ErrorCode = 'FAILED';
  if (quota.length) code = label === 'image' && quota.every((t) => t.zero) ? 'BILLING' : 'QUOTA';
  else if (trail.length && trail.every((t) => t.kind === 'missing')) code = 'NOMODEL';
  else if (trail.some((t) => t.kind === 'busy')) code = 'BUSY';
  return Object.assign(last instanceof Error ? last : new Error(`${label}: no model returned output`), { code, trail });
};

// يجرب كل نموذج متاح بالترتيب مع احترام ذاكرة التبريد؛ ينتقل فوراً للنموذج التالي عند الكوتا اليومية أو كوتا الدقيقة
async function runChain<T>(
  label: string,
  models: string[],
  attempt: (model: string, ai: GoogleGenAI) => Promise<T | null>,
  req?: Request
): Promise<{ value: T; model: string }> {
  const candidateSessions = req ? getCandidateSessions(req) : [];
  const sessionsToTry = candidateSessions.length ? candidateSessions : [null];
  let lastError: any = null;
  const trail: TrailItem[] = [];

  for (const sess of sessionsToTry) {
    const fp = sess?.fp ?? 'default';
    const ai = sess?.ai as GoogleGenAI;

    // النماذج غير المبرّدة أولاً، ثم المبرّدة كمحاولة أخيرة إن كانت كلها في فترة تبريد مؤقتة
    const readyModels = models.filter((m) => !isModelCooledDown(fp, m));
    const orderedModels = readyModels.length > 0 ? readyModels : models;

    for (const model of orderedModels) {
      for (let i = 0; i < 2; i++) {
        try {
          const value = await attempt(model, ai);
          if (value != null) {
            modelCooldowns.delete(`${fp}:${model}`);
            return { value, model };
          }
          trail.push({ model, kind: 'skip', status: 0, message: 'Model returned no output.' });
          break;
        } catch (err: any) {
          lastError = err;
          const item = trailItem(model, err);
          if (item.kind === 'auth') {
            // إذا كان هناك مفتاح بيئة احتياطي بعد مفتاح الزائر، ننتقل إليه بدل الإيقاف الفوري
            if (sessionsToTry.length > 1 && sess?.source === 'user') {
              trail.push(item);
              break;
            }
            throw Object.assign(err instanceof Error ? err : new Error(item.message), { code: 'AUTH', trail: [...trail, item] });
          }

          if (item.kind === 'missing') {
            markModelCooldown(fp, model, DAILY_COOLDOWN_MS);
            trail.push(item);
            break;
          }

          // حصة يومية أو صفرية: تبريد 30 دقيقة وانتقال فوري للنموذج التالي
          if (item.kind === 'quota' && isDailyQuota(item.message)) {
            markModelCooldown(fp, model, DAILY_COOLDOWN_MS);
            trail.push(item);
            break;
          }

          // كوتا الدقيقة (TPM / RPM): تبريد 75 ثانية وانتقال فوري للنموذج التالي بدل تكرار الطلب على نفس النموذج
          if (item.kind === 'quota' && isMinuteQuota(item.message)) {
            markModelCooldown(fp, model, MINUTE_COOLDOWN_MS);
            trail.push(item);
            break;
          }

          // خطأ بوابة مؤقت (500 / انشغال): نعيد المحاولة مرة واحدة على نفس النموذج أولاً (مهم جداً لثبات صوت الراوي في TTS) ثم ننتقل للنموذج التالي
          if (item.kind === 'busy' || item.kind === 'skip') {
            if (item.kind === 'busy' && i < 1) {
              await sleep(900 + Math.random() * 300);
              continue;
            }
            markModelCooldown(fp, model, BUSY_COOLDOWN_MS);
            if (orderedModels.length > 1) {
              trail.push(item);
              break;
            }
          }

          trail.push(item);
          break;
        }
      }
      // إذا فشل مفتاح الزائر بـ AUTH نخرج لتجربة مفتاح الخادم
      if (trail.length && trail[trail.length - 1].kind === 'auth' && sess?.source === 'user') {
        break;
      }
    }
  }
  throw failure(label, trail, lastError);
}

const errorInfo = (err: any, fallback: string): { status: number; body: { error: string; code: ErrorCode; trail?: TrailItem[] } } => {
  const kind = classify(err);
  const code: ErrorCode = err?.code && typeof err.code === 'string' ? err.code : kind === 'auth' ? 'AUTH' : kind === 'quota' ? 'QUOTA' : kind === 'busy' ? 'BUSY' : 'FAILED';
  const status = code === 'AUTH' || code === 'NOKEY' || code === 'FREE_AUTH' ? 401 : code === 'QUOTA' || code === 'BILLING' || code === 'FREE_QUOTA' ? 429 : code === 'BUSY' ? 503 : code === 'NOMODEL' ? 404 : 500;
  // نحتفظ برسالة Google الأصلية كما هي في حقل error لتظهر بدقة في «تفاصيل تقنية»
  const rawMsg = String(err?.message || fallback).trim();
  return { status, body: { error: rawMsg, code, trail: Array.isArray(err?.trail) ? err.trail : undefined } };
};

const sendError = (res: Response, err: any, fallback: string) => {
  const { status, body } = errorInfo(err, fallback);
  if (!res.headersSent) res.status(status).json(body);
};

// ===== اكتشاف النماذج المتاحة فعلاً لهذا المفتاح (يتجاوز أي اسم غير صحيح في القوائم) =====
type ChainKind = keyof typeof MODELS;

interface Catalog {
  names: Set<string>;
  at: number;
}

const catalogs = new Map<string, Catalog>();
const CATALOG_TTL = 10 * 60 * 1000;

const withTimeout = <T,>(p: Promise<T>, ms: number): Promise<T> =>
  Promise.race([p, new Promise<T>((_, rej) => setTimeout(() => rej(new Error('timeout')), ms))]);

const getCatalog = async (session: Session): Promise<Catalog> => {
  const hit = catalogs.get(session.fp);
  if (hit && Date.now() - hit.at < CATALOG_TTL) return hit;
  const names = new Set<string>();
  try {
    await withTimeout(
      (async () => {
        const pager = await session.ai.models.list({ config: { pageSize: 200 } });
        for await (const m of pager) if (m.name) names.add(m.name.replace(/^models\//, ''));
      })(),
      9000
    );
  } catch (err: any) {
    // مفتاح مرفوض صراحةً = خطأ حقيقي؛ غير ذلك (انقطاع، قيود) نتجاهله ونكمل بالقوائم الثابتة
    if (/API_KEY_INVALID|API key not valid/i.test(String(err?.message))) throw Object.assign(err, { code: 'AUTH' });
  }
  const catalog = { names, at: Date.now() };
  catalogs.set(session.fp, catalog);
  return catalog;
};

const DISCOVER: Record<ChainKind, RegExp> = {
  text: /^gemini-\d+(\.\d+)?-(flash|flash-lite|pro)(-preview|-latest)?$/,
  image: /^gemini[\w.-]*image[\w.-]*$/,
  tts: /^gemini[\w.-]*tts[\w.-]*$/,
  music: /^lyria[\w.-]*$/,
};

const versionOf = (name: string) => Number(/(\d+(?:\.\d+)?)/.exec(name)?.[1]) || 0;

// المتاح أولاً بترتيب القوة، ثم نماذج مكتشفة غير موجودة في القائمة، ثم غير المدرج (احتياط)
const chainFor = async (req: Request, kind: ChainKind): Promise<string[]> => {
  const base = MODELS[kind];
  const catalog = await getCatalog(getSession(req));
  if (!catalog.names.size) return base;
  const listed = base.filter((m) => catalog.names.has(m));
  const found = [...catalog.names].filter((n) => DISCOVER[kind].test(n) && !base.includes(n)).sort((a, b) => versionOf(b) - versionOf(a));
  const unlisted = base.filter((m) => !catalog.names.has(m));
  return [...listed, ...found, ...unlisted];
};

app.get('/api/preflight', async (req: Request, res: Response) => {
  try {
    const session = getSession(req);
    const catalog = await getCatalog(session);
    const available = (kind: ChainKind) => {
      const base = MODELS[kind].filter((m) => catalog.names.has(m));
      const found = [...catalog.names].filter((n) => DISCOVER[kind].test(n) && !base.includes(n));
      return [...base, ...found];
    };
    const textModels = available('text');
    const ttsModels = available('tts');
    return res.json({
      ok: true,
      keySource: session.source,
      listed: catalog.names.size > 0,
      free: { configured: Boolean(getFreeCreds(req)) },
      models: {
        text: textModels.length ? textModels : MODELS.text,
        image: available('image'),
        tts: ttsModels.length ? ttsModels : MODELS.tts,
        music: available('music'),
      },
    });
  } catch (err) {
    return sendError(res, err, 'Preflight failed');
  }
});

const SYSTEM_INSTRUCTION = buildSharedSystemInstruction();

const STORY_RESPONSE_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    story_info: {
      type: Type.OBJECT,
      properties: {
        title: { type: Type.STRING },
        language: { type: Type.STRING },
        age_group: { type: Type.STRING },
        art_style: { type: Type.STRING },
        lessons: { type: Type.ARRAY, items: { type: Type.STRING } },
        moral: { type: Type.STRING },
      },
      required: ['title', 'language', 'age_group', 'art_style', 'lessons', 'moral'],
    },
    characters: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING },
          description: { type: Type.STRING },
          personality: { type: Type.STRING },
          age: { type: Type.STRING },
          gender: { type: Type.STRING },
        },
        required: ['name', 'description', 'personality', 'age', 'gender'],
      },
    },
    cover_image_prompt: { type: Type.STRING },
    music_prompt: { type: Type.STRING },
    pages: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          page: { type: Type.NUMBER },
          text: { type: Type.STRING },
          narration: { type: Type.STRING },
          image_prompt: { type: Type.STRING },
          chapter: { type: Type.STRING },
        },
        required: ['page', 'text', 'narration', 'image_prompt'],
      },
    },
    quiz: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          question: { type: Type.STRING },
          options: { type: Type.ARRAY, items: { type: Type.STRING } },
          answer: { type: Type.NUMBER },
          page: { type: Type.NUMBER },
        },
        required: ['question', 'options', 'answer', 'page'],
      },
    },
  },
  required: ['story_info', 'characters', 'cover_image_prompt', 'music_prompt', 'pages', 'quiz'],
};

const NAME_ANALYSIS_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    meaning: { type: Type.STRING },
    origin: { type: Type.STRING },
    traits: { type: Type.ARRAY, items: { type: Type.STRING } },
  },
  required: ['meaning', 'origin', 'traits'],
};

const clip = (v: unknown, max: number): string => String(v ?? '').trim().slice(0, max);

const parseJson = (raw: string): any => {
  try {
    return JSON.parse(raw);
  } catch {
    const cleaned = raw.replace(/```json|```/g, '').trim();
    const firstBrace = cleaned.indexOf('{');
    const lastBrace = cleaned.lastIndexOf('}');
    if (firstBrace >= 0 && lastBrace > firstBrace) {
      return JSON.parse(cleaned.slice(firstBrace, lastBrace + 1));
    }
    return JSON.parse(cleaned);
  }
};

// محرك نصي احتياطي مجاني عند استنفاد كافة حصص Gemini اليومية أو المؤقتة
const runFreeTextJson = async (systemPrompt: string, userPrompt: string): Promise<any | null> => {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 28_000);
  try {
    const res = await fetch('https://text.pollinations.ai/openai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: ctrl.signal,
      body: JSON.stringify({
        model: 'openai',
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: `${systemPrompt}\nAlways respond with valid JSON only.` },
          { role: 'user', content: `${userPrompt}\nReturn valid JSON only.` },
        ],
      }),
    });
    if (!res.ok) return null;
    const data: any = await res.json();
    const content = data?.choices?.[0]?.message?.content;
    if (typeof content === 'string' && content.trim()) {
      return parseJson(content);
    }
    return null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
};

// باني قصة محلي منظم يعمل كشبكة أمان أخيرة إذا استنفدت كل نماذج Gemini وتعذر الوصول للمحرك النصي البديل
const buildFallbackStory = (params: any, pageCount: number) => {
  const isArabic = params?.language === 'Arabic';
  const idea = clip(params?.idea, 240) || (isArabic ? 'رحلة شيقة في عالم الخيال' : 'An exciting journey in a world of wonder');
  const heroName = clip(params?.heroName, 40) || (Array.isArray(params?.customCharacters) && params.customCharacters[0]?.name ? clip(params.customCharacters[0].name, 40) : isArabic ? 'سراج' : 'Sami');
  const artStyle = clip(params?.artStyle, 40) || 'Classic Storybook';
  const ageGroup = clip(params?.ageGroup, 10) || '4-6';
  const isAdult = ageGroup === '18+' || Boolean(params?.adultMode) || params?.heroAgeStage === 'adult';
  const title = isArabic ? `مغامرة ${heroName}` : `${heroName}'s Adventure`;

  const customChars = Array.isArray(params?.customCharacters) && params.customCharacters.length > 0
    ? params.customCharacters.slice(0, 3).map((c: any) => ({
        name: clip(c?.name, 40) || heroName,
        description:
          clip(c?.description, 200) ||
          (isAdult
            ? 'A charismatic adult protagonist with expressive eyes, refined features, and a tailored cinematic coat'
            : 'A cheerful young hero wearing a bright adventure outfit and warm smile'),
        personality: clip(c?.personality, 80) || (isArabic ? 'شجاع ومحب للاستطلاع' : 'Brave and curious'),
        age: clip(c?.age, 15) || (isAdult ? '28' : '7'),
        gender: clip(c?.gender, 15) || (isAdult ? 'man' : 'boy'),
      }))
    : [
        {
          name: heroName,
          description: params?.fruitFantasy
            ? `${heroName} is a cute pomegranate character with a face and limbs, wearing a tiny explorer cape`
            : isAdult
              ? `An adult protagonist named ${heroName}, 28 years old, with confident eyes, defined facial features, and a stylish dark navy coat`
              : `A cheerful child named ${heroName} with bright expressive eyes and a cozy adventure jacket`,
          personality: isArabic ? 'شجاع وفضولي ويحب مساعدة الآخرين' : 'Brave, curious, and kind-hearted',
          age: isAdult ? '28' : '7',
          gender: isAdult ? 'man' : 'boy',
        },
      ];

  const scenesEn = [
    `${heroName} standing in a sunlit meadow looking at a glowing path ahead, curious expression`,
    `${heroName} discovering a friendly little bird beside an ancient lantern under a blossoming tree`,
    `${heroName} crossing a wooden bridge over a sparkling stream while golden fireflies light the way`,
    `${heroName} solving a gentle puzzle carved on a mossy stone with a joyful smile`,
    `${heroName} sharing warm berry tea with woodland friends around a cozy glowing lantern`,
    `${heroName} looking up at a starry twilight sky with a proud and peaceful smile, returning home`,
  ];

  const pages = Array.from({ length: pageCount }, (_, i) => {
    const idx = i + 1;
    const scene = scenesEn[i % scenesEn.length];
    const arTexts = [
      `في صباح مشرق، انطلق ${heroName} لاستكشاف فكرة جديدة مستوحاة من: ${idea}. كانت النسائم اللطيفة تهمس له بأن مغامرة جميلة على وشك أن تبدأ.`,
      `في الطريق، لمح ${heroName} ضوءاً دافئاً يلمع بين الأشجار، فاقترب بخطوات واثقة وقلب مليء بالحماس والفضول.`,
      `واجه ${heroName} تحدياً صغيراً يحتاج إلى تفكير هادئ، فتذكر أن الصبر والتعاون هما مفتاح كل حل ذكي.`,
      `بفضل شجاعته، نجح ${heroName} في فتح المسار المضيء، وابتسم حين رأى جمال المكان من حوله.`,
      `احتفل الأصدقاء مع ${heroName} بهذا الإنجاز الجميل، وتبادلوا الضحكات والحكايات الدافئة.`,
      `ومع حلول المساء، عاد ${heroName} وقلبه عامر بالسعادة بعد أن تعلم درساً لا يُنسى في هذه الرحلة.`,
    ];
    const enTexts = [
      `On a bright morning, ${heroName} set out on a wonderful journey inspired by: ${idea}. A gentle breeze whispered that an unforgettable adventure was beginning.`,
      `Along the path, ${heroName} spotted a warm golden light shimmering through the trees and stepped forward with curiosity.`,
      `Soon, ${heroName} faced a small puzzle that required calm thinking, remembering that patience and kindness open every door.`,
      `With courage and a bright smile, ${heroName} unlocked the glowing path and marveled at the beauty all around.`,
      `Friends gathered around ${heroName} to celebrate the discovery, sharing warm laughter and cheerful songs.`,
      `As twilight stars appeared, ${heroName} returned home with a happy heart and a wonderful new memory.`,
    ];
    const text = isArabic ? arTexts[i % arTexts.length] : enTexts[i % enTexts.length];
    return {
      page: idx,
      text,
      narration: text,
      image_prompt: scene,
      ...(idx === 1 ? { chapter: isArabic ? 'الفصل الأول' : 'Chapter 1' } : {}),
    };
  });

  return {
    story_info: {
      title,
      language: isArabic ? 'Arabic' : 'English',
      age_group: ageGroup,
      art_style: artStyle,
      lessons: isArabic ? ['الشجاعة', 'الصبر', 'حب الاستطلاع'] : ['Courage', 'Patience', 'Curiosity'],
      moral: isArabic ? 'بالصبر والشجاعة تتحول الأفكار الصغيرة إلى مغامرات عظيمة.' : 'With patience and courage, small ideas turn into wonderful adventures.',
    },
    characters: customChars,
    cover_image_prompt: `${heroName} in a magical storybook scene, warm golden light, expressive children book cover`,
    music_prompt: 'Gentle acoustic storybook melody with warm harp and soft flute',
    pages,
    quiz: [
      {
        question: isArabic ? `من هو بطل هذه القصة؟` : `Who is the hero of this story?`,
        options: isArabic ? [heroName, 'الرحالة القديم', 'الطائر الصغير'] : [heroName, 'The Old Traveler', 'The Little Bird'],
        answer: 0,
        page: 1,
      },
      {
        question: isArabic ? `ما الذي ساعد ${heroName} على النجاح في رحلته؟` : `What helped ${heroName} succeed on the journey?`,
        options: isArabic ? ['الصبر والشجاعة', 'الاستعجال', 'النوم طويلاً'] : ['Patience and courage', 'Rushing ahead', 'Sleeping all day'],
        answer: 0,
        page: Math.min(3, pageCount),
      },
      {
        question: isArabic ? `كيف عاد ${heroName} في نهاية المغامرة؟` : `How did ${heroName} return at the end of the adventure?`,
        options: isArabic ? ['بقلب سعيد ودرس مفيد', 'غاضباً', 'حزيناً'] : ['With a happy heart and a good lesson', 'Angry', 'Sad'],
        answer: 0,
        page: pageCount,
      },
    ],
  };
};

// بث النص سطراً سطراً (NDJSON): chunk / reset / done / error
app.post('/api/generate-story', async (req: Request, res: Response) => {
  const { params, pageCount } = req.body ?? {};
  const first = Math.min(Math.max(Number(pageCount) || 6, 3), 16);
  const total = Math.min(Math.max(Number(req.body?.totalPages) || first, first), 60);
  const idea = clip(params?.idea, 500);
  if (!idea) return res.status(400).json({ error: 'Story idea cannot be empty.', code: 'FAILED' });

  try {
    getCandidateSessions(req);
  } catch (err) {
    return sendError(res, err, 'Missing API key');
  }

  const isArabic = params.language === 'Arabic';
  const heroName = clip(params.heroName, 40);
  const series = params.series;
  const seriesLines = series
    ? [
        `SERIES: this is part ${Math.min(Math.max(Number(series.partNumber) || 2, 2), 99)} of the series "${clip(series.seriesTitle, 80)}".`,
        `Previous part "${clip(series.previousTitle, 80)}" summary: ${clip(series.previousSummary, 1800)}`,
        `Write a NEW adventure that continues naturally. Keep EXACTLY these main characters, with identical names and visual design (copy their "description" unchanged in your "characters" output): ${(Array.isArray(series.characters) ? series.characters.slice(0, 4) : [])
          .map((c: any) => `${clip(c?.name, 40)}: ${clip(c?.description, 400)}`)
          .join(' | ')}. At most one new minor character may appear.`,
      ]
    : [];
  const storyTypeKey = (clip(params.storyType, 30) || 'Bedtime') as keyof typeof STORY_TYPE_SPECS;
  const typeSpec = STORY_TYPE_SPECS[storyTypeKey] ?? STORY_TYPE_SPECS.Bedtime;
  const ageGroupVal = clip(params.ageGroup, 10) || '4-6';
  const audienceLevelVal = clip(params.audienceLevel, 15) || (ageGroupVal === '18+' ? 'adults' : 'kids');
  const isAdult =
    audienceLevelVal === 'adults' ||
    ageGroupVal === '18+' ||
    Boolean(params.adultMode) ||
    params.heroAgeStage === 'adult' ||
    req.body?.classification?.targetAudience === 'adult';
  const heroStage = params.heroAgeStage === 'adult' || isAdult ? 'adult' : params.heroAgeStage === 'teen' || ageGroupVal === '13-18' ? 'teen' : 'child';
  const artStyleVal = clip(params.artStyle, 40) || 'Classic Storybook';
  const artStyleSpec = SHARED_ART_STYLE_OPTIONS.find((s) => s.value === artStyleVal)?.prompt || artStyleVal;
  const styleConsistencyVal = clip(params.styleConsistency || req.body?.classification?.styleConsistency, 200);
  const qaModifiersVal =
    clip(req.body?.classification?.qaModifiers, 200) ||
    (isAdult
      ? 'cinematic lighting, high-fidelity masterpiece, concept art style, detailed textures, mature adult proportions'
      : 'cinematic lighting, high-fidelity illustration, concept art style, detailed textures');
  const customChars = Array.isArray(params.customCharacters)
    ? params.customCharacters
        .slice(0, 4)
        .map((c: any) => `${clip(c?.name, 40)} (${clip(c?.gender, 15)}, age ${clip(c?.age, 15)}): ${clip(c?.description, 250)} — ${clip(c?.personality, 120)}`)
        .join(' | ')
    : '';
  const themeLine = params.fruitFantasy
    ? 'Character theme: main characters are cute anthropomorphic fruit characters with faces and limbs.'
    : params.themeTopic
      ? `Character theme context: weave "${clip(params.themeTopic, 80)}" traits into character descriptions.`
      : '';
  const maturityLine = isAdult
    ? 'AUDIENCE LEVEL: ADULTS (18+). Write with deep, engaging literary prose, complex character psychology, and mature themes suitable for adults. CRITICAL FOR ILLUSTRATIONS: Unless a character is explicitly defined as a child, ALL characters MUST be described in "characters" and in every "image_prompt" as full-grown ADULTS (e.g., "28-year-old adult man", "26-year-old adult woman", mature adult facial structure, adult body proportions, realistic adult attire) — NEVER default to children or kids.'
    : ageGroupVal === '13-18'
      ? 'AUDIENCE LEVEL: YOUNG ADULTS / TEENS (13-18). Depict characters with teen/young-adult proportions and expressive cinematic drama.'
      : 'AUDIENCE LEVEL: KIDS. Write warm, imaginative, age-appropriate prose and expressive storybook visuals.';
  const styleConsistencyLine = `STYLE CONSISTENCY & QUALITY ASSURANCE: Lock the visual theme strictly to [${styleConsistencyVal || artStyleSpec}] with mandatory quality modifiers [${qaModifiersVal}]. Never deviate from this artistic theme regardless of story content.`;
  const heroLine = heroName
    ? heroStage === 'adult'
      ? `HERO: the main protagonist is a real ADULT person named "${heroName}". Describe the hero in English as "${heroName}, an adult protagonist${params.hasHeroPhoto ? ' matching the reference photo' : ''}" with mature adult facial structure, realistic adult build, and a fixed signature outfit with specific colors.`
      : heroStage === 'teen'
        ? `HERO: the main protagonist is a teenager named "${heroName}". Describe the hero in English as "${heroName}, a teen protagonist${params.hasHeroPhoto ? ' matching the reference photo' : ''}" with a fixed signature outfit with specific colors.`
        : `HERO: the main character is a real child named "${heroName}". A reference photo of this child may be used for the illustrations, so describe the hero as "${heroName}, the child from the reference photo" plus a fixed outfit with colors.`
    : '';
  const prompt = [
    `Story idea: ${idea}`,
    isArabic ? `Language: Arabic (${clip(params.dialect, 30) || 'Modern Standard'})` : 'Language: English',
    `Audience level: ${isAdult ? 'Adults (18+)' : `Kids (${ageGroupVal})`}`,
    `Age group: ${isAdult ? '18+' : ageGroupVal}`,
    maturityLine,
    `Story type: ${typeSpec.value} — Narrative Arc: [Beginning: ${typeSpec.arc.beginning} | Middle: ${typeSpec.arc.middle} | Climax: ${typeSpec.arc.climax} | Ending: ${typeSpec.arc.ending}]. Rule: ${typeSpec.promptRule}`,
    `Exact page count: ${first}`,
    total > first
      ? `LONG STORY: the finished book will have ${total} pages in ${Math.ceil(total / 6)} chapters. Write ONLY the opening ${first} pages now (chapter 1 and its set-up). Do NOT conclude the story: end on a natural moment that leads into what comes next. Give page 1 a "chapter" title. The quiz and moral can be provisional.`
      : '',
    `Art style: ${artStyleVal} — Visual directive for every image_prompt and cover_image_prompt: ${artStyleSpec}. Ensure every page image_prompt vividly depicts the exact action, setting, and character emotions of that page in this style.`,
    styleConsistencyLine,
    themeLine,
    customChars
      ? `CUSTOM / ALBUM CHARACTERS (include these exact characters in "characters" with their exact names, ages, and visual traits translated to English): ${customChars}`
      : '',
    ...seriesLines,
    heroLine,
  ]
    .filter(Boolean)
    .join('\n');

  res.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('X-Accel-Buffering', 'no');
  const send = (obj: object) => res.write(`${JSON.stringify(obj)}\n`);

  try {
    const { value } = await runChain(
      'story',
      await chainFor(req, 'text'),
      async (model, ai) => {
        let raw = '';
        let started = false;
        try {
          const stream = await ai.models.generateContentStream({
            model,
            contents: prompt,
            config: { systemInstruction: SYSTEM_INSTRUCTION, responseMimeType: 'application/json', responseSchema: STORY_RESPONSE_SCHEMA },
          });
          for await (const chunk of stream) {
            const t = chunk.text ?? '';
            if (!t) continue;
            started = true;
            raw += t;
            send({ t: 'chunk', d: t });
          }
        } catch (err) {
          if (started) send({ t: 'reset' });
          throw err;
        }
        const parsed = parseJson(raw);
        if (!parsed?.pages?.length || !parsed?.characters?.length) {
          send({ t: 'reset' });
          return null;
        }
        return parsed;
      },
      req
    );
    send({ t: 'done', story: value });
  } catch (err: any) {
    const info = errorInfo(err, 'Failed to generate story');
    if (info.body.code !== 'AUTH' && info.body.code !== 'NOKEY') {
      send({ t: 'reset' });
      const fallbackJson = await runFreeTextJson(
        SYSTEM_INSTRUCTION,
        `${prompt}\nReturn JSON with keys: story_info {title, language, age_group, art_style, lessons[], moral}, characters [{name, description, personality, age, gender}], cover_image_prompt, music_prompt, pages [{page, text, narration, image_prompt}], quiz [{question, options[], answer, page}].`
      );
      if (fallbackJson?.pages?.length && fallbackJson?.characters?.length) {
        send({ t: 'done', story: fallbackJson });
        res.end();
        return;
      }
      const localStory = buildFallbackStory(params, first);
      send({ t: 'done', story: localStory });
      res.end();
      return;
    }
    send({ t: 'error', ...info.body });
  }
  res.end();
});

interface InlineRef {
  data: string;
  mimeType: string;
}

const sanitizeRefs = (refs: unknown): InlineRef[] =>
  (Array.isArray(refs) ? refs : [])
    .filter((r: any) => typeof r?.data === 'string' && r.data.trim().length > 100)
    .slice(0, 2)
    .map((r: any) => {
      const data = String(r.data).replace(/^data:image\/[^;]+;base64,/, '').replace(/[\r\n\s]/g, '');
      const rawMime = String(r.mimeType || '').toLowerCase();
      const mimeType = rawMime.includes('png') ? 'image/png' : rawMime.includes('webp') ? 'image/webp' : 'image/jpeg';
      return { data, mimeType };
    })
    .filter((r) => r.data.length > 200 && r.data.length < 5_000_000);

// ===== محرك الصور المجاني: Cloudflare Workers AI (FLUX.1 schnell) — بديل تلقائي حين لا يملك مفتاح Gemini حصة صور =====
const CF_BASE = process.env.CF_API_BASE || 'https://api.cloudflare.com';
const FLUX_MODEL = '@cf/black-forest-labs/flux-1-schnell';
const CF_ACCOUNT_RE = /^[a-f0-9]{32}$/i;
const CF_TOKEN_RE = /^\S{20,200}$/;
const BLOCK_TTL = 15 * 60 * 1000;

interface FreeCreds {
  account: string;
  token: string;
  source: 'user' | 'env';
}

// بيانات الزائر أولاً، ثم متغيرات البيئة (حساب صاحب النشر)
const getFreeCreds = (req: Request): FreeCreds | null => {
  const hAccount = req.get('x-cf-account')?.trim();
  const hToken = req.get('x-cf-token')?.trim();
  const user = Boolean(hAccount || hToken);
  const account = (user ? hAccount : process.env.CF_ACCOUNT_ID)?.trim() ?? '';
  const token = (user ? hToken : process.env.CF_API_TOKEN)?.trim() ?? '';
  return CF_ACCOUNT_RE.test(account) && CF_TOKEN_RE.test(token) ? { account, token, source: user ? 'user' : 'env' } : null;
};

// أ2: المشهد أولاً مع قفل الأسلوب الفني في الصدارة؛ إزالة الحروف العربية من رابط محركات الصور لتفادي فشل التوليد
const fluxPrompt = (prompt: string, square: boolean, artStyle?: string, styleConsistency?: string): string => {
  const sanitized = prompt
    .replace(/[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]+/g, ' ')
    .replace(/["«»“”]/g, '')
    .replace(/\(\s*\)/g, '');
  const lines = sanitized
    .split('\n')
    .map((l) => l.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
  const sceneIdx = lines.findIndex((l) => /^(?:Scene|Character reference sheet|Composition):/i.test(l));
  const sceneLine = sceneIdx >= 0 ? lines[sceneIdx] : lines[0] || sanitized.trim();
  const styleIdx = lines.findIndex((l) => /^Style:/i.test(l));
  const styleLine = styleIdx >= 0 ? lines[styleIdx] : '';
  const restLines = lines.filter((_, idx) => idx !== (sceneIdx >= 0 ? sceneIdx : 0) && idx !== styleIdx);

  // استخراج أو بناء قفل الأسلوب الفني الصارم لمنع انحراف الأنمي أو الـ 3D أو الكرتون
  let explicitStyle = '';
  if (artStyle) {
    const sLower = artStyle.toLowerCase();
    if (sLower.includes('anime')) {
      explicitStyle = 'Masterpiece Japanese studio anime key visual, cel-shaded anime aesthetic, vibrant anime character design';
    } else if (sLower.includes('3d') || sLower.includes('pixar')) {
      explicitStyle = 'Masterpiece 3D CGI Pixar feature-film studio render, volumetric lighting, rich 3D character design';
    } else if (sLower.includes('cute cartoon')) {
      explicitStyle = 'Masterpiece cute animated cartoon illustration, smooth clean linework, vibrant cheerful palette';
    } else if (sLower.includes('hand-drawn')) {
      explicitStyle = 'Masterpiece hand-drawn ink and brush cartoon illustration, organic strokes, artistic warmth';
    } else if (sLower.includes('pixel')) {
      explicitStyle = 'Masterpiece high-bit pixel art scene, crisp pixel craftsmanship, vibrant sprites';
    } else if (sLower.includes('photorealistic') || sLower.includes('realistic')) {
      explicitStyle = 'Cinematic photorealistic portrait photography, lifelike textures, 85mm prime lens';
    } else if (sLower.includes('watercolor')) {
      explicitStyle = 'Luxury fine-art watercolor illustration, luminous translucent washes, cold-press paper';
    } else {
      explicitStyle = `${artStyle} masterpiece illustration, high-fidelity artwork`;
    }
  }

  const consistencyKeywords = (styleConsistency && styleConsistency !== 'auto') ? `, ${styleConsistency}` : '';
  const styleBlock = styleLine ? styleLine : (explicitStyle ? `Style: ${explicitStyle}${consistencyKeywords}.` : '');

  const framing = square ? '' : ' Centered composition.';
  const maxRestChars = Math.max(0, 350 - sceneLine.length - styleBlock.length);
  const rest = restLines.join(' ').slice(0, maxRestChars).trim();

  // تجميع البرومبت مع تصدر الأسلوب الفني أولاً لضمان عدم ضياع هوية الرسم عند تقليص الحجم
  const base = [styleBlock, sceneLine, rest, framing.trim()].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
  const hasDirective = base.toLowerCase().includes('expressive eyes, cohesive palette');
  return (hasDirective ? base : `${base} ${POSITIVE_ILLUSTRATION_DIRECTIVE}`).replace(/\s+/g, ' ').trim();
};

const runFlux = async (creds: FreeCreds, prompt: string, steps = 6): Promise<string> => {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 75_000);
  try {
    const r = await fetch(`${CF_BASE}/client/v4/accounts/${creds.account}/ai/run/${FLUX_MODEL}`, {
      method: 'POST',
      signal: ctrl.signal,
      headers: { Authorization: `Bearer ${creds.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, steps, seed: Math.floor(Math.random() * 2 ** 31) }),
    });
    const raw = await r.text();
    let json: any = null;
    try {
      json = JSON.parse(raw);
    } catch {
      // رد غير JSON
    }
    const image = json?.result?.image ?? json?.image;
    if (r.ok && typeof image === 'string' && image.length > 100) return image;
    const first = json?.errors?.[0];
    throw Object.assign(new Error(`Cloudflare ${r.status}: ${String(first?.message || raw).slice(0, 300)}`), { status: r.status, cfCode: first?.code });
  } finally {
    clearTimeout(timer);
  }
};

const FLUX_LABEL = 'cloudflare/flux-1-schnell';

const runFree = async (creds: FreeCreds, prompt: string, steps = 6): Promise<string> => {
  const trail: TrailItem[] = [];
  for (let i = 0; i < 3; i++) {
    try {
      return await runFlux(creds, prompt, steps);
    } catch (err: any) {
      const status = Number(err?.status) || 0;
      const msg = String(err?.message ?? err).replace(/\s+/g, ' ');
      const kind: ErrorKind =
        status === 401 || status === 403 || err?.cfCode === 10000
          ? 'auth'
          : status === 429 || /neuron|daily|allocation|rate limit|quota/i.test(msg)
            ? 'quota'
            : status >= 500 || err?.name === 'AbortError' || err?.cfCode === 3040 || /fetch failed|ECONN|ETIMEDOUT/i.test(msg)
              ? 'busy'
              : 'skip';
      trail.push({ model: FLUX_LABEL, kind, status, message: msg.slice(0, 480) });
      console.warn(`[free-image] #${i + 1}: ${kind} ${status} — ${msg.slice(0, 160)}`);
      if (kind === 'busy' && i < 2) {
        await sleep(900 * 2 ** i + Math.random() * 400);
        continue;
      }
      const code: ErrorCode = kind === 'auth' ? 'FREE_AUTH' : kind === 'quota' ? 'FREE_QUOTA' : kind === 'busy' ? 'BUSY' : 'FAILED';
      throw Object.assign(new Error(msg), { code, trail });
    }
  }
  throw new Error('Free engine failed.');
};

// جلسات Gemini التي ثبت أن الصور عندها بلا حصة: نتخطاها مؤقتاً إلى المحرك المجاني بدل تكرار المحاولات الفاشلة لكل صورة
const imageBlocked = new Map<string, number>();

// فحص بيانات Cloudflare بصورة صغيرة فعلية (أرخص خطوة ممكنة) للتأكد من صلاحية الرمز لـ Workers AI
app.get('/api/free-check', async (req: Request, res: Response) => {
  const creds = getFreeCreds(req);
  if (!creds) return res.status(400).json({ error: 'Cloudflare account ID or token is missing or malformed.', code: 'FREE_AUTH' });
  try {
    await runFree(creds, 'a small red circle on white background', 1);
    return res.json({ ok: true, source: creds.source });
  } catch (err) {
    return sendError(res, err, 'Cloudflare check failed');
  }
});

const AI_IMAGE_SIZES: Record<string, [number, number]> = {
  '1:1': [1024, 1024],
  '4:3': [1024, 768],
  '3:4': [768, 1024],
  '16:9': [1024, 576],
  '9:16': [576, 1024],
};

const runAiFallback = async (
  prompt: string,
  aspectRatio: string,
  artStyle?: string,
  styleConsistency?: string
): Promise<{ base64: string; mimeType: string; model: string; engine: 'pollinations'; promptSnippet: string }> => {
  const dims = AI_IMAGE_SIZES[aspectRatio] || [1024, 768];
  const cleanPrompt = fluxPrompt(prompt, aspectRatio === '1:1', artStyle, styleConsistency);
  const encodedPrompt = encodeURIComponent(cleanPrompt);
  const seed = Math.floor(Math.random() * 2 ** 31);

  const urls = [
    `https://image.pollinations.ai/prompt/${encodedPrompt}?width=${dims[0]}&height=${dims[1]}&seed=${seed}&nologo=true&model=flux`,
    `https://image.pollinations.ai/prompt/${encodedPrompt}?width=${dims[0]}&height=${dims[1]}&seed=${seed}&nologo=true`,
    `https://image.pollinations.ai/prompt/${encodedPrompt}?seed=${seed}&nologo=true`,
  ];

  for (let attempt = 0; attempt < urls.length; attempt++) {
    const url = urls[attempt];
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 25_000);
    try {
      const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: ctrl.signal });
      if (res.ok) {
        const ct = res.headers.get('content-type') || '';
        // منع رسومات الـ SVG نهائياً وقبول الصور النقطية الحقيقية فقط (JPEG / PNG)
        if (ct.includes('image') && !ct.includes('svg')) {
          const buf = await res.arrayBuffer();
          const base64 = Buffer.from(buf).toString('base64');
          return {
            base64,
            mimeType: ct.includes('png') ? 'image/png' : 'image/jpeg',
            model: 'pollinations-flux',
            engine: 'pollinations',
            promptSnippet: cleanPrompt.slice(0, 300),
          };
        }
      }
      if (res.status === 402 || res.status === 429) {
        await sleep(1200);
      }
    } catch {
      // try next URL
    } finally {
      clearTimeout(timer);
    }
  }

  // ممنوع توليد SVG نهائياً: عند تعذر الخدمات نطلق خطأ معالجة لطلب إعادة المحاولة
  throw Object.assign(new Error('Image generation models are busy. Tap retry scene to repaint with high-res models.'), {
    code: 'BUSY',
    status: 503,
  });
};

// توليد الصور: أولاً عبر نماذج Gemini المتقدمة (ما لم تكن الجلسة موقوفة مؤقتاً بسبب نفاد حصة الصور)، ثم Cloudflare Flux إن توفر، ثم Pollinations الاحتياطي
app.post('/api/generate-image', async (req: Request, res: Response) => {
  try {
    const rawPrompt = clip(req.body?.prompt, 4000);
    if (!rawPrompt) return res.status(400).json({ error: 'Image prompt is required.', code: 'FAILED' });
    const aspectRatio = ASPECTS.has(req.body?.aspectRatio) ? req.body.aspectRatio : '4:3';
    const styleConsistency = clip(req.body?.styleConsistency, 240);
    const audienceLevel = clip(req.body?.audienceLevel, 20);
    const refs = sanitizeRefs(req.body?.references);
    const session = getSession(req);

    const hasConsistencyInPrompt =
      styleConsistency && rawPrompt.toLowerCase().includes(styleConsistency.slice(0, 18).toLowerCase());
    const consistencyTail =
      styleConsistency && styleConsistency.toLowerCase() !== 'auto' && !hasConsistencyInPrompt
        ? `\nStyle consistency: ${styleConsistency}, cinematic lighting, high-fidelity, concept art style, detailed textures.`
        : !/cinematic lighting/i.test(rawPrompt)
          ? '\nQuality: cinematic lighting, high-fidelity, concept art style, detailed textures.'
          : '';
    const audienceTail =
      audienceLevel === 'adults' && !/\b(adult|mature)\b/i.test(rawPrompt)
        ? ' Depict characters with mature adult proportions.'
        : '';
    const prompt = `${rawPrompt}${consistencyTail}${audienceTail}`;

    // المشهد يبقى في البداية؛ ملاحظة المرجع تأتي في النهاية مع إلزام النموذج برسم المشهد الجديد بالكامل
    const refTail = refs.length
      ? ' Use the attached reference image ONLY for character identity (facial features, hairstyle, and outfit colors); compose a brand-new dynamic scene matching the Scene description.'
      : '';
    const text = `${prompt}${refTail}`;

    const isSessionImageBlocked = (imageBlocked.get(session.fp) ?? 0) > Date.now();

    if (!isSessionImageBlocked) {
      try {
        const { value, model } = await runChain(
          'image',
          await chainFor(req, 'image'),
          async (m, ai) => {
            const isNoSize = NO_SIZE_IMAGE_MODELS.has(m);
            let currentRefs = refs;
            for (let attempt = 0; attempt < 2; attempt++) {
              try {
                const parts: any[] = currentRefs.length
                  ? [...currentRefs.map((r) => ({ inlineData: { data: r.data, mimeType: r.mimeType } })), { text }]
                  : [{ text }];
                const response = await ai.models.generateContent({
                  model: m,
                  contents: [{ role: 'user', parts }],
                  config: {
                    responseModalities: [Modality.TEXT, Modality.IMAGE],
                    imageConfig: isNoSize ? { aspectRatio } : { aspectRatio, imageSize: '1K' },
                  },
                });
                const part = (response.candidates?.[0]?.content?.parts ?? []).find((p) => p.inlineData?.data);
                if (part?.inlineData?.data) {
                  return { base64: part.inlineData.data, mimeType: part.inlineData.mimeType || 'image/png' };
                }
                break;
              } catch (err: any) {
                const msg = String(err?.message || '');
                if (/could not be decoded|source image/i.test(msg) && currentRefs.length > 0) {
                  currentRefs = [];
                  continue;
                }
                throw err;
              }
            }
            return null;
          },
          req
        );

        imageBlocked.delete(session.fp);
        return res.json({ ...value, model, engine: 'gemini', promptSnippet: text.slice(0, 300) });
      } catch (geminiErr: any) {
        const errCode = geminiErr?.code as ErrorCode | undefined;
        // حظر الجلسة فقط إذا كانت الحصة صفرية (BILLING) أو لا يوجد أي نموذج صور؛ أما كوتا الدقيقة المؤقتة فتُدار عبر modelCooldowns
        if (errCode === 'BILLING' || errCode === 'NOMODEL') {
          imageBlocked.set(session.fp, Date.now() + BLOCK_TTL);
        }
      }
    }

    // إذا كان الطلب ورقة مرجع شخصية (sheet) وفشل Gemini، نتخطى ورقة المرجع بدلاً من توليد صورة بديلة تشوّه صفحات القصة
    if (req.body?.kind === 'sheet') {
      return res.json({ skipped: true, mimeType: 'image/png', model: 'skipped-sheet', engine: 'gemini' });
    }

    const freeCreds = getFreeCreds(req);
    if (freeCreds) {
      try {
        const cfPrompt = fluxPrompt(prompt, aspectRatio === '1:1', req.body?.artStyle, styleConsistency);
        const base64 = await runFree(freeCreds, cfPrompt, 6);
        return res.json({
          base64,
          mimeType: 'image/png',
          model: FLUX_LABEL,
          engine: 'flux',
          promptSnippet: cfPrompt.slice(0, 300),
        });
      } catch {
        // fallback to Pollinations
      }
    }
    const fallback = await runAiFallback(prompt, aspectRatio, req.body?.artStyle, styleConsistency);
    return res.json(fallback);
  } catch (err) {
    return sendError(res, err, 'Failed to generate image');
  }
});

// تفريغ الصوت وتحويله إلى نص بالذكاء الاصطناعي عبر سلسلة النماذج لدعم الإملاء الصوتي دون توقف عند كوتا نموذج واحد
app.post('/api/transcribe', async (req: Request, res: Response) => {
  try {
    const audio = req.body?.audio;
    const rawMime = String(req.body?.mimeType || 'audio/webm');
    if (!audio || typeof audio !== 'string') {
      return res.status(400).json({ error: 'Audio data is required.', code: 'FAILED' });
    }
    const cleanBase64 = audio.replace(/^data:audio\/[^;]+;base64,/, '').replace(/[\r\n\s]/g, '');
    if (cleanBase64.length < 50) {
      return res.status(400).json({ error: 'Audio recording is empty or too short.', code: 'FAILED' });
    }
    const mimeType = rawMime.split(';')[0].trim() || 'audio/webm';
    const prompt = 'You are a highly accurate speech transcriber. Listen to this user audio recording. Transcribe the spoken speech word for word in Arabic or English as spoken. Do NOT add any notes, conversational text, formatting, or commentary. Output ONLY the exact transcribed text.';

    const { value } = await runChain(
      'transcribe',
      await chainFor(req, 'text'),
      async (model, ai) => {
        const response = await ai.models.generateContent({
          model,
          contents: [
            {
              role: 'user',
              parts: [
                {
                  inlineData: {
                    data: cleanBase64,
                    mimeType,
                  },
                },
                { text: prompt },
              ],
            },
          ],
        });
        const text = response.candidates?.[0]?.content?.parts?.find((p) => p.text)?.text?.trim() || '';
        return text ? { text } : null;
      },
      req
    );
    return res.json(value);
  } catch (err) {
    return sendError(res, err, 'Failed to transcribe audio');
  }
});

// تغليف PCM خام بترويسة WAV
const pcmToWav = (pcm: Buffer, sampleRate = 24000, channels = 1, bits = 16): Buffer => {
  const header = Buffer.alloc(44);
  const byteRate = (sampleRate * channels * bits) / 8;
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE((channels * bits) / 8, 32);
  header.writeUInt16LE(bits, 34);
  header.write('data', 36);
  header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
};

const toWavPayload = (base64: string, mimeType = ''): { base64: string; mimeType: string } => {
  if (/wav/i.test(mimeType)) return { base64, mimeType: 'audio/wav' };
  if (/mpeg|mp3/i.test(mimeType)) return { base64, mimeType: 'audio/mpeg' };
  const rate = Number(/rate=(\d+)/i.exec(mimeType)?.[1]) || 24000;
  return { base64: pcmToWav(Buffer.from(base64, 'base64'), rate).toString('base64'), mimeType: 'audio/wav' };
};

const musicBlocked = new Map<string, number>();

// توليد موسيقى صندوق موسيقى هادئة (WAV) على الخادم عند عدم توفر نماذج Lyria
const buildProceduralLullabyWav = (sampleRate = 24000, durationSec = 16): Buffer => {
  const totalSamples = Math.ceil(durationSec * sampleRate);
  const pcm = Buffer.alloc(totalSamples * 2);
  const notes = [261.63, 293.66, 329.63, 392.0, 440.0, 523.25, 587.33, 659.25, 783.99];
  const melody = [
    { n: 2, t: 0.0, d: 1.2 }, { n: 4, t: 0.8, d: 1.2 }, { n: 5, t: 1.6, d: 1.5 }, { n: 4, t: 2.6, d: 1.0 },
    { n: 3, t: 3.4, d: 1.4 }, { n: 1, t: 4.4, d: 1.2 }, { n: 2, t: 5.2, d: 2.2 },
    { n: 5, t: 7.0, d: 1.2 }, { n: 6, t: 7.8, d: 1.2 }, { n: 7, t: 8.6, d: 1.6 }, { n: 5, t: 9.8, d: 1.2 },
    { n: 4, t: 10.8, d: 1.5 }, { n: 2, t: 12.0, d: 1.2 }, { n: 0, t: 13.0, d: 2.8 },
  ];

  for (let i = 0; i < totalSamples; i++) {
    const t = i / sampleRate;
    const fade = Math.min(1, t / 1.2, (durationSec - t) / 1.2);
    // Warm ambient pad
    let val =
      0.03 *
      fade *
      (Math.sin(2 * Math.PI * 130.81 * t) +
        0.8 * Math.sin(2 * Math.PI * 164.81 * t) +
        0.7 * Math.sin(2 * Math.PI * 196.0 * t));

    for (const m of melody) {
      if (t >= m.t && t < m.t + m.d) {
        const dt = t - m.t;
        const f = notes[m.n % notes.length];
        const env = Math.min(1, dt / 0.02) * Math.exp(-dt * (3.2 / m.d));
        val += 0.11 * env * (Math.sin(2 * Math.PI * f * t) + 0.3 * Math.sin(2 * Math.PI * f * 2 * t));
      }
    }
    const clamped = Math.max(-1, Math.min(1, val));
    pcm.writeInt16LE(Math.round(clamped * 32767), i * 2);
  }
  return pcmToWav(pcm, sampleRate, 1, 16);
};

// توجيه صارم لثبات طبقة الصوت وسرعة الإلقاء الدافئة والنطق العربي السليم بالتشكيل
app.post('/api/narrate', async (req: Request, res: Response) => {
  try {
    const text = clip(req.body?.text, 4000);
    if (!text) return res.status(400).json({ error: 'Narration text is required.', code: 'FAILED' });
    const voice = VOICES.has(req.body?.voice) ? req.body.voice : 'Sulafat';

    const NARRATION_SYSTEM_INSTRUCTION = `STRICT NARRATOR DIRECTIVE: You are an audio story narrator performing voice '${voice}'. Maintain 100% strict acoustic consistency across all narration clips in this book. Use the exact same voice pitch, speaking rate (steady, warm, expressive storytelling cadence), articulation, and audio timbre on every single paragraph. Do not vary pitch or tone randomly between calls. Read ONLY the requested story text cleanly with perfect diction. Do not omit words, do not speak any preamble, intro, or commentary.`;

    const { value, model } = await runChain(
      'tts',
      await chainFor(req, 'tts'),
      async (m, ai) => {
        const supportsDeveloperInstruction = /^gemini-2\.5-/i.test(m);
        try {
          const response = await ai.models.generateContent({
            model: m,
            contents: [{ role: 'user', parts: [{ text }] }],
            config: {
              ...(supportsDeveloperInstruction ? { systemInstruction: NARRATION_SYSTEM_INSTRUCTION } : {}),
              responseModalities: [Modality.AUDIO],
              speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } },
            },
          });
          const part = (response.candidates?.[0]?.content?.parts ?? []).find((p) => p.inlineData?.data);
          if (part?.inlineData?.data) return toWavPayload(part.inlineData.data, part.inlineData.mimeType);
        } catch (err: any) {
          // في حال رفض نموذج فرعي لـ systemInstruction نعيد الطلب بدونه فوراً على نفس النموذج
          if (/Developer instruction is not enabled/i.test(String(err?.message || ''))) {
            const retryRes = await ai.models.generateContent({
              model: m,
              contents: [{ role: 'user', parts: [{ text }] }],
              config: {
                responseModalities: [Modality.AUDIO],
                speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } },
              },
            });
            const retryPart = (retryRes.candidates?.[0]?.content?.parts ?? []).find((p) => p.inlineData?.data);
            if (retryPart?.inlineData?.data) return toWavPayload(retryPart.inlineData.data, retryPart.inlineData.mimeType);
          }
          if (classify(err) === 'auth' || classify(err) === 'quota') throw err;
          const r: any = await (ai as any).interactions?.create?.({
            model: m,
            input: text,
            config: {
              responseModalities: ['AUDIO'],
              speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } },
            },
          });
          const audio = r?.output_audio ?? (Array.isArray(r?.outputs) ? r.outputs.find((o: any) => o?.type === 'audio' || o?.data) : null);
          if (audio?.data) return toWavPayload(audio.data, audio.mime_type || audio.mimeType);
          throw err;
        }
        return null;
      },
      req
    );

    return res.json({ ...value, model });
  } catch (err) {
    return sendError(res, err, 'Failed to narrate');
  }
});

// موسيقى خلفية مولّدة بـ Lyria، مع احتياطي موسيقي فوري عند عدم توفر النموذج على المفتاح
app.post('/api/music', async (req: Request, res: Response) => {
  const mood = clip(req.body?.prompt, 600) || 'A gentle, magical lullaby for a children storybook';
  const session = getSession(req);
  const isSessionMusicBlocked = (musicBlocked.get(session.fp) ?? 0) > Date.now();

  if (!isSessionMusicBlocked) {
    try {
      const { value, model } = await runChain(
        'music',
        await chainFor(req, 'music'),
        async (m, ai) => {
          const r: any = await (ai as any).interactions.create({
            model: m,
            input: `${mood}. Instrumental only, no vocals, no lyrics. Soft, warm, child friendly, steady and loop-friendly, suitable as a quiet background under narration${m === 'lyria-3.5' ? ', about 60 seconds long' : ''}.`,
          });
          const audio = r?.output_audio;
          return audio?.data ? { base64: audio.data as string, mimeType: (audio.mime_type as string) || 'audio/mpeg' } : null;
        },
        req
      );
      musicBlocked.delete(session.fp);
      return res.json({ ...value, model });
    } catch {
      musicBlocked.set(session.fp, Date.now() + BLOCK_TTL);
    }
  }

  const wav = buildProceduralLullabyWav();
  return res.json({
    base64: wav.toString('base64'),
    mimeType: 'audio/wav',
    model: 'procedural-lullaby',
  });
});

const CONTINUE_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    pages: STORY_RESPONSE_SCHEMA.properties!.pages as Schema,
    quiz: STORY_RESPONSE_SCHEMA.properties!.quiz as Schema,
    moral: { type: Type.STRING },
    lessons: { type: Type.ARRAY, items: { type: Type.STRING } },
  },
  required: ['pages'],
};

// دفعة تالية من قصة طويلة: السياق = الشخصيات + ملخص ما كُتب، والدفعة الأخيرة تُنهي القصة وتعيد الاختبار والعبرة
app.post('/api/continue-story', async (req: Request, res: Response) => {
  const b = req.body ?? {};
  const info = b.story ?? {};
  const from = Math.min(Math.max(Number(b.from) || 2, 2), 120);
  const count = Math.min(Math.max(Number(b.count) || 6, 1), 10);
  const total = Math.min(Math.max(Number(b.total) || from + count - 1, from), 120);
  const final = Boolean(b.final);
  const earlier: string[] = (Array.isArray(info.earlier) ? info.earlier : []).slice(-60).map((t: unknown) => clip(t, 160));
  const recent: string[] = (Array.isArray(info.recent) ? info.recent : []).slice(-3).map((t: unknown) => clip(t, 700));
  if (!earlier.length && !recent.length) return res.status(400).json({ error: 'Missing story so far.', code: 'FAILED' });
  const characters = (Array.isArray(info.characters) ? info.characters.slice(0, 5) : [])
    .map((c: any) => `${clip(c?.name, 40)}: ${clip(c?.description, 400)}`)
    .join(' | ');
  const arabic = /arab|عرب/i.test(String(info.language ?? ''));

  const ageGroupCont = clip(info.ageGroup, 10) || '4-6';
  const isAdultCont = ageGroupCont === '18+' || Boolean(info.adultMode);
  const artStyleCont = clip(info.artStyle, 40) || 'Classic Storybook';
  const artStyleSpecCont = SHARED_ART_STYLE_OPTIONS.find((s) => s.value === artStyleCont)?.prompt || artStyleCont;

  const prompt = [
    `Continue the ${isAdultCont ? 'mature adult' : 'illustrated'} story "${clip(info.title, 100)}".`,
    arabic ? `Language: Arabic (${clip(info.dialect, 30) || 'Modern Standard'})` : 'Language: English',
    `Age group: ${ageGroupCont}. Art style: ${artStyleCont} (${artStyleSpecCont}).`,
    isAdultCont
      ? 'AUDIENCE & CHARACTER MATURITY: This is a MATURE / ADULT story (18+). Keep adult characters depicted as full-grown adults with mature proportions in every image_prompt.'
      : '',
    `Fixed characters (same names, same visual design on every page; no new main characters): ${characters}`,
    earlier.length ? `Earlier pages in brief:\n${earlier.map((t, i) => `${i + 1}. ${t}`).join('\n')}` : '',
    recent.length ? `Latest pages in full (continue directly from here):\n${recent.join('\n')}` : '',
    `Write EXACTLY ${count} new pages, numbered ${from} to ${from + count - 1} (the whole book has ${total} pages).`,
    'Start a new chapter: give the FIRST new page a "chapter" title.',
    final
      ? 'This is the FINAL part: build to a satisfying resolution and end the story. Also return "quiz" (exactly 3 questions about the WHOLE story; "page" = page number each question is about), "moral" (one short sentence) and "lessons" (2-3 short items).'
      : 'The story is NOT over: do not conclude. End on a natural transition into what comes next. Do not return quiz, moral or lessons.',
  ]
    .filter(Boolean)
    .join('\n');

  try {
    const { value } = await runChain(
      'continue',
      await chainFor(req, 'text'),
      async (model, ai) => {
        const response = await ai.models.generateContent({
          model,
          contents: prompt,
          config: { systemInstruction: SYSTEM_INSTRUCTION, responseMimeType: 'application/json', responseSchema: CONTINUE_SCHEMA },
        });
        const parsed = response.text ? parseJson(response.text) : null;
        return Array.isArray(parsed?.pages) && parsed.pages.length ? parsed : null;
      },
      req
    );
    return res.json({ ...value, pages: value.pages.slice(0, count) });
  } catch (err: any) {
    const errObj = errorInfo(err, 'Failed to continue story');
    if (errObj.body.code !== 'AUTH' && errObj.body.code !== 'NOKEY') {
      const freeVal = await runFreeTextJson(SYSTEM_INSTRUCTION, prompt);
      if (Array.isArray(freeVal?.pages) && freeVal.pages.length) {
        return res.json({ ...freeVal, pages: freeVal.pages.slice(0, count) });
      }
      const heroName = Array.isArray(info.characters) && info.characters[0]?.name ? clip(info.characters[0].name, 40) : arabic ? 'البطل' : 'the hero';
      const fallbackPages = Array.from({ length: count }, (_, i) => {
        const pNum = from + i;
        const text = arabic
          ? `واصل ${heroName} رحلته في الصفحة ${pNum}، واكتشف تفصيلاً جديداً يقربه من هدفه بروح التعاون والأمل.`
          : `${heroName} continued the journey on page ${pNum}, discovering a new clue with teamwork and hope.`;
        return {
          page: pNum,
          text,
          narration: text,
          image_prompt: `${heroName} continuing the adventure in a vibrant storybook scene, page ${pNum}`,
          ...(i === 0 ? { chapter: arabic ? `الفصل ${Math.ceil(from / 6)}` : `Chapter ${Math.ceil(from / 6)}` } : {}),
        };
      });
      return res.json({
        pages: fallbackPages,
        ...(final
          ? {
              moral: arabic ? 'المثابرة والتعاون يقودان إلى النجاح.' : 'Perseverance and teamwork lead to success.',
              lessons: arabic ? ['المثابرة', 'التعاون'] : ['Perseverance', 'Teamwork'],
            }
          : {}),
      });
    }
    return sendError(res, err, 'Failed to continue story');
  }
});

const EXPLAIN_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING },
    answer: { type: Type.STRING },
    fun_fact: { type: Type.STRING },
    image_prompt: { type: Type.STRING },
    follow_ups: { type: Type.ARRAY, items: { type: Type.STRING } },
    quiz: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: { question: { type: Type.STRING }, options: { type: Type.ARRAY, items: { type: Type.STRING } }, answer: { type: Type.NUMBER } },
        required: ['question', 'options', 'answer'],
      },
    },
  },
  required: ['quiz'],
};

// «اسأل أي سؤال» و«اختبرني»: شرح مناسب للعمر، حقيقة طريفة، وصف صورة، أسئلة متابعة، واختبار قصير
app.post('/api/explain', async (req: Request, res: Response) => {
  try {
    const mode = req.body?.mode === 'quiz' ? 'quiz' : 'ask';
    const level = ['easy', 'medium', 'hard'].includes(req.body?.level) ? String(req.body.level) : 'medium';
    const count = Math.min(Math.max(Number(req.body?.count) || 4, 3), 8);
    const question = clip(req.body?.question, 300);
    const topicText = clip(req.body?.topicText, 1200);
    if (!question && !topicText) return res.status(400).json({ error: 'Ask a question first.', code: 'FAILED' });
    const arabic = req.body?.language === 'Arabic';
    const age = clip(req.body?.ageGroup, 10) || '7-9';
    const lang = arabic ? `Arabic (${clip(req.body?.dialect, 30) || 'Modern Standard'}, simple, kid-friendly)` : 'English';

    const prompt =
      mode === 'ask'
        ? [
            `A child aged ${age} asks: "${question}"`,
            `Reply in ${lang}. Fill: "title" (a short title for the topic), "answer" (3-5 short, warm, accurate sentences a child can understand; use a simple comparison), "fun_fact" (one surprising true fact), "image_prompt" (ENGLISH, 40-70 words, a friendly colorful educational illustration of the idea, no text or letters), "follow_ups" (exactly 3 short related questions a child might ask next), "quiz" (exactly 3 multiple-choice questions about your answer, 3 options each, "answer" = index 0-2 of the correct option).`,
            'If the question is unsafe or not suitable for children, gently say so in "answer", suggest a safe related topic, and keep "quiz" about that safe topic.',
          ].join('\n')
        : [
            `Topic for a child aged ${age}: ${question || ''}`,
            topicText ? `Text: ${topicText}` : '',
            `Difficulty: ${level}. ${level === 'easy' ? 'Very simple, concrete questions.' : level === 'hard' ? 'Challenging, needs reasoning, still suitable for the age.' : 'Moderate questions.'}`,
            `Write in ${lang}. Return ONLY "quiz": exactly ${count} multiple-choice questions ${topicText ? 'based strictly on the text' : 'about the topic, accurate and checkable'}, 3 options each, "answer" = index 0-2 of the correct option. Vary the position of the correct option, never repeat a question.`,
          ]
            .filter(Boolean)
            .join('\n');

    let value: any;
    try {
      const resChain = await runChain(
        'explain',
        await chainFor(req, 'text'),
        async (model, ai) => {
          const response = await ai.models.generateContent({
            model,
            contents: prompt,
            config: { responseMimeType: 'application/json', responseSchema: EXPLAIN_SCHEMA },
          });
          const parsed = response.text ? parseJson(response.text) : null;
          if (!Array.isArray(parsed?.quiz) || !parsed.quiz.length) return null;
          if (mode === 'ask' && !parsed.answer) return null;
          return parsed;
        },
        req
      );
      value = resChain.value;
    } catch (chainErr: any) {
      const info = errorInfo(chainErr, 'Failed to explain');
      if (info.body.code === 'AUTH' || info.body.code === 'NOKEY') throw chainErr;
      const freeParsed = await runFreeTextJson('You are a friendly children science and general knowledge teacher.', prompt);
      if (Array.isArray(freeParsed?.quiz) && freeParsed.quiz.length) {
        value = freeParsed;
      } else {
        throw chainErr;
      }
    }

    return res.json({
      title: clip(value.title, 120),
      answer: clip(value.answer, 1500),
      fun_fact: clip(value.fun_fact, 400),
      image_prompt: clip(value.image_prompt, 700),
      follow_ups: (Array.isArray(value.follow_ups) ? value.follow_ups : []).slice(0, 3).map((q: unknown) => clip(q, 140)).filter(Boolean),
      quiz: value.quiz
        .slice(0, 8)
        .map((q: any) => ({ question: clip(q?.question, 240), options: (Array.isArray(q?.options) ? q.options : []).slice(0, 4).map((o: unknown) => clip(o, 120)), answer: Number(q?.answer) || 0 }))
        .filter((q: any) => q.question && q.options.length >= 2 && q.answer >= 0 && q.answer < q.options.length),
    });
  } catch (err) {
    return sendError(res, err, 'Failed to explain');
  }
});

const REWRITE_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: { prompt: { type: Type.STRING } },
  required: ['prompt'],
};

const ANGLES: Record<string, string> = {
  wide: 'wide establishing shot showing the whole scene and environment',
  close: 'close-up on the main character face and emotion, soft depth of field',
  low: 'low angle looking up, heroic and grand',
  high: 'high angle / bird eye view looking down on the scene',
  side: 'dynamic side-on view with a sense of motion',
  back: 'over-the-shoulder view from behind the character toward the scene',
  auto: 'a different, more cinematic camera angle than the current one',
};

// يعيد كتابة وصف مشهد واحد بزاوية كاميرا جديدة أو بتعليمات المستخدم، مع بقاء الشخصيات والحدث
app.post('/api/rewrite-prompt', async (req: Request, res: Response) => {
  try {
    const current = clip(req.body?.prompt, 1200);
    if (!current) return res.status(400).json({ error: 'Prompt is empty.', code: 'FAILED' });
    const angle = ANGLES[String(req.body?.angle ?? 'auto')] ?? ANGLES.auto;
    const instruction = clip(req.body?.instruction, 300);
    const sceneText = clip(req.body?.text, 600);

    const prompt = [
      'Rewrite this image-generation prompt for ONE page of a children picture book.',
      'Keep the same characters, setting and story event. Do not add text, captions or logos to the picture.',
      instruction ? `Apply this user instruction: ${instruction}` : `Change the camera: ${angle}.`,
      'Write in English, one paragraph, concrete visual details (composition, lighting, expression, colors), under 700 characters. Return JSON only.',
      sceneText ? `Story text of the page (context): ${sceneText}` : '',
      `Current prompt: ${current}`,
    ].filter(Boolean).join('\n');

    try {
      const { value } = await runChain(
        'rewrite',
        await chainFor(req, 'text'),
        async (model, ai) => {
          const response = await ai.models.generateContent({
            model,
            contents: prompt,
            config: { responseMimeType: 'application/json', responseSchema: REWRITE_SCHEMA },
          });
          const parsed = response.text ? parseJson(response.text) : null;
          return parsed?.prompt ? parsed : null;
        },
        req
      );
      return res.json({ prompt: clip(value.prompt, 1200) });
    } catch (chainErr: any) {
      const info = errorInfo(chainErr, 'Failed to rewrite prompt');
      if (info.body.code !== 'AUTH' && info.body.code !== 'NOKEY') {
        const freeVal = await runFreeTextJson('Rewrite children book illustration prompts in English JSON { "prompt": "..." }.', prompt);
        if (freeVal?.prompt) return res.json({ prompt: clip(freeVal.prompt, 1200) });
        const suffix = instruction ? `, ${instruction}` : `, ${angle}`;
        return res.json({ prompt: clip(`${current}${suffix}`, 1200) });
      }
      throw chainErr;
    }
  } catch (err) {
    return sendError(res, err, 'Failed to rewrite prompt');
  }
});

app.post('/api/analyze-name', async (req: Request, res: Response) => {
  try {
    const { language } = req.body ?? {};
    const trimmed = clip(req.body?.name, 60);
    if (!trimmed) return res.status(400).json({ error: 'Please enter a name first.', code: 'FAILED' });

    const isAr = language === 'Arabic';
    const prompt = isAr
      ? `حلّل اسم "${trimmed}" للأطفال: المعنى، الأصل، وثلاث صفات إيجابية مرتبطة به. أسلوب لطيف ومناسب للأطفال. أعد JSON فقط.`
      : `Analyze the name "${trimmed}" for kids: its meaning, origin, and three positive traits associated with it. Warm, kid-friendly tone. Return JSON only.`;

    try {
      const { value } = await runChain(
        'name',
        await chainFor(req, 'text'),
        async (model, ai) => {
          const response = await ai.models.generateContent({
            model,
            contents: prompt,
            config: { responseMimeType: 'application/json', responseSchema: NAME_ANALYSIS_SCHEMA },
          });
          return response.text ? parseJson(response.text) : null;
        },
        req
      );
      return res.json(value);
    } catch (chainErr: any) {
      const info = errorInfo(chainErr, 'Failed to analyze name');
      if (info.body.code !== 'AUTH' && info.body.code !== 'NOKEY') {
        const freeVal = await runFreeTextJson('Return JSON with keys: meaning (string), origin (string), traits (array of 3 strings).', prompt);
        if (freeVal?.meaning && Array.isArray(freeVal?.traits)) return res.json(freeVal);
        return res.json({
          meaning: isAr ? `اسم "${trimmed}" يحمل معاني النور والبهجة والجمال والهمة العالية.` : `The name "${trimmed}" carries warm meanings of light, joy, and noble character.`,
          origin: isAr ? 'أصل عربي وإنساني أصيل' : 'Classic heritage origin',
          traits: isAr ? ['الذكاء وحب الاستطلاع', 'طيبة القلب والكرم', 'الشجاعة والإبداع'] : ['Bright & Curious', 'Kind-hearted', 'Brave & Creative'],
        });
      }
      throw chainErr;
    }
  } catch (err) {
    return sendError(res, err, 'Failed to analyze name');
  }
});

const TITLES_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    titles: { type: Type.ARRAY, items: { type: Type.STRING } },
  },
  required: ['titles'],
};

// ب6: اقتراح 3 عناوين بديلة بنفس اللغة واللهجة
app.post('/api/suggest-titles', async (req: Request, res: Response) => {
  try {
    const currentTitle = clip(req.body?.currentTitle, 120);
    const language = clip(req.body?.language, 20) || 'Arabic';
    const dialect = clip(req.body?.dialect, 40) || 'Modern Standard';
    const summary = clip(req.body?.summary, 1000);
    if (!summary && !currentTitle) {
      return res.status(400).json({ error: 'Story summary or title is required.', code: 'FAILED' });
    }
    const isArabic = /arab|عرب/i.test(language);
    const prompt = isArabic
      ? `اقترح 3 عناوين بديلة جذابة ومبتكرة لقصة أطفال باللغة العربية (${dialect}). العنوان الحالي: "${currentTitle}". ملخص القصة: "${summary}". كل عنوان بين 2 و6 كلمات، مختلف عن العنوان الحالي، ومناسب للأطفال. أعد JSON فقط.`
      : `Suggest 3 creative, catchy alternative titles for a children's story in English. Current title: "${currentTitle}". Story summary: "${summary}". Each title 2-6 words, distinct from the current title. Return JSON only.`;

    try {
      const { value } = await runChain(
        'suggest-titles',
        await chainFor(req, 'text'),
        async (model, ai) => {
          const response = await ai.models.generateContent({
            model,
            contents: prompt,
            config: { responseMimeType: 'application/json', responseSchema: TITLES_SCHEMA },
          });
          const parsed = response.text ? parseJson(response.text) : null;
          return Array.isArray(parsed?.titles) && parsed.titles.length >= 3 ? parsed : null;
        },
        req
      );
      const titles = (value.titles as unknown[]).map((t) => clip(t, 90)).filter(Boolean).slice(0, 3);
      return res.json({ titles });
    } catch (chainErr: any) {
      const info = errorInfo(chainErr, 'Failed to suggest titles');
      if (info.body.code !== 'AUTH' && info.body.code !== 'NOKEY') {
        const freeVal = await runFreeTextJson('Return JSON { "titles": ["...", "...", "..."] }', prompt);
        if (Array.isArray(freeVal?.titles) && freeVal.titles.length >= 3) {
          return res.json({ titles: freeVal.titles.slice(0, 3).map((t: unknown) => clip(t, 90)) });
        }
        const base = currentTitle || (isArabic ? 'الرحلة العجيبة' : 'The Magical Journey');
        return res.json({
          titles: isArabic
            ? [`سر ${base}`, `حكاية النور في ${base}`, `مغامرة وراء ${base}`]
            : [`The Secret of ${base}`, `A Light Beyond ${base}`, `The Wonder of ${base}`],
        });
      }
      throw chainErr;
    }
  } catch (err) {
    return sendError(res, err, 'Failed to suggest titles');
  }
});

const IMPROVE_IDEA_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    suggestions: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
    },
  },
  required: ['suggestions'],
};

const sanitizeAndBoundIdeaSuggestion = (raw: unknown, isArabic: boolean, maxWords = 70): string => {
  const cleaned = clip(raw, 500)
    .replace(/<[^>]*>/g, '')
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!cleaned) return '';
  const words = cleaned.split(/\s+/).filter(Boolean);
  if (words.length > maxWords) {
    return words.slice(0, maxWords).join(' ').replace(/[,،؛:]+$/, '') + (isArabic ? '.' : '.');
  }
  return cleaned;
};

const buildFallbackImprovedIdeas = (idea: string, isArabic: boolean, ageGroup: string, storyType: string): string[] => {
  const core = clip(idea, 160) || (isArabic ? 'مغامرة شيقة في عالم الحكايات' : 'an exciting storybook adventure');
  if (isArabic) {
    return [
      `ينطلق بطلنا الشجاع في تجربة مليئة بالدهشة مستوحاة من فكرة (${core}) داخل حديقة الفوانيس المضيئة، لكنه يواجه لغزاً غامضاً يعترض طريقه ويختبر صبره وذكاءه. بفضل تعاونه مع أصدقائه الأوفياء وتفكيره الهادئ، ينجح في حل المشكلة وإعادة البهجة إلى المكان، ليتعلم في النهاية أن الشجاعة والتعاون يصنعان أجمل المعجزات لكل الأطفال (${ageGroup}).`,
      `في قرية دافئة تحيط بها التلال الخضراء، تبدأ حكاية (${core}) حين يكتشف البطل الصغير سراً قديماً يحتاج إلى أمانة وإصرار. وعندما تهب رياح التحدي وتتعقد المهمة، يرفض الاستسلام ويبتكر خطة ذكية تنقذ الموقف وتجمع القلوب، ليدرك في خاتمة الرحلة أن الصدق والإحسان للآخرين يفتحان أبواب النجاح والسعادة الحقيقية دائماً.`,
      `تحت سماء مرصعة بالنجوم وفي أجواء (${storyType})، يعيش البطل مغامرة استثنائية تدور حول (${core})، حيث يواجه عقبة غير متوقعة تتطلب منه الحكمة والهدوء. ومع كل خطوة يتعلم من أخطائه ويستعين بنصيحة الحكماء حتى يتجاوز الصعاب بنجاح، ويعود إلى بيته بقلب عامر بالامتنان ودرس نبيل يبقى أثره الجميل طويلاً.`,
    ].map((s) => sanitizeAndBoundIdeaSuggestion(s, true, 70));
  }
  return [
    `Starting from the idea of (${core}), our curious young hero ventures into the glowing Lantern Meadow for a (${storyType}) quest, only to face an unexpected puzzle that blocks the path home. Through calm thinking, teamwork, and gentle determination, the hero solves the challenge and restores harmony, learning that patience and kindness turn every obstacle into wisdom.`,
    `In a cozy hillside village, the story of (${core}) unfolds when the young protagonist discovers a forgotten secret that requires courage and honesty. When a sudden storm tests everyone's resolve, the hero unites friends with a clever plan that saves the day, ending with a heartwarming lesson about empathy, trust, and perseverance for ages (${ageGroup}).`,
    `Beneath a canopy of shimmering stars, a memorable journey inspired by (${core}) begins as the hero encounters a tricky dilemma in an enchanted workshop. By listening carefully, helping others along the way, and never giving up, the hero overcomes the trouble and returns home proud, discovering that true strength shines brightest through generosity.`,
  ].map((s) => sanitizeAndBoundIdeaSuggestion(s, false, 70));
};

// ب2: «حسّن فكرتي» — 3 صياغات محسّنة (40-70 كلمة) بنفس اللغة واللهجة مع بطل ومشكلة ومكان وخاتمة قيمية
app.post('/api/improve-idea', async (req: Request, res: Response) => {
  try {
    const rawIdea = clip(req.body?.idea, 500)
      .replace(/<[^>]*>/g, '')
      .trim();
    const ideaWords = rawIdea.split(/\s+/).filter(Boolean);
    if (ideaWords.length < 3) {
      return res.status(400).json({
        error: 'يرجى كتابة 3 كلمات على الأقل لتحسين الفكرة.',
        code: 'FAILED',
      });
    }
    const language = clip(req.body?.language, 20) || 'Arabic';
    const dialect = clip(req.body?.dialect, 40) || 'Modern Standard';
    const storyType = clip(req.body?.storyType, 40) || 'Magical Adventure';
    const ageGroup = clip(req.body?.ageGroup, 20) || '7-9';
    const isArabic = /arab|عرب/i.test(language);

    const isAdultIdea = ageGroup === '18+' || Boolean(req.body?.adultMode);
    const audienceLabelAr = isAdultIdea ? 'للكبار والبالغين (18+ بشخصيات ناضجة وحبكة عميقة)' : `للأطفال واليافعين (${ageGroup} سنوات)`;
    const audienceLabelEn = isAdultIdea ? 'Adults (18+ with mature adult characters and deep narrative)' : `${ageGroup} years`;

    const prompt = isArabic
      ? [
          `أنت محرر قصص وروايات خبير. حسّن فكرة المستخدم التالية إلى 3 صياغات قصصية متميزة وغنية للتوليد.`,
          `فكرة المستخدم: "${rawIdea}"`,
          `اللغة: العربية (${dialect === 'Modern Standard' ? 'فصحى واضحة وسلسة' : dialect}). نوع القصة: ${storyType}. الفئة المستهدفة: ${audienceLabelAr}.`,
          `القواعد الصارمة لكل صياغة من الصياغات الـ3:`,
          `1) الطول بين 40 و70 كلمة بالضبط.`,
          `2) بنفس اللغة واللهجة المطلوبة تماماً.`,
          `3) حافظ على شخصيات المستخدم وفكرته الأساسية وأعمار شخصياته (إن كانت القصة للكبار أو لشخص كبير فاجعل الأبطال بالغين ناضجين بوضوح).`,
          `4) أضف بطلاً واضحاً، ومكاناً ملموساً، ومشكلة أو تحدياً مشوقاً، وخاتمة قيمية نبيلة.`,
          `5) أعد JSON فقط بالشكل: { "suggestions": ["...", "...", "..."] }.`,
        ].join('\n')
      : [
          `You are an expert story editor. Improve the user's story idea into 3 distinct, rich story pitches.`,
          `User idea: "${rawIdea}"`,
          `Language: English. Story type: ${storyType}. Target audience: ${audienceLabelEn}.`,
          `Strict rules for each of the 3 suggestions:`,
          `1) Length MUST be between 40 and 70 words each.`,
          `2) Keep the user's characters, character maturity (adult vs child), and core idea intact.`,
          `3) Include a clear hero, a vivid setting, an engaging problem/challenge, and a meaningful ending.`,
          `4) Return valid JSON only: { "suggestions": ["...", "...", "..."] }.`,
        ].join('\n');

    try {
      const { value } = await runChain(
        'improve-idea',
        await chainFor(req, 'text'),
        async (model, ai) => {
          const response = await ai.models.generateContent({
            model,
            contents: prompt,
            config: { responseMimeType: 'application/json', responseSchema: IMPROVE_IDEA_SCHEMA },
          });
          const parsed = response.text ? parseJson(response.text) : null;
          if (!Array.isArray(parsed?.suggestions)) return null;
          const cleaned = parsed.suggestions
            .map((item: unknown) => sanitizeAndBoundIdeaSuggestion(item, isArabic, 70))
            .filter((item: string) => item.split(/\s+/).filter(Boolean).length >= 15);
          return cleaned.length >= 3 ? { suggestions: cleaned.slice(0, 3) } : null;
        },
        req
      );
      return res.json({ suggestions: value.suggestions.slice(0, 3) });
    } catch (chainErr: any) {
      const info = errorInfo(chainErr, 'Failed to improve idea');
      if (info.body.code !== 'AUTH' && info.body.code !== 'NOKEY') {
        const freeVal = await runFreeTextJson(
          'Return JSON { "suggestions": ["40-70 word improved idea 1", "40-70 word improved idea 2", "40-70 word improved idea 3"] }',
          prompt
        );
        if (Array.isArray(freeVal?.suggestions)) {
          const cleaned = freeVal.suggestions
            .map((item: unknown) => sanitizeAndBoundIdeaSuggestion(item, isArabic, 70))
            .filter((item: string) => item.split(/\s+/).filter(Boolean).length >= 15);
          if (cleaned.length >= 3) {
            return res.json({ suggestions: cleaned.slice(0, 3) });
          }
        }
        return res.json({
          suggestions: buildFallbackImprovedIdeas(rawIdea, isArabic, ageGroup, storyType),
        });
      }
      throw chainErr;
    }
  } catch (err) {
    return sendError(res, err, 'Failed to improve idea');
  }
});

const isProduction = process.env.NODE_ENV === 'production';

if (!isProduction) {
  const { createServer } = await import('vite');
  const vite = await createServer({
    server: { middlewareMode: true, host: '0.0.0.0', port: 3000 },
    appType: 'spa',
  });
  app.use(vite.middlewares);
} else {
  const distPath = path.resolve(__dirname, 'dist');
  app.use(express.static(distPath, { index: false, maxAge: '1y', immutable: true, setHeaders: (res, file) => {
    if (/(index\.html|sw\.js|version\.json|manifest\.webmanifest)$/.test(file)) res.setHeader('Cache-Control', 'no-cache');
  } }));
  // Express 5: '*' لم يعد مسار صالح
  app.get(/^(?!\/api\/).*/, (_req, res) => {
    res.setHeader('Cache-Control', 'no-cache');
    res.sendFile(path.resolve(distPath, 'index.html'));
  });
}

const PORT = Number(process.env.PORT) || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server listening on http://0.0.0.0:${PORT}`);
});
