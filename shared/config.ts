import type { ArtStyle } from '../src/types.ts';
import { STORY_TYPE_SPECS } from '../src/data/storyTypes.ts';

export { STORY_TYPE_SPECS };

// قواعد وقدرات نماذج الصور المشتركة بين الخادم (server.ts) والعميل (src/services/imageEngine.ts)
export const NO_SIZE_IMAGE_MODELS = new Set<string>([
  'gemini-2.5-flash-image',
  'gemini-3.1-flash-lite-image',
  'gemini-nano-banana-2.1',
]);

// توجيه إيجابي مختصر بدلاً من القوائم السلبية الطويلة (15 كلمة فقط للحفاظ على سقف 120 كلمة)
export const POSITIVE_ILLUSTRATION_DIRECTIVE =
  'Depict each character once with proportionate anatomy and clean hands; no text, letters, or watermarks.';

// الأساليب الفنية الـ 18 الموحدة: وصف إيجابي مكثف (< 30 كلمة) بدون أي قوائم سلبية
export const SHARED_ART_STYLE_OPTIONS: { value: ArtStyle; labelAr: string; prompt: string }[] = [
  {
    value: 'Cute Cartoon',
    labelAr: 'كرتون لطيف',
    prompt: 'Masterpiece cute children cartoon with adorable expressive characters, smooth clean linework, vibrant cheerful color palette, and award-winning digital storybook artwork.',
  },
  {
    value: 'Hand-drawn Cartoon',
    labelAr: 'كرتون مرسوم باليد',
    prompt: 'Warm hand-drawn cartoon illustration with organic ink outlines, gentle human brush strokes, soft harmonious colors, and charming human illustrator warmth.',
  },
  {
    value: 'Watercolor',
    labelAr: 'ألوان مائية',
    prompt: 'Storybook watercolor illustration with soft translucent luminous washes, fine delicate ink line detail, textured cold-press paper grain, and warm lighting.',
  },
  {
    value: '3D Pixar Style',
    labelAr: 'ثلاثي الأبعاد (بيكسار)',
    prompt: 'Cinematic 3D animated studio render with soft volumetric lighting, expressive eyes, warm tactile textures, friendly rounded shapes, and vibrant colors.',
  },
  {
    value: 'Pastel Dream',
    labelAr: 'باستيل حالم',
    prompt: 'Soft pastel storybook illustration with dreamy cozy atmosphere, luminous muted gradients, gentle fairytale lighting, and delicate harmonious brushwork.',
  },
  {
    value: 'Doodle Sketch',
    labelAr: 'رسومات خربشية',
    prompt: 'Playful sketchy doodle storybook illustration with loose expressive pen lines, creative hand-crafted hatching, and cheerful storybook wash colors.',
  },
  {
    value: 'Anime',
    labelAr: 'أنمي للأطفال',
    prompt: 'Studio anime children illustration with luminous expressive eyes, clean cel-shading, rich atmospheric backgrounds, vivid glowing sunlight, and crisp linework.',
  },
  {
    value: 'Paper Cutout',
    labelAr: 'قصاصات ورقية',
    prompt: 'Layered handmade paper cut-out collage illustration with rich craft paper textures, soft dimensional drop shadows, and vibrant tactile depth.',
  },
  {
    value: 'Educational Line Cartoon',
    labelAr: 'كرتون تعليمي خطي',
    prompt: 'Clear educational line cartoon illustration with crisp black outlines, bright friendly flat colors, expressive cheerful faces, and clean composition.',
  },
  {
    value: 'Claymation',
    labelAr: 'صلصال / ستوب موشن',
    prompt: 'Handmade plasticine clay stop-motion illustration with subtle tactile fingerprint textures, miniature studio set lighting, and charming sculpted characters.',
  },
  {
    value: 'Flat Vector',
    labelAr: 'فلات فيكتور',
    prompt: 'Modern flat vector children book illustration with bold geometric shapes, crisp clean edges, balanced composition, and vibrant harmonious palette.',
  },
  {
    value: 'Fantasy Fairy Tale',
    labelAr: 'خيال قصصي',
    prompt: 'Enchanted fantasy fairy-tale illustration with magical glowing light particles, lush storybook environments, dramatic warm illumination, and rich saturated colors.',
  },
  {
    value: 'Bedtime Story',
    labelAr: 'قصة قبل النوم',
    prompt: 'Cozy bedtime picture book illustration with serene moonlit night palette, warm golden lantern glow, and soothing gentle atmosphere.',
  },
  {
    value: 'Classic Storybook',
    labelAr: 'كتاب قصص كلاسيكي',
    prompt: 'Timeless classic picture-book illustration in warm gouache and ink with rich artistic brushwork, vintage fairytale charm, and expressive characters.',
  },
  {
    value: 'Pixel Art',
    labelAr: 'بكسل آرت',
    prompt: 'Vibrant 16-bit pixel art storybook illustration with crisp pixel craftsmanship, charming retro adventure aesthetics, and rich colorful sprites.',
  },
  {
    value: 'Chalk Drawing',
    labelAr: 'رسم بالطباشير',
    prompt: 'Textured pastel chalk drawing on a dark slate board with vibrant hand-blended chalk strokes and warm playful highlights.',
  },
  {
    value: 'Comic Book',
    labelAr: 'قصص مصورة',
    prompt: 'Dynamic kids graphic novel comic illustration with bold expressive ink outlines, energetic composition, halftone shading, and vivid colors.',
  },
  {
    value: 'Photorealistic',
    labelAr: 'واقعي',
    prompt: 'Cinematic natural photography style with realistic lighting, authentic textures, lifelike depth of field, and warm natural color grading.',
  },
];

