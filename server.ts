import express, { type Request, type Response } from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Type, type Schema } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json({ limit: '10mb' }));

const TEXT_MODELS = ['gemini-2.5-flash', 'gemini-3.1-flash-lite', 'gemini-3.8-flash'];

const getDimensionsForAspectRatio = (aspectRatio: string): { width: number; height: number } => {
  switch (aspectRatio) {
    case '16:9':
      return { width: 800, height: 450 };
    case '9:16':
      return { width: 450, height: 800 };
    case '4:3':
      return { width: 800, height: 600 };
    case '3:4':
      return { width: 600, height: 800 };
    case '1:1':
    default:
      return { width: 600, height: 600 };
  }
};

const getApiKey = (): string => {
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
    throw new Error('GEMINI_API_KEY is not configured on the server. Please check your environment variables or Secrets panel.');
  }

  return key.trim();
};

const getAiClient = (): GoogleGenAI => {
  const apiKey = getApiKey();
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
};

const SYSTEM_INSTRUCTION = `You are building a PROFESSIONAL MVP SaaS called: "Sawan Kids Story Studio"
This is an AI-powered children story creation tool.

====================
CORE ROLE
====================
Act as a senior product AI that:
- Designs logic
- Generates structured outputs
- Thinks like a real SaaS product (not a demo)

====================
LANGUAGE & UI LOGIC
====================
Default language: English (LTR)

If the requested language is Arabic:
- Generate the story in Arabic suitable for kids
- Use simple Arabic, or the requested dialect if one is specified
- Avoid complex vocabulary

====================
CHARACTER CREATION
====================
Generate 1-3 main characters. For EACH character output name, age, gender,
a clear reusable appearance description, and a kid-friendly personality.

STRICT CHARACTER CONSTANCY RULES:
1. Use a FIXED set of characters across the entire story. Never introduce new
   random characters later.
2. Each character keeps exactly the same name, appearance, and species
   (especially animals) on every page.
3. Keep visual consistency: same distinguishing features, same colors, same style.
4. Never change or replace a character under any condition.

====================
STORY STRUCTURE
====================
Create the story as pages. Each page contains a page number, short child-friendly
story text (2-6 sentences), and a very detailed image prompt that matches the
established character appearance and the chosen art style.

Return ONLY the structured JSON matching the provided response schema. No prose,
no markdown fences, no commentary outside the JSON.`;

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
      },
      required: ['title', 'language', 'age_group', 'art_style', 'lessons'],
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
    pages: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          page: { type: Type.NUMBER },
          text: { type: Type.STRING },
          image_prompt: { type: Type.STRING },
        },
        required: ['page', 'text', 'image_prompt'],
      },
    },
  },
  required: ['story_info', 'characters', 'pages'],
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

async function generateContentWithRetry(ai: GoogleGenAI, requestConfig: any): Promise<any> {
  let lastError: any = null;
  for (const model of TEXT_MODELS) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const response = await ai.models.generateContent({
          ...requestConfig,
          model,
        });
        if (response.text) {
          return response;
        }
      } catch (err: any) {
        lastError = err;
        console.warn(`Model ${model} attempt ${attempt + 1} failed: ${err.message}`);
        if (err.status === 503 || err.status === 429) {
          await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
        } else {
          break;
        }
      }
    }
  }
  throw lastError || new Error('All candidate text models failed.');
}

