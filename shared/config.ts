import type { ArtStyle, StoryType, StoryTypeSpec } from '../src/types.ts';

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

// جدول أنواع القصص الـ 16 مع البنية السردية الإلزامية والنبرة وقواعد الصفحات
export const STORY_TYPE_SPECS: Record<StoryType, StoryTypeSpec> = {
  Bedtime: {
    value: 'Bedtime',
    label: { ar: 'قبل النوم', en: 'Bedtime' },
    desc: { ar: 'إيقاع هادئ متناقص يبعث الطمأنينة والنعاس', en: 'Gentle winding-down rhythm for peaceful sleep' },
    isPrimary: true,
    tone: 'Soothing, hushed, warm, comforting, lyrical',
    pacing: 'Gradually slowing cadence; shorter, calmer sentences toward the final pages',
    arc: {
      beginning: 'Introduce the hero in a cozy twilight setting preparing to rest.',
      middle: 'A gentle, quiet evening wonder (stars, moonbeams, sleepy nature friends).',
      climax: 'A moment of warm gratitude, soft lullaby comfort, and feeling safe.',
      ending: 'The hero drifts peacefully to sleep under a calm starry sky.',
    },
    pageRule: 'Every page must lower sensory stimulation and end on a tranquil, reassuring image.',
  },
  Adventure: {
    value: 'Adventure',
    label: { ar: 'مغامرة', en: 'Adventure' },
    desc: { ar: 'رحلة شجاعة واستكشاف وتجاوز عقبات مشوقة', en: 'Exciting quest, discovery, and overcoming obstacles' },
    isPrimary: true,
    tone: 'Energetic, curious, courageous, vivid',
    pacing: 'Dynamic forward momentum with escalating discovery',
    arc: {
      beginning: 'Call to adventure triggered by a map, mysterious signal, or friend in need.',
      middle: 'Crossing into an exciting new terrain and facing two progressive obstacles.',
      climax: 'The hero uses courage and resourcefulness to solve the central challenge.',
      ending: 'Triumphant return home with newfound wisdom and celebrated friendship.',
    },
    pageRule: 'Each page must feature a distinct physical action and changing visual scenery.',
  },
  Funny: {
    value: 'Funny',
    label: { ar: 'مضحكة', en: 'Funny' },
    desc: { ar: 'مواقف طريفة ومفارقات مبهجة تثير الضحك', en: 'Hilarious mishaps, playful misunderstandings, and joy' },
    isPrimary: true,
    tone: 'Playful, witty, lighthearted, exuberant',
    pacing: 'Snappy comic timing with rule-of-three escalations',
    arc: {
      beginning: 'An amusing everyday goal goes hilariously sideways due to a quirky idea.',
      middle: 'Three escalating, silly attempts to fix the problem that make it funnier.',
      climax: 'A joyful, unexpected comedic twist that surprises everyone.',
      ending: 'Shared laughter and a warm, cheerful resolution.',
    },
    pageRule: 'Include visual slapstick or expressive comedic reactions in every scene.',
  },
  Educational: {
    value: 'Educational',
    label: { ar: 'تعليمية', en: 'Educational' },
    desc: { ar: 'تبسيط العلوم والمعارف من خلال التجربة والاكتشاف', en: 'Hands-on discovery of science, nature, or skills' },
    isPrimary: true,
    tone: 'Inquisitive, clear, encouraging, wonder-filled',
    pacing: 'Step-by-step inquiry from question to observation to understanding',
    arc: {
      beginning: 'The hero encounters a fascinating real-world phenomenon and asks "Why?"',
      middle: 'Observing, experimenting, and testing hypotheses in a fun tangible way.',
      climax: 'The "Eureka!" moment where the scientific or practical concept clicks.',
      ending: 'Applying the new knowledge to help others or build something useful.',
    },
    pageRule: 'Weave accurate, age-appropriate facts naturally into action without sounding like a textbook.',
  },
  Moral: {
    value: 'Moral',
    label: { ar: 'أخلاقية', en: 'Moral' },
    desc: { ar: 'غرس القيم النبيلة كالصدق والأمانة والتعاون', en: 'Heartfelt lessons on honesty, empathy, and integrity' },
    isPrimary: true,
    tone: 'Sincere, empathetic, reflective, uplifting',
    pacing: 'Balanced character-driven progression focusing on choices and consequences',
    arc: {
      beginning: 'The hero faces a relatable temptation or interpersonal dilemma.',
      middle: 'Experiencing the ripple effects of their initial choice on friends or family.',
      climax: 'Choosing honesty, kindness, or responsibility even when it feels difficult.',
      ending: 'Restored trust, inner peace, and a clear takeaway value.',
    },
    pageRule: 'Show the moral through character choices and emotional expressions rather than preaching.',
  },
  Mystery: {
    value: 'Mystery',
    label: { ar: 'ألغاز وغموض', en: 'Mystery' },
    desc: { ar: 'لغز في الصفحة الأولى و3 قرائن تقود لاستنتاج ذكي', en: 'Page-1 puzzle, 3 progressive clues, logical deduction' },
    isPrimary: false,
    tone: 'Intriguing, observant, clever, suspenseful yet safe',
    pacing: 'Measured detective cadence with clue placement and deduction',
    arc: {
      beginning: 'Page 1 MUST present a clear, intriguing mystery or missing item with an initial trace.',
      middle: 'Uncover exactly 3 progressive visual and narrative clues across the middle pages, ruling out a red herring.',
      climax: 'The hero connects all 3 clues using logical deduction before the final page.',
      ending: 'The mystery is solved fairly, revealing a heartwarming or surprising truth.',
    },
    pageRule: 'Page 1 introduces the mystery; middle pages embed 3 visible clues in both text and image_prompt; climax shows logical deduction.',
  },
  Fantasy: {
    value: 'Fantasy',
    label: { ar: 'خيال وسحر', en: 'Fantasy' },
    desc: { ar: 'عوالم مسحورة وكائنات عجائبية تبهر الخيال', en: 'Enchanted realms, magical artifacts, and wonder' },
    isPrimary: false,
    tone: 'Magical, awe-inspiring, whimsical, poetic',
    pacing: 'Rich world-building flowing into an enchanted quest',
    arc: {
      beginning: 'Stepping through a hidden portal or discovering a magical object with a clear rule.',
      middle: 'Journeying through luminous fantastical landscapes and befriending magical creatures.',
      climax: 'Using inner kindness rather than brute magic to restore harmony to the realm.',
      ending: 'Returning with a lasting spark of wonder.',
    },
    pageRule: 'Fill every image_prompt with magical lighting, enchanted flora, and imaginative architecture.',
  },
  SciFi: {
    value: 'SciFi',
    label: { ar: 'خيال علمي وفضاء', en: 'Sci-Fi & Space' },
    desc: { ar: 'استكشاف الكواكب والروبوتات وابتكارات المستقبل', en: 'Space exploration, friendly robots, and future tech' },
    isPrimary: false,
    tone: 'Futuristic, inventive, optimistic, cosmic',
    pacing: 'Crisp mission-style progression with problem-solving',
    arc: {
      beginning: 'Launch of a cosmic mission or activation of a quirky invention.',
      middle: 'Navigating zero-gravity challenges, alien ecosystems, or robotic puzzles.',
      climax: 'Engineering a clever scientific solution to save the mission.',
      ending: 'Looking out at the vast universe with curiosity and teamwork.',
    },
    pageRule: 'Include futuristic gadgets, spacecraft, or cosmic environments in every scene.',
  },
  Fable: {
    value: 'Fable',
    label: { ar: 'حكاية حيوانات رمزية', en: 'Animal Fable' },
    desc: { ar: 'حكمة بليغة على لسان الحيوانات والطيور على غرار كليلة ودمنة', en: 'Classic wisdom told through talking animals' },
    isPrimary: false,
    tone: 'Timeless, wise, allegorical, charming',
    pacing: 'Classic folkloric cadence leading to a memorable proverb',
    arc: {
      beginning: 'Two contrasting animal characters with opposite traits (e.g., hasty vs. patient) meet in nature.',
      middle: 'A shared seasonal challenge tests both of their approaches.',
      climax: 'Wisdom and cooperation prevail over pride or haste.',
      ending: 'A memorable proverb-like moral summarizing the fable.',
    },
    pageRule: 'Characters must retain consistent animal species traits and expressive anthropomorphic gestures.',
  },
  Historical: {
    value: 'Historical',
    label: { ar: 'تاريخية وحضارية', en: 'Historical' },
    desc: { ar: 'رحلة عبر العصور الذهبية والعلماء والمدن العريقة', en: 'Journey through golden eras, scholars, and heritage' },
    isPrimary: false,
    tone: 'Authentic, inspiring, culturally rich, respectful',
    pacing: 'Immersive period storytelling with vivid historical detail',
    arc: {
      beginning: 'Set the stage in a vivid historical era (e.g., Golden Age Baghdad, ancient Jerusalem, Andalusia) with authentic period attire.',
      middle: 'The young hero assists a scholar, artisan, or explorer on a meaningful cultural achievement.',
      climax: 'Overcoming a period-accurate challenge through perseverance and knowledge.',
      ending: 'Connecting the historical legacy to inspiring the present.',
    },
    pageRule: 'Ensure architecture, clothing, and tools in image_prompt strictly match the historical era with zero modern anachronisms.',
  },
  Rhyme: {
    value: 'Rhyme',
    label: { ar: 'شعرية مقفّاة (سجع)', en: 'Rhyming & Musical' },
    desc: { ar: 'نص موزون بقافية وسجع جميل يطرب الأذن عند القراءة', en: 'Musical rhyming verses and rhythmic cadence on every page' },
    isPrimary: false,
    tone: 'Melodic, rhythmic, joyful, lyrical',
    pacing: 'Consistent meter and rhyming couplets/saj on every single page',
    arc: {
      beginning: 'Open with a catchy rhythmic refrain introducing the hero.',
      middle: 'Playful rhyming verses that build momentum and invite read-along chanting.',
      climax: 'A joyful musical crescendo where the central problem is resolved in verse.',
      ending: 'Return to the soothing opening refrain with a final rhyming couplet.',
    },
    pageRule: 'EVERY page text MUST use authentic rhyming sentences or musical Arabic Saj (سجع وقافية موزونة) that sound delightful aloud.',
  },
  Interactive: {
    value: 'Interactive',
    label: { ar: 'تفاعلية وتفكير', en: 'Interactive Quest' },
    desc: { ar: 'تشرك الطفل بسؤال أو ملاحظة ذكية في نهاية كل مشهد', en: 'Engages the young reader with observation prompts' },
    isPrimary: false,
    tone: 'Participatory, curious, direct, engaging',
    pacing: 'Action beat followed by a brief interactive question or spot-it challenge',
    arc: {
      beginning: 'Invite the reader directly as a co-explorer helping the hero.',
      middle: 'Each scene presents a choice or visual clue for the child to think about.',
      climax: 'The combined cleverness of the hero and reader unlocks the final puzzle.',
      ending: 'Celebrate the reader as a true hero of the story.',
    },
    pageRule: 'End each page with a short interactive question or observation prompt addressed warmly to the child.',
  },
  Therapeutic: {
    value: 'Therapeutic',
    label: { ar: 'تربوية وعلاجية للنفس', en: 'Emotional & Therapeutic' },
    desc: { ar: 'تسمية المشاعر وتجاوز الخوف أو القلق بأداة تهدئة عملية', en: 'Naming feelings, safe validation, and calming coping tools' },
    isPrimary: false,
    tone: 'Deeply empathetic, validating, gentle, psychologically safe',
    pacing: 'Calm emotional arc: Naming the feeling -> Safe space -> Coping tool -> Reassurance',
    arc: {
      beginning: 'Name the big emotion clearly (fear of the dark, first-day anxiety, jealousy, anger) without judgment.',
      middle: 'Place the hero in a safe, supportive situation where a wise mentor or parent validates the feeling.',
      climax: 'Practice a concrete, child-friendly calming tool (deep belly breathing, counting stars, grounding touch).',
      ending: 'The hero feels empowered, calm, and deeply loved.',
    },
    pageRule: 'Follow the 4-step therapeutic arc strictly: name the emotion -> safe validation -> practical calming exercise -> warm reassurance.',
  },
  Prophets: {
    value: 'Prophets',
    label: { ar: 'قصص الأنبياء والسيرة', en: 'Prophets & Seerah' },
    desc: { ar: 'وقائع ثابتة بأدب رفيع مع منع تجسيد الأنبياء في الصور نهائياً', en: 'Authentic prophetic stories with non-figurative sacred scenes' },
    isPrimary: false,
    tone: 'Reverent, eloquent, inspiring, historically faithful',
    pacing: 'Dignified narrative progression grounded in established Islamic accounts',
    arc: {
      beginning: 'Introduce the historical setting, the people, and the noble mission of patience and faith.',
      middle: 'Recount the authentic trials, miracles, or wisdom with accuracy and child-appropriate clarity.',
      climax: 'Divine relief, mercy, and the triumph of truth and patience.',
      ending: 'Clear spiritual and ethical lessons for the child’s daily life.',
    },
    pageRule: 'STRICT SACRED RULE: Stick to authentic established events only. In "image_prompt" and "cover_image_prompt", NEVER depict or draw any Prophet or companion as a human figure; depict ONLY landscapes, architecture, radiant light rays, nature, vessels, or symbolic objects.',
  },
  Folklore: {
    value: 'Folklore',
    label: { ar: 'تراث وحكايات شعبية', en: 'Arabian & World Folklore' },
    desc: { ar: 'أجواء الحكواتي الدافئة والأمثال الشعبية الأصيلة', en: 'Traditional Hakawati storytelling and cultural heritage' },
    isPrimary: false,
    tone: 'Nostalgic, warm Hakawati cadence, culturally rooted',
    pacing: 'Classic "Kan ya ma kan" opening into a rich community tale',
    arc: {
      beginning: 'Open with a traditional storytelling cadence in a vibrant heritage village or courtyard.',
      middle: 'A clever test of generosity, hospitality, or community cooperation.',
      climax: 'Traditional wisdom and neighborly solidarity solve the hardship.',
      ending: 'A warm Hakawati closing blessing and cultural proverb.',
    },
    pageRule: 'Include authentic traditional crafts, courtyards, olive groves, or lanterns in the visual descriptions.',
  },
  Sports: {
    value: 'Sports',
    label: { ar: 'رياضة وروح الفريق', en: 'Sports & Teamwork' },
    desc: { ar: 'حماس الملاعب، التدريب، الروح الرياضية، والعمل الجماعي', en: 'Athletic perseverance, fair play, and team spirit' },
    isPrimary: false,
    tone: 'Motivating, energetic, fair-minded, spirited',
    pacing: 'Brisk training and match-day rhythm',
    arc: {
      beginning: 'The hero and team prepare for a big match or personal athletic milestone.',
      middle: 'Facing a setback, missed goal, or coordination challenge during practice.',
      climax: 'Choosing teamwork, passing the ball, and fair play over solo glory in the decisive moment.',
      ending: 'Celebrating effort, sportsmanship, and mutual respect regardless of the scoreboard.',
    },
    pageRule: 'Show dynamic movement, expressive athletic postures, and supportive team interactions.',
  },
};

export const buildSharedSystemInstruction = (): string => {
  const stylesBlock = SHARED_ART_STYLE_OPTIONS.map((s) => `  * "${s.value}": ${s.prompt}`).join('\n');
  const typesBlock = Object.values(STORY_TYPE_SPECS)
    .map(
      (t) =>
        `  * "${t.value}" (${t.label.ar}): Tone: ${t.tone}. Pacing: ${t.pacing}. Arc: [Beginning: ${t.arc.beginning} | Middle: ${t.arc.middle} | Climax: ${t.arc.climax} | Ending: ${t.arc.ending}]. Rule: ${t.pageRule}`
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
