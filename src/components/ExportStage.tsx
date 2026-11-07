import { memo, useMemo, useState } from 'react';
import {
  Braces,
  Check,
  ChevronDown,
  ClipboardCopy,
  Clock3,
  Download,
  FileCode2,
  Film,
  FolderOpen,
  Layers3,
  PackageCheck,
  Terminal,
  TriangleAlert,
} from 'lucide-react';
import { strToU8, zipSync } from 'fflate';
import { Project, runtime } from '../lib/model';
import { downloadFile, exportFiles } from '../lib/exporters';
import { speechWarnings } from '../lib/engine';
import { copyText } from '../lib/clipboard';
import { Notify } from '../lib/useStudio';
import { EmptyState } from './ui';

type FileName = 'timeline_manifest.json' | 'render_pipeline.sh' | 'remotion_props.json';
const files: { name: FileName; label: string; icon: React.ReactNode; description: string }[] = [
  {
    name: 'timeline_manifest.json',
    label: 'Beat-split JSON',
    icon: <Braces size={15} />,
    description:
      'The complete source of truth: continuity, voices, timed frames, and media references.',
  },
  {
    name: 'render_pipeline.sh',
    label: 'FFMPEG pipeline',
    icon: <Terminal size={15} />,
    description:
      'A runnable Bash pipeline with aspect padding, centered transitions, and exact −12 dB music ducking.',
  },
  {
    name: 'remotion_props.json',
    label: 'Remotion props',
    icon: <Layers3 size={15} />,
    description:
      'Frame-accurate composition metadata, sequences, and music volume segments for your Remotion template.',
  },
];

function highlight(line: string, shell: boolean) {
  const pattern = shell
    ? /(#.*$)|("(?:\\.|[^"\\])*"|'[^']*')|\b(if|then|else|fi|for|do|done|in|set|trap|exit|printf|ffmpeg|cat)\b|(\$\{?[^\s";{}]+\}?)/g
    : /("(?:\\.|[^"\\])*")(\s*:)?|\b(true|false|null)\b|(-?\b\d+(?:\.\d+)?\b)/g;
  const pieces: React.ReactNode[] = [];
  let cursor = 0;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(line))) {
    if (match.index > cursor) pieces.push(line.slice(cursor, match.index));
    const type = shell
      ? match[1]
        ? 'comment'
        : match[2]
          ? 'string'
          : match[3]
            ? 'keyword'
            : 'variable'
      : match[2]
        ? 'key'
        : match[1]
          ? 'string'
          : match[3]
            ? 'keyword'
            : 'number';
    pieces.push(
      <span className={`token-${type}`} key={match.index}>
        {match[0]}
      </span>,
    );
    cursor = match.index + match[0].length;
  }
  if (cursor < line.length) pieces.push(line.slice(cursor));
  return pieces.length ? pieces : '\u00a0';
}
const CodeView = memo(function CodeView({ code, shell }: { code: string; shell: boolean }) {
  return (
    <div className="code-scroll" tabIndex={0} aria-label="Compiled export source">
      <pre className="code-view">
        {code.split('\n').map((line, i) => (
          <span className="code-line" key={i}>
            <span className="line-number" aria-hidden="true">
              {i + 1}
            </span>
            <code>{highlight(line, shell)}</code>
          </span>
        ))}
      </pre>
    </div>
  );
});

