import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { exportFiles, ffmpegScript, remotionProps, timelineManifest } from '../lib/exporters';
import { decomposeScript } from '../lib/engine';
import { sampleProjects } from '../lib/samples';

describe('Beat-Split JSON compiler', () => {
  it('exports the complete continuity, voice and timing schema', () => {
    const project = sampleProjects()[0];
    const manifest = timelineManifest(project);
    expect(manifest.frames).toHaveLength(12);
    expect(manifest.total_duration_sec).toBe(45);
    expect(manifest.voice_profiles).toEqual(project.voice_profiles);
    expect(manifest.continuity_bible.project_title).toBe('Frozen Light');
    expect(manifest.frames[0]).toMatchObject({
      frame_id: 1,
      start_time_sec: 0,
      end_time_sec: 4.5,
      duration_sec: 4.5,
      character_speaker: 'Narrator',
      voice_seed_id: 'narrator_frozen_001',
    });
    expect(manifest.frames[0].bgm_ducking.gain_db).toBe(-12);
    expect(manifest.frames[2].bgm_ducking.gain_db).toBe(0);
    expect(manifest.frames[2].assets.dialogue).toBeNull();
    expect(manifest.frames[0].visual_prompt).toContain('ACEScg');
    expect(manifest.frames[0].negative_prompt).toBe(project.continuity.global_negative_prompts);
  });
  it('compiles current edits, never stale sample data', () => {
    const project = sampleProjects()[0];
    project.title = 'Wrath of Fire';
    project.frames[0].narration_text = 'The story has changed.';
    project.continuity.color_pipeline = 'Rec.709';
    const manifest = timelineManifest(project);
    expect(manifest.project_title).toBe('Wrath of Fire');
    expect(manifest.frames[0].narration_text).toBe('The story has changed.');
    expect(manifest.frames[0].visual_prompt).toContain('Rec.709');
  });
  it('returns all three valid, independent export files', () => {
    const files = exportFiles(sampleProjects()[0]);
    expect(Object.keys(files)).toEqual([
      'timeline_manifest.json',
      'render_pipeline.sh',
      'remotion_props.json',
    ]);
    expect(() => JSON.parse(files['timeline_manifest.json'])).not.toThrow();
    expect(() => JSON.parse(files['remotion_props.json'])).not.toThrow();
    expect(files['render_pipeline.sh']).toMatch(/^#!\/usr\/bin\/env bash/);
  });
});

describe('Remotion composition props', () => {
  it('uses cumulatively quantized frame boundaries without drift', () => {
    const project = sampleProjects()[0];
    project.frames = decomposeScript(project);
    const manifest = remotionProps(project);
    const sequences = manifest.props.sequences;
    expect(manifest.composition).toMatchObject({
      fps: 24,
      durationInFrames: 1080,
      width: 1920,
      height: 804,
    });
    expect(sequences.reduce((n, seq) => n + seq.durationInFrames, 0)).toBe(1080);
    sequences.forEach((seq, i) => {
      if (i) expect(seq.from).toBe(sequences[i - 1].from + sequences[i - 1].durationInFrames);
    });
    expect(sequences[0].voiceSeedId).toBe('narrator_frozen_001');
  });
  it('includes frame-based ducking and portrait dimensions', () => {
    const project = sampleProjects()[0];
    project.continuity.aspect_ratio = '9:16';
    const props = remotionProps(project);
    expect(props.composition).toMatchObject({ width: 1080, height: 1920 });
    expect(props.props.audio.volumeSegments[0]).toMatchObject({
      from: 0,
      toExclusive: 108,
      volume: 0.251188643,
    });
    expect(props.props.audio.volumeSegments[2].volume).toBe(1);
  });
});

describe('FFMPEG script compiler', () => {
  it.each(sampleProjects())('$title compiles a valid, safe Bash script', (project) => {
    const folder = mkdtempSync(join(tmpdir(), 'story-engine-test-'));
    try {
      const script = ffmpegScript(project);
      const file = join(folder, 'render_pipeline.sh');
      writeFileSync(file, script);
      expect(() => execFileSync('bash', ['-n', file])).not.toThrow();
      expect(script).toContain('ASSETS="${1:-./assets}"');
      expect(script).toContain('"${VIDEO_INPUTS[@]}"');
      expect(script).toContain("volume='if(gt(");
      expect(script).toContain('0.251188643,1)');
      expect(script).toContain('force_original_aspect_ratio=decrease');
      expect(script).toContain('pad=$WIDTH:$HEIGHT');
      expect(script).toContain('xfade=transition=fade');
      expect(script).toContain('amix=inputs=2');
      expect(script).toContain('normalize=0');
      expect(script).toContain('trap \'rm -rf "$WORK"\' EXIT');
      expect(readFileSync(file, 'utf8')).toBe(script);
    } finally {
      rmSync(folder, { recursive: true, force: true });
    }
  });
  it('keeps project titles out of executable shell commands', () => {
    const project = sampleProjects()[0];
    project.title = 'Demo\necho DANGEROUS; $(touch /tmp/nope)';
    const script = ffmpegScript(project);
    expect(script.split('\n')[1]).toBe(
      '# Immersive Story Engine v1.0 — Demo echo DANGEROUS; $(touch /tmp/nope)',
    );
    expect(script).not.toContain('\necho DANGEROUS');
  });
  it('provides silence and placeholder fallbacks rather than failing on missing assets', () => {
    const script = ffmpegScript(sampleProjects()[0]);
    expect(script).toContain('anullsrc=r=48000:cl=stereo');
    expect(script).toContain('using a charcoal placeholder');
    expect(script).toContain('Missing assets are reported');
  });
  it('does not create a bogus runnable composition with no frames', () => {
    const project = sampleProjects()[0];
    project.frames = [];
    expect(ffmpegScript(project)).toContain('Generate at least one beat');
  });
});
