import { useState } from 'react';
import {
  Check,
  Copy,
  Focus,
  Maximize,
  Mic,
  Pause,
  Play,
  SkipBack,
  SkipForward,
  Subtitles,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { Project, bgmGain, timecode, visualPrompt } from '../lib/model';
import { Playback, speechAvailable } from '../lib/usePlayback';
import { Notify } from '../lib/useStudio';
import { copyText } from '../lib/clipboard';
import { Dialog, IconButton } from './ui';

export function Preview({
  project,
  playback,
  notify,
}: {
  project: Project;
  playback: Playback;
  notify: Notify;
}) {
  const [expanded, setExpanded] = useState(false);
  const [subtitles, setSubtitles] = useState(true);
  const [copied, setCopied] = useState(false);
  const { active, playing, time, duration, activeIndex, frames } = playback;
  if (!active) return null;
  const prompt = visualPrompt(active, project.continuity);
  const toggleVoice = () => {
    if (!speechAvailable()) {
      notify(
        'Speech preview is unavailable in this browser. Your production voice profiles are still preserved.',
        'info',
      );
      return;
    }
    playback.setTts(!playback.tts);
    if (!playback.tts)
      notify('Browser voice preview on. Seed IDs are preserved in production exports.', 'info');
  };
  const scene = (
    <div className={`preview-stage ${playing ? 'is-playing' : ''}`}>
      <div
        className={`cinema-frame ${project.continuity.aspect_ratio === '9:16' ? 'portrait-frame' : ''}`}
        style={
          {
            '--frame-ratio':
              project.continuity.aspect_ratio === '9:16'
                ? 9 / 16
                : project.continuity.aspect_ratio === '16:9'
                  ? 16 / 9
                  : 2.39,
          } as React.CSSProperties
        }
      >
        <img
          className="preview-image"
          key={active.id}
          src={active.image}
          alt={active.visual_subject}
          style={{ objectPosition: active.image_position }}
        />
        <div className="preview-vignette" />
        <div className="image-topline">
          <span className="shot-label">
            <span className="record-dot" /> FRAME {String(activeIndex + 1).padStart(2, '0')}{' '}
            <span className="muted">/ {String(frames.length).padStart(2, '0')}</span>
          </span>
          <span className="reference-label">CONCEPT FRAME</span>
        </div>
        <div className="cinema-corner corner-tl" />
        <div className="cinema-corner corner-tr" />
        <div className="cinema-corner corner-bl" />
        <div className="cinema-corner corner-br" />
        <div className="image-bottomline">
          <span className="image-frame-title">{active.title}</span>
          {subtitles && active.narration_text.trim() && (
            <p className="subtitle">{active.narration_text}</p>
          )}
          <span className="image-aspect">
            {project.continuity.aspect_ratio.replace(' Anamorphic', '')}
          </span>
        </div>
      </div>
    </div>
  );
  const transport = (
    <div className="transport">
      <IconButton
        label="Previous frame"
        onClick={() => playback.seek(frames[Math.max(0, activeIndex - 1)].start_time_sec)}
        disabled={activeIndex === 0 && time === 0}
      >
        <SkipBack size={15} fill="currentColor" />
      </IconButton>
      <button
        className="play-button"
        title={playing ? 'Pause timeline (Space)' : 'Play timeline preview (Space)'}
        aria-label={playing ? 'Pause timeline' : 'Play timeline preview'}
        onClick={playback.play}
      >
        {playing ? <Pause size={17} fill="currentColor" /> : <Play size={17} fill="currentColor" />}
      </button>
      <IconButton
        label="Next frame"
        onClick={() =>
          playback.seek(frames[Math.min(frames.length - 1, activeIndex + 1)].start_time_sec)
        }
        disabled={activeIndex >= frames.length - 1}
      >
        <SkipForward size={15} fill="currentColor" />
      </IconButton>
      <div className="transport-time">
        <span>{timecode(time, project.fps)}</span>
        <span className="time-divider">/</span>
        <span className="muted">{timecode(duration, project.fps)}</span>
      </div>
      <input
        className="transport-progress"
        type="range"
        min="0"
        max={duration}
        step="0.01"
        value={time}
        aria-label="Preview playhead"
        onChange={(e) => playback.seek(Number(e.target.value))}
        style={{ '--progress': `${(time / duration) * 100}%` } as React.CSSProperties}
      />
      <IconButton
        label={playback.tts ? 'Turn off browser voice preview' : 'Turn on browser voice preview'}
        className={playback.tts ? 'active-icon' : ''}
        onClick={toggleVoice}
      >
        {playback.tts ? <Volume2 size={16} /> : <VolumeX size={16} />}
      </IconButton>
      <IconButton
        label={subtitles ? 'Hide subtitles' : 'Show subtitles'}
        className={subtitles ? 'subtitles-on' : ''}
        aria-pressed={subtitles}
        onClick={() => setSubtitles(!subtitles)}
      >
        <Subtitles size={17} />
      </IconButton>
    </div>
  );
  return (
    <>
      <section className="panel preview-panel" aria-label="Animatic preview">
        <div className="panel-header">
          <div className="panel-title">
            <span className="tiny-dot peach" />
            <h2>Animatic preview</h2>
            <span className="mini-badge">LIVE</span>
          </div>
          <div className="panel-header-actions">
            <button
              className={`voice-preview-button ${playback.tts ? 'active' : ''}`}
              onClick={toggleVoice}
              aria-pressed={playback.tts}
            >
              <Mic size={12} /> Voice preview{' '}
              <span className={`small-status ${playback.tts ? 'enabled' : ''}`} />
            </button>
            <span className="vertical-separator" />
            <IconButton label="Expand animatic preview" onClick={() => setExpanded(true)}>
              <Maximize size={14} />
            </IconButton>
          </div>
        </div>
        {scene}
        {transport}
        <div className="prompt-strip">
          <span className="prompt-icon">
            <Focus size={17} />
          </span>
          <div>
            <span className="micro-label">OPTICS-FIRST PROMPT</span>
            <p title={prompt}>{prompt}</p>
          </div>
          <IconButton
            label="Copy visual prompt"
            onClick={async () => {
              try {
                await copyText(prompt);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              } catch (error) {
                notify((error as Error).message, 'error');
              }
            }}
          >
            {copied ? <Check size={14} /> : <Copy size={14} />}
          </IconButton>
        </div>
        <div className="preview-meter">
          <span className={`meter-dot ${playing ? 'meter-playing' : ''}`} />
          <span>
            {bgmGain(active) === -12 ? '−12 dB dialogue ducking' : '0 dB · full music level'}
          </span>
          <div
            className="mini-meter"
            role="meter"
            aria-label="Background music envelope"
            aria-valuemin={-12}
            aria-valuemax={0}
            aria-valuenow={bgmGain(active)}
            aria-valuetext={`${bgmGain(active)} decibels`}
          >
            {Array.from({ length: 16 }, (_, i) => (
              <i key={i} className={i < (bgmGain(active) === -12 ? 6 : 15) ? 'meter-lit' : ''} />
            ))}
          </div>
          <span className="preview-note">Still-frame animatic</span>
        </div>
      </section>
      {expanded && (
        <Dialog
          title="Your story, in motion."
          description="Concept-frame animatic. Browser voices are a timing reference, not production voice renders."
          onClose={() => setExpanded(false)}
          wide
        >
          <div className="expanded-preview">
            {scene}
            {transport}
          </div>
        </Dialog>
      )}
    </>
  );
}
