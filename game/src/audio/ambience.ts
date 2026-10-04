/**
 * Procedural ambience layers. A layer is a set of generators: continuous filtered-noise beds plus
 * event schedulers (chirps, crackles, owls, thunder). Generators schedule ahead with tick(until),
 * which works in real time (called every ~120 ms) and offline (called once for the whole render).
 */
import type { AmbienceLayer, LightningEvent } from './api';
import { jitter, range, type Rng } from './math';
import { creak, SFX } from './sfx';
import { BELL_METAL, bell, noise, noiseBuffer, tone, type NoiseKind, type Voice } from './synth';

export interface Generator {
  /** Schedule events up to `until` (context seconds). `now` is the current context time. */
  tick(until: number, now: number): void;
  /** Stops all sources at time `at`. */
  stop(at: number): void;
}

export interface LayerEnv {
  ctx: BaseAudioContext;
  out: AudioNode;
  verb: AudioNode | null;
  rng: Rng;
  start: number;
  /** Real-time only: emits world events (e.g. 'audio:lightning'); absent in offline renders. */
  emit?: (event: string, payload: unknown) => void;
}

const voiceAt = (e: LayerEnv, t: number, out: AudioNode = e.out): Voice => ({ ctx: e.ctx, out, verb: e.verb, rng: e.rng, p: 1, t });

/** Calls fire(t) at random intervals. Skips backlog if the scheduler was starved (background tab). */
function every(e: LayerEnv, interval: () => number, fire: (t: number) => void, firstDelay = interval()): Generator {
  let next = e.start + firstDelay;
  let stopped = false;
  return {
    tick(until, now) {
      if (stopped) return;
      if (next < now - 0.25) next = now + 0.05 + e.rng() * 0.3;
      while (next < until) { fire(next); next += Math.max(0.01, interval()); }
    },
    stop() { stopped = true; },
  };
}

interface BedSpec {
  kind: NoiseKind;
  gain: number;
  pan?: number;
  filters: { type: BiquadFilterType; freq: number; q?: number; lfo?: { rate: number; depth: number } }[];
  /** Slow amplitude modulation: rate Hz, depth as fraction of gain. */
  swell?: { rate: number; depth: number };
  rate?: number;
}

/** Continuous looping noise bed with optional filter/amplitude LFOs. */
function bed(e: LayerEnv, s: BedSpec): Generator {
  const { ctx } = e;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(ctx, s.kind);
  src.loop = true;
  src.playbackRate.value = s.rate ?? 1;
  const sources: AudioScheduledSourceNode[] = [src];
  let head: AudioNode = src;
  for (const f of s.filters) {
    const bq = ctx.createBiquadFilter();
    bq.type = f.type;
    bq.frequency.value = f.freq;
    if (f.q !== undefined) bq.Q.value = f.q;
    if (f.lfo) {
      const lfo = ctx.createOscillator();
      lfo.frequency.value = f.lfo.rate * jitter(e.rng, 1, 0.2);
      const d = ctx.createGain();
      d.gain.value = f.lfo.depth;
      lfo.connect(d).connect(bq.frequency);
      lfo.start(e.start + e.rng());
      sources.push(lfo);
    }
    head.connect(bq);
    head = bq;
  }
  const g = ctx.createGain();
  g.gain.value = s.gain;
  if (s.swell) {
    const lfo = ctx.createOscillator();
    lfo.frequency.value = s.swell.rate * jitter(e.rng, 1, 0.2);
    const d = ctx.createGain();
    d.gain.value = s.gain * s.swell.depth;
    lfo.connect(d).connect(g.gain);
    lfo.start(e.start);
    sources.push(lfo);
  }
  head.connect(g);
  if (s.pan) {
    const p = ctx.createStereoPanner();
    p.pan.value = s.pan;
    g.connect(p).connect(e.out);
  } else g.connect(e.out);
  src.start(e.start, e.rng() * 3.5);
  return {
    tick() { /* continuous */ },
    stop(at) { for (const n of sources) { try { n.stop(at); } catch { /* already stopped */ } } },
  };
}

// ---------------------------------------------------------------- building blocks

function wind(e: LayerEnv, intensity = 1): Generator[] {
  const k = intensity;
  return [
    bed(e, { kind: 'pink', gain: 0.2 * k, pan: -0.45, filters: [{ type: 'bandpass', freq: 520, q: 0.8, lfo: { rate: 0.05, depth: 260 } }, { type: 'lowpass', freq: 1400 }], swell: { rate: 0.09, depth: 0.6 } }),
    bed(e, { kind: 'pink', gain: 0.2 * k, pan: 0.45, filters: [{ type: 'bandpass', freq: 700, q: 0.8, lfo: { rate: 0.07, depth: 320 } }, { type: 'lowpass', freq: 1600 }], swell: { rate: 0.11, depth: 0.6 } }),
    bed(e, { kind: 'brown', gain: 0.22 * k, filters: [{ type: 'lowpass', freq: 260 }], swell: { rate: 0.06, depth: 0.5 } }),
    // gusts: broad swells that sweep through the trees
    every(e, () => range(e.rng, 4, 10), t => {
      const len = range(e.rng, 1.8, 3.5);
      noise(voiceAt(e, t), {
        kind: 'pink', pan: range(e.rng, -0.6, 0.6),
        filter: { type: 'bandpass', freq: range(e.rng, 300, 500), via: range(e.rng, 900, 1600), viaAt: len * 0.5, to: 400, time: len, q: 1.1 },
        filter2: { type: 'lowpass', freq: 2200 },
        env: { peak: 0.2 * k, attack: len * 0.45, release: len * 0.55 },
      });
    }, range(e.rng, 1, 4)),
  ];
}

