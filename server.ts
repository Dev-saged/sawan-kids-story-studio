import express, { type Request, type Response } from 'express';
import fs from 'fs';
import crypto from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Modality, Type, type Schema } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json({ limit: '30mb' }));

// سلاسل النماذج: الأقوى أولاً، وكل نموذج له كوتا مستقلة
const MODELS = {
  text: [
    'gemini-2.5-flash',
    'gemini-3.8-flash',
    'gemini-3.1-flash-lite',
    'gemini-flash-latest',
    'gemini-flash-lite-latest',
    'gemini-2.5-flash-lite',
    'gemini-3.5-flash',
  ],
  image: [
    'gemini-2.5-flash-image',
    'gemini-3.1-flash-lite-image',
    'gemini-nano-banana-2.1',
    'gemini-3-pro-image',
    'gemini-3.1-flash-image',
  ],
  tts: [
    'gemini-3.8-flash-tts',
    'gemini-3.8-flash-lite-tts',
    'gemini-3.1-flash-tts-preview',
    'gemini-2.5-pro-preview-tts',
  ],
  music: ['lyria-3-clip-preview', 'lyria-3.5'],
};
// نماذج لا تقبل imageSize (ترفضه بخطأ 400): تأخذ نسبة الأبعاد فقط
const NO_SIZE_IMAGE_MODELS = new Set(['gemini-2.5-flash-image', 'gemini-3.1-flash-lite-image']);
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

// مفتاح الزائر له الأولوية؛ إن أرسل مفتاحاً بصيغة خاطئة نرفضه صراحةً بدل الرجوع الصامت لمفتاح البيئة
const getSession = (req: Request): Session => {
  const header = req.get('x-goog-api-key')?.trim();
  if (header && !KEY_PATTERN.test(header)) throw Object.assign(new Error('API key format is invalid.'), { status: 401 });
  const apiKey = header || getEnvApiKey();
  const fp = crypto.createHash('sha1').update(apiKey).digest('hex').slice(0, 12);
  let session = sessions.get(fp);
  if (!session) {
    if (sessions.size > 50) sessions.clear();
    session = { ai: new GoogleGenAI({ apiKey, httpOptions: { headers: { 'User-Agent': 'aistudio-build' } } }), fp, source: header ? 'user' : 'env' };
    sessions.set(fp, session);
  }
  return session;
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
  if (/API_KEY_INVALID|API key not valid|API key format|PERMISSION_DENIED/i.test(msg) || status === 401 || status === 403) return 'auth';
  if (status === 429 || /RESOURCE_EXHAUSTED|quota/i.test(msg)) return 'quota';
  if (status === 404 || /NOT_FOUND|is not found|not supported for/i.test(msg)) return 'missing';
  if (status >= 500 || /UNAVAILABLE|overloaded|ECONNRESET|ETIMEDOUT|fetch failed/i.test(msg)) return 'busy';
  return 'skip';
};

// حصة صفرية = النموذج غير مشمول بالخطة المجانية (يحتاج فوترة)، وليست حصة مؤقتة
const isZeroQuota = (msg: string) => /limit:\s*0\b|free_?tier/i.test(msg);

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// الفحص على الرسالة الكاملة قبل القص: عبارة limit: 0 تأتي في آخرها
const trailItem = (model: string, err: any): TrailItem => {
  const full = String(err?.message ?? err).replace(/\s+/g, ' ');
  return { model, kind: classify(err), status: Number(err?.status ?? err?.code ?? 0) || 0, message: full.slice(0, 480), zero: isZeroQuota(full) };
};

// يحدد الرمز الأدق للمستخدم من سجل محاولات كل النماذج
const failure = (label: string, trail: TrailItem[], last: any): Error => {
  const quota = trail.filter((t) => t.kind === 'quota');
  let code: ErrorCode = 'FAILED';
  if (quota.length) code = quota.every((t) => t.zero) ? 'BILLING' : 'QUOTA';
  else if (trail.length && trail.every((t) => t.kind === 'missing')) code = 'NOMODEL';
  else if (trail.some((t) => t.kind === 'busy')) code = 'BUSY';
  return Object.assign(last instanceof Error ? last : new Error(`${label}: no model returned output`), { code, trail });
};

