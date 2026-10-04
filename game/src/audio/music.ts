/**
 * Streaming music with equal-power crossfades. Tracks are HTMLAudioElements (streamed, no big decode)
 * routed through WebAudio (MediaElementSource -> per-track gain -> duck -> music bus).
 * Missing or failing files are tolerated silently (one console warning).
 */
import type { MusicMood } from './api';
import { fadeCurve } from './math';
import { canStart, LOOP_FADE_IN_MS, loopFadeOutMs, LoopWatch, nextAction, RESUME_MOODS, resumePosition } from './musicLogic';
import { MUSIC_TRACKS, TAVERN_TRACK } from './tracks';

/** Per-track trim so the authored tracks sit at a similar loudness under the effects. */
const TRIM: Partial<Record<MusicMood, number>> = { tavern: 0.5 };
const BASE = 0.6;

export function trackUrl(mood: MusicMood): string {
  const path = mood === 'tavern' ? TAVERN_TRACK : MUSIC_TRACKS[mood];
  const base = (typeof import.meta !== 'undefined' && import.meta.env?.BASE_URL) || '/';
  return `${base.endsWith('/') ? base : base + '/'}${path}`;
}

/** Smooth gain change that can interrupt a running fade without scheduling conflicts. */
export function rampTo(param: AudioParam, ctx: BaseAudioContext, to: number, ms: number): void {
  const now = ctx.currentTime;
  const from = param.value;
  param.cancelScheduledValues(now);
  param.setValueAtTime(from, now);
  const dur = Math.max(0.02, ms / 1000);
  const curve = fadeCurve(from, to, 12);
  for (let i = 1; i < curve.length; i++) param.linearRampToValueAtTime(curve[i], now + (dur * i) / (curve.length - 1));
}

/** Fast fade to silence for stopping sounds: drops immediately (exponential), no equal-power shoulder. */
export function fadeOutFast(param: AudioParam, ctx: BaseAudioContext, ms: number): void {
  const now = ctx.currentTime;
  const from = param.value;
  param.cancelScheduledValues(now);
  param.setValueAtTime(from, now);
  const dur = Math.max(0.01, ms / 1000);
  param.setTargetAtTime(0, now, dur / 4);
  param.setValueAtTime(0, now + dur * 1.5);
}

interface Track {
  mood: MusicMood;
  el: HTMLAudioElement;
  gain: GainNode;
  source: MediaElementAudioSourceNode | null;
  dead: boolean;
}

export class MusicManager {
  private ctx: AudioContext | null = null;
  private out: AudioNode | null = null;
  private current: Track | null = null;
  private desired: MusicMood | null = null;
  private desiredFade = 1500;
  private positions = new Map<MusicMood, number>();
  private warned = new Set<string>();
  private failedAt = new Map<MusicMood, number>();
  private paused = false;

  requested(): MusicMood | null { return this.desired; }

  /** Playback info for debugging/QA. */
  info(): { mood: MusicMood | null; playing: boolean; time: number; gain: number } {
    const t = this.current;
    return { mood: t?.mood ?? null, playing: !!t && !t.dead && !t.el.paused, time: t?.el.currentTime ?? 0, gain: t?.gain.gain.value ?? 0 };
  }

  attach(ctx: AudioContext, out: AudioNode): void {
    this.ctx = ctx;
    this.out = out;
    if (this.desired) this.start(this.desired, this.desiredFade);
  }

  set(mood: MusicMood | null, fadeMs = 1800, restart = false): void {
    const playing = this.current && !this.current.dead ? this.current.mood : null;
    const action = nextAction({ attached: !!this.ctx, playing }, mood, restart);
    this.desired = mood;
    this.desiredFade = fadeMs;
    switch (action) {
      case 'defer': case 'noop': return;
      case 'fade-out': this.fadeOutCurrent(fadeMs); return;
      case 'restart':
        if (mood) this.positions.delete(mood);
        this.fadeOutCurrent(fadeMs, false);
        if (mood) this.start(mood, fadeMs);
        return;
      case 'crossfade':
        this.fadeOutCurrent(fadeMs);
        if (mood) this.start(mood, fadeMs);
        return;
    }
  }

