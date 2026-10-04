/**
 * Pure decision logic of the music manager (no HTMLAudioElement, no WebAudio). Tested in musicLogic.test.ts.
 */
import type { MusicMood } from './api';

/** Calm moods continue where they stopped; dramatic ones always start from the top. */
export const RESUME_MOODS: ReadonlySet<MusicMood> = new Set<MusicMood>(['exploration', 'refuge', 'tavern']);

/**
 * Seconds of fade-out tail at the end of each authored track (measured from 0.5 s RMS curves).
 * The loop crossfade must finish before this tail, otherwise every loop dips by ~17 dB.
 */
export const LOOP_TAIL_S: Record<MusicMood, number> = {
  exploration: 4.5, battle: 3.2, flight: 3.5, refuge: 4, dread: 6.5, grief: 3.5, tavern: 3.2,
};
/** How long before the tail the old copy starts fading out (it keeps playing almost fully meanwhile). */
export const LOOP_OVERLAP_S = 1.6;
/** Fade-in of the fresh copy at a loop. Short, so the intro's first bar is not lost. */
export const LOOP_FADE_IN_MS = 800;
/** A track that failed to load is not retried for this long. */
export const RETRY_AFTER_MS = 30000;

/** Playback position (s) at which the loop crossfade starts, or null for short/unknown durations. */
export function loopAt(mood: MusicMood, duration: number): number | null {
  if (!Number.isFinite(duration) || duration < 20) return null;
  return duration - LOOP_TAIL_S[mood] - LOOP_OVERLAP_S;
}

/** Fade-out time (ms) of the old copy at a loop: across the overlap and into the natural tail. */
export function loopFadeOutMs(mood: MusicMood): number {
  return Math.round((LOOP_OVERLAP_S + LOOP_TAIL_S[mood] * 0.6) * 1000);
}

/** Fires exactly once per track when playback reaches the loop point. */
export class LoopWatch {
  private fired = false;
  constructor(private readonly mood: MusicMood) {}
  update(currentTime: number, duration: number): boolean {
    if (this.fired) return false;
    const at = loopAt(this.mood, duration);
    if (at === null || !(currentTime >= at)) return false;
    this.fired = true;
    return true;
  }
  /** The element ended without a timeupdate past the loop point (e.g. very coarse events). */
  ended(): boolean {
    if (this.fired) return false;
    this.fired = true;
    return true;
  }
}

/** Where a resumed calm mood should continue (null = from the top). */
export function resumePosition(mood: MusicMood, saved: number | undefined, duration: number): number | null {
  if (!RESUME_MOODS.has(mood) || saved === undefined || !Number.isFinite(saved) || saved <= 0) return null;
  const at = loopAt(mood, duration);
  const limit = at ?? duration - 2;
  return saved < limit - 2 ? saved : null;
}

export type MusicAction =
  /** Not attached yet (no AudioContext): only remember the wish. */
  | 'defer'
  /** Nothing to do. */
  | 'noop'
  /** Fade out the current track and stay silent. */
  | 'fade-out'
  /** Fade out the current track (if any) and start the requested mood. */
  | 'crossfade'
  /** Same mood, but from the top: crossfade into a fresh copy. */
  | 'restart';

export interface MusicView {
  attached: boolean;
  /** Mood of the live (not dead) current track, or null. */
  playing: MusicMood | null;
}

/** Decides what a music(mood, { restart }) request does. */
export function nextAction(view: MusicView, mood: MusicMood | null, restart = false): MusicAction {
  if (!view.attached) return 'defer';
  if (mood === null) return view.playing ? 'fade-out' : 'noop';
  if (view.playing === mood) return restart ? 'restart' : 'noop';
  return 'crossfade';
}

/** True when a mood may be (re)started now, given when it last failed to load. */
export function canStart(failedAt: number | undefined, nowMs: number): boolean {
  return failedAt === undefined || nowMs - failedAt >= RETRY_AFTER_MS;
}
