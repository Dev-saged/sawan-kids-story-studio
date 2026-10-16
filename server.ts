import express, { type Request, type Response } from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Modality, Type, type Schema } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json({ limit: '30mb' }));

// سلاسل النماذج: الأقوى أولاً، وكل نموذج له كوتا مستقلة
const MODELS = {
  text: ['gemini-3.8-flash', 'gemini-2.5-flash', 'gemini-3.1-flash-lite'],
  image: ['gemini-nano-banana-2.1', 'gemini-3-pro-image', 'gemini-3.1-flash-image', 'gemini-3.1-flash-lite-image'],
  tts: ['gemini-3.8-flash-tts', 'gemini-3.8-flash-lite-tts', 'gemini-3.1-flash-tts-preview', 'gemini-2.5-pro-preview-tts'],
  music: ['lyria-3-clip-preview', 'lyria-3.5'],
};
const LITE_IMAGE_MODELS = new Set(['gemini-3.1-flash-lite-image']);
const VOICES = new Set(['Sulafat', 'Vindemiatrix', 'Achernar', 'Algieba', 'Charon', 'Puck', 'Kore', 'Leda']);
const ASPECTS = new Set(['1:1', '16:9', '9:16', '4:3', '3:4']);
const KEY_PATTERN = /^[A-Za-z0-9_-]{30,}$/;

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
    throw Object.assign(new Error('GEMINI_API_KEY is not configured on the server.'), { status: 401 });
  }

  return key.trim();
};

// مفتاح الزائر (إن أرسله) له الأولوية على مفتاح البيئة
const getAiClient = (req: Request): GoogleGenAI => {
  const header = req.get('x-goog-api-key')?.trim();
  const apiKey = header && KEY_PATTERN.test(header) ? header : getEnvApiKey();
  return new GoogleGenAI({ apiKey, httpOptions: { headers: { 'User-Agent': 'aistudio-build' } } });
};

type ErrorKind = 'auth' | 'quota' | 'busy' | 'skip';

