import { Frame, Project, uid } from './model';

const negative =
  'No text, watermarks, extra limbs, distorted anatomy, oversaturation, inconsistent wardrobe, temporal flicker.';
const base = {
  camera_override: '',
  visual_prompt_override: '',
  transition_in: 'cut' as const,
  transition_out: 'cut' as const,
  image_position: '50% 50%',
  bgm_mood: 'Subtle dark synth ambient; a slowly unfolding, glacial pulse',
  character_speaker: 'Narrator',
  lighting_atmosphere: 'Cold blue-hour light, drifting snow, subtle amber highlights',
};

const frozenFrames: Frame[] = [
  {
    ...base,
    id: 'frozen-01',
    title: 'The quiet frontier',
    duration_sec: 4.5,
    narration_text: 'At the edge of a dying sun, the ice began to speak.',
    sfx_cue: 'Low arctic wind, distant ice settling',
    visual_subject: 'A lone astronaut crosses a vast frozen valley toward a monumental alien ring',
    image: '/images/frozen-expanse.webp',
    image_position: '50% 55%',
  },
  {
    ...base,
    id: 'frozen-02',
    title: 'A hundred years',
    duration_sec: 4.5,
    narration_text: 'No signal had crossed this valley in a hundred years.',
    sfx_cue: 'Crunching boots on snow, soft radio static',
    visual_subject: 'Slow push toward the dark alien structure, its outline half-buried in snow',
    image: '/images/frozen-expanse.webp',
    image_position: '25% 45%',
    transition_out: 'dissolve',
  },
  {
    ...base,
    id: 'frozen-03',
    title: 'First contact',
    duration_sec: 2,
    narration_text: '',
    sfx_cue: 'A single crystalline ping beneath the ice',
    visual_subject: 'An amber pulse travels through translucent blue ice beneath a gloved hand',
    image: '/images/frozen-signal.webp',
    transition_in: 'dissolve',
  },
  {
    ...base,
    id: 'frozen-04',
    title: 'Something below',
    duration_sec: 4.5,
    character_speaker: 'Character A',
    narration_text: "There's something down there. And it knows we're here.",
    sfx_cue: 'Intimate helmet breath, rising electrical hum',
    visual_subject: 'Mara presses her gloved hand against the warm vein of light inside the ice',
    image: '/images/frozen-signal.webp',
    image_position: '75% 50%',
  },
  {
    ...base,
    id: 'frozen-05',
    title: 'Follow the light',
    duration_sec: 5,
    narration_text: 'Mara followed the light through the frozen remains of another world.',
    sfx_cue: 'Footsteps echoing, falling fragments of ice',
    visual_subject: 'The astronaut follows a thin amber signal into the monumental glacial passage',
    image: '/images/frozen-expanse.webp',
    image_position: '35% 50%',
    transition_out: 'match-cut',
  },
  {
    ...base,
    id: 'frozen-06',
    title: 'The threshold',
    duration_sec: 3,
    narration_text: '',
    sfx_cue: 'Deep resonant sub-bass, ice creaking overhead',
    visual_subject:
      'The immense circular portal awakens, dwarfing the lone figure at its threshold',
    image: '/images/frozen-expanse.webp',
    image_position: '30% 40%',
    transition_in: 'match-cut',
  },
  {
    ...base,
    id: 'frozen-07',
    title: 'A heartbeat',
    duration_sec: 3,
    narration_text: 'Beneath the silence, a heartbeat.',
    sfx_cue: 'Two soft, distant mechanical heartbeats',
    visual_subject: 'Macro detail of golden light beating rhythmically within the ancient glacier',
    image: '/images/frozen-signal.webp',
    image_position: '20% 50%',
    transition_out: 'dissolve',
  },
  {
    ...base,
    id: 'frozen-08',
    title: 'Not a warning',
    duration_sec: 2.5,
    character_speaker: 'Character A',
    narration_text: "This isn't a warning.",
    sfx_cue: 'The radio static falls away to complete stillness',
    visual_subject: 'Mara holds her hand still as the crystalline light responds to her presence',
    image: '/images/frozen-signal.webp',
    image_position: '65% 50%',
    transition_in: 'dissolve',
  },
  {
    ...base,
    id: 'frozen-09',
    title: 'An ancient memory',
    duration_sec: 6,
    narration_text: 'The glacier opened like an eye, revealing a memory older than the stars.',
    sfx_cue: 'A vast harmonic swell, crystalline resonance',
    visual_subject:
      'The alien ring opens in the glacial valley, a warm light illuminating the swirling snow',
    image: '/images/frozen-expanse.webp',
    image_position: '30% 45%',
  },
  {
    ...base,
    id: 'frozen-10',
    title: 'The invitation',
    duration_sec: 2,
    character_speaker: 'Character A',
    narration_text: "It's an invitation.",
    sfx_cue: 'A breath, followed by a clear harmonic tone',
    visual_subject: 'Amber light dances across the astronaut glove as she reaches into the signal',
    image: '/images/frozen-signal.webp',
    image_position: '70% 45%',
  },
  {
    ...base,
    id: 'frozen-11',
    title: 'An answer',
    duration_sec: 4,
    narration_text: 'And for the first time, she answered.',
    sfx_cue: 'A gentle release of energy; the wind softens',
    visual_subject:
      'The lone astronaut takes a final step toward the illuminated heart of the structure',
    image: '/images/frozen-expanse.webp',
    image_position: '55% 50%',
    transition_out: 'dissolve',
  },
  {
    ...base,
    id: 'frozen-12',
    title: 'Frozen light',
    duration_sec: 4,
    narration_text: '',
    sfx_cue: 'Long reverb tail fading into the distant wind',
    visual_subject:
      'A final wide view of the silent glacial world, the ring glowing like a new sun',
    image: '/images/frozen-expanse.webp',
    image_position: '50% 40%',
    transition_in: 'dissolve',
  },
];

