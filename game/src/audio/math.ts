/**
 * Pure audio helpers (no WebAudio objects). Unit tested in math.test.ts.
 */

export const clamp = (v: number, lo: number, hi: number): number => (v < lo ? lo : v > hi ? hi : v);

export const dbToGain = (db: number): number => Math.pow(10, db / 20);
export const gainToDb = (gain: number): number => (gain <= 0 ? -Infinity : 20 * Math.log10(gain));

/**
 * Maps a settings slider value (0..1) to a linear gain with a perceptual curve.
 * 0 is true silence, 1 is unity, 0.5 is about -12 dB (feels like "half as loud").
 */
export function volumeToGain(v: number): number {
  const x = clamp(Number.isFinite(v) ? v : 0, 0, 1);
  if (x <= 0) return 0;
  return x * x;
}

export const semitonesToRatio = (st: number): number => Math.pow(2, st / 12);

/** MIDI note number to frequency (A4 = 69 = 440 Hz). */
export const midiToHz = (note: number): number => 440 * Math.pow(2, (note - 69) / 12);

/** Equal-power crossfade gains for progress t in 0..1 (sum of squares stays 1). */
export function equalPower(t: number): { out: number; in: number } {
  const x = clamp(t, 0, 1);
  return { out: Math.cos(x * Math.PI * 0.5), in: Math.sin(x * Math.PI * 0.5) };
}

/** Sampled equal-power fade curve from `from` to `to` (for AudioParam.setValueCurveAtTime). */
export function fadeCurve(from: number, to: number, steps = 32): Float32Array {
  const n = Math.max(2, Math.floor(steps));
  const curve = new Float32Array(n);
  const rising = to >= from;
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    const shape = rising ? equalPower(t).in : 1 - equalPower(t).out;
    curve[i] = from + (to - from) * shape;
  }
  curve[0] = from;
  curve[n - 1] = to;
  return curve;
}

/** Simple deterministic PRNG (mulberry32). Returns floats in [0, 1). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type Rng = () => number;

/** Random value in [lo, hi). */
export const range = (rng: Rng, lo: number, hi: number): number => lo + (hi - lo) * rng();
/** base * (1 ± amount), e.g. jitter(rng, 1000, 0.1) -> 900..1100. */
export const jitter = (rng: Rng, base: number, amount: number): number => base * (1 + (rng() * 2 - 1) * amount);
export const pick = <T>(rng: Rng, list: readonly T[]): T => list[Math.floor(rng() * list.length) % list.length];

/** ADSR-like envelope description, all times in seconds. */
export interface Envelope {
  /** Peak level (linear gain). */
  peak: number;
  attack: number;
  /** Time spent at peak before decaying. */
  hold?: number;
  /** Decay time from peak to sustain level. */
  decay?: number;
  /** Sustain level as fraction of peak (0..1). */
  sustain?: number;
  /** Time spent at sustain level. */
  sustainTime?: number;
  /** Release time to silence. */
  release: number;
}

export interface EnvPoint {
  t: number;
  v: number;
  /** How to approach this point from the previous one. */
  curve: 'set' | 'linear' | 'exp';
}

/** Silence floor used for exponential ramps (exp ramps cannot reach 0). */
export const SILENCE = 0.0001;

/**
 * Converts an envelope into absolute automation points starting at `start`.
 * The attack is linear (clean onsets), decays and release are exponential (natural tails).
 */
export function envelopePoints(env: Envelope, start: number): EnvPoint[] {
  const peak = Math.max(SILENCE, env.peak);
  const attack = Math.max(0.001, env.attack);
  const hold = Math.max(0, env.hold ?? 0);
  const decay = Math.max(0, env.decay ?? 0);
  const sustainLevel = Math.max(SILENCE, peak * clamp(env.sustain ?? 1, 0, 1));
  const sustainTime = Math.max(0, env.sustainTime ?? 0);
  const release = Math.max(0.005, env.release);
  const pts: EnvPoint[] = [{ t: start, v: SILENCE, curve: 'set' }];
  let t = start + attack;
  pts.push({ t, v: peak, curve: 'linear' });
  if (hold > 0) { t += hold; pts.push({ t, v: peak, curve: 'linear' }); }
  if (decay > 0) { t += decay; pts.push({ t, v: sustainLevel, curve: 'exp' }); }
  const level = decay > 0 ? sustainLevel : peak;
  if (sustainTime > 0) { t += sustainTime; pts.push({ t, v: level, curve: 'linear' }); }
  t += release;
  pts.push({ t, v: SILENCE, curve: 'exp' });
  return pts;
}

