/**
 * Procedural sound effect recipes. Each recipe schedules its nodes on the given voice and returns the
 * absolute end time. Levels are designed so a single effect peaks around -6..-3 dBFS before the
 * master compressor; soft UI sounds sit much lower.
 */
import type { SfxName } from './api';
import { jitter, midiToHz, range } from './math';
import { BELL_CELESTA, BELL_GLASS, BELL_METAL, bell, bus, later, noise, softClipCurve, tone, type Voice } from './synth';

type Recipe = (v: Voice) => number;

/**
 * Mid-range "body" so low impacts stay audible on phone and laptop speakers (which reproduce little
 * below ~300 Hz): band-passed noise around 600-1200 Hz with a short decay.
 */
function body(v: Voice, peak: number, freq = 850, len = 0.04, at = 0): number {
  return noise(v, {
    at, kind: 'white', filter: { type: 'bandpass', freq: jitter(v.rng, freq, 0.12), q: 1.5 },
    env: { peak, attack: 0.001, release: len },
  });
}

/** A short bright click above 2 kHz (transient definition on small speakers). */
function click(v: Voice, peak: number, at = 0, freq = 2600): number {
  return noise(v, {
    at, kind: 'white', filter: { type: 'highpass', freq }, filter2: { type: 'lowpass', freq: freq * 3 },
    env: { peak, attack: 0.0008, release: 0.012 },
  });
}

// ---------------------------------------------------------------- footsteps

function stepGrass(v: Voice): number {
  const r = v.rng;
  const f = jitter(r, 3200, 0.18);
  let end = noise(v, {
    kind: 'white', filter: { type: 'bandpass', freq: f, to: f * 0.7, q: 0.9 }, filter2: { type: 'highpass', freq: 900 },
    env: { peak: jitter(r, 0.32, 0.2), attack: 0.004, release: jitter(r, 0.07, 0.25) },
  });
  // second crunch of the blades
  end = Math.max(end, noise(v, {
    at: range(r, 0.012, 0.03), kind: 'white', filter: { type: 'bandpass', freq: f * 1.4, q: 1.2 },
    env: { peak: jitter(r, 0.16, 0.3), attack: 0.003, release: 0.05 },
  }));
  // tiny soft body
  tone(v, { freq: jitter(r, 110, 0.1), to: 70, glide: 0.05, env: { peak: 0.08, attack: 0.003, release: 0.05 } });
  return end;
}

function stepDirt(v: Voice): number {
  const r = v.rng;
  tone(v, { freq: jitter(r, 120, 0.12), to: 60, glide: 0.06, env: { peak: jitter(r, 0.26, 0.2), attack: 0.003, release: 0.07 } });
  noise(v, {
    kind: 'pink', filter: { type: 'lowpass', freq: jitter(r, 1300, 0.2), to: 500, q: 0.7 },
    env: { peak: jitter(r, 0.38, 0.2), attack: 0.004, release: jitter(r, 0.08, 0.2) },
  });
  return noise(v, {
    at: 0.008, kind: 'white', filter: { type: 'bandpass', freq: jitter(r, 2200, 0.2), q: 1.5 },
    env: { peak: 0.06, attack: 0.002, release: 0.04 },
  });
}

function stepWood(v: Voice): number {
  const r = v.rng;
  const f = jitter(r, 210, 0.1);
  tone(v, { freq: f * 1.25, to: f, glide: 0.03, env: { peak: jitter(r, 0.3, 0.15), attack: 0.002, release: 0.09 } });
  tone(v, { type: 'triangle', freq: f * 2.05, env: { peak: 0.07, attack: 0.002, release: 0.05 }, filter: { type: 'lowpass', freq: 1800 } });
  return noise(v, {
    kind: 'white', filter: { type: 'bandpass', freq: jitter(r, 1300, 0.15), q: 3 },
    env: { peak: jitter(r, 0.22, 0.2), attack: 0.002, release: 0.045 }, wet: 0.08,
  });
}

function stepStone(v: Voice): number {
  const r = v.rng;
  tone(v, { freq: jitter(r, 150, 0.1), to: 80, glide: 0.04, env: { peak: 0.14, attack: 0.002, release: 0.05 } });
  // hard heel knock in the mids
  tone(v, { type: 'triangle', freq: jitter(r, 520, 0.08), to: 380, glide: 0.03, env: { peak: 0.12, attack: 0.001, release: 0.035 } });
  body(v, 0.16, 1100, 0.03);
  noise(v, {
    kind: 'white', filter: { type: 'bandpass', freq: jitter(r, 2100, 0.15), q: 2.2 },
    env: { peak: jitter(r, 0.26, 0.2), attack: 0.001, release: 0.04 }, wet: 0.12,
  });
  return noise(v, {
    at: 0.004, kind: 'white', filter: { type: 'highpass', freq: 4200 },
    env: { peak: jitter(r, 0.08, 0.3), attack: 0.001, release: 0.025 },
  });
}

function stepWater(v: Voice): number {
  const r = v.rng;
  const end = noise(v, {
    kind: 'white', filter: { type: 'bandpass', freq: 700, to: jitter(r, 2600, 0.2), q: 1.4, time: 0.12 },
    env: { peak: jitter(r, 0.3, 0.2), attack: 0.01, decay: 0.05, sustain: 0.4, release: 0.14 },
  });
  tone(v, { at: range(r, 0.02, 0.05), freq: jitter(r, 380, 0.2), to: jitter(r, 900, 0.2), glide: 0.05, env: { peak: 0.06, attack: 0.004, release: 0.05 } });
  tone(v, { freq: 100, to: 60, glide: 0.06, env: { peak: 0.1, attack: 0.004, release: 0.06 } });
  return end;
}

// ---------------------------------------------------------------- UI

function uiMove(v: Voice): number {
  const f = jitter(v.rng, 760, 0.02);
  tone(v, { type: 'triangle', freq: f, env: { peak: 0.1, attack: 0.002, release: 0.05 }, filter: { type: 'lowpass', freq: 2600 } });
  return tone(v, { freq: f * 2, env: { peak: 0.025, attack: 0.002, release: 0.03 } });
}

function uiConfirm(v: Voice): number {
  const notes = [midiToHz(74), midiToHz(81)]; // D5 A5
  let end = 0;
  notes.forEach((f, i) => {
    const at = i * 0.065;
    tone(v, { type: 'triangle', freq: f, at, env: { peak: 0.13, attack: 0.003, release: 0.18 }, filter: { type: 'lowpass', freq: 3200 }, wet: 0.12 });
    end = tone(v, { freq: f * 2, at, env: { peak: 0.035, attack: 0.003, release: 0.12 }, wet: 0.12 });
  });
  return end;
}

function uiCancel(v: Voice): number {
  const notes = [midiToHz(72), midiToHz(67)]; // C5 G4
  let end = 0;
  notes.forEach((f, i) => {
    end = tone(v, { type: 'triangle', freq: f, at: i * 0.07, env: { peak: 0.11, attack: 0.003, release: 0.15 }, filter: { type: 'lowpass', freq: 2000 }, wet: 0.08 });
  });
  return end;
}

