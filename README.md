# Immersive Story Engine v1.0

## Beat-Split Timeline & Continuity Studio

A complete, responsive, local-first filmmaking workspace. Turn a script or commercial concept into a timed, multi-track story, keep its visual and vocal identities consistent, preview its rhythm, and compile production handoff files.

Built with **React 19, TypeScript, Vite, Lucide, and plain CSS**. Fonts and concept artwork are bundled locally. No backend, external API, account, or credentials are required.

## Run

Requires Node.js **22.12+**.

```bash
npm install
npm run dev
```

The development server binds to `0.0.0.0:5173` and accepts proxied preview hosts.

```bash
npm run build       # TypeScript check + production build
npm run preview     # Serve the production build
```

`dist/` can be deployed to any static web host. All browser asset URLs are same-origin; there are no browser-facing localhost API calls.

## Two complete starting projects

- **Frozen Light — 45s Sci-Fi Narrative Sequence:** 12 beats, two persistent character voices, 24 fps, ACEScg, 2.39:1 anamorphic, ARRI Alexa Mini / 50mm, Kodak Vision3 500T, environmental SFX, silent visual beats, and mixed editorial transitions.
- **Flagship Product Commercial — 15s Beat-Split Ad:** eight beats for ARC One headphones, two voice profiles, 30 fps, 16:9, with the opening beats timed at 0.0–0.7s and 0.7–2.0s.

Use the project selector in the sidebar to switch samples. Create a blank project, duplicate an existing project, or restore an original sample through the project actions menu.

## Workflow

### 1. Script & beats

- Edit the raw script and set a target of 15–180 seconds.
- Select **Narrative micro-scenes** for balanced chunks of approximately 15–20 words, or **Commercial beat mode** for short, sentence-based product beats.
- Prefix dialogue with a voice name, e.g. `Narrator:` or `Character A:`. Unknown labels are retained as script text, not silently dropped.
- Write `[Visual: a description]` or `[Silent: a description]` for a visual beat without dialogue.
- Generation is deterministic and runs locally. Speech duration is estimated from word count and each speaker's WPM; beat durations are proportionally allocated to the requested runtime, with exact millisecond boundaries.
- When the target is too short for natural delivery, the inspector and export screen flag **speech-fit warnings**. The system does not secretly change the voice profile's speaking rate.
- Regeneration requires confirmation when it would replace existing shot edits. Undo restores the prior timeline.

### 2. Global continuity & visual optics

The **Continuity Bible** controls project title, color pipeline, aspect ratio, default camera and lens, film stock, recurring motifs, and global negative prompts.

With the lock enabled, every prompt uses the global rig and grade. Unlocking allows explicit per-shot camera or full-prompt overrides; re-locking restores global prompt composition without discarding the stored overrides.

The automatic prompt order is:

```text
Subject / action → camera / lens → lighting / atmosphere → film stock / color pipeline / aspect → motifs
```

Negative prompts are separately included in every exported frame.

### 3. Timeline, voices & audio continuity

- Select a beat from any track to inspect it.
- Drag visual clips to reorder them; drag a clip's right edge to resize it. The resize handle also supports Left/Right arrow adjustments.
- Numeric **Start**, **End**, and **Duration** controls maintain a continuous timeline. A start-boundary edit redistributes time between adjacent beats; duration/end edits ripple later beats.
- Add, duplicate, or delete beats. Edits are limited to a 180-second total and a minimum 0.1-second beat.
- Switch between horizontal tracks and a vertical shot list. Timeline zoom, seeking, previous/next-frame navigation, subtitles, expanded preview, and keyboard playback are implemented.
- Edit the speaker, narration, SFX cue, BGM mood, visual subject, camera override, atmosphere, and in/out transitions in the inspector.
- Voice profiles can be edited using cards or a validated JSON editor. Each profile preserves `voice_seed_id`, `speaking_rate_wpm` (60–300), and `timbre_notes`. Removing a voice reassigns affected frames to a remaining profile.
- Non-empty dialogue sets music gain to **−12 dB** (`0.251188643` linear). Silent beats restore **0 dB** (`1.0` linear). The preview meter and both assembly formats use the same rule.

**Preview scope:** the animatic uses shared, AI-generated concept stills with subtle motion and the selected composition aspect ratio. It is not a generated final video. Optional browser `speechSynthesis` approximates pacing and uses a stable voice mapping where voices are available; production seed IDs and exact timbre cannot be reproduced by the browser. Music and SFX remain production cues until actual audio assets are supplied. No final media generation service is connected.

### 4. Export compiler

Three syntax-highlighted compilers update from the live project. Each has copy and download controls. **Download bundle** provides all three files plus an asset handoff README in a ZIP.

| File                     | Contents                                                                                                                                                                                                                 |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `timeline_manifest.json` | Complete continuity bible, voice map, frame timing/schema, optics and negative prompts, ducking metadata, and sequential asset references.                                                                               |
| `render_pipeline.sh`     | Runnable, commented Bash/FFMPEG pipeline: video normalization, aspect padding, cut/dissolve/whip-pan assembly, separate dialogue/SFX concatenation, exact music volume automation, mixing, and final H.264/AAC encoding. |
| `remotion_props.json`    | Composition dimensions/fps/runtime, cumulatively quantized sequences, media references, subtitles, voice identities, transitions, and frame-based BGM volume segments.                                                   |

