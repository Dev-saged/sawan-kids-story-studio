import type { StoryData, StoryPage } from '../types';

// برومبتات تحريك لكل مشهد (للصق في Veo / Flow بحساب Pro): الصورة أصلية والبرومبت يحرّكها فقط
const CAMERAS = [
  'slow cinematic push-in toward the main subject',
  'gentle pan from left to right revealing more of the scene',
  'slow pull-back to a wide establishing view',
  'soft orbit around the characters',
  'slight tilt-up with a floating, dreamy feel',
  'steady slow dolly-in at eye level',
];

const MOODS: [RegExp, string][] = [
  [/\b(run|runs|ran|chase|race|jump|fly|flying|escape|rush|dash)\b/i, 'energetic lively motion, flowing hair, fur and fabric, quick expressive steps'],
  [/\b(sad|cry|crying|tear|lonely|alone|miss|missed)\b/i, 'quiet emotional stillness, slow breathing, glistening eyes, a gentle tear glint'],
  [/\b(sleep|sleeping|dream|night|moon|bed|lullaby|star|stars)\b/i, 'calm dreamy drifting motion, twinkling lights, slow breathing'],
  [/\b(laugh|happy|joy|celebrate|party|dance|dancing|fun|giggle)\b/i, 'cheerful bouncy motion, bright smiles, light laughter'],
  [/\b(storm|wind|rain|scary|dark|monster|cave|thunder)\b/i, 'tense atmosphere, swaying trees, blowing wind and rain, wary glances'],
  [/\b(magic|magical|spell|glow|glowing|fairy|sparkle|wonder)\b/i, 'magical shimmering particles and soft pulsing glow'],
];

const DEFAULT_MOTION = 'subtle realistic body movement, natural breathing, gentle head and eye motion, soft emotional expressions';

const clip = (v: string, n: number): string => (v.length > n ? `${v.slice(0, n).trim()}…` : v.trim());

export const ANIMATION_RULES = [
  'Audio: natural ambient sound effects only; light laughter or soft emotional breathing are allowed.',
  'NO music. NO dialogue, NO speech, NO lip-sync — characters stay silent.',
].join(' ');

export const animationPrompt = (story: StoryData, page: StoryPage, index: number): string => {
  const ratio = story.story_info.aspect_ratio;
  const orientation = ratio === '9:16' || ratio === '3:4' ? 'vertical' : ratio === '1:1' ? 'square' : 'horizontal';
  const context = `${page.image_prompt} ${page.text}`;
  const mood = MOODS.find(([re]) => re.test(context))?.[1] ?? DEFAULT_MOTION;
  return [
    `Animate this exact illustration into a 6-second ${orientation} cinematic clip.`,
    `Scene: ${clip(page.image_prompt || page.text, 450)}`,
    `Story moment: "${clip(page.text, 220)}"`,
    `Motion: ${mood}; also ${DEFAULT_MOTION}.`,
    `Camera: ${CAMERAS[index % CAMERAS.length]}.`,
    `Keep the art style (${story.story_info.art_style}), the characters, colors and composition identical to the image.`,
    ANIMATION_RULES,
  ].join('\n');
};

export const allAnimationPrompts = (story: StoryData): string[] => story.pages.map((p, i) => animationPrompt(story, p, i));

// ملف نصي واحد برومبتات كل المشاهد، يقابل أسماء صور الحزمة
export const animationPackText = (story: StoryData, imageNames: (string | null)[]): string => {
  const head = [
    `ANIMATION PACK — ${story.story_info.title}`,
    `Art style: ${story.story_info.art_style} · Aspect ratio: ${story.story_info.aspect_ratio}`,
    'How to use: open Flow / Veo, upload the image named in each scene, paste the matching prompt, generate a 6-second clip.',
    '',
  ];
  const scenes = story.pages.map((p, i) => [`=== Scene ${String(p.page).padStart(2, '0')} · image: ${imageNames[i] ?? '(not drawn yet)'} ===`, animationPrompt(story, p, i), ''].join('\n'));
  return [...head, ...scenes].join('\n');
};
