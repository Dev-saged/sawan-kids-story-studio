import {
  AgeGroup,
  ArabicDialect,
  ArtStyle,
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
export const TEXT_MODEL = 'gemini-3.8-flash';
export const IMAGE_MODEL = 'gemini-3.1-flash-lite-image';

export const MAX_IDEA_LENGTH = 500;
export const IMAGE_BATCH_SIZE = 3;

export const SYSTEM_INSTRUCTION = `You are building a PROFESSIONAL MVP SaaS called: "Sawan Kids Story Studio"
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

export const DIALECT_OPTIONS: { value: ArabicDialect; label: string }[] = [
  { value: 'Modern Standard', label: 'الفصحى المبسطة' },
  { value: 'Egyptian', label: 'المصرية' },
  { value: 'Saudi', label: 'السعودية' },
  { value: 'Gulf', label: 'الخليجية' },
  { value: 'Palestinian', label: 'الفلسطينية' },
  { value: 'Levantine', label: 'الشامية' },
  { value: 'Syrian', label: 'السورية' },
  { value: 'Lebanese', label: 'اللبنانية' },
  { value: 'Jordanian', label: 'الأردنية' },
  { value: 'Iraqi', label: 'العراقية' },
  { value: 'Emirati', label: 'الإماراتية' },
  { value: 'Kuwaiti', label: 'الكويتية' },
  { value: 'Moroccan', label: 'المغربية' },
  { value: 'Algerian', label: 'الجزائرية' },
  { value: 'Tunisian', label: 'التونسية' },
  { value: 'Sudanese', label: 'السودانية' },
  { value: 'Yemeni', label: 'اليمنية' },
];

export const AGE_GROUPS: { value: AgeGroup; label: string }[] = [
  { value: '3-4', label: '3-4' },
  { value: '4-6', label: '4-6' },
  { value: '7-9', label: '7-9' },
  { value: '9-12', label: '9-12' },
];

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
];

export const ART_STYLE_OPTIONS: ArtStyle[] = [
  '3D Pixar Style',
  'Hand-drawn Cartoon',
  'Watercolor',
  'Claymation',
  'Paper Cutout',
  'Anime',
  'Doodle Sketch',
  'Photorealistic',
  'Classic Storybook',
  'Flat Vector',
  'Pastel Dream',
  'Pixel Art',
  'Chalk Drawing',
  'Comic Book',
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
  { id: 'transformer', emoji: '🔌', title: { en: 'Transformer', ar: 'المحوّل الكهربائي' }, description: { en: 'Coming soon.', ar: 'قريبًا.' }, available: false },
  { id: 'generator-motor', emoji: '⚙️', title: { en: 'Generator & Motor', ar: 'المولد والمحرك' }, description: { en: 'Coming soon.', ar: 'قريبًا.' }, available: false },
  { id: 'magnetic-resonance', emoji: '🧠', title: { en: 'Magnetic Resonance', ar: 'الرنين المغناطيسي' }, description: { en: 'Coming soon.', ar: 'قريبًا.' }, available: false },
  { id: 'chemistry-lab', emoji: '🧪', title: { en: 'Chemistry Lab', ar: 'مختبر الكيمياء' }, description: { en: 'Coming soon.', ar: 'قريبًا.' }, available: false },
  { id: 'candy-catch', emoji: '🍬', title: { en: 'Candy Catch', ar: 'التقاط الحلوى' }, description: { en: 'Coming soon.', ar: 'قريبًا.' }, available: false },
  { id: 'speed-challenge', emoji: '🏎️', title: { en: 'Speed Challenge', ar: 'تحدي السرعة' }, description: { en: 'Coming soon.', ar: 'قريبًا.' }, available: false },
  { id: 'circuit-builder', emoji: '💡', title: { en: 'Circuit Builder', ar: 'بناء الدائرة الكهربائية' }, description: { en: 'Coming soon.', ar: 'قريبًا.' }, available: false },
  { id: 'color-mixing', emoji: '🎨', title: { en: 'Color Mixing Lab', ar: 'مختبر مزج الألوان' }, description: { en: 'Coming soon.', ar: 'قريبًا.' }, available: false },
];