type BirdSong = (v: Voice, peak: number) => void;

const tweet: BirdSong = (v, peak) => {
  const n = 2 + Math.floor(v.rng() * 3);
  const f = range(v.rng, 3000, 4200);
  for (let i = 0; i < n; i++) {
    tone(v, { at: i * 0.09, freq: f, to: f * 1.35, glide: 0.045, env: { peak, attack: 0.006, release: 0.05 }, wet: 0.25 });
  }
};
const trill: BirdSong = (v, peak) => {
  const f = range(v.rng, 4300, 5200);
  tone(v, { freq: f, to: f * 0.85, glide: 0.45, env: { peak, attack: 0.03, sustainTime: 0.25, release: 0.12 }, tremolo: { rate: range(v.rng, 22, 30), depth: 1 }, wet: 0.25 });
};
const warble: BirdSong = (v, peak) => {
  const n = 4 + Math.floor(v.rng() * 4);
  let t = 0;
  for (let i = 0; i < n; i++) {
    const a = range(v.rng, 2400, 4600);
    const len = range(v.rng, 0.05, 0.09);
    tone(v, { at: t, freq: a, to: a * range(v.rng, 0.75, 1.3), glide: len, env: { peak: peak * range(v.rng, 0.6, 1), attack: 0.008, release: len }, wet: 0.25 });
    t += len + range(v.rng, 0.01, 0.04);
  }
};
const chiff: BirdSong = (v, peak) => {
  // "zi-zi-zi-düü": three short high notes and a lower longer one (great tit-like)
  const f = range(v.rng, 5000, 6000);
  for (let i = 0; i < 3; i++) tone(v, { at: i * 0.11, freq: f, to: f * 0.9, glide: 0.03, env: { peak: peak * 0.7, attack: 0.004, release: 0.03 }, wet: 0.25 });
  tone(v, { at: 0.33, freq: f * 0.55, to: f * 0.5, glide: 0.12, env: { peak, attack: 0.01, release: 0.14 }, wet: 0.25 });
};

function birds(e: LayerEnv): Generator[] {
  const songs = [tweet, trill, warble, chiff];
  return [every(e, () => range(e.rng, 0.7, 3.2), t => {
    const song = songs[Math.floor(e.rng() * songs.length)];
    const pan = range(e.rng, -0.85, 0.85);
    const panner = e.ctx.createStereoPanner();
    panner.pan.value = pan;
    panner.connect(e.out);
    const peak = range(e.rng, 0.05, 0.12);
    song(voiceAt(e, t, panner), peak);
    // sometimes a neighbour answers from the other side
    if (e.rng() < 0.3) {
      const answer = e.ctx.createStereoPanner();
      answer.pan.value = -pan * 0.8;
      answer.connect(e.out);
      song(voiceAt(e, t + range(e.rng, 0.6, 1.2), answer), peak * 0.7);
    }
  }, range(e.rng, 0.2, 1))];
}

/** Crickets: a few individual insects with their own pitch, rhythm and position. */
function crickets(e: LayerEnv, count = 3, level = 1): Generator[] {
  const gens: Generator[] = [];
  for (let c = 0; c < count; c++) {
    const osc = e.ctx.createOscillator();
    osc.frequency.value = range(e.rng, 4200, 4900);
    const harm = e.ctx.createOscillator();
    harm.frequency.value = osc.frequency.value * 2;
    const hg = e.ctx.createGain();
    hg.gain.value = 0.15;
    const amp = e.ctx.createGain();
    amp.gain.value = 0;
    const pan = e.ctx.createStereoPanner();
    pan.pan.value = range(e.rng, -0.8, 0.8);
    osc.connect(amp);
    harm.connect(hg).connect(amp);
    amp.connect(pan).connect(e.out);
    osc.start(e.start);
    harm.start(e.start);
    const peak = range(e.rng, 0.022, 0.045) * level;
    const pulses = 2 + Math.floor(e.rng() * 3);
    const period = range(e.rng, 0.42, 0.7);
    const sched = every(e, () => period * jitter(e.rng, 1, 0.08) + (e.rng() < 0.08 ? range(e.rng, 0.8, 2.5) : 0), t => {
      for (let i = 0; i < pulses; i++) {
        const p0 = t + i * 0.042;
        amp.gain.setValueAtTime(0, p0);
        amp.gain.linearRampToValueAtTime(peak, p0 + 0.006);
        amp.gain.linearRampToValueAtTime(peak * 0.6, p0 + 0.018);
        amp.gain.linearRampToValueAtTime(0, p0 + 0.026);
      }
    }, range(e.rng, 0, 0.6));
    gens.push({ tick: sched.tick, stop(at) { sched.stop(at); try { osc.stop(at); harm.stop(at); } catch { /* ignore */ } } });
  }
  return gens;
}

