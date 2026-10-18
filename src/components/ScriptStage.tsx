import { useEffect, useState } from 'react';
import { Clapperboard, Clock3, FileText, Info, Sparkles, WandSparkles, Zap } from 'lucide-react';
import { Project, wordCount } from '../lib/model';
import { parseScript } from '../lib/engine';
import { Mutate } from '../lib/useStudio';

export function ScriptStage({
  project,
  mutate,
  onGenerate,
}: {
  project: Project;
  mutate: Mutate;
  onGenerate: () => void;
}) {
  const [durationDraft, setDurationDraft] = useState(String(project.target_duration));
  useEffect(() => setDurationDraft(String(project.target_duration)), [project.target_duration]);
  const commitDuration = () => {
    const n = Number(durationDraft);
    if (durationDraft.trim() && Number.isFinite(n)) {
      const value = Math.max(15, Math.min(180, n));
      mutate((p) => {
        p.target_duration = value;
      });
      setDurationDraft(String(value));
    } else setDurationDraft(String(project.target_duration));
  };
  const slices = parseScript(project);
  const words = slices.reduce((sum, slice) => sum + wordCount(slice.text), 0);
  const estimate = slices.reduce(
    (sum, slice) =>
      sum +
      (wordCount(slice.text) / (project.voice_profiles[slice.speaker]?.speaking_rate_wpm || 150)) *
        60,
    0,
  );
  return (
    <div className="stage-page">
      <div className="stage-intro">
        <span className="stage-kicker">STAGE 01 / THE FOUNDATION</span>
        <h2>It starts with a story.</h2>
        <p>A rough idea or a finished script. Give every moment a place on the timeline.</p>
      </div>
      <div className="script-layout">
        <section className="panel script-editor-panel">
          <div className="panel-header">
            <div className="panel-title">
              <FileText size={16} />
              <h3>Your script</h3>
            </div>
            <span className="mini-badge">PLAIN TEXT</span>
          </div>
          <textarea
            aria-label="Script text"
            className="script-editor"
            value={project.script_text}
            onChange={(e) =>
              mutate((p) => {
                p.script_text = e.target.value;
              })
            }
            placeholder={
              'Narrator: Every great story begins with a moment.\n\nCharacter A: What if this was ours?\n\n[Visual: A golden sunrise over an unfamiliar world]'
            }
            spellCheck
          />
          <div className="script-editor-footer">
            <span>
              <span className="tiny-dot green" />
              Draft autosaved locally
            </span>
            <span className="mono">
              {words} spoken words <span>·</span> {project.script_text.length.toLocaleString()}{' '}
              characters
            </span>
          </div>
          <div className="script-help">
            <Info size={15} />
            <p>
              Use <code>Narrator:</code> or a voice profile name to assign dialogue. Write{' '}
              <code>[Visual: your scene]</code> for a silent beat. Long passages split into roughly
              15–20 words.
            </p>
          </div>
        </section>
        <aside className="script-settings">
          <section className="panel setting-card">
            <div className="setting-label">
              <Clock3 size={15} />
              <h3>Target runtime</h3>
            </div>
            <div className="duration-display">
              <input
                aria-label="Target duration"
                type="number"
                min="15"
                max="180"
                step="1"
                value={durationDraft}
                onChange={(e) => setDurationDraft(e.target.value)}
                onBlur={commitDuration}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') e.currentTarget.blur();
                }}
              />
              <span>seconds</span>
            </div>
            <input
              aria-label="Target duration slider"
              type="range"
              min="15"
              max="180"
              step="1"
              value={project.target_duration}
              onChange={(e) =>
                mutate((p) => {
                  p.target_duration = Number(e.target.value);
                })
              }
              style={
                {
                  '--progress': `${((project.target_duration - 15) / 165) * 100}%`,
                } as React.CSSProperties
              }
            />
            <div className="range-labels">
              <span>15s</span>
              <span>180s</span>
            </div>
            <div className="duration-presets">
              {[15, 45, 90, 180].map((n) => (
                <button
                  key={n}
                  className={project.target_duration === n ? 'selected' : ''}
                  onClick={() =>
                    mutate((p) => {
                      p.target_duration = n;
                    })
                  }
                >
                  {n}s
                </button>
              ))}
            </div>
          </section>
          <section className="panel setting-card">
            <div className="setting-label">
              <Clapperboard size={15} />
              <h3>Story structure</h3>
            </div>
            <button
              className={`mode-option ${project.mode === 'narrative' ? 'selected' : ''}`}
              aria-pressed={project.mode === 'narrative'}
              onClick={() =>
                mutate((p) => {
                  p.mode = 'narrative';
                })
              }
            >
              <span className="mode-icon">
                <Clapperboard size={17} />
              </span>
              <span>
                <strong>Narrative micro-scenes</strong>
                <small>Room to breathe. 15–20 words per beat.</small>
              </span>
              <i className="radio-dot" />
            </button>
            <button
              className={`mode-option ${project.mode === 'commercial' ? 'selected' : ''}`}
              aria-pressed={project.mode === 'commercial'}
              onClick={() =>
                mutate((p) => {
                  p.mode = 'commercial';
                })
              }
            >
              <span className="mode-icon">
                <Zap size={17} />
              </span>
              <span>
                <strong>Commercial beat mode</strong>
                <small>Fast cuts. Opens at 0.7s and 2.0s.</small>
              </span>
              <i className="radio-dot" />
            </button>
          </section>
          <div className="pacing-summary">
            <span className="summary-icon">
              <AudioPacing />
            </span>
            <div>
              <strong>{estimate.toFixed(1)}s of estimated dialogue</strong>
              <span>
                {estimate > project.target_duration
                  ? 'Dialogue may outpace the target. Increase time or adjust voices.'
                  : `${Math.max(0, project.target_duration - estimate).toFixed(1)}s of space for atmosphere & visual storytelling.`}
              </span>
            </div>
          </div>
          <button
            className="button primary generate-button"
            disabled={!project.script_text.trim()}
            onClick={onGenerate}
          >
            <WandSparkles size={16} /> Generate beat timeline <span>↗</span>
          </button>
          <p className="generation-note">
            <Sparkles size={11} />
            Local, deterministic decomposition. No API key required.
          </p>
        </aside>
      </div>
    </div>
  );
}
function AudioPacing() {
  return (
    <>
      <i />
      <i />
      <i />
      <i />
      <i />
    </>
  );
}
