import { useEffect, useState } from 'react';
import {
  Braces,
  Check,
  CircleHelp,
  Code2,
  LockKeyhole,
  Mic,
  Play,
  Plus,
  Save,
  SlidersHorizontal,
  Trash2,
  TriangleAlert,
} from 'lucide-react';
import { Project, VoiceProfiles, validateVoices } from '../lib/model';
import { Mutate, Notify } from '../lib/useStudio';
import { speak, speechAvailable } from '../lib/usePlayback';
import { Dialog, Field, IconButton, Waveform } from './ui';

function SeedInput({ value, onCommit }: { value: string; onCommit: (value: string) => void }) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  return (
    <input
      className="mono"
      aria-label="Voice seed ID"
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        if (draft.trim()) onCommit(draft.trim());
        else setDraft(value);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur();
      }}
    />
  );
}

export function VoicesStage({
  project,
  mutate,
  notify,
}: {
  project: Project;
  mutate: Mutate;
  notify: Notify;
}) {
  const [tab, setTab] = useState<'profiles' | 'json'>('profiles');
  const [json, setJson] = useState(JSON.stringify(project.voice_profiles, null, 2));
  const [error, setError] = useState('');
  const [add, setAdd] = useState(false);
  const [newName, setNewName] = useState('Character B');
  const [remove, setRemove] = useState<string | null>(null);
  useEffect(() => {
    setJson(JSON.stringify(project.voice_profiles, null, 2));
    setError('');
  }, [project.voice_profiles]);
  const names = Object.keys(project.voice_profiles);
  const apply = () => {
    try {
      const profiles = JSON.parse(json);
      const invalid = validateVoices(profiles);
      if (invalid) {
        setError(invalid);
        return;
      }
      mutate((p) => {
        p.voice_profiles = profiles as VoiceProfiles;
        p.frames.forEach((frame) => {
          if (!Object.hasOwn(profiles, frame.character_speaker))
            frame.character_speaker = Object.keys(profiles)[0];
        });
      });
      setError('');
      notify('Voice profile map applied. All speaker references are in sync.');
    } catch (e) {
      setError(`Invalid JSON: ${(e as Error).message}`);
    }
  };
  const openAdd = () => {
    let next = 'Character B';
    for (let i = 65; i <= 90; i++) {
      const candidate = `Character ${String.fromCharCode(i)}`;
      if (!names.includes(candidate)) {
        next = candidate;
        break;
      }
    }
    if (names.includes(next)) next = `Voice ${names.length + 1}`;
    setNewName(next);
    setAdd(true);
  };
  return (
    <div className="stage-page">
      <div className="stage-intro stage-intro-row">
        <div>
          <span className="stage-kicker">THE CHARACTER VOICE MAP</span>
          <h2>Different voices. Lasting identities.</h2>
          <p>Give every character a sound that stays with them from the first beat to the last.</p>
        </div>
        <button className="button secondary" onClick={openAdd}>
          <Plus size={15} /> Add voice
        </button>
      </div>
      <div className="voice-toolbar">
        <div className="segmented-control">
          <button
            className={tab === 'profiles' ? 'selected' : ''}
            onClick={() => setTab('profiles')}
          >
            <SlidersHorizontal size={14} />
            Voice profiles
          </button>
          <button className={tab === 'json' ? 'selected' : ''} onClick={() => setTab('json')}>
            <Braces size={14} />
            JSON editor
          </button>
        </div>
        <span className="mono muted">{names.length} PERSISTENT IDENTITIES</span>
      </div>
      {tab === 'profiles' ? (
        <div className="voice-cards">
          {Object.entries(project.voice_profiles).map(([name, profile], index) => (
            <section className="panel voice-card" key={name}>
              <div className="voice-card-heading">
                <span className={`voice-avatar avatar-${index % 3}`}>
                  <Mic size={20} />
                </span>
                <div>
                  <span className="micro-label">
                    VOICE PROFILE {String(index + 1).padStart(2, '0')}
                  </span>
                  <h3>{name}</h3>
                </div>
                <span className="voice-usage">
                  {project.frames.filter((f) => f.character_speaker === name).length} beats
                </span>
                <IconButton
                  label={`Delete ${name} voice`}
                  disabled={names.length <= 1}
                  onClick={() => setRemove(name)}
                >
                  <Trash2 size={14} />
                </IconButton>
              </div>
              <div className="voice-card-body">
                <Field label="Persistent voice seed" hint={<LockKeyhole size={12} />}>
                  <SeedInput
                    value={profile.voice_seed_id}
                    onCommit={(value) =>
                      mutate((p) => {
                        p.voice_profiles[name].voice_seed_id = value;
                      })
                    }
                  />
                </Field>
                <div className="speaking-rate">
                  <span className="field-label">Speaking rate</span>
                  <span className="rate-value">
                    {profile.speaking_rate_wpm}
                    <small>WPM</small>
                  </span>
                  <input
                    aria-label={`${name} speaking rate`}
                    type="range"
                    min="60"
                    max="300"
                    step="1"
                    value={profile.speaking_rate_wpm}
                    onChange={(e) =>
                      mutate((p) => {
                        p.voice_profiles[name].speaking_rate_wpm = Number(e.target.value);
                      })
                    }
                    style={
                      {
                        '--progress': `${((profile.speaking_rate_wpm - 60) / 240) * 100}%`,
                      } as React.CSSProperties
                    }
                  />
                  <div className="range-labels">
                    <span>Measured · 60</span>
                    <span>Rapid · 300</span>
                  </div>
                </div>
                <Field label="Timbre & performance notes">
                  <textarea
                    aria-label={`${name} timbre notes`}
                    rows={3}
                    value={profile.timbre_notes}
                    onChange={(e) =>
                      mutate((p) => {
                        p.voice_profiles[name].timbre_notes = e.target.value;
                      })
                    }
                  />
                </Field>
              </div>
              <div className="voice-card-footer">
                <Waveform seed={index + 2} bars={40} />
                <button
                  className="button tiny secondary"
                  onClick={() => {
                    if (!speechAvailable()) {
                      notify(
                        'Browser speech synthesis is not available. Voice metadata remains ready for export.',
                        'info',
                      );
                      return;
                    }
                    speak(
                      project.frames.find((f) => f.character_speaker === name && f.narration_text)
                        ?.narration_text ||
                        'Every great story starts with a voice. This one is mine.',
                      profile,
                    );
                    notify(`Previewing ${name} with a browser voice.`, 'info');
                  }}
                >
                  <Play size={11} fill="currentColor" />
                  Preview voice
                </button>
              </div>
            </section>
          ))}
        </div>
      ) : (
        <section className="panel voice-json-panel">
          <div className="panel-header">
            <div className="panel-title">
              <Code2 size={15} />
              <h3>voice_profiles.json</h3>
            </div>
            <span className="mini-badge">EDITABLE JSON</span>
          </div>
          <textarea
            className="json-editor"
            aria-label="Voice profiles JSON editor"
            spellCheck={false}
            value={json}
            onChange={(e) => {
              setJson(e.target.value);
              setError('');
            }}
          />
          <div className="json-actions">
            {error ? (
              <span className="validation-error" role="alert">
                <TriangleAlert size={14} />
                {error}
              </span>
            ) : (
              <span className="field-footnote">
                <Check size={13} />
                Requires seed ID, WPM (60–300), and timbre notes for every voice.
              </span>
            )}
            <button className="button primary" onClick={apply}>
              <Save size={14} />
              Apply voice map
            </button>
          </div>
        </section>
      )}
      <div className="voice-note">
        <CircleHelp size={17} />
        <div>
          <strong>A voice seed is a promise of continuity.</strong>
          <p>
            Seed IDs and performance notes are preserved in every export for your production TTS
            provider. The zero-dependency browser preview approximates pacing; it cannot reproduce a
            production seed or exact timbre.
          </p>
        </div>
      </div>
      {add && (
        <Dialog
          title="Give your character a voice."
          description="Create a persistent identity. You can fine-tune its sound and pacing after adding it."
          onClose={() => setAdd(false)}
        >
          <Field label="Character / speaker name">
            <input
              autoFocus
              aria-label="New voice name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') e.preventDefault();
              }}
            />
          </Field>
          {names.includes(newName.trim()) && (
            <p className="validation-error">A voice with this name already exists.</p>
          )}
          <div className="dialog-actions">
            <button className="button secondary" onClick={() => setAdd(false)}>
              Cancel
            </button>
            <button
              className="button primary"
              disabled={!newName.trim() || names.includes(newName.trim())}
              onClick={() => {
                const name = newName.trim();
                mutate((p) => {
                  p.voice_profiles = {
                    ...p.voice_profiles,
                    [name]: {
                      voice_seed_id: `${name.toLowerCase().replace(/[^a-z0-9]+/g, '_')}_001`,
                      speaking_rate_wpm: 150,
                      timbre_notes:
                        'Natural, grounded delivery; maintain a consistent tone throughout the story.',
                    },
                  };
                });
                setAdd(false);
                notify(`${name} added to the voice map.`);
              }}
            >
              <Plus size={14} />
              Add voice
            </button>
          </div>
        </Dialog>
      )}
      {remove && (
        <Dialog
          title={`Remove ${remove}?`}
          description={`Any beats assigned to this voice will be reassigned to ${names.find((name) => name !== remove)}. This change can be undone.`}
          onClose={() => setRemove(null)}
        >
          <div className="dialog-actions">
            <button className="button secondary" onClick={() => setRemove(null)}>
              Keep voice
            </button>
            <button
              className="button danger"
              onClick={() => {
                mutate((p) => {
                  delete p.voice_profiles[remove];
                  const fallback = Object.keys(p.voice_profiles)[0];
                  p.frames.forEach((f) => {
                    if (f.character_speaker === remove) f.character_speaker = fallback;
                  });
                });
                setRemove(null);
                notify('Voice removed; affected beats have been reassigned.');
              }}
            >
              Remove voice
            </button>
          </div>
        </Dialog>
      )}
    </div>
  );
}