const commercialFrames: Frame[] = [
  {
    ...base,
    id: 'arc-01',
    title: 'The interruption',
    duration_sec: 0.7,
    narration_text: '',
    sfx_cue: 'Sharp sub-bass impact; a snap to silence',
    visual_subject: 'A razor-thin amber rim reveals the silhouette of matte-black headphones',
    image_position: '50% 50%',
  },
  {
    ...base,
    id: 'arc-02',
    title: 'Meet ARC One',
    duration_sec: 1.3,
    narration_text: 'Meet ARC One.',
    sfx_cue: 'Clean metallic shimmer',
    visual_subject: 'The ARC One headphones rotate into a sculptural three-quarter hero view',
    transition_in: 'whip-pan',
  },
  {
    ...base,
    id: 'arc-03',
    title: 'The world, on mute',
    duration_sec: 2,
    narration_text: 'The world, on mute.',
    sfx_cue: 'Urban noise abruptly dissolving into silence',
    visual_subject: 'Close detail of the precision-machined noise-cancellation control',
    image_position: '65% 40%',
  },
  {
    ...base,
    id: 'arc-04',
    title: 'Find your focus',
    duration_sec: 2.5,
    narration_text: 'Made for your kind of focus.',
    sfx_cue: 'Subtle tactile click and soft air movement',
    visual_subject:
      'Soft black ear cushions and brushed titanium surfaces catch a moving key light',
    transition_out: 'match-cut',
    image_position: '70% 60%',
  },
  {
    ...base,
    id: 'arc-05',
    title: 'Considered details',
    duration_sec: 2,
    narration_text: '',
    sfx_cue: 'A polished, minimal percussive accent',
    visual_subject:
      'Macro exploration of the seamless titanium headband and luxurious material finish',
    transition_in: 'match-cut',
    image_position: '50% 25%',
  },
  {
    ...base,
    id: 'arc-06',
    title: 'Nothing else',
    duration_sec: 2.5,
    narration_text: 'Hear everything. Feel nothing else.',
    sfx_cue: 'Expansive stereo bloom',
    visual_subject: 'The glowing amber ring expands around the floating headphones',
    transition_in: 'dissolve',
  },
  {
    ...base,
    id: 'arc-07',
    title: 'Your space',
    duration_sec: 2,
    narration_text: 'Your sound. Your space.',
    sfx_cue: 'Warm, resolved sonic signature',
    visual_subject: 'The complete product settles into a perfectly balanced hero composition',
  },
  {
    ...base,
    id: 'arc-08',
    title: 'Find your quiet',
    duration_sec: 2,
    narration_text: 'ARC One. Find your quiet.',
    sfx_cue: 'Final soft pulse, elegant reverb tail',
    visual_subject:
      'Final hero shot of ARC One against seamless graphite, with space for an end-card',
    transition_in: 'dissolve',
  },
].map((frame) => ({
  ...base,
  ...frame,
  image: '/images/arc-headphones.webp',
  lighting_atmosphere: 'Warm amber rim light, soft overhead key, deep graphite shadows',
  bgm_mood: 'Minimal electronic pulse; premium, precise, restrained',
})) as Frame[];

