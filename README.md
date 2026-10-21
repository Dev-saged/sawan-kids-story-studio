# استوديو ساجد لقصص الأطفال — Sajed Kids Story Studio

AI-powered illustrated children's stories in Arabic (19 dialects + flawless Fusha) and English,
with natural narration, read-along, story videos, science games and learning articles.

**Designed & developed by Eng. Sajed Al-Abadlah — تصميم وتطوير المهندس ساجد العبادلة**

## Stack (v3.0.1 — Single Version Source: `src/version.ts` & `src/config.ts`)

- Vite 6 + React 18 + TypeScript (strict), Tailwind CSS v4 (RTL logical properties)
- `server.ts` (Express 5) — thin Gemini proxy required by Google AI Studio hosting
- `@google/genai` model chains (strongest first, each with its own quota, defined in `server.ts` & `shared/config.ts`):
  - Text: `gemini-3-flash-preview` → `gemini-2.5-flash` → `gemini-2.5-pro` → `gemini-2.5-flash-lite`
  - Images: `gemini-2.5-flash-image` → `gemini-3.1-flash-image-preview` → `gemini-3.1-pro-image-preview`
  - Narration: `gemini-2.5-flash-preview-tts` → `gemini-2.5-pro-preview-tts`
  - Music: `lyria-realtime-exp` / `lyria-3-clip-preview` (with WebAudio procedural lullaby fallback)
- IndexedDB v4 (versioned schema with automatic legacy audio keyPath migration) for the library, 2048px print-grade images, audio cache, child profiles, saved character album (`characters`), and custom story identities (`custom_presets`)
- WebCodecs + `mp4-muxer` for MP4 video export (MediaRecorder fallback)
- PWA: manifest + service worker (offline shell with build-time version injection and `public/version.json`)

## سجل الإصدارات (Changelog)

| الإصدار | التاريخ | أهم التغييرات |
| --- | --- | --- |
| **v3.0.1** | 2026-10-21 | تحسين معالج الاستوديو من 3 خطوات («الفكرة»، «الشكل»، «التفاصيل») مع شريط تنقل سفلي ثابت يحترم `safe-area`، معاينة حية متكاملة للغلاف في الخطوة 2 تجمع العنوان والأسلوب والخط بـ SVG/CSS، حفظ واستعادة حالة المعالج تلقائياً، ضمان منطقة لمس 44px لجميع مفاتيح التبديل ومربعات الاختيار، وتثبيت ترحيل مخزن الصوت القديم `audio` في IndexedDB. |
| **v3.0.0** | 2026-10-20 | إعادة تصميم الاستوديو كمعالج من 3 خطوات، مكون `StyleThumb` المرسوم بـ SVG لكل أسلوب فني، نافذة ترحيب تعريفية (Onboarding)، هياكل تحميل (Skeletons)، إصلاح مفتاح مخزن الصوت `audio` في IndexedDB إلى `id` مع ترحيل سجلات القواعد القديمة تلقائياً، فحص التحديث الصامت من `public/version.json` عبر `CONFIG`، ونظام الإصدارات الجديد (`0..9` للخانات الفرعية مع أولوية `buildNumber`). |
| **v2.9.5 (كان يسمى 2.10.0)** | 2026-10-20 | إعادة هيكلة طلبات الصور لتبدأ بالمشهد (`Scene:`) بسقف صارم 120 كلمة، توسيع أنواع القصص إلى 16 نوعاً ببنية سردية متكاملة، 12 خطاً عربياً للغلاف مع 4 تأثيرات بصرية ومعاينة حية، 16 هوية جاهزة مع حفظ الهويات المخصصة، بوابة معاينة الغلاف والصفحة الأولى، تصحيح المشهد لكل صفحة، ألبوم الشخصيات المحفوظة، والعلامة المائية المفرغة الذكية عند التصدير فقط. |
| **v2.9.1** | 2026-10-19 | توحيد مصدر الإصدار في `src/version.ts`، فصل قواعد نماذج الصور في `src/shared/modelRules.ts`، حماية ورقة مرجع الشخصيات من السقوط عند أخطاء الشبكة، تحسين مطابقة طبقة الصوت، دقة 2048px للطباعة، واستبدال كافة الرموز التعبيرية بأيقونات SVG مدمجة. |
| **v2.2.0** | 2026-09-15 | محرك الصور ثلاثي المسارات (المتصفح المباشر + خادم Gemini + المسار الاحتياطي المجاني FLUX)، القصص الطويلة حتى 40 صفحة بنظام الفصول والدفعات، قسم «اقرأ وتعلّم» (49 بطاقة ثنائية اللغة + اسألني أي شيء)، وحزمة تحريك المشاهد (Veo/Flow). |
| **v2.1.0** | 2026-08-20 | قبول جميع صيغ مفاتيح Gemini، الاكتشاف التلقائي للنماذج المتاحة، تصدير الفيديو بأربع نسب وثلاث جودات، وضع النوم، سلاسل القصص المتصلة، كتاب المطبعة A5، وتسجيل صوت العائلة لكل صفحة. |
| **v2.0.0** | 2026-07-10 | إطلاق الجيل الثاني برسوم متسقة عبر ورقة مرجع الشخصيات، صورة الطفل بطلاً للقصة، السرد الصوتي الطبيعي بالتشكيل الكامل مع تتبع الكلمات المقروءة، الألعاب العلمية التفاعلية، والعمل الكامل دون اتصال. |

