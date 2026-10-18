/* Immersive Story Engine v1.0 — UI controller */
(function () {
  const $ = (s) => document.querySelector(s);
  const LS_KEY = "ise_v1_state";
  const PX_PER_SEC_MIN = 18;

  let state = load();
  let sel = 0;              // selected frame index
  let exportTab = "manifest";
  let player = { playing: false, t: 0, raf: null, lastTs: 0, utter: null, lastSpokenIdx: -1 };

  function load() {
    try { const s = JSON.parse(localStorage.getItem(LS_KEY)); if (s && s.projects && s.projects.length) return s; } catch (e) {}
    return fresh();
  }
  function fresh() {
    const projects = JSON.parse(JSON.stringify(window.ISE_SAMPLES)).map((p) => {
      p.frames.forEach((f) => { if (!f.duration_sec) f.duration_sec = ISE.speechSeconds(p, f.narration_text, f.character_speaker) || 2; });
      ISE.fitToTarget(p, +p.target_duration); return ISE.relayout(p);
    });
    return { projects, active: 0 };
  }
  function save() { localStorage.setItem(LS_KEY, JSON.stringify(state)); }
  const P = () => state.projects[state.active];
  function toast(msg) { const t = $("#toast"); t.textContent = msg; t.classList.add("show"); clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove("show"), 1800); }
  const fmtTc = (s) => { const m = Math.floor(s / 60), ss = (s % 60); return `${String(m).padStart(2, "0")}:${ss.toFixed(1).padStart(4, "0")}`; };
  const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  /* ───────────── full render ───────────── */
  function renderAll() {
    ISE.relayout(P());
    renderProjectSelect(); renderBible(); renderVoices(); renderStage1();
    renderTimeline(); renderFrameList(); renderInspector(); renderMonitor(sel, 0); renderExport();
    $("#monitorFrame").dataset.aspect = P().bible.aspect_ratio;
    save();
  }
  function commit(opts = {}) { // after frame/bible edits
    ISE.relayout(P());
    renderTimeline(); renderFrameList(); if (!opts.skipInspector) renderInspector(); renderMonitor(sel, 0); renderExport(); renderVoices(); save();
  }

  /* ───────────── project switch ───────────── */
  function renderProjectSelect() {
    const s = $("#projectSelect");
    s.innerHTML = state.projects.map((p, i) => `<option value="${i}" ${i === state.active ? "selected" : ""}>${esc(p.name)}</option>`).join("");
  }
  $("#projectSelect").addEventListener("change", (e) => { stop(); state.active = +e.target.value; sel = 0; renderAll(); });
  $("#btnNewProject").addEventListener("click", () => { stop(); const p = ISE.blankProject(); state.projects.push(p); state.active = state.projects.length - 1; sel = 0; renderAll(); toast("Blank project created"); });
  $("#btnDuplicate").addEventListener("click", () => { stop(); const p = JSON.parse(JSON.stringify(P())); p.id += "_copy"; p.name += " (copy)"; state.projects.push(p); state.active = state.projects.length - 1; renderAll(); toast("Project duplicated"); });
  $("#btnReset").addEventListener("click", () => { if (!confirm("Reset to the two sample projects? Local edits will be lost.")) return; stop(); state = fresh(); sel = 0; renderAll(); toast("Samples restored"); });

  /* ───────────── bible ───────────── */
  const bibleMap = { bTitle: "project_title", bColor: "color_pipeline", bAspect: "aspect_ratio", bFps: "fps", bCamera: "camera_rig", bStock: "film_stock", bMotifs: "motifs", bNegative: "negative_prompts" };
  function renderBible() { for (const [id, k] of Object.entries(bibleMap)) $("#" + id).value = P().bible[k] ?? ""; }
  for (const [id, k] of Object.entries(bibleMap)) {
    $("#" + id).addEventListener("input", (e) => {
      P().bible[k] = k === "fps" ? +e.target.value : e.target.value;
      if (k === "project_title") { /* keep project name independent */ }
      if (k === "aspect_ratio") $("#monitorFrame").dataset.aspect = e.target.value;
      commit();
    });
  }

  /* ───────────── voices ───────────── */
  function renderVoices() {
    const ta = $("#voiceJson");
    if (document.activeElement !== ta) ta.value = JSON.stringify(P().voice_profiles, null, 2);
    $("#voiceChips").innerHTML = Object.entries(P().voice_profiles).map(([n, v]) => `<span class="chip"><b>${esc(n)}</b> · ${esc(v.voice_seed_id)} · ${v.wpm} wpm</span>`).join("");
    const ds = $("#defaultSpeaker");
    ds.innerHTML = Object.keys(P().voice_profiles).map((n) => `<option ${n === P().default_speaker ? "selected" : ""}>${esc(n)}</option>`).join("");
  }
  $("#voiceJson").addEventListener("input", () => { try { JSON.parse($("#voiceJson").value); setVoiceStatus(true); } catch (e) { setVoiceStatus(false, e.message); } });
  function setVoiceStatus(ok, msg) { const s = $("#voiceStatus"); s.className = "status " + (ok ? "ok" : "err"); s.textContent = ok ? "valid" : "invalid: " + msg; }
  $("#btnApplyVoices").addEventListener("click", () => {
    try {
      const v = JSON.parse($("#voiceJson").value);
      if (typeof v !== "object" || Array.isArray(v)) throw new Error("must be an object keyed by speaker name");
      for (const [n, p] of Object.entries(v)) { if (!p || typeof p !== "object") throw new Error(`${n}: profile must be an object`); p.wpm = +p.wpm || 150; p.voice_seed_id = p.voice_seed_id || `vs_${ISE_EXPORT.slug(n)}`; p.timbre = p.timbre || ""; }
      P().voice_profiles = v; if (!v[P().default_speaker]) P().default_speaker = Object.keys(v)[0] || "";
      setVoiceStatus(true); commit(); toast("Voice profiles applied");
    } catch (e) { setVoiceStatus(false, e.message); }
  });
  $("#btnAddVoice").addEventListener("click", () => {
    let v; try { v = JSON.parse($("#voiceJson").value); } catch (e) { v = P().voice_profiles; }
    let i = 1, name; do { name = `Character ${String.fromCharCode(64 + i++)}`; } while (v[name]);
    v[name] = { voice_seed_id: `vs_${ISE_EXPORT.slug(name)}_${Math.floor(Math.random() * 9000 + 1000)}`, wpm: 150, timbre: "" };
    $("#voiceJson").value = JSON.stringify(v, null, 2); setVoiceStatus(true);
  });
  $("#defaultSpeaker").addEventListener("change", (e) => { P().default_speaker = e.target.value; save(); });

  /* ───────────── stage 1 ───────────── */
  const MODE_HINT = {
    narrative: "Narrative Micro-Scene Mode — splits text at sentence boundaries into ~15–20 word micro-scenes; durations derived from word count ÷ speaker WPM.",
    commercial: "Commercial Beat Mode — rapid product-ad pattern (0.0–0.7s hook, 0.7–2.0s, 2.0–4.5s …) scaled to target; each sentence becomes one beat.",
  };
  function renderStage1() {
    const p = P();
    $("#scriptText").value = p.script_text || "";
    $("#targetDuration").value = p.target_duration; $("#durLabel").textContent = p.target_duration;
    $("#fitMode").value = p.fit_mode || "fit";
    document.querySelectorAll(".seg").forEach((b) => b.classList.toggle("active", b.dataset.mode === p.mode));
    $("#modeHint").textContent = MODE_HINT[p.mode];
    scriptStats();
  }
  function scriptStats() { const wc = ISE.wordCount($("#scriptText").value); const est = ISE.speechSeconds(P(), $("#scriptText").value, P().default_speaker); $("#scriptStats").textContent = `${wc} words · ≈${est.toFixed(1)}s at ${ISE.wpmFor(P(), P().default_speaker)} wpm`; }
  $("#scriptText").addEventListener("input", (e) => { P().script_text = e.target.value; scriptStats(); save(); });
  $("#targetDuration").addEventListener("input", (e) => { P().target_duration = +e.target.value; $("#durLabel").textContent = e.target.value; save(); });
  $("#fitMode").addEventListener("change", (e) => { P().fit_mode = e.target.value; save(); });
  document.querySelectorAll(".seg").forEach((b) => b.addEventListener("click", () => { P().mode = b.dataset.mode; if (b.dataset.mode === "commercial" && P().target_duration > 60) { P().target_duration = 15; } renderStage1(); save(); }));
  $("#btnDecompose").addEventListener("click", () => {
    if (!P().script_text.trim()) return toast("Paste a script first");
    stop(); ISE.decompose(P()); sel = 0; renderAll(); toast(`Decomposed into ${P().frames.length} timed beats`);
    $("#stage23").scrollIntoView({ behavior: "smooth", block: "start" });
  });
  $("#btnRetime").addEventListener("click", () => { ISE.retime(P()); commit(); toast("Retimed from speech estimates"); });
  $("#btnAddFrame").addEventListener("click", () => { P().frames.splice(sel + 1, 0, ISE.newFrame(P())); sel = Math.min(sel + 1, P().frames.length - 1); commit(); });

  /* ───────────── timeline ───────────── */
  function pxPerSec() {
    const lane = $("#laneVideo"); const w = Math.max(700, lane.clientWidth || 800);
    return Math.max(PX_PER_SEC_MIN, w / Math.max(1, P().total_duration_sec));
  }
  function renderTimeline() {
    const p = P(), pps = pxPerSec(), total = p.total_duration_sec;
    const width = Math.ceil(total * pps) + 2;
    $("#tracks").style.minWidth = (width + 80) + "px"; $("#ruler").style.minWidth = width + "px";
    const step = total > 90 ? 10 : total > 40 ? 5 : total > 15 ? 2 : 1;
    let r = ""; for (let t = 0; t <= total; t += step) r += `<span style="left:${t * pps}px">${t}s</span>`; $("#ruler").innerHTML = r;
    const blk = (f, i, cls, text) => `<div class="block ${cls}" data-i="${i}" style="left:${f.start_time_sec * pps}px;width:${Math.max(4, f.duration_sec * pps - 2)}px" title="${esc(text)}">${cls === "video" ? `<span class="fid">${f.frame_id}</span>` : ""}${esc(text)}${cls === "video" ? '<span class="handle" data-handle="1"></span>' : ""}</div>`;
    $("#laneVideo").innerHTML = p.frames.map((f, i) => blk(f, i, "video" + (i === sel ? " selected" : ""), f.visual_subject || f.visual_prompt)).join("");
    $("#laneDialogue").innerHTML = p.frames.map((f, i) => blk(f, i, (f.narration_text ? "dialogue" : "silent") + (i === sel ? " selected" : ""), f.narration_text ? `${f.character_speaker}: ${f.narration_text}` : "silent")).join("");
    $("#laneSfx").innerHTML = p.frames.map((f, i) => blk(f, i, (f.sfx_cue ? "sfx" : "silent") + (i === sel ? " selected" : ""), f.sfx_cue || "—")).join("");
    // ducking envelope svg
    const H = 48, hi = 8, lo = 34;
    let d = `M0 ${hi}`; let x = 0;
    p.frames.forEach((f) => { const y = f.ducking_db ? lo : hi; const x2 = f.end_time_sec * pps; d += ` L${x} ${y} L${x2} ${y}`; x = x2; });
    const labels = p.frames.map((f) => `<text x="${f.start_time_sec * pps + 4}" y="${(f.ducking_db ? lo : hi) + (f.ducking_db ? 10 : -2) + (f.ducking_db ? 0 : 0)}" font-size="9" fill="${f.ducking_db ? "#ffb347" : "#8e44ad"}" font-family="monospace">${f.ducking_db ? "-12dB" : "0dB"}</text>`).join("");
    $("#duckSvg").setAttribute("viewBox", `0 0 ${width} ${H}`); $("#duckSvg").style.width = width + "px";
    $("#duckSvg").innerHTML = `<rect x="0" y="0" width="${width}" height="${H}" fill="rgba(142,68,173,.08)"/><path d="${d} L${width} ${hi} L${width} ${H} L0 ${H} Z" fill="rgba(142,68,173,.25)"/><path d="${d}" stroke="#c39bd3" stroke-width="2" fill="none"/>${labels}`;
    $("#tcTotal").textContent = fmtTc(total);
    $("#timelineStats").textContent = `${p.frames.length} frames · ${total.toFixed(1)}s total · target ${p.target_duration}s${Math.abs(total - p.target_duration) > 0.5 ? ` (Δ ${(total - p.target_duration).toFixed(1)}s)` : ""}`;
    setPlayhead(player.t);
  }
  $("#tracks").addEventListener("click", (e) => { const b = e.target.closest(".block"); if (!b || e.target.dataset.handle) return; selectFrame(+b.dataset.i, true); });
  // drag handle (ripple retime)
  let drag = null;
  $("#tracks").addEventListener("pointerdown", (e) => {
    if (!e.target.dataset.handle) return; const b = e.target.closest(".block"); const i = +b.dataset.i;
    drag = { i, x0: e.clientX, d0: P().frames[i].duration_sec, pps: pxPerSec() }; e.target.setPointerCapture(e.pointerId); e.preventDefault();
  });
  $("#tracks").addEventListener("pointermove", (e) => { if (!drag) return; const nd = Math.max(0.1, ISE.r1(drag.d0 + (e.clientX - drag.x0) / drag.pps)); if (nd !== P().frames[drag.i].duration_sec) { P().frames[drag.i].duration_sec = nd; sel = drag.i; commit(); } });
  $("#tracks").addEventListener("pointerup", () => { drag = null; });
  function setPlayhead(t) { $("#playhead").style.left = (80 + t * pxPerSec()) + "px"; $("#tcCurrent").textContent = fmtTc(t); }
  window.addEventListener("resize", renderTimeline);

  /* ───────────── frame list ───────────── */
  function renderFrameList() {
    const p = P();
    if (!p.frames.length) { $("#frameList").innerHTML = `<div class="empty">No frames yet. Run Stage 1.</div>`; return; }
    $("#frameList").innerHTML = p.frames.map((f, i) => `<div class="frame-card ${i === sel ? "selected" : ""}" data-i="${i}">
      <div class="num">${f.frame_id}</div>
      <div><div class="txt">${esc(f.narration_text || f.visual_subject || "(silent visual beat)")}</div><div class="sub">${f.time_window} · ${f.character_speaker || "—"}</div></div>
      <span class="badge ${f.ducking_db ? "duck" : "flat"}">${f.ducking_db ? "-12dB" : "0dB"}</span></div>`).join("");
  }
  $("#frameList").addEventListener("click", (e) => { const c = e.target.closest(".frame-card"); if (c) selectFrame(+c.dataset.i, false); });
  function selectFrame(i, scrollList) {
    sel = i; renderTimeline(); renderFrameList(); renderInspector(); renderMonitor(i, 0);
    if (!player.playing) { player.t = P().frames[i].start_time_sec; setPlayhead(player.t); }
    if (scrollList) { const c = $(`.frame-card[data-i="${i}"]`); c && c.scrollIntoView({ block: "nearest" }); }
  }

  /* ───────────── inspector ───────────── */
  function renderInspector() {
    const p = P(), f = p.frames[sel];
    const box = $("#inspector");
    if (!f) { box.innerHTML = `<div class="empty">Select a frame.</div>`; return; }
    const speakers = ["", ...Object.keys(p.voice_profiles)];
    const parts = ISE.promptParts(p, f);
    const estCls = f.est_speech_sec > f.duration_sec + 0.05 ? "over" : f.est_speech_sec ? "under" : "";
    const tOpts = (v) => ISE.TRANSITIONS.map((t) => `<option ${t === v ? "selected" : ""}>${t}</option>`).join("");
    box.innerHTML = `
      <div class="ins-head">
        <h3>frame_id ${f.frame_id} <span class="muted">· time_window</span> "${f.time_window}"</h3>
        <div class="inline">
          <span class="badge ${f.ducking_db ? "duck" : "flat"}">${f.ducking_db ? "♫ BGM -12dB ducking active" : "♫ BGM 0dB · silent visual beat"}</span>
          <button class="btn ghost small" data-act="up" ${sel === 0 ? "disabled" : ""}>↑</button>
          <button class="btn ghost small" data-act="down" ${sel === p.frames.length - 1 ? "disabled" : ""}>↓</button>
          <button class="btn ghost small" data-act="split" ${f.word_count < 2 ? "disabled" : ""} title="Split narration in half into two frames">⑂ Split</button>
          <button class="btn ghost small danger" data-act="del">✕ Delete</button>
        </div>
      </div>
      <div class="ins-grid">
        <div class="field span2"><label>Timing (seconds) — editing duration ripples later frames</label>
          <div class="time-controls">
            <input type="number" step="0.1" min="0" id="iStart" value="${f.start_time_sec}" title="start_time_sec (moves by changing previous frame)" />
            <input type="number" step="0.1" min="0.1" id="iDur" value="${f.duration_sec}" title="duration_sec" />
            <input type="number" step="0.1" min="0.1" id="iEnd" value="${f.end_time_sec}" title="end_time_sec" />
          </div>
          <div class="inline between"><span class="muted">start · duration · end</span>
            <span class="speech-est ${estCls}">${f.word_count} words · est. speech ${f.est_speech_sec.toFixed(1)}s @ ${ISE.wpmFor(p, f.character_speaker)} wpm ${estCls === "over" ? "⚠ exceeds frame" : ""}</span>
            <button class="btn ghost small" data-act="fitSpeech" ${!f.est_speech_sec ? "disabled" : ""}>Snap duration to speech</button>
          </div>
        </div>
        <div class="field"><label>character_speaker</label>
          <select id="iSpeaker">${speakers.map((s) => `<option value="${esc(s)}" ${s === (f.character_speaker || "") ? "selected" : ""}>${s || "— none (silent) —"}</option>`).join("")}</select></div>
        <div class="field"><label>transitions in / out</label>
          <div class="inline"><select id="iTin">${tOpts(f.transition_in)}</select><select id="iTout">${tOpts(f.transition_out)}</select></div></div>
        <div class="field span2"><label>narration_text</label>
          <textarea id="iText" rows="2">${esc(f.narration_text)}</textarea></div>
        <div class="field"><label>sfx_cue</label><input id="iSfx" value="${esc(f.sfx_cue)}" placeholder="rain on window, heavy footstep" /></div>
        <div class="field"><label>bgm_mood</label><input id="iBgm" value="${esc(f.bgm_mood)}" placeholder="Subtle dark synth ambient" /></div>
        <div class="field span2"><label>visual_prompt — optics-first composition (auto)</label>
          <div class="prompt-box"><span class="p1">${esc(parts.subject)}.</span> <span class="p2">Shot on ${esc(parts.camera)}.</span> <span class="p3">${esc(parts.lighting)}.</span> <span class="p4">${esc(parts.stock)}.</span></div>
          <div class="legend"><span><i style="background:#ffd591"></i>Subject/Action</span><span><i style="background:#8fd3ff"></i>Camera/Lens (Bible or override)</span><span><i style="background:#b5f7c8"></i>Lighting/Atmosphere + motif</span><span><i style="background:#e6b3ff"></i>Film Stock/Color Grade</span></div>
        </div>
        <div class="field span2"><label>[1] subject / action</label><textarea id="iSubject" rows="2" placeholder="Derived from scene; leave blank to auto-derive from narration">${esc(f.visual_subject)}</textarea></div>
        <div class="field"><label>[2] per-shot lens override</label><input id="iLens" value="${esc(f.lens_override)}" placeholder="${esc(p.bible.camera_rig)} (Bible default)" /></div>
        <div class="field"><label>[3] lighting / atmosphere</label><input id="iLight" value="${esc(f.lighting)}" placeholder="low-key blue emergency strip, breath-vapor haze" /></div>
        <div class="field span2"><label>global negative prompts (Bible, read-only)</label><input value="${esc(p.bible.negative_prompts)}" disabled /></div>
      </div>`;

    const bind = (id, key, fn) => $("#" + id).addEventListener("input", (e) => { f[key] = fn ? fn(e.target.value) : e.target.value; commit({ skipInspector: true }); liveInspector(); });
    bind("iText", "narration_text"); bind("iSfx", "sfx_cue"); bind("iBgm", "bgm_mood"); bind("iSubject", "visual_subject"); bind("iLens", "lens_override"); bind("iLight", "lighting");
    $("#iSpeaker").addEventListener("change", (e) => { f.character_speaker = e.target.value; commit(); });
    $("#iTin").addEventListener("change", (e) => { f.transition_in = e.target.value; commit(); });
    $("#iTout").addEventListener("change", (e) => { f.transition_out = e.target.value; commit(); });
    $("#iDur").addEventListener("change", (e) => { f.duration_sec = Math.max(0.1, +e.target.value); commit(); });
    $("#iEnd").addEventListener("change", (e) => { f.duration_sec = Math.max(0.1, +e.target.value - f.start_time_sec); commit(); });
    $("#iStart").addEventListener("change", (e) => { const prev = p.frames[sel - 1]; if (!prev) { e.target.value = 0; return; } const ns = +e.target.value; prev.duration_sec = Math.max(0.1, ns - prev.start_time_sec); commit(); });
    box.querySelectorAll("[data-act]").forEach((b) => b.addEventListener("click", () => act(b.dataset.act)));
  }
  function liveInspector() { // light refresh of computed bits without rebuilding inputs
    const p = P(), f = p.frames[sel]; if (!f) return;
    const parts = ISE.promptParts(p, f);
    const pb = $("#inspector .prompt-box"); if (pb) pb.innerHTML = `<span class="p1">${esc(parts.subject)}.</span> <span class="p2">Shot on ${esc(parts.camera)}.</span> <span class="p3">${esc(parts.lighting)}.</span> <span class="p4">${esc(parts.stock)}.</span>`;
    const se = $("#inspector .speech-est"); if (se) { const over = f.est_speech_sec > f.duration_sec + 0.05; se.className = "speech-est " + (over ? "over" : f.est_speech_sec ? "under" : ""); se.textContent = `${f.word_count} words · est. speech ${f.est_speech_sec.toFixed(1)}s @ ${ISE.wpmFor(p, f.character_speaker)} wpm ${over ? "⚠ exceeds frame" : ""}`; }
    const bd = $("#inspector .ins-head .badge"); if (bd) { bd.className = "badge " + (f.ducking_db ? "duck" : "flat"); bd.textContent = f.ducking_db ? "♫ BGM -12dB ducking active" : "♫ BGM 0dB · silent visual beat"; }
  }
  function act(a) {
    const p = P(), f = p.frames[sel];
    if (a === "del") { if (p.frames.length === 1) return toast("Keep at least one frame"); p.frames.splice(sel, 1); sel = Math.max(0, sel - 1); }
    if (a === "up" && sel > 0) { [p.frames[sel - 1], p.frames[sel]] = [p.frames[sel], p.frames[sel - 1]]; sel--; }
    if (a === "down" && sel < p.frames.length - 1) { [p.frames[sel + 1], p.frames[sel]] = [p.frames[sel], p.frames[sel + 1]]; sel++; }
    if (a === "fitSpeech") f.duration_sec = f.est_speech_sec;
    if (a === "split") {
      const w = f.narration_text.trim().split(/\s+/), h = Math.ceil(w.length / 2);
      const nf = { ...f, narration_text: w.slice(h).join(" "), visual_subject: "", duration_sec: ISE.r1(f.duration_sec / 2), transition_in: "cut" };
      f.narration_text = w.slice(0, h).join(" "); f.duration_sec = ISE.r1(f.duration_sec / 2); f.transition_out = "cut";
      p.frames.splice(sel + 1, 0, nf);
    }
    commit();
  }

  /* ───────────── monitor + playback ───────────── */
  function renderMonitor(i, localT) {
    const p = P(), f = p.frames[i];
    if (!f) { $("#monPrompt").textContent = "No frames."; return; }
    $("#monFrameId").textContent = `frame_id ${f.frame_id}`; $("#monWindow").textContent = f.time_window;
    $("#monTransition").textContent = `${f.transition_in} → ${f.transition_out}`;
    $("#monPrompt").textContent = f.visual_prompt;
    $("#monSubtitle").textContent = f.narration_text ? `${f.character_speaker ? f.character_speaker + ": " : ""}${f.narration_text}` : "";
    $("#monSfx").textContent = [f.sfx_cue ? `SFX: ${f.sfx_cue}` : "", f.bgm_mood ? `BGM: ${f.bgm_mood}` : ""].filter(Boolean).join("   ·   ");
    setMeter(f.ducking_db);
  }
  function setMeter(db) {
    const lin = Math.pow(10, db / 20);
    $("#bgmMeter").style.width = (lin * 100) + "%";
    const el = $("#bgmDb"); el.textContent = (db === 0 ? "0" : db.toFixed(1)) + " dB"; el.classList.toggle("ducked", db < -0.5);
  }
  function frameAt(t) { const fr = P().frames; for (let i = 0; i < fr.length; i++) if (t < fr[i].end_time_sec) return i; return fr.length - 1; }
  function play() {
    if (!P().frames.length) return;
    if (player.t >= P().total_duration_sec - 0.01) player.t = 0;
    player.playing = true; player.lastTs = performance.now(); player.lastSpokenIdx = -1; $("#btnPlay").textContent = "❚❚";
    tick(player.lastTs);
  }
  function pause() { player.playing = false; $("#btnPlay").textContent = "▶"; cancelAnimationFrame(player.raf); if (window.speechSynthesis) speechSynthesis.cancel(); }
  function stop() { pause(); player.t = P().frames[sel] ? P().frames[sel].start_time_sec : 0; setPlayhead(player.t); const f = P().frames[sel]; if (f) setMeter(f.ducking_db); }
  function tick(ts) {
    if (!player.playing) return;
    const rate = +$("#playRate").value || 1;
    player.t += ((ts - player.lastTs) / 1000) * rate; player.lastTs = ts;
    const p = P(), total = p.total_duration_sec;
    if (player.t >= total) { player.t = total; pause(); setPlayhead(total); return; }
    const i = frameAt(player.t), f = p.frames[i];
    if (i !== sel) { sel = i; renderFrameList(); renderInspector(); renderTimeline(); $("#monitorFrame").classList.remove("flash"); void $("#monitorFrame").offsetWidth; $("#monitorFrame").classList.add("flash"); const c = $(`.frame-card[data-i="${i}"]`); c && c.scrollIntoView({ block: "nearest" }); }
    if (i !== player.lastSpokenIdx) { player.lastSpokenIdx = i; renderMonitor(i, 0); speak(f, rate); }
    // animated ducking envelope: 120ms attack, 350ms release
    const local = player.t - f.start_time_sec, target = f.ducking_db;
    const prev = p.frames[i - 1]; const from = prev ? prev.ducking_db : 0;
    const ramp = target < from ? 0.12 : 0.35;
    const db = from + (target - from) * Math.min(1, local / ramp);
    setMeter(db);
    setPlayhead(player.t);
    player.raf = requestAnimationFrame(tick);
  }
  function speak(f, rate) {
    if (!$("#ttsToggle").checked || !window.speechSynthesis || !f.narration_text) return;
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(f.narration_text);
    const wpm = ISE.wpmFor(P(), f.character_speaker);
    u.rate = Math.min(2.5, Math.max(0.5, (wpm / 150) * rate));
    // deterministic voice per speaker from available voices
    const voices = speechSynthesis.getVoices(); if (voices.length) { const names = Object.keys(P().voice_profiles); const idx = Math.max(0, names.indexOf(f.character_speaker)); u.voice = voices[idx % voices.length]; u.pitch = 1 - (idx % 3) * 0.15; }
    speechSynthesis.speak(u); player.utter = u;
  }
  $("#btnPlay").addEventListener("click", () => (player.playing ? pause() : play()));
  $("#btnStop").addEventListener("click", stop);
  $("#btnPrev").addEventListener("click", () => selectFrame(Math.max(0, sel - 1), true));
  $("#btnNext").addEventListener("click", () => selectFrame(Math.min(P().frames.length - 1, sel + 1), true));
  document.addEventListener("keydown", (e) => {
    if (/INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
    if (e.code === "Space") { e.preventDefault(); player.playing ? pause() : play(); }
    if (e.key === "ArrowLeft") selectFrame(Math.max(0, sel - 1), true);
    if (e.key === "ArrowRight") selectFrame(Math.min(P().frames.length - 1, sel + 1), true);
  });
  // click on ruler to scrub
  $("#ruler").addEventListener("click", (e) => { const rect = $("#ruler").getBoundingClientRect(); const t = Math.max(0, (e.clientX - rect.left) / pxPerSec()); player.t = Math.min(t, P().total_duration_sec); selectFrame(frameAt(player.t), true); player.t = t; setPlayhead(t); });

  /* ───────────── exporter ───────────── */
  const FILES = { manifest: ["timeline_manifest.json", "json", (p) => ISE_EXPORT.manifest(p)], ffmpeg: ["render_pipeline.sh", "sh", (p) => ISE_EXPORT.ffmpeg(p)], remotion: ["remotion_props.json", "json", (p) => ISE_EXPORT.remotion(p)] };
  function exportText() { return FILES[exportTab][2](P()); }
  function renderExport() {
    const [name, kind] = FILES[exportTab]; const txt = exportText();
    $("#exportCode").innerHTML = ISE_EXPORT.highlight(txt, kind);
    const [W, H] = ISE_EXPORT.dims(P().bible.aspect_ratio);
    $("#exportInfo").textContent = `${name} · ${(txt.length / 1024).toFixed(1)} KB · ${P().frames.length} frames · ${W}×${H} @ ${P().bible.fps}fps · ${P().total_duration_sec.toFixed(1)}s`;
    document.querySelectorAll(".tab").forEach((t) => t.classList.toggle("active", t.dataset.tab === exportTab));
  }
  $("#exportTabs").addEventListener("click", (e) => { const t = e.target.closest(".tab"); if (t) { exportTab = t.dataset.tab; renderExport(); } });
  $("#btnCopy").addEventListener("click", async () => { try { await navigator.clipboard.writeText(exportText()); toast("Copied " + FILES[exportTab][0]); } catch (e) { const ta = document.createElement("textarea"); ta.value = exportText(); document.body.appendChild(ta); ta.select(); document.execCommand("copy"); ta.remove(); toast("Copied"); } });
  $("#btnDownload").addEventListener("click", () => {
    const [name, kind] = FILES[exportTab]; const prefix = ISE_EXPORT.slug(P().bible.project_title);
    const blob = new Blob([exportText()], { type: kind === "json" ? "application/json" : "text/x-shellscript" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `${prefix}_${name}`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 500); toast("Downloaded " + a.download);
  });

  if (window.speechSynthesis) speechSynthesis.onvoiceschanged = () => {};
  renderAll();
})();
