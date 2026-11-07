import { useEffect, useState } from 'react';
import {
  AudioLines,
  ChevronLeft,
  ChevronRight,
  Clock3,
  CopyPlus,
  Film,
  LockKeyhole,
  Mic,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  TriangleAlert,
} from 'lucide-react';
import {
  Frame,
  Project,
  TimedFrame,
  bgmGain,
  speechDuration,
  visualPrompt,
  wordCount,
} from '../lib/model';
import { Dialog, Field, IconButton, Waveform } from './ui';

type InspectorTab = 'scene' | 'optics' | 'audio';
function TimeInput({
  label,
  value,
  disabled,
  onCommit,
  accent,
}: {
  label: string;
  value: number;
  disabled?: boolean;
  onCommit: (value: number) => void;
  accent?: boolean;
}) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(value)), [value]);
  return (
    <label className={`time-input ${accent ? 'time-accent' : ''}`}>
      <span>{label}</span>
      <div>
        <input
          aria-label={`${label} in seconds`}
          type="number"
          step="0.1"
          min="0"
          max="180"
          value={draft}
          disabled={disabled}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => {
            const n = Number(draft);
            if (draft.trim() && Number.isFinite(n)) onCommit(n);
            setDraft(String(value));
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur();
          }}
        />
        <span>s</span>
      </div>
    </label>
  );
}

