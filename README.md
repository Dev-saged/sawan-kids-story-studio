# استوديو ساجد لقصص الأطفال — Sajed Kids Story Studio

AI-powered illustrated children's stories in Arabic (19 dialects + flawless Fusha) and English,
with natural narration, read-along, story videos, science games and learning articles.

**Designed & developed by Eng. Sajed Al-Abadlah — تصميم وتطوير المهندس ساجد العبادلة**

## Stack (v2.9.1 — Single Version Source: `src/version.ts`)

- Vite 6 + React 18 + TypeScript (strict), Tailwind CSS v4
- `server.ts` (Express 5) — thin Gemini proxy required by Google AI Studio hosting
- `@google/genai` model chains (strongest first, each with its own quota, defined in `server.ts` & `src/shared/modelRules.ts`):
  - Text: `gemini-3-flash-preview` → `gemini-2.5-flash` → `gemini-2.5-pro` → `gemini-2.5-flash-lite`
  - Images: `gemini-2.5-flash-image` → `gemini-3.1-flash-image-preview` → `gemini-3-pro-image-preview`
  - Narration: `gemini-2.5-flash-preview-tts` → `gemini-2.5-pro-preview-tts`
  - Music: `lyria-realtime-exp` / `lyria-3-clip-preview` (with WebAudio procedural lullaby fallback)
- IndexedDB (versioned schema) for the library, 2048px print-grade images, audio cache and child profiles
- WebCodecs + `mp4-muxer` for MP4 video export (MediaRecorder fallback)
- PWA: manifest + service worker (offline shell)

## What's new in v2.9.1 — Audit Remediation & Architecture Hardening

- **Single Version Source (`src/version.ts`)**: Centralized version tracking across UI, `config.ts`, `package.json`, and documentation.
- **Shared Model Capabilities (`src/shared/modelRules.ts`)**: `NO_SIZE_IMAGE_MODELS` shared between `server.ts` and `src/services/imageEngine.ts` so `gemini-2.5-flash-image` never receives `imageSize: '1K'`, and concise positive anatomical directives replace negative prompt lists.
- **Reference Sheet Protection**: Retrying without the character reference sheet is restricted strictly to image/safety/filter errors (and logged as `[no-ref retry]` in the diagnostic trail), preventing silent hero drift on network or rate-limit errors.
- **Honest API Key Preflight & Voice Pitch Matching**: `getApiKey()` only returns `'server-proxy'` after `/api/preflight` confirms server key availability. Voice pitch matching is transparently labeled as selecting the closest prebuilt narrator voice to the user's vocal frequency (Hz).
- **2048px Print Resolution & 250-URL Safe Cache**: `CONFIG.IMAGE_MAX_DIM = 2048` preserves crisp print quality, and `objectUrlFor` caches up to 250 active blob URLs with safe re-creation.
- **Dual Interactive Book Readers & Ambient Audio Ducking**: Both Framer Motion spread reader and classic flipbook are selectable in `StoryReader`, with automatic narration ducking and unmount teardown for WebAudio oscillators.
- **100% Inline SVG Iconography**: All decorative emojis replaced with custom inline SVG artwork (`src/components/common/BrandIcons.tsx`) and Lucide vector icons.

## What's new in v2.2.0

- **Images that actually draw** — one image layer for the whole app with three paths:
  browser-direct (the key injected by AI Studio), the server Nano Banana chain, and a **free
  Cloudflare FLUX fallback** (about two full stories a day on the free tier, no billing). Zero-quota
  is now detected correctly (`BILLING`), and **Technical details → Test image paths** reports which
  path works. Cloudflare setup: Account ID + a Workers AI API token, entered once in the in-app card.
- **Long stories** — 3 to 40 pages with presets (6 / 12 / 24 / 36) and a slider. Long books are
  written in chapters (first 10 pages, then batches of 6, each carrying the story so far); new pages
  are painted as they arrive; if a batch fails the story is kept and **Continue story** resumes it,
  also from the library.
- **Read & Learn** — 49 bilingual fact cards in 7 categories with search, plus **Ask me anything**
  (answer, fun fact, follow-up questions, illustration, narration, quiz) and "turn it into a story".
- **Games** — stars for every game, day streak, a rotating **daily challenge**, and the new
  **Quiz Master**: any topic, questions read aloud, difficulty that adapts to your score.
- **Share** — WhatsApp, Telegram, Facebook, native share sheet (with the cover) and copy text.
- **Packages** — one ZIP with text, JSON backup, images and prompts; and an **Animation pack**:
  a 6-second Veo/Flow prompt per scene (camera, motion, ambient sound only — no music or dialogue)
  next to the matching images.
- **Scene tools** — edit the image prompt of any page, rewrite its camera angle (wide, close-up,
  low, high, side, behind) or repaint it; copy the image or animation prompt.
- Cross-links: Learn / Games → Studio with a ready idea, Story end → Learn / Games.
- Not included (paid / later): API video generation (Veo), sharing a story by link.

## What's new in v2.1.0

- **Any API key format** — `AIza…`, `AQ.…` and future formats are accepted; a rejected key is reported
  clearly (no silent fallback to the platform key). The key is verified with Google when saved.
