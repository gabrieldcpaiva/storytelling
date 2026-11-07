import { describe, expect, it } from 'vitest';
import {
  adjustTiming,
  allocateDurations,
  chunkWords,
  decomposeScript,
  parseScript,
  speechWarnings,
} from '../lib/engine';
import {
  bgmGain,
  dbToGain,
  dimensions,
  runtime,
  timedFrames,
  validateProject,
  validateVoices,
  visualPrompt,
  wordCount,
} from '../lib/model';
import { newProject, sampleProjects } from '../lib/samples';

describe('complete sample projects', () => {
  it.each(sampleProjects())('$title is valid, complete, and correctly timed', (project) => {
    expect(validateProject(project)).toBe(true);
    expect(runtime(project)).toBe(project.target_duration);
    expect(project.frames.length).toBeGreaterThan(3);
    expect(timedFrames(project.frames)[0].start_time_sec).toBe(0);
    expect(timedFrames(project.frames).at(-1)?.end_time_sec).toBe(project.target_duration);
    expect(speechWarnings(project)).toHaveLength(0);
    expect(project.frames.some((f) => !f.narration_text)).toBe(true);
    expect(project.frames.every((f) => f.visual_subject && f.image && f.sfx_cue)).toBe(true);
  });
  it('opens commercial beats at 0.0–0.7s and 0.7–2.0s', () => {
    const frames = timedFrames(sampleProjects()[1].frames);
    expect(frames[0].time_window).toBe('0.00s - 0.70s');
    expect(frames[1].time_window).toBe('0.70s - 2.00s');
  });
});

describe('script decomposition', () => {
  it('splits long passages into balanced 15–20 word beats without losing text', () => {
    const text = Array.from({ length: 55 }, (_, i) => `word${i}`).join(' ');
    const chunks = chunkWords(text);
    expect(chunks).toHaveLength(3);
    expect(chunks.join(' ')).toBe(text);
    expect(chunks.every((c) => wordCount(c) >= 15 && wordCount(c) <= 20)).toBe(true);
  });
  it('preserves a trailing short sentence and punctuation', () => {
    const chunks = chunkWords('Just a quiet moment.');
    expect(chunks).toEqual(['Just a quiet moment.']);
    expect(chunkWords('  ')).toEqual([]);
  });
  it('recognizes speakers and silent visual directions', () => {
    const project = sampleProjects()[0];
    project.script_text =
      'Character A: We are not alone.\n\n[Visual: The portal wakes]\n\nNarrator: Then the world changed.';
    expect(parseScript(project)).toEqual([
      { speaker: 'Character A', text: 'We are not alone.', subject: 'We are not alone.' },
      { speaker: 'Narrator', text: '', subject: 'The portal wakes' },
      { speaker: 'Narrator', text: 'Then the world changed.', subject: 'Then the world changed.' },
    ]);
  });
  it('handles unknown labels as script text rather than losing them', () => {
    const project = newProject('Test');
    project.script_text = 'Unexpected: words stay here.';
    expect(parseScript(project)[0].text).toBe('Unexpected: words stay here.');
  });
  it('allocates exact positive millisecond durations for a wide range of weights', () => {
    for (let n = 1; n <= 100; n++) {
      const weights = Array.from({ length: n }, (_, i) => 1 + Math.abs(Math.sin(i + n)) * 21);
      const result = allocateDurations(weights, 45);
      expect(Math.round(result.reduce((a, b) => a + b, 0) * 1000)).toBe(45000);
      expect(result.every((n) => n >= 0.1)).toBe(true);
    }
  });
  it('uses speaking rate as a duration weight', () => {
    const project = sampleProjects()[0];
    project.voice_profiles.Narrator.speaking_rate_wpm = 100;
    project.voice_profiles['Character A'].speaking_rate_wpm = 200;
    project.script_text = 'Narrator: This is the same line.\nCharacter A: This is the same line.';
    const frames = decomposeScript(project);
    expect(frames[0].duration_sec).toBeGreaterThan(frames[1].duration_sec);
    expect(runtime({ ...project, frames })).toBe(45);
  });
  it.each(['narrative', 'commercial'] as const)(
    'generates a continuous %s timeline at the exact target',
    (mode) => {
      const project = sampleProjects()[mode === 'narrative' ? 0 : 1];
      const frames = decomposeScript(project);
      const timed = timedFrames(frames);
      timed.forEach((frame, index) => {
        expect(frame.frame_id).toBe(index + 1);
        if (index > 0) expect(frame.start_time_sec).toBe(timed[index - 1].end_time_sec);
      });
      expect(timed.at(-1)?.end_time_sec).toBe(project.target_duration);
      expect(new Set(frames.map((f) => f.id)).size).toBe(frames.length);
      expect(validateProject({ ...project, frames })).toBe(true);
      if (mode === 'commercial')
        expect(frames.slice(0, 2).map((f) => f.duration_sec)).toEqual([0.7, 1.3]);
    },
  );
  it('rejects empty or impossible input with a useful error', () => {
    expect(() => decomposeScript(newProject('Test'))).toThrow('Add a script');
    expect(() => allocateDurations([1, 1, 1], 0.2)).toThrow('too many beats');
    const project = newProject('Test');
    project.script_text = 'Narrator:   ';
    expect(() => decomposeScript(project)).toThrow('No spoken or visual beats');
  });
  it('flags narration that cannot fit at the configured rate', () => {
    const project = sampleProjects()[0];
    project.frames[0].duration_sec = 0.2;
    expect(speechWarnings(project)[0]).toMatchObject({ frame: 1, estimated: 4.5, available: 0.2 });
  });
});