export function sampleProjects(): Project[] {
  return [
    {
      id: 'frozen-light',
      title: 'Frozen Light',
      subtitle: '45s sci-fi narrative sequence',
      mode: 'narrative',
      fps: 24,
      target_duration: 45,
      script_text: frozenFrames
        .map((frame) =>
          frame.narration_text
            ? `${frame.character_speaker}: ${frame.narration_text}`
            : `[Visual: ${frame.visual_subject}]`,
        )
        .join('\n\n'),
      continuity: {
        locked: true,
        color_pipeline: 'ACEScg',
        aspect_ratio: '2.39:1 Anamorphic',
        camera_rig: 'ARRI Alexa Mini, 50mm Anamorphic, f/1.8',
        film_stock: '35mm Kodak Vision3 500T',
        recurring_motifs:
          'Amber light within blue ice; circular forms; a lone figure against impossible scale',
        global_negative_prompts: negative,
      },
      voice_profiles: {
        Narrator: {
          voice_seed_id: 'narrator_frozen_001',
          speaking_rate_wpm: 160,
          timbre_notes:
            'Warm low register; intimate, measured, quietly awestruck. Leave space between thoughts.',
        },
        'Character A': {
          voice_seed_id: 'mara_001',
          speaking_rate_wpm: 150,
          timbre_notes: 'Mara: clear, grounded alto; close-mic helmet sound, restrained curiosity.',
        },
      },
      frames: structuredClone(frozenFrames),
    },
    {
      id: 'flagship-commercial',
      title: 'Flagship Product',
      subtitle: '15s beat-split commercial · ARC One',
      mode: 'commercial',
      fps: 30,
      target_duration: 15,
      script_text: commercialFrames
        .map((frame) =>
          frame.narration_text
            ? `Narrator: ${frame.narration_text}`
            : `[Visual: ${frame.visual_subject}]`,
        )
        .join('\n\n'),
      continuity: {
        locked: true,
        color_pipeline: 'ACEScg',
        aspect_ratio: '16:9',
        camera_rig: 'RED V-RAPTOR, 85mm macro, f/2.8',
        film_stock: '35mm Kodak Vision3 500T',
        recurring_motifs: 'Amber light rings; brushed titanium; precise circular geometry',
        global_negative_prompts: `${negative} No visible brand logos, fingerprints, dust, or scratches.`,
      },
      voice_profiles: {
        Narrator: {
          voice_seed_id: 'arc_narrator_001',
          speaking_rate_wpm: 180,
          timbre_notes:
            'Confident, smooth baritone. Concise premium-ad delivery, natural rather than salesy.',
        },
        'Character A': {
          voice_seed_id: 'arc_character_001',
          speaking_rate_wpm: 170,
          timbre_notes: 'Bright, contemporary alto; warm and conversational.',
        },
      },
      frames: structuredClone(commercialFrames),
    },
  ];
}

export function newProject(title: string): Project {
  return {
    ...sampleProjects()[0],
    id: uid(),
    title: title.trim() || 'Untitled story',
    subtitle: 'A new story, waiting to happen',
    target_duration: 45,
    script_text: '',
    frames: [],
  };
}