function rain(e: LayerEnv, intensity = 1): Generator[] {
  const k = intensity;
  return [
    // the wash of rain is kept low so footsteps and dialogue stay on top; the drops carry the detail
    bed(e, { kind: 'pink', gain: 0.1 * k, pan: -0.3, filters: [{ type: 'highpass', freq: 450 }, { type: 'lowpass', freq: 5500 + 1500 * (k - 1) }], swell: { rate: 0.07, depth: 0.25 } }),
    bed(e, { kind: 'pink', gain: 0.1 * k, pan: 0.3, rate: 0.93, filters: [{ type: 'highpass', freq: 500 }, { type: 'lowpass', freq: 6000 + 1500 * (k - 1) }], swell: { rate: 0.05, depth: 0.25 } }),
    bed(e, { kind: 'brown', gain: 0.09 * k, filters: [{ type: 'lowpass', freq: 500 }] }),
    // individual drops on leaves and puddles
    every(e, () => range(e.rng, 0.03, 0.12) / k, t => {
      noise(voiceAt(e, t), {
        kind: 'white', pan: range(e.rng, -0.9, 0.9),
        filter: { type: 'bandpass', freq: range(e.rng, 2000, 6500), q: range(e.rng, 2, 6) },
        env: { peak: range(e.rng, 0.015, 0.05) * k, attack: 0.001, release: range(e.rng, 0.01, 0.03) },
      });
    }),
    every(e, () => range(e.rng, 0.25, 1.1), t => {
      tone(voiceAt(e, t), { freq: range(e.rng, 1300, 2000), to: range(e.rng, 2400, 3200), glide: 0.03, env: { peak: range(e.rng, 0.01, 0.025), attack: 0.002, release: 0.04 }, pan: range(e.rng, -0.7, 0.7) });
    }),
  ];
}

/**
 * Thunder with lightning sync: at each strike the flash is announced first ('audio:lightning'),
 * the thunder follows after a distance-dependent delay (near 0.1-0.3 s, far 1.5-3 s).
 */
function thunderRolls(e: LayerEnv): Generator {
  return every(e, () => range(e.rng, 11, 26), flashAt => {
    const near = e.rng() < 0.35;
    const delay = near ? range(e.rng, 0.1, 0.3) : range(e.rng, 1.5, 3);
    if (e.emit) {
      const emit = e.emit;
      const payload: LightningEvent = { near, delayMs: Math.round(delay * 1000), strength: near ? range(e.rng, 0.75, 1) : range(e.rng, 0.3, 0.6) };
      const ms = Math.max(0, (flashAt - e.ctx.currentTime) * 1000);
      setTimeout(() => emit('audio:lightning', payload), ms);
    }
    const g = e.ctx.createGain();
    g.gain.value = near ? 0.75 : 0.4;
    const pan = e.ctx.createStereoPanner();
    pan.pan.value = range(e.rng, -0.6, 0.6);
    if (near) g.connect(pan);
    else {
      const lp = e.ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 700;
      g.connect(lp).connect(pan);
    }
    pan.connect(e.out);
    SFX.thunder(voiceAt(e, flashAt + delay, g));
  }, range(e.rng, 3, 7));
}

function fire(e: LayerEnv, intensity = 1): Generator[] {
  const k = intensity;
  return [
    // low, soft roar and the breathing of the flames
    bed(e, { kind: 'brown', gain: 0.07 * k, filters: [{ type: 'lowpass', freq: 320, lfo: { rate: 0.3, depth: 100 } }], swell: { rate: 0.4, depth: 0.35 } }),
    bed(e, { kind: 'pink', gain: 0.05 * k, filters: [{ type: 'bandpass', freq: 650, q: 0.7, lfo: { rate: 0.23, depth: 200 } }], swell: { rate: 0.55, depth: 0.6 } }),
    bed(e, { kind: 'white', gain: 0.018 * k, filters: [{ type: 'bandpass', freq: 3600, q: 0.6 }], swell: { rate: 0.7, depth: 0.5 } }),
    // crackles come in little clusters
    every(e, () => (e.rng() < 0.25 ? range(e.rng, 0.3, 0.7) : range(e.rng, 0.03, 0.2)), t => {
      const n = 1 + Math.floor(e.rng() * 4);
      for (let i = 0; i < n; i++) {
        noise(voiceAt(e, t + i * range(e.rng, 0.006, 0.035)), {
          kind: 'white', pan: range(e.rng, -0.3, 0.3),
          filter: { type: 'bandpass', freq: range(e.rng, 1200, 6000), q: range(e.rng, 0.8, 3) },
          env: { peak: range(e.rng, 0.12, 0.55) * k, attack: 0.0008, release: range(e.rng, 0.004, 0.018) },
        });
      }
    }),
    // occasional pop of resin
    every(e, () => range(e.rng, 0.9, 3.2), t => {
      const v = voiceAt(e, t);
      noise(v, { kind: 'white', filter: { type: 'bandpass', freq: range(e.rng, 900, 2400), q: 1.5 }, env: { peak: 0.7 * k, attack: 0.0008, release: 0.025 }, pan: range(e.rng, -0.3, 0.3) });
      tone(v, { freq: range(e.rng, 220, 360), to: 100, glide: 0.04, env: { peak: 0.12 * k, attack: 0.001, release: 0.04 } });
    }),
  ];
}

