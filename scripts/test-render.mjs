import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createServer } from 'vite';

// Real encoder verification, separate from the zero-dependency unit tests.
// Requires FFmpeg 5+ and ffprobe on PATH, plus Bash.
try {
  execFileSync('ffmpeg', ['-version'], { stdio: 'ignore' });
  execFileSync('ffprobe', ['-version'], { stdio: 'ignore' });
} catch {
  console.error('Install FFmpeg 5+ and ffprobe, then run npm run test:render.');
  process.exit(1);
}

const work = mkdtempSync(join(tmpdir(), 'story-engine-render-test-'));
// This module loader must never touch the running app's dependency cache.
const server = await createServer({
  configFile: false,
  appType: 'custom',
  cacheDir: join(work, 'vite-cache'),
  server: { middlewareMode: true, hmr: false, watch: null },
  optimizeDeps: { noDiscovery: true, include: [] },
});
const ffmpeg = (args) =>
  execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args], { stdio: 'pipe' });
const probe = (file) =>
  JSON.parse(
    execFileSync(
      'ffprobe',
      [
        '-v',
        'error',
        '-show_entries',
        'format=duration:stream=codec_name,width,height,r_frame_rate,nb_frames',
        '-of',
        'json',
        file,
      ],
      { encoding: 'utf8' },
    ),
  );

try {
  const { ffmpegScript } = await server.ssrLoadModule('/src/lib/exporters.ts');
  const { sampleProjects } = await server.ssrLoadModule('/src/lib/samples.ts');
  const render = (project, name, assets = join(work, 'missing')) => {
    const script = join(work, `${name}.sh`),
      output = join(work, `${name}.mp4`);
    writeFileSync(script, ffmpegScript(project));
    execFileSync('bash', ['-n', script]);
    execFileSync('bash', [script, assets, output], {
      env: {
        ...process.env,
        WIDTH: '160',
        HEIGHT: project.continuity.aspect_ratio === '16:9' ? '90' : '68',
      },
      stdio: 'pipe',
      timeout: 120000,
    });
    return output;
  };

  for (const project of sampleProjects()) {
    const output = render(project, project.id);
    const info = probe(output),
      video = info.streams.find((stream) => stream.codec_name === 'h264');
    assert.equal(Number(info.format.duration), project.target_duration);
    assert.equal(Number(video.nb_frames), project.target_duration * project.fps);
    assert.equal(video.r_frame_rate, `${project.fps}/1`);
    console.log(
      `PASS: ${project.title} — ${info.format.duration}s, ${video.nb_frames} frames, mixed transitions + missing-asset fallbacks.`,
    );
  }

  const project = sampleProjects()[0];
  project.target_duration = 3;
  project.frames = project.frames.slice(0, 3).map((frame, i) => ({
    ...frame,
    duration_sec: 1,
    narration_text: i === 1 ? '' : 'Ducking test',
    sfx_cue: '',
    transition_in: 'cut',
    transition_out: 'cut',
  }));
  const assets = join(work, 'audio-assets');
  mkdirSync(assets);
  ffmpeg([
    '-f',
    'lavfi',
    '-i',
    'sine=frequency=440:sample_rate=48000:duration=5',
    '-ac',
    '2',
    join(assets, 'bgm.wav'),
  ]);
  // Verify both still-image and short-looped-video paths, not just placeholders.
  ffmpeg([
    '-f',
    'lavfi',
    '-i',
    'color=blue:s=100x100',
    '-frames:v',
    '1',
    join(assets, 'frame_001.png'),
  ]);
  ffmpeg([
    '-f',
    'lavfi',
    '-i',
    'color=red:s=120x80:r=24:d=0.2',
    '-c:v',
    'libx264',
    join(assets, 'frame_002.mp4'),
  ]);
  const output = render(project, 'ducking', assets);
  const pcmPath = join(work, 'audio.f32');
  ffmpeg(['-i', output, '-vn', '-ac', '1', '-ar', '48000', '-f', 'f32le', pcmPath]);
  const pcm = readFileSync(pcmPath);
  const rms = [0.2, 1.2, 2.2].map((start) => {
    let power = 0;
    const n = 24000,
      offset = Math.round(start * 48000);
    for (let i = 0; i < n; i++) power += pcm.readFloatLE((offset + i) * 4) ** 2;
    return Math.sqrt(power / n);
  });
  for (const i of [0, 2]) {
    const db = 20 * Math.log10(rms[i] / rms[1]);
    assert.ok(Math.abs(db + 12) < 0.2, `Expected -12dB, measured ${db}dB`);
    console.log(
      `PASS: dialogue beat ${i + 1} music gain ${db.toFixed(3)}dB relative to silent beat (AAC tolerance ±0.2dB).`,
    );
  }
  console.log('All production pipeline checks passed. Temporary media removed.');
} finally {
  await server.close();
  rmSync(work, { recursive: true, force: true });
}
