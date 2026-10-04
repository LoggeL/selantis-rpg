/**
 * WebAudio building blocks for procedural sounds. Everything works on a BaseAudioContext, so the
 * same recipes render in real time and in an OfflineAudioContext (used for analysis in the demo).
 */
import { envelopePoints, type Envelope, type Rng, SILENCE } from './math';

/** Everything a recipe needs to schedule one sound. */
export interface Voice {
  ctx: BaseAudioContext;
  /** Dry output (already panned and volume scaled). */
  out: AudioNode;
  /** Reverb send input, or null when no reverb is available. */
  verb: AudioNode | null;
  rng: Rng;
  /** Pitch ratio requested by the caller (1 = as designed). */
  p: number;
  /** Start time in context seconds. */
  t: number;
}

export type NoiseKind = 'white' | 'pink' | 'brown';

const noiseCache = new WeakMap<BaseAudioContext, Partial<Record<NoiseKind, AudioBuffer>>>();

/** A 4 s mono noise buffer per context and colour, generated once. */
export function noiseBuffer(ctx: BaseAudioContext, kind: NoiseKind): AudioBuffer {
  let entry = noiseCache.get(ctx);
  if (!entry) noiseCache.set(ctx, (entry = {}));
  const cached = entry[kind];
  if (cached) return cached;
  const length = Math.floor(ctx.sampleRate * 4);
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  let seed = kind === 'white' ? 1 : kind === 'pink' ? 2 : 3;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 1073741823.5 - 1; };
  if (kind === 'white') {
    for (let i = 0; i < length; i++) data[i] = rnd() * 0.7;
  } else if (kind === 'pink') {
    // Paul Kellet's economy pink filter.
    let b0 = 0, b1 = 0, b2 = 0;
    for (let i = 0; i < length; i++) {
      const w = rnd();
      b0 = 0.99765 * b0 + w * 0.099046;
      b1 = 0.963 * b1 + w * 0.2965164;
      b2 = 0.57 * b2 + w * 1.0526913;
      data[i] = (b0 + b1 + b2 + w * 0.1848) * 0.2;
    }
  } else {
    let last = 0;
    for (let i = 0; i < length; i++) {
      last = (last + 0.02 * rnd()) / 1.02;
      data[i] = last * 3.2;
    }
  }
  // Short crossfade at the loop seam so looping sources do not click.
  const fade = Math.floor(ctx.sampleRate * 0.02);
  for (let i = 0; i < fade; i++) {
    const a = i / fade;
    data[length - fade + i] = data[length - fade + i] * (1 - a) + data[i] * a;
  }
  entry[kind] = buffer;
  return buffer;
}

const shaperCache = new WeakMap<BaseAudioContext, Map<number, Float32Array<ArrayBuffer>>>();

/** Soft-clip curve for warmth/grit. amount 0..1. */
export function softClipCurve(ctx: BaseAudioContext, amount: number): Float32Array<ArrayBuffer> {
  let map = shaperCache.get(ctx);
  if (!map) shaperCache.set(ctx, (map = new Map()));
  const key = Math.round(amount * 100);
  const cached = map.get(key);
  if (cached) return cached;
  const n = 1024;
  const curve = new Float32Array(new ArrayBuffer(n * 4));
  const k = 1 + amount * 12;
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1;
    curve[i] = Math.tanh(k * x) / Math.tanh(k);
  }
  map.set(key, curve);
  return curve;
}

/** Applies an envelope to a param. Returns the end time. */
export function applyEnv(param: AudioParam, env: Envelope, start: number, scale = 1): number {
  const pts = envelopePoints({ ...env, peak: env.peak * scale }, start);
  param.cancelScheduledValues(start);
  for (const pt of pts) {
    if (pt.curve === 'set') param.setValueAtTime(pt.v, pt.t);
    else if (pt.curve === 'linear') param.linearRampToValueAtTime(pt.v, pt.t);
    else param.exponentialRampToValueAtTime(Math.max(SILENCE, pt.v), pt.t);
  }
  return pts[pts.length - 1].t;
}

export interface FilterSpec {
  type: BiquadFilterType;
  freq: number;
  /** Target frequency (exponential sweep). */
  to?: number;
  /** Sweep duration, defaults to the sound length. */
  time?: number;
  /** Optional mid point: sweep freq -> peakFreq (at peakAt) -> to. */
  via?: number;
  viaAt?: number;
  q?: number;
  gain?: number;
}

