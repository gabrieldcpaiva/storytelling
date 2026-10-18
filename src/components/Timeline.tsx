import { useEffect, useRef, useState } from 'react';
import {
  AudioLines,
  Film,
  GripVertical,
  LayoutList,
  Mic,
  Minus,
  Music2,
  Plus,
  Sparkles,
} from 'lucide-react';
import { Project, TimedFrame, bgmGain, formatSeconds, round, timedFrames } from '../lib/model';
import { Playback } from '../lib/usePlayback';
import { IconButton, Waveform } from './ui';

export function Timeline({
  project,
  playback,
  onSelect,
  onAdd,
  onReorder,
  onResize,
}: {
  project: Project;
  playback: Playback;
  onSelect: (index: number) => void;
  onAdd: () => void;
  onReorder: (from: number, to: number) => void;
  onResize: (index: number, duration: number) => void;
}) {
  const [zoom, setZoom] = useState(1);
  const [vertical, setVertical] = useState(false);
  const [dragging, setDragging] = useState<number | null>(null);
  const [resize, setResize] = useState<{ index: number; duration: number } | null>(null);
  const resizeRef = useRef<{
    index: number;
    x: number;
    original: number;
    value: number;
    pixelsPerSecond: number;
  } | null>(null);
  const content = useRef<HTMLDivElement>(null);
  const scrollViewport = useRef<HTMLDivElement>(null);
  const [viewportWidth, setViewportWidth] = useState(0);
  useEffect(() => {
    const element = scrollViewport.current;
    if (!element) return;
    const observer = new ResizeObserver(() => setViewportWidth(element.clientWidth));
    observer.observe(element);
    setViewportWidth(element.clientWidth);
    return () => observer.disconnect();
  }, [vertical]);
  const { frames, duration, activeIndex, time } = playback;
  const shown: TimedFrame[] = resize
    ? timedFrames(
        project.frames.map((f, i) =>
          i === resize.index ? { ...f, duration_sec: resize.duration } : f,
        ),
      )
    : frames;
  const shownDuration = shown.at(-1)?.end_time_sec || 1;
  const pos = (value: number) => `${(value / shownDuration) * 100}%`;
  const step = shownDuration <= 20 ? 2 : shownDuration <= 60 ? 5 : shownDuration <= 120 ? 10 : 15;
  const ticks = Array.from({ length: Math.floor(shownDuration / step) + 1 }, (_, i) => i * step);
  const envelope = shown
    .map(
      (f, i) =>
        `${i ? 'L' : 'M'} ${(f.start_time_sec / shownDuration) * 1000} ${bgmGain(f) === -12 ? 22 : 8} L ${(f.end_time_sec / shownDuration) * 1000} ${bgmGain(f) === -12 ? 22 : 8}`,
    )
    .join(' ');
  const seekPointer = (event: React.PointerEvent<HTMLElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    playback.seek(((event.clientX - bounds.left) / bounds.width) * duration);
  };
  const drop = (event: React.DragEvent<HTMLElement>, index: number) => {
    event.preventDefault();
    const from = Number(event.dataTransfer.getData('application/story-frame'));
    if (
      dragging !== null &&
      Number.isInteger(from) &&
      from >= 0 &&
      from < frames.length &&
      from !== index
    )
      onReorder(from, index);
    setDragging(null);
  };
  return (
    <section className="panel timeline-panel" aria-label="Multi-track beat timeline">
      <div className="panel-header timeline-header">
        <div className="panel-title">
          <Film size={15} />
          <h2>Beat timeline</h2>
          <span className="mini-badge frame-count">{frames.length} FRAMES</span>
        </div>
        <div className="timeline-header-actions">
          <div className="layout-switch">
            <IconButton
              label={vertical ? 'Switch to horizontal timeline' : 'Switch to vertical timeline'}
              aria-pressed={vertical}
              onClick={() => setVertical(!vertical)}
            >
              {vertical ? <Film size={14} /> : <LayoutList size={14} />}
            </IconButton>
          </div>
          {!vertical && (
            <div className="zoom-control">
              <IconButton
                label="Zoom out timeline"
                disabled={zoom <= 0.75}
                onClick={() => setZoom((v) => Math.max(0.75, v - 0.25))}
              >
                <Minus size={12} />
              </IconButton>
              <button
                className="zoom-value"
                title="Reset timeline zoom"
                aria-label="Reset timeline zoom"
                onClick={() => setZoom(1)}
              >
                {Math.round(zoom * 100)}%
              </button>
              <IconButton
                label="Zoom in timeline"
                disabled={zoom >= 4}
                onClick={() => setZoom((v) => Math.min(4, v + 0.25))}
              >
                <Plus size={12} />
              </IconButton>
            </div>
          )}
          <span className="vertical-separator" />
          <button className="button tiny secondary" onClick={onAdd} disabled={duration >= 179.9}>
            <Plus size={13} /> Add beat
          </button>
        </div>
      </div>
      {vertical ? (
        <div className="vertical-timeline">
          {frames.map((frame, index) => (
            <button
              key={frame.id}
              className={`vertical-beat ${activeIndex === index ? 'is-selected' : ''}`}
              onClick={() => onSelect(index)}
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData('application/story-frame', String(index));
                setDragging(index);
              }}
              onDragEnd={() => setDragging(null)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => drop(e, index)}
            >
              <GripVertical size={15} />
              <span className="mono muted">{String(index + 1).padStart(2, '0')}</span>
              <img src={frame.image} alt="" />
              <span className="vertical-beat-copy">
                <strong>{frame.title}</strong>
                <span>{frame.narration_text || 'Silent visual beat'}</span>
              </span>
              <span className="mono muted">{frame.time_window}</span>
              <span className={`gain-pill ${bgmGain(frame) === -12 ? '' : 'gain-full'}`}>
                {bgmGain(frame)} dB
              </span>
            </button>
          ))}
        </div>
      ) : (
        <div className="timeline-workarea">
          <div className="track-labels">
            <div className="track-ruler-label">
              <span className="micro-label">TRACKS</span>
            </div>
            <div className="track-label visual-label">
              <Film size={13} />
              <span>Visuals</span>
              <span className="track-count">{frames.length}</span>
            </div>
            <div className="track-label voice-label">
              <Mic size={12} />
              <span>Voice</span>
            </div>
            <div className="track-label sfx-label">
              <Sparkles size={12} />
              <span>SFX</span>
            </div>
            <div className="track-label music-label">
              <Music2 size={12} />
              <span>Music</span>
            </div>
          </div>
          <div className="timeline-scroll" ref={scrollViewport}>
            <div
              className="timeline-content"
              ref={content}
              style={{
                width: `${Math.max(500, viewportWidth, frames.length * 50) * zoom}px`,
                minWidth: '500px',
              }}
            >
              <div
                className="timeline-ruler"
                role="slider"
                tabIndex={0}
                aria-label="Timeline playhead"
                aria-valuemin={0}
                aria-valuemax={duration}
                aria-valuenow={round(time, 1)}
                onKeyDown={(e) => {
                  if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
                    e.preventDefault();
                    playback.seek(time + (e.key === 'ArrowRight' ? 1 : -1));
                  }
                }}
                onPointerDown={(e) => {
                  e.currentTarget.setPointerCapture(e.pointerId);
                  seekPointer(e);
                }}
                onPointerMove={(e) => {
                  if (e.buttons === 1) seekPointer(e);
                }}
              >
                {ticks.map((tick) => (
                  <span
                    key={tick}
                    className={`ruler-tick ${tick === 0 ? 'ruler-first' : ''}`}
                    style={{ left: pos(tick) }}
                  >
                    {String(Math.floor(tick / 60)).padStart(2, '0')}:
                    {String(tick % 60).padStart(2, '0')}
                  </span>
                ))}
                {!ticks.includes(shownDuration) && (
                  <span className="ruler-tick ruler-last" style={{ left: '100%' }}>
                    {formatSeconds(shownDuration)}
                  </span>
                )}
              </div>
              <div className="timeline-track visual-track">
                {shown.map((frame, index) => (
                  <div
                    key={frame.id}
                    className={`visual-clip ${activeIndex === index ? 'is-selected' : ''} ${dragging === index ? 'is-dragging' : ''}`}
                    style={{ left: pos(frame.start_time_sec), width: pos(frame.duration_sec) }}
                    draggable={!resize}
                    onDragStart={(e) => {
                      e.dataTransfer.setData('application/story-frame', String(index));
                      e.dataTransfer.effectAllowed = 'move';
                      setDragging(index);
                    }}
                    onDragEnd={() => setDragging(null)}
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.dataTransfer.dropEffect = 'move';
                    }}
                    onDrop={(e) => drop(e, index)}
                  >
                    <button
                      className="clip-select"
                      aria-label={`Select frame ${index + 1}: ${frame.title}`}
                      onClick={() => onSelect(index)}
                      title={`${frame.title}\n${frame.time_window}\nDrag to reorder`}
                    >
                      <img
                        draggable={false}
                        src={frame.image}
                        alt=""
                        style={{ objectPosition: frame.image_position }}
                      />
                      <span className="clip-gradient" />
                      <span className="clip-id">{String(index + 1).padStart(2, '0')}</span>
                      <span className="clip-title">{frame.title}</span>
                      <span className="clip-duration">{formatSeconds(frame.duration_sec)}</span>
                    </button>
                    <div
                      className="clip-resize"
                      role="separator"
                      aria-orientation="vertical"
                      aria-label={`Resize frame ${index + 1}`}
                      aria-valuenow={frame.duration_sec}
                      aria-valuemin={0.1}
                      aria-valuemax={180}
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
                          e.preventDefault();
                          onResize(
                            index,
                            frame.duration_sec + (e.key === 'ArrowRight' ? 0.1 : -0.1),
                          );
                        }
                      }}
                      onClick={(e) => e.stopPropagation()}
                      onPointerDown={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        playback.pause();
                        e.currentTarget.setPointerCapture(e.pointerId);
                        resizeRef.current = {
                          index,
                          x: e.clientX,
                          original: frame.duration_sec,
                          value: frame.duration_sec,
                          pixelsPerSecond: (content.current?.clientWidth || 900) / duration,
                        };
                        setResize({ index, duration: frame.duration_sec });
                      }}
                      onPointerMove={(e) => {
                        const drag = resizeRef.current;
                        if (!drag) return;
                        const other = duration - drag.original;
                        drag.value = round(
                          Math.max(
                            0.1,
                            Math.min(
                              180 - other,
                              drag.original + (e.clientX - drag.x) / drag.pixelsPerSecond,
                            ),
                          ),
                          2,
                        );
                        setResize({ index: drag.index, duration: drag.value });
                      }}
                      onPointerUp={() => {
                        const drag = resizeRef.current;
                        if (drag) onResize(drag.index, drag.value);
                        resizeRef.current = null;
                        setResize(null);
                      }}
                      onPointerCancel={() => {
                        resizeRef.current = null;
                        setResize(null);
                      }}
                    >
                      <i />
                    </div>
                  </div>
                ))}
              </div>
              <div className="timeline-track voice-track">
                {shown.map((frame, index) => (
                  <button
                    key={frame.id}
                    onClick={() => onSelect(index)}
                    className={`audio-clip voice-clip ${!frame.narration_text.trim() ? 'silent-clip' : ''}`}
                    style={{ left: pos(frame.start_time_sec), width: pos(frame.duration_sec) }}
                    title={frame.narration_text || 'Silent visual beat'}
                    aria-label={`Voice track, frame ${index + 1}`}
                  >
                    {frame.narration_text.trim() ? (
                      <>
                        <span>{frame.character_speaker}</span>
                        <Waveform seed={index + 2} bars={24} />
                      </>
                    ) : (
                      <span className="silent-mark">—</span>
                    )}
                  </button>
                ))}
              </div>
              <div className="timeline-track sfx-track">
                {shown.map((frame, index) => (
                  <button
                    key={frame.id}
                    onClick={() => onSelect(index)}
                    className={`audio-clip sfx-clip ${!frame.sfx_cue ? 'no-sfx' : ''}`}
                    style={{ left: pos(frame.start_time_sec), width: pos(frame.duration_sec) }}
                    title={frame.sfx_cue || 'No sound effect'}
                    aria-label={`Sound effects, frame ${index + 1}`}
                  >
                    <AudioLines size={10} />
                    <span>{frame.sfx_cue || '—'}</span>
                  </button>
                ))}
              </div>
              <div className="timeline-track music-track">
                <div className="music-bed">
                  <Waveform seed={3} bars={160} />
                  <span className="music-bed-label">
                    <Music2 size={10} />
                    {project.frames[0]?.bgm_mood.split(';')[0]}
                    <span> · AUTO DUCK −12 dB</span>
                  </span>
                  <svg
                    viewBox="0 0 1000 32"
                    preserveAspectRatio="none"
                    aria-label="Music gain envelope"
                  >
                    <path d={envelope} />
                  </svg>
                </div>
              </div>
              <div
                className="timeline-playhead"
                style={{ left: pos(Math.min(time, shownDuration)) }}
              >
                <span />
              </div>
            </div>
          </div>
        </div>
      )}
      <div className="timeline-footer">
        <span>
          <span className="tiny-dot green" />
          {project.continuity.locked
            ? 'Continuity synced across all frames'
            : 'Shot-level continuity overrides enabled'}
        </span>
        <span className="timeline-tip">
          <GripVertical size={11} /> Drag to reorder <span>·</span> Pull an edge to retime
        </span>
        <span className="timeline-total">{formatSeconds(duration)} TOTAL</span>
      </div>
    </section>
  );
}