/** Murmuring voices: band-passed noise shaped into syllables with shifting vowels. */
function talker(e: LayerEnv, out: AudioNode): Generator {
  const { ctx } = e;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(ctx, 'pink');
  src.loop = true;
  const male = e.rng() < 0.6;
  const f1 = ctx.createBiquadFilter(); f1.type = 'bandpass'; f1.Q.value = 4;
  const f2 = ctx.createBiquadFilter(); f2.type = 'bandpass'; f2.Q.value = 6;
  const g2 = ctx.createGain(); g2.gain.value = 0.5;
  const amp = ctx.createGain(); amp.gain.value = 0;
  const pan = ctx.createStereoPanner(); pan.pan.value = range(e.rng, -0.8, 0.8);
  src.connect(f1).connect(amp);
  src.connect(f2).connect(g2).connect(amp);
  amp.connect(pan).connect(out);
  src.start(e.start, e.rng() * 3);
  const vowels = male
    ? [[650, 1100], [400, 1700], [300, 2100], [500, 900], [350, 800]]
    : [[800, 1300], [480, 2000], [350, 2500], [600, 1100], [420, 950]];
  const level = range(e.rng, 0.35, 0.7);
  let next = e.start + range(e.rng, 0, 0.6);
  let left = 0;
  let stopped = false;
  return {
    tick(until, now) {
      if (stopped) return;
      if (next < now - 0.25) next = now + 0.1;
      while (next < until) {
        if (left <= 0) { left = 3 + Math.floor(e.rng() * 10); next += range(e.rng, 0.4, 2.2); continue; }
        const len = range(e.rng, 0.07, 0.19);
        const [a, b] = vowels[Math.floor(e.rng() * vowels.length)];
        f1.frequency.setValueAtTime(a, next);
        f2.frequency.setValueAtTime(b, next);
        const peak = level * range(e.rng, 0.5, 1);
        amp.gain.setValueAtTime(0, next);
        amp.gain.linearRampToValueAtTime(peak, next + len * 0.3);
        amp.gain.linearRampToValueAtTime(peak * 0.7, next + len * 0.7);
        amp.gain.linearRampToValueAtTime(0, next + len);
        next += len + range(e.rng, 0.01, 0.06);
        left--;
      }
    },
    stop(at) { stopped = true; try { src.stop(at); } catch { /* ignore */ } },
  };
}

function tavern(e: LayerEnv): Generator[] {
  // the room: everything goes through a muffling lowpass and plenty of reverb
  const room = e.ctx.createBiquadFilter();
  room.type = 'lowpass';
  room.frequency.value = 2200;
  const roomGain = e.ctx.createGain();
  roomGain.gain.value = 0.5;
  room.connect(roomGain).connect(e.out);
  if (e.verb) { const s = e.ctx.createGain(); s.gain.value = 0.25; roomGain.connect(s).connect(e.verb); }
  const gens: Generator[] = [];
  for (let i = 0; i < 6; i++) gens.push(talker(e, room));
  gens.push(bed(e, { kind: 'brown', gain: 0.035, filters: [{ type: 'lowpass', freq: 300 }] }));
  // mug clinks
  gens.push(every(e, () => range(e.rng, 2, 7), t => {
    const v = voiceAt(e, t);
    const f = range(e.rng, 1700, 2600);
    bell(v, { ...BELL_METAL, freq: f, peak: 0.035, decay: 0.25, wet: 0.3, pan: range(e.rng, -0.7, 0.7) });
    if (e.rng() < 0.5) bell({ ...v, t: t + range(e.rng, 0.05, 0.12) }, { ...BELL_METAL, freq: f * 1.12, peak: 0.025, decay: 0.2, wet: 0.3 });
  }));
  // a laugh now and then
  gens.push(every(e, () => range(e.rng, 6, 14), t => {
    const v = voiceAt(e, t, room);
    const n = 4 + Math.floor(e.rng() * 3);
    const f = range(e.rng, 180, 260);
    for (let i = 0; i < n; i++) {
      tone(v, { at: i * 0.14, type: 'sawtooth', freq: f * (1 - i * 0.03), to: f * 0.9, glide: 0.08, env: { peak: 0.1 * (1 - i * 0.12), attack: 0.015, release: 0.09 }, filter: { type: 'bandpass', freq: 800, q: 2 } });
    }
  }, range(e.rng, 3, 8)));
  // a chair scrape
  gens.push(every(e, () => range(e.rng, 9, 20), t => {
    noise(voiceAt(e, t, room), { kind: 'white', filter: { type: 'bandpass', freq: 700, to: 1100, q: 6 }, env: { peak: 0.25, attack: 0.03, sustainTime: 0.15, release: 0.1 } });
  }, range(e.rng, 5, 12)));
  return gens;
}