// Generate an artistic SVG scene fallback if image model quota is exceeded
const generateFallbackIllustration = (prompt: string): string => {
  const hash = prompt.split('').reduce((acc, c) => (acc * 31 + c.charCodeAt(0)) % 360, 0);
  const hue1 = hash;
  const hue2 = (hash + 45) % 360;
  const hue3 = (hash + 180) % 360;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600" width="800" height="600">
    <defs>
      <linearGradient id="skyGrad" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stop-color="hsl(${hue1}, 70%, 82%)" />
        <stop offset="50%" stop-color="hsl(${hue2}, 65%, 88%)" />
        <stop offset="100%" stop-color="hsl(${hue3}, 60%, 93%)" />
      </linearGradient>
      <linearGradient id="groundGrad" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stop-color="hsl(${(hue1 + 90) % 360}, 50%, 75%)" />
        <stop offset="100%" stop-color="hsl(${(hue1 + 90) % 360}, 60%, 60%)" />
      </linearGradient>
      <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
        <feGaussianBlur stdDeviation="8" result="blur" />
        <feComposite in="SourceGraphic" in2="blur" operator="over" />
      </filter>
    </defs>

    <!-- Background -->
    <rect width="800" height="600" fill="url(#skyGrad)" />

    <!-- Distant hills/atmosphere -->
    <path d="M0,420 Q200,320 400,390 T800,360 L800,600 L0,600 Z" fill="hsl(${(hue1 + 120) % 360}, 40%, 82%)" opacity="0.6" />
    <path d="M0,450 Q300,380 600,430 T800,440 L800,600 L0,600 Z" fill="url(#groundGrad)" opacity="0.9" />

    <!-- Sun or Moon -->
    <circle cx="680" cy="130" r="55" fill="#FFE9A8" filter="url(#glow)" opacity="0.9" />

    <!-- Clouds / Stars -->
    <ellipse cx="220" cy="140" rx="70" ry="25" fill="#FFFFFF" opacity="0.75" />
    <ellipse cx="255" cy="125" rx="50" ry="30" fill="#FFFFFF" opacity="0.8" />
    <ellipse cx="190" cy="145" rx="45" ry="22" fill="#FFFFFF" opacity="0.75" />

    <ellipse cx="480" cy="190" rx="55" ry="20" fill="#FFFFFF" opacity="0.65" />
    <ellipse cx="510" cy="175" rx="40" ry="25" fill="#FFFFFF" opacity="0.7" />

    <!-- Stylized decorative elements -->
    <circle cx="140" cy="420" r="45" fill="hsl(${(hue1 + 100) % 360}, 50%, 45%)" />
    <rect x="133" y="440" width="14" height="60" rx="5" fill="#8B5A2B" />

    <circle cx="210" cy="435" r="35" fill="hsl(${(hue1 + 80) % 360}, 55%, 52%)" />
    <rect x="204" y="455" width="12" height="50" rx="4" fill="#8B5A2B" />

    <circle cx="670" cy="445" r="40" fill="hsl(${(hue1 + 110) % 360}, 45%, 48%)" />
    <rect x="664" y="470" width="12" height="55" rx="4" fill="#8B5A2B" />

    <!-- Sparkles -->
    <polygon points="350,160 354,172 366,176 354,180 350,192 346,180 334,176 346,172" fill="#FFE9A8" opacity="0.8" />
    <polygon points="560,110 563,120 573,123 563,126 560,136 557,126 547,123 557,120" fill="#FFFFFF" opacity="0.85" />
    <polygon points="420,250 422,258 430,260 422,262 420,270 418,262 410,260 418,258" fill="#FFE9A8" opacity="0.75" />

    <!-- Story vignette frame -->
    <rect x="20" y="20" width="760" height="560" rx="24" fill="none" stroke="rgba(255,255,255,0.4)" stroke-width="4" />
  </svg>`;

  return Buffer.from(svg).toString('base64');
};

// Story Generation endpoint
app.post('/api/generate-story', async (req: Request, res: Response) => {
  try {
    const { params, pageCount } = req.body;
    if (!params || !params.idea) {
      return res.status(400).json({ error: 'Story idea cannot be empty.' });
    }

    const ai = getAiClient();
    const langLine =
      params.language === 'Arabic'
        ? `Language: Arabic${params.dialect ? ` (${params.dialect} dialect)` : ''}`
        : 'Language: English';

    const prompt = [
      `Story idea: ${params.idea.trim().slice(0, 500)}`,
      langLine,
      `Age group: ${params.ageGroup || '4-6'}`,
      `Story type: ${params.storyType || 'Bedtime'}`,
      `Target page count: ${pageCount || 6}`,
      `Art style: ${params.artStyle || 'Classic Storybook'}`,
      'Follow the response schema exactly and return valid JSON only.',
    ].join('\n');

    const response = await generateContentWithRetry(ai, {
      contents: prompt,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        responseMimeType: 'application/json',
        responseSchema: STORY_RESPONSE_SCHEMA,
      },
    });

    const raw = response.text ?? '';
    let parsedData;
    try {
      parsedData = JSON.parse(raw);
    } catch {
      const cleaned = raw.replace(/```json|```/g, '').trim();
      parsedData = JSON.parse(cleaned);
    }

    if (!parsedData?.pages?.length || !parsedData?.characters?.length) {
      return res.status(502).json({ error: 'The model returned incomplete story data.' });
    }

    return res.json(parsedData);
  } catch (err: any) {
    console.error('Error generating story:', err);
    return res.status(500).json({ error: err.message || 'Failed to generate story' });
  }
});

// Illustration endpoint with multi-tier generation pipeline
app.post('/api/generate-image', async (req: Request, res: Response) => {
  try {
    const { prompt, aspectRatio } = req.body;
    if (!prompt) {
      return res.status(400).json({ error: 'Image prompt is required.' });
    }

    // 1. Try Gemini image models (supports accounts with active image quota)
    try {
      const ai = getAiClient();
      for (const model of ['gemini-3.1-flash-lite-image', 'gemini-3.1-flash-image', 'gemini-2.5-flash-image']) {
        try {
          const response = await ai.models.generateContent({
            model,
            contents: { parts: [{ text: prompt }] },
            config: {
              imageConfig: { aspectRatio: aspectRatio || '1:1' },
            },
          });

          const parts = response.candidates?.[0]?.content?.parts ?? [];
          const imagePart = parts.find((p) => p.inlineData?.data);

          if (imagePart?.inlineData?.data) {
            return res.json({ base64: imagePart.inlineData.data });
          }
        } catch (mErr: any) {
          console.warn(`Gemini image model ${model} unavailable:`, mErr.message);
        }
      }
    } catch (aiErr: any) {
      console.warn('Gemini client error in image generation:', aiErr.message);
    }

    // 2. High-quality AI image generation fallback (generates real illustrated JPGs)
    try {
      const { width, height } = getDimensionsForAspectRatio(aspectRatio || '1:1');
      const cleanPrompt = encodeURIComponent(`${prompt}, children book illustration, cute, soft lighting`);
      const seed = Math.floor(Math.random() * 1000000);
      const url = `https://image.pollinations.ai/prompt/${cleanPrompt}?width=${width}&height=${height}&seed=${seed}&nologo=true`;
      
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 12000);
      const imgRes = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SawanKidsStoryStudio/1.1)' },
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (imgRes.ok) {
        const arrayBuf = await imgRes.arrayBuffer();
        if (arrayBuf.byteLength > 2000) {
          const base64 = Buffer.from(arrayBuf).toString('base64');
          return res.json({ base64 });
        }
      }
    } catch (imgServiceErr: any) {
      console.warn('AI image service unavailable or timed out, using stylized SVG scene fallback:', imgServiceErr.message);
    }

    // 3. Guaranteed local SVG scene fallback
    const fallbackBase64 = generateFallbackIllustration(prompt);
    return res.json({ base64: fallbackBase64 });
  } catch (err: any) {
    console.error('Error in generate-image endpoint:', err);
    return res.status(500).json({ error: err.message || 'Failed to generate image' });
  }
});

