/* Immersive Story Engine v1.0 — core engine (timing, chunking, prompt composition) */
window.ISE = (function () {
  const DUCK_DB = -12;
  const TRANSITIONS = ["cut", "dissolve", "whip-pan", "match-cut"];
  const COMMERCIAL_BEATS = [0.7, 1.3, 2.5, 3.0, 3.5, 4.0]; // base 15s beat-split pattern (sum = 15)

  const r1 = (n) => Math.round(n * 10) / 10;
  const r3 = (n) => Math.round(n * 1000) / 1000;
  const wordCount = (t) => (t || "").trim() ? t.trim().split(/\s+/).length : 0;

  function wpmFor(project, speaker) {
    const vp = project.voice_profiles || {};
    const p = vp[speaker];
    return (p && +p.wpm) || 150;
  }

  /** Estimated speech seconds for a text at a speaker's WPM, with a 0.35s breath pad. */
  function speechSeconds(project, text, speaker) {
    const wc = wordCount(text);
    if (!wc) return 0;
    return r3(wc / wpmFor(project, speaker) * 60 + 0.35);
  }

  /** Recompute start/end/time_window and ducking from durations, sequentially. */
  function relayout(project) {
    let t = 0;
    project.frames.forEach((fr, i) => {
      fr.frame_id = i + 1;
      fr.duration_sec = Math.max(0.1, r1(+fr.duration_sec || 0.1));
      fr.start_time_sec = r1(t);
      fr.end_time_sec = r1(t + fr.duration_sec);
      fr.time_window = `${fr.start_time_sec.toFixed(1)}s - ${fr.end_time_sec.toFixed(1)}s`;
      fr.word_count = wordCount(fr.narration_text);
      fr.est_speech_sec = speechSeconds(project, fr.narration_text, fr.character_speaker);
      fr.ducking_db = fr.narration_text && fr.narration_text.trim() ? DUCK_DB : 0;
      fr.ducking = fr.ducking_db === DUCK_DB ? "-12dB ducking active" : "0dB (silent visual beat)";
      fr.visual_prompt = composePrompt(project, fr);
      t += fr.duration_sec;
    });
    project.total_duration_sec = r1(t);
    return project;
  }

  /** Optics-first: [Subject/Action] + [Camera/Lens] + [Lighting/Atmosphere] + [Film Stock/Color Grade] */
  function promptParts(project, fr) {
    const b = project.bible || {};
    const motifs = (b.motifs || "").split(",").map((s) => s.trim()).filter(Boolean);
    const motif = motifs.length ? motifs[(fr.frame_id - 1) % motifs.length] : "";
    const subject = (fr.visual_subject || "").trim() || (fr.narration_text ? `Scene illustrating: "${fr.narration_text.trim()}"` : "Silent visual beat, atmospheric insert");
    const camera = (fr.lens_override || "").trim() || b.camera_rig || "Cinema camera, 50mm, f/2.0";
    const lighting = [(fr.lighting || "").trim(), motif ? `motif: ${motif}` : ""].filter(Boolean).join(", ") || "naturalistic motivated lighting";
    const stock = [b.film_stock, b.color_pipeline ? `${b.color_pipeline} pipeline` : "", b.aspect_ratio ? `${b.aspect_ratio} frame` : ""].filter(Boolean).join(", ");
    return { subject, camera, lighting, stock };
  }
  function composePrompt(project, fr) {
    const p = promptParts(project, fr);
    return `${p.subject}. Shot on ${p.camera}. ${p.lighting}. ${p.stock}.`;
  }

  /** Parse "Speaker: line" prefixes when the speaker exists in voice_profiles. */
  const escRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  /** Aliases accepted as a line prefix: full profile name, or its first word (e.g. "ORBIT" for "ORBIT (ship AI)"). */
  function speakerAliases(project) {
    const out = [];
    Object.keys(project.voice_profiles || {}).forEach((n) => {
      out.push({ name: n, alias: n });
      const first = n.split(/[\s(]/)[0];
      if (first && first.length > 2 && first !== n) out.push({ name: n, alias: first });
    });
    return out.sort((a, b) => b.alias.length - a.alias.length);
  }
  function detectSpeaker(project, text, fallback) {
    for (const a of speakerAliases(project)) {
      const m = text.match(new RegExp(`^\\s*${escRe(a.alias)}\\s*:\\s*([\\s\\S]+)$`, "i"));
      if (m) return { speaker: a.name, text: m[1].trim() };
    }
    return { speaker: fallback, text: text.trim() };
  }

  /** Split script into sentences; keep "Speaker:" prefixes attached to their sentence(s). */
  function sentences(text) {
    // split after terminal punctuation only when followed by an uppercase/quote/digit (keeps "just... never" intact)
    return text.split(/(?<=[.!?…]["')\]]*)\s+(?=[A-Z0-9"'(\[])|\n+/).map((s) => s.trim()).filter(Boolean);
  }

  /** Narrative micro-scene mode: ~15–20 word micro-scenes along sentence boundaries, speaker-aware. */
  function chunkNarrative(project, script, fallbackSpeaker) {
    const units = [];
    // Segment by line (a "Speaker:" prefix owns its line); without newlines, split at speaker prefixes so dialogue never merges with narration.
    const aliases = speakerAliases(project).map((a) => escRe(a.alias));
    const splitRe = aliases.length ? new RegExp(`\\n+|(?<=[.!?…]["')\\]]*)\\s+(?=(?:${aliases.join("|")})\\s*:)`, "gi") : /\n+/;
    const segs = script.split(splitRe);
    segs.forEach((seg) => {
      if (!seg.trim()) return;
      const d = detectSpeaker(project, seg, fallbackSpeaker);
      let buf = [];
      const flush = () => { if (buf.length) { units.push({ speaker: d.speaker, text: buf.join(" ") }); buf = []; } };
      sentences(d.text).forEach((s) => {
        const wcS = wordCount(s), wcB = wordCount(buf.join(" "));
        if (wcB && wcB + wcS > 20) flush();
        if (wcS > 24) { // hard-split very long sentences
          flush();
          const w = s.split(/\s+/);
          for (let i = 0; i < w.length; i += 18) units.push({ speaker: d.speaker, text: w.slice(i, i + 18).join(" ") });
        } else buf.push(s);
        if (wordCount(buf.join(" ")) >= 15) flush();
      });
      flush();
    });
    return units;
  }

  /** Commercial beat mode: rapid pattern (0.0–0.7s, 0.7–2.0s, …) scaled to target; text distributed across beats. */
  function chunkCommercial(project, script, fallbackSpeaker) {
    const units = [];
    script.split(/\n+/).forEach((line) => {
      const d = detectSpeaker(project, line, fallbackSpeaker);
      sentences(d.text).forEach((s) => units.push({ speaker: d.speaker, text: s }));
    });
    return units;
  }

  function decompose(project) {
    const script = project.script_text || "";
    const fb = project.default_speaker || Object.keys(project.voice_profiles || {})[0] || "Narrator";
    const target = +project.target_duration || 45;
    let frames = [];
    if (project.mode === "commercial") {
      const units = chunkCommercial(project, script, fb);
      // Leading silent hook beat (0.0–0.7s), then units, pad with a silent end-card if pattern longer.
      const scale = target / 15;
      const pattern = COMMERCIAL_BEATS.map((d) => r1(d * scale));
      frames.push({ character_speaker: "", narration_text: "", sfx_cue: "ignition hit", bgm_mood: "Impact hit", visual_subject: "Hook: product teased in darkness", duration_sec: pattern[0], transition_in: "cut", transition_out: "whip-pan" });
      units.forEach((u, i) => frames.push({ character_speaker: u.speaker, narration_text: u.text, sfx_cue: "", bgm_mood: "Driving beat", visual_subject: "", duration_sec: pattern[Math.min(i + 1, pattern.length - 1)], transition_in: "cut", transition_out: "cut" }));
      if (units.length + 1 < pattern.length) frames.push({ character_speaker: "", narration_text: "", sfx_cue: "tail reverb", bgm_mood: "Resolve to silence", visual_subject: "End card lockup", duration_sec: pattern[pattern.length - 1], transition_in: "cut", transition_out: "dissolve" });
    } else {
      const units = chunkNarrative(project, script, fb);
      frames = units.map((u) => ({ character_speaker: u.speaker, narration_text: u.text, sfx_cue: "", bgm_mood: "Subtle dark synth ambient", visual_subject: "", duration_sec: speechSeconds(project, u.text, u.speaker), transition_in: "cut", transition_out: "cut" }));
      if (!frames.length) frames.push({ character_speaker: "", narration_text: "", sfx_cue: "", bgm_mood: "", visual_subject: "", duration_sec: target });
    }
    frames.forEach((f) => Object.assign(f, { lens_override: f.lens_override || "", lighting: f.lighting || "" }));
    project.frames = frames;
    if (project.fit_mode !== "natural") fitToTarget(project, target);
    return relayout(project);
  }

  /** Scale all durations so the total equals target (keeps proportions, enforces ≥ speech time softly). */
  function fitToTarget(project, target) {
    const total = project.frames.reduce((a, f) => a + (+f.duration_sec || 0), 0) || 1;
    const k = target / total;
    project.frames.forEach((f) => { f.duration_sec = Math.max(0.1, r1(f.duration_sec * k)); });
    // fix rounding drift on the last frame
    const sum = project.frames.reduce((a, f) => a + f.duration_sec, 0);
    const last = project.frames[project.frames.length - 1];
    if (last) last.duration_sec = Math.max(0.1, r1(last.duration_sec + (target - sum)));
  }

  /** Recompute each frame's duration from its narration (silent frames keep theirs). */
  function retime(project) {
    project.frames.forEach((f) => { const s = speechSeconds(project, f.narration_text, f.character_speaker); if (s) f.duration_sec = s; });
    if (project.fit_mode !== "natural") fitToTarget(project, +project.target_duration || project.total_duration_sec);
    return relayout(project);
  }

  function blankProject() {
    return {
      id: "p_" + Math.random().toString(36).slice(2, 8),
      name: "Untitled Project",
      mode: "narrative", target_duration: 45, fit_mode: "fit", default_speaker: "Narrator",
      bible: { project_title: "Wrath of Fire", color_pipeline: "ACEScg", aspect_ratio: "2.39:1", fps: 24, camera_rig: "ARRI Alexa Mini, 50mm Anamorphic, f/1.8", film_stock: "35mm Kodak Vision3 500T", motifs: "", negative_prompts: "text, watermark, extra fingers" },
      voice_profiles: { "Narrator": { voice_seed_id: "vs_narr_0001", wpm: 150, timbre: "neutral, warm" }, "Character A": { voice_seed_id: "vs_char_a_0002", wpm: 165, timbre: "bright, youthful" }, "Character B": { voice_seed_id: "vs_char_b_0003", wpm: 140, timbre: "gravelly, low" } },
      script_text: "",
      frames: [],
    };
  }

  function newFrame(project) {
    return { character_speaker: project.default_speaker || "", narration_text: "", sfx_cue: "", bgm_mood: "", visual_subject: "", lens_override: "", lighting: "", transition_in: "cut", transition_out: "cut", duration_sec: 2 };
  }

  /** Ducking envelope keyframes for the whole timeline (for FFmpeg volume expr & Remotion). */
  function duckEnvelope(project) {
    return project.frames.map((f) => ({ frame_id: f.frame_id, t0: f.start_time_sec, t1: f.end_time_sec, gain_db: f.ducking_db }));
  }

  return { DUCK_DB, TRANSITIONS, COMMERCIAL_BEATS, wordCount, speechSeconds, wpmFor, relayout, composePrompt, promptParts, decompose, retime, fitToTarget, blankProject, newFrame, duckEnvelope, r1 };
})();