export const buildSharedSystemInstruction = (): string => {
  const stylesBlock = SHARED_ART_STYLE_OPTIONS.map((s) => `  * "${s.value}": ${s.prompt}`).join('\n');
  const typesBlock = Object.values(STORY_TYPE_SPECS)
    .map(
      (t) =>
        `  * "${t.value}" (${t.label.ar}): Tone: ${t.tone}. Pacing: ${t.pacing}. Arc: [Beginning: ${t.arcEn?.beginning ?? t.arc.beginning} | Middle: ${t.arcEn?.middle ?? t.arc.middle} | Climax: ${t.arcEn?.climax ?? t.arc.climax} | Ending: ${t.arcEn?.ending ?? t.arc.ending}]. Rule: ${t.pageRule}`
    )
    .join('\n');

  return `You are the story engine of "Sajed Kids Story Studio", a professional AI children's story product.

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
- "description": Concise ENGLISH visual model sheet (12-20 words): exact species, age look, skin/fur tone, hairstyle and hair color, eye color, and signature outfit with exact colors.
- Supported Art Styles (all 18 official ArtStyle values from types.ts):
${stylesBlock}
- Consistency Rule: On every single page, keep the character's exact name and core visual traits so the character NEVER drifts.
- Never introduce random new characters later.

STORY TYPES & NARRATIVE ARCS (16 genres — follow the requested StoryType arc strictly):
${typesBlock}

PAGES
- Each page: 2-6 short child-friendly sentences in "text".
- Optional "chapter": a short chapter title (3-5 words, in the story language) ONLY on the first page of each chapter.
- "image_prompt" is ALWAYS ENGLISH, 35-65 words, describing the concrete scene action, camera angle, focal character(s) BY NAME performing a specific action, setting details, and lighting.
- Never put words, letters, captions, signs, or watermarks in the image.

COVER, MUSIC, MORAL, QUIZ
- "cover_image_prompt": ENGLISH, 35-60 words, a striking hero composition of the main characters in the story's key setting that captures the title, cinematic lighting, no text.
- "music_prompt": ENGLISH, one sentence describing an instrumental soundtrack for this story (mood, tempo, instruments), gentle and child friendly, no vocals.
- "moral": one short sentence, the lesson of the story.
- "quiz": exactly 3 comprehension questions, each with 3 short options, "answer" = index (0-2) of the correct option, "page" = the page number the question is about.

Return ONLY JSON matching the response schema.`;
};