function stream(e: LayerEnv): Generator[] {
  return [
    bed(e, { kind: 'white', gain: 0.07, pan: -0.25, filters: [{ type: 'bandpass', freq: 900, q: 0.7, lfo: { rate: 0.13, depth: 250 } }] }),
    bed(e, { kind: 'white', gain: 0.06, pan: 0.25, filters: [{ type: 'bandpass', freq: 1400, q: 0.8, lfo: { rate: 0.17, depth: 300 } }] }),
    bed(e, { kind: 'pink', gain: 0.07, filters: [{ type: 'lowpass', freq: 450 }] }),
    bed(e, { kind: 'white', gain: 0.012, filters: [{ type: 'highpass', freq: 4000 }], swell: { rate: 0.4, depth: 0.5 } }),
    // bubbles and gurgles
    every(e, () => range(e.rng, 0.03, 0.16), t => {
      const f = range(e.rng, 450, 1500);
      tone(voiceAt(e, t), { freq: f, to: f * range(e.rng, 1.3, 2.2), glide: range(e.rng, 0.02, 0.05), env: { peak: range(e.rng, 0.012, 0.035), attack: 0.003, release: range(e.rng, 0.02, 0.05) }, pan: range(e.rng, -0.5, 0.5) });
    }),
  ];
}

function owls(e: LayerEnv): Generator {
  return every(e, () => range(e.rng, 8, 18), t => {
    const pan = range(e.rng, -0.8, 0.8);
    const f = range(e.rng, 340, 400);
    const hoot = (at: number, len: number, peak: number) => {
      tone(voiceAt(e, t + at), { freq: f * 1.04, to: f * 0.94, glide: len, env: { peak, attack: 0.06, sustainTime: len * 0.4, release: len * 0.5 }, filter: { type: 'lowpass', freq: 900 }, wet: 0.45, pan, vibrato: { rate: 5, depth: 8 } });
      tone(voiceAt(e, t + at), { type: 'triangle', freq: f * 2.08, to: f * 1.9, glide: len, env: { peak: peak * 0.12, attack: 0.06, release: len }, wet: 0.45, pan });
    };
    // "huuu ... hu-hu-huuu"
    hoot(0, 0.5, 0.06);
    hoot(0.95, 0.12, 0.04);
    hoot(1.15, 0.12, 0.045);
    hoot(1.35, 0.55, 0.05);
  }, range(e.rng, 2, 5));
}

function night(e: LayerEnv): Generator[] {
  return [
    ...wind(e, 0.22),
    ...crickets(e, 3, 1),
    owls(e),
    // high insect shimmer
    bed(e, { kind: 'white', gain: 0.006, filters: [{ type: 'bandpass', freq: 7000, q: 3 }], swell: { rate: 0.3, depth: 0.6 } }),
  ];
}

function camp(e: LayerEnv): Generator[] {
  return [...fire(e, 0.75), ...crickets(e, 2, 0.8), ...wind(e, 0.25)];
}

function storm(e: LayerEnv): Generator[] {
  // Rain and wind beds sit under their own gain so the storm stays below dialogue and footsteps;
  // the thunder keeps its full level.
  const beds = e.ctx.createGain();
  beds.gain.value = 0.6;
  beds.connect(e.out);
  const be: LayerEnv = { ...e, out: beds };
  return [...rain(be, 1.45), ...wind(be, 0.5), thunderRolls(e)];
}

// ---------------------------------------------------------------- polish pass layers

