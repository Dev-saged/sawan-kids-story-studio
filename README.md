# Sawan Kids Story Studio

AI-powered, illustrated children's story generator — Arabic (15+ dialects) and
English. **Pure client-side**: Vite + React + TypeScript only, no Node/Express
backend. Everything (Gemini text + image generation, PDF/ZIP/JSON export) runs
in the browser.

## Stack

- Vite 6 + React 18 + TypeScript, Tailwind CSS v4 (`@tailwindcss/vite`)
- `@google/genai` — Gemini text (`gemini-3.6-flash`) + image (`gemini-3.1-flash-image`)
- `jspdf` + `html2canvas` (PDF export, renders the real DOM so Arabic/RTL text
  is laid out correctly), `jszip` + `file-saver` (image ZIP / JSON save)

## Setup

```bash
npm install
cp .env.example .env
# edit .env and set VITE_GEMINI_API_KEY
npm run dev
```

## Security note — read before deploying

This is a pure client-side app: `VITE_GEMINI_API_KEY` is inlined into the
public JS bundle at **build time**. Anyone can extract it from your deployed
site. Mitigate this at the Google AI Studio / Google Cloud Console level:

1. Restrict the API key by **HTTP referrer** to your Render domain(s) + `localhost`.
2. Set a **daily quota cap** / billing alert on the key.

There is no way to fully hide a key in a backend-less static app — restricting
the key's usable origins and capping its damage radius is the standard
mitigation for this architecture.

## Deploy to Render (Static Site)

- Build command: `npm run build`
- Publish directory: `dist`
- Add `VITE_GEMINI_API_KEY` as an environment variable in the Render
  dashboard — it's consumed at build time, not at runtime.

## Project structure

```
src/
  services/gemini.ts    # Gemini text + image calls, schema-enforced JSON
  services/export.ts    # PDF / ZIP / JSON export + import
  components/story/     # setup form, progress, reader, printable pages
  components/games/     # games dashboard + individual games
  components/nameMeaning/, components/readLearn/
```
