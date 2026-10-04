/**
 * Audio engine: implements AudioApi (audio/api.ts).
 * - The AudioContext is created lazily on unlock() (first user gesture). Earlier music/ambience
 *   requests are remembered and start then; effects and blips are only played while the context is
 *   actually running (no backlog bursting out on resume).
 * - Volumes follow core/settings live ('settings:changed').
 */
import { events } from '../core/events';
import { settings, type Settings } from '../core/settings';
import type {
  AmbienceLayer, AudioApi, MusicMood, SfxHandle, SfxLoop, SfxLoopOptions, SfxName, SfxOptions,
} from './api';
import { LAYERS, layerTrim, type Generator } from './ambience';
import { buildGraph, type Graph } from './graph';
import {
  blipVoicing, clamp, dbToGain, distanceParams, jitter, panValue, pitchRatio, sfxGain, Throttle, throttleKey,
  VoiceBudget, volumeToGain,
} from './math';
import { fadeOutFast, MusicManager, rampTo } from './music';
import { duckFor, IMPORTANT, SFX, sfxTrim, sfxWeight, throttleMs } from './sfx';
import { tone, type Voice } from './synth';

interface ActiveLayer {
  gain: GainNode;
  /** Reverb send of this layer; follows `gain`. */
  verb: GainNode;
  gens: Generator[];
  leaving: boolean;
  stopTimer?: number;
}

/** Per-sound (or per-loop) channel strip: volume -> optional distance lowpass -> optional pan. */
interface Strip {
  input: GainNode;
  send: GainNode;
  lp: BiquadFilterNode | null;
  pan: StereoPannerNode | null;
}

interface ActiveSfx {
  strip: Strip;
  end: number;
  timer: number;
  stopped: boolean;
}

interface LoopState {
  name: SfxName;
  opts: Required<Omit<SfxLoopOptions, 'interval'>> & { interval: number | null };
  strip: Strip | null;
  next: number;
  natural: number;
  stopped: boolean;
}

/** Runtime info for the demo/debug panel. */
export interface AudioDebug {
  state: () => AudioContextState | 'none';
  analyser: () => AnalyserNode | null;
  voices: () => number;
  effects: () => number;
  loops: () => number;
  layers: () => AmbienceLayer[];
  music: () => { mood: MusicMood | null; playing: boolean; time: number; gain: number };
  seekMusicNearEnd: (secondsFromEnd: number) => void;
  focus: () => boolean;
}

export let audioDebug: AudioDebug = {
  state: () => 'none', analyser: () => null, voices: () => 0, effects: () => 0, loops: () => 0, layers: () => [],
  music: () => ({ mood: null, playing: false, time: 0, gain: 0 }),
  seekMusicNearEnd: () => {}, focus: () => false,
};

const NO_SOUND: SfxHandle = Object.freeze({ stop: () => {}, duration: 0 });

/** Dialogue focus levels. */
const FOCUS_MUSIC_DB = -5;
const FOCUS_AMB_DB = -3;

class AudioEngine implements AudioApi {
  private ctx: AudioContext | null = null;
  private graph: Graph | null = null;
  private readonly musicMgr = new MusicManager();
  private readonly throttle = new Throttle(45);
  private readonly budget = new VoiceBudget(28);
  private wantedLayers: AmbienceLayer[] = [];
  private layerVolume: Partial<Record<AmbienceLayer, number>> = {};
  private layerFade = 2000;
  private readonly layers = new Map<AmbienceLayer, ActiveLayer>();
  private readonly active = new Set<ActiveSfx>();
  private readonly loops = new Set<LoopState>();
  private ticker = 0;
  private duckUntil = 0;
  private duckDepth = 1;
  private focus = false;
  private failed = false;