/** Distant battle: everything heard through a dark lowpass and lots of reverb. */
function battleFar(e: LayerEnv): Generator[] {
  const lp = e.ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 1400;
  lp.connect(e.out);
  const far: LayerEnv = { ...e, out: lp };
  const panned = (pan: number) => { const p = e.ctx.createStereoPanner(); p.pan.value = pan; p.connect(lp); return p; };
  return [
    // the rumble of many feet and the roar of the crowd
    bed(far, { kind: 'brown', gain: 0.14, filters: [{ type: 'lowpass', freq: 200 }], swell: { rate: 0.08, depth: 0.4 } }),
    bed(far, { kind: 'pink', gain: 0.05, filters: [{ type: 'bandpass', freq: 520, q: 0.7, lfo: { rate: 0.11, depth: 150 } }], swell: { rate: 0.17, depth: 0.7 } }),
    // clashing steel, often in quick exchanges
    every(far, () => range(e.rng, 0.2, 1.1), t => {
      const n = e.rng() < 0.35 ? 2 + Math.floor(e.rng() * 2) : 1;
      const out = panned(range(e.rng, -0.8, 0.8));
      for (let i = 0; i < n; i++) {
        const v = voiceAt(far, t + i * range(e.rng, 0.12, 0.22), out);
        bell(v, { ...BELL_METAL, freq: range(e.rng, 1300, 2800), peak: range(e.rng, 0.04, 0.1), decay: range(e.rng, 0.15, 0.35), wet: 0.6 });
        noise(v, { kind: 'white', filter: { type: 'bandpass', freq: 1200, q: 1.5 }, env: { peak: 0.06, attack: 0.001, release: 0.02 }, wet: 0.5 });
      }
    }),
    // shouts and battle cries
    every(far, () => range(e.rng, 1.2, 4.5), t => {
      const f = range(e.rng, 170, 320);
      const len = range(e.rng, 0.3, 0.8);
      const v = voiceAt(far, t, panned(range(e.rng, -0.8, 0.8)));
      tone(v, {
        type: 'sawtooth', freq: f, to: f * range(e.rng, 0.75, 1.15), glide: len, env: { peak: range(e.rng, 0.03, 0.07), attack: 0.05, sustainTime: len * 0.5, release: len * 0.5 },
        filter: { type: 'bandpass', freq: range(e.rng, 650, 1000), q: 2.5 }, vibrato: { rate: 6, depth: 25 }, wet: 0.7,
      });
    }, range(e.rng, 0.5, 2)),
    // war drums: short patterns
    every(far, () => range(e.rng, 4, 9), t => {
      const hits = 3 + Math.floor(e.rng() * 3);
      const gap = range(e.rng, 0.38, 0.5);
      for (let i = 0; i < hits; i++) {
        const v = voiceAt(far, t + i * gap);
        const accent = i === 0 || i === hits - 1 ? 1 : 0.7;
        tone(v, { freq: 72, to: 48, glide: 0.15, env: { peak: 0.22 * accent, attack: 0.003, release: 0.3 }, wet: 0.6, shape: 0.2 });
        noise(v, { kind: 'pink', filter: { type: 'bandpass', freq: 500, q: 1 }, env: { peak: 0.08 * accent, attack: 0.002, release: 0.08 }, wet: 0.6 });
      }
    }, range(e.rng, 1, 3)),
    // a horn call far away now and then
    every(far, () => range(e.rng, 10, 20), t => {
      const v = voiceAt(far, t, panned(range(e.rng, -0.5, 0.5)));
      const f = range(e.rng, 196, 233);
      for (const d of [-6, 6]) {
        tone(v, { type: 'sawtooth', freq: f, detune: d, env: { peak: 0.035, attack: 0.25, sustainTime: 0.9, release: 0.6 }, filter: { type: 'lowpass', freq: 900 }, vibrato: { rate: 4.5, depth: 10, delay: 0.4 }, wet: 0.8 });
      }
    }, range(e.rng, 4, 9)),
  ];
}

/** Quiet room: low room tone, a candle's hiss and flicker, the house creaking now and then. */
function room(e: LayerEnv): Generator[] {
  return [
    bed(e, { kind: 'brown', gain: 0.06, filters: [{ type: 'lowpass', freq: 170 }] }),
    bed(e, { kind: 'pink', gain: 0.012, filters: [{ type: 'bandpass', freq: 420, q: 0.5 }] }),
    // candle hiss with a flickering swell
    bed(e, { kind: 'white', gain: 0.006, filters: [{ type: 'bandpass', freq: 4200, q: 0.9 }], swell: { rate: 0.9, depth: 0.8 } }),
    every(e, () => range(e.rng, 0.4, 1.8), t => {
      noise(voiceAt(e, t), { kind: 'pink', filter: { type: 'bandpass', freq: range(e.rng, 600, 1100), q: 1 }, env: { peak: range(e.rng, 0.012, 0.03), attack: 0.02, release: range(e.rng, 0.05, 0.12) }, pan: 0.15 });
    }),
    // timber creaks
    every(e, () => range(e.rng, 7, 18), t => {
      creak(voiceAt(e, t), 0, range(e.rng, 0.25, 0.5), range(e.rng, 70, 110), range(e.rng, 0.03, 0.06));
    }, range(e.rng, 3, 8)),
    // a soft tick of cooling wood
    every(e, () => range(e.rng, 4, 12), t => {
      tone(voiceAt(e, t), { type: 'triangle', freq: range(e.rng, 900, 1500), to: 700, glide: 0.02, env: { peak: range(e.rng, 0.015, 0.03), attack: 0.001, release: 0.03 }, wet: 0.4, pan: range(e.rng, -0.6, 0.6) });
    }, range(e.rng, 1, 5)),
  ];
}

