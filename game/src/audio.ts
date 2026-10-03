// Scene music and small WebAudio effects, unlocked by a browser user gesture.
import type Phaser from 'phaser';
import { getSettings, subscribeSettings } from './settings';

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let reverb: ConvolverNode | null = null;
let effectsBus: GainNode | null = null;
let musicBus: GainNode | null = null;

export function unlockAudio() {
  if (!ctx) {
    if (typeof AudioContext === 'undefined') return;
    try {
      ctx = new AudioContext();
      master = ctx.createGain();
      master.gain.value = 0.55;
      master.connect(ctx.destination);
      effectsBus = ctx.createGain();
      effectsBus.gain.value = getSettings().effectsVolume;
      effectsBus.connect(master);
      musicBus = ctx.createGain();
      musicBus.gain.value = getSettings().musicVolume;
      musicBus.connect(master);
      reverb = ctx.createConvolver();
      reverb.buffer = impulse(ctx, 2.6);
      const wet = ctx.createGain();
      wet.gain.value = 0.35;
      reverb.connect(wet).connect(effectsBus);
    } catch { ctx = null; return; }
  }
  if (ctx.state === 'suspended') {
    void ctx.resume().then(() => playRequestedMusic()).catch(() => {});
  } else { void playRequestedMusic(); }
}

subscribeSettings((settings) => {
  if (!ctx) return;
  effectsBus?.gain.setTargetAtTime(settings.effectsVolume, ctx.currentTime, 0.025);
  musicBus?.gain.setTargetAtTime(settings.musicVolume, ctx.currentTime, 0.025);
});

function impulse(c: AudioContext, seconds: number) {
  const len = c.sampleRate * seconds;
  const buf = c.createBuffer(2, len, c.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
  }
  return buf;
}

function out(gain: number, wet = true) {
  const g = ctx!.createGain();
  g.gain.value = gain;
  g.connect(effectsBus!);
  if (wet) g.connect(reverb!);
  return g;
}

function noise(seconds: number) {
  const len = Math.floor(ctx!.sampleRate * seconds);
  const buf = ctx!.createBuffer(1, len, ctx!.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  const src = ctx!.createBufferSource();
  src.buffer = buf;
  return src;
}

function tone(type: OscillatorType, freq: number, t0: number, dur: number, gain: number, dest: AudioNode, freqEnd?: number) {
  const o = ctx!.createOscillator();
  const g = ctx!.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t0);
  if (freqEnd) o.frequency.exponentialRampToValueAtTime(freqEnd, t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + Math.min(0.04, dur / 4));
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g).connect(dest);
  o.start(t0);
  o.stop(t0 + dur + 0.05);
}

const ready = () => !!ctx && ctx.state === 'running';