function uiOpen(v: Voice): number {
  noise(v, { kind: 'pink', filter: { type: 'bandpass', freq: 400, to: 2200, q: 1.2, time: 0.18 }, env: { peak: 0.12, attack: 0.08, release: 0.12 } });
  bell(v, { ...BELL_CELESTA, freq: midiToHz(79), peak: 0.08, decay: 0.5, at: 0.09, wet: 0.2 });
  return bell(v, { ...BELL_CELESTA, freq: midiToHz(86), peak: 0.04, decay: 0.4, at: 0.13, wet: 0.2 });
}

function uiClose(v: Voice): number {
  noise(v, { kind: 'pink', filter: { type: 'bandpass', freq: 2000, to: 380, q: 1.2, time: 0.16 }, env: { peak: 0.11, attack: 0.02, release: 0.14 } });
  return bell(v, { ...BELL_CELESTA, freq: midiToHz(74), peak: 0.06, decay: 0.35, at: 0.03, wet: 0.15 });
}

function page(v: Voice): number {
  const r = v.rng;
  let end = 0;
  const flutters = 3 + Math.floor(r() * 2);
  for (let i = 0; i < flutters; i++) {
    end = noise(v, {
      at: i * range(r, 0.025, 0.04), kind: 'white',
      filter: { type: 'bandpass', freq: jitter(r, 2400, 0.2), to: jitter(r, 5200, 0.2), q: 0.9 },
      env: { peak: 0.09 * (1 - i * 0.12), attack: 0.006, release: 0.05 },
    });
  }
  return Math.max(end, noise(v, {
    at: 0.08, kind: 'pink', filter: { type: 'highpass', freq: 1200 }, filter2: { type: 'lowpass', freq: 6000, to: 2500 },
    env: { peak: 0.08, attack: 0.03, release: 0.16 },
  }));
}

// ---------------------------------------------------------------- rewards

function pickup(v: Voice): number {
  const notes = [76, 80, 83, 88].map(midiToHz); // E5 G#5 B5 E6
  let end = 0;
  notes.forEach((f, i) => {
    end = Math.max(end, bell(v, { ...BELL_GLASS, freq: f, at: i * 0.045, peak: 0.12 - i * 0.012, decay: 0.55, wet: 0.3, pan: (i - 1.5) * 0.15 }));
  });
  noise(v, { kind: 'white', filter: { type: 'highpass', freq: 7000 }, env: { peak: 0.04, attack: 0.02, release: 0.3 }, wet: 0.3, at: 0.05 });
  return end;
}

/** Brass-like note: detuned saws through a lowpass that swells open. */
function brass(v: Voice, freq: number, at: number, len: number, peak: number, wet = 0.3): number {
  let end = 0;
  for (const d of [-7, 6]) {
    end = tone(v, {
      type: 'sawtooth', freq, at, detune: d, wet,
      env: { peak: peak * 0.5, attack: 0.035, decay: 0.12, sustain: 0.75, sustainTime: len, release: 0.25 },
      filter: { type: 'lowpass', freq: 600, via: 2600, viaAt: 0.06, to: 1400, time: len + 0.2, q: 1.2 },
      vibrato: { rate: 5.2, depth: 9, delay: 0.25 },
    });
  }
  return end;
}

function objective(v: Voice): number {
  const g = midiToHz(67), c = midiToHz(72), e = midiToHz(76), g5 = midiToHz(79);
  brass(v, g, 0, 0.06, 0.2);
  brass(v, c, 0.13, 0.06, 0.2);
  // held chord
  let end = brass(v, c, 0.26, 0.55, 0.16);
  brass(v, e, 0.26, 0.55, 0.13);
  end = Math.max(end, brass(v, g5, 0.26, 0.55, 0.13));
  // soft timpani under the chord
  tone(v, { freq: midiToHz(48), to: midiToHz(46), glide: 0.4, at: 0.26, env: { peak: 0.32, attack: 0.004, release: 0.6 }, wet: 0.2 });
  noise(v, { at: 0.26, kind: 'brown', filter: { type: 'lowpass', freq: 400 }, env: { peak: 0.2, attack: 0.004, release: 0.25 } });
  bell(v, { ...BELL_GLASS, freq: midiToHz(91), at: 0.3, peak: 0.05, decay: 0.9, wet: 0.5 });
  return end;
}

function memory(v: Voice): number {
  const notes = [72, 76, 79, 83, 86].map(midiToHz); // Cmaj9 arpeggio
  let end = 0;
  notes.forEach((f, i) => {
    end = Math.max(end, bell(v, { ...BELL_CELESTA, freq: f, at: i * 0.11, peak: 0.1, decay: 1.6, wet: 0.5, pan: (i - 2) * 0.2 }));
  });
  // warm pad underneath
  for (const f of [midiToHz(60), midiToHz(67)]) {
    tone(v, { type: 'triangle', freq: f, env: { peak: 0.06, attack: 0.4, sustainTime: 0.5, release: 1.2 }, filter: { type: 'lowpass', freq: 1400 }, wet: 0.5, vibrato: { rate: 4.5, depth: 6, delay: 0.3 } });
  }
  noise(v, { kind: 'white', filter: { type: 'highpass', freq: 6000 }, env: { peak: 0.025, attack: 0.5, release: 0.9 }, wet: 0.5 });
  return end;
}

function discover(v: Voice): number {
  bell(v, { ...BELL_GLASS, freq: midiToHz(74), peak: 0.11, decay: 0.7, wet: 0.35 });
  const end = bell(v, { ...BELL_GLASS, freq: midiToHz(81), at: 0.09, peak: 0.12, decay: 0.9, wet: 0.35 });
  bell(v, { ...BELL_GLASS, freq: midiToHz(86), at: 0.16, peak: 0.05, decay: 0.7, wet: 0.4 });
  noise(v, { kind: 'white', filter: { type: 'highpass', freq: 6500 }, env: { peak: 0.03, attack: 0.04, release: 0.4 }, wet: 0.4 });
  return end;
}

// ---------------------------------------------------------------- combat

function hit(v: Voice): number {
  const r = v.rng;
  tone(v, { freq: jitter(r, 160, 0.08), to: 48, glide: 0.12, env: { peak: 0.6, attack: 0.002, release: 0.16 }, shape: 0.3 });
  noise(v, { kind: 'white', filter: { type: 'lowpass', freq: jitter(r, 2600, 0.15), to: 600 }, env: { peak: 0.45, attack: 0.001, release: 0.08 } });
  body(v, 0.55, 900, 0.045);
  click(v, 0.28, 0, 2400);
  return noise(v, { kind: 'white', filter: { type: 'highpass', freq: 3800 }, env: { peak: 0.2, attack: 0.001, release: 0.018 } });
}

function hitHeavy(v: Voice): number {
  const r = v.rng;
  const end = tone(v, { freq: jitter(r, 120, 0.06), to: 34, glide: 0.25, env: { peak: 0.9, attack: 0.002, release: 0.3 }, shape: 0.3 });
  noise(v, { kind: 'pink', filter: { type: 'lowpass', freq: 3200, to: 300 }, env: { peak: 0.6, attack: 0.001, release: 0.18 }, shape: 0.5, wet: 0.12 });
  noise(v, { kind: 'white', filter: { type: 'bandpass', freq: 900, q: 1.4 }, env: { peak: 0.3, attack: 0.001, release: 0.07 } });
  noise(v, { kind: 'white', filter: { type: 'highpass', freq: 4000 }, env: { peak: 0.22, attack: 0.001, release: 0.02 } });
  return end;
}