- **Real model discovery** — the server lists the models available to the key (`models.list`) and
  orders each chain by what actually exists; unknown/renamed IDs are skipped or discovered automatically.
  `GET /api/preflight` reports the available models.
- **Honest errors** — "zero quota / enable billing" (free tier has no image quota) is separated from
  temporary quota; every error has a **Technical details** panel (model + raw Google message) to copy.
- **Narration fix** — TTS now receives only the story text (the English style prompt was sometimes spoken).
  Per-page **regenerate voice** and **regenerate picture** buttons.
- **Quota-aware painting** — temporary quota pauses image painting and resumes automatically.
- **Story video** — 4 formats (16:9, Reels 9:16, square 1:1, portrait 4:5) × 3 qualities (480/720/1080p),
  memory-based quality cap, screen wake lock during export.
- **Story identities** — presets in `src/config.ts` (`BRAND_PRESETS`) set art style, narrator and dialect.
- **Sleep mode** — slower narration + lullaby + gradual dimming + auto stop.
- **Story series** — "Start the next part" keeps the same characters/reference sheet and continues the plot.
- **Print-ready book** — A5 PDF with 3 mm bleed, page count padded to a multiple of 4, back cover.
- **Family voice** — record your own voice per page and narrate (and export video) with it.
- **Self-test** — open the app with `#test` to run the built-in checks.

## Features (v2.0.0)

- **Nano Banana illustrations, 2K** — English director-style prompts per page, locked art style,
  a generated character reference sheet passed to every page for consistent characters, and a
  dedicated cover. No SVG, no third-party image sources. Failed pages show a retry button.
- **Child as the hero** — upload a child photo once; it is saved on the device and used as the
  character reference for every story.
- **Image reuse** — previously generated images are reused for a near-identical scene with the same
  characters and style (never twice inside the same story).
- **Natural narration** — Gemini TTS with fully diacritized Fusha narration text, 6 narrator voices,
  per-page audio cache, whole-story auto-play. Browser speech synthesis is removed.
- **Read-Along** — the spoken word is highlighted live in the text.
- **Story video** — cinematic MP4 (16:9 or 9:16): Ken Burns camera moves, 4 transition types,
  light particles, glass caption bar with word-by-word synced highlight, animated title,
  "The End" + moral, AI-composed background music with ducking under the narrator.
- **Comprehension quiz + moral** at the end of each story, with stars.
- **My Books** — every story auto-saves (text, images, audio) to an offline bookshelf.
- **Streaming writing** — the story text appears live while it is being written.
- **Resilience** — exponential backoff on busy errors, instant model fallback on quota, clear
  Arabic/English error messages.
- **Fast start** — heavy sections and libraries (games, PDF, ZIP, video) load on demand.
- PDF book, ZIP of images, portable JSON backup (images embedded), 18 art styles, 9 science games.

## Setup

```bash
npm install
npm run dev        # http://localhost:3000
```

Production: `npm run build` then `NODE_ENV=production npm start`.

## API key handling

- On Google AI Studio the platform supplies `GEMINI_API_KEY` per visitor.
- Elsewhere a visitor can enter their own key. Images are drawn from the browser straight to Google; text goes through
  the proxy via `x-goog-api-key`, which prefers it over the environment key.
- The key lives in memory + `sessionStorage`; with "remember" it is also stored AES-GCM encrypted in IndexedDB.
- AI Studio keeps `GEMINI_API_KEY` as a server-side secret (Settings, then Secrets). If it is missing the app shows `NOKEY`.

## Branding

Brand name, author and social links live in `src/config.ts` — edit that file only.

## Project structure

```
server.ts                  # Gemini proxy: story (NDJSON), continue-story, image (+Cloudflare), narrate, music, name, explain, rewrite-prompt
src/config.ts              # brand + social links
src/services/db.ts         # IndexedDB with schema migrations
src/services/media.ts      # image store, WebP re-encode, similarity reuse
src/services/library.ts    # stories, children, hydrate/migrate, JSON serialize
src/services/narration.ts  # TTS cache, voices, word timings
src/services/video.ts      # canvas renderer + MP4/WebM encoder
src/services/videoFormats.ts # formats, qualities, sizes, device cap
src/services/printBook.ts  # print-ready A5 PDF with bleed
src/services/api.ts        # fetch with retry + localized errors
src/services/imageEngine.ts# direct / server / free image paths + diagnostics
src/services/storyBundle.ts# share + package / animation-pack ZIP
src/services/animation.ts  # per-scene animation prompts
src/services/learn.ts      # ask-anything, quizzes, illustrate, speak
src/services/progress.ts   # stars, streak, daily challenge (localStorage)
src/data/learnCards.ts     # Read & Learn cards
src/hooks/useIllustrator.ts# image pipeline (sheet → pages → cover, 2 in parallel)
src/hooks/useNarration.ts  # read-along playback
src/components/story/      # form, hero picker, reader, gallery, quiz, video sheet
src/components/library/    # My Books
src/components/layout/     # nav, credits
```