/** Total length of an envelope in seconds. */
export function envelopeDuration(env: Envelope): number {
  const pts = envelopePoints(env, 0);
  return pts[pts.length - 1].t;
}

/**
 * Throttles identical events: allow(key, now) returns false while the same key fired less than
 * `minMs` ago. Time is injected so it can be tested without timers.
 */
export class Throttle {
  private last = new Map<string, number>();
  constructor(private defaultMs = 45) {}
  allow(key: string, nowMs: number, minMs = this.defaultMs): boolean {
    const prev = this.last.get(key);
    if (prev !== undefined && nowMs - prev < minMs) return false;
    // per-caller keys (unit ids) could accumulate: forget everything older than 5 s now and then
    if (this.last.size > 256) for (const [k, t] of this.last) if (nowMs - t > 5000) this.last.delete(k);
    this.last.set(key, nowMs);
    return true;
  }
  reset(): void { this.last.clear(); }
}

/**
 * Counts overlapping voices so bursts of sounds cannot pile up into mush or clipping.
 * Each voice has a weight (a big layered effect costs more than a footstep) and an end time;
 * expired voices are dropped lazily. Reserve BEFORE scheduling, then set the real end time.
 */
export interface VoiceTicket { end: number; weight: number }

export class VoiceBudget {
  private voices: VoiceTicket[] = [];
  constructor(public readonly max = 28, public readonly headroom = 6) {}
  /** Sum of the weights of the voices still playing at `now`. */
  active(now: number): number {
    this.voices = this.voices.filter(v => v.end > now);
    let sum = 0;
    for (const v of this.voices) sum += v.weight;
    return sum;
  }
  /**
   * Reserves `weight` voices (provisionally until now + 1 s). Returns null when the budget is full;
   * important sounds may use a little headroom above the maximum.
   */
  reserve(now: number, weight = 1, important = false): VoiceTicket | null {
    const used = this.active(now);
    const limit = this.max + (important ? this.headroom : 0);
    if (used + weight > limit && used > 0) return null;
    const ticket = { end: now + 1, weight };
    this.voices.push(ticket);
    return ticket;
  }
  /** Shorthand: reserve and set the end time in one go. */
  take(now: number, end: number, important = false, weight = 1): boolean {
    const t = this.reserve(now, weight, important);
    if (t) t.end = end;
    return !!t;
  }
}

/**
 * How a "distance" option (0 near .. 1 far) colours a sound: darker, quieter and wetter.
 * cutoff is null when no filtering is needed.
 */
export function distanceParams(distance: number | undefined): { cutoff: number | null; gain: number; wet: number } {
  const d = clamp(Number.isFinite(distance) ? (distance as number) : 0, 0, 1);
  if (d < 0.01) return { cutoff: null, gain: 1, wet: 1 };
  return {
    cutoff: 12000 * Math.pow(900 / 12000, d),
    gain: dbToGain(-18 * d),
    wet: 1 + 2 * d,
  };
}

/** Throttle key for an effect: per name, optionally split per caller (e.g. unit id). */
export const throttleKey = (name: string, key?: string): string => (key ? `${name}:${key}` : name);

/**
 * Dialogue blip voicing: low voices get a second harmonic and a brighter filter so they survive on
 * phone and laptop speakers (which reproduce little below ~300 Hz).
 */
export function blipVoicing(freq: number, wave: OscillatorType): { peak: number; octave: number; lowpass: number } {
  const harsh = wave === 'square' || wave === 'sawtooth';
  const peak = harsh ? 0.075 : 0.14;
  const octave = freq < 250 ? (harsh ? 0.3 : 0.5) : 0;
  const lowpass = Math.min(5600, Math.max(freq * 3.5 + 500, freq < 250 ? 1600 : 0));
  return { peak, octave, lowpass };
}

/**
 * Gain for a sound effect given the user setting, call-site volume and an extra attenuation
 * applied when many voices already play (keeps the mix from getting louder and louder).
 */
export function sfxGain(callVolume: number | undefined, activeVoices: number): number {
  const v = clamp(callVolume ?? 1, 0, 2);
  const crowd = activeVoices <= 6 ? 1 : 1 / Math.sqrt(activeVoices / 6);
  return v * crowd;
}

/** Normalises a pitch option into a sane playback ratio. */
export const pitchRatio = (pitch: number | undefined): number => clamp(Number.isFinite(pitch) ? (pitch as number) : 1, 0.25, 4);
/** Normalises a pan option into -1..1. */
export const panValue = (pan: number | undefined): number => clamp(Number.isFinite(pan) ? (pan as number) : 0, -1, 1);