export function Inspector({
  project,
  frame,
  index,
  onChange,
  onTiming,
  onSelect,
  onDuplicate,
  onDelete,
  onPause,
  onContinuity,
}: {
  project: Project;
  frame: TimedFrame;
  index: number;
  onChange: <K extends keyof Frame>(key: K, value: Frame[K]) => void;
  onTiming: (field: 'start' | 'end' | 'duration', value: number) => void;
  onSelect: (index: number) => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onPause: () => void;
  onContinuity: () => void;
}) {
  const [tab, setTab] = useState<InspectorTab>('scene');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const speech = speechDuration(frame, project.voice_profiles);
  const overrun = speech > frame.duration_sec + 0.05;
  const tabs = [
    { key: 'scene' as const, icon: <Film size={12} />, label: 'Scene' },
    { key: 'optics' as const, icon: <FocusIcon />, label: 'Visual optics' },
    { key: 'audio' as const, icon: <AudioLines size={13} />, label: 'Audio' },
  ];
  return (
    <section
      className="panel inspector-panel"
      aria-label="Frame inspector"
      onFocusCapture={onPause}
    >
      <div className="panel-header">
        <div className="panel-title">
          <SlidersHorizontal size={15} />
          <h2>Frame inspector</h2>
        </div>
        <span className="micro-label">SHOT {String(index + 1).padStart(2, '0')}</span>
      </div>
      <div className="inspector-shot">
        <span className="frame-number">{String(index + 1).padStart(2, '0')}</span>
        <div className="inspector-shot-name">
          <span className="micro-label">SELECTED FRAME</span>
          <input
            aria-label="Frame title"
            value={frame.title}
            onChange={(e) => onChange('title', e.target.value)}
          />
        </div>
        <div className="shot-nav">
          <IconButton
            label="Inspect previous frame"
            disabled={index === 0}
            onClick={() => onSelect(index - 1)}
          >
            <ChevronLeft size={15} />
          </IconButton>
          <IconButton
            label="Inspect next frame"
            disabled={index >= project.frames.length - 1}
            onClick={() => onSelect(index + 1)}
          >
            <ChevronRight size={15} />
          </IconButton>
        </div>
      </div>
      <div className="inspector-tabs" role="tablist" aria-label="Frame properties">
        {tabs.map((item) => (
          <button
            key={item.key}
            id={`tab-${item.key}`}
            role="tab"
            aria-selected={tab === item.key}
            aria-controls="inspector-content"
            className={tab === item.key ? 'selected' : ''}
            onClick={() => setTab(item.key)}
          >
            {item.icon}
            {item.label}
          </button>
        ))}
      </div>
      <div
        className="inspector-content"
        id="inspector-content"
        role="tabpanel"
        aria-labelledby={`tab-${tab}`}
      >
        {tab === 'scene' && (
          <>
            <div className="timing-fields">
              <TimeInput
                label="Start"
                value={frame.start_time_sec}
                disabled={index === 0}
                onCommit={(v) => onTiming('start', v)}
              />
              <TimeInput
                label="End"
                value={frame.end_time_sec}
                onCommit={(v) => onTiming('end', v)}
              />
              <TimeInput
                label="Duration"
                value={frame.duration_sec}
                accent
                onCommit={(v) => onTiming('duration', v)}
              />
            </div>
            <Field label="Character / speaker">
              <div className="select-with-icon">
                <Mic size={13} />
                <select
                  aria-label="Character speaker"
                  value={frame.character_speaker}
                  onChange={(e) => onChange('character_speaker', e.target.value)}
                >
                  {Object.keys(project.voice_profiles).map((name) => (
                    <option key={name}>{name}</option>
                  ))}
                </select>
                <span className="voice-seed-label">VOICE LOCKED</span>
              </div>
            </Field>
            <Field label="Narration" hint={`${wordCount(frame.narration_text)} words`}>
              <textarea
                aria-label="Narration text"
                className="narration-textarea"
                placeholder="Leave empty for a silent visual beat…"
                value={frame.narration_text}
                onChange={(e) => onChange('narration_text', e.target.value)}
              />
            </Field>
            <div className={`speech-estimate ${overrun ? 'warning-text' : ''}`}>
              {overrun ? <TriangleAlert size={12} /> : <Clock3 size={12} />}
              <span>{speech.toFixed(1)}s estimated speech</span>
              <span className="estimate-separator">·</span>
              <span>{project.voice_profiles[frame.character_speaker]?.speaking_rate_wpm} wpm</span>
              {overrun && <span className="overrun-badge">Needs more time</span>}
            </div>
            <div className="transition-fields">
              {(['in', 'out'] as const).map((direction) => (
                <Field key={direction} label={`Transition ${direction}`}>
                  <select
                    aria-label={`Transition ${direction}`}
                    value={frame[`transition_${direction}`]}
                    onChange={(e) =>
                      onChange(`transition_${direction}`, e.target.value as Frame['transition_in'])
                    }
                  >
                    <option value="cut">Cut</option>
                    <option value="dissolve">Dissolve</option>
                    <option value="whip-pan">Whip-pan</option>
                    <option value="match-cut">Match-cut</option>
                  </select>
                </Field>
              ))}
            </div>
          </>
        )}
        {tab === 'optics' && (
          <>
            <div className="inline-notice">
              <LockKeyhole size={12} />
              <span>
                {project.continuity.locked
                  ? 'Global optics applied to this frame'
                  : 'Shot-level overrides are enabled'}
              </span>
              <button onClick={onContinuity}>
                {project.continuity.locked ? 'Manage' : 'Lock'}
              </button>
            </div>
            <Field label="Subject & action">
              <textarea
                aria-label="Visual subject and action"
                rows={2}
                value={frame.visual_subject}
                onChange={(e) => onChange('visual_subject', e.target.value)}
              />
            </Field>
            <Field
              label="Camera / lens"
              hint={project.continuity.locked ? <LockKeyhole size={10} /> : 'Per-shot override'}
            >
              <input
                aria-label="Per-shot camera rig"
                disabled={project.continuity.locked}
                placeholder={project.continuity.camera_rig}
                value={
                  project.continuity.locked ? project.continuity.camera_rig : frame.camera_override
                }
                onChange={(e) => onChange('camera_override', e.target.value)}
              />
            </Field>
            <Field label="Lighting & atmosphere">
              <input
                aria-label="Lighting and atmosphere"
                value={frame.lighting_atmosphere}
                onChange={(e) => onChange('lighting_atmosphere', e.target.value)}
              />
            </Field>
            <Field
              label="Visual prompt"
              hint={project.continuity.locked ? 'Auto-composed' : 'Optional override'}
            >
              <textarea
                className="prompt-textarea"
                aria-label="Visual prompt"
                readOnly={project.continuity.locked}
                value={
                  project.continuity.locked
                    ? visualPrompt(frame, project.continuity)
                    : frame.visual_prompt_override
                }
                placeholder={visualPrompt(
                  { ...frame, visual_prompt_override: '' },
                  project.continuity,
                )}
                onChange={(e) => onChange('visual_prompt_override', e.target.value)}
              />
            </Field>
            <p className="field-footnote">Subject → camera → atmosphere → film stock & color.</p>
          </>
        )}
        {tab === 'audio' && (
          <>
            <Field label="Sound effects" hint="SFX">
              <textarea
                aria-label="Sound effect cue"
                rows={2}
                placeholder="Rain on glass, a distant footstep…"
                value={frame.sfx_cue}
                onChange={(e) => onChange('sfx_cue', e.target.value)}
              />
            </Field>
            <Field label="Background music mood">
              <textarea
                aria-label="Background music mood"
                rows={2}
                placeholder="A subtle dark synth ambience…"
                value={frame.bgm_mood}
                onChange={(e) => onChange('bgm_mood', e.target.value)}
              />
            </Field>
            <div className={`ducking-card ${bgmGain(frame) === -12 ? 'ducking-active' : ''}`}>
              <div className="ducking-topline">
                <span>
                  <AudioLines size={15} />
                  Automatic ducking
                </span>
                <span className="mini-badge">AUTO</span>
              </div>
              <div className="ducking-value">
                <strong>
                  {bgmGain(frame) === -12 ? '−12' : '0'}
                  <span>dB</span>
                </strong>
                <Waveform seed={index + 1} bars={35} />
              </div>
              <div className="ducking-caption">
                <span className="tiny-dot" />
                {frame.narration_text.trim()
                  ? 'Dialogue active · music ducks beneath the voice'
                  : 'Silent visual beat · music returns to full level'}
              </div>
            </div>
            <p className="field-footnote">
              The envelope is compiled into both FFMPEG and Remotion exports. The preview meter
              visualizes gain; it does not play generated music.
            </p>
          </>
        )}
      </div>
      <div className="inspector-footer">
        <span>
          <span className="tiny-dot green" />
          Synced to timeline
        </span>
        <div>
          <IconButton label="Duplicate selected frame" onClick={onDuplicate}>
            <CopyPlus size={14} />
          </IconButton>
          <IconButton
            label="Delete selected frame"
            className="delete-button"
            onClick={() => setConfirmDelete(true)}
          >
            <Trash2 size={14} />
          </IconButton>
        </div>
      </div>
      {confirmDelete && (
        <Dialog
          title="Remove this moment?"
          description={`Frame ${String(index + 1).padStart(2, '0')}, “${frame.title}”, will be removed. The remaining beats will close the gap. You can undo this change.`}
          onClose={() => setConfirmDelete(false)}
        >
          <div className="dialog-actions">
            <button className="button secondary" onClick={() => setConfirmDelete(false)}>
              Keep frame
            </button>
            <button
              className="button danger"
              onClick={() => {
                setConfirmDelete(false);
                onDelete();
              }}
            >
              Remove frame
            </button>
          </div>
        </Dialog>
      )}
    </section>
  );
}
function FocusIcon() {
  return <Sparkles size={12} />;
}
