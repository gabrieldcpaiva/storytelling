import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowDownToLine,
  ArrowRight,
  ArrowUpRight,
  AudioLines,
  Braces,
  Check,
  CheckCheck,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  Clapperboard,
  CopyPlus,
  FileText,
  FolderClosed,
  HardDrive,
  Layers3,
  LockKeyhole,
  Menu,
  MoreHorizontal,
  Plus,
  Redo2,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  SquarePen,
  Undo2,
  X,
} from 'lucide-react';
import { Frame, Project, View, blankFrame, round, runtime, timedFrames, uid } from './lib/model';
import { useStudio, Notify } from './lib/useStudio';
import { usePlayback, speechAvailable } from './lib/usePlayback';
import { adjustTiming, decomposeScript, speechWarnings } from './lib/engine';
import { newProject, sampleProjects } from './lib/samples';
import { Dialog, EmptyState, IconButton } from './components/ui';
import { Preview } from './components/Preview';
import { Inspector } from './components/Inspector';
import { Timeline } from './components/Timeline';
import { ScriptStage } from './components/ScriptStage';
import { ContinuityStage } from './components/ContinuityStage';
import { VoicesStage } from './components/VoicesStage';
import { ExportStage } from './components/ExportStage';

const navigation: { view: View; label: string; icon: React.ReactNode; stage?: string }[] = [
  { view: 'script', label: 'Script & beats', icon: <FileText size={17} />, stage: '01' },
  { view: 'timeline', label: 'Timeline studio', icon: <Clapperboard size={17} />, stage: '02–03' },
  { view: 'continuity', label: 'Continuity bible', icon: <ShieldCheck size={17} /> },
  { view: 'voices', label: 'Voice profiles', icon: <AudioLines size={17} /> },
  { view: 'exports', label: 'Export compiler', icon: <Braces size={17} />, stage: '04' },
];