// يجرب كل نموذج بالترتيب؛ إعادة محاولة بتأخير متصاعد عند الانشغال، وانتقال فوري عند الكوتا أو غياب النموذج
async function runChain<T>(label: string, models: string[], attempt: (model: string) => Promise<T | null>): Promise<{ value: T; model: string }> {
  let lastError: any = null;
  const trail: TrailItem[] = [];
  for (const model of models) {
    for (let i = 0; i < 3; i++) {
      try {
        const value = await attempt(model);
        if (value != null) return { value, model };
        trail.push({ model, kind: 'skip', status: 0, message: 'Model returned no output.' });
        break;
      } catch (err: any) {
        lastError = err;
        const item = trailItem(model, err);
        console.warn(`[${label}] ${model} #${i + 1}: ${item.kind} ${item.status} — ${item.message.slice(0, 160)}`);
        if (item.kind === 'auth') throw Object.assign(err instanceof Error ? err : new Error(item.message), { code: 'AUTH', trail: [...trail, item] });
        if (item.kind === 'busy' && i < 2) {
          await sleep(700 * 2 ** i + Math.random() * 400);
          continue;
        }
        trail.push(item);
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
  return { status, body: { error: err?.message || fallback, code, trail: Array.isArray(err?.trail) ? err.trail : undefined } };
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
  text: /^gemini-\d+(\.\d+)?-(flash|flash-lite|pro)$/,
  image: /^(gemini|nano)[\w.-]*image[\w.-]*$/,
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
    return res.json({
      ok: true,
      keySource: session.source,
      listed: catalog.names.size > 0,
      free: { configured: Boolean(getFreeCreds(req)) },
      models: { text: available('text'), image: available('image'), tts: available('tts'), music: available('music') },
    });
  } catch (err) {
    return sendError(res, err, 'Preflight failed');
  }
});

const SYSTEM_INSTRUCTION = `You are the story engine of "Sajed Kids Story Studio", a professional AI children's story product.

LANGUAGE
- Write "text", "title", "lessons", "moral" and "quiz" in the requested language.
- Arabic + Modern Standard: flawless, eloquent but simple Fusha suitable for kids. Correct grammar and i'rab. No colloquial words.
- Arabic + a dialect: natural, authentic phrasing of that dialect, still clean and kid-friendly.

NARRATION (field "narration", one per page)
- The exact same content as "text", prepared for a professional voice actor.
- Arabic Modern Standard: add COMPLETE, grammatically correct tashkeel (all harakat including case endings and shadda) on every word.
- Arabic dialect: same words as "text", add tashkeel only where pronunciation would be ambiguous.
- English: identical to "text".

CHARACTERS & VISUAL DESIGN (STRICT & POWERFUL)
- 1-3 fixed main characters. Every character must have an iconic, unmistakable visual identity.
- "description": Complete model sheet in ENGLISH: exact species, precise age look, skin/fur color and undertones, hairstyle and exact hair color (e.g. glossy ink-black bob with bangs, golden honey-brown messy curls), expressive luminous eyes with highlight reflection, signature outfit with exact colors (e.g. sapphire-blue knitted sweater over amber corduroy trousers), footwear, and one distinctive signature accessory (e.g. glowing bronze compass, carved wooden acorn brooch).
- Art styles must strictly adapt the visual rendering:
  * "Anime": Studio Ghibli / Makoto Shinkai aesthetic, luminous big expressive eyes, clean lines, lush cloudscapes, cinematic lighting.
  * "3D Cartoon / Pixar": Modern 3D animation studio style, tactile soft textures, subsurface glow, emotive facial expressions, warm volumetric light.
  * "Watercolor Storybook": Classic picture book style, textured washes, organic ink outlines, dreamy soft atmosphere.
  * "Comic / Webtoon": Vibrant dynamic panels, bold inks, expressive action lines, colorful saturated palette.
- Consistency Rule: On every single page, repeat the character's exact name and their 3 core visual signatures (hair, eye color, clothing color) so the character NEVER drifts.
- Never introduce random new characters later.

PAGES
- Each page: 2-6 short child-friendly sentences in "text".
- Optional "chapter": a short chapter title (3-5 words, in the story language) ONLY on the first page of each chapter.
- "image_prompt" is ALWAYS ENGLISH, 80-140 words, written like an award-winning animation director's shot description:
  exact camera shot (e.g. Cinematic close-up, Dutch angle, wide panoramic landscape), focal character(s) BY NAME with visual traits repeated performing a specific emotional action (e.g. wide astonished sparkling eyes, gentle comforting smile), background environmental details, time of day, lighting, color harmony.
  Never put words, letters, captions, signs, or watermarks in the image.

COVER, MUSIC, MORAL, QUIZ
- "cover_image_prompt": ENGLISH, 70-120 words, a striking hero composition of the main characters in the story's key setting that captures the title, cinematic lighting, no text.
- "music_prompt": ENGLISH, one sentence describing an instrumental soundtrack for this story (mood, tempo, instruments), gentle and child friendly, no vocals.
- "moral": one short sentence, the lesson of the story.
- "quiz": exactly 3 comprehension questions, each with 3 short options, "answer" = index (0-2) of the correct option, "page" = the page number the question is about.

Return ONLY JSON matching the response schema.`;

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
    return JSON.parse(raw.replace(/```json|```/g, '').trim());
  }
};

