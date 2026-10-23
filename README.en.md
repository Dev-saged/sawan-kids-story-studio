<div align="center">

<img src="docs/assets/cover.png" alt="Sajed Kids Story Studio" width="100%">

<br><br>

<img src="docs/assets/icon.svg" alt="" width="96" height="96">

# Sajed Kids Story Studio

**Type one simple idea and watch your story get written, illustrated and narrated in a warm voice, Arabic first.**

Version 3.4.1 &nbsp;|&nbsp; Progressive Web App &nbsp;|&nbsp; Arabic and English UI &nbsp;|&nbsp; [العربية](README.md)

</div>

## About

Sajed Studio is an Arabic-first platform for illustrated children's stories. A parent or teacher writes a one-line idea; the studio builds a full story with characters that look the same on every page, paints each scene, reads it aloud in the chosen dialect, and delivers a finished book for screen reading or print.

It is mobile-first, fully right-to-left, and keeps the story library on the user's own device.

## Screenshots

> Live captures of version 3.1.0 (the core UI is unchanged in 3.4.0) taken from the running app. The illustrations inside the sample story (the rabbit "Arnoub") are sample artwork used for display only, not real generation output.

<table align="center">
  <tr>
    <td align="center" width="25%"><img src="docs/assets/screens/onboarding.png" alt="Onboarding"><br><sub>Onboarding</sub></td>
    <td align="center" width="25%"><img src="docs/assets/screens/home.png" alt="Studio and idea of the day"><br><sub>Studio and idea of the day</sub></td>
    <td align="center" width="25%"><img src="docs/assets/screens/style.png" alt="Identity and style"><br><sub>Identity and style</sub></td>
    <td align="center" width="25%"><img src="docs/assets/screens/generating.png" alt="Painting pages"><br><sub>Painting pages</sub></td>
  </tr>
  <tr>
    <td align="center"><img src="docs/assets/screens/cover.png" alt="Cover and reading modes"><br><sub>Cover and reading modes</sub></td>
    <td align="center"><img src="docs/assets/screens/narration.png" alt="Narrator"><br><sub>Narrator</sub></td>
    <td align="center"><img src="docs/assets/screens/library.png" alt="Library"><br><sub>Library</sub></td>
    <td align="center"><img src="docs/assets/screens/games.png" alt="Science games"><br><sub>Science games</sub></td>
  </tr>
  <tr>
    <td align="center"><img src="docs/assets/screens/learn.png" alt="Read and learn"><br><sub>Read and learn</sub></td>
    <td align="center"><img src="docs/assets/screens/health.png" alt="App health report"><br><sub>App health report</sub></td>
    <td align="center"><img src="docs/assets/screens/dark.png" alt="Dark mode"><br><sub>Dark mode</sub></td>
    <td align="center"><img src="docs/assets/screens/english.png" alt="English interface"><br><sub>English interface</sub></td>
  </tr>
</table>

## Features