const classify = (err: any): ErrorKind => {
  const status = Number(err?.status ?? err?.code ?? 0);
  const msg = String(err?.message ?? '');
  if (/API_KEY_INVALID|API key not valid|PERMISSION_DENIED/i.test(msg) || status === 401 || status === 403) return 'auth';
  if (status === 429 || /RESOURCE_EXHAUSTED|quota/i.test(msg)) return 'quota';
  if (status >= 500 || /UNAVAILABLE|overloaded|ECONNRESET|ETIMEDOUT|fetch failed/i.test(msg)) return 'busy';
  return 'skip';
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// يجرب كل نموذج بالترتيب؛ إعادة محاولة بتأخير متصاعد عند الانشغال، وانتقال فوري عند الكوتا
async function runChain<T>(label: string, models: string[], attempt: (model: string) => Promise<T | null>): Promise<{ value: T; model: string }> {
  let lastError: any = null;
  let sawQuota = false;
  for (const model of models) {
    for (let i = 0; i < 3; i++) {
      try {
        const value = await attempt(model);
        if (value != null) return { value, model };
        break;
      } catch (err: any) {
        lastError = err;
        const kind = classify(err);
        console.warn(`[${label}] ${model} #${i + 1}: ${kind} — ${String(err?.message).slice(0, 160)}`);
        if (kind === 'auth') throw err;
        if (kind === 'quota') sawQuota = true;
        if (kind === 'busy' && i < 2) {
          await sleep(700 * 2 ** i + Math.random() * 400);
          continue;
        }
        break;
      }
    }
  }
  throw Object.assign(lastError ?? new Error(`${label}: no model returned output`), sawQuota ? { status: 429 } : {});
}

const sendError = (res: Response, err: any, fallback: string) => {
  const kind = classify(err);
  const code = kind === 'auth' ? 'AUTH' : kind === 'quota' ? 'QUOTA' : kind === 'busy' ? 'BUSY' : 'FAILED';
  const status = code === 'AUTH' ? 401 : code === 'QUOTA' ? 429 : code === 'BUSY' ? 503 : 500;
  if (!res.headersSent) res.status(status).json({ error: err?.message || fallback, code });
};

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

CHARACTERS
- 1-3 fixed main characters. Each keeps exactly the same name, species, face, hair, outfit and colors on every page.
- "description" is an ENGLISH visual design sheet: species, age look, skin/fur tone, hair, eyes, outfit with colors, one distinctive accessory.
- Never introduce random new characters later.

PAGES
- Each page: 2-6 short child-friendly sentences in "text".
- "image_prompt" is ALWAYS ENGLISH, 70-120 words, written like a director's shot description:
  main action and emotion, every character on the page BY NAME with 2-3 of their fixed visual traits repeated,
  setting details, time of day, lighting, camera shot (wide / medium / close-up / low angle), mood and color palette.
  Never put words, letters, captions or signs in the image.

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
  const prompt = [
    `Story idea: ${idea}`,
    isArabic ? `Language: Arabic (${clip(params.dialect, 30) || 'Modern Standard'})` : 'Language: English',
    `Age group: ${clip(params.ageGroup, 10) || '4-6'}`,
    `Story type: ${clip(params.storyType, 20) || 'Bedtime'}`,
    `Exact page count: ${Math.min(Math.max(Number(pageCount) || 6, 3), 16)}`,
    `Art style: ${clip(params.artStyle, 40) || 'Classic Storybook'}`,
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
    const { value } = await runChain('story', MODELS.text, async (model) => {
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
    const kind = classify(err);
    send({ t: 'error', error: err?.message || 'Failed to generate story', code: kind === 'auth' ? 'AUTH' : kind === 'quota' ? 'QUOTA' : kind === 'busy' ? 'BUSY' : 'FAILED' });
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

// صور Nano Banana فقط — لا SVG ولا مصادر خارجية
app.post('/api/generate-image', async (req: Request, res: Response) => {
  try {
    const prompt = clip(req.body?.prompt, 4000);
    if (!prompt) return res.status(400).json({ error: 'Image prompt is required.', code: 'FAILED' });
    const aspectRatio = ASPECTS.has(req.body?.aspectRatio) ? req.body.aspectRatio : '4:3';
    const refs = sanitizeRefs(req.body?.references);
    const ai = getAiClient(req);

    const lead = refs.length
      ? 'Use the attached reference image(s) as the exact character design: keep the same face, hairstyle, skin tone, outfit, colors and proportions. Do not copy their background or pose. '
      : '';
    const text = `${lead}${prompt} Masterpiece children's book illustration, sharp focus, rich detail, professional composition, consistent character design. Absolutely no text, letters, captions, logos or watermark.`;

    const { value, model } = await runChain('image', MODELS.image, async (m) => {
      const response = await ai.models.generateContent({
        model: m,
        contents: [{ role: 'user', parts: [...refs.map((r) => ({ inlineData: r })), { text }] }],
        config: {
          responseModalities: [Modality.TEXT, Modality.IMAGE],
          imageConfig: LITE_IMAGE_MODELS.has(m) ? { aspectRatio } : { aspectRatio, imageSize: '2K' },
        },
      });
      const part = (response.candidates?.[0]?.content?.parts ?? []).find((p) => p.inlineData?.data);
      return part?.inlineData?.data ? { base64: part.inlineData.data, mimeType: part.inlineData.mimeType || 'image/png' } : null;
    });

    return res.json({ ...value, model });
  } catch (err) {
    return sendError(res, err, 'Failed to generate image');
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

const narrationDirective = (language: string, dialect: string): string => {
  if (language !== 'Arabic') {
    return 'Read aloud as a warm, expressive professional storyteller for young children, clear diction, calm pace, natural pauses between sentences:';
  }
  if (!dialect || dialect === 'Modern Standard') {
    return 'Read the following Arabic text aloud as a warm, expressive professional storyteller for young children, in flawless Modern Standard Arabic (Fusha) with precise makharij and complete, correct i\'rab exactly as diacritized, calm pace, natural pauses between sentences:';
  }
  return `Read aloud as a warm, expressive professional storyteller for young children, in natural authentic ${dialect} Arabic, clear diction, calm pace, natural pauses:`;
};

app.post('/api/narrate', async (req: Request, res: Response) => {
  try {
    const text = clip(req.body?.text, 4000);
    if (!text) return res.status(400).json({ error: 'Narration text is required.', code: 'FAILED' });
    const voice = VOICES.has(req.body?.voice) ? req.body.voice : 'Sulafat';
    const directive = narrationDirective(clip(req.body?.language, 20), clip(req.body?.dialect, 30));
    const ai = getAiClient(req);

    const { value, model } = await runChain('tts', MODELS.tts, async (m) => {
      try {
        const response = await ai.models.generateContent({
          model: m,
          contents: [{ role: 'user', parts: [{ text: `${directive}\n\n${text}` }] }],
          config: {
            responseModalities: [Modality.AUDIO],
            speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } },
          },
        });
        const part = (response.candidates?.[0]?.content?.parts ?? []).find((p) => p.inlineData?.data);
        return part?.inlineData?.data ? toWavPayload(part.inlineData.data, part.inlineData.mimeType) : null;
      } catch (err) {
        if (classify(err) !== 'skip') throw err;
        // بعض نماذج TTS الجديدة متاحة عبر Interactions فقط
        const r: any = await (ai as any).interactions.create({
          model: m,
          input: `${directive}\n\n${text}`,
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
    const { value, model } = await runChain('music', MODELS.music, async (m) => {
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

    const { value } = await runChain('name', MODELS.text, async (model) => {
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