function swing(v: Voice): number {
  const r = v.rng;
  return noise(v, {
    kind: 'white', filter: { type: 'bandpass', freq: jitter(r, 500, 0.1), via: jitter(r, 2600, 0.1), viaAt: 0.09, to: 800, time: 0.2, q: 1.6 },
    env: { peak: 0.36, attack: 0.07, release: 0.12 }, pan: range(r, -0.2, 0.2),
  });
}

function bow(v: Voice): number {
  const r = v.rng;
  const f = jitter(r, 196, 0.04);
  // string twang: resonant lowpass sweep over a saw + triangle
  tone(v, { type: 'sawtooth', freq: f * 1.02, to: f, glide: 0.04, env: { peak: 0.2, attack: 0.002, release: 0.32 }, filter: { type: 'lowpass', freq: 3600, to: 380, time: 0.18, q: 7 }, vibrato: { rate: 9, depth: 18, delay: 0 } });
  tone(v, { type: 'triangle', freq: f * 2, env: { peak: 0.1, attack: 0.002, release: 0.2 } });
  tone(v, { freq: 90, to: 60, glide: 0.05, env: { peak: 0.2, attack: 0.002, release: 0.06 } });
  // arrow leaving
  return noise(v, { at: 0.02, kind: 'white', filter: { type: 'bandpass', freq: 3000, to: 1400, q: 2 }, env: { peak: 0.14, attack: 0.02, release: 0.14 } });
}

function arrowHit(v: Voice): number {
  const r = v.rng;
  tone(v, { freq: jitter(r, 320, 0.1), to: 120, glide: 0.06, env: { peak: 0.45, attack: 0.001, release: 0.08 } });
  noise(v, { kind: 'white', filter: { type: 'bandpass', freq: 1600, q: 2 }, env: { peak: 0.3, attack: 0.001, release: 0.05 } });
  // shaft quiver
  return tone(v, { type: 'triangle', freq: jitter(r, 190, 0.1), env: { peak: 0.08, attack: 0.005, release: 0.22 }, tremolo: { rate: 32, depth: 0.9 }, filter: { type: 'lowpass', freq: 900 } });
}

function block(v: Voice): number {
  const r = v.rng;
  const end = bell(v, { ...BELL_METAL, freq: jitter(r, 540, 0.05), peak: 0.22, decay: 0.45, wet: 0.2 });
  tone(v, { freq: 130, to: 70, glide: 0.06, env: { peak: 0.4, attack: 0.001, release: 0.08 } });
  noise(v, { kind: 'white', filter: { type: 'bandpass', freq: 3200, q: 1.5 }, env: { peak: 0.3, attack: 0.001, release: 0.03 } });
  return end;
}

function dodge(v: Voice): number {
  const r = v.rng;
  const pan = range(r, -0.3, 0.3);
  // quick "fwip-fwip": cloth and air
  noise(v, { kind: 'white', filter: { type: 'bandpass', freq: 900, via: 3200, viaAt: 0.06, to: 1600, time: 0.14, q: 1.4 }, env: { peak: 0.5, attack: 0.04, release: 0.1 }, pan });
  noise(v, { at: 0.02, kind: 'pink', filter: { type: 'bandpass', freq: 600, to: 1200, q: 0.9, time: 0.12 }, env: { peak: 0.3, attack: 0.03, release: 0.09 }, pan });
  return noise(v, { at: 0.1, kind: 'white', filter: { type: 'bandpass', freq: 2200, to: 1200, q: 1.2, time: 0.1 }, env: { peak: 0.2, attack: 0.02, release: 0.08 }, pan: -pan });
}

function fall(v: Voice): number {
  tone(v, { freq: 95, to: 38, glide: 0.25, env: { peak: 0.6, attack: 0.003, release: 0.3 }, shape: 0.3 });
  noise(v, { kind: 'pink', filter: { type: 'lowpass', freq: 700, to: 200 }, env: { peak: 0.5, attack: 0.003, release: 0.25 } });
  // cloth and body on the ground, audible on small speakers
  body(v, 0.5, 700, 0.07);
  noise(v, { kind: 'pink', filter: { type: 'bandpass', freq: 1500, to: 700, q: 0.9, time: 0.15 }, env: { peak: 0.3, attack: 0.004, release: 0.15 } });
  click(v, 0.16, 0.002, 2200);
  body(v, 0.22, 800, 0.05, 0.13);
  // small bounce / settle
  tone(v, { at: 0.13, freq: 80, to: 45, glide: 0.1, env: { peak: 0.3, attack: 0.003, release: 0.14 } });
  return noise(v, { at: 0.13, kind: 'pink', filter: { type: 'bandpass', freq: 1200, q: 0.8 }, env: { peak: 0.12, attack: 0.01, release: 0.25 } });
}

// ---------------------------------------------------------------- magic (turquoise: E major pentatonic bells + airy swell)

const TURQUOISE = [76, 78, 80, 83, 85, 88, 90, 92].map(midiToHz); // E5 F#5 G#5 B5 C#6 E6 F#6 G#6

function magic(v: Voice): number {
  const r = v.rng;
  let end = 0;
  const count = 6;
  for (let i = 0; i < count; i++) {
    const f = TURQUOISE[Math.min(TURQUOISE.length - 1, i + Math.floor(r() * 3))];
    end = Math.max(end, bell(v, { ...BELL_GLASS, freq: f, at: i * 0.055 + r() * 0.02, peak: 0.085, decay: 0.9, wet: 0.5, pan: range(r, -0.5, 0.5), detune: 4 }));
  }
  noise(v, { kind: 'white', filter: { type: 'bandpass', freq: 5000, to: 9000, q: 0.8 }, env: { peak: 0.07, attack: 0.25, release: 0.5 }, wet: 0.5 });
  tone(v, { type: 'triangle', freq: midiToHz(64), env: { peak: 0.06, attack: 0.15, release: 0.6 }, filter: { type: 'lowpass', freq: 1500 }, wet: 0.4, vibrato: { rate: 6, depth: 10 } });
  return end;
}

function heal(v: Voice): number {
  const notes = [69, 73, 76, 81].map(midiToHz); // A major
  let end = 0;
  notes.forEach((f, i) => {
    end = Math.max(end, tone(v, { freq: f, at: i * 0.09, env: { peak: 0.09, attack: 0.04, release: 0.7 }, wet: 0.45, vibrato: { rate: 5, depth: 6 } }));
    bell(v, { ...BELL_CELESTA, freq: f * 2, at: i * 0.09, peak: 0.03, decay: 0.6, wet: 0.5 });
  });
  noise(v, { kind: 'white', filter: { type: 'bandpass', freq: 3000, to: 8000, q: 0.7 }, env: { peak: 0.04, attack: 0.3, release: 0.5 }, wet: 0.5 });
  return end;
}

