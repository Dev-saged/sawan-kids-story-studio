import {
  AgeGroup,
  ArabicDialect,
  ArtStyle,
  AspectRatio,
  Language,
  GameDefinition,
  ReadLearnArticle,
  StoryLength,
  StoryType,
} from './types';

// Centralized model IDs — single source of truth so a Gemini deprecation notice
// only ever requires editing these two lines.
// gemini-3-flash-preview / gemini-2.5-flash-image (the original spec's picks) are being
// superseded by GA endpoints; using the current stable GA models avoids preview
// rate limits and the Aug 17, 2026 preview-endpoint sunset window.
export const TEXT_MODEL = 'gemini-3.6-flash';
export const IMAGE_MODEL = 'gemini-3.1-flash-image';

export const MAX_IDEA_LENGTH = 500;
export const IMAGE_BATCH_SIZE = 3;

export const SYSTEM_INSTRUCTION = `You are building a PROFESSIONAL MVP SaaS called: "Sajed Kids Story Studio"
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

export const DIALECT_OPTIONS: { value: ArabicDialect; label: string; flag: string }[] = [
  { value: 'Modern Standard', label: 'الفصحى المبسطة', flag: '📚' },
  { value: 'Egyptian', label: 'المصرية', flag: '🇪🇬' },
  { value: 'Saudi', label: 'السعودية', flag: '🇸🇦' },
  { value: 'Gulf', label: 'الخليجية', flag: '🌊' },
  { value: 'Palestinian', label: 'الفلسطينية', flag: '🇵🇸' },
  { value: 'Levantine', label: 'الشامية', flag: '🌿' },
  { value: 'Syrian', label: 'السورية', flag: '🇸🇾' },
  { value: 'Lebanese', label: 'اللبنانية', flag: '🇱🇧' },
  { value: 'Jordanian', label: 'الأردنية', flag: '🇯🇴' },
  { value: 'Iraqi', label: 'العراقية', flag: '🇮🇶' },
  { value: 'Emirati', label: 'الإماراتية', flag: '🇦🇪' },
  { value: 'Kuwaiti', label: 'الكويتية', flag: '🇰🇼' },
  { value: 'Moroccan', label: 'المغربية', flag: '🇲🇦' },
  { value: 'Algerian', label: 'الجزائرية', flag: '🇩🇿' },
  { value: 'Tunisian', label: 'التونسية', flag: '🇹🇳' },
  { value: 'Libyan', label: 'الليبية', flag: '🇱🇾' },
  { value: 'Sudanese', label: 'السودانية', flag: '🇸🇩' },
  { value: 'Yemeni', label: 'اليمنية', flag: '🇾🇪' },
  { value: 'Mauritanian', label: 'الموريتانية', flag: '🇲🇷' },
];

export const AGE_GROUPS: { value: AgeGroup; label: string; desc: { en: string; ar: string } }[] = [
  { value: '3-4', label: '3-4', desc: { en: 'Very short, simple stories for toddlers', ar: 'قصص قصيرة جدًا وبسيطة للصغار' } },
  { value: '4-6', label: '4-6', desc: { en: 'Fun, easy stories that spark imagination', ar: 'قصص ممتعة وسهلة تُنمّي الخيال' } },
  { value: '7-9', label: '7-9', desc: { en: 'Longer stories with adventures and clear characters', ar: 'قصص أطول بمغامرات وشخصيات واضحة' } },
  { value: '9-12', label: '9-12', desc: { en: 'Advanced stories with deeper plots', ar: 'قصص متقدمة بأحداث أعمق' } },
];

// Minimum idea length (in words) per age group — a too-thin idea produces a generic story.
export const PROMPT_LIMITS: Record<AgeGroup, number> = { '3-4': 5, '4-6': 8, '7-9': 10, '9-12': 15 };

// Seconds of reading/listening time budgeted per illustrated page.
export const SECONDS_PER_PAGE = 25;

export const SURPRISE_PROMPTS: Record<Language, string[]> = {
  English: [
    'A brave little rabbit named Hoppy who goes on a big adventure to learn how to help his forest friends in need.',
    'A cute curious cat discovering a magical world hidden behind the garden fence where flowers can sing and dance.',
    'A young child visiting the Dream World before bedtime to chase away bad dreams and find the brightest stars.',
    'A little friendly dinosaur looking for new friends in the prehistoric valley to play hide and seek with.',
    'A fun journey to space with a happy robot named Beep who loves to explore new planets and meet aliens.',
    'A magical fairy tale about a kind princess who loves sharing her toys and bringing joy to the kingdom.',
    'A cozy bedtime story about a brave little star guarding children while they sleep and bringing them sweet dreams.',
    'An exciting adventure in the deep green forest with cute animals working together to build a new playground.',
  ],
  Arabic: [
    'قصة أرنب صغير شجاع يدعى لوز يذهب في مغامرة كبيرة ليتعلم كيف يساعد أصدقاءه في الغابة.',
    'مغامرة قطة لطيفة وفضولية تكتشف عالمًا سحريًا مخفيًا خلف سور الحديقة حيث الأزهار تغني وترقص.',
    'طفل صغير يزور عالم الأحلام السحري قبل النوم ليطرد الكوابيس ويبحث عن أجمل النجوم اللامعة.',
    'ديناصور صغير ودود يبحث عن أصدقاء جدد في الوادي الكبير ليلعب معهم لعبة الغميضة والمطاردة.',
    'رحلة ممتعة ومثيرة إلى الفضاء الخارجي مع روبوت مرح يحب استكشاف الكواكب الجديدة ومقابلة الفضائيين.',
    'حكاية خيالية عن أميرة طيبة القلب تحب مشاركة ألعابها ونشر السعادة والفرح بين جميع سكان المملكة.',
    'قصة دافئة قبل النوم عن نجمة صغيرة شجاعة تحرس الأطفال أثناء نومهم وتهديهم أحلامًا سعيدة وجميلة.',
    'مغامرة شيقة في الغابة الخضراء مع مجموعة من الحيوانات اللطيفة التي تتعاون معًا لبناء ملعب جديد.',
  ],
};

export const SMART_TIPS: Record<Language, Record<AgeGroup, string>> = {
  English: {
    '3-4': 'Write a very simple story about animals or colors.',
    '4-6': 'Choose a clear hero and a simple problem to solve.',
    '7-9': 'Add an exciting adventure with connected events.',
    '9-12': 'Think about a real challenge and a meaningful message.',
  },
  Arabic: {
    '3-4': 'اكتب قصة بسيطة عن حيوان لطيف أو لون جميل.',
    '4-6': 'اختَر بطلًا واضحًا ومشكلة بسيطة يحاول حلّها.',
    '7-9': 'أضف مغامرة ممتعة وأحداثًا مترابطة.',
    '9-12': 'فكّر في تحدٍّ حقيقي ورسالة مفيدة في القصة.',
  },
};

export const STORY_TYPES: { value: StoryType; label: { en: string; ar: string } }[] = [
  { value: 'Bedtime', label: { en: 'Bedtime', ar: 'قبل النوم' } },
  { value: 'Adventure', label: { en: 'Adventure', ar: 'مغامرة' } },
  { value: 'Funny', label: { en: 'Funny', ar: 'مضحكة' } },
  { value: 'Educational', label: { en: 'Educational', ar: 'تعليمية' } },
  { value: 'Moral', label: { en: 'Moral', ar: 'أخلاقية' } },
];

export const STORY_LENGTHS: { value: StoryLength; pages: number; label: { en: string; ar: string } }[] = [
  { value: 'Short', pages: 6, label: { en: 'Short (6 pages)', ar: 'قصيرة (6 صفحات)' } },
  { value: 'Medium', pages: 12, label: { en: 'Medium (12 pages)', ar: 'متوسطة (12 صفحة)' } },
  { value: 'Long', pages: 24, label: { en: 'Long (24 pages)', ar: 'طويلة (24 صفحة)' } },
  { value: 'Epic', pages: 36, label: { en: 'Epic (36 pages)', ar: 'ملحمية (36 صفحة)' } },
];

// الحد الأعلى لعدد الصفحات؛ ما فوق دفعة واحدة يُكتب على دفعات بفصول
export const MAX_STORY_PAGES = 40;
export const MIN_STORY_PAGES = 3;
export const FIRST_BATCH_PAGES = 10;
export const NEXT_BATCH_PAGES = 6;

// `prompt` is the expanded style description sent to the image model (see getArtStylePrompt).
export const ART_STYLE_OPTIONS: { value: ArtStyle; labelAr: string; prompt: string }[] = [
  { value: 'Cute Cartoon', labelAr: 'كرتون لطيف', prompt: 'cute cartoon style, rounded adorable characters, thick soft outlines, bright cheerful colors' },
  {
    value: 'Hand-drawn Cartoon',
    labelAr: 'كرتون مرسوم باليد',
    prompt:
      'hand-drawn cartoon characters, simple human figures, thin black outline, slightly imperfect hand-drawn lines, minimal facial features, dot eyes and simple mouth, educational explainer illustration style, looks drawn by a human illustrator, soft limited colors, simple clean shapes, NOT vector, NOT flat design. Negative prompt: vector, flat illustration, 3d, pixar, anime, realistic, photorealistic, clay, stop motion, smooth digital lines, gradients, glossy',
  },
  { value: 'Watercolor', labelAr: 'ألوان مائية', prompt: 'storybook watercolor illustration, soft translucent washes, visible paper texture, gentle bleeding edges' },
  { value: '3D Pixar Style', labelAr: 'ثلاثي الأبعاد (بيكسار)', prompt: 'Pixar-like 3D animated render, soft cinematic lighting, expressive big eyes, rounded friendly shapes, rich textures' },
  { value: 'Pastel Dream', labelAr: 'باستيل حالم', prompt: 'soft pastel illustration, dreamy muted colors, gentle gradients, cozy atmosphere' },
  { value: 'Doodle Sketch', labelAr: 'رسومات خربشية', prompt: 'sketchy doodle illustration, loose pen lines, playful scribbled shading, childlike charm' },
  { value: 'Anime', labelAr: 'أنمي للأطفال', prompt: 'anime kids style, clean cel-shading, big expressive eyes, bright cheerful palette' },
  { value: 'Paper Cutout', labelAr: 'قصاصات ورقية', prompt: 'layered paper cut-out collage, handmade craft paper textures, soft drop shadows between layers' },
  {
    value: 'Educational Line Cartoon',
    labelAr: 'كرتون تعليمي خطي',
    prompt:
      'simple flat line illustration, white background, clean black outlines, minimal flat colors, educational cartoon style, whiteboard illustration, no 3D, no shadows, no textures, simple characters, expressive faces, child-friendly, vector-style drawing',
  },
  { value: 'Claymation', labelAr: 'صلصال / ستوب موشن', prompt: 'clay stop-motion style, handmade plasticine characters, visible fingerprint texture, miniature set lighting' },
  { value: 'Flat Vector', labelAr: 'فلات فيكتور', prompt: 'flat vector kids illustration, bold simple shapes, clean edges, limited bright palette, no gradients' },
  { value: 'Fantasy Fairy Tale', labelAr: 'خيال قصصي', prompt: 'fantasy fairy-tale illustration, magical glowing details, enchanted forests and castles, luminous colors' },
  { value: 'Bedtime Story', labelAr: 'قصة قبل النوم', prompt: 'cozy bedtime storybook illustration, moonlit night palette, warm lantern glow, soft calm lighting' },
  { value: 'Classic Storybook', labelAr: 'كتاب قصص كلاسيكي', prompt: 'classic picture-book illustration, warm gouache and ink, timeless fairy-tale feel' },
  { value: 'Pixel Art', labelAr: 'بكسل آرت', prompt: 'colorful pixel art, 16-bit game style, crisp pixels, cheerful palette' },
  { value: 'Chalk Drawing', labelAr: 'رسم بالطباشير', prompt: 'chalk drawing on a dark chalkboard, textured chalk strokes, colorful pastel chalk' },
  { value: 'Comic Book', labelAr: 'قصص مصورة', prompt: 'kids comic-book style, bold ink outlines, halftone shading, vivid flat colors' },
  {
    value: 'Photorealistic',
    labelAr: 'واقعي',
    prompt: 'ultra photorealistic, real humans, cinematic lighting, natural skin texture, no cartoon, no illustration',
  },
];

export const ASPECT_RATIO_OPTIONS: { value: AspectRatio; label: { en: string; ar: string } }[] = [
  { value: '4:3', label: { en: 'Classic (4:3)', ar: 'كلاسيكي (4:3)' } },
  { value: '16:9', label: { en: 'Wide (16:9)', ar: 'عريض (16:9)' } },
  { value: '9:16', label: { en: 'Tall (9:16)', ar: 'طولي (9:16)' } },
];

export const READ_LEARN_ARTICLES: ReadLearnArticle[] = [
  {
    id: 'why-sky-blue',
    emoji: '🌤️',
    title: { en: 'Why Is the Sky Blue?', ar: 'لماذا السماء زرقاء؟' },
    summary: {
      en: 'Sunlight is made of many colors, and the sky loves blue the most.',
      ar: 'ضوء الشمس مكوّن من ألوان كثيرة، والسماء تحب اللون الأزرق أكثر من غيره.',
    },
    body: {
      en: 'Sunlight looks white, but it is really a mix of every color of the rainbow. When it enters our sky, tiny bits of air scatter the blue light in every direction, much more than the other colors. That scattered blue is what reaches your eyes from every direction, so the whole sky looks blue!',
      ar: 'ضوء الشمس يبدو أبيض، لكنه في الحقيقة خليط من كل ألوان قوس قزح. وعندما يدخل هذا الضوء إلى سمائنا، تقوم جزيئات الهواء الصغيرة بتبعثر اللون الأزرق في كل الاتجاهات أكثر من باقي الألوان. وهذا الأزرق المتبعثر هو ما يصل إلى عينيك من كل جهة، فتبدو السماء كلها زرقاء!',
    },
  },
  {
    id: 'why-magnets-stick',
    emoji: '🧲',
    title: { en: 'Why Do Magnets Stick to Some Things?', ar: 'لماذا يلتصق المغناطيس ببعض الأشياء؟' },
    summary: {
      en: 'Magnets are picky friends — they only pull on iron, nickel, and cobalt.',
      ar: 'المغناطيس صديق انتقائي — لا يجذب إلا الحديد والنيكل والكوبالت.',
    },
    body: {
      en: 'Inside a magnet, tiny particles line up in the same direction, creating an invisible pulling force. Metals like iron have their own tiny particles that can line up too, so they get pulled in. Things like wood, plastic, or paper cannot line up that way, so the magnet leaves them alone.',
      ar: 'بداخل المغناطيس، تصطف جزيئات صغيرة جدًا في اتجاه واحد فتصنع قوة جذب غير مرئية. المعادن مثل الحديد فيها جزيئات صغيرة قادرة على الاصطفاف أيضًا فتنجذب إليه. أما الخشب أو البلاستيك أو الورق فلا تستطيع جزيئاتها الاصطفاف بهذه الطريقة، لذلك يتركها المغناطيس بلا جذب.',
    },
  },
  {
    id: 'how-volcanoes-erupt',
    emoji: '🌋',
    title: { en: 'How Does a Volcano Erupt?', ar: 'كيف يثور البركان؟' },
    summary: {
      en: 'Deep under a mountain, melted rock builds up pressure until it bursts out.',
      ar: 'في أعماق الجبل، تتجمع الصخور المنصهرة وتزداد ضغطًا حتى تندفع للخارج.',
    },
    body: {
      en: 'Deep underground it is so hot that rock melts into a thick liquid called magma. Magma is lighter than solid rock, so it rises and collects in a chamber under the volcano. When enough pressure builds up, the magma pushes through cracks and bursts out at the top — and once it reaches the surface, we call it lava.',
      ar: 'في أعماق الأرض تكون الحرارة عالية جدًا لدرجة أن الصخور تنصهر وتتحول إلى سائل كثيف يسمى الصهارة. الصهارة أخف وزنًا من الصخور الصلبة، فترتفع وتتجمع في حجرة تحت البركان. وعندما يتراكم ضغط كافٍ، تندفع الصهارة عبر الشقوق وتخرج من القمة — وبمجرد وصولها إلى السطح تُسمّى الحمم البركانية.',
    },
  },
  {
    id: 'why-we-see-lightning-before-thunder',
    emoji: '⚡',
    title: { en: 'Why Do We See Lightning Before We Hear Thunder?', ar: 'لماذا نرى البرق قبل أن نسمع الرعد؟' },
    summary: {
      en: 'Light zips to your eyes almost instantly, but sound takes its time.',
      ar: 'الضوء يصل إلى عينيك بسرعة كبيرة جدًا، بينما الصوت يستغرق وقتًا أطول.',
    },
    body: {
      en: 'Lightning and thunder actually happen at the same moment. But light travels incredibly fast, so you see the flash almost instantly. Sound travels much slower, so the rumble of thunder takes a few extra seconds to reach your ears — the farther away the storm, the longer the gap.',
      ar: 'البرق والرعد يحدثان في اللحظة نفسها. لكن الضوء يسافر بسرعة هائلة، لذلك ترى الوميض على الفور تقريبًا. أما الصوت فيسافر أبطأ بكثير، فيستغرق دوي الرعد ثوانٍ إضافية ليصل إلى أذنيك — وكلما كانت العاصفة أبعد، طالت هذه الفجوة الزمنية.',
    },
  },
  {
    id: 'why-do-we-yawn',
    emoji: '🥱',
    title: { en: 'Why Do We Yawn?', ar: 'لماذا نتثاءب؟' },
    summary: {
      en: 'A big yawn helps cool down your busy brain and wake it back up.',
      ar: 'التثاؤب الكبير يساعد على تبريد دماغك المشغول وإعادة تنشيطه.',
    },
    body: {
      en: 'Scientists think yawning helps cool your brain when it works hard or gets a little too warm. A deep yawn pulls in cool air and stretches your jaw muscles, which can help you feel more alert. That is also why yawns are contagious — seeing someone yawn can make your own brain want to cool down too!',
      ar: 'يعتقد العلماء أن التثاؤب يساعد على تبريد دماغك عندما يعمل بجد أو يسخن قليلًا. التثاؤب العميق يسحب هواءً باردًا ويمدّد عضلات الفك، وهذا قد يجعلك تشعر بمزيد من النشاط. ولهذا السبب أيضًا يكون التثاؤب معديًا — فمشاهدة شخص يتثاءب قد تجعل دماغك يرغب في التبريد أيضًا!',
    },
  },
  {
    id: 'how-do-plants-eat',
    emoji: '🌱',
    title: { en: 'How Do Plants Eat Without a Mouth?', ar: 'كيف تأكل النباتات بلا فم؟' },
    summary: {
      en: 'Plants cook their own food from sunlight, air, and water.',
      ar: 'النباتات تطبخ طعامها بنفسها من ضوء الشمس والهواء والماء.',
    },
    body: {
      en: 'Plants make their own food in a process called photosynthesis. Their green leaves catch sunlight, and use it to turn water from the soil and a gas called carbon dioxide from the air into sugar for energy. As a bonus, they release the oxygen we breathe right back into the air!',
      ar: 'تصنع النباتات طعامها بنفسها في عملية تسمى التمثيل الضوئي. تلتقط أوراقها الخضراء ضوء الشمس، وتستخدمه لتحويل الماء من التربة وغاز ثاني أكسيد الكربون من الهواء إلى سكر يمنحها الطاقة. وكهدية إضافية، تطلق الأكسجين الذي نتنفسه مرة أخرى في الهواء!',
    },
  },
];

export const GAMES_ROSTER: GameDefinition[] = [
  {
    id: 'volcano',
    emoji: '🌋',
    title: { en: 'Volcano Lab', ar: 'مختبر البركان' },
    description: { en: 'Trigger an eruption and learn why it happens.', ar: 'فجّر البركان وتعلّم لماذا يحدث ذلك.' },
    available: true,
  },
  {
    id: 'magnet',
    emoji: '🧲',
    title: { en: 'Magnet Test', ar: 'اختبار المغناطيس' },
    description: { en: 'Guess which objects a magnet will pull.', ar: 'خمّن أي الأشياء يجذبها المغناطيس.' },
    available: true,
  },
  {
    id: 'transformer',
    emoji: '🔌',
    title: { en: 'Transformer', ar: 'المحوّل الكهربائي' },
    description: { en: 'Step-up or step-down? Read the coil turns.', ar: 'رافع أم خافض؟ اقرأ عدد اللفات.' },
    available: true,
  },
  {
    id: 'generator-motor',
    emoji: '⚙️',
    title: { en: 'Generator & Motor', ar: 'المولد والمحرك' },
    description: { en: 'Pick the right parts for each machine.', ar: 'اختر الأجزاء الصحيحة لكل جهاز.' },
    available: true,
  },
  {
    id: 'magnetic-resonance',
    emoji: '🧠',
    title: { en: 'Magnetic Resonance', ar: 'الرنين المغناطيسي' },
    description: { en: 'Align protons and read the MRI signal.', ar: 'رتّب البروتونات واقرأ إشارة الرنين.' },
    available: true,
  },
  {
    id: 'chemistry-lab',
    emoji: '🧪',
    title: { en: 'Chemistry Lab', ar: 'مختبر الكيمياء' },
    description: { en: 'Match each element with its symbol.', ar: 'طابق كل عنصر مع رمزه الكيميائي.' },
    available: true,
  },
  {
    id: 'candy-catch',
    emoji: '🍬',
    title: { en: 'Element Catch', ar: 'التقاط العناصر' },
    description: { en: 'Tap the falling symbol before time runs out.', ar: 'اضغط الرمز الصحيح قبل انتهاء الوقت.' },
    available: true,
  },
  {
    id: 'candy-ladder',
    emoji: '🏆',
    title: { en: 'Candy Ladder', ar: 'من سيربح البونبون' },
    description: { en: 'Answer questions and climb 25 levels.', ar: 'أجب عن الأسئلة واصعد 25 مستوى.' },
    available: true,
  },
  {
    id: 'fault-types',
    emoji: '📐',
    title: { en: 'Fault Types', ar: 'أنواع الصدوع' },
    description: { en: 'Match each fault with the force behind it.', ar: 'اربط كل صدع بالقوة المسببة له.' },
    available: true,
  },
  {
    id: 'quiz-master',
    emoji: '',
    title: { en: 'Quiz Master', ar: 'معلّم الأسئلة' },
    description: { en: 'Any topic, adaptive difficulty, questions read aloud.', ar: 'أي موضوع، صعوبة تتكيّف معك، وأسئلة مسموعة.' },
    available: true,
  },
  { id: 'speed-challenge', emoji: '🏎️', title: { en: 'Speed Challenge', ar: 'تحدي السرعة' }, description: { en: 'Coming soon.', ar: 'قريبًا.' }, available: false },
  { id: 'circuit-builder', emoji: '💡', title: { en: 'Circuit Builder', ar: 'بناء الدائرة الكهربائية' }, description: { en: 'Coming soon.', ar: 'قريبًا.' }, available: false },
  { id: 'color-mixing', emoji: '🎨', title: { en: 'Color Mixing Lab', ar: 'مختبر مزج الألوان' }, description: { en: 'Coming soon.', ar: 'قريبًا.' }, available: false },
];