## What's new in v3.0.0 — 3-Step Studio Wizard, Single-Digit Versioning & Critical Fixes

- **3-Step Studio Wizard (`StorySetupForm.tsx`)**: Organized into three clear, non-overwhelming steps (`1. الفكرة والبطل`, `2. الأسلوب والغلاف`, `3. الصوت والانطلاق`) with instant step jumping, full-view toggle, and persistent quick-create bar.
- **Inline SVG Art Style Previews (`StyleThumb.tsx`)**: Bespoke vector miniature illustrations for all 18 art styles, with zero emojis across the entire UI.
- **Onboarding Guide & Skeleton Loaders**: First-visit RTL onboarding tour and smooth transform/opacity skeleton placeholders respecting `prefers-reduced-motion`.
- **IndexedDB Audio Store Migration (`src/services/db.ts`)**: Unified `'audio'` store `keyPath` to `'id'` matching `narration.ts`, with automatic lossless migration from legacy `keyPath: 'key'` stores during `onupgradeneeded`.
- **Reliable Silent Update Check (`src/services/versionCheck.ts` & `public/version.json`)**: Reads `public/version.json` generated at `prebuild` from `src/version.ts` via `CONFIG.GITHUB_OWNER` and `CONFIG.GITHUB_REPO` with a 5-second timeout and silent offline handling.
- **Strict Single-Digit Subversion System (`src/version.ts`)**: `MINOR` and `PATCH` roll over from `9` to `0` (`2.9.9` patch → `3.0.0`), and `compareVersions` prioritizes `buildNumber` before numeric segment comparison.

## What's new in v2.9.5 — Scene-First Prompt Engineering & Creative Studio Expansion

- **Scene-First Image Prompts (<= 120 words)**: `buildPageImagePrompt`, `buildCoverPrompt`, and `buildSheetPrompt` start directly with `Scene: <prompt>.`, include only characters present in the page (up to 15 words each), apply the art style once, and end with `POSITIVE_ILLUSTRATION_DIRECTIVE` from `shared/config.ts`.
- **16 Story Genres with Narrative Arcs (`STORY_TYPE_SPECS`)**: 5 primary genres + 11 expandable genres (`Mystery`, `Fantasy`, `SciFi`, `Fable`, `Historical`, `Rhyme`, `Interactive`, `Therapeutic`, `Prophets`, `Folklore`, `Sports`), each with structured beginning/middle/climax/ending arcs.
- **12 Calligraphic Cover Fonts + 4 Visual Effects + Live Preview**: 12 open-source Arabic fonts loaded with `display=swap`, 4 cover text effects (`gold`, `shadow`, `outline`, `plain`), and a live cover preview box before generation.
- **16 Complete Identity Presets + Custom Identity Saving**: Each preset configures art style, narrator voice, Arabic dialect, cover font, and ambient sound; users can save their own identities to IndexedDB (`custom_presets`).
- **Cover & Page 1 Preview Gate**: Draws the character reference sheet, cover, and page 1 first, allowing the user to approve and continue or change the style before painting the remaining pages.
- **Per-Page Mismatch Correction & Alternative Title Suggestions**: Instant scene correction (`Correction: ...`) and 3 dialect-matched title suggestions (`/api/suggest-titles`).
- **Saved Character Album (`characters` store in IndexedDB)**: Save any story character with its reference sheet to reuse across future stories, included in JSON backups.
- **Export-Only Adaptive Hollow Watermark**: Draws a 4%-width hollow watermark in the bottom corner on PDF/ZIP/share/video exports with automatic luminance contrast, keeping IndexedDB images 100% clean.

## What's new in v2.9.1 — Audit Remediation & Architecture Hardening

- **Single Version Source (`src/version.ts`)**: Centralized version tracking across UI, `config.ts`, `package.json`, and documentation.
- **Shared Model Capabilities (`src/shared/modelRules.ts`)**: `NO_SIZE_IMAGE_MODELS` shared between `server.ts` and `src/services/imageEngine.ts` so `gemini-2.5-flash-image` never receives `imageSize: '1K'`, and concise positive anatomical directives replace negative prompt lists.
- **Reference Sheet Protection**: Retrying without the character reference sheet is restricted strictly to image/safety/filter errors (and logged as `[no-ref retry]` in the diagnostic trail), preventing silent hero drift on network or rate-limit errors.
- **Honest API Key Preflight & Voice Pitch Matching**: `getApiKey()` only returns `'server-proxy'` after `/api/preflight` confirms server key availability. Voice pitch matching is transparently labeled as selecting the closest prebuilt narrator voice to the user's vocal frequency (Hz).
- **2048px Print Resolution & 250-URL Safe Cache**: `CONFIG.IMAGE_MAX_DIM = 2048` preserves crisp print quality, and `objectUrlFor` caches up to 250 active blob URLs with safe re-creation.
- **Dual Interactive Book Readers & Ambient Audio Ducking**: Both Framer Motion spread reader and classic flipbook are selectable in `StoryReader`, with automatic narration ducking and unmount teardown for WebAudio oscillators.
- **100% Inline SVG Iconography**: All decorative emojis replaced with custom inline SVG artwork (`src/components/common/BrandIcons.tsx`) and Lucide vector icons.

## Setup

```bash
npm install
npm run dev        # http://localhost:3000
```

Production: `npm run build` then `NODE_ENV=production npm start`.

## Branding

Brand name, author and social links live in `src/config.ts` — edit that file only.
