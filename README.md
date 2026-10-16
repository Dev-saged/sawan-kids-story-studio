# Sawan Kids Story Studio

AI-powered, illustrated children's story generator — Arabic (15+ dialects) and
English. **Pure client-side**: Vite + React + TypeScript only, no Node/Express
backend. Everything runs in the browser.

## Stack

- Vite 6 + React 18 + TypeScript, Tailwind CSS v4 (`@tailwindcss/vite`)
- `@google/genai` — Gemini text (`gemini-3.6-flash`) + image (`gemini-3.1-flash-image`)
- `jspdf` + `html2canvas` (PDF export), `jszip` + `file-saver` (ZIP / JSON)

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
  services/gemini.ts    # Gemini text + image calls, schema-enforced JSON
  services/export.ts    # PDF / ZIP / JSON export + import
  components/apiKey/    # key entry screen
  components/story/     # setup form, progress, reader, printable pages
  components/games/     # games dashboard + individual games
  components/nameMeaning/, components/readLearn/
```
