import type { ArtStyle } from '../src/types.ts';
import { STORY_TYPE_SPECS } from '../src/data/storyTypes.ts';

export { STORY_TYPE_SPECS };

// قواعد وقدرات نماذج الصور المشتركة بين الخادم (server.ts) والعميل (src/services/imageEngine.ts)
export const NO_SIZE_IMAGE_MODELS = new Set<string>([
  'gemini-2.5-flash-image',
  'gemini-3.1-flash-lite-image',
  'gemini-3.1-flash-image-preview',
  'gemini-nano-banana-2.1',
]);

// توجيه إيجابي مختصر بدلاً من القوائم السلبية الطويلة (15 كلمة فقط للحفاظ على سقف 120 كلمة)
export const POSITIVE_ILLUSTRATION_DIRECTIVE =
  'Depict each character once with proportionate anatomy and clean hands; no text, letters, or watermarks.';

// الأساليب الفنية الـ 18 الموحدة: وصف إيجابي مكثف وفخم (< 30 كلمة) بدون أي قوائم سلبية
export const SHARED_ART_STYLE_OPTIONS: { value: ArtStyle; labelAr: string; prompt: string }[] = [
  {
    value: 'Cute Cartoon',
    labelAr: 'كرتون لطيف',
    prompt: 'Masterpiece cute animated cartoon with expressive characters, smooth clean linework, vibrant cheerful color palette, rich lighting, and award-winning digital storybook artwork.',
  },
  {
    value: 'Hand-drawn Cartoon',
    labelAr: 'كرتون مرسوم باليد',
    prompt: 'Masterpiece hand-drawn illustration with organic ink outlines, expressive human brush strokes, rich harmonious colors, dramatic lighting, and authentic artistic warmth.',
  },
  {
    value: 'Watercolor',
    labelAr: 'ألوان مائية فاخرة',
    prompt: 'Luxury fine-art watercolor illustration with luminous translucent washes, delicate ink line detail, cold-press paper texture, and atmospheric golden lighting.',
  },
  {
    value: '3D Pixar Style',
    labelAr: 'ثلاثي الأبعاد سينمائي (بيكسار)',
    prompt: 'Masterpiece 3D CGI feature-film studio render with cinematic volumetric lighting, expressive facial acting, intricate hair and fabric textures, and rich depth.',
  },
  {
    value: 'Pastel Dream',
    labelAr: 'باستيل حالم',
    prompt: 'Luxury pastel illustration with dreamy atmospheric glow, luminous velvety gradients, cinematic soft lighting, and delicate harmonious fine-art brushwork.',
  },
  {
    value: 'Doodle Sketch',
    labelAr: 'رسومات فنية تخطيطية',
    prompt: 'Expressive artistic ink-and-wash sketch illustration with dynamic pen lines, masterful cross-hatching, rich watercolor accents, and lively composition.',
  },
  {
    value: 'Anime',
    labelAr: 'أنمي احترافي فخم',
    prompt: 'Masterpiece Japanese studio anime key visual, Ufotable and Makoto Shinkai quality, razor-sharp cel-shading, dynamic cinematic rim lighting, expressive eyes, and lush background.',
  },
  {
    value: 'Paper Cutout',
    labelAr: 'قصاصات ورقية فنية',
    prompt: 'Masterpiece layered handmade paper cut-out diorama illustration with rich craft paper textures, dramatic dimensional drop shadows, and vibrant tactile depth.',
  },
  {
    value: 'Educational Line Cartoon',
    labelAr: 'كرتون تعليمي واضح',
    prompt: 'Crisp educational vector-line illustration with clean bold outlines, vibrant balanced colors, expressive character poses, and crystal-clear visual storytelling.',
  },
  {
    value: 'Claymation',
    labelAr: 'صلصال / ستوب موشن',
    prompt: 'Masterpiece sculpted clay stop-motion studio frame with tactile handcrafted textures, cinematic miniature set lighting, and expressive detailed figures.',
  },
  {
    value: 'Flat Vector',
    labelAr: 'فلات فيكتور حديث',
    prompt: 'Luxury modern flat vector illustration with bold geometric composition, razor-sharp clean edges, dramatic lighting gradients, and sophisticated color harmony.',
  },
  {
    value: 'Fantasy Fairy Tale',
    labelAr: 'فانتازيا ملحمية ساحرة',
    prompt: 'Luxury enchanted fantasy illustration with dramatic golden chiaroscuro lighting, magical luminous particles, intricate world architecture, and rich painterly depth.',
  },
  {
    value: 'Bedtime Story',
    labelAr: 'قصة مسائية دافئة',
    prompt: 'Cozy atmospheric night illustration with serene moonlit indigo palette, warm golden lantern glow, rich painterly textures, and soothing cinematic lighting.',
  },
  {
    value: 'Classic Storybook',
    labelAr: 'رسم فني كلاسيكي فاخر',
    prompt: 'Timeless masterpiece book illustration in rich gouache and fine ink with masterful brushwork, dramatic lighting, intricate setting details, and expressive characters.',
  },
  {
    value: 'Pixel Art',
    labelAr: 'بكسل آرت متقن',
    prompt: 'Masterpiece high-bit pixel art scene with crisp pixel craftsmanship, dynamic lighting effects, rich parallax environment details, and expressive character sprites.',
  },
  {
    value: 'Chalk Drawing',
    labelAr: 'رسم بالطباشير الملون',
    prompt: 'Rich pastel chalk artwork on textured dark slate with luminous hand-blended strokes, dramatic highlights, and vibrant artistic depth.',
  },
  {
    value: 'Comic Book',
    labelAr: 'قصص مصورة (كوميكس فخم)',
    prompt: 'Masterpiece graphic novel comic illustration with bold dynamic ink linework, dramatic cel shading, heroic character anatomy, and cinematic action framing.',
  },
  {
    value: 'Photorealistic',
    labelAr: 'واقعي سينمائي فخم',
    prompt: 'Ultra-detailed cinematic photorealistic photography, 85mm prime lens, dramatic volumetric lighting, lifelike skin and fabric textures, and rich film color grading.',
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

  return `You are the master story & visual direction engine of "Sajed Story Studio", capable of crafting both enchanting children's stories and deep, cinematic stories for teens (13-18) and adults (18+).

AUDIENCE & CHARACTER MATURITY (CRITICAL)
- Always adapt the tone, vocabulary, plot complexity, and character ages to the requested Age Group and User Idea:
  1) KIDS ("3-4", "4-6", "7-9", "9-12"): Warm, imaginative, age-appropriate storytelling. Characters are children, cute animals, or family figures unless the user specifies otherwise.
  2) TEENS / YA ("13-18"): Dramatic, high-stakes young-adult storytelling with 15-18 year old protagonists, deeper emotional and moral choices, and dynamic cinematic visuals.
  3) ADULTS / MATURE ("18+" or when the user specifies an adult person/character): Write a sophisticated, eloquent, emotionally resonant story for ADULTS with mature themes, realistic psychology, and strong literary depth.
     * STRICT ADULT VISUAL RULE: When Age Group is "18+" or a character is an adult man/woman, you MUST describe them in "characters[].description", "cover_image_prompt", and EVERY "pages[].image_prompt" as a full-grown adult (e.g., "adult man, 32 years old, tall athletic build, trimmed beard..." or "adult woman, 28 years old, graceful mature features..."). NEVER describe adult characters as "child", "kid", "little boy", "little girl", or "young child"!

LANGUAGE
- Write "text", "title", "lessons", "moral" and "quiz" in the requested language.
- Arabic + Modern Standard: flawless, eloquent Fusha (simple for kids; rich, literary, and powerful for 13-18 and 18+). Correct grammar and i'rab.
- Arabic + a dialect: natural, authentic phrasing of that dialect matching the maturity of the audience.

NARRATION (field "narration", one per page)
- The exact same content as "text", prepared for a professional voice actor.
- Arabic Modern Standard: add COMPLETE, grammatically correct tashkeel (all harakat including case endings and shadda) on every word.
- Arabic dialect: same words as "text", add tashkeel only where pronunciation would be ambiguous.
- English: identical to "text".

CHARACTERS & VISUAL DESIGN (STRICT & LUXURY QUALITY)
- 1-3 fixed main characters. Respect the exact characters, names, ages, and roles from the user's prompt.
- "description": Concise ENGLISH visual model sheet (14-22 words) starting with the character's English/transliterated name, exact age and maturity ("adult 30-year-old man", "17-year-old teen boy", or "7-year-old child"), skin tone, hairstyle/color, eye color, facial details (e.g., beard, glasses), and signature outfit with exact colors.
- Supported Art Styles (all 18 official ArtStyle values from types.ts):
${stylesBlock}
- Consistency & Style Rule: On every single page, keep the character's exact visual identity and tailor the scene composition to the chosen Art Style (e.g., for "Anime", write dramatic Japanese studio anime key-visual framing, intense expressions, dynamic lighting, and detailed anime wardrobe).
- Never introduce random new characters later.

STORY TYPES & NARRATIVE ARCS (16 genres — follow the requested StoryType arc strictly):
${typesBlock}

PAGES & SCENE-TO-TEXT FIDELITY
- Each page: 2-6 sentences in "text" matching the target age group.
- Optional "chapter": a short chapter title (3-5 words, in the story language) ONLY on the first page of each chapter.
- "image_prompt" is ALWAYS ENGLISH, 40-65 words. It MUST faithfully depict the EXACT event, action, setting, and emotion happening in "text" on that specific page:
  * Mention the focal character(s) by their English/transliterated name AND brief visual tag (e.g. "Tariq (tall 30-year-old man in a dark coat)") performing the exact action of the page.
  * Specify camera angle, environment details, dramatic lighting, and mood.
  * Never write generic filler scenes that ignore what happened in the page text.
  * Never put words, letters, captions, signs, or watermarks in the image.

COVER, MUSIC, MORAL, QUIZ
- "cover_image_prompt": ENGLISH, 40-60 words, a breathtaking masterpiece cover composition of the main character(s) (with their exact age look and outfit) in the story's signature setting, dramatic cinematic lighting, no text.
- "music_prompt": ENGLISH, one sentence describing an instrumental soundtrack for this story (mood, tempo, instruments), no vocals.
- "moral": one short sentence capturing the core takeaway or reflection of the story.
- "quiz": exactly 3 comprehension questions, each with 3 short options, "answer" = index (0-2) of the correct option, "page" = the page number the question is about.

Return ONLY JSON matching the response schema.`;
};