function beam(v: Voice): number {
  const len = 0.75;
  // ignition zap
  tone(v, { freq: 2000, to: 280, glide: 0.09, env: { peak: 0.14, attack: 0.002, release: 0.1 } });
  // energy body
  for (const d of [-9, 9]) {
    tone(v, {
      type: 'sawtooth', freq: 220, detune: d, at: 0.02,
      env: { peak: 0.13, attack: 0.05, sustainTime: len, release: 0.25 },
      filter: { type: 'bandpass', freq: 700, via: 2800, viaAt: 0.2, to: 1200, time: len, q: 2.2 },
      tremolo: { rate: 17, depth: 0.35 }, wet: 0.25,
    });
  }
  tone(v, { freq: 110, at: 0.02, env: { peak: 0.13, attack: 0.05, sustainTime: len, release: 0.25 } });
  // mid hum an octave and a fifth up (carries the beam on small speakers)
  tone(v, { type: 'triangle', freq: 440, detune: 5, at: 0.02, env: { peak: 0.07, attack: 0.06, sustainTime: len, release: 0.25 }, tremolo: { rate: 17, depth: 0.3 }, filter: { type: 'lowpass', freq: 1800 }, wet: 0.2 });
  tone(v, { type: 'triangle', freq: 660, detune: -5, at: 0.02, env: { peak: 0.04, attack: 0.08, sustainTime: len, release: 0.25 }, filter: { type: 'lowpass', freq: 2200 }, wet: 0.2 });
  noise(v, { kind: 'white', filter: { type: 'highpass', freq: 5000 }, env: { peak: 0.06, attack: 0.15, sustainTime: len - 0.2, release: 0.3 }, wet: 0.3 });
  return bell(v, { ...BELL_GLASS, freq: TURQUOISE[5], at: 0.05, peak: 0.07, decay: 1.1, wet: 0.5 });
}

function shockwave(v: Voice): number {
  // short suck-in, then boom
  noise(v, { kind: 'pink', filter: { type: 'bandpass', freq: 300, to: 1800, q: 1, time: 0.12 }, env: { peak: 0.15, attack: 0.1, release: 0.02 } });
  const b = later(v, 0.12);
  const end = tone(b, { freq: 85, to: 27, glide: 0.65, env: { peak: 0.95, attack: 0.004, release: 0.75 }, shape: 0.2 });
  noise(b, { kind: 'pink', filter: { type: 'lowpass', freq: 3600, to: 180, time: 0.7 }, env: { peak: 0.6, attack: 0.003, release: 0.7 }, wet: 0.3 });
  noise(b, { kind: 'white', filter: { type: 'bandpass', freq: 1800, to: 400, q: 0.9, time: 0.5 }, env: { peak: 0.2, attack: 0.02, release: 0.5 }, wet: 0.3 });
  bell(b, { ...BELL_GLASS, freq: TURQUOISE[0], peak: 0.06, decay: 1.2, wet: 0.6 });
  return end;
}

function urmacht(v: Voice): number {
  const r = v.rng;
  const swell = 1.1;
  // rising swell: airy noise + bells climbing
  noise(v, { kind: 'pink', filter: { type: 'bandpass', freq: 400, to: 5000, q: 0.8, time: swell }, env: { peak: 0.22, attack: swell, release: 0.05 }, wet: 0.4 });
  for (let i = 0; i < 8; i++) {
    bell(v, { ...BELL_GLASS, freq: TURQUOISE[i], at: (i / 8) * swell, peak: 0.04 + i * 0.006, decay: 0.8, wet: 0.6, pan: range(r, -0.6, 0.6) });
  }
  const h = later(v, swell);
  // impact
  tone(h, { freq: 62, to: 30, glide: 1.6, env: { peak: 0.95, attack: 0.005, release: 2.2 }, shape: 0.15 });
  noise(h, { kind: 'brown', filter: { type: 'lowpass', freq: 900, to: 120, time: 1.5 }, env: { peak: 0.6, attack: 0.005, release: 1.5 }, wet: 0.4 });
  noise(h, { kind: 'white', filter: { type: 'highpass', freq: 3000 }, env: { peak: 0.18, attack: 0.002, release: 0.25 }, wet: 0.5 });
  // awe choir: A major spread, slow filter bloom
  let end = 0;
  const chord = [45, 52, 57, 61, 64, 69].map(midiToHz);
  chord.forEach((f, i) => {
    for (const d of [-8, 8]) {
      end = Math.max(end, tone(h, {
        type: 'sawtooth', freq: f, detune: d + (r() - 0.5) * 4, at: 0.05,
        env: { peak: 0.05, attack: 0.5, sustainTime: 1.2, release: 1.6 },
        filter: { type: 'lowpass', freq: 500, via: 2200, viaAt: 0.9, to: 700, time: 3, q: 0.8 },
        vibrato: { rate: 4.6 + i * 0.13, depth: 7, delay: 0.4 }, wet: 0.6, pan: (i / (chord.length - 1) - 0.5) * 0.8,
      }));
    }
  });
  // descending sparkle cascade
  for (let i = 0; i < 10; i++) {
    bell(h, { ...BELL_GLASS, freq: TURQUOISE[7 - (i % 8)] * (i >= 8 ? 2 : 1), at: 0.3 + i * 0.12, peak: 0.05, decay: 1.2, wet: 0.7, pan: range(r, -0.7, 0.7) });
  }
  return end;
}

// ---------------------------------------------------------------- stealth

function heartbeat(v: Voice): number {
  const lub = (vv: Voice, peak: number, f: number) => {
    // low thump, soft-clipped so it gains harmonics
    tone(vv, { freq: f, to: f * 0.6, glide: 0.1, env: { peak, attack: 0.008, release: 0.14 }, shape: 0.3 });
    // upper body so the beat is audible on laptop and phone speakers
    tone(vv, { type: 'triangle', freq: f * 2, to: f * 1.3, glide: 0.08, env: { peak: peak * 0.45, attack: 0.006, release: 0.09 }, filter: { type: 'lowpass', freq: 700 } });
    // soft knock in the mids (-10 dB), this is what phones actually play
    noise(vv, { kind: 'pink', filter: { type: 'bandpass', freq: 650, q: 1.4 }, env: { peak: peak * 0.9, attack: 0.002, release: 0.035 } });
    tone(vv, { type: 'triangle', freq: f * 8, to: f * 6, glide: 0.03, env: { peak: peak * 0.22, attack: 0.002, release: 0.03 } });
    return noise(vv, { kind: 'pink', filter: { type: 'bandpass', freq: 190, q: 1.2 }, env: { peak: peak * 0.9, attack: 0.006, release: 0.08 } });
  };
  lub(v, 0.8, 66);
  return lub(later(v, 0.2), 0.55, 56);
}

function alert(v: Voice): number {
  // bright two-step stab + low hit
  brass(v, midiToHz(74), 0, 0.03, 0.22, 0.2);
  const end = brass(v, midiToHz(81), 0.07, 0.12, 0.24, 0.25);
  bell(v, { ...BELL_METAL, freq: midiToHz(93), at: 0.07, peak: 0.07, decay: 0.5, wet: 0.3 });
  tone(v, { at: 0.07, freq: 110, to: 55, glide: 0.15, env: { peak: 0.5, attack: 0.002, release: 0.18 } });
  noise(v, { at: 0.07, kind: 'white', filter: { type: 'bandpass', freq: 2500, q: 1 }, env: { peak: 0.12, attack: 0.001, release: 0.05 } });
  return end;
}

