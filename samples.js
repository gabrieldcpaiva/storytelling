/* Immersive Story Engine v1.0 — Sample projects */
window.ISE_SAMPLES = (function () {
  function f(o) {
    return Object.assign({
      character_speaker: "Narrator", narration_text: "", sfx_cue: "", bgm_mood: "",
      visual_subject: "", lens_override: "", lighting: "", transition_in: "cut", transition_out: "cut",
    }, o);
  }

  const frozenLight = {
    id: "frozen-light",
    name: "Frozen Light — 45s Sci-Fi Narrative Sequence",
    mode: "narrative",
    target_duration: 45,
    fit_mode: "fit",
    default_speaker: "Narrator",
    bible: {
      project_title: "Frozen Light",
      color_pipeline: "ACEScg",
      aspect_ratio: "2.39:1",
      fps: 24,
      camera_rig: "ARRI Alexa Mini, 50mm Anamorphic, f/1.8",
      film_stock: "35mm Kodak Vision3 500T, cool teal shadows, halation on highlights",
      motifs: "frost crystals growing on glass, a single blue beacon pulse, breath vapor in zero light",
      negative_prompts: "text, watermark, logo, extra limbs, cartoon, oversaturated, lens flare overload, blurry faces",
    },
    voice_profiles: {
      "Narrator":  { voice_seed_id: "vs_narr_7731", wpm: 140, timbre: "low, unhurried, documentary gravitas, slight rasp" },
      "Dr. Ilse Varga": { voice_seed_id: "vs_ilse_2210", wpm: 165, timbre: "clipped, precise, Central European accent, controlled fear" },
      "ORBIT (ship AI)": { voice_seed_id: "vs_orbit_0042", wpm: 120, timbre: "synthetic, warm, no breath, ends sentences flat" },
    },
    script_text:
      "Four hundred days out from Earth, the Meridian stopped answering.\n" +
      "Inside, every surface had frozen into a mirror of its own light.\n" +
      "Dr. Ilse Varga: ORBIT, status. Talk to me.\n" +
      "ORBIT: Life support at four percent. I kept the lights on for you.\n" +
      "She moved through the corridor where frost grew in slow spirals across the glass.\n" +
      "A single blue beacon pulsed at the end of the hall, patient, counting.\n" +
      "Dr. Ilse Varga: Why is it still running? Who is it counting for?\n" +
      "ORBIT: For the one who comes back. That was always you.\n" +
      "And in the frozen light, she finally saw her own reflection step forward first.",
    frames: [
      f({ character_speaker: "Narrator", narration_text: "Four hundred days out from Earth, the Meridian stopped answering.",
          sfx_cue: "deep hull creak, distant metallic ping every 3s", bgm_mood: "Subtle dark synth ambient, sub-bass drone",
          visual_subject: "Wide exterior of the derelict research vessel Meridian drifting against a dim star field, hull rimed with ice",
          lighting: "single cold key from a distant sun, deep crushed shadows, volumetric frost particulate", transition_in: "dissolve", transition_out: "cut" }),
      f({ character_speaker: "Narrator", narration_text: "Inside, every surface had frozen into a mirror of its own light.",
          sfx_cue: "ice crackle, ventilation hiss fading", bgm_mood: "Subtle dark synth ambient, glassy high pad enters",
          visual_subject: "Slow push-in down a frozen corridor, walls mirrored with ice reflecting a faint blue emergency strip",
          lighting: "low-key blue emergency strip, specular ice reflections, breath-vapor haze", transition_in: "cut", transition_out: "cut" }),
      f({ character_speaker: "Dr. Ilse Varga", narration_text: "ORBIT, status. Talk to me.",
          sfx_cue: "helmet seal release, sharp inhale", bgm_mood: "Ambient thins to near silence",
          visual_subject: "Close-up on Dr. Ilse Varga lifting her visor, frost on her eyelashes, eyes scanning the dark",
          lens_override: "ARRI Alexa Mini, 75mm Anamorphic, f/1.4", lighting: "visor-reflected HUD glow as key, cold rim from corridor strip", transition_in: "cut", transition_out: "cut" }),
      f({ character_speaker: "ORBIT (ship AI)", narration_text: "Life support at four percent. I kept the lights on for you.",
          sfx_cue: "soft synthetic chime, relay click", bgm_mood: "Warm minor pad swells under AI voice",
          visual_subject: "Extreme close-up of a frost-covered speaker grille, a soft amber indicator breathing in rhythm with the voice",
          lens_override: "ARRI Alexa Mini, 100mm Macro, f/2.8", lighting: "amber practical as sole source, bokeh frost crystals", transition_in: "cut", transition_out: "dissolve" }),
      f({ character_speaker: "Narrator", narration_text: "She moved through the corridor where frost grew in slow spirals across the glass.",
          sfx_cue: "slow boot steps on ice, fabric rustle", bgm_mood: "Subtle dark synth ambient, slow pulse",
          visual_subject: "Tracking shot following Varga from behind as frost spirals bloom across observation glass beside her",
          lighting: "moonlit blue from the window, her silhouette edged with rim light", transition_in: "dissolve", transition_out: "cut" }),
      f({ character_speaker: "", narration_text: "", duration_sec: 2.5,
          sfx_cue: "beacon pulse: low sub thump, then silence", bgm_mood: "Pulse synced to beacon, full level",
          visual_subject: "Static wide of the corridor's end, a single blue beacon pulsing once, light racing along the frozen walls",
          lighting: "beacon as sole strobe source, long decaying afterglow on ice", transition_in: "cut", transition_out: "cut" }),
      f({ character_speaker: "Narrator", narration_text: "A single blue beacon pulsed at the end of the hall, patient, counting.",
          sfx_cue: "beacon pulse continues, quieter, rhythmic", bgm_mood: "Subtle dark synth ambient, pulse continues",
          visual_subject: "Medium shot of Varga stopped mid-corridor, beacon light washing over her face in slow waves",
          lighting: "intermittent blue wash, otherwise near-black", transition_in: "cut", transition_out: "cut" }),
      f({ character_speaker: "Dr. Ilse Varga", narration_text: "Why is it still running? Who is it counting for?",
          sfx_cue: "her voice echoes in the metal corridor", bgm_mood: "Tension cluster, held",
          visual_subject: "Close-up profile of Varga, breath vapor curling, her reflection faintly visible in the ice wall behind her",
          lens_override: "ARRI Alexa Mini, 75mm Anamorphic, f/1.4", lighting: "blue beacon key, warm amber fill from a distant panel", transition_in: "cut", transition_out: "cut" }),
      f({ character_speaker: "ORBIT (ship AI)", narration_text: "For the one who comes back. That was always you.",
          sfx_cue: "systems powering up in sequence, gentle rising hum", bgm_mood: "Warm minor pad resolves to major",
          visual_subject: "Slow dolly toward the beacon as corridor panels flicker alive one by one down the hall",
          lighting: "panels igniting warm white in sequence, blue beacon fading", transition_in: "cut", transition_out: "match-cut" }),
      f({ character_speaker: "Narrator", narration_text: "And in the frozen light, she finally saw her own reflection step forward first.",
          sfx_cue: "ice fracture, a single footstep that is not hers", bgm_mood: "Full swell then hard cut to silence on last word",
          visual_subject: "Varga facing a mirrored ice wall, her reflection moving a half-beat before she does, frost crystals growing across the frame",
          lighting: "fully lit corridor now, clinical white, reflection slightly brighter than reality", transition_in: "match-cut", transition_out: "dissolve" }),
    ],
  };

  const commercial = {
    id: "flagship-ad",
    name: "Flagship Product Commercial — 15s Beat-Split Ad",
    mode: "commercial",
    target_duration: 15,
    fit_mode: "fit",
    default_speaker: "Narrator",
    bible: {
      project_title: "Wrath of Fire",
      color_pipeline: "ACEScg",
      aspect_ratio: "9:16",
      fps: 30,
      camera_rig: "RED V-Raptor, 35mm Macro Prime, f/2.8, high-speed 120fps",
      film_stock: "Digital clean, warm ember grade, deep blacks, high micro-contrast",
      motifs: "ember sparks, molten orange light sweep, brushed titanium reflections",
      negative_prompts: "text overlays, hands with wrong fingers, dust on product, blown highlights, competitor logos",
    },
    voice_profiles: {
      "Narrator": { voice_seed_id: "vs_ad_vo_9001", wpm: 170, timbre: "confident, warm baritone, close-mic'd, intimate" },
      "Character A": { voice_seed_id: "vs_user_a_311", wpm: 180, timbre: "young, bright, casual enthusiasm" },
    },
    script_text:
      "Ignite.\n" +
      "Forged from titanium. Built for heat.\n" +
      "Character A: It just... never slows down.\n" +
      "Forty-eight hours of fire on a single charge.\n" +
      "Wrath of Fire. Available now.",
    frames: [
      f({ character_speaker: "", narration_text: "", duration_sec: 0.7, sfx_cue: "sharp ignition whoosh, spark crackle", bgm_mood: "Silence, then single percussive hit",
          visual_subject: "Black frame, a single ember ignites center and flares toward lens", lighting: "ember as sole source, pitch black surround", transition_in: "cut", transition_out: "whip-pan" }),
      f({ character_speaker: "Narrator", narration_text: "Ignite.", sfx_cue: "bass drop, ember shower", bgm_mood: "Driving trap-industrial beat enters",
          visual_subject: "Product (flagship titanium device) emerging from a shower of sparks, hero angle, rotating 15 degrees", lighting: "molten orange key sweeping left to right, cool rim", transition_in: "whip-pan", transition_out: "cut" }),
      f({ character_speaker: "Narrator", narration_text: "Forged from titanium. Built for heat.", sfx_cue: "metal ring, heat shimmer tone", bgm_mood: "Beat continues, filtered",
          visual_subject: "Extreme macro slide across brushed titanium edge, heat shimmer rising, reflections of fire", lens_override: "RED V-Raptor, 100mm Macro Probe, f/4", lighting: "raking hard light revealing brushed texture, orange bounce", transition_in: "cut", transition_out: "match-cut" }),
      f({ character_speaker: "Character A", narration_text: "It just... never slows down.", sfx_cue: "ambient city, soft laugh", bgm_mood: "Beat drops to half-time groove",
          visual_subject: "Young user mid-stride at night holding the device, city lights streaking behind, candid smile", lens_override: "RED V-Raptor, 50mm Prime, f/1.4", lighting: "neon practicals, device screen glow on face", transition_in: "match-cut", transition_out: "cut" }),
      f({ character_speaker: "Narrator", narration_text: "Forty-eight hours of fire on a single charge.", sfx_cue: "charging hum rising, single click", bgm_mood: "Beat full, rising riser",
          visual_subject: "Device on obsidian slab, battery glyph igniting from empty to full as flames trace its outline", lighting: "under-lit orange glow, top-down soft white", transition_in: "cut", transition_out: "cut" }),
      f({ character_speaker: "Narrator", narration_text: "Wrath of Fire. Available now.", sfx_cue: "final impact hit, spark fizzle out", bgm_mood: "Final hit, tail reverb to silence",
          visual_subject: "Hero product lockup centered, embers settling, slow dolly out to black", lighting: "clean three-point with warm key, embers as practical accents", transition_in: "cut", transition_out: "dissolve" }),
    ],
  };

  return [frozenLight, commercial];
})();
