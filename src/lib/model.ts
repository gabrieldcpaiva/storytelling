export type Mode = 'narrative' | 'commercial';
export type Transition = 'cut' | 'dissolve' | 'whip-pan' | 'match-cut';
export type View = 'script' | 'timeline' | 'continuity' | 'voices' | 'exports';
export type AspectRatio = '2.39:1 Anamorphic' | '16:9' | '9:16';

export interface VoiceProfile {
  voice_seed_id: string;
  speaking_rate_wpm: number;
  timbre_notes: string;
}
export type VoiceProfiles = Record<string, VoiceProfile>;

export interface ContinuityBible {
  locked: boolean;
  color_pipeline: string;
  aspect_ratio: AspectRatio;
  camera_rig: string;
  film_stock: string;
  recurring_motifs: string;
  global_negative_prompts: string;
}

export interface Frame {
  id: string;
  title: string;
  duration_sec: number;
  character_speaker: string;
  narration_text: string;
  sfx_cue: string;
  bgm_mood: string;
  visual_subject: string;
  lighting_atmosphere: string;
  camera_override: string;
  visual_prompt_override: string;
  transition_in: Transition;
  transition_out: Transition;
  image: string;
  image_position: string;
}

export interface TimedFrame extends Frame {
  frame_id: number;
  start_time_sec: number;
  end_time_sec: number;
  time_window: string;
}

export interface Project {
  id: string;
  title: string;
  subtitle: string;
  mode: Mode;
  fps: number;
  target_duration: number;
  script_text: string;
  continuity: ContinuityBible;
  voice_profiles: VoiceProfiles;
  frames: Frame[];
}

export const round = (value: number, decimals = 3) => Number(value.toFixed(decimals));
export const wordCount = (text: string) => text.trim().split(/\s+/u).filter(Boolean).length;
export const runtime = (project: Project) =>
  round(project.frames.reduce((sum, frame) => sum + frame.duration_sec, 0));
export const uid = () =>
  typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `beat-${Date.now()}-${Math.random().toString(36).slice(2)}`;