/** Builds a biquad with optional exponential frequency sweep (frequencies scaled by pitch ratio). */
export function filter(v: Voice, spec: FilterSpec, start: number, length: number, scale = v.p): BiquadFilterNode {
  const f = v.ctx.createBiquadFilter();
  f.type = spec.type;
  const nyq = v.ctx.sampleRate * 0.45;
  const fq = (x: number) => Math.min(nyq, Math.max(20, x * scale));
  f.frequency.setValueAtTime(fq(spec.freq), start);
  if (spec.via !== undefined) {
    const at = start + (spec.viaAt ?? (spec.time ?? length) * 0.5);
    f.frequency.exponentialRampToValueAtTime(fq(spec.via), at);
  }
  if (spec.to !== undefined) f.frequency.exponentialRampToValueAtTime(fq(spec.to), start + (spec.time ?? length));
  if (spec.q !== undefined) f.Q.value = spec.q;
  if (spec.gain !== undefined) f.gain.value = spec.gain;
  return f;
}

/** Connects `node` to the voice's dry output and (optionally) the reverb send. */
export function route(v: Voice, node: AudioNode, wet = 0, pan?: number, dest?: AudioNode): void {
  let target: AudioNode = node;
  if (pan !== undefined && pan !== 0) {
    const p = v.ctx.createStereoPanner();
    p.pan.value = Math.max(-1, Math.min(1, pan));
    node.connect(p);
    target = p;
  }
  target.connect(dest ?? v.out);
  if (wet > 0 && v.verb) {
    const send = v.ctx.createGain();
    send.gain.value = wet;
    target.connect(send);
    send.connect(v.verb);
  }
}

export interface ToneSpec {
  type?: OscillatorType;
  freq: number;
  /** Glide target frequency. */
  to?: number;
  glide?: number;
  glideCurve?: 'exp' | 'linear';
  detune?: number;
  env: Envelope;
  at?: number;
  wet?: number;
  pan?: number;
  filter?: FilterSpec;
  /** Vibrato: rate in Hz, depth in cents, delay in s. */
  vibrato?: { rate: number; depth: number; delay?: number };
  /** Tremolo (amplitude modulation): rate in Hz, depth 0..1. */
  tremolo?: { rate: number; depth: number };
  shape?: number;
  dest?: AudioNode;
}

/** One oscillator through an envelope. Returns the end time. */
export function tone(v: Voice, s: ToneSpec): number {
  const ctx = v.ctx;
  const start = v.t + (s.at ?? 0);
  const osc = ctx.createOscillator();
  osc.type = s.type ?? 'sine';
  const nyq = ctx.sampleRate * 0.45;
  const f0 = Math.min(nyq, s.freq * v.p);
  osc.frequency.setValueAtTime(f0, start);
  if (s.to !== undefined) {
    const f1 = Math.min(nyq, Math.max(10, s.to * v.p));
    const end = start + (s.glide ?? 0.1);
    if (s.glideCurve === 'linear') osc.frequency.linearRampToValueAtTime(f1, end);
    else osc.frequency.exponentialRampToValueAtTime(f1, end);
  }
  if (s.detune) osc.detune.value = s.detune;
  const amp = ctx.createGain();
  const end = applyEnv(amp.gain, s.env, start);
  let head: AudioNode = osc;
  if (s.shape) {
    const ws = ctx.createWaveShaper();
    ws.curve = softClipCurve(ctx, s.shape);
    head.connect(ws);
    head = ws;
  }
  if (s.filter) {
    const f = filter(v, s.filter, start, end - start);
    head.connect(f);
    head = f;
  }
  head.connect(amp);
  if (s.vibrato) {
    const lfo = ctx.createOscillator();
    lfo.frequency.value = s.vibrato.rate;
    const depth = ctx.createGain();
    depth.gain.setValueAtTime(0, start);
    depth.gain.linearRampToValueAtTime(s.vibrato.depth, start + (s.vibrato.delay ?? 0.05) + 0.001);
    lfo.connect(depth).connect(osc.detune);
    lfo.start(start);
    lfo.stop(end + 0.05);
  }
  let out: AudioNode = amp;
  if (s.tremolo) {
    const trem = ctx.createGain();
    trem.gain.value = 1 - s.tremolo.depth / 2;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = s.tremolo.rate;
    const depth = ctx.createGain();
    depth.gain.value = s.tremolo.depth / 2;
    lfo.connect(depth).connect(trem.gain);
    lfo.start(start);
    lfo.stop(end + 0.05);
    amp.connect(trem);
    out = trem;
  }
  route(v, out, s.wet ?? 0, s.pan, s.dest);
  osc.start(start);
  osc.stop(end + 0.05);
  return end;
}

