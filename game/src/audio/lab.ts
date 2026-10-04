/**
 * Offline rendering + analysis of the procedural sounds (used by the audio demo and QA scripts).
 * Renders through the same mixer graph as the game, so levels match what players hear.
 */
import type { AmbienceLayer, SfxName } from './api';
import { LAYERS, layerTrim } from './ambience';
import { buildGraph } from './graph';
import { distanceParams, mulberry32 } from './math';
import { SFX, sfxTrim } from './sfx';

export interface RenderRequest {
  sfx?: SfxName;
  layer?: AmbienceLayer;
  seconds?: number;
  pitch?: number;
  /** Render an effect as heard from a distance (0..1), like sfx(name, { distance }). */
  distance?: number;
  seed?: number;
  /** Start offset in seconds (default 0.3: offline compressors need a moment to settle). */
  offset?: number;
  sampleRate?: number;
}

export async function renderOffline(req: RenderRequest): Promise<AudioBuffer> {
  const rate = req.sampleRate ?? 44100;
  const seconds = req.seconds ?? (req.layer ? 8 : 2.5);
  const ctx = new OfflineAudioContext(2, Math.ceil(rate * seconds), rate);
  const g = buildGraph(ctx);
  const rng = mulberry32(req.seed ?? 1);
  if (req.sfx) {
    const d = distanceParams(req.distance);
    const trim = sfxTrim(req.sfx) * d.gain;
    const out = ctx.createGain(); out.gain.value = trim;
    if (d.cutoff !== null) {
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = d.cutoff; lp.Q.value = 0;
      out.connect(lp).connect(g.sfx);
    } else out.connect(g.sfx);
    const verb = ctx.createGain(); verb.gain.value = trim * d.wet; verb.connect(g.sfxVerb);
    SFX[req.sfx]({ ctx, out, verb, rng, p: req.pitch ?? 1, t: req.offset ?? 0.3 });
  }
  if (req.layer) {
    const trim = layerTrim(req.layer);
    const out = ctx.createGain(); out.gain.value = trim; out.connect(g.amb);
    const verb = ctx.createGain(); verb.gain.value = trim; verb.connect(g.ambVerb);
    const gens = LAYERS[req.layer]({ ctx, out, verb, rng, start: 0.3 });
    for (const gen of gens) gen.tick(seconds, 0);
  }
  return ctx.startRendering();
}

export interface Stats { peak: number; peakDb: number; rms: number; rmsDb: number; seconds: number; dcOffset: number; nonFinite: number }

export function analyse(buffer: AudioBuffer): Stats {
  let peak = 0, sum = 0, dc = 0, nonFinite = 0, n = 0;
  for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
    const d = buffer.getChannelData(ch);
    for (let i = 0; i < d.length; i++) {
      const x = d[i];
      if (!Number.isFinite(x)) { nonFinite++; continue; }
      const a = Math.abs(x);
      if (a > peak) peak = a;
      sum += x * x;
      dc += x;
      n++;
    }
  }
  const rms = Math.sqrt(sum / Math.max(1, n));
  const db = (x: number) => (x > 0 ? 20 * Math.log10(x) : -Infinity);
  return { peak, peakDb: db(peak), rms, rmsDb: db(rms), seconds: buffer.duration, dcOffset: dc / Math.max(1, n), nonFinite };
}

/** Loudest short-term (50 ms window, 25 ms hop) RMS in dBFS, a rough stand-in for perceived loudness. */
export function shortTermLoudness(buffer: AudioBuffer): number {
  const chs = Array.from({ length: buffer.numberOfChannels }, (_, c) => buffer.getChannelData(c));
  const w = Math.max(1, Math.floor(buffer.sampleRate * 0.05));
  let best = 0;
  for (let i = 0; i + w <= buffer.length; i += Math.floor(w / 2)) {
    let sum = 0;
    for (const d of chs) for (let j = i; j < i + w; j++) sum += d[j] * d[j];
    best = Math.max(best, Math.sqrt(sum / (w * chs.length)));
  }
  return best > 0 ? 20 * Math.log10(best) : -Infinity;
}

export interface SpeakerCheck {
  /** Short-term loudness of the full signal (dBFS). */
  full: number;
  /** Short-term loudness through a 350 Hz highpass (roughly a phone or laptop speaker). */
  small: number;
  /** small - full: how much is lost on small speakers (> -8 dB is fine, < -12 dB is a problem). */
  loss: number;
}

/**
 * "Small speaker" check: phone and laptop speakers reproduce little below ~350 Hz. Effects that are
 * mostly bass (thumps, heartbeat, deep voices) vanish there, so level tuning must look at both values.
 */
export async function smallSpeaker(buffer: AudioBuffer): Promise<SpeakerCheck> {
  const ctx = new OfflineAudioContext(buffer.numberOfChannels, buffer.length, buffer.sampleRate);
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  let head: AudioNode = src;
  for (let i = 0; i < 2; i++) { // 24 dB/oct
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 350;
    hp.Q.value = 0.7;
    head.connect(hp);
    head = hp;
  }
  head.connect(ctx.destination);
  src.start();
  const filtered = await ctx.startRendering();
  const full = shortTermLoudness(buffer);
  const small = shortTermLoudness(filtered);
  return { full, small, loss: small - full };
}

/** 16-bit PCM WAV encoding. */
export function encodeWav(buffer: AudioBuffer): ArrayBuffer {
  const chs = buffer.numberOfChannels;
  const len = buffer.length;
  const out = new ArrayBuffer(44 + len * chs * 2);
  const v = new DataView(out);
  const str = (o: number, s: string) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  str(0, 'RIFF'); v.setUint32(4, 36 + len * chs * 2, true); str(8, 'WAVE');
  str(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, chs, true);
  v.setUint32(24, buffer.sampleRate, true); v.setUint32(28, buffer.sampleRate * chs * 2, true);
  v.setUint16(32, chs * 2, true); v.setUint16(34, 16, true);
  str(36, 'data'); v.setUint32(40, len * chs * 2, true);
  const data = Array.from({ length: chs }, (_, c) => buffer.getChannelData(c));
  let o = 44;
  for (let i = 0; i < len; i++) {
    for (let c = 0; c < chs; c++) {
      const x = Math.max(-1, Math.min(1, data[c][i] || 0));
      v.setInt16(o, x < 0 ? x * 0x8000 : x * 0x7fff, true);
      o += 2;
    }
  }
  return out;
}