function suspicious(v: Voice): number {
  tone(v, { type: 'triangle', freq: midiToHz(69), env: { peak: 0.13, attack: 0.01, release: 0.12 }, filter: { type: 'lowpass', freq: 2200 }, wet: 0.2 });
  return tone(v, { type: 'triangle', freq: midiToHz(71), to: midiToHz(76), glide: 0.18, at: 0.12, env: { peak: 0.14, attack: 0.015, sustainTime: 0.08, release: 0.2 }, filter: { type: 'lowpass', freq: 2400 }, wet: 0.25, vibrato: { rate: 6, depth: 15, delay: 0.1 } });
}

// ---------------------------------------------------------------- world

function crackle(v: Voice, count: number, span: number, peak: number): number {
  const r = v.rng;
  let end = 0;
  for (let i = 0; i < count; i++) {
    end = Math.max(end, noise(v, {
      at: r() * span, kind: 'white', filter: { type: 'bandpass', freq: range(r, 1500, 5000), q: range(r, 1, 4) },
      env: { peak: peak * range(r, 0.3, 1), attack: 0.001, release: range(r, 0.006, 0.025) },
    }));
  }
  return end;
}

function fireIgnite(v: Voice): number {
  const end = noise(v, { kind: 'pink', filter: { type: 'bandpass', freq: 250, to: 2200, q: 0.9, time: 0.35 }, env: { peak: 0.45, attack: 0.12, decay: 0.2, sustain: 0.4, release: 0.5 }, wet: 0.15 });
  noise(v, { kind: 'brown', filter: { type: 'lowpass', freq: 250 }, env: { peak: 0.35, attack: 0.1, release: 0.7 } });
  crackle(later(v, 0.1), 14, 0.7, 0.28);
  return end;
}

function thunder(v: Voice): number {
  const r = v.rng;
  // initial crack
  noise(v, { kind: 'white', filter: { type: 'highpass', freq: 1500 }, env: { peak: 0.4, attack: 0.002, release: 0.12 }, wet: 0.3 });
  noise(v, { kind: 'pink', filter: { type: 'lowpass', freq: 2500, to: 400, time: 0.4 }, env: { peak: 0.5, attack: 0.004, release: 0.45 }, wet: 0.3 });
  // rolling rumble: overlapping brown bursts
  let end = 0;
  for (let i = 0; i < 6; i++) {
    end = Math.max(end, noise(v, {
      at: 0.05 + i * range(r, 0.25, 0.5), kind: 'brown', pitched: false,
      filter: { type: 'lowpass', freq: range(r, 260, 480), to: 90, q: 0.5 },
      env: { peak: range(r, 0.5, 0.8) * (1 - i * 0.1), attack: range(r, 0.05, 0.2), release: range(r, 0.8, 1.6) }, wet: 0.35,
    }));
  }
  tone(v, { freq: 45, to: 30, glide: 1.5, env: { peak: 0.4, attack: 0.05, release: 1.8 } });
  return end;
}

export function creak(v: Voice, at: number, len: number, f: number, peak: number): number {
  return tone(v, {
    type: 'sawtooth', freq: f, to: f * 1.5, glide: len, glideCurve: 'linear', at,
    env: { peak, attack: 0.04, sustainTime: len * 0.6, release: len * 0.4 },
    filter: { type: 'bandpass', freq: 1100, q: 5 }, vibrato: { rate: 23, depth: 70, delay: 0 }, tremolo: { rate: 31, depth: 0.7 },
  });
}

function door(v: Voice): number {
  const r = v.rng;
  creak(v, 0, 0.45, jitter(r, 95, 0.1), 0.18);
  const t = 0.5;
  tone(v, { at: t, freq: 120, to: 55, glide: 0.12, env: { peak: 0.45, attack: 0.003, release: 0.2 }, shape: 0.3 });
  const end = noise(v, { at: t, kind: 'pink', filter: { type: 'lowpass', freq: 900 }, env: { peak: 0.35, attack: 0.003, release: 0.15 }, wet: 0.2 });
  // wooden "tock" of the frame
  tone(v, { at: t, type: 'triangle', freq: jitter(r, 420, 0.06), to: 330, glide: 0.05, env: { peak: 0.2, attack: 0.001, release: 0.07 }, wet: 0.15 });
  body(v, 0.4, 750, 0.06, t);
  click(v, 0.14, t, 2200);
  noise(v, { at: t + 0.02, kind: 'white', filter: { type: 'bandpass', freq: 2600, q: 3 }, env: { peak: 0.1, attack: 0.001, release: 0.03 } });
  return end;
}

function chest(v: Voice): number {
  // latch click
  noise(v, { kind: 'white', filter: { type: 'bandpass', freq: 3600, q: 3 }, env: { peak: 0.22, attack: 0.001, release: 0.02 } });
  tone(v, { freq: 2400, env: { peak: 0.05, attack: 0.001, release: 0.05 } });
  creak(v, 0.08, 0.3, 120, 0.13);
  tone(v, { at: 0.42, freq: 100, to: 60, glide: 0.1, env: { peak: 0.3, attack: 0.003, release: 0.12 } });
  // a hint of treasure
  bell(v, { ...BELL_GLASS, freq: midiToHz(83), at: 0.45, peak: 0.06, decay: 0.7, wet: 0.4 });
  return bell(v, { ...BELL_GLASS, freq: midiToHz(88), at: 0.5, peak: 0.06, decay: 0.8, wet: 0.4 });
}

function splash(v: Voice): number {
  const r = v.rng;
  const end = noise(v, { kind: 'white', filter: { type: 'bandpass', freq: 2600, to: 500, q: 0.8, time: 0.4 }, env: { peak: 0.45, attack: 0.008, decay: 0.1, sustain: 0.35, release: 0.35 }, wet: 0.15 });
  tone(v, { freq: 140, to: 60, glide: 0.1, env: { peak: 0.3, attack: 0.003, release: 0.1 } });
  for (let i = 0; i < 6; i++) {
    tone(v, { at: 0.05 + r() * 0.35, freq: range(r, 400, 800), to: range(r, 900, 1800), glide: 0.04, env: { peak: range(r, 0.03, 0.07), attack: 0.003, release: 0.04 }, pan: range(r, -0.4, 0.4) });
  }
  return end;
}

function rustle(v: Voice): number {
  const r = v.rng;
  let end = 0;
  const n = 6 + Math.floor(r() * 4);
  for (let i = 0; i < n; i++) {
    end = Math.max(end, noise(v, {
      at: (i / n) * 0.3 + r() * 0.04, kind: 'white',
      filter: { type: 'bandpass', freq: range(r, 2500, 6000), q: range(r, 0.8, 1.6) }, filter2: { type: 'highpass', freq: 1500 },
      env: { peak: range(r, 0.06, 0.16), attack: range(r, 0.005, 0.02), release: range(r, 0.03, 0.08) }, pan: range(r, -0.25, 0.25),
    }));
  }
  return end;
}