export const formatSeconds = (seconds: number) => `${Number(seconds.toFixed(2))}s`;
export const timecode = (seconds: number, fps = 24) => {
  const total = Math.max(0, Math.floor(seconds * fps + 0.00001));
  return `${String(Math.floor(total / fps / 60)).padStart(2, '0')}:${String(Math.floor(total / fps) % 60).padStart(2, '0')}:${String(total % fps).padStart(2, '0')}`;
};
export const clock = (seconds: number) =>
  `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;

export function timedFrames(frames: Frame[]): TimedFrame[] {
  let cursor = 0;
  return frames.map((frame, index) => {
    const start = round(cursor);
    cursor = round(cursor + frame.duration_sec);
    return {
      ...frame,
      frame_id: index + 1,
      start_time_sec: start,
      end_time_sec: cursor,
      time_window: `${start.toFixed(2)}s - ${cursor.toFixed(2)}s`,
    };
  });
}

export function visualPrompt(frame: Frame, bible: ContinuityBible): string {
  if (!bible.locked && frame.visual_prompt_override.trim())
    return frame.visual_prompt_override.trim();
  const camera =
    !bible.locked && frame.camera_override.trim() ? frame.camera_override : bible.camera_rig;
  return [
    frame.visual_subject,
    camera,
    frame.lighting_atmosphere,
    `${bible.film_stock}; ${bible.color_pipeline} color pipeline; ${bible.aspect_ratio}`,
    bible.recurring_motifs ? `Recurring motifs: ${bible.recurring_motifs}` : '',
  ]
    .filter(Boolean)
    .join('. ');
}

export const speechDuration = (frame: Frame, profiles: VoiceProfiles) =>
  round(
    (wordCount(frame.narration_text) /
      (profiles[frame.character_speaker]?.speaking_rate_wpm || 150)) *
      60,
    2,
  );
export const bgmGain = (frame: Frame) => (frame.narration_text.trim() ? -12 : 0);
export const dbToGain = (db: number) => round(Math.pow(10, db / 20), 9);
export const dimensions = (ratio: AspectRatio) =>
  ratio === '9:16'
    ? { width: 1080, height: 1920 }
    : ratio === '16:9'
      ? { width: 1920, height: 1080 }
      : { width: 1920, height: 804 };

export function blankFrame(project: Project): Frame {
  return {
    id: uid(),
    title: 'A new moment',
    duration_sec: 2,
    character_speaker: Object.keys(project.voice_profiles)[0] || 'Narrator',
    narration_text: '',
    sfx_cue: '',
    bgm_mood: project.frames[0]?.bgm_mood || 'Subtle ambient atmosphere',
    visual_subject: 'A quiet, atmospheric establishing shot',
    lighting_atmosphere: 'Soft directional light; cinematic atmosphere',
    camera_override: '',
    visual_prompt_override: '',
    transition_in: 'cut',
    transition_out: 'cut',
    image:
      project.mode === 'commercial' ? '/images/arc-headphones.webp' : '/images/frozen-expanse.webp',
    image_position: '50% 50%',
  };
}

export function validateVoices(value: unknown): string | null {
  if (!value || typeof value !== 'object' || Array.isArray(value) || !Object.keys(value).length)
    return 'Add at least one named voice profile.';
  for (const [name, profile] of Object.entries(value)) {
    if (!name.trim()) return 'Every voice needs a name.';
    if (!profile || typeof profile !== 'object' || Array.isArray(profile))
      return `${name}: expected a voice profile object.`;
    const v = profile as Partial<VoiceProfile>;
    if (typeof v.voice_seed_id !== 'string' || !v.voice_seed_id.trim())
      return `${name}: voice_seed_id must be a non-empty string.`;
    if (
      typeof v.speaking_rate_wpm !== 'number' ||
      !Number.isFinite(v.speaking_rate_wpm) ||
      v.speaking_rate_wpm < 60 ||
      v.speaking_rate_wpm > 300
    )
      return `${name}: speaking_rate_wpm must be between 60 and 300.`;
    if (typeof v.timbre_notes !== 'string') return `${name}: timbre_notes must be a string.`;
  }
  return null;
}

export function validateProject(value: unknown): value is Project {
  if (!value || typeof value !== 'object') return false;
  const p = value as Project;
  if (
    typeof p.id !== 'string' ||
    typeof p.title !== 'string' ||
    typeof p.script_text !== 'string' ||
    typeof p.subtitle !== 'string' ||
    !['narrative', 'commercial'].includes(p.mode)
  )
    return false;
  if (
    !Number.isFinite(p.fps) ||
    p.fps < 1 ||
    p.fps > 120 ||
    !Number.isFinite(p.target_duration) ||
    p.target_duration < 0.1 ||
    p.target_duration > 180 ||
    validateVoices(p.voice_profiles)
  )
    return false;
  if (
    !p.continuity ||
    typeof p.continuity.locked !== 'boolean' ||
    !['2.39:1 Anamorphic', '16:9', '9:16'].includes(p.continuity.aspect_ratio)
  )
    return false;
  if (
    ![
      'color_pipeline',
      'camera_rig',
      'film_stock',
      'recurring_motifs',
      'global_negative_prompts',
    ].every((key) => typeof p.continuity[key as keyof ContinuityBible] === 'string')
  )
    return false;
  if (!Array.isArray(p.frames) || p.frames.length > 300) return false;
  const stringFields = [
    'id',
    'title',
    'character_speaker',
    'narration_text',
    'sfx_cue',
    'bgm_mood',
    'visual_subject',
    'lighting_atmosphere',
    'camera_override',
    'visual_prompt_override',
    'image',
    'image_position',
  ] as const;
  const transitions = ['cut', 'dissolve', 'whip-pan', 'match-cut'];
  return (
    p.frames.every(
      (f) =>
        f &&
        stringFields.every((key) => typeof f[key] === 'string') &&
        typeof f.duration_sec === 'number' &&
        Number.isFinite(f.duration_sec) &&
        f.duration_sec >= 0.1 &&
        f.duration_sec <= 180 &&
        Object.hasOwn(p.voice_profiles, f.character_speaker) &&
        transitions.includes(f.transition_in) &&
        transitions.includes(f.transition_out),
    ) &&
    runtime(p) <= 180.001 &&
    new Set(p.frames.map((f) => f.id)).size === p.frames.length
  );
}