  /** QA helper: jumps the current track to `secondsFromEnd` before its end (tests the loop crossfade). */
  seekNearEnd(secondsFromEnd: number): void {
    const t = this.current;
    if (t && Number.isFinite(t.el.duration)) t.el.currentTime = Math.max(0, t.el.duration - secondsFromEnd);
  }

  /** Retries playback that the browser refused before a user gesture. */
  retry(): void {
    const t = this.current;
    if (t && !t.dead && !this.paused && t.el.paused) t.el.play().catch(() => { /* still blocked */ });
  }

  /** Pause/resume element playback (tab hidden). */
  setPaused(paused: boolean): void {
    if (this.paused === paused) return;
    this.paused = paused;
    const t = this.current;
    if (!t || t.dead) return;
    if (paused) t.el.pause();
    else t.el.play().catch(() => { /* resumes on next gesture */ });
  }

  private fadeOutCurrent(ms: number, remember = true): void {
    const t = this.current;
    this.current = null;
    if (!t || !this.ctx) return;
    if (remember && RESUME_MOODS.has(t.mood) && !t.dead && Number.isFinite(t.el.currentTime)) this.positions.set(t.mood, t.el.currentTime);
    rampTo(t.gain.gain, this.ctx, 0, ms);
    window.setTimeout(() => this.dispose(t), ms + 150);
  }

  private dispose(t: Track): void {
    t.dead = true;
    try { t.el.pause(); } catch { /* ignore */ }
    try { t.source?.disconnect(); t.gain.disconnect(); } catch { /* ignore */ }
    t.el.removeAttribute('src');
    try { t.el.load(); } catch { /* ignore */ }
  }

  private start(mood: MusicMood, fadeMs: number, fromTop = false): void {
    const ctx = this.ctx;
    const out = this.out;
    if (!ctx || !out) return;
    // A file that failed recently is not retried on every scene change.
    if (!canStart(this.failedAt.get(mood), performance.now())) return;
    const url = trackUrl(mood);
    const el = new Audio();
    // Looping is done by crossfading into a fresh copy before the authored fade-out tail.
    el.loop = false;
    el.preload = 'auto';
    const gain = ctx.createGain();
    gain.gain.value = 0;
    let source: MediaElementAudioSourceNode | null = null;
    try {
      source = ctx.createMediaElementSource(el);
      source.connect(gain);
      gain.connect(out);
    } catch {
      source = null;
    }
    const track: Track = { mood, el, gain, source, dead: false };
    this.current = track;
    const level = BASE * (TRIM[mood] ?? 1);
    const saved = fromTop ? undefined : this.positions.get(mood);
    el.addEventListener('loadedmetadata', () => {
      const at = resumePosition(mood, saved, el.duration);
      if (at !== null) {
        try { el.currentTime = at; } catch { /* ignore */ }
      }
    }, { once: true });
    let faded = false;
    const fadeIn = () => {
      if (faded || track.dead || this.current !== track) return;
      faded = true;
      if (source) rampTo(gain.gain, ctx, level, fadeMs);
      else el.volume = Math.min(1, level); // fallback without WebAudio routing
    };
    el.addEventListener('playing', fadeIn, { once: true });
    const watch = new LoopWatch(mood);
    const loopOver = () => {
      if (track.dead || this.current !== track) return;
      this.positions.delete(mood);
      this.fadeOutCurrent(loopFadeOutMs(mood), false);
      this.start(mood, LOOP_FADE_IN_MS, true);
    };
    el.addEventListener('timeupdate', () => { if (watch.update(el.currentTime, el.duration)) loopOver(); });
    el.addEventListener('ended', () => { if (watch.ended()) loopOver(); });
    el.addEventListener('error', () => {
      if (!this.warned.has(url)) { this.warned.add(url); console.warn(`[audio] Musik nicht verfügbar: ${url}`); }
      this.failedAt.set(mood, performance.now());
      if (this.current === track) this.current = null;
      this.dispose(track);
    }, { once: true });
    el.src = url;
    if (!this.paused) {
      el.play().then(fadeIn).catch(() => {
        // Autoplay refused (no gesture yet) or load error; retried by retry()/next set().
      });
    }
  }
}