export function ExportStage({
  project,
  notify,
  onScript,
}: {
  project: Project;
  notify: Notify;
  onScript: () => void;
}) {
  const [active, setActive] = useState<FileName>('timeline_manifest.json');
  const [copied, setCopied] = useState(false);
  const [showAssets, setShowAssets] = useState(false);
  const exports = useMemo(() => exportFiles(project), [project]);
  const warnings = speechWarnings(project);
  const file = files.find((file) => file.name === active)!;
  const code = exports[active];
  if (!project.frames.length)
    return (
      <EmptyState
        title="A story worth exporting."
        description="Generate your first beats to compile production-ready JSON, FFMPEG, and Remotion files."
        action={
          <button className="button primary" onClick={onScript}>
            Start with a script
          </button>
        }
      />
    );
  const downloadBundle = () => {
    const readme = `IMMERSIVE STORY ENGINE v1.0\nProject: ${project.title}\n\nFILES\n- timeline_manifest.json: full editorial and continuity specification\n- render_pipeline.sh: runnable FFmpeg assembly pipeline (Bash 4+, FFmpeg 5+)\n- remotion_props.json: composition and sequence props for your Remotion component\n\nASSETS\nPlace your final media in ./assets using sequential 3-digit names:\nframe_001.mp4 (or .png/.jpg), dialogue_001.wav, sfx_001.wav, bgm.wav.\nRepeat for all ${project.frames.length} beats. Narration audio is only used on beats with non-empty narration.\nThese exports do not contain generated video, production TTS, SFX, or music.\nMissing media is replaced with placeholders/silence and reported by the script.\n\nRENDER\nbash render_pipeline.sh ./assets ./output.mp4\n\nCOLOR\nApply your ACEScg-to-Rec.709 display transform before supplying final video assets.\n\nREMOTION\nProvide ImmersiveStoryComposition, register the exported composition metadata,\npass props to it, and resolve assets via staticFile(). Use the volumeSegments\nfor a frame-based BGM volume callback. The export is props, not a React renderer.\n\nSPEECH FIT\n${warnings.length ? warnings.map((w) => `Frame ${w.frame}: ${w.estimated}s speech exceeds ${w.available}s beat; resolve before production.`).join('\n') : 'All dialogue fits its assigned beat at the configured speaking rates.'}\n`;
    const bundle = zipSync(
      Object.fromEntries([
        ...Object.entries(exports).map(([name, content]) => [name, strToU8(content)]),
        ['README.txt', strToU8(readme)],
      ]),
    );
    downloadFile(
      bundle,
      `${
        project.title
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-|-$/g, '') || 'story'
      }-production-bundle.zip`,
      'application/zip',
    );
    notify('Production bundle downloaded: all three compilers plus the asset guide.');
  };
  return (
    <div className="stage-page export-page">
      <div className="stage-intro stage-intro-row">
        <div>
          <span className="stage-kicker">STAGE 04 / FINAL ASSET ASSEMBLY</span>
          <h2>From story to production.</h2>
          <p>Your timeline, compiled. Take it to the tools that bring it to life.</p>
        </div>
        <button className="button primary" onClick={downloadBundle}>
          <Download size={16} />
          Download bundle
        </button>
      </div>
      <div className="export-summary">
        <div>
          <Film size={18} />
          <span>
            <strong>{project.frames.length}</strong>
            <small>Timed frames</small>
          </span>
          <span className="summary-check">
            <Check size={12} />
          </span>
        </div>
        <div>
          <Clock3 size={18} />
          <span>
            <strong>{runtime(project).toFixed(1)}s</strong>
            <small>Total runtime · {project.fps} fps</small>
          </span>
          <span className="summary-check">
            <Check size={12} />
          </span>
        </div>
        <div>
          <PackageCheck size={18} />
          <span>
            <strong>3 formats</strong>
            <small>Compiled from your live project</small>
          </span>
          <span className="summary-check">
            <Check size={12} />
          </span>
        </div>
      </div>
      {warnings.length > 0 && (
        <details className="export-warnings">
          <summary>
            <TriangleAlert size={14} />
            {warnings.length} speech-fit {warnings.length === 1 ? 'warning' : 'warnings'} — review
            before final render
            <ChevronDown size={14} />
          </summary>
          <ul>
            {warnings.map((w) => (
              <li key={w.frame}>
                Frame {w.frame}: {w.estimated}s estimated dialogue in a {w.available}s beat.
                Lengthen the beat, shorten the narration, or adjust speaking rate.
              </li>
            ))}
          </ul>
        </details>
      )}
      <section className="panel export-compiler">
        <div className="export-tabs" role="tablist" aria-label="Export formats">
          {files.map((item) => (
            <button
              key={item.name}
              id={`export-tab-${item.name}`}
              role="tab"
              aria-selected={active === item.name}
              aria-controls="compiled-source"
              className={active === item.name ? 'selected' : ''}
              onClick={() => {
                setActive(item.name);
                setCopied(false);
              }}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </div>
        <div className="export-description">
          <p>{file.description}</p>
        </div>
        <div className="code-toolbar">
          <span>
            <FileCode2 size={14} />
            <strong>{active}</strong>
            <span className="mini-badge">{active.endsWith('.sh') ? 'BASH' : 'JSON'}</span>
          </span>
          <div>
            <button
              className="button tiny secondary"
              onClick={async () => {
                try {
                  await copyText(code);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                } catch (e) {
                  notify((e as Error).message, 'error');
                }
              }}
            >
              {copied ? <Check size={12} /> : <ClipboardCopy size={12} />}
              {copied ? 'Copied' : 'Copy'}
            </button>
            <button
              className="button tiny secondary"
              onClick={() => {
                downloadFile(
                  code,
                  active,
                  active.endsWith('.sh') ? 'text/x-shellscript' : 'application/json',
                );
                notify(`${active} downloaded.`);
              }}
            >
              <Download size={12} />
              Download
            </button>
          </div>
        </div>
        <div id="compiled-source" role="tabpanel" aria-labelledby={`export-tab-${active}`}>
          <CodeView code={code} shell={active.endsWith('.sh')} />
        </div>
        <div className="code-footer">
          <span>
            <span className="tiny-dot green" />
            LIVE COMPILATION
          </span>
          <span>
            {code.split('\n').length} lines <span>·</span>{' '}
            {(new TextEncoder().encode(code).length / 1024).toFixed(1)} KB <span>·</span> UTF-8
          </span>
        </div>
      </section>
      <section className="panel asset-contract">
        <button
          className="asset-contract-toggle"
          onClick={() => setShowAssets(!showAssets)}
          aria-expanded={showAssets}
        >
          <span className="asset-contract-icon">
            <FolderOpen size={18} />
          </span>
          <span>
            <strong>A clear handoff for your production assets.</strong>
            <small>File naming, missing-media behavior, and what to bring to the render.</small>
          </span>
          <ChevronDown size={16} className={showAssets ? 'rotated' : ''} />
        </button>
        {showAssets && (
          <div className="asset-contract-body">
            <pre>
              {
                'assets/\n├── frame_001.mp4      # or .png / .jpg\n├── dialogue_001.wav   # rendered narration\n├── sfx_001.wav        # optional sound effects\n├── …                 # repeat for each beat\n└── bgm.wav           # full music bed'
              }
            </pre>
            <div>
              <p>
                Supply your final visual, voice, SFX, and music assets. The studio compiles the
                assembly instructions; it does not generate final media.
              </p>
              <p>
                Run <code>bash render_pipeline.sh ./assets ./output.mp4</code>. Missing assets
                render as charcoal frames or silence and are reported in the terminal. Dissolves and
                whip-pans preserve absolute timing.
              </p>
              <p>
                For Remotion, provide your <code>ImmersiveStoryComposition</code> component and
                consume the exported sequences and volume segments.
              </p>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
