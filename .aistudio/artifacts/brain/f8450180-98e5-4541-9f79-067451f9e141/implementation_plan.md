# Sajed Story Studio - Comprehensive Feature & Enhancement Plan

1-2 sentence summary:
Upgrade Sajed Story Studio with automated Veo 3 per-scene video motion generation incorporating all 3 motion styles, Fruit Fantasy mode, global character seed consistency, strict audio-text timing sync, multi-style 3D book covers, downloadable multi-angle cover asset sheets, customizable PDF exports, and version tracking.

## User Review & Critical Decisions

> [!IMPORTANT]
> The user confirmed and updated the following preferences:

- **Automated Veo 3 Motion Generation**: Include ALL 3 Veo 3 motion modes (*Cinematic camera sweeps*, *2.5D dynamic depth-of-field parallax*, and *Multi-angle kinetic camera scans*) with automated per-scene motion production and seamless camera transitions.
- **3D Book Presentation Styles**: Include ALL 3 presentation styles (Gold-Embossed Hardcover, Modern Minimalist Card Deck, Classic Leather Grimoire) with a smooth UI theme selector.
- **PDF Export & Cover Download Package**: Include ALL 3 export templates (Full Storybook Layout, Minimalist Picture Book, Collector Edition with Character Cards) with multi-angle cover asset sheet downloads and front cover downloads.

---

## 1. Overview & Core Concept

**Sajed Story Studio (استوديو ساجد)** is a high-fidelity children's & teen illustrated story generator. This update brings:
1. **Automated Veo 3 Per-Scene Video Motion Engine**: Every story scene automatically generates motion clips utilizing all 3 Veo 3 camera motion styles (Cinematic, 2.5D Parallax, and Multi-Angle Scans) with smooth automated transitions.
2. **Fruit Fantasy Mode Toggle**: Anthropomorphic fruit characters with 4 emotional world templates for ages 12-18.
3. **Global Character Seed & Style Locking**: Refactored image generation in `StoryGenerator` enforcing character seeds, style-locking keywords, and negative prompts for consistent character likeness.
4. **Precise Audio-Text Synchronized Highlighting**: Word-level karaoke-style highlighting matched strictly to speech audio timestamps without fetching unselected languages.
5. **Multi-Style 3D Book Cover & Interactive Viewer**: 3 distinct 3D cover styles (Gold-Embossed, Minimalist Deck, Antique Grimoire) with 360° rotation controls and customizable cover fonts (Kufi, Diwani, Naskh, 3D Embossed).
6. **Multi-Angle Cover Download & Professional PDF Export**: Instant download of front cover and assembled multi-angle cover sheets, plus 3 rich PDF layout formats with publisher copyright/credits.
7. **App Version Tracking & Code Cleanup**: Automatic version badge increment on every major build/update (`v2.4.0`) and cleanup of unused imports.

---

## 2. User Experience & Visual Design

### Key User Flows
1. **Setup & Mode Selection (`StorySetupForm.tsx`)**:
   - User can toggle **Fruit Fantasy Mode** (for anthropomorphic fruit heroes) or **Teen Drama Mode** (for ages 12-18).
   - Selecting any template pre-fills default prompts, art style, and dialect.
   - Cover font selector allows switching between Kufi, Diwani, Naskh, and 3D Embossed.
2. **Generation & Character Consistency (`StoryGenerator.ts`)**:
   - Every generated story receives a deterministic `globalCharacterSeed`.
   - Character visual attributes are anchored with strict style-locking keywords (`consistent character sheet`, `masterpiece vector illustration`, `same character features`) and negative prompts (`deformed, inconsistent faces, extra limbs, anime blur, lowres`).
3. **Automated Scene Motion Video Production (`video.ts`)**:
   - Veo 3 engine dynamically selects motion parameters (Cinematic Pan/Zoom, 2.5D Depth Parallax, Multi-Angle Camera Scan) for each scene and composites them into an automated video reel.
4. **Reading & Precise Audio Sync (`StoryReader.tsx`)**:
   - Audio narration plays audio without loading redundant languages. English audio fetches only when English language is active.
   - Text highlighting uses precise timestamp arrays so words highlight strictly when spoken.
5. **3D Interactive Book Viewer (`Cover3DViewer.tsx`)**:
   - Offers 3 distinct 3D themes (Hardcover, Minimalist Deck, Antique Grimoire).
   - Allows multi-angle 360-degree rotation, lighting effects, and cover downloads (Single Front Cover and Multi-Angle Assembled Sheet).
6. **PDF Export & Cover Download Package**:
   - PDF exporter (`exportPDF.ts`) supports 3 clean layout presets with customizable copyright/credits.

### Visual Identity & Theme
- **Canvas**: Dark dusk (`#0f172a`) and warm moonlight (`#f8fafc`).
- **Accents**: Emerald lantern (`#10b981`), Rose drama (`#f43f5e`), Amber fruit (`#f59e0b`), Royal gold (`#d97706`).
- **Typography**: Arabic Google Fonts (`Tajawal`, `Cairo`, `Amiri`, `Reem Kufi`) paired with `Plus Jakarta Sans`.

---

## 3. Key Product Decisions & Trade-Offs

- **Decision 1: Seamless Guest Access with Server Proxy**:
  - *Chosen Approach*: Default `getApiKey()` to `'server-proxy'` so all visitors open the app instantly without forced API key modals.
  - *Why*: Eliminates user drop-off and friction. Power users can still enter custom keys via the "Change API Key" link in the footer.
- **Decision 2: Automated Multi-Motion Veo 3 Reel Compositing**:
  - *Chosen Approach*: Automate the application of Cinematic, 2.5D Depth, and Multi-Angle movement routines per scene during video export.
  - *Why*: Produces professional, dynamic video output with zero manual configuration required from the user.
- **Decision 3: Client-Side Composite Canvas for Multi-Angle Cover Downloads**:
  - *Chosen Approach*: Render assembled 3D multi-angle cover sheets (front, spine, 3/4 angled view, back cover) directly using HTML5 Canvas composite exports.
  - *Why*: Instant PNG download without additional server dependencies or latency.

---

## 4. Technical Architecture & Data Strategy

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            Sajed Story Studio App                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌───────────────────────┐   ┌─────────────────────┐  ┌──────────────────┐ │
│  │  StorySetupForm.tsx   │   │   StoryReader.tsx   │  │ Cover3DViewer    │ │
│  │ (Fruit/Teen Toggles,  │   │  (Sync Highlighting,│  │(3 Themes, Multi- │ │
│  │  Cover Font Selector) │   │   Audio Sync Engine)│  │ Angle Downloads) │ │
│  └───────────┬───────────┘   └──────────┬──────────┘  └────────┬─────────┘ │
│              │                          │                      │            │
│              ▼                          ▼                      ▼            │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                        StoryGenerator Service                         │  │
│  │   - Global Character Seed Generation                                  │  │
│  │   - Style-Locking Keywords & Negative Prompts Engine                  │  │
│  │   - Language Selective Audio Fetcher                                  │  │
│  └──────────────────────────────────┬────────────────────────────────────┘  │
│                                     │                                       │
│                                     ▼                                       │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                   PDF & Veo 3 Video Export Services                   │  │
│  │   - exportPDF.ts (Storybook, Minimalist, Collector presets)           │  │
│  │   - video.ts (Automated Veo 3 Cinematic, 2.5D, Multi-Angle Motion)    │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Key Versioning & Cleanup Strategy
- Update `package.json` version and `src/config.ts` version tag (`v2.4.0`) displayed in footer.
- Clean up unused imports, dead handlers, and redundant state across components for optimal code smoothness.