  constructor() {
    events.on('settings:changed', (s: Settings) => this.applySettings(s));
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => this.onVisibility());
    }
    if (typeof window !== 'undefined') {
      // iOS Safari only counts touchend/click as activation for audio; main.ts listens to pointerdown/keydown.
      // These stay registered (cheap early return) so audio also recovers after an iOS 'interrupted' state.
      const onGesture = () => { if (this.ctx?.state !== 'running') this.unlock(); };
      for (const ev of ['touchend', 'click', 'keydown', 'pointerup']) {
        window.addEventListener(ev, onGesture, { capture: true, passive: true });
      }
    }
    audioDebug = {
      state: () => this.ctx?.state ?? 'none',
      analyser: () => this.graph?.analyser ?? null,
      voices: () => (this.ctx ? this.budget.active(this.ctx.currentTime) : 0),
      effects: () => {
        const now = this.ctx?.currentTime ?? 0;
        let n = 0;
        for (const a of this.active) if (!a.stopped && a.end > now) n++;
        return n;
      },
      loops: () => [...this.loops].filter(l => !l.stopped).length,
      layers: () => [...this.layers.entries()].filter(([, l]) => !l.leaving).map(([k]) => k),
      music: () => this.musicMgr.info(),
      seekMusicNearEnd: s => this.musicMgr.seekNearEnd(s),
      focus: () => this.focus,
    };
  }

  // ------------------------------------------------------------ lifecycle

  unlock(): void {
    if (this.failed) return;
    if (!this.ctx) {
      try {
        const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!Ctor) { this.failed = true; return; }
        this.ctx = new Ctor({ latencyHint: 'interactive' });
        this.graph = buildGraph(this.ctx);
        this.applySettings(settings, true);
        this.applyFocus(true);
        this.musicMgr.attach(this.ctx, this.graph.duck);
        this.applyAmbience();
        this.ticker = window.setInterval(() => this.tick(), 100);
      } catch (err) {
        console.warn('[audio] WebAudio nicht verfügbar', err);
        this.failed = true;
        this.ctx = null;
        this.graph = null;
        return;
      }
    }
    // 'suspended' and Safari's 'interrupted' both need a resume from a gesture.
    if (this.ctx.state !== 'running' && this.ctx.state !== 'closed' && document.visibilityState !== 'hidden') {
      this.ctx.resume().catch(() => { /* next gesture */ });
    }
    this.musicMgr.retry();
  }

  private onVisibility(): void {
    if (!this.ctx) return;
    const hidden = document.visibilityState === 'hidden';
    this.musicMgr.setPaused(hidden);
    if (hidden) this.ctx.suspend().catch(() => { /* ignore */ });
    else this.ctx.resume().catch(() => { /* ignore */ });
  }

  private applySettings(s: Settings, immediate = false): void {
    const g = this.graph;
    const ctx = this.ctx;
    if (!g || !ctx) return;
    const music = volumeToGain(s.music);
    const fx = volumeToGain(s.sfx);
    const set = (node: GainNode, v: number) => {
      if (immediate) node.gain.value = v;
      else { node.gain.cancelScheduledValues(ctx.currentTime); node.gain.setTargetAtTime(v, ctx.currentTime, 0.06); }
    };
    set(g.music, music);
    set(g.sfx, fx);
    set(g.sfxVerb, fx);
    set(g.voice, fx);
    set(g.amb, fx * 0.85);
    set(g.ambVerb, fx * 0.85);
  }

  private tick(): void {
    const ctx = this.ctx;
    if (!ctx || ctx.state !== 'running') return;
    const now = ctx.currentTime;
    // Leaving layers keep scheduling until their stop timer fires, so their events fade out
    // with the layer gain instead of stopping abruptly.
    for (const layer of this.layers.values()) {
      for (const gen of layer.gens) {
        try { gen.tick(now + 0.45, now); } catch (err) { console.warn('[audio] ambience', err); }
      }
    }
    for (const loop of this.loops) this.tickLoop(loop, now);
  }

  // ------------------------------------------------------------ music

  music(mood: MusicMood | null, opts?: { fadeMs?: number; restart?: boolean }): void {
    this.musicMgr.set(mood, opts?.fadeMs ?? 1800, opts?.restart ?? false);
  }

  currentMusic(): MusicMood | null { return this.musicMgr.requested(); }

  duck(db = -9, ms = 1500): void {
    const g = this.graph;
    const ctx = this.ctx;
    if (!g || !ctx) return;
    const now = ctx.currentTime;
    const depth = dbToGain(clamp(db, -40, 0));
    const until = now + ms / 1000;
    if (now < this.duckUntil) {
      // already ducked: keep the deeper level, extend the hold
      this.duckDepth = Math.min(this.duckDepth, depth);
      this.duckUntil = Math.max(this.duckUntil, until);
    } else {
      this.duckDepth = depth;
      this.duckUntil = until;
    }
    const p = g.duck.gain;
    p.cancelScheduledValues(now);
    p.setValueAtTime(p.value, now);
    p.linearRampToValueAtTime(this.duckDepth, now + 0.12);
    p.setValueAtTime(this.duckDepth, this.duckUntil);
    p.linearRampToValueAtTime(1, this.duckUntil + 0.9);
  }

  dialogueFocus(on: boolean): void {
    if (this.focus === on) return;
    this.focus = on;
    this.applyFocus(false);
  }

  private applyFocus(immediate: boolean): void {
    const g = this.graph;
    const ctx = this.ctx;
    if (!g || !ctx) return;
    const music = this.focus ? dbToGain(FOCUS_MUSIC_DB) : 1;
    const amb = this.focus ? dbToGain(FOCUS_AMB_DB) : 1;
    // in: ~250 ms, out: ~600 ms (three time constants)
    const tc = this.focus ? 0.08 : 0.2;
    for (const [node, v] of [[g.musicFocus, music], [g.ambFocus, amb]] as const) {
      const p = node.gain;
      if (immediate) { p.value = v; continue; }
      const now = ctx.currentTime;
      p.cancelScheduledValues(now);
      p.setValueAtTime(p.value, now);
      p.setTargetAtTime(v, now, tc);
    }
  }

  stopAll(fadeMs = 1500): void {
    this.music(null, { fadeMs });
    this.ambience([], { fadeMs });
    for (const a of this.active) this.fadeActive(a, Math.min(fadeMs, 600));
    for (const l of this.loops) this.stopLoop(l, Math.min(fadeMs, 600));
  }

  // ------------------------------------------------------------ sfx

  private voice(out: AudioNode, verb: AudioNode | null, pitch: number, at: number): Voice {
    return { ctx: this.ctx!, out, verb, rng: Math.random, p: pitch, t: at };
  }

  /** Builds a channel strip into the given buses. `full` always creates filter and panner (for live changes). */
  private makeStrip(volume: number, pan: number, distance: number | undefined, dry: AudioNode, wet: AudioNode, full = false): Strip {
    const ctx = this.ctx!;
    const d = distanceParams(distance);
    const input = ctx.createGain();
    input.gain.value = volume * d.gain;
    let head: AudioNode = input;
    let lp: BiquadFilterNode | null = null;
    if (d.cutoff !== null || full) {
      lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = d.cutoff ?? 20000;
      lp.Q.value = 0;
      head.connect(lp);
      head = lp;
    }
    let panner: StereoPannerNode | null = null;
    if (pan !== 0 || full) {
      panner = ctx.createStereoPanner();
      panner.pan.value = pan;
      head.connect(panner);
      head = panner;
    }
    head.connect(dry);
    const send = ctx.createGain();
    send.gain.value = volume * d.gain * d.wet;
    send.connect(wet);
    return { input, send, lp, pan: panner };
  }

  private disposeStrip(s: Strip): void {
    try { s.input.disconnect(); s.send.disconnect(); s.lp?.disconnect(); s.pan?.disconnect(); } catch { /* ignore */ }
  }

  sfx(name: SfxName, opts?: SfxOptions): SfxHandle {
    const ctx = this.ctx;
    const g = this.graph;
    const recipe = SFX[name];
    // Only while running: a suspended context does not advance, scheduled sounds would pile up.
    if (!ctx || !g || !recipe || ctx.state !== 'running') return NO_SOUND;
    if (!this.throttle.allow(throttleKey(name, opts?.key), performance.now(), throttleMs(name))) return NO_SOUND;
    const t = ctx.currentTime + 0.01;
    const crowd = this.budget.active(t);
    const ticket = this.budget.reserve(t, sfxWeight(name), IMPORTANT.has(name));
    if (!ticket) return NO_SOUND;
    const volume = sfxGain(opts?.volume, crowd) * sfxTrim(name);
    if (volume <= 0) { ticket.end = t; return NO_SOUND; }
    const strip = this.makeStrip(volume, panValue(opts?.pan), opts?.distance, g.sfx, g.sfxVerb);
    let end = t + 1;
    try {
      end = recipe(this.voice(strip.input, strip.send, pitchRatio(opts?.pitch), t));
    } catch (err) {
      console.warn(`[audio] sfx ${name}`, err);
    }
    ticket.end = end;
    const entry: ActiveSfx = { strip, end, timer: 0, stopped: false };
    this.active.add(entry);
    // reverb tail: keep the strip a little longer than the dry sound
    entry.timer = window.setTimeout(() => this.releaseActive(entry), (end - t) * 1000 + 2500);
    const duck = duckFor(name);
    // far-away stings duck the music less
    if (duck) this.duck(duck.db * (1 - 0.6 * clamp(opts?.distance ?? 0, 0, 1)), duck.ms);
    return { duration: end - t, stop: (fadeMs = 120) => this.fadeActive(entry, fadeMs) };
  }

  private fadeActive(a: ActiveSfx, ms: number): void {
    const ctx = this.ctx;
    if (!ctx || a.stopped) return;
    a.stopped = true;
    a.end = ctx.currentTime;
    fadeOutFast(a.strip.input.gain, ctx, ms);
    fadeOutFast(a.strip.send.gain, ctx, ms);
    window.clearTimeout(a.timer);
    a.timer = window.setTimeout(() => this.releaseActive(a), ms * 1.5 + 150);
  }

  private releaseActive(a: ActiveSfx): void {
    window.clearTimeout(a.timer);
    this.disposeStrip(a.strip);
    this.active.delete(a);
  }

  // ------------------------------------------------------------ loops

  loop(name: SfxName, opts: SfxLoopOptions = {}): SfxLoop {
    const state: LoopState = {
      name,
      opts: {
        interval: opts.interval !== undefined ? Math.max(0.08, opts.interval) : null,
        volume: clamp(opts.volume ?? 1, 0, 2),
        pan: panValue(opts.pan),
        pitch: pitchRatio(opts.pitch),
        distance: clamp(opts.distance ?? 0, 0, 1),
      },
      strip: null, next: 0, natural: 0.5, stopped: false,
    };
    if (SFX[name]) this.loops.add(state);
    this.tick();
    return {
      set: o => this.setLoop(state, o),
      stop: (fadeMs = 250) => this.stopLoop(state, fadeMs),
    };
  }

  private setLoop(l: LoopState, o: SfxLoopOptions): void {
    if (l.stopped) return;
    if (o.interval !== undefined) l.opts.interval = Math.max(0.08, o.interval);
    if (o.volume !== undefined) l.opts.volume = clamp(o.volume, 0, 2);
    if (o.pan !== undefined) l.opts.pan = panValue(o.pan);
    if (o.pitch !== undefined) l.opts.pitch = pitchRatio(o.pitch);
    if (o.distance !== undefined) l.opts.distance = clamp(o.distance, 0, 1);
    const ctx = this.ctx;
    const s = l.strip;
    if (!ctx || !s) return;
    const now = ctx.currentTime;
    const d = distanceParams(l.opts.distance);
    const vol = l.opts.volume * sfxTrim(l.name);
    s.input.gain.setTargetAtTime(vol * d.gain, now, 0.05);
    s.send.gain.setTargetAtTime(vol * d.gain * d.wet, now, 0.05);
    s.lp?.frequency.setTargetAtTime(d.cutoff ?? 20000, now, 0.05);
    s.pan?.pan.setTargetAtTime(l.opts.pan, now, 0.05);
  }

  private stopLoop(l: LoopState, ms: number): void {
    if (l.stopped) return;
    l.stopped = true;
    const ctx = this.ctx;
    const s = l.strip;
    if (!ctx || !s) { this.loops.delete(l); return; }
    fadeOutFast(s.input.gain, ctx, ms);
    fadeOutFast(s.send.gain, ctx, ms);
    window.setTimeout(() => { this.disposeStrip(s); this.loops.delete(l); }, ms * 1.5 + 2500);
  }

  private tickLoop(l: LoopState, now: number): void {
    if (l.stopped) return;
    const g = this.graph!;
    if (!l.strip) {
      const vol = l.opts.volume * sfxTrim(l.name);
      l.strip = this.makeStrip(vol, l.opts.pan, l.opts.distance, g.sfx, g.sfxVerb, true);
      l.next = now + 0.03;
    }
    if (l.next < now - 0.25) l.next = now + 0.03; // starved (background tab): no backlog
    const recipe = SFX[l.name];
    while (l.next < now + 0.3) {
      const at = l.next;
      const ticket = this.budget.reserve(now, sfxWeight(l.name), false);
      if (ticket) {
        try {
          const end = recipe(this.voice(l.strip.input, l.strip.send, l.opts.pitch, at));
          ticket.end = end;
          l.natural = Math.max(0.1, end - at);
        } catch (err) {
          console.warn(`[audio] loop ${l.name}`, err);
          ticket.end = now;
        }
      }
      l.next = at + (l.opts.interval ?? l.natural + 0.05);
    }
  }

  // ------------------------------------------------------------ voice blips

  blip(pitch: number, wave: OscillatorType = 'triangle', opts?: { pan?: number; volume?: number }): void {
    const ctx = this.ctx;
    const g = this.graph;
    if (!ctx || !g || ctx.state !== 'running') return;
    if (!this.throttle.allow('__blip', performance.now(), 28)) return;
    const vol = clamp(opts?.volume ?? 1, 0, 2);
    if (vol <= 0) return;
    const f = clamp(Number.isFinite(pitch) ? pitch : 220, 60, 1400) * jitter(Math.random, 1, 0.045);
    const pan = panValue(opts?.pan);
    let out: AudioNode = g.voice;
    if (vol !== 1 || pan !== 0) {
      const gain = ctx.createGain();
      gain.gain.value = vol;
      if (pan !== 0) {
        const p = ctx.createStereoPanner();
        p.pan.value = pan;
        gain.connect(p).connect(g.voice);
      } else gain.connect(g.voice);
      out = gain;
      window.setTimeout(() => { try { gain.disconnect(); } catch { /* ignore */ } }, 400);
    }
    const voicing = blipVoicing(f, wave);
    const v = this.voice(out, null, 1, ctx.currentTime + 0.005);
    const env = { peak: voicing.peak, attack: 0.004, release: 0.055 };
    tone(v, { type: wave, freq: f, to: f * 0.94, glide: 0.05, env, filter: { type: 'lowpass', freq: voicing.lowpass, q: 0.6 } });
    if (voicing.octave > 0) {
      // second harmonic for deep voices: keeps them audible on phone and laptop speakers
      tone(v, { type: 'triangle', freq: f * 2, to: f * 1.88, glide: 0.05, env: { ...env, peak: voicing.peak * voicing.octave }, filter: { type: 'lowpass', freq: voicing.lowpass, q: 0.6 } });
    }
  }

  // ------------------------------------------------------------ ambience

  currentAmbience(): AmbienceLayer[] { return [...this.wantedLayers]; }

  ambience(layers: AmbienceLayer[], opts?: { fadeMs?: number; volume?: Partial<Record<AmbienceLayer, number>> }): void {
    this.wantedLayers = [...new Set(layers.filter(l => l in LAYERS))];
    this.layerVolume = { ...(opts?.volume ?? {}) };
    this.layerFade = opts?.fadeMs ?? 2000;
    this.applyAmbience();
  }

  private applyAmbience(): void {
    const ctx = this.ctx;
    const g = this.graph;
    if (!ctx || !g) return;
    const fade = this.layerFade;
    // fade out layers that are no longer wanted
    for (const [name, layer] of this.layers) {
      if (this.wantedLayers.includes(name) || layer.leaving) continue;
      layer.leaving = true;
      rampTo(layer.gain.gain, ctx, 0, fade);
      rampTo(layer.verb.gain, ctx, 0, fade);
      layer.stopTimer = window.setTimeout(() => {
        const at = ctx.currentTime + 0.05;
        for (const gen of layer.gens) { try { gen.stop(at); } catch { /* ignore */ } }
        // let reverb tails and the last scheduled events ring out into silence before disconnecting
        window.setTimeout(() => { try { layer.gain.disconnect(); layer.verb.disconnect(); } catch { /* ignore */ } }, 600);
        if (this.layers.get(name) === layer) this.layers.delete(name);
      }, fade + 200);
    }
    // fade in (or re-target) wanted layers
    for (const name of this.wantedLayers) {
      const level = clamp(this.layerVolume[name] ?? 1, 0, 1.5) * layerTrim(name);
      const existing = this.layers.get(name);
      if (existing && !existing.leaving) {
        rampTo(existing.gain.gain, ctx, level, Math.min(fade, 800));
        rampTo(existing.verb.gain, ctx, level, Math.min(fade, 800));
        continue;
      }
      if (existing) {
        // was fading out: revive it
        window.clearTimeout(existing.stopTimer);
        existing.leaving = false;
        rampTo(existing.gain.gain, ctx, level, fade);
        rampTo(existing.verb.gain, ctx, level, fade);
        continue;
      }
      const gain = ctx.createGain();
      gain.gain.value = 0;
      gain.connect(g.amb);
      const verb = ctx.createGain();
      verb.gain.value = 0;
      verb.connect(g.ambVerb);
      let gens: Generator[] = [];
      try {
        gens = LAYERS[name]({
          ctx, out: gain, verb, rng: Math.random, start: ctx.currentTime + 0.02,
          emit: (event, payload) => events.emit(event, payload),
        });
      } catch (err) {
        console.warn(`[audio] ambience ${name}`, err);
      }
      this.layers.set(name, { gain, verb, gens, leaving: false });
      rampTo(gain.gain, ctx, level, fade);
      rampTo(verb.gain, ctx, level, fade);
    }
    this.tick();
  }
}

export function createAudio(): AudioApi {
  return new AudioEngine();
}