function barkOnce(v: Voice, scale: number): number {
  const r = v.rng;
  const f = jitter(r, 430, 0.05) * scale;
  const g = bus(v, 1);
  // voiced part: saw with bark contour through two formants
  const formants = [{ freq: 950, q: 3, gain: 1 }, { freq: 1900, q: 4, gain: 0.5 }, { freq: 420, q: 1.2, gain: 0.6 }];
  for (const fm of formants) {
    const bp = v.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = fm.freq * scale;
    bp.Q.value = fm.q;
    const fg = v.ctx.createGain();
    fg.gain.value = fm.gain;
    bp.connect(fg).connect(g);
    const osc = v.ctx.createOscillator();
    osc.type = 'sawtooth';
    const t = v.t;
    osc.frequency.setValueAtTime(f * 0.85, t);
    osc.frequency.linearRampToValueAtTime(f * 1.3, t + 0.025);
    osc.frequency.exponentialRampToValueAtTime(f * 0.7, t + 0.14);
    const amp = v.ctx.createGain();
    amp.gain.setValueAtTime(0.0001, t);
    amp.gain.linearRampToValueAtTime(0.5, t + 0.008);
    amp.gain.exponentialRampToValueAtTime(0.18, t + 0.06);
    amp.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
    const ws = v.ctx.createWaveShaper();
    ws.curve = softCurve(v);
    osc.connect(ws).connect(amp).connect(bp);
    osc.start(t);
    osc.stop(t + 0.2);
  }
  // breath
  return noise(v, { kind: 'white', filter: { type: 'bandpass', freq: 1300 * scale, q: 1.5 }, env: { peak: 0.12, attack: 0.005, release: 0.1 } });
}

const softCurve = (v: Voice) => softClipCurve(v.ctx, 0.2);

function barkDog(v: Voice): number {
  barkOnce(v, 1);
  return barkOnce(later(v, range(v.rng, 0.2, 0.26)), 0.96);
}

function hoof(v: Voice, peak: number): number {
  const r = v.rng;
  tone(v, { freq: jitter(r, 320, 0.08), to: 140, glide: 0.03, env: { peak: peak * 0.5, attack: 0.001, release: 0.04 } });
  tone(v, { freq: 85, to: 50, glide: 0.05, env: { peak: peak * 0.6, attack: 0.002, release: 0.06 } });
  return noise(v, { kind: 'white', filter: { type: 'bandpass', freq: jitter(r, 1700, 0.15), q: 2 }, env: { peak: peak * 0.35, attack: 0.001, release: 0.03 } });
}

function horse(v: Voice): number {
  let end = 0;
  for (let stride = 0; stride < 2; stride++) {
    const base = stride * 0.38;
    [0, 0.075, 0.16].forEach((dt, i) => { end = hoof(later(v, base + dt), [0.6, 0.45, 0.7][i]); });
  }
  return end;
}

function drill(v: Voice): number {
  const len = 0.6;
  const t = v.t;
  // friction noise with back-and-forth amplitude (|sin|) and pitch
  const g = bus(v, 1);
  const lfo = v.ctx.createOscillator();
  lfo.frequency.value = 5.5;
  const lfoDepth = v.ctx.createGain();
  lfoDepth.gain.value = 0.5;
  const am = v.ctx.createGain();
  am.gain.value = 0.5;
  lfo.connect(lfoDepth).connect(am.gain);
  am.connect(g);
  const n = noise(v, { kind: 'pink', filter: { type: 'bandpass', freq: 900, q: 2.5 }, env: { peak: 0.35, attack: 0.05, sustainTime: len, release: 0.12 }, dest: am });
  tone(v, { type: 'sawtooth', freq: 180, env: { peak: 0.04, attack: 0.05, sustainTime: len, release: 0.12 }, filter: { type: 'bandpass', freq: 1400, q: 6 }, vibrato: { rate: 5.5, depth: 300, delay: 0 }, dest: am });
  lfo.start(t);
  lfo.stop(n + 0.05);
  return n;
}

function whoosh(v: Voice): number {
  const r = v.rng;
  return noise(v, {
    kind: 'pink', filter: { type: 'bandpass', freq: 300, via: jitter(r, 1600, 0.15), viaAt: 0.2, to: 400, time: 0.45, q: 1.2 },
    env: { peak: 0.45, attack: 0.18, release: 0.25 }, pan: range(r, -0.2, 0.2),
  });
}

function thud(v: Voice): number {
  tone(v, { freq: jitter(v.rng, 105, 0.08), to: 45, glide: 0.18, env: { peak: 0.6, attack: 0.003, release: 0.22 }, shape: 0.3 });
  body(v, 0.42, 650, 0.06);
  click(v, 0.1, 0.001, 2100);
  return noise(v, { kind: 'pink', filter: { type: 'lowpass', freq: 500 }, env: { peak: 0.4, attack: 0.003, release: 0.15 } });
}

// ---------------------------------------------------------------- story props (polish pass)

function branchSnap(v: Voice): number {
  const r = v.rng;
  // the crack: a very short, bright, resonant burst
  noise(v, { kind: 'white', filter: { type: 'bandpass', freq: jitter(r, 2400, 0.15), q: 3.5 }, env: { peak: 0.5, attack: 0.0005, release: 0.022 }, wet: 0.2 });
  click(v, 0.3, 0, 3000);
  tone(v, { type: 'triangle', freq: jitter(r, 640, 0.1), to: 360, glide: 0.04, env: { peak: 0.25, attack: 0.0008, release: 0.05 } });
  // wood fibres splintering right after
  let end = 0;
  for (let i = 0; i < 6; i++) {
    end = Math.max(end, noise(v, {
      at: 0.012 + i * range(r, 0.008, 0.02), kind: 'white', filter: { type: 'bandpass', freq: range(r, 1500, 4200), q: range(r, 2, 5) },
      env: { peak: range(r, 0.2, 0.4) * (1 - i * 0.1), attack: 0.0006, release: range(r, 0.015, 0.035) },
    }));
  }
  // the twig settling in the leaves
  return Math.max(end, noise(v, { at: 0.05, kind: 'pink', filter: { type: 'bandpass', freq: 2600, q: 1 }, env: { peak: 0.06, attack: 0.01, release: 0.08 } }));
}

/** One pig grunt: a pulsed, nasal saw through snout formants. */
function grunt(v: Voice, f: number, len: number, peak: number): number {
  const g = bus(v, 1);
  const formants = [{ freq: 520, q: 3, gain: 1 }, { freq: 1150, q: 4, gain: 0.55 }, { freq: 2300, q: 5, gain: 0.2 }];
  const pre = v.ctx.createGain();
  pre.gain.value = 1;
  for (const fm of formants) {
    const bp = v.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = fm.freq * v.p;
    bp.Q.value = fm.q;
    const fg = v.ctx.createGain();
    fg.gain.value = fm.gain;
    pre.connect(bp).connect(fg).connect(g);
  }
  const end = tone(v, {
    type: 'sawtooth', freq: f, to: f * 0.78, glide: len, env: { peak, attack: 0.012, sustainTime: len * 0.5, release: len * 0.5 },
    tremolo: { rate: range(v.rng, 28, 40), depth: 0.85 }, shape: 0.4, dest: pre,
  });
  noise(v, { kind: 'pink', filter: { type: 'bandpass', freq: 900, q: 1.2 }, env: { peak: peak * 0.25, attack: 0.01, release: len }, dest: pre });
  return end;
}

