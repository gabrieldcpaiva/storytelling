# Immersive Story Engine v1.0 — Beat-Split Timeline & Continuity Studio

Zero-dependency, responsive web app that decomposes a raw script or commercial concept into an
interactive multi-track timeline of timed micro-scenes and compiles production-ready assets.

## Run

```bash
python3 -m http.server 8080      # then open http://localhost:8080
```
(Any static file server works — there is no build step.)

## 4-stage architecture

| Stage | What it does | Files |
|---|---|---|
| **Bible** | Global Continuity Lock (title, `ACEScg`, aspect ratio, camera/lens rig, film stock, motifs, negative prompts) + `voice_profiles` JSON editor (`voice_seed_id`, WPM, timbre) | `index.html`, `app.js` |
| **Stage 1** | `script_text` + `target_duration` slider (15–180 s). *Narrative Micro-Scene* mode splits into ~15–20-word scenes along sentence boundaries; *Commercial Beat* mode uses the rapid 0.0–0.7 s / 0.7–2.0 s … pattern. `Speaker:` line prefixes bind to voice profiles. Durations = words ÷ speaker WPM, scaled to target. | `engine.js` |
| **Stage 2·3** | Multi-track timeline (VIDEO / DIALOGUE / SFX / BGM duck envelope), drag-to-retime with ripple, frame inspector for the full frame schema, optics-first `visual_prompt` auto-composition `[Subject] + [Camera/Lens] + [Lighting] + [Stock/Grade]`, `-12dB ducking active` badge on any frame with narration, animatic transport with `speechSynthesis` preview and animated BGM ducking meter. | `app.js` |
| **Stage 4** | Tabbed, syntax-highlighted exporters with Copy/Download: `timeline_manifest.json`, `render_pipeline.sh` (FFmpeg: conform + pad, concat, VO/SFX placement via `adelay`, `sidechaincompress` ducking **and** an equivalent `volume` keyframe expression, loudnorm, mux, SRT), `remotion_props.json` (fps-exact sequences + volume curve). | `exporters.js` |

Two sample projects are pre-loaded (`samples.js`): **Frozen Light — 45s Sci-Fi Narrative Sequence**
and **Flagship Product Commercial — 15s Beat-Split Ad**. State autosaves to `localStorage`;
"Reset samples" restores the originals.

Shortcuts: `Space` play/pause · `←`/`→` step frames · click the ruler to scrub.