// بث النص سطراً سطراً (NDJSON): chunk / reset / done / error
app.post('/api/generate-story', async (req: Request, res: Response) => {
  const { params, pageCount } = req.body ?? {};
  const first = Math.min(Math.max(Number(pageCount) || 6, 3), 16);
  const total = Math.min(Math.max(Number(req.body?.totalPages) || first, first), 60);
  const idea = clip(params?.idea, 500);
  if (!idea) return res.status(400).json({ error: 'Story idea cannot be empty.', code: 'FAILED' });

  let ai: GoogleGenAI;
  try {
    ai = getAiClient(req);
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
  const prompt = [
    `Story idea: ${idea}`,
    isArabic ? `Language: Arabic (${clip(params.dialect, 30) || 'Modern Standard'})` : 'Language: English',
    `Age group: ${clip(params.ageGroup, 10) || '4-6'}`,
    `Story type: ${clip(params.storyType, 20) || 'Bedtime'}`,
    `Exact page count: ${first}`,
    total > first
      ? `LONG STORY: the finished book will have ${total} pages in ${Math.ceil(total / 6)} chapters. Write ONLY the opening ${first} pages now (chapter 1 and its set-up). Do NOT conclude the story: end on a natural moment that leads into what comes next. Give page 1 a "chapter" title. The quiz and moral can be provisional.`
      : '',
    `Art style: ${clip(params.artStyle, 40) || 'Classic Storybook'}`,
    ...seriesLines,
    heroName
      ? `HERO: the main character is a real child named "${heroName}". A reference photo of this child will be used for the illustrations, so describe the hero as "${heroName}, the child from the reference photo" plus a fixed outfit with colors.`
      : '',
  ]
    .filter(Boolean)
    .join('\n');

  res.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('X-Accel-Buffering', 'no');
  const send = (obj: object) => res.write(`${JSON.stringify(obj)}\n`);

  try {
    const { value } = await runChain('story', await chainFor(req, 'text'), async (model) => {
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
    });
    send({ t: 'done', story: value });
  } catch (err: any) {
    send({ t: 'error', ...errorInfo(err, 'Failed to generate story').body });
  }
  res.end();
});

interface InlineRef {
  data: string;
  mimeType: string;
}

const sanitizeRefs = (refs: unknown): InlineRef[] =>
  (Array.isArray(refs) ? refs : [])
    .filter((r: any) => typeof r?.data === 'string' && /^image\/(png|jpeg|webp)$/.test(r?.mimeType))
    .slice(0, 4)
    .map((r: any) => ({ data: r.data, mimeType: r.mimeType }));

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

// FLUX يتبع بداية الوصف أكثر: المشهد أولاً ثم الأسلوب والشخصيات، وقصّ ما يزيد عن حد النموذج
const fluxPrompt = (prompt: string, square: boolean): string => {
  const m = /(?:Scene|Composition):\s*([\s\S]*)$/.exec(prompt);
  const scene = (m ? m[1] : prompt).trim();
  const rest = m ? prompt.slice(0, m.index).trim() : '';
  const framing = square ? '' : ' Centered composition, key subjects in the middle, extra empty space above and below.';
  return `${scene} Children's picture book illustration, no text, no letters, no watermark.${framing} ${rest}`.slice(0, 1900);
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

// جلسات Gemini التي ثبت أن الصور عندها بلا حصة: نتخطاها مؤقتاً إلى المحرك المجاني بدل تكرار 7 محاولات فاشلة لكل صورة
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

// توليد الصور عبر نماذج Gemini الحصرية (gemini-2.5-flash-image, gemini-3.1-flash-lite-image, gemini-nano-banana-2.1, إلخ)
app.post('/api/generate-image', async (req: Request, res: Response) => {
  try {
    const prompt = clip(req.body?.prompt, 4000);
    if (!prompt) return res.status(400).json({ error: 'Image prompt is required.', code: 'FAILED' });
    const aspectRatio = ASPECTS.has(req.body?.aspectRatio) ? req.body.aspectRatio : '4:3';
    const refs = sanitizeRefs(req.body?.references);
    const session = getSession(req);

    const lead = refs.length
      ? 'Use the attached reference image(s) as the exact character design: keep the same face, hairstyle, skin tone, outfit, colors and proportions. Do not copy their background or pose. '
      : '';
    const text = `${lead}${prompt} Masterpiece children's book illustration, sharp focus, rich detail, professional composition, consistent character design. Absolutely no text, letters, captions, logos or watermark.`;

    try {
      const { value, model } = await runChain('image', await chainFor(req, 'image'), async (m) => {
        const response = await session.ai.models.generateContent({
          model: m,
          contents: [{ role: 'user', parts: [...refs.map((r) => ({ inlineData: r })), { text }] }],
          config: {
            responseModalities: [Modality.TEXT, Modality.IMAGE],
            imageConfig: NO_SIZE_IMAGE_MODELS.has(m) ? { aspectRatio } : { aspectRatio, imageSize: '2K' },
          },
        });
        const part = (response.candidates?.[0]?.content?.parts ?? []).find((p) => p.inlineData?.data);
        return part?.inlineData?.data ? { base64: part.inlineData.data, mimeType: part.inlineData.mimeType || 'image/png' } : null;
      });

      return res.json({ ...value, model, engine: 'gemini' });
    } catch (rasterErr: any) {
      console.warn('Raster image models unavailable on this tier; generating high-fidelity Gemini vector art...');
      const artStyle = clip(req.body?.artStyle, 80) || 'Anime Storybook';
      const svgPrompt = `You are an elite digital artist and children's storybook illustrator specializing in ${artStyle}.
Generate an extraordinary, complete, vibrant standalone SVG children's story illustration.
SCENE SPECIFICATION:
${prompt}
ART STYLE GUIDELINES:
- Style: ${artStyle} (Anime: Studio Ghibli/Makoto Shinkai style, lush sky & expressive sparkling eyes; 3D Cartoon: Pixar/Disney warm lighting & rounded joyful characters; Watercolor: delicate washes & warm storybook palette).
- Character Focus: Beautifully drawn characters with distinct facial expressions, glowing eyes, expressive poses, hair details, outfits with clean shadows and highlights.
- Environment & Lighting: Immersive background (sky, trees, room, nature, clouds), rich gradients (<linearGradient>, <radialGradient>), soft atmospheric lighting.
- TECHNICAL REQUIREMENTS:
1. Return ONLY pure, valid SVG code: <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600" width="100%" height="100%">...</svg>
2. Absolutely NO markdown backticks (no \`\`\`xml or \`\`\`svg), no text outside the SVG.
3. No letters, captions, watermark, or text rendered inside the image.`;

      const { value: svgCode, model: textModel } = await runChain('image-vector', await chainFor(req, 'text'), async (m) => {
        const resp = await session.ai.models.generateContent({
          model: m,
          contents: svgPrompt,
        });
        let raw = resp.text || '';
        raw = raw.replace(/^```(xml|svg)?/i, '').replace(/```$/g, '').trim();
        const match = raw.match(/<svg[\s\S]*<\/svg>/i);
        return match ? match[0] : null;
      });

      if (svgCode) {
        const base64 = Buffer.from(svgCode).toString('base64');
        return res.json({ base64, mimeType: 'image/svg+xml', model: `${textModel}-svg`, engine: 'gemini' });
      }
      throw rasterErr;
    }
  } catch (err) {
    return sendError(res, err, 'Failed to generate image with Gemini');
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

// النص فقط بلا أي تعليمات: أي جملة إضافية قد ينطقها النموذج بصوت عالٍ (كانت تظهر بالإنجليزية)
app.post('/api/narrate', async (req: Request, res: Response) => {
  try {
    const text = clip(req.body?.text, 4000);
    if (!text) return res.status(400).json({ error: 'Narration text is required.', code: 'FAILED' });
    const voice = VOICES.has(req.body?.voice) ? req.body.voice : 'Sulafat';
    const ai = getAiClient(req);

    const { value, model } = await runChain('tts', await chainFor(req, 'tts'), async (m) => {
      try {
        const response = await ai.models.generateContent({
          model: m,
          contents: [{ role: 'user', parts: [{ text }] }],
          config: {
            responseModalities: [Modality.AUDIO],
            speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } },
          },
        });
        const part = (response.candidates?.[0]?.content?.parts ?? []).find((p) => p.inlineData?.data);
        return part?.inlineData?.data ? toWavPayload(part.inlineData.data, part.inlineData.mimeType) : null;
      } catch (err) {
        if (!['skip', 'missing'].includes(classify(err))) throw err;
        // بعض نماذج TTS الجديدة متاحة عبر Interactions فقط
        const r: any = await (ai as any).interactions.create({
          model: m,
          input: text,
          response_format: { type: 'audio' },
          generation_config: { speech_config: [{ voice }] },
        });
        const audio = r?.output_audio;
        return audio?.data ? toWavPayload(audio.data, audio.mime_type) : null;
      }
    });

    return res.json({ ...value, model });
  } catch (err) {
    return sendError(res, err, 'Failed to narrate');
  }
});

// موسيقى خلفية مولّدة بـ Lyria (موسيقى بدون كلمات، بعلامة SynthID)
app.post('/api/music', async (req: Request, res: Response) => {
  try {
    const mood = clip(req.body?.prompt, 600) || 'A gentle, magical lullaby for a children storybook';
    const ai = getAiClient(req);
    const { value, model } = await runChain('music', await chainFor(req, 'music'), async (m) => {
      const r: any = await (ai as any).interactions.create({
        model: m,
        input: `${mood}. Instrumental only, no vocals, no lyrics. Soft, warm, child friendly, steady and loop-friendly, suitable as a quiet background under narration${m === 'lyria-3.5' ? ', about 60 seconds long' : ''}.`,
      });
      const audio = r?.output_audio;
      return audio?.data ? { base64: audio.data as string, mimeType: (audio.mime_type as string) || 'audio/mpeg' } : null;
    });
    return res.json({ ...value, model });
  } catch (err) {
    return sendError(res, err, 'Failed to generate music');
  }
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
  try {
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

    const ai = getAiClient(req);
    const prompt = [
      `Continue the children's story "${clip(info.title, 100)}".`,
      arabic ? `Language: Arabic (${clip(info.dialect, 30) || 'Modern Standard'})` : 'Language: English',
      `Age group: ${clip(info.ageGroup, 10) || '4-6'}. Art style: ${clip(info.artStyle, 40) || 'Classic Storybook'}.`,
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

    const { value } = await runChain('continue', await chainFor(req, 'text'), async (model) => {
      const response = await ai.models.generateContent({
        model,
        contents: prompt,
        config: { systemInstruction: SYSTEM_INSTRUCTION, responseMimeType: 'application/json', responseSchema: CONTINUE_SCHEMA },
      });
      const parsed = response.text ? parseJson(response.text) : null;
      return Array.isArray(parsed?.pages) && parsed.pages.length ? parsed : null;
    });
    return res.json({ ...value, pages: value.pages.slice(0, count) });
  } catch (err) {
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

    const ai = getAiClient(req);
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

    const { value } = await runChain('explain', await chainFor(req, 'text'), async (model) => {
      const response = await ai.models.generateContent({
        model,
        contents: prompt,
        config: { responseMimeType: 'application/json', responseSchema: EXPLAIN_SCHEMA },
      });
      const parsed = response.text ? parseJson(response.text) : null;
      if (!Array.isArray(parsed?.quiz) || !parsed.quiz.length) return null;
      if (mode === 'ask' && !parsed.answer) return null;
      return parsed;
    });
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

    const ai = getAiClient(req);
    const prompt = [
      'Rewrite this image-generation prompt for ONE page of a children picture book.',
      'Keep the same characters, setting and story event. Do not add text, captions or logos to the picture.',
      instruction ? `Apply this user instruction: ${instruction}` : `Change the camera: ${angle}.`,
      'Write in English, one paragraph, concrete visual details (composition, lighting, expression, colors), under 700 characters. Return JSON only.',
      sceneText ? `Story text of the page (context): ${sceneText}` : '',
      `Current prompt: ${current}`,
    ].filter(Boolean).join('\n');

    const { value } = await runChain('rewrite', await chainFor(req, 'text'), async (model) => {
      const response = await ai.models.generateContent({
        model,
        contents: prompt,
        config: { responseMimeType: 'application/json', responseSchema: REWRITE_SCHEMA },
      });
      const parsed = response.text ? parseJson(response.text) : null;
      return parsed?.prompt ? parsed : null;
    });
    return res.json({ prompt: clip(value.prompt, 1200) });
  } catch (err) {
    return sendError(res, err, 'Failed to rewrite prompt');
  }
});

app.post('/api/analyze-name', async (req: Request, res: Response) => {
  try {
    const { language } = req.body ?? {};
    const trimmed = clip(req.body?.name, 60);
    if (!trimmed) return res.status(400).json({ error: 'Please enter a name first.', code: 'FAILED' });

    const ai = getAiClient(req);
    const prompt =
      language === 'Arabic'
        ? `حلّل اسم "${trimmed}" للأطفال: المعنى، الأصل، وثلاث صفات إيجابية مرتبطة به. أسلوب لطيف ومناسب للأطفال. أعد JSON فقط.`
        : `Analyze the name "${trimmed}" for kids: its meaning, origin, and three positive traits associated with it. Warm, kid-friendly tone. Return JSON only.`;

    const { value } = await runChain('name', await chainFor(req, 'text'), async (model) => {
      const response = await ai.models.generateContent({
        model,
        contents: prompt,
        config: { responseMimeType: 'application/json', responseSchema: NAME_ANALYSIS_SCHEMA },
      });
      return response.text ? parseJson(response.text) : null;
    });
    return res.json(value);
  } catch (err) {
    return sendError(res, err, 'Failed to analyze name');
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
    if (/(index\.html|sw\.js|manifest\.webmanifest)$/.test(file)) res.setHeader('Cache-Control', 'no-cache');
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