function pig(v: Voice): number {
  const r = v.rng;
  if (r() < 0.2) {
    // a short excited squeal
    return tone(v, {
      type: 'sawtooth', freq: jitter(r, 700, 0.1), to: jitter(r, 1100, 0.1), glide: 0.12, env: { peak: 0.12, attack: 0.02, sustainTime: 0.1, release: 0.12 },
      filter: { type: 'bandpass', freq: 1600, q: 2 }, vibrato: { rate: 14, depth: 60, delay: 0 }, shape: 0.3,
    });
  }
  const f = jitter(r, 120, 0.15);
  const n = 2 + Math.floor(r() * 2);
  let end = 0;
  for (let i = 0; i < n; i++) end = grunt(later(v, i * range(r, 0.17, 0.24)), f * jitter(r, 1, 0.08), range(r, 0.09, 0.15), 0.3 * (1 - i * 0.15));
  return end;
}

function stonePlace(v: Voice): number {
  const r = v.rng;
  // a short scrape as it is set down, then the knock of stone on stone
  noise(v, { kind: 'white', filter: { type: 'bandpass', freq: jitter(r, 1400, 0.2), q: 2 }, env: { peak: 0.12, attack: 0.03, release: 0.06 } });
  const k = later(v, 0.08);
  tone(k, { freq: jitter(r, 110, 0.1), to: 60, glide: 0.08, env: { peak: 0.45, attack: 0.002, release: 0.12 }, shape: 0.3 });
  tone(k, { type: 'triangle', freq: jitter(r, 780, 0.1), to: 620, glide: 0.04, env: { peak: 0.2, attack: 0.001, release: 0.06 }, wet: 0.15 });
  body(k, 0.45, 1000, 0.05);
  click(k, 0.22, 0, 2800);
  // a few pebbles and grit trickling
  let end = 0;
  for (let i = 0; i < 4; i++) {
    end = Math.max(end, noise(later(k, 0.03 + r() * 0.2), {
      kind: 'white', filter: { type: 'bandpass', freq: range(r, 2500, 5000), q: 3 }, env: { peak: range(r, 0.04, 0.1), attack: 0.001, release: 0.015 },
    }));
  }
  return end;
}

function ropeCut(v: Voice): number {
  const r = v.rng;
  // blade biting into the fibres: a quick rising slice
  noise(v, { kind: 'white', filter: { type: 'bandpass', freq: 1400, to: 4200, q: 2.2, time: 0.14 }, env: { peak: 0.3, attack: 0.02, release: 0.08 } });
  // fibres snapping one after another
  let end = 0;
  const n = 6 + Math.floor(r() * 4);
  for (let i = 0; i < n; i++) {
    end = Math.max(end, noise(v, {
      at: 0.02 + (i / n) * 0.13 + r() * 0.01, kind: 'white', filter: { type: 'bandpass', freq: range(r, 2000, 5000), q: range(r, 3, 7) },
      env: { peak: range(r, 0.12, 0.28), attack: 0.0005, release: range(r, 0.005, 0.014) },
    }));
  }
  // the rope going slack
  noise(v, { at: 0.16, kind: 'pink', filter: { type: 'bandpass', freq: 700, to: 300, q: 1, time: 0.15 }, env: { peak: 0.15, attack: 0.01, release: 0.14 } });
  return Math.max(end, tone(v, { at: 0.17, type: 'triangle', freq: 260, to: 150, glide: 0.08, env: { peak: 0.08, attack: 0.003, release: 0.08 } }));
}

function chain(v: Voice): number {
  const r = v.rng;
  let end = 0;
  const links = 9 + Math.floor(r() * 6);
  for (let i = 0; i < links; i++) {
    const at = (i / links) * 0.42 + r() * 0.03;
    end = Math.max(end, bell(v, { ...BELL_METAL, freq: range(r, 1800, 4200), at, peak: range(r, 0.04, 0.09), decay: range(r, 0.06, 0.16), pan: range(r, -0.25, 0.25), wet: 0.15 }));
    noise(v, { at, kind: 'white', filter: { type: 'bandpass', freq: range(r, 3000, 6000), q: 2 }, env: { peak: range(r, 0.05, 0.12), attack: 0.0006, release: 0.01 } });
  }
  // the weight of the chain dropping against wood/stone at the end
  body(v, 0.18, 1200, 0.03, 0.4);
  return end;
}

function swordDraw(v: Voice): number {
  const r = v.rng;
  const len = 0.36;
  // steel sliding along the scabbard mouth: bright, rising scrape
  noise(v, { kind: 'white', filter: { type: 'bandpass', freq: 2600, to: 5200, q: 4, time: len }, env: { peak: 0.3, attack: 0.04, sustainTime: len * 0.6, release: 0.06 } });
  tone(v, { type: 'sawtooth', freq: 1600, to: 2600, glide: len, glideCurve: 'linear', env: { peak: 0.025, attack: 0.04, sustainTime: len * 0.6, release: 0.06 }, filter: { type: 'bandpass', freq: 3200, q: 8 } });
  // the blade clears the scabbard and rings
  const ring = later(v, len);
  click(ring, 0.2, 0, 3200);
  return bell(ring, { ...BELL_METAL, freq: jitter(r, 1250, 0.04), peak: 0.13, decay: 1.1, wet: 0.35, detune: 6 });
}

function crossbow(v: Voice): number {
  const r = v.rng;
  // trigger latch
  click(v, 0.35, 0, 2800);
  noise(v, { kind: 'white', filter: { type: 'bandpass', freq: 3800, q: 4 }, env: { peak: 0.2, attack: 0.0006, release: 0.012 } });
  // heavy string release: low thunk with a short, stiff twang
  const s = later(v, 0.015);
  tone(s, { freq: jitter(r, 150, 0.05), to: 70, glide: 0.06, env: { peak: 0.4, attack: 0.001, release: 0.09 }, shape: 0.3 });
  tone(s, { type: 'sawtooth', freq: jitter(r, 120, 0.04), env: { peak: 0.16, attack: 0.001, release: 0.16 }, filter: { type: 'lowpass', freq: 2600, to: 300, time: 0.1, q: 6 } });
  body(s, 0.35, 800, 0.04);
  // bolt leaving fast
  return noise(s, { at: 0.01, kind: 'white', filter: { type: 'bandpass', freq: 3200, to: 1400, q: 2.5, time: 0.15 }, env: { peak: 0.16, attack: 0.008, release: 0.12 } });
}

function throwSfx(v: Voice): number {
  const r = v.rng;
  // arm swing: cloth flick and a quick rising air swish
  noise(v, { kind: 'pink', filter: { type: 'bandpass', freq: 500, to: 1100, q: 1, time: 0.08 }, env: { peak: 0.15, attack: 0.02, release: 0.05 } });
  return noise(v, {
    at: 0.04, kind: 'white', filter: { type: 'bandpass', freq: 700, via: jitter(r, 2400, 0.12), viaAt: 0.07, to: 1200, time: 0.2, q: 1.8 },
    env: { peak: 0.32, attack: 0.05, release: 0.12 }, pan: range(r, -0.15, 0.15),
  });
}