export const sfx = {
  trumpets() {
    if (!ready()) return;
    const t = ctx!.currentTime, d = out(0.18);
    [[220, 0], [277, 0.25], [330, 0.5], [440, 0.75]].forEach(([f, dt]) => {
      tone('sawtooth', f, t + dt, 0.6, 0.5, d);
      tone('sawtooth', f * 1.005, t + dt, 0.6, 0.3, d);
    });
  },
  step() {
    if (!ready()) return;
    const n = noise(0.08), f = ctx!.createBiquadFilter(), g = out(0.12, false);
    f.type = 'lowpass'; f.frequency.value = 500;
    n.connect(f).connect(g); n.start();
  },
  select() {
    if (!ready()) return;
    tone('triangle', 660, ctx!.currentTime, 0.08, 0.15, out(0.2, false));
  },
  beam() {
    if (!ready()) return;
    const t = ctx!.currentTime, d = out(0.35);
    tone('sawtooth', 1200, t, 0.5, 0.6, d, 180);
    tone('square', 90, t, 0.6, 0.5, d, 40);
    const n = noise(0.7), f = ctx!.createBiquadFilter();
    f.type = 'bandpass'; f.frequency.value = 2500; f.Q.value = 0.7;
    const g = ctx!.createGain(); g.gain.setValueAtTime(0.5, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.7);
    n.connect(f).connect(g).connect(d); n.start(t);
  },
  wave() {
    if (!ready()) return;
    const t = ctx!.currentTime, d = out(0.45);
    tone('sine', 110, t, 0.7, 0.9, d, 30);
    const n = noise(0.5), f = ctx!.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.setValueAtTime(1800, t); f.frequency.exponentialRampToValueAtTime(120, t + 0.5);
    n.connect(f).connect(d); n.start(t);
  },
  hit() {
    if (!ready()) return;
    const t = ctx!.currentTime, d = out(0.3);
    tone('square', 160, t, 0.15, 0.6, d, 60);
    const n = noise(0.12); n.connect(d); n.start(t);
  },
  clang() {
    if (!ready()) return;
    const t = ctx!.currentTime, d = out(0.15);
    [1800, 2400, 3100].forEach((f) => tone('triangle', f, t, 0.35, 0.4, d));
  },
  bolt() {
    if (!ready()) return;
    const t = ctx!.currentTime, d = out(0.2);
    tone('sawtooth', 900, t, 0.18, 0.4, d, 300);
  },
  thud() {
    if (!ready()) return;
    tone('sine', 70, ctx!.currentTime, 0.4, 0.9, out(0.5), 35);
  },
  horn() {
    if (!ready()) return;
    const t = ctx!.currentTime, d = out(0.3);
    tone('sawtooth', 147, t, 2.4, 0.5, d, 139);
    tone('sawtooth', 220, t + 0.1, 2.2, 0.25, d, 208);
  },
  heartbeat() {
    if (!ready()) return;
    const t = ctx!.currentTime, d = out(0.6, false);
    tone('sine', 55, t, 0.18, 0.9, d, 40);
    tone('sine', 50, t + 0.22, 0.2, 0.7, d, 38);
  },
  bark(volume = 0.3) {
    if (!ready()) return;
    const t = ctx!.currentTime, d = out(volume);
    for (const dt of [0, 0.22]) {
      const n = noise(0.14), f = ctx!.createBiquadFilter(), g = ctx!.createGain();
      f.type = 'bandpass'; f.frequency.setValueAtTime(900, t + dt); f.frequency.exponentialRampToValueAtTime(420, t + dt + 0.12); f.Q.value = 4;
      g.gain.setValueAtTime(0.0001, t + dt); g.gain.exponentialRampToValueAtTime(0.9, t + dt + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dt + 0.13);
      n.connect(f).connect(g).connect(d); n.start(t + dt);
      tone('sawtooth', 380, t + dt, 0.12, 0.25, d, 220);
    }
  },
  suck() {
    if (!ready()) return;
    const t = ctx!.currentTime, d = out(0.4, false);
    const n = noise(1.8), f = ctx!.createBiquadFilter(), g = ctx!.createGain();
    f.type = 'lowpass'; f.frequency.setValueAtTime(6000, t); f.frequency.exponentialRampToValueAtTime(80, t + 1.7);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.6, t + 1.2); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.8);
    n.connect(f).connect(g).connect(d); n.start(t);
  },
  breath() {
    if (!ready()) return;
    const t = ctx!.currentTime, d = out(0.12, false);
    const n = noise(0.7), f = ctx!.createBiquadFilter(), g = ctx!.createGain();
    f.type = 'bandpass'; f.frequency.value = 1200; f.Q.value = 0.8;
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.5, t + 0.25); g.gain.linearRampToValueAtTime(0.0001, t + 0.7);
    n.connect(f).connect(g).connect(d); n.start(t);
  },
  fizzle() {
    if (!ready()) return;
    tone('sine', 880, ctx!.currentTime, 0.4, 0.15, out(0.2), 220);
  },
  creak() {
    if (!ready()) return;
    const t = ctx!.currentTime, d = out(0.22);
    const o = ctx!.createOscillator(), g = ctx!.createGain(), f = ctx!.createBiquadFilter();
    o.type = 'sawtooth'; o.frequency.setValueAtTime(140 + Math.random() * 40, t); o.frequency.linearRampToValueAtTime(95, t + 0.45);
    f.type = 'bandpass'; f.frequency.value = 600; f.Q.value = 6;
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.5, t + 0.08); g.gain.linearRampToValueAtTime(0.0001, t + 0.5);
    o.connect(f).connect(g).connect(d); o.start(t); o.stop(t + 0.55);
  },
  hum(seconds: number) {
    if (!ready()) return;
    const t = ctx!.currentTime, d = out(0.3);
    [220, 330, 440].forEach((f, i) => tone('sine', f, t + i * 0.15, seconds, 0.35 - i * 0.08, d, f * 1.5));
  },
  bang() {
    if (!ready()) return;
    const t = ctx!.currentTime, d = out(0.9);
    tone('sine', 90, t, 0.9, 1, d, 25);
    const n = noise(1.2), f = ctx!.createBiquadFilter(), g = ctx!.createGain();
    f.type = 'lowpass'; f.frequency.setValueAtTime(5000, t); f.frequency.exponentialRampToValueAtTime(100, t + 1);
    g.gain.setValueAtTime(1, t); g.gain.exponentialRampToValueAtTime(0.001, t + 1.2);
    n.connect(f).connect(g).connect(d); n.start(t);
  },
  babyCry(seconds = 2.5) {
    if (!ready()) return;
    const t = ctx!.currentTime, d = out(0.16);
    for (let k = 0; k < 2; k++) for (let i = 0; i < seconds / 0.9; i++) {
      const t0 = t + i * 0.9 + k * 0.33, base = 480 + k * 70;
      const o = ctx!.createOscillator(), g = ctx!.createGain(), f = ctx!.createBiquadFilter();
      o.type = 'sawtooth'; o.frequency.setValueAtTime(base, t0); o.frequency.linearRampToValueAtTime(base * 1.35, t0 + 0.25); o.frequency.linearRampToValueAtTime(base * 0.9, t0 + 0.6);
      f.type = 'bandpass'; f.frequency.value = 1400; f.Q.value = 2;
      g.gain.setValueAtTime(0.0001, t0); g.gain.linearRampToValueAtTime(0.6, t0 + 0.05); g.gain.linearRampToValueAtTime(0.0001, t0 + 0.65);
      o.connect(f).connect(g).connect(d); o.start(t0); o.stop(t0 + 0.7);
    }
  },
  bird() {
    if (!ready()) return;
    const t = ctx!.currentTime, d = out(0.07);
    const base = 2200 + Math.random() * 1200;
    for (let i = 0; i < 3; i++) tone('sine', base, t + i * 0.11, 0.08, 0.4, d, base * 1.3);
  },
  cluck() {
    if (!ready()) return;
    const t = ctx!.currentTime, d = out(0.09);
    for (let i = 0; i < 3; i++) tone('square', 520 + Math.random() * 80, t + i * 0.09, 0.06, 0.5, d, 380);
  },
  grunt() {
    if (!ready()) return;
    const t = ctx!.currentTime, d = out(0.16);
    const n = noise(0.3), f = ctx!.createBiquadFilter(), g = ctx!.createGain();
    f.type = 'bandpass'; f.frequency.value = 260; f.Q.value = 3;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.9, t + 0.04); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.28);
    n.connect(f).connect(g).connect(d); n.start(t);
    tone('sawtooth', 110, t, 0.25, 0.4, d, 80);
  },
  pickup() {
    if (!ready()) return;
    const t = ctx!.currentTime, d = out(0.14);
    [880, 1175, 1568].forEach((f, i) => tone('triangle', f, t + i * 0.06, 0.18, 0.5, d));
  },
  rustle() {
    if (!ready()) return;
    const t = ctx!.currentTime, d = out(0.25);
    const n = noise(0.9), f = ctx!.createBiquadFilter(), g = ctx!.createGain();
    f.type = 'highpass'; f.frequency.value = 1800;
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.6, t + 0.1); g.gain.linearRampToValueAtTime(0.0001, t + 0.9);
    n.connect(f).connect(g).connect(d); n.start(t);
  },
  drone(seconds: number) {
    if (!ready()) return;
    const t = ctx!.currentTime, d = out(0.4);
    tone('sine', 48, t, seconds, 0.8, d, 30);
    tone('sawtooth', 96, t, seconds, 0.15, d, 50);
  },
};