#### Production asset contract

Provide your final assets with sequential three-digit names:

```text
assets/
├── frame_001.mp4       # alternatively frame_001.png or frame_001.jpg
├── dialogue_001.wav    # generated/recorded dialogue for this beat
├── sfx_001.wav         # optional scene sound effects
├── ...                # repeat for each beat
└── bgm.wav             # continuous music bed
```

Render using Bash 4+ and FFmpeg 5+ with libx264:

```bash
bash render_pipeline.sh ./assets ./output.mp4

# Optional low-resolution timing proof:
WIDTH=640 HEIGHT=268 bash render_pipeline.sh ./assets ./proof.mp4
```

- Missing visuals use charcoal placeholders; missing dialogue, SFX, or BGM use silence. Missing assets are explicitly reported in the terminal.
- Short video sources loop. Stills loop. Dialogue and SFX are padded or trimmed to their beat.
- Dissolves are centered crossfades; whip-pans use `smoothleft`. Padded visual handles retain the absolute timeline duration. Transition length is capped at 0.25s and reduced for short beats. An incoming non-cut transition takes precedence over the previous outgoing transition.
- Match-cuts use a hard cut and require appropriately matched source composition/motion.
- The music envelope is evaluated on absolute timeline time. It is not an approximate, level-dependent compressor setting.
- The export expects **display-referred Rec.709 video assets**. ACEScg remains the working-space/continuity metadata: apply the appropriate ACES display transform before supplying final media. No incorrect blanket ACES-to-Rec.709 conversion is invented by the compiler.
- The Remotion export is **props, not a bundled renderer**. Supply your `ImmersiveStoryComposition` React component, register the composition metadata, resolve media through `staticFile()`, and consume the sequences and `volumeSegments`. Integration instructions are included in the JSON.
- Times are stored to millisecond precision; final video necessarily quantizes to the chosen fps. Remotion quantizes cumulative boundaries rather than individual durations, preventing drift.

## Persistence & shortcuts

Projects are automatically saved to this browser's `localStorage` under `immersive-story-engine:workspace:v1`, with a visible save indicator and corruption validation. Storage failure is surfaced in the header. Data is not sent to a server or synchronized across devices. Download your handoff bundle before clearing browser storage.

Undo/redo history stores up to 50 project edits during the current session. Switching projects resets that project's in-memory undo stack; saved project edits remain intact.

| Shortcut                        | Action                                                            |
| ------------------------------- | ----------------------------------------------------------------- |
| `Space`                         | Play / pause when not editing a form or focused button            |
| `Ctrl/⌘ Z`                      | Undo a studio edit (native text undo is preserved in text fields) |
| `Ctrl/⌘ Shift Z`                | Redo                                                              |
| `?`                             | Open the quick guide                                              |
| `Escape`                        | Close a dialog or menu                                            |
| `← / →` on the timeline ruler   | Seek one second                                                   |
| `← / →` on a clip resize handle | Resize by 0.1s                                                    |

## Tests

```bash
npm test              # 31 engine/compiler unit tests
npx playwright install chromium
npm run test:e2e      # 12 browser workflow, responsive, download, and accessibility tests
npm run test:render   # actual FFmpeg/ffprobe integration and measured ducking tests
npm run format:check
```

For a preinstalled Chromium binary, set `CHROMIUM_EXECUTABLE_PATH`. The Playwright suite starts a dev server when one is not already running.

The render tests require `ffmpeg` and `ffprobe` on `PATH`. They render both complete samples, check exact duration/frame count, exercise missing assets, still-image padding and looped-video sources, and measure the music gain difference against a generated reference tone. Temporary media is removed after the test. Measured results are approximately **−12.00 dB** and **−12.02 dB**, within AAC encoding tolerance.

The browser tests cover playback, both samples, shot editing, undo/redo, persistence, reordering/resizing, real zoom changes, continuity overrides, aspect-ratio preview, voice JSON validation, generation, each download and ZIP bundle, clipboard copy, new projects, all views at 320px/390px, and automated WCAG A/AA checks. Automated accessibility checks supplement, rather than replace, manual assistive-technology testing.

## Source map

```text
src/
├── App.tsx                   Workspace orchestration, navigation, dialogs, shortcuts
├── components/               Preview, timeline, inspector, and each studio stage
├── lib/
│   ├── model.ts              Typed schema, validation, timing, optics, audio helpers
│   ├── samples.ts            Both complete sample projects
│   ├── engine.ts             Script parsing, decomposition, timing, speech-fit checks
│   ├── exporters.ts          Live JSON, FFMPEG, and Remotion compilers
│   ├── useStudio.ts          Autosave, project switching, undo/redo
│   ├── usePlayback.ts        Real-time clock and optional browser speech preview
│   └── clipboard.ts          Clipboard API with an embedded-preview fallback
├── test/                     Unit tests
├── styles.css                Workspace, preview, inspector, timeline, responsive rules
└── styles-pages.css          Script, continuity, voice, and export stage styles
public/images/                Optimized, bundled concept artwork
scripts/test-render.mjs       Actual media encoder integration tests
e2e/studio.spec.ts            End-to-end and accessibility checks
```