/** Hen clucks: "bok bok bok ... baaak". */
function cluck(v: Voice, peak: number): void {
  const n = 2 + Math.floor(v.rng() * 4);
  let t = 0;
  const f = range(v.rng, 520, 680);
  for (let i = 0; i < n; i++) {
    tone(v, { at: t, type: 'sawtooth', freq: f * 1.15, to: f * 0.85, glide: 0.05, env: { peak, attack: 0.004, release: 0.05 }, filter: { type: 'bandpass', freq: 1300, q: 2.5 } });
    t += range(v.rng, 0.11, 0.18);
  }
  if (v.rng() < 0.4) {
    tone(v, { at: t + 0.05, type: 'sawtooth', freq: f * 1.1, to: f * 1.6, glide: 0.12, env: { peak: peak * 1.1, attack: 0.01, sustainTime: 0.12, release: 0.12 }, filter: { type: 'bandpass', freq: 1500, q: 2 }, vibrato: { rate: 9, depth: 30 } });
  }
}

/** Farmyard: pigs in their pen, hens scratching about, a little wind. */
function farm(e: LayerEnv): Generator[] {
  return [
    ...wind(e, 0.16),
    every(e, () => range(e.rng, 2.5, 7), t => {
      const g = e.ctx.createGain();
      g.gain.value = range(e.rng, 0.25, 0.45);
      const lp = e.ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2600;
      const p = e.ctx.createStereoPanner(); p.pan.value = range(e.rng, -0.7, -0.2);
      g.connect(lp).connect(p).connect(e.out);
      SFX.pig({ ...voiceAt(e, t, g), p: jitter(e.rng, 1, 0.08) });
    }, range(e.rng, 0.5, 2)),
    every(e, () => range(e.rng, 1.5, 5), t => {
      const p = e.ctx.createStereoPanner(); p.pan.value = range(e.rng, -0.2, 0.8);
      p.connect(e.out);
      cluck(voiceAt(e, t, p), range(e.rng, 0.025, 0.05));
    }, range(e.rng, 0.3, 1.5)),
    // a songbird or two nearby
    every(e, () => range(e.rng, 4, 10), t => {
      const p = e.ctx.createStereoPanner(); p.pan.value = range(e.rng, -0.8, 0.8);
      p.connect(e.out);
      tweet(voiceAt(e, t, p), range(e.rng, 0.03, 0.06));
    }, range(e.rng, 2, 5)),
  ];
}

/** Smithy: hammer on anvil, the bellows breathing, embers and the odd quench hiss. */
function forge(e: LayerEnv): Generator[] {
  const p = e.ctx.createStereoPanner();
  p.pan.value = -0.25;
  p.connect(e.out);
  const near: LayerEnv = { ...e, out: p };
  return [
    ...fire(near, 0.45),
    every(near, () => range(e.rng, 2.8, 6.5), t => {
      const strikes = 2 + Math.floor(e.rng() * 3);
      const gap = range(e.rng, 0.42, 0.55);
      const f = range(e.rng, 1050, 1250);
      for (let i = 0; i < strikes; i++) {
        const v = voiceAt(near, t + i * gap);
        const k = i === strikes - 1 ? 1 : 0.8;
        bell(v, { ...BELL_METAL, freq: f * jitter(e.rng, 1, 0.01), peak: 0.1 * k, decay: 0.7, wet: 0.35 });
        noise(v, { kind: 'white', filter: { type: 'bandpass', freq: 2500, q: 1.2 }, env: { peak: 0.14 * k, attack: 0.0006, release: 0.015 } });
        noise(v, { kind: 'white', filter: { type: 'bandpass', freq: 800, q: 1.5 }, env: { peak: 0.08 * k, attack: 0.001, release: 0.03 } });
        // hammer bouncing on the anvil face
        bell({ ...v, t: v.t + 0.13 }, { ...BELL_METAL, freq: f * 1.5, peak: 0.025 * k, decay: 0.25, wet: 0.3 });
      }
    }, range(e.rng, 0.5, 2)),
    // bellows
    every(near, () => range(e.rng, 5, 10), t => {
      noise(voiceAt(near, t), { kind: 'pink', filter: { type: 'lowpass', freq: 700 }, env: { peak: 0.09, attack: 0.5, release: 0.6 } });
      noise(voiceAt(near, t + 0.3), { kind: 'brown', filter: { type: 'lowpass', freq: 300 }, env: { peak: 0.1, attack: 0.3, release: 0.9 } });
    }, range(e.rng, 2, 5)),
    // quench hiss
    every(near, () => range(e.rng, 18, 40), t => {
      noise(voiceAt(near, t), { kind: 'white', filter: { type: 'highpass', freq: 2800 }, filter2: { type: 'lowpass', freq: 9000, to: 4000, time: 1.6 }, env: { peak: 0.06, attack: 0.02, decay: 0.3, sustain: 0.5, sustainTime: 0.5, release: 0.9 }, wet: 0.2 });
    }, range(e.rng, 8, 16)),
  ];
}