/** Leiser Schlachtlärm-Teppich: gefiltertes Rauschen mit langsamer Modulation. */
export function startBattleAmbience(): () => void {
  if (!ready()) return () => {};
  const n = noise(4);
  n.loop = true;
  const f = ctx!.createBiquadFilter();
  f.type = 'bandpass'; f.frequency.value = 700; f.Q.value = 0.4;
  const g = ctx!.createGain(); g.gain.value = 0.0;
  g.gain.linearRampToValueAtTime(0.12, ctx!.currentTime + 2);
  const lfo = ctx!.createOscillator(), lg = ctx!.createGain();
  lfo.frequency.value = 0.15; lg.gain.value = 300;
  lfo.connect(lg).connect(f.frequency);
  n.connect(f).connect(g).connect(effectsBus!);
  g.connect(reverb!);
  n.start(); lfo.start();
  let stopped = false;
  return () => {
    if (stopped) return;
    stopped = true;
    const t = ctx!.currentTime;
    g.gain.cancelScheduledValues(t);
    g.gain.setValueAtTime(g.gain.value, t);
    g.gain.linearRampToValueAtTime(0, t + 0.8);
    n.stop(t + 1); lfo.stop(t + 1);
  };
}


export type AmbientKind = 'battle' | 'flight' | 'refuge' | 'exploration';
export const MUSIC_TRACKS: Readonly<Record<AmbientKind, string>> = {
  battle: '/output/audio/scenes/battle-lyria-3-5.mp3',
  flight: '/output/audio/scenes/flight-lyria-3-5.mp3',
  refuge: '/output/audio/scenes/refuge-lyria-3-5.mp3',
  exploration: '/output/audio/scenes/exploration-lyria-3-5.mp3',
};

