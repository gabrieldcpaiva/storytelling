import {
  Project,
  bgmGain,
  dbToGain,
  dimensions,
  round,
  runtime,
  speechDuration,
  timedFrames,
  visualPrompt,
} from './model';

const assetId = (index: number) => String(index + 1).padStart(3, '0');

export function timelineManifest(project: Project) {
  return {
    engine: 'Immersive Story Engine',
    version: '1.0.0',
    project_title: project.title,
    mode: project.mode,
    fps: project.fps,
    target_duration_sec: project.target_duration,
    total_duration_sec: runtime(project),
    script_text: project.script_text,
    continuity_bible: { project_title: project.title, ...project.continuity },
    voice_profiles: project.voice_profiles,
    bgm_asset: 'assets/bgm.wav',
    frame_reference_note:
      'Preview images are shared concept references, not generated final video assets. Provide the assets listed per frame before final production.',
    frames: timedFrames(project.frames).map((frame, index) => ({
      frame_id: frame.frame_id,
      title: frame.title,
      time_window: frame.time_window,
      start_time_sec: frame.start_time_sec,
      end_time_sec: frame.end_time_sec,
      duration_sec: frame.duration_sec,
      character_speaker: frame.character_speaker,
      voice_seed_id: project.voice_profiles[frame.character_speaker]?.voice_seed_id,
      narration_text: frame.narration_text,
      estimated_speech_duration_sec: speechDuration(frame, project.voice_profiles),
      sfx_cue: frame.sfx_cue,
      bgm_mood: frame.bgm_mood,
      bgm_ducking: {
        active: Boolean(frame.narration_text.trim()),
        gain_db: bgmGain(frame),
        linear_gain: dbToGain(bgmGain(frame)),
        envelope: 'constant over the dialogue beat; unity during silent visual beats',
      },
      visual_prompt: visualPrompt(frame, project.continuity),
      negative_prompt: project.continuity.global_negative_prompts,
      camera_override: project.continuity.locked ? null : frame.camera_override || null,
      transition_in: frame.transition_in,
      transition_out: frame.transition_out,
      assets: {
        video: `assets/frame_${assetId(index)}.mp4`,
        still_fallback: `assets/frame_${assetId(index)}.png`,
        dialogue: frame.narration_text.trim() ? `assets/dialogue_${assetId(index)}.wav` : null,
        sfx: frame.sfx_cue.trim() ? `assets/sfx_${assetId(index)}.wav` : null,
      },
    })),
  };
}

export function remotionProps(project: Project) {
  const { width, height } = dimensions(project.continuity.aspect_ratio);
  return {
    composition: {
      id: 'ImmersiveStoryComposition',
      width,
      height,
      fps: project.fps,
      durationInFrames: Math.max(1, Math.round(runtime(project) * project.fps)),
    },
    props: {
      title: project.title,
      engineVersion: '1.0.0',
      mode: project.mode,
      continuityBible: { project_title: project.title, ...project.continuity },
      voiceProfiles: project.voice_profiles,
      audio: {
        bgmSrc: 'assets/bgm.wav',
        duckingDb: -12,
        volumeSegments: timedFrames(project.frames).map((frame) => ({
          from: Math.round(frame.start_time_sec * project.fps),
          toExclusive: Math.round(frame.end_time_sec * project.fps),
          volume: dbToGain(bgmGain(frame)),
        })),
      },
      sequences: timedFrames(project.frames).map((frame, index) => ({
        id: `frame-${assetId(index)}`,
        frameId: frame.frame_id,
        from: Math.round(frame.start_time_sec * project.fps),
        durationInFrames:
          Math.round(frame.end_time_sec * project.fps) -
          Math.round(frame.start_time_sec * project.fps),
        videoSrc: `assets/frame_${assetId(index)}.mp4`,
        stillSrc: `assets/frame_${assetId(index)}.png`,
        dialogueSrc: frame.narration_text.trim() ? `assets/dialogue_${assetId(index)}.wav` : null,
        sfxSrc: frame.sfx_cue.trim() ? `assets/sfx_${assetId(index)}.wav` : null,
        title: frame.title,
        subtitle: frame.narration_text,
        speaker: frame.character_speaker,
        voiceSeedId: project.voice_profiles[frame.character_speaker]?.voice_seed_id,
        visualPrompt: visualPrompt(frame, project.continuity),
        negativePrompt: project.continuity.global_negative_prompts,
        sfxCue: frame.sfx_cue,
        bgmMood: frame.bgm_mood,
        transitionIn: frame.transition_in,
        transitionOut: frame.transition_out,
      })),
    },
    integration: {
      component: 'ImmersiveStoryComposition (provide your Remotion React component)',
      assets:
        'Copy production media into Remotion public/assets and resolve these relative paths with staticFile().',
      timing:
        'Use Sequence from/durationInFrames. All boundaries are quantized cumulatively to prevent frame drift.',
      bgm: 'Audio volume callback: return the volume of the segment where from <= frame && frame < toExclusive, otherwise 1.',
      transitions:
        'Keep absolute Sequence timing. Center visual transitions on the boundary without shortening the composition. Match-cuts require visually aligned source assets.',
    },
  };
}