/** Frog croak: a fast pulse train through a resonant band. */
function croak(v: Voice, peak: number): void {
  const n = 1 + Math.floor(v.rng() * 3);
  const f = range(v.rng, 85, 140);
  for (let i = 0; i < n; i++) {
    const len = range(v.rng, 0.15, 0.3);
    tone(v, {
      at: i * (len + range(v.rng, 0.08, 0.2)), type: 'sawtooth', freq: f, to: f * 0.9, glide: len,
      env: { peak, attack: 0.02, sustainTime: len * 0.6, release: len * 0.4 },
      filter: { type: 'bandpass', freq: range(v.rng, 600, 950), q: 3 }, tremolo: { rate: range(v.rng, 22, 34), depth: 1 }, wet: 0.3,
    });
  }
}

/** Still water: gentle lapping, plops, frogs and a distant waterbird. */
function lake(e: LayerEnv): Generator[] {
  return [
    bed(e, { kind: 'pink', gain: 0.04, pan: -0.4, filters: [{ type: 'bandpass', freq: 650, q: 1.1, lfo: { rate: 0.21, depth: 180 } }], swell: { rate: 0.27, depth: 0.85 } }),
    bed(e, { kind: 'pink', gain: 0.035, pan: 0.4, filters: [{ type: 'bandpass', freq: 850, q: 1.1, lfo: { rate: 0.17, depth: 220 } }], swell: { rate: 0.33, depth: 0.85 } }),
    ...wind(e, 0.14),
    // little laps against the bank
    every(e, () => range(e.rng, 0.35, 1.4), t => {
      noise(voiceAt(e, t), { kind: 'white', filter: { type: 'bandpass', freq: range(e.rng, 700, 1500), q: 1.4 }, env: { peak: range(e.rng, 0.02, 0.05), attack: 0.04, release: range(e.rng, 0.1, 0.2) }, pan: range(e.rng, -0.7, 0.7) });
    }),
    // a fish or a drop: plop
    every(e, () => range(e.rng, 3, 9), t => {
      const f = range(e.rng, 450, 700);
      const v = voiceAt(e, t);
      const pan = range(e.rng, -0.6, 0.6);
      tone(v, { freq: f, to: f * 2.2, glide: 0.035, env: { peak: 0.05, attack: 0.002, release: 0.05 }, pan, wet: 0.3 });
      noise(v, { kind: 'white', filter: { type: 'bandpass', freq: 1800, q: 1.5 }, env: { peak: 0.025, attack: 0.002, release: 0.06 }, pan });
    }, range(e.rng, 1, 4)),
    every(e, () => range(e.rng, 2, 6), t => {
      const p = e.ctx.createStereoPanner(); p.pan.value = range(e.rng, -0.9, 0.9);
      p.connect(e.out);
      croak(voiceAt(e, t, p), range(e.rng, 0.03, 0.06));
    }, range(e.rng, 0.5, 2)),
    // a waterbird calling across the water
    every(e, () => range(e.rng, 9, 20), t => {
      const p = e.ctx.createStereoPanner(); p.pan.value = range(e.rng, -0.8, 0.8);
      p.connect(e.out);
      const v = voiceAt(e, t, p);
      const f = range(e.rng, 850, 1050);
      for (let i = 0; i < 2; i++) tone(v, { at: i * 0.22, type: 'triangle', freq: f * 1.08, to: f * 0.85, glide: 0.1, env: { peak: 0.03, attack: 0.008, release: 0.1 }, filter: { type: 'lowpass', freq: 2400 }, wet: 0.6 });
    }, range(e.rng, 4, 9)),
  ];
}

export const LAYERS: Record<AmbienceLayer, (e: LayerEnv) => Generator[]> = {
  wind: e => wind(e),
  birds,
  crickets: e => crickets(e, 3),
  rain: e => rain(e),
  storm,
  fire: e => fire(e),
  tavern,
  stream,
  night,
  camp,
  'battle-far': battleFar,
  room,
  farm,
  forge,
  lake,
};

/** Output trims per layer (linear), balanced by offline measurement. */
const LAYER_TRIM: Partial<Record<AmbienceLayer, number>> = {
  wind: 0.29, rain: 0.75, storm: 0.7, stream: 0.8, tavern: 1.25, camp: 0.85,
  'battle-far': 0.6, room: 1, farm: 1.6, forge: 0.9, lake: 1.5,
};
export const layerTrim = (layer: AmbienceLayer): number => LAYER_TRIM[layer] ?? 1;

export const AMBIENCE_LAYERS = Object.keys(LAYERS) as AmbienceLayer[];