type Voice = { gain: GainNode; sources: (AudioBufferSourceNode | OscillatorNode)[]; stopped: boolean; timer?: ReturnType<typeof setTimeout> };
type AmbientRequest = { scene: Phaser.Scene; kind: AmbientKind; loading: boolean; failed?: boolean; voice?: Voice; fallback?: Voice; stop: () => void };
let ambient: AmbientRequest | undefined;
const buffers = new Map<string, Promise<AudioBuffer>>();

function fadeOut(voice?: Voice, seconds = 0.85) {
  if (!voice || voice.stopped || !ctx) return;
  voice.stopped = true;
  if (voice.timer !== undefined) clearTimeout(voice.timer);
  const now = ctx.currentTime;
  voice.gain.gain.cancelScheduledValues(now);
  voice.gain.gain.setValueAtTime(voice.gain.gain.value, now);
  voice.gain.gain.linearRampToValueAtTime(0, now + seconds);
  let remaining = voice.sources.length;
  for (const source of voice.sources) {
    const ended = source.onended;
    source.onended = (event) => { ended?.call(source, event); source.disconnect(); if (--remaining === 0) voice.gain.disconnect(); };
    try { source.stop(now + seconds + 0.05); } catch { source.disconnect(); }
  }
}

function fallbackMusic(kind: AmbientKind): Voice {
  const gain = ctx!.createGain();
  gain.gain.setValueAtTime(0, ctx!.currentTime);
  gain.gain.linearRampToValueAtTime(0.035, ctx!.currentTime + 0.7);
  gain.connect(musicBus!);
  const base = { battle: 55, flight: 73.4, refuge: 110, exploration: 164.8 }[kind];
  const sources = [1, 1.5].map((ratio) => {
    const oscillator = ctx!.createOscillator();
    oscillator.type = 'sine';
    oscillator.frequency.value = base * ratio;
    oscillator.connect(gain);
    oscillator.start();
    return oscillator;
  });
  return { gain, sources, stopped: false };
}

function loadTrack(path: string): Promise<AudioBuffer> {
  let pending = buffers.get(path);
  if (pending) { buffers.delete(path); buffers.set(path, pending); }
  if (!pending) {
    const context = ctx!;
    pending = fetch(path).then((response) => {
      if (!response.ok) throw new Error('Music unavailable');
      return response.arrayBuffer();
    }).then((data) => context.decodeAudioData(data));
    buffers.set(path, pending);
    while (buffers.size > 2) buffers.delete(buffers.keys().next().value!);
    void pending.catch(() => { buffers.delete(path); });
  }
  return pending;
}