describe('timeline adjustment and continuity', () => {
  it('ripples duration and end adjustments without gaps', () => {
    const frames = sampleProjects()[0].frames;
    const next = adjustTiming(frames, 0, 'duration', 6);
    expect(timedFrames(next)[1].start_time_sec).toBe(6);
    expect(frames[0].duration_sec).toBe(4.5);
    expect(adjustTiming(frames, 1, 'end', 10)[1].duration_sec).toBe(5.5);
  });
  it('adjusts a start boundary without changing the total runtime', () => {
    const frames = sampleProjects()[0].frames;
    const next = adjustTiming(frames, 1, 'start', 5);
    expect(next[0].duration_sec).toBe(5);
    expect(next[1].duration_sec).toBe(4);
    expect(timedFrames(next).at(-1)?.end_time_sec).toBe(45);
    expect(adjustTiming(frames, 0, 'start', 5)).toEqual(frames);
  });
  it('bounds edits to positive durations and a 180-second total', () => {
    const project = sampleProjects()[0];
    expect(adjustTiming(project.frames, 0, 'duration', -3)[0].duration_sec).toBe(0.1);
    expect(runtime({ ...project, frames: adjustTiming(project.frames, 0, 'duration', 999) })).toBe(
      180,
    );
    expect(adjustTiming(project.frames, 0, 'duration', NaN)).toEqual(project.frames);
  });
  it('locks optics globally while retaining intentional overrides when unlocked', () => {
    const p = sampleProjects()[0];
    const frame = p.frames[0];
    frame.camera_override = '65mm custom camera';
    frame.visual_prompt_override = 'A fully custom prompt';
    expect(visualPrompt(frame, p.continuity)).toContain(p.continuity.camera_rig);
    expect(visualPrompt(frame, p.continuity)).not.toContain('custom camera');
    p.continuity.locked = false;
    expect(visualPrompt(frame, p.continuity)).toBe('A fully custom prompt');
    frame.visual_prompt_override = '';
    expect(visualPrompt(frame, p.continuity)).toContain('65mm custom camera');
  });
  it('ducks only non-empty dialogue to exactly -12 dB', () => {
    const frame = sampleProjects()[0].frames[0];
    expect(bgmGain(frame)).toBe(-12);
    expect(dbToGain(-12)).toBeCloseTo(0.251188643, 9);
    expect(bgmGain({ ...frame, narration_text: ' \n ' })).toBe(0);
    expect(dbToGain(0)).toBe(1);
  });
  it('provides even production dimensions for all aspect ratios', () => {
    expect(dimensions('16:9')).toEqual({ width: 1920, height: 1080 });
    expect(dimensions('9:16')).toEqual({ width: 1080, height: 1920 });
    expect(dimensions('2.39:1 Anamorphic')).toEqual({ width: 1920, height: 804 });
  });
});

describe('validation and local recovery', () => {
  it('validates voice maps and rejects missing or malformed fields', () => {
    expect(validateVoices(sampleProjects()[0].voice_profiles)).toBeNull();
    expect(validateVoices([])).toBeTruthy();
    expect(validateVoices({})).toBeTruthy();
    expect(
      validateVoices({
        Narrator: { voice_seed_id: 'seed', speaking_rate_wpm: 500, timbre_notes: '' },
      }),
    ).toContain('between 60 and 300');
    expect(
      validateVoices({ Narrator: { voice_seed_id: '', speaking_rate_wpm: 150, timbre_notes: '' } }),
    ).toContain('non-empty');
  });
  it('rejects corrupted saved projects before rendering', () => {
    const project = sampleProjects()[0];
    expect(validateProject(null)).toBe(false);
    expect(validateProject({ ...project, continuity: undefined })).toBe(false);
    expect(
      validateProject({ ...project, frames: [{ ...project.frames[0], duration_sec: -2 }] }),
    ).toBe(false);
    expect(
      validateProject({
        ...project,
        frames: [{ ...project.frames[0], character_speaker: 'Missing' }],
      }),
    ).toBe(false);
    expect(validateProject({ ...project, frames: [project.frames[0], project.frames[0]] })).toBe(
      false,
    );
    expect(validateProject(newProject('A fresh start'))).toBe(true);
  });
});
