import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Project, VoiceProfile, runtime, timedFrames } from './model';

export const speechAvailable = () =>
  typeof window !== 'undefined' &&
  'speechSynthesis' in window &&
  'SpeechSynthesisUtterance' in window;

export function speak(text: string, profile?: VoiceProfile) {
  if (!speechAvailable()) return;
  window.speechSynthesis.cancel();
  if (!text.trim()) return;
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'en-US';
  utterance.rate = Math.max(0.5, Math.min(2, (profile?.speaking_rate_wpm || 150) / 150));
  const voices = window.speechSynthesis.getVoices().filter((v) => v.lang.startsWith('en'));
  if (voices.length) {
    const hash = [...(profile?.voice_seed_id || 'narrator')].reduce(
      (sum, char) => sum + char.charCodeAt(0),
      0,
    );
    utterance.voice = voices[hash % voices.length];
  }
  window.speechSynthesis.speak(utterance);
}

export function usePlayback(project: Project) {
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [tts, setTts] = useState(false);
  const frames = useMemo(() => timedFrames(project.frames), [project.frames]);
  const duration = runtime(project);
  const activeIndex = Math.max(
    0,
    frames.findIndex((frame) => time >= frame.start_time_sec && time < frame.end_time_sec),
  );
  const effectiveIndex = time >= duration && frames.length ? frames.length - 1 : activeIndex;
  const active = frames[effectiveIndex];
  const timeRef = useRef(time);
  timeRef.current = time;

  useEffect(() => {
    setPlaying(false);
    setTime(0);
    if (speechAvailable()) window.speechSynthesis.cancel();
  }, [project.id]);
  useEffect(() => {
    if (timeRef.current > duration) {
      setTime(Math.max(0, duration));
      setPlaying(false);
    }
  }, [duration]);
  useEffect(() => {
    if (!playing || !frames.length) return;
    let request = 0;
    const started = performance.now();
    const offset = timeRef.current;
    const tick = (now: number) => {
      const next = Math.min(duration, offset + (now - started) / 1000);
      // The wall clock stays real-time, while UI updates follow the project fps.
      if (
        Math.floor(next * project.fps) !== Math.floor(timeRef.current * project.fps) ||
        next >= duration
      )
        setTime(next);
      if (next >= duration) setPlaying(false);
      else request = requestAnimationFrame(tick);
    };
    request = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(request);
  }, [playing, duration, frames.length, project.fps]);

  const activeProfile = active ? project.voice_profiles[active.character_speaker] : undefined;
  useEffect(() => {
    if (!speechAvailable()) return;
    if (playing && tts && active) speak(active.narration_text, activeProfile);
    else window.speechSynthesis.cancel();
    return () => window.speechSynthesis.cancel();
  }, [
    playing,
    tts,
    active?.id,
    active?.narration_text,
    activeProfile?.voice_seed_id,
    activeProfile?.speaking_rate_wpm,
  ]);

  const seek = useCallback(
    (value: number) => {
      setPlaying(false);
      setTime(Math.max(0, Math.min(duration, value)));
    },
    [duration],
  );
  const play = useCallback(() => {
    if (!frames.length) return;
    if (timeRef.current >= duration) {
      timeRef.current = 0;
      setTime(0);
    }
    setPlaying((value) => !value);
  }, [duration, frames.length]);
  return {
    playing,
    time,
    tts,
    setTts,
    frames,
    active,
    activeIndex: effectiveIndex,
    duration,
    seek,
    play,
    pause: () => setPlaying(false),
  };
}

export type Playback = ReturnType<typeof usePlayback>;
