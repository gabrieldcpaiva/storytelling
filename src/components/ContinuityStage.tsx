import {
  Check,
  CheckCheck,
  Film,
  Focus,
  LockKeyhole,
  Palette,
  ScanLine,
  ShieldCheck,
  Sparkles,
  UnlockKeyhole,
} from 'lucide-react';
import { AspectRatio, Project, visualPrompt } from '../lib/model';
import { Mutate } from '../lib/useStudio';
import { Field, Toggle } from './ui';

export function ContinuityStage({ project, mutate }: { project: Project; mutate: Mutate }) {
  const bible = project.continuity;
  return (
    <div className="stage-page">
      <div className="stage-intro">
        <span className="stage-kicker">THE GLOBAL CONTINUITY BIBLE</span>
        <h2>One world. Every frame.</h2>
        <p>Define the visual rules that keep your story unmistakably yours.</p>
      </div>
      <div className="continuity-layout">
        <section className="panel bible-form">
          <div className="panel-header">
            <div className="panel-title">
              <ShieldCheck size={16} />
              <h3>World & visual identity</h3>
            </div>
            <span className="mini-badge">GLOBAL SETTINGS</span>
          </div>
          <div className="bible-form-content">
            <div className={`global-lock-card ${bible.locked ? 'locked' : ''}`}>
              <span className="global-lock-icon">
                {bible.locked ? <LockKeyhole size={20} /> : <UnlockKeyhole size={20} />}
              </span>
              <div>
                <strong>{bible.locked ? 'Continuity lock is on' : 'Continuity lock is off'}</strong>
                <p>
                  {bible.locked
                    ? 'Camera, color, and film stock stay consistent in every shot.'
                    : 'Individual shots can override the default camera and visual prompt.'}
                </p>
              </div>
              <Toggle
                label="Global continuity lock"
                checked={bible.locked}
                onChange={() =>
                  mutate((p) => {
                    p.continuity.locked = !p.continuity.locked;
                  })
                }
              />
            </div>
            <div className="form-grid">
              <Field label="Project title">
                <input
                  aria-label="Project title"
                  value={project.title}
                  placeholder="Give your world a name"
                  onChange={(e) =>
                    mutate((p) => {
                      p.title = e.target.value;
                    })
                  }
                />
              </Field>
              <Field label="Color pipeline" hint={<Palette size={12} />}>
                <select
                  aria-label="Color pipeline"
                  value={bible.color_pipeline}
                  onChange={(e) =>
                    mutate((p) => {
                      p.continuity.color_pipeline = e.target.value;
                    })
                  }
                >
                  <option>ACEScg</option>
                  <option>Rec.709</option>
                  <option>DCI-P3</option>
                  <option>Rec.2020</option>
                </select>
              </Field>
            </div>
            <div className="field">
              <span className="field-label">
                Aspect ratio
                <ScanLine size={12} />
              </span>
              <div className="aspect-options" role="group" aria-label="Aspect ratio">
                {(['2.39:1 Anamorphic', '16:9', '9:16'] as AspectRatio[]).map((ratio) => (
                  <button
                    key={ratio}
                    className={bible.aspect_ratio === ratio ? 'selected' : ''}
                    onClick={(e) => {
                      e.preventDefault();
                      mutate((p) => {
                        p.continuity.aspect_ratio = ratio;
                      });
                    }}
                    aria-pressed={bible.aspect_ratio === ratio}
                  >
                    <span
                      className={`aspect-shape ${ratio === '9:16' ? 'shape-portrait' : ratio === '16:9' ? 'shape-wide' : ''}`}
                    />
                    <span>
                      {ratio.replace(' Anamorphic', '')}
                      <small>
                        {ratio === '2.39:1 Anamorphic'
                          ? 'Anamorphic'
                          : ratio === '16:9'
                            ? 'Widescreen'
                            : 'Vertical'}
                      </small>
                    </span>
                    {bible.aspect_ratio === ratio && <Check size={13} />}
                  </button>
                ))}
              </div>
            </div>
            <Field label="Default camera / lens rig" hint={<Focus size={12} />}>
              <input
                aria-label="Default camera lens rig"
                value={bible.camera_rig}
                onChange={(e) =>
                  mutate((p) => {
                    p.continuity.camera_rig = e.target.value;
                  })
                }
                placeholder="ARRI Alexa Mini, 50mm Anamorphic, f/1.8"
              />
            </Field>
            <Field label="Film stock / color grade" hint={<Film size={12} />}>
              <input
                aria-label="Film stock"
                value={bible.film_stock}
                onChange={(e) =>
                  mutate((p) => {
                    p.continuity.film_stock = e.target.value;
                  })
                }
              />
            </Field>
            <Field label="Recurring motifs" hint="Shared visual language">
              <textarea
                aria-label="Recurring motifs"
                rows={2}
                value={bible.recurring_motifs}
                onChange={(e) =>
                  mutate((p) => {
                    p.continuity.recurring_motifs = e.target.value;
                  })
                }
                placeholder="Circular forms, amber light, recurring textures…"
              />
            </Field>
            <Field label="Global negative prompts" hint="Keep out of every frame">
              <textarea
                aria-label="Global negative prompts"
                rows={3}
                value={bible.global_negative_prompts}
                onChange={(e) =>
                  mutate((p) => {
                    p.continuity.global_negative_prompts = e.target.value;
                  })
                }
              />
            </Field>
          </div>
          <div className="form-save-footer">
            <CheckCheck size={14} />
            <span>Saved automatically. Changes flow into every compiled prompt and export.</span>
          </div>
        </section>
        <aside className="continuity-aside">
          <div className="continuity-reference">
            <img
              src={project.frames[0]?.image || '/images/frozen-expanse.webp'}
              alt="Project concept reference"
            />
            <span className="reference-overlay">
              <span className="micro-label">THE VISUAL NORTH STAR</span>
              <strong>{project.title || 'Untitled story'}</strong>
              <span>
                {bible.aspect_ratio} · {bible.color_pipeline}
              </span>
            </span>
          </div>
          <section className="panel continuity-checks">
            <div className="setting-label">
              <Sparkles size={15} />
              <h3>Built into every frame</h3>
            </div>
            {[
              { label: 'A consistent color language', value: bible.color_pipeline },
              { label: 'The same cinematic DNA', value: bible.film_stock },
              {
                label: 'A unified perspective',
                value: bible.camera_rig.split(',').slice(0, 2).join(' ·'),
              },
              {
                label: 'An unmistakable world',
                value: `${project.frames.length} frames share your visual rules`,
              },
            ].map((item) => (
              <div className="continuity-check" key={item.label}>
                <Check size={13} />
                <span>
                  <strong>{item.label}</strong>
                  <small>{item.value}</small>
                </span>
              </div>
            ))}
          </section>
          {project.frames[0] && (
            <section className="panel prompt-preview-card">
              <span className="micro-label">LIVE PROMPT / FRAME 01</span>
              <p>{visualPrompt(project.frames[0], bible)}</p>
              <span className="prompt-structure">
                <i>Subject</i>
                <span>→</span>
                <i>Optics</i>
                <span>→</span>
                <i>Atmosphere</i>
                <span>→</span>
                <i>Grade</i>
              </span>
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}