function spark(v: Voice): number {
  const r = v.rng;
  // tiny electric snap
  click(v, 0.18, 0, 4000);
  tone(v, { freq: 2600, to: 5200, glide: 0.04, env: { peak: 0.05, attack: 0.001, release: 0.04 } });
  // a few turquoise glints (the Urmacht motif, very small)
  let end = 0;
  for (let i = 0; i < 3; i++) {
    end = Math.max(end, bell(v, { ...BELL_GLASS, freq: TURQUOISE[5 + i], at: 0.02 + i * 0.05 + r() * 0.015, peak: 0.06 - i * 0.012, decay: 0.6, wet: 0.55, pan: range(r, -0.3, 0.3), detune: 5 }));
  }
  noise(v, { kind: 'white', filter: { type: 'highpass', freq: 7500 }, env: { peak: 0.035, attack: 0.01, release: 0.25 }, wet: 0.5 });
  return end;
}

function write(v: Voice): number {
  const r = v.rng;
  let t = 0;
  let end = 0;
  const strokes = 4 + Math.floor(r() * 3);
  for (let i = 0; i < strokes; i++) {
    const len = range(r, 0.05, 0.12);
    const f = range(r, 2600, 4200);
    end = noise(v, {
      at: t, kind: 'white', filter: { type: 'bandpass', freq: f, to: f * range(r, 0.8, 1.25), q: 2.4, time: len },
      env: { peak: range(r, 0.08, 0.14), attack: len * 0.25, release: len * 0.6 }, pan: 0.1,
    });
    t += len + range(r, 0.02, 0.07);
  }
  // final dot
  return Math.max(end, noise(v, { at: t + 0.03, kind: 'white', filter: { type: 'bandpass', freq: 2200, q: 2 }, env: { peak: 0.1, attack: 0.001, release: 0.012 } }));
}

function eat(v: Voice): number {
  const r = v.rng;
  // crunchy bite
  let end = 0;
  for (let i = 0; i < 5; i++) {
    noise(v, {
      at: i * range(r, 0.006, 0.016), kind: 'white', filter: { type: 'bandpass', freq: range(r, 1500, 3500), q: range(r, 1.5, 3) },
      env: { peak: range(r, 0.15, 0.3), attack: 0.0008, release: range(r, 0.01, 0.03) },
    });
  }
  body(v, 0.15, 900, 0.04);
  // two or three muffled chews
  const chews = 2 + Math.floor(r() * 2);
  for (let i = 0; i < chews; i++) {
    const at = 0.28 + i * range(r, 0.22, 0.28);
    end = noise(v, { at, kind: 'pink', filter: { type: 'bandpass', freq: jitter(r, 1100, 0.2), q: 1.2 }, env: { peak: 0.12, attack: 0.02, release: 0.07 } });
    noise(v, { at: at + 0.01, kind: 'white', filter: { type: 'bandpass', freq: range(r, 2000, 3000), q: 2 }, env: { peak: 0.04, attack: 0.002, release: 0.02 } });
  }
  return end;
}

/**
 * Output trims (linear) so all effects sit in a consistent loudness hierarchy:
 * footsteps and UI quiet, rewards clear, combat punchy, big magic biggest. Measured offline
 * (short-term 50 ms RMS) with the demo's analysis tools.
 */
const TRIM: Partial<Record<SfxName, number>> = {
  'step-grass': 1.05, 'step-dirt': 0.41, 'step-wood': 0.49, 'step-stone': 0.8, 'step-water': 1,
  'ui-move': 1.15, 'ui-confirm': 1.1, 'ui-cancel': 1.15, 'ui-open': 0.92, 'ui-close': 1.1, page: 2.3,
  pickup: 1.5, objective: 0.9, memory: 1.3,
  hit: 0.93, swing: 3.2, bow: 1.13, 'arrow-hit': 1.31, block: 0.94, dodge: 1.7, fall: 0.46,
  magic: 1.4, heal: 1.15, beam: 1.15, shockwave: 0.56, urmacht: 0.61,
  heartbeat: 0.4, 'fire-ignite': 1.2, thunder: 0.83, door: 0.57, splash: 0.80, rustle: 5.6,
  'bark-dog': 0.84, drill: 1.9, whoosh: 1.7, thud: 0.47, 'hit-heavy': 0.75,
  'branch-snap': 1.6, pig: 2, 'stone-place': 0.6, 'rope-cut': 3, chain: 2.2, 'sword-draw': 0.9, crossbow: 0.8,
  throw: 3.5, spark: 2, write: 6, eat: 4,
};
export const sfxTrim = (name: SfxName): number => TRIM[name] ?? 1;

export const SFX: Record<SfxName, Recipe> = {
  'step-grass': stepGrass, 'step-dirt': stepDirt, 'step-wood': stepWood, 'step-stone': stepStone, 'step-water': stepWater,
  'ui-move': uiMove, 'ui-confirm': uiConfirm, 'ui-cancel': uiCancel, 'ui-open': uiOpen, 'ui-close': uiClose, page,
  pickup, objective, memory, discover,
  hit, 'hit-heavy': hitHeavy, swing, bow, 'arrow-hit': arrowHit, block, dodge, fall,
  magic, beam, shockwave, urmacht, heal,
  heartbeat, alert, suspicious,
  'fire-ignite': fireIgnite, thunder, door, chest, splash, rustle, 'bark-dog': barkDog, horse,
  drill, whoosh, thud,
  'branch-snap': branchSnap, pig, 'stone-place': stonePlace, 'rope-cut': ropeCut, chain, 'sword-draw': swordDraw,
  crossbow, throw: throwSfx, spark, write, eat,
};

export const SFX_NAMES = Object.keys(SFX) as SfxName[];

/** Minimum ms between two identical effects with the same throttle key (spam protection). */
export function throttleMs(name: SfxName): number {
  if (name.startsWith('step-')) return 70;
  switch (name) {
    case 'ui-move': return 35;
    case 'urmacht': return 1500;
    case 'thunder': case 'objective': case 'memory': return 400;
    case 'heartbeat': return 300;
    case 'shockwave': case 'beam': return 150;
    case 'write': case 'eat': case 'chain': case 'sword-draw': return 120;
    default: return 45;
  }
}

/**
 * Voice-budget cost of an effect: roughly how many simultaneous oscillators/noise sources it uses,
 * scaled so a footstep costs 1.
 */
export function sfxWeight(name: SfxName): number {
  switch (name) {
    case 'urmacht': return 6;
    case 'objective': case 'memory': case 'thunder': case 'magic': return 3;
    case 'shockwave': case 'beam': case 'pickup': case 'chain': case 'heal': case 'splash': case 'fire-ignite': return 2;
    default: return 1;
  }
}

/** Effects that should briefly lower the music (in dB) and for how long (ms). */
export function duckFor(name: SfxName): { db: number; ms: number } | null {
  switch (name) {
    case 'urmacht': return { db: -14, ms: 3500 };
    case 'objective': return { db: -8, ms: 1100 };
    case 'memory': return { db: -9, ms: 1800 };
    case 'alert': return { db: -6, ms: 700 };
    case 'shockwave': return { db: -6, ms: 900 };
    case 'thunder': return { db: -4, ms: 1500 };
    default: return null;
  }
}

/** Effects allowed to exceed the voice budget. */
export const IMPORTANT = new Set<SfxName>(['objective', 'memory', 'urmacht', 'alert', 'pickup', 'discover', 'ui-confirm', 'branch-snap']);