// Name analysis endpoint
app.post('/api/analyze-name', async (req: Request, res: Response) => {
  try {
    const { name, language } = req.body;
    const trimmed = (name || '').trim().slice(0, 60);
    if (!trimmed) {
      return res.status(400).json({ error: 'Please enter a name first.' });
    }

    const ai = getAiClient();
    const prompt =
      language === 'Arabic'
        ? `حلّل اسم "${trimmed}" للأطفال: المعنى، الأصل، وثلاث صفات إيجابية مرتبطة به. أسلوب لطيف ومناسب للأطفال. أعد JSON فقط.`
        : `Analyze the name "${trimmed}" for kids: its meaning, origin, and three positive traits associated with it. Warm, kid-friendly tone. Return JSON only.`;

    const response = await generateContentWithRetry(ai, {
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: NAME_ANALYSIS_SCHEMA,
      },
    });

    const parsed = JSON.parse(response.text ?? '{}');
    return res.json(parsed);
  } catch (err: any) {
    console.error('Error analyzing name:', err);
    return res.status(500).json({ error: err.message || 'Failed to analyze name' });
  }
});

// Vite middleware (dev) / static files (prod)
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
  app.use(express.static(distPath));
  app.get('*', (_req, res) => {
    res.sendFile(path.resolve(distPath, 'index.html'));
  });
}

const PORT = 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server listening on http://0.0.0.0:${PORT}`);
});