export interface NoiseSpec {
  kind?: NoiseKind;
  env: Envelope;
  filter?: FilterSpec;
  filter2?: FilterSpec;
  at?: number;
  wet?: number;
  pan?: number;
  rate?: number;
  shape?: number;
  dest?: AudioNode;
  /** Scale filter frequencies with the voice pitch (default true). */
  pitched?: boolean;
}

/** Filtered noise through an envelope. Returns the end time. */
export function noise(v: Voice, s: NoiseSpec): number {
  const ctx = v.ctx;
  const start = v.t + (s.at ?? 0);
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(ctx, s.kind ?? 'white');
  src.loop = true;
  src.playbackRate.value = s.rate ?? 1;
  const amp = ctx.createGain();
  const end = applyEnv(amp.gain, s.env, start);
  const scale = s.pitched === false ? 1 : v.p;
  let head: AudioNode = src;
  if (s.filter) { const f = filter(v, s.filter, start, end - start, scale); head.connect(f); head = f; }
  if (s.filter2) { const f = filter(v, s.filter2, start, end - start, scale); head.connect(f); head = f; }
  if (s.shape) {
    const ws = ctx.createWaveShaper();
    ws.curve = softClipCurve(ctx, s.shape);
    head.connect(ws);
    head = ws;
  }
  head.connect(amp);
  route(v, amp, s.wet ?? 0, s.pan, s.dest);
  // Random offset into the buffer so repeated noises never sound identical.
  src.start(start, v.rng() * 3);
  src.stop(end + 0.05);
  return end;
}

export interface BellSpec {
  freq: number;
  /** Partial ratios and relative amplitudes. */
  ratios?: number[];
  amps?: number[];
  /** Decay of the fundamental in seconds; higher partials decay faster. */
  decay: number;
  peak: number;
  at?: number;
  wet?: number;
  pan?: number;
  attack?: number;
  detune?: number;
  dest?: AudioNode;
}

/** Soft, glassy bell built from additive sine partials. */
export const BELL_GLASS = { ratios: [1, 2.0, 3.0, 4.2, 5.4], amps: [1, 0.35, 0.18, 0.08, 0.04] };
/** Inharmonic struck-metal partials. */
export const BELL_METAL = { ratios: [1, 2.76, 5.4, 8.93], amps: [1, 0.5, 0.25, 0.12] };
/** Warm music-box/celesta partials. */
export const BELL_CELESTA = { ratios: [1, 2, 3.98, 6.1], amps: [1, 0.22, 0.08, 0.025] };

export function bell(v: Voice, s: BellSpec): number {
  const ratios = s.ratios ?? BELL_GLASS.ratios;
  const amps = s.amps ?? BELL_GLASS.amps;
  let end = 0;
  ratios.forEach((r, i) => {
    const a = amps[i] ?? 0.05;
    if (s.freq * r * v.p > v.ctx.sampleRate * 0.45) return;
    end = Math.max(end, tone(v, {
      type: 'sine', freq: s.freq * r, at: s.at, wet: s.wet, pan: s.pan, dest: s.dest,
      detune: (s.detune ?? 0) * (i % 2 === 0 ? 1 : -1),
      env: { peak: s.peak * a, attack: s.attack ?? 0.003, release: s.decay / (1 + i * 0.6) },
    }));
  });
  return end;
}

/** A gain node that sums several parts and feeds the voice output; handy for group envelopes. */
export function bus(v: Voice, gain = 1, wet = 0, pan?: number): GainNode {
  const g = v.ctx.createGain();
  g.gain.value = gain;
  route(v, g, wet, pan);
  return g;
}

/** Copy of a voice that starts `dt` seconds later (and optionally with a different pitch). */
export const later = (v: Voice, dt: number, p = v.p): Voice => ({ ...v, t: v.t + dt, p });

/** Copy of a voice writing into another destination node. */
export const into = (v: Voice, out: AudioNode): Voice => ({ ...v, out });
