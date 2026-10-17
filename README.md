# استوديو ساجد لقصص الأطفال — Sajed Kids Story Studio

AI-powered illustrated children's stories in Arabic (19 dialects + flawless Fusha) and English,
with natural narration, read-along, story videos, science games and learning articles.

**Designed & developed by Eng. Sajed Al-Abadlah — تصميم وتطوير المهندس ساجد العبادلة**

## Stack

- Vite 6 + React 18 + TypeScript (strict), Tailwind CSS v4
- `server.ts` (Express 5) — thin Gemini proxy required by Google AI Studio hosting
- `@google/genai` model chains (strongest first, each with its own quota):
  - Text: `gemini-3.8-flash` → `gemini-2.5-flash` → `gemini-3.1-flash-lite`
  - Images (Nano Banana only): `gemini-nano-banana-2.1` → `gemini-3-pro-image` → `gemini-3.1-flash-image` → `gemini-3.1-flash-lite-image`
  - Narration: `gemini-3.8-flash-tts` → `gemini-3.8-flash-lite-tts` → `gemini-3.1-flash-tts-preview` → `gemini-2.5-pro-preview-tts`
  - Music: `lyria-3-clip-preview` → `lyria-3.5` (instrumental, SynthID watermarked)
- IndexedDB (versioned schema) for the library, images, audio cache and child profiles
- WebCodecs + `mp4-muxer` for MP4 video export (MediaRecorder fallback)
- PWA: manifest + service worker (offline shell)

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
- Elsewhere a visitor can enter their own key; it lives in `sessionStorage` (this tab only) and is
  forwarded as `x-goog-api-key` to the proxy, which prefers it over the environment key.

## Branding

Brand name, author and social links live in `src/config.ts` — edit that file only.

## Project structure

```
server.ts                  # Gemini proxy: story (NDJSON stream), image, narrate, music, name
src/config.ts              # brand + social links
src/services/db.ts         # IndexedDB with schema migrations
src/services/media.ts      # image store, WebP re-encode, similarity reuse
src/services/library.ts    # stories, children, hydrate/migrate, JSON serialize
src/services/narration.ts  # TTS cache, voices, word timings
src/services/video.ts      # canvas renderer + MP4/WebM encoder
src/services/videoFormats.ts # formats, qualities, sizes, device cap
src/services/printBook.ts  # print-ready A5 PDF with bleed
src/services/api.ts        # fetch with retry + localized errors
src/hooks/useIllustrator.ts# image pipeline (sheet → pages → cover, 2 in parallel)
src/hooks/useNarration.ts  # read-along playback
src/components/story/      # form, hero picker, reader, gallery, quiz, video sheet
src/components/library/    # My Books
src/components/layout/     # nav, credits
```
