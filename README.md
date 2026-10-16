# Sawan Kids Story Studio

AI-powered, illustrated children's story generator — Arabic (15+ dialects) and
English. **Pure client-side**: Vite + React + TypeScript only, no Node/Express
backend. Everything runs in the browser.

## Stack

- Vite 6 + React 18 + TypeScript, Tailwind CSS v4 (`@tailwindcss/vite`)
- `@google/genai` — Gemini text (`gemini-3.6-flash`) + image (`gemini-3.1-flash-image`)
- `jspdf` + `html2canvas` (PDF book), `jszip` + `file-saver` (ZIP / JSON)

## Features (v1.3.0)

- **Real AI illustrations only** — no SVG placeholders. Pictures are painted page by page
  as the reader opens each page (or all at once with "Paint all pictures"); a failed page
  can be retried or repainted.
- **Editable image prompts** per page, plus a "New angle" rewrite that keeps characters and style.
- **PDF book** (A4 or Square): cover, introduction, contents, story pages, lessons.
  Full package ZIP (JSON + text + images + PDF). PDF/package unlock once every picture exists.
- **Save / load** a story (browser storage with automatic fallback to a JSON file), animation
  prompt copy, WhatsApp / Facebook share.
- **Setup form**: Surprise me, age-aware tips, minimum-words check, reading-time estimate,
  picture shape (4:3 / 16:9 / 9:16), 18 art styles, 19 Arabic dialects.
- **9 science games**: Volcano, Magnet, Transformer, Generator & Motor, MRI, Chemistry,
  Element Catch, Candy Ladder, Fault Types.

## Setup

```bash
npm install
npm run dev
```

Open the app, then enter your own Gemini API key from
https://aistudio.google.com/apikey when prompted.

## API key handling

- Each visitor enters **their own** key. No key is stored in the code or the build.
- The key is kept in `sessionStorage`: it lives only in that browser tab and is
  cleared when the tab closes. "Change API key" on the Studio screen clears it.
- The key is sent only to Google's Gemini API, directly from the browser.
- Because the key is entered at runtime, the app must not be given any `.env` key.

## Deploy

- Static site (e.g. Render): build command `npm run build`, publish directory `dist`.
- No environment variables are required.

## Project structure

```
src/
  services/apiKey.ts    # sessionStorage key helpers
  services/gemini.ts    # Gemini text + image calls (timeout + retry), schema-enforced JSON
  services/pdf.ts       # PDF book renderer (html2canvas -> jsPDF, Arabic-safe)
  services/export.ts    # ZIP / package / JSON export, save + validated import
  services/feedback.ts  # offline game sounds + haptics
  components/apiKey/    # key entry screen
  components/story/     # setup form, progress, reader
  components/games/     # games dashboard + individual games
  components/nameMeaning/, components/readLearn/
```
