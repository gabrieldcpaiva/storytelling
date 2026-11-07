import {
  Frame,
  Project,
  blankFrame,
  round,
  speechDuration,
  timedFrames,
  uid,
  wordCount,
} from './model';

interface ScriptSlice {
  speaker: string;
  text: string;
  subject: string;
}

/** Split long passages into balanced 15–20 word beats without dropping text. */
export function chunkWords(text: string, limit = 20): string[] {
  const words = text.trim().split(/\s+/u).filter(Boolean);
  if (!words.length) return [];
  const count = Math.ceil(words.length / limit);
  const size = Math.ceil(words.length / count);
  const chunks: string[] = [];
  for (let i = 0; i < words.length; i += size) chunks.push(words.slice(i, i + size).join(' '));
  return chunks;
}

export function parseScript(project: Project): ScriptSlice[] {
  const names = Object.keys(project.voice_profiles);
  const fallback = names[0] || 'Narrator';
  const slices: ScriptSlice[] = [];
  for (const line of project.script_text
    .split(/\n+/u)
    .map((l) => l.trim())
    .filter(Boolean)) {
    const visual = line.match(/^\[(?:visual|silent)\s*:\s*([\s\S]+)\]$/iu);
    if (visual) {
      slices.push({ speaker: fallback, text: '', subject: visual[1] });
      continue;
    }
    const colon = line.indexOf(':');
    const label = colon > 0 ? line.slice(0, colon).trim() : '';
    const speaker = names.includes(label) ? label : fallback;
    const text = names.includes(label) ? line.slice(colon + 1).trim() : line;
    const passages =
      project.mode === 'commercial'
        ? (text.match(/[^.!?]+[.!?]*(?:\s|$)/gu) || [text]).map((s) => s.trim()).filter(Boolean)
        : [text];
    for (const passage of passages) {
      for (const chunk of chunkWords(passage, project.mode === 'commercial' ? 8 : 20)) {
        slices.push({ speaker, text: chunk, subject: chunk });
      }
    }
  }
  return slices;
}

/** Allocate integer milliseconds: contiguous, positive durations, exact total. */
export function allocateDurations(weights: number[], total: number, minimum = 0.1): number[] {
  if (!weights.length) return [];
  const totalMs = Math.round(total * 1000);
  const minimumMs = Math.ceil(minimum * 1000);
  if (totalMs < minimumMs * weights.length)
    throw new Error(
      `This script has too many beats for ${total}s. Increase the duration or shorten the script.`,
    );
  const available = totalMs - minimumMs * weights.length;
  const weightTotal = weights.reduce((a, b) => a + Math.max(0.001, b), 0);
  const exact = weights.map((w) => (available * Math.max(0.001, w)) / weightTotal);
  const allocation = exact.map((n) => Math.floor(n) + minimumMs);
  let remainder = totalMs - allocation.reduce((a, b) => a + b, 0);
  const order = exact
    .map((n, i) => ({ i, fraction: n - Math.floor(n) }))
    .sort((a, b) => b.fraction - a.fraction);
  for (const { i } of order) {
    if (remainder-- <= 0) break;
    allocation[i]++;
  }
  return allocation.map((n) => n / 1000);
}

export function decomposeScript(project: Project): Frame[] {
  if (!project.script_text.trim())
    throw new Error('Add a script or a concept before generating beats.');
  const slices = parseScript(project);
  if (!slices.length)
    throw new Error('No spoken or visual beats were found. Add some text after the speaker name.');
  if (slices.length > 300)
    throw new Error('Keep your project to 300 beats or fewer. Try a shorter script.');
  const base = blankFrame(project);
  const weights = slices.map((slice) =>
    slice.text
      ? (wordCount(slice.text) /
          (project.voice_profiles[slice.speaker]?.speaking_rate_wpm || 150)) *
        60
      : 2,
  );
  let durations: number[];
  if (project.mode === 'commercial' && slices.length >= 3) {
    durations = [0.7, 1.3, ...allocateDurations(weights.slice(2), project.target_duration - 2)];
  } else {
    durations = allocateDurations(weights, project.target_duration);
  }
  return slices.map((slice, index) => ({
    ...base,
    id: uid(),
    title: slice.subject
      .replace(/[.!?]$/u, '')
      .split(/\s+/u)
      .slice(0, 5)
      .join(' '),
    duration_sec: durations[index],
    character_speaker: slice.speaker,
    narration_text: slice.text,
    visual_subject: slice.text
      ? `Cinematic interpretation of the scene: ${slice.subject}`
      : slice.subject,
    image:
      project.mode === 'commercial'
        ? '/images/arc-headphones.webp'
        : index % 3 === 2
          ? '/images/frozen-signal.webp'
          : '/images/frozen-expanse.webp',
    image_position: index % 2 ? '35% 50%' : '50% 50%',
    sfx_cue:
      project.mode === 'commercial'
        ? 'Restrained tactile accent; clean studio ambience'
        : 'Soft atmospheric ambience; scene-matched environmental detail',
  }));
}

export function adjustTiming(
  frames: Frame[],
  index: number,
  field: 'start' | 'end' | 'duration',
  value: number,
): Frame[] {
  if (!Number.isFinite(value) || !frames[index]) return frames;
  const timed = timedFrames(frames);
  const next = frames.map((f) => ({ ...f }));
  if (field === 'start') {
    if (!index) return frames;
    const min = timed[index - 1].start_time_sec + 0.1;
    const max = timed[index].end_time_sec - 0.1;
    const boundary = Math.max(min, Math.min(max, value));
    next[index - 1].duration_sec = round(boundary - timed[index - 1].start_time_sec);
    next[index].duration_sec = round(timed[index].end_time_sec - boundary);
  } else {
    const other = frames.reduce((sum, f, i) => sum + (i === index ? 0 : f.duration_sec), 0);
    const desired = field === 'end' ? value - timed[index].start_time_sec : value;
    next[index].duration_sec = round(Math.max(0.1, Math.min(180 - other, desired)));
  }
  return next;
}

export function speechWarnings(
  project: Project,
): { frame: number; estimated: number; available: number }[] {
  return project.frames.flatMap((frame, index) => {
    const estimated = speechDuration(frame, project.voice_profiles);
    return estimated > frame.duration_sec + 0.05
      ? [{ frame: index + 1, estimated, available: frame.duration_sec }]
      : [];
  });
}