/** Compile a self-contained pipeline. Visual transitions overlap padded handles;
 * dialogue and SFX concatenate independently, preserving absolute beat timing. */
export function ffmpegScript(project: Project): string {
  const frames = timedFrames(project.frames);
  if (!frames.length)
    return '#!/usr/bin/env bash\n# Generate at least one beat before exporting.\nexit 1\n';
  const { width, height } = dimensions(project.continuity.aspect_ratio);
  const duration = runtime(project);
  const boundaries = frames.slice(1).map((frame, index) => {
    const transition =
      frame.transition_in !== 'cut' ? frame.transition_in : frames[index].transition_out;
    return {
      type: transition,
      duration: ['dissolve', 'whip-pan'].includes(transition)
        ? round(Math.min(0.25, frames[index].duration_sec / 2, frame.duration_sec / 2))
        : 0,
    };
  });
  const videoDurations = frames.map((frame, i) =>
    round(
      frame.duration_sec +
        (boundaries[i - 1]?.duration || 0) / 2 +
        (boundaries[i]?.duration || 0) / 2,
    ),
  );
  const graph: string[] = frames.map(
    (_, index) => `[${index}:v]setpts=PTS-STARTPTS,fps=${project.fps},settb=AVTB[v${index}];`,
  );
  let previous = 'v0';
  boundaries.forEach((boundary, index) => {
    const output = `join${index + 1}`;
    if (boundary.duration > 0) {
      graph.push(
        `[${previous}][v${index + 1}]xfade=transition=${boundary.type === 'whip-pan' ? 'smoothleft' : 'fade'}:duration=${boundary.duration}:offset=${round(frames[index].end_time_sec - boundary.duration / 2)}[${output}raw];`,
      );
    } else graph.push(`[${previous}][v${index + 1}]concat=n=2:v=1:a=0[${output}raw];`);
    // concat marks its output as variable frame rate. Reassert CFR and AVTB
    // before the next xfade; otherwise mixed cut/dissolve chains cannot render.
    graph.push(`[${output}raw]fps=${project.fps},settb=AVTB[${output}];`);
    previous = output;
  });
  const activity =
    frames
      .filter((f) => f.narration_text.trim())
      .map((f) => `(gte(t,${f.start_time_sec})*lt(t,${f.end_time_sec}))`)
      .join('+') || '0';
  graph.push(`[${previous}]trim=duration=${duration},setpts=PTS-STARTPTS,format=yuv420p[vout];`);
  graph.push(
    `[${frames.length + 1}:a]aresample=48000,asetpts=PTS-STARTPTS,volume='if(gt(${activity},0),${dbToGain(-12)},1)':eval=frame,apad,atrim=duration=${duration}[ducked];`,
  );
  graph.push(
    `[${frames.length}:a][ducked]amix=inputs=2:duration=first:normalize=0,alimiter=limit=0.95:level=false:latency=true[aout]`,
  );
  const cleanTitle = project.title.replace(/[\r\n]/g, ' ');
  return `#!/usr/bin/env bash
# Immersive Story Engine v1.0 — ${cleanTitle}
# Production assembly: ${frames.length} beats / ${duration}s / ${project.fps} fps.
# Requires Bash 4+ and FFmpeg 5+ with libx264. No Python or other tools required.
# Usage: bash render_pipeline.sh [assets-directory] [output.mp4]
# Optional small preview: WIDTH=640 HEIGHT=${Math.round(((height / width) * 640) / 2) * 2} bash render_pipeline.sh
#
# ASSET CONTRACT
# frame_001.mp4 (or .png / .jpg), dialogue_001.wav, sfx_001.wav, bgm.wav.
# Sequential 3-digit names; one video/still, dialogue and SFX per beat.
# Supply final generated media and rendered voices, not the concept preview images.
# Missing visuals become charcoal placeholders; missing audio becomes silence.
# Missing assets are reported, so this script can also render a timing proof.
# Dialogue is padded/trimmed to its beat. Resolve any speech-fit warnings first.
#
# TRANSITIONS & TIMING
# Dissolve = centered 0.25s crossfade; whip-pan = centered smoothleft.
# Transition duration is reduced for very short beats. Handles preserve total runtime.
# Match-cut = hard cut; it requires matching composition/motion in source media.
# An incoming non-cut takes precedence over the previous outgoing transition.
#
# AUDIO AUTOMATION
# Music is multiplied by 10^(-12/20) = ${dbToGain(-12)} during dialogue beats,
# and by 1 (0 dB) during silent beats. The expression uses absolute timeline time.
# This deterministic volume envelope avoids level-dependent compressor drift.
# Dialogue + SFX are mixed separately; the final limiter prevents clipping.
# Assets must be display-referred Rec.709 video. ACEScg is prompt/pipeline metadata;
# apply your ACES display transform before supplying final video assets.

set -euo pipefail
command -v ffmpeg >/dev/null 2>&1 || { echo "FFmpeg is required." >&2; exit 1; }
ASSETS="\$\{1:-./assets\}"
OUTPUT="\$\{2:-./story-engine-render.mp4\}"
WIDTH="\$\{WIDTH:-${width}\}"
HEIGHT="\$\{HEIGHT:-${height}\}"
FPS=${project.fps}
TOTAL=${duration}
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
DURATIONS=(${frames.map((f) => f.duration_sec).join(' ')})
VIDEO_DURATIONS=(${videoDurations.join(' ')})
HAS_DIALOGUE=(${frames.map((f) => (f.narration_text.trim() ? 1 : 0)).join(' ')})
HAS_SFX=(${frames.map((f) => (f.sfx_cue.trim() ? 1 : 0)).join(' ')})
VIDEO_INPUTS=()

# 1. Normalize visual assets and independently prepare sample-accurate beat audio.
for i in "\$\{!DURATIONS[@]\}"; do
  printf -v id '%03d' "$((i + 1))"
  d="\$\{DURATIONS[$i]\}"
  vd="\$\{VIDEO_DURATIONS[$i]\}"
  if [[ -f "$ASSETS/frame_$id.mp4" ]]; then
    visual=(-stream_loop -1 -i "$ASSETS/frame_$id.mp4")
  elif [[ -f "$ASSETS/frame_$id.png" ]]; then
    visual=(-loop 1 -framerate "$FPS" -i "$ASSETS/frame_$id.png")
  elif [[ -f "$ASSETS/frame_$id.jpg" ]]; then
    visual=(-loop 1 -framerate "$FPS" -i "$ASSETS/frame_$id.jpg")
  else
    echo "NOTE: frame_$id has no media; using a charcoal placeholder." >&2
    visual=(-f lavfi -i "color=c=0x171a1b:s=\$\{WIDTH\}x\$\{HEIGHT\}:r=$FPS")
  fi
  ffmpeg -hide_banner -loglevel warning -y "\$\{visual[@]\}" \\
    -vf "scale=$WIDTH:$HEIGHT:force_original_aspect_ratio=decrease,pad=$WIDTH:$HEIGHT:(ow-iw)/2:(oh-ih)/2:color=black,setsar=1,fps=$FPS,format=yuv420p" \\
    -t "$vd" -an -c:v libx264 -threads 2 -preset fast -crf 18 "$WORK/video_$id.mp4"
  VIDEO_INPUTS+=(-i "$WORK/video_$id.mp4")

  if [[ "\$\{HAS_DIALOGUE[$i]\}" == 1 && -f "$ASSETS/dialogue_$id.wav" ]]; then
    voice=(-i "$ASSETS/dialogue_$id.wav")
  else
    if [[ "\$\{HAS_DIALOGUE[$i]\}" == 1 ]]; then echo "NOTE: missing dialogue_$id.wav; using silence." >&2; fi
    voice=(-f lavfi -i 'anullsrc=r=48000:cl=stereo')
  fi
  if [[ "\$\{HAS_SFX[$i]\}" == 1 && -f "$ASSETS/sfx_$id.wav" ]]; then
    sfx=(-i "$ASSETS/sfx_$id.wav")
  else
    if [[ "\$\{HAS_SFX[$i]\}" == 1 ]]; then echo "NOTE: missing sfx_$id.wav; using silence." >&2; fi
    sfx=(-f lavfi -i 'anullsrc=r=48000:cl=stereo')
  fi
  ffmpeg -hide_banner -loglevel warning -y "\$\{voice[@]\}" "\$\{sfx[@]\}" \\
    -filter_complex "[0:a]aresample=48000,aformat=channel_layouts=stereo,apad,atrim=duration=$d,asetpts=PTS-STARTPTS[voice];[1:a]aresample=48000,aformat=channel_layouts=stereo,apad,atrim=duration=$d,asetpts=PTS-STARTPTS,volume=0.7[sfx];[voice][sfx]amix=inputs=2:duration=longest:normalize=0[a]" \\
    -map '[a]' -t "$d" -c:a pcm_s16le "$WORK/audio_$id.wav"
  printf "file '%s'\\n" "$WORK/audio_$id.wav" >> "$WORK/audio-list.txt"
done

# 2. Concatenate dialogue/SFX on their original, non-overlapping beat boundaries.
ffmpeg -hide_banner -loglevel warning -y -f concat -safe 0 \\
  -i "$WORK/audio-list.txt" -c:a pcm_s16le "$WORK/dialogue-sfx.wav"

# 3. Build the exact visual transition graph and -12 dB BGM envelope.
cat > "$WORK/assembly.filters" <<'FILTERGRAPH'
${graph.join('\n')}
FILTERGRAPH

if [[ -f "$ASSETS/bgm.wav" ]]; then
  music=(-stream_loop -1 -i "$ASSETS/bgm.wav")
else
  echo "NOTE: no bgm.wav; rendering without music." >&2
  music=(-f lavfi -i 'anullsrc=r=48000:cl=stereo')
fi

# 4. Assemble, mix and encode. Aspect padding and transitions do not alter timing.
ffmpeg -hide_banner -loglevel warning -y "\$\{VIDEO_INPUTS[@]\}" \\
  -i "$WORK/dialogue-sfx.wav" "\$\{music[@]\}" \\
  -filter_complex_threads 1 -filter_complex_script "$WORK/assembly.filters" \\
  -map '[vout]' -map '[aout]' -t "$TOTAL" -r "$FPS" \\
  -c:v libx264 -threads 2 -preset medium -crf 18 -pix_fmt yuv420p \\
  -c:a aac -b:a 192k -ar 48000 -movflags +faststart "$OUTPUT"
printf 'Rendered: %s (%ss)\\n' "$OUTPUT" "$TOTAL"
`;
}

export const exportFiles = (project: Project) => ({
  'timeline_manifest.json': JSON.stringify(timelineManifest(project), null, 2),
  'render_pipeline.sh': ffmpegScript(project),
  'remotion_props.json': JSON.stringify(remotionProps(project), null, 2),
});

export function downloadFile(
  content: string | Uint8Array,
  filename: string,
  type = 'application/json',
) {
  const blob =
    typeof content === 'string'
      ? new Blob([content], { type })
      : new Blob([new Uint8Array(content).buffer], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