export default function App() {
  const studio = useStudio();
  const { project, projects, mutate, saveState } = studio;
  const playback = usePlayback(project);
  const [view, setView] = useState<View>('timeline');
  const [mobileNav, setMobileNav] = useState(false);
  const [projectMenu, setProjectMenu] = useState(false);
  const [moreMenu, setMoreMenu] = useState(false);
  const [help, setHelp] = useState(false);
  const [newDialog, setNewDialog] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [confirmGenerate, setConfirmGenerate] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [toast, setToast] = useState<{
    message: string;
    kind: 'success' | 'error' | 'info';
    id: number;
  } | null>(null);
  const switcherRef = useRef<HTMLDivElement>(null);
  const moreRef = useRef<HTMLDivElement>(null);
  const notify: Notify = useCallback(
    (message, kind = 'success') => setToast({ message, kind, id: Date.now() }),
    [],
  );
  const navigate = useCallback((next: View) => {
    playback.pause();
    if (speechAvailable()) window.speechSynthesis.cancel();
    setView(next);
    setMobileNav(false);
    setMoreMenu(false);
  }, []);
  useEffect(() => {
    document.title = `${project.title || 'Untitled story'} · Immersive Story Engine`;
  }, [project.title]);
  useEffect(() => {
    if (help || newDialog || confirmGenerate || confirmReset) {
      playback.pause();
      if (speechAvailable()) window.speechSynthesis.cancel();
    }
  }, [help, newDialog, confirmGenerate, confirmReset]);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(timer);
  }, [toast]);
  useEffect(() => {
    const close = (event: PointerEvent) => {
      if (!switcherRef.current?.contains(event.target as Node)) setProjectMenu(false);
      if (!moreRef.current?.contains(event.target as Node)) setMoreMenu(false);
    };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, []);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setProjectMenu(false);
        setMoreMenu(false);
        setMobileNav(false);
      }
      if (
        document.querySelector('[role="dialog"]') ||
        (event.target as HTMLElement)?.closest(
          'input, textarea, select, [contenteditable="true"], [role="slider"]',
        )
      )
        return;
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
        event.preventDefault();
        playback.pause();
        if (event.shiftKey) studio.redo();
        else studio.undo();
      }
      if (
        event.code === 'Space' &&
        view === 'timeline' &&
        !(event.target as HTMLElement)?.closest('button')
      ) {
        event.preventDefault();
        playback.play();
      }
      if (event.key === '?') setHelp(true);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [playback.play, studio.undo, studio.redo, view]);
  const chooseProject = (id: string) => {
    playback.pause();
    studio.switchProject(id);
    setProjectMenu(false);
    setMobileNav(false);
    setView('timeline');
  };
  const selectFrame = (index: number) => {
    const frame = playback.frames[index];
    if (frame) playback.seek(frame.start_time_sec);
  };
  const updateFrame = <K extends keyof Frame>(key: K, value: Frame[K]) => {
    const id = playback.active?.id;
    mutate((p) => {
      const frame = p.frames.find((f) => f.id === id);
      if (frame) frame[key] = value;
    });
  };
  const retime = (index: number, field: 'start' | 'end' | 'duration', value: number) => {
    const adjusted = adjustTiming(project.frames, index, field, value);
    mutate((p) => {
      p.frames = adjusted;
      p.target_duration = runtime(p);
    });
    playback.seek(timedFrames(adjusted)[index]?.start_time_sec || 0);
  };
  const addBeat = () => {
    const remaining = 180 - runtime(project);
    if (remaining < 0.1) {
      notify('The timeline is at its 180-second limit.', 'info');
      return;
    }
    const frame = { ...blankFrame(project), duration_sec: round(Math.min(2, remaining)) };
    const start = runtime(project);
    mutate((p) => {
      p.frames.push(frame);
      p.target_duration = runtime(p);
    });
    playback.seek(start);
    notify('A new visual beat is ready to make your own.');
  };
  const duplicateFrame = () => {
    const frame = project.frames[playback.activeIndex];
    if (!frame) return;
    if (runtime(project) + frame.duration_sec > 180) {
      notify('Duplicating this beat would exceed the 180-second limit.', 'info');
      return;
    }
    const start = playback.active.end_time_sec;
    mutate((p) => {
      p.frames.splice(playback.activeIndex + 1, 0, {
        ...frame,
        id: uid(),
        title: `${frame.title} (copy)`,
      });
      p.target_duration = runtime(p);
    });
    playback.seek(start);
    notify('Frame duplicated with its voice, optics, and audio cues.');
  };
  const deleteFrame = () => {
    const next = project.frames.filter((f) => f.id !== playback.active.id);
    const nextIndex = Math.min(playback.activeIndex, next.length - 1);
    mutate((p) => {
      p.frames = next;
      p.target_duration = next.length ? runtime(p) : 45;
    });
    playback.seek(timedFrames(next)[nextIndex]?.start_time_sec || 0);
    notify('Frame removed. Use Undo to bring it back.');
  };
  const reorder = (from: number, to: number) => {
    const next = [...project.frames];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    mutate((p) => {
      p.frames = next;
    });
    playback.seek(timedFrames(next)[to].start_time_sec);
    notify(`Frame moved to position ${to + 1}. Timing stays continuous.`);
  };
  const generate = () => {
    setConfirmGenerate(false);
    try {
      const frames = decomposeScript(project);
      mutate((p) => {
        p.frames = frames;
      });
      playback.seek(0);
      setView('timeline');
      const warnings = speechWarnings({ ...project, frames });
      notify(
        `${frames.length} beats generated across ${project.target_duration}s.${warnings.length ? ` ${warnings.length} speech-fit warnings are marked in the inspector.` : ' Your story is ready to play.'}`,
        warnings.length ? 'info' : 'success',
      );
    } catch (error) {
      notify((error as Error).message, 'error');
    }
  };
  const total = runtime(project);
  const currentSample = ['frozen-light', 'flagship-commercial'].includes(project.id);

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <IconButton
            label="Open workspace navigation"
            className="mobile-menu-button"
            onClick={() => setMobileNav(!mobileNav)}
          >
            <Menu size={21} />
          </IconButton>
          <div className="brand-mark" aria-hidden="true">
            <span />
            <span />
          </div>
          <div className="brand-copy">
            <strong>
              STORY ENGINE<span className="brand-period">®</span>
            </strong>
            <span>IMMERSIVE STORYTELLING</span>
          </div>
        </div>
        <div className="header-workspace">
          <div className="breadcrumbs">
            <FolderClosed size={13} />
            <span>Workspace</span>
            <ChevronRight size={12} />
            <strong>{project.title || 'Untitled story'}</strong>
          </div>
          <div className="header-right">
            <span className={`save-indicator ${saveState === 'error' ? 'save-error' : ''}`}>
              <span className={`tiny-dot ${saveState === 'saving' ? 'saving-dot' : 'green'}`} />
              {saveState === 'saving'
                ? 'Saving changes…'
                : saveState === 'error'
                  ? 'Local storage unavailable'
                  : 'All changes saved'}
            </span>
            <span className="header-divider" />
            <button className="help-button" aria-label="Quick guide" onClick={() => setHelp(true)}>
              <CircleHelp size={16} />
              <span>Quick guide</span>
            </button>
            <span className="workspace-avatar" title="Local studio workspace">
              SE
            </span>
          </div>
        </div>
      </header>
      {mobileNav && (
        <button
          className="sidebar-backdrop"
          aria-label="Close workspace navigation"
          onClick={() => setMobileNav(false)}
        />
      )}
      <aside
        className={`sidebar ${mobileNav ? 'sidebar-open' : ''}`}
        aria-label="Workspace navigation"
      >
        <div className="sidebar-upper">
          <div className="project-switcher" ref={switcherRef}>
            <span className="sidebar-section-label">YOUR WORKSPACE</span>
            <button
              className={`project-switcher-button ${projectMenu ? 'menu-open' : ''}`}
              aria-expanded={projectMenu}
              aria-label="Switch project"
              onClick={() => setProjectMenu(!projectMenu)}
            >
              <span className="project-thumb">
                <img
                  src={
                    project.mode === 'commercial'
                      ? '/images/arc-headphones.webp'
                      : '/images/frozen-expanse.webp'
                  }
                  alt=""
                />
              </span>
              <span>
                <strong>{project.title || 'Untitled story'}</strong>
                <small>Project workspace</small>
              </span>
              <ChevronDown size={14} />
            </button>
            {projectMenu && (
              <div className="project-menu">
                <div className="menu-caption">YOUR PROJECTS</div>
                {projects.map((p) => (
                  <button
                    key={p.id}
                    className={p.id === project.id ? 'selected' : ''}
                    onClick={() => chooseProject(p.id)}
                  >
                    <img
                      src={
                        p.mode === 'commercial'
                          ? '/images/arc-headphones.webp'
                          : '/images/frozen-expanse.webp'
                      }
                      alt=""
                    />
                    <span>
                      <strong>{p.title || 'Untitled story'}</strong>
                      <small>
                        {runtime(p)}s · {p.mode === 'commercial' ? 'Commercial' : 'Narrative'}
                      </small>
                    </span>
                    {p.id === project.id && <Check size={14} />}
                  </button>
                ))}
                <button
                  className="new-project-menu-item"
                  onClick={() => {
                    setProjectMenu(false);
                    setNewTitle('');
                    setNewDialog(true);
                  }}
                >
                  <Plus size={15} />
                  <span>New project</span>
                </button>
              </div>
            )}
          </div>
          <nav className="main-navigation">
            <span className="sidebar-section-label">CREATIVE WORKSPACE</span>
            {navigation.map((item) => (
              <div key={item.view}>
                {item.view === 'exports' && (
                  <div className="production-divider">
                    <span className="sidebar-section-label">PRODUCTION</span>
                  </div>
                )}
                <button
                  className={`nav-item ${view === item.view ? 'nav-active' : ''}`}
                  aria-current={view === item.view ? 'page' : undefined}
                  onClick={() => navigate(item.view)}
                >
                  {item.icon}
                  <span>{item.label}</span>
                  {item.stage && <small>{item.stage}</small>}
                  {item.view === 'continuity' && project.continuity.locked && (
                    <LockKeyhole size={11} className="nav-lock" />
                  )}
                </button>
              </div>
            ))}
          </nav>
        </div>
        <div className="sidebar-bottom">
          <div className="creative-card">
            <span className="creative-spark">
              <Sparkles size={20} />
            </span>
            <h3>
              Big stories.
              <br />
              Small moments.
            </h3>
            <p>
              Your next world starts
              <br />
              with a single beat.
            </p>
            <button
              onClick={() => {
                setNewTitle('');
                setNewDialog(true);
              }}
            >
              <Plus size={13} /> New project <ArrowUpRight size={13} />
            </button>
          </div>
          <div className="local-workspace">
            <span className="local-icon">
              <HardDrive size={15} />
            </span>
            <div>
              <strong>Local-first workspace</strong>
              <span>Yours. Saved in this browser.</span>
            </div>
            <span className="tiny-dot green" />
          </div>
          <div className="sidebar-version">
            <span>IMMERSIVE STORY ENGINE</span>
            <span>v1.0</span>
          </div>
        </div>
      </aside>
      <main className="main-content">
        <div className="content-inner">
          <section className="project-heading">
            <div>
              <div className="project-eyebrow">
                <span className="eyebrow">
                  PROJECT{' '}
                  {String(projects.findIndex((p) => p.id === project.id) + 1).padStart(3, '0')}
                </span>
                <span className="eyebrow-divider" />
                <span className="project-status">
                  <span className="tiny-dot green" />
                  IN THE MAKING
                </span>
              </div>
              <div className="project-title-line">
                <h1>{project.title || 'Untitled story'}</h1>
                <span
                  className={`mode-badge ${project.mode === 'commercial' ? 'commercial-badge' : ''}`}
                >
                  {project.mode === 'commercial' ? 'COMMERCIAL' : 'NARRATIVE'}
                </span>
              </div>
              <p>
                {project.subtitle}
                <span className="heading-detail">
                  {project.frames.length} frames <span>·</span> {project.fps} fps
                </span>
              </p>
            </div>
            <div className="project-heading-actions">
              <div className="history-actions">
                <IconButton
                  label="Undo last change"
                  disabled={!studio.canUndo}
                  onClick={() => {
                    playback.pause();
                    studio.undo();
                  }}
                >
                  <Undo2 size={15} />
                </IconButton>
                <IconButton
                  label="Redo last change"
                  disabled={!studio.canRedo}
                  onClick={() => {
                    playback.pause();
                    studio.redo();
                  }}
                >
                  <Redo2 size={15} />
                </IconButton>
              </div>
              <button
                className="button secondary edit-script-button"
                onClick={() => navigate(view === 'script' ? 'timeline' : 'script')}
              >
                {view === 'script' ? <Clapperboard size={14} /> : <SquarePen size={14} />}
                {view === 'script' ? 'Open timeline' : 'Edit script'}
              </button>
              <button
                className="button primary"
                onClick={() => navigate(view === 'exports' ? 'timeline' : 'exports')}
              >
                {view === 'exports' ? 'Back to timeline' : 'Export project'}
                <ArrowUpRight size={15} />
              </button>
              <div className="more-project" ref={moreRef}>
                <IconButton
                  label="More project actions"
                  aria-expanded={moreMenu}
                  onClick={() => setMoreMenu(!moreMenu)}
                >
                  <MoreHorizontal size={19} />
                </IconButton>
                {moreMenu && (
                  <div className="more-menu">
                    <button
                      onClick={() => {
                        const copy: Project = {
                          ...structuredClone(project),
                          id: uid(),
                          title: `${project.title} · Copy`,
                        };
                        studio.addProject(copy);
                        setMoreMenu(false);
                        notify('An independent copy of your project is ready.');
                      }}
                    >
                      <CopyPlus size={14} />
                      Duplicate project
                    </button>
                    <button
                      onClick={() => {
                        setMoreMenu(false);
                        navigate('continuity');
                      }}
                    >
                      <SquarePen size={14} />
                      Rename project
                    </button>
                    {currentSample && (
                      <button
                        onClick={() => {
                          setMoreMenu(false);
                          setConfirmReset(true);
                        }}
                      >
                        <RotateCcw size={14} />
                        Reset sample project
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </section>
          {view === 'timeline' && (
            <div className="studio-view">
              <div className="continuity-banner">
                <div
                  className={`continuity-state ${project.continuity.locked ? '' : 'unlocked-state'}`}
                >
                  <ShieldCheck size={15} />
                  <span>
                    {project.continuity.locked ? 'Continuity locked' : 'Continuity unlocked'}
                  </span>
                  <span className="tiny-dot" />
                </div>
                <span className="banner-divider" />
                <div className="continuity-chips">
                  <span>
                    <span className="chip-square" />
                    {project.continuity.color_pipeline}
                  </span>
                  <span>{project.continuity.aspect_ratio}</span>
                  <span>{project.continuity.camera_rig.split(',').slice(0, 2).join(' ·')}</span>
                  <span className="film-stock-chip">
                    {project.continuity.film_stock.replace('35mm ', '')}
                  </span>
                </div>
                <button onClick={() => navigate('continuity')} title="Edit global continuity bible">
                  Edit bible <ArrowUpRight size={12} />
                </button>
              </div>
              {playback.active ? (
                <>
                  <div className="studio-grid">
                    <Preview project={project} playback={playback} notify={notify} />
                    <Inspector
                      project={project}
                      frame={playback.active}
                      index={playback.activeIndex}
                      onChange={updateFrame}
                      onTiming={(field, value) => retime(playback.activeIndex, field, value)}
                      onSelect={selectFrame}
                      onDuplicate={duplicateFrame}
                      onDelete={deleteFrame}
                      onPause={playback.pause}
                      onContinuity={() => navigate('continuity')}
                    />
                  </div>
                  <Timeline
                    project={project}
                    playback={playback}
                    onSelect={selectFrame}
                    onAdd={addBeat}
                    onReorder={reorder}
                    onResize={(index, duration) => retime(index, 'duration', duration)}
                  />
                  <div className="studio-summary">
                    <span>
                      <Layers3 size={12} />
                      <strong>{project.frames.length}</strong> timed frames
                      <span className="summary-dot">·</span>
                      <strong>{total.toFixed(1)}s</strong> total
                      <span className="summary-dot">·</span>
                      <strong>{Object.keys(project.voice_profiles).length}</strong> voice profiles
                    </span>
                    <button onClick={() => navigate('voices')}>
                      <AudioLines size={12} /> Manage voice map <ArrowRight size={12} />
                    </button>
                  </div>
                </>
              ) : (
                <EmptyState
                  title="Every story starts with a moment."
                  description="Write a script, set your pace, and turn your first idea into a frame-by-frame world."
                  action={
                    <button className="button primary" onClick={() => navigate('script')}>
                      <FileText size={15} />
                      Write your first scene <ArrowUpRight size={14} />
                    </button>
                  }
                />
              )}
            </div>
          )}
          {view === 'script' && (
            <ScriptStage
              key={project.id}
              project={project}
              mutate={mutate}
              onGenerate={() => (project.frames.length ? setConfirmGenerate(true) : generate())}
            />
          )}
          {view === 'continuity' && (
            <ContinuityStage key={project.id} project={project} mutate={mutate} />
          )}
          {view === 'voices' && (
            <VoicesStage key={project.id} project={project} mutate={mutate} notify={notify} />
          )}
          {view === 'exports' && (
            <ExportStage
              key={project.id}
              project={project}
              notify={notify}
              onScript={() => navigate('script')}
            />
          )}
          <footer className="main-footer">
            <span>FOR THE SPACE BETWEEN SCRIPT & SCREEN.</span>
            <span>
              <span className="tiny-dot" />
              ENGINE v1.0 <span>·</span> CREATE WITH INTENTION
            </span>
          </footer>
        </div>
      </main>
      {toast && (
        <div
          className={`toast toast-${toast.kind}`}
          role={toast.kind === 'error' ? 'alert' : 'status'}
        >
          <span className="toast-icon">
            {toast.kind === 'success' ? (
              <CheckCheck size={18} />
            ) : toast.kind === 'error' ? (
              <X size={17} />
            ) : (
              <CircleHelp size={17} />
            )}
          </span>
          <span>{toast.message}</span>
          <IconButton label="Dismiss notification" onClick={() => setToast(null)}>
            <X size={13} />
          </IconButton>
        </div>
      )}
      {newDialog && (
        <Dialog
          title="A new world awaits."
          description="Give your project a name. Start with a blank script and a ready-to-edit continuity bible."
          onClose={() => setNewDialog(false)}
        >
          <label className="field">
            <span className="field-label">Project title</span>
            <input
              autoFocus
              aria-label="New project title"
              value={newTitle}
              placeholder="Wrath of Fire, or something entirely yours…"
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && newTitle.trim()) {
                  studio.addProject(newProject(newTitle));
                  setNewDialog(false);
                  navigate('script');
                }
              }}
            />
          </label>
          <div className="dialog-actions">
            <button className="button secondary" onClick={() => setNewDialog(false)}>
              Cancel
            </button>
            <button
              className="button primary"
              disabled={!newTitle.trim()}
              onClick={() => {
                studio.addProject(newProject(newTitle));
                setNewDialog(false);
                navigate('script');
                notify('Your new workspace is ready. Start with a story.');
              }}
            >
              <Plus size={14} />
              Create project
            </button>
          </div>
        </Dialog>
      )}
      {confirmGenerate && (
        <Dialog
          title="Make room for a new timeline."
          description={`Your script will be decomposed into new ${project.mode === 'commercial' ? 'commercial' : 'narrative'} beats across ${project.target_duration}s. This replaces the current ${project.frames.length} frames and their per-shot edits. Your continuity bible and voice map stay intact.`}
          onClose={() => setConfirmGenerate(false)}
        >
          <div className="dialog-info">
            <Undo2 size={15} />
            You can undo this generation and restore your previous timeline.
          </div>
          <div className="dialog-actions">
            <button className="button secondary" onClick={() => setConfirmGenerate(false)}>
              Keep editing
            </button>
            <button className="button primary" onClick={generate}>
              <Sparkles size={14} />
              Generate timeline
            </button>
          </div>
        </Dialog>
      )}
      {confirmReset && (
        <Dialog
          title="Return to the original sample?"
          description="This restores the sample script, timing, continuity, and voices. Your current changes can still be recovered with Undo."
          onClose={() => setConfirmReset(false)}
        >
          <div className="dialog-actions">
            <button className="button secondary" onClick={() => setConfirmReset(false)}>
              Keep my changes
            </button>
            <button
              className="button primary"
              onClick={() => {
                const original = sampleProjects().find((p) => p.id === project.id);
                if (original) mutate((p) => Object.assign(p, original));
                playback.seek(0);
                setConfirmReset(false);
                notify('The original sample project has been restored.');
              }}
            >
              <RotateCcw size={14} />
              Reset sample
            </button>
          </div>
        </Dialog>
      )}
      {help && (
        <Dialog
          title="A little structure. Infinite possibility."
          description="Meet your four-stage filmmaking workspace. Everything lives in your browser until you export it."
          onClose={() => setHelp(false)}
          wide
        >
          <div className="guide-steps">
            {[
              {
                n: '01',
                icon: <FileText size={19} />,
                title: 'Start with the script',
                text: 'Add a concept or script, choose 15–180 seconds, and generate weighted micro-scenes or rapid commercial beats.',
                view: 'script' as View,
              },
              {
                n: '02',
                icon: <Clapperboard size={19} />,
                title: 'Find the rhythm',
                text: 'Select shots, drag to reorder, pull clip edges to retime, and play your concept-frame animatic.',
                view: 'timeline' as View,
              },
              {
                n: '03',
                icon: <AudioLines size={19} />,
                title: 'Keep the world consistent',
                text: 'Lock your optics and voice seeds. Dialogue automatically ducks the music by 12 dB; silent beats return to 0 dB.',
                view: 'continuity' as View,
              },
              {
                n: '04',
                icon: <ArrowDownToLine size={19} />,
                title: 'Make it production-ready',
                text: 'Export Beat-Split JSON, a runnable FFMPEG pipeline, and Remotion props. Supply final media to render.',
                view: 'exports' as View,
              },
            ].map((step) => (
              <button
                key={step.n}
                onClick={() => {
                  setHelp(false);
                  navigate(step.view);
                }}
              >
                <span className="guide-number">{step.n}</span>
                <span className="guide-icon">{step.icon}</span>
                <span>
                  <strong>{step.title}</strong>
                  <p>{step.text}</p>
                </span>
                <ArrowUpRight size={15} />
              </button>
            ))}
          </div>
          <div className="guide-shortcuts">
            <span>
              <kbd>Space</kbd> Play / pause
            </span>
            <span>
              <kbd>Ctrl / ⌘ Z</kbd> Undo
            </span>
            <span>
              <kbd>?</kbd> This guide
            </span>
          </div>
          <p className="guide-disclaimer">
            Concept artwork is a visual reference, not generated shot video. Browser speech
            approximates voice pacing; production seed IDs are passed through to your chosen TTS
            provider. Music and SFX are cue metadata until you supply final audio.
          </p>
        </Dialog>
      )}
    </div>
  );
}