/** Overlap the ending and opening instead of jumping across an MP3 loop seam. */
function loopingTrack(buffer: AudioBuffer): Voice {
  const gain = ctx!.createGain();
  gain.gain.setValueAtTime(0, ctx!.currentTime);
  gain.gain.linearRampToValueAtTime(0.85, ctx!.currentTime + 0.85);
  gain.connect(musicBus!);
  const voice: Voice = { gain, sources: [], stopped: false };
  const overlap = Math.min(0.85, buffer.duration / 4);
  const schedule = (at: number) => {
    if (voice.stopped || !ctx) return;
    const source = ctx.createBufferSource();
    const envelope = ctx.createGain();
    source.buffer = buffer;
    envelope.gain.setValueAtTime(0, at);
    envelope.gain.linearRampToValueAtTime(1, at + overlap);
    envelope.gain.setValueAtTime(1, at + buffer.duration - overlap);
    envelope.gain.linearRampToValueAtTime(0, at + buffer.duration);
    source.connect(envelope).connect(gain);
    voice.sources.push(source);
    source.onended = () => { source.disconnect(); envelope.disconnect(); voice.sources = voice.sources.filter((item) => item !== source); };
    source.start(at);
    const next = at + buffer.duration - overlap;
    voice.timer = setTimeout(() => schedule(Math.max(ctx!.currentTime, next)), Math.max(0, (next - ctx.currentTime - 1) * 1000));
  };
  schedule(ctx!.currentTime);
  return voice;
}

async function playRequestedMusic() {
  const request = ambient;
  if (!request || !ready() || request.loading || request.voice || request.failed) return;
  request.loading = true;
  request.fallback ??= fallbackMusic(request.kind);
  try {
    const buffer = await loadTrack(MUSIC_TRACKS[request.kind]);
    // A fetch/decode finishing after a scene switch must never restart the old soundtrack.
    if (ambient !== request || !ready()) return;
    request.voice = loopingTrack(buffer);
    fadeOut(request.fallback);
  } catch { request.failed = true; /* Keep the synthesised bed; retry only in a new scene. */ }
  finally { request.loading = false; }
}

/** One soundtrack owner; safe before autoplay unlock and after rapid scene changes. */
export function startAmbient(scene: Phaser.Scene, kind: AmbientKind): () => void {
  if (ambient?.scene === scene && ambient.kind === kind) return ambient.stop;
  const previous = ambient;
  previous?.stop();
  const request: AmbientRequest = { scene, kind, loading: false, stop: () => {} };
  let stopped = false;
  request.stop = () => {
    if (stopped) return;
    stopped = true;
    scene.events.off('shutdown', request.stop);
    fadeOut(request.voice);
    fadeOut(request.fallback);
    if (ambient === request) ambient = undefined;
  };
  ambient = request;
  scene.events.once('shutdown', request.stop);
  void playRequestedMusic();
  return request.stop;
}

/** Called once from main; also covers scenes that do not explicitly request music. */
export function installSceneAudio(game: Phaser.Game): () => void {
  const kinds: Record<string, AmbientKind> = {
    battle: 'battle', break: 'flight', flight: 'flight', refuge: 'refuge', lia: 'exploration', world: 'exploration',
  };
  const sync = () => {
    const scenes = game.scene.getScenes(false).filter((s) => kinds[s.sys.settings.key] && (game.scene.isActive(s.sys.settings.key) || game.scene.isPaused(s.sys.settings.key)));
    const scene = scenes[scenes.length - 1];
    if (scene && (ambient?.scene !== scene || ambient.kind !== kinds[scene.sys.settings.key])) startAmbient(scene, kinds[scene.sys.settings.key]);
  };
  const unlock = () => unlockAudio();
  window.addEventListener('pointerdown', unlock);
  window.addEventListener('keydown', unlock);
  game.events.on('prestep', sync);
  const stop = () => {
    window.removeEventListener('pointerdown', unlock);
    window.removeEventListener('keydown', unlock);
    game.events.off('prestep', sync);
    ambient?.stop();
  };
  game.events.once('destroy', stop);
  return stop;
}