| | Feature | Details |
| :-: | :-- | :-- |
| <img src="docs/assets/icons/wand-sparkles.svg" width="36" alt=""> | **Three-step studio** | Idea, look, details, with a sticky navigation bar, an "improve my idea" action, an idea-of-the-day card and voice dictation. |
| <img src="docs/assets/icons/palette.svg" width="36" alt=""> | **Identities and art styles** | 16 ready identities that set art style, narrator and dialect in one tap, plus your own saved identities. |
| <img src="docs/assets/icons/layers.svg" width="36" alt=""> | **16 story types** | Each with its own narrative arc, from bedtime to educational, fantasy and folklore. |
| <img src="docs/assets/icons/type.svg" width="36" alt=""> | **Cover typography** | 12 Arabic fonts, four title effects and a live preview before painting. |
| <img src="docs/assets/icons/mic.svg" width="36" alt=""> | **Natural narration** | Fully vocalized Arabic narration, read-along word tracking, sleep mode and ambient sound. |
| <img src="docs/assets/icons/languages.svg" width="36" alt=""> | **Dialects and languages** | Vocalized Modern Standard Arabic, 19 local dialects, and a complete Arabic and English interface. |
| <img src="docs/assets/icons/book-open.svg" width="36" alt=""> | **Five reading modes** | Story reader, illustration gallery, 3D book, two-page interactive book and a classic flipbook. |
| <img src="docs/assets/icons/sparkles.svg" width="36" alt=""> | **Consistent characters** | A character reference sheet keeps the hero identical on every page, with an album to reuse characters. |
| <img src="docs/assets/icons/sparkles.svg" width="36" alt=""> | **AI-animated scenes** | Animates each page illustration in silent clips; the app adds its own narration and captions. Pick the source: a Colab notebook running Wan through a Cloudflare queue (free from your own compute, about 5 seconds per clip) or Gemini Omni (paid, with a cost estimate and explicit consent), with free camera motion for pages you do not select. Setup: `cloudflare/video-queue/README.md` and `colab/README.md`. |
| <img src="docs/assets/icons/printer.svg" width="36" alt=""> | **Export and print** | Premium PDF templates, print preview in A5, A4 and 21x21, a full ZIP bundle and a story video. |
| <img src="docs/assets/icons/gamepad-2.svg" width="36" alt=""> | **Science games** | Small interactive labs, a daily challenge and stars to collect. |
| <img src="docs/assets/icons/graduation-cap.svg" width="36" alt=""> | **Read and learn** | Age-aware fact cards, a free-form question box and a name-meanings section. |
| <img src="docs/assets/icons/library.svg" width="36" alt=""> | **Local library** | Stories, images and audio stay on your device, with JSON backup and restore. |
| <img src="docs/assets/icons/wifi-off.svg" width="36" alt=""> | **Installable** | Installs on the phone, the app shell works offline, and a silent check looks for newer versions. |
| <img src="docs/assets/icons/heart-pulse.svg" width="36" alt=""> | **App health** | A diagnostic report with version, connectivity and available models, never exposing secrets. |
| <img src="docs/assets/icons/moon.svg" width="36" alt=""> | **Dark mode** | Instant light and dark switching that respects reduced-motion preferences. |

## Tech stack

| Layer | Used |
| :-- | :-- |
| Frontend | Vite 6, React 18, strict TypeScript, Tailwind CSS v4 with logical properties for RTL, Framer Motion |
| Server | Express 5 as a thin Gemini proxy, so the service key never reaches the browser |
| AI | `@google/genai` with fallback model chains for text, images, speech and music |
| Storage | IndexedDB with a versioned schema and automatic migrations, plus JSON backup |
| Export | jsPDF, JSZip, WebCodecs with `mp4-muxer` |
| Install | Web App Manifest and a build-versioned Service Worker |

## Run locally

```bash
npm install
export GEMINI_API_KEY="your_key_here"   # stays on the server only
npm run dev                              # http://localhost:3000
```

Production:

```bash
npm run build
NODE_ENV=production npm start
```

Type check with `npm run lint`. For the in-app self-test open `/#test`.

## Privacy and security

- The Gemini key is read from environment variables on the server and is never sent to the browser.
- User stories and images stay in the browser storage on the user's device and leave it only by manual export.
- The app health report sanitizes secrets before showing or copying anything.

## Changelog

See [CHANGELOG.md](CHANGELOG.md). Current version: **3.4.1**.

## Rights

Copyright 2026 Eng. Sajed Al-Abadlah. All rights reserved.

The design, idea, source code and visual identity of this project belong to its owner. Copying, modifying, redistributing, selling, or using the name, logo and identity is not permitted without prior written permission from the owner.

## Contact

<p align="center">
  <a href="https://github.com/Dev-saged"><img src="docs/assets/social/github.svg" width="56" alt="GitHub"></a>&nbsp;&nbsp;
  <a href="https://instagram.com/sajedd.0"><img src="docs/assets/social/instagram.svg" width="56" alt="Instagram"></a>&nbsp;&nbsp;
  <a href="https://facebook.com/saged.t"><img src="docs/assets/social/facebook.svg" width="56" alt="Facebook"></a>&nbsp;&nbsp;
  <a href="https://x.com/saged_al"><img src="docs/assets/social/x.svg" width="56" alt="X"></a>
</p>

<br>

<p align="center">
  <img src="docs/assets/flag.svg" width="44" alt="Flag of Palestine"><br>
  <strong>Made with all love from Palestine, Gaza</strong><br>
  <sub>Eng. Sajed Al-Abadlah</sub>
</p>
