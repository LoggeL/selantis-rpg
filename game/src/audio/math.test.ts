import { describe, expect, it } from 'vitest';
import {
  blipVoicing, clamp, dbToGain, distanceParams, envelopeDuration, envelopePoints, equalPower, fadeCurve, gainToDb, midiToHz,
  mulberry32, panValue, pitchRatio, semitonesToRatio, sfxGain, SILENCE, Throttle, throttleKey, VoiceBudget, volumeToGain,
} from './math';
import { duckFor, IMPORTANT, SFX_NAMES, sfxTrim, sfxWeight, throttleMs } from './sfx';

describe('level math', () => {
  it('converts between dB and gain', () => {
    expect(dbToGain(0)).toBe(1);
    expect(dbToGain(-6)).toBeCloseTo(0.501, 3);
    expect(gainToDb(0.5)).toBeCloseTo(-6.02, 2);
    expect(gainToDb(0)).toBe(-Infinity);
  });

  it('maps the volume slider perceptually with true silence at 0', () => {
    expect(volumeToGain(0)).toBe(0);
    expect(volumeToGain(1)).toBe(1);
    expect(gainToDb(volumeToGain(0.5))).toBeCloseTo(-12, 0);
    expect(volumeToGain(-1)).toBe(0);
    expect(volumeToGain(5)).toBe(1);
    expect(volumeToGain(Number.NaN)).toBe(0);
    for (let v = 0.1; v < 1; v += 0.1) expect(volumeToGain(v + 0.05)).toBeGreaterThan(volumeToGain(v));
  });

  it('computes musical frequencies', () => {
    expect(midiToHz(69)).toBe(440);
    expect(midiToHz(81)).toBeCloseTo(880, 6);
    expect(semitonesToRatio(12)).toBeCloseTo(2, 9);
    expect(semitonesToRatio(-12)).toBeCloseTo(0.5, 9);
  });

  it('keeps equal-power crossfades at constant energy', () => {
    for (let t = 0; t <= 1; t += 0.125) {
      const { out, in: inn } = equalPower(t);
      expect(out * out + inn * inn).toBeCloseTo(1, 9);
    }
    expect(equalPower(-1).out).toBe(1);
    expect(equalPower(2).in).toBe(1);
  });

  it('builds monotonic fade curves that hit both endpoints', () => {
    const up = fadeCurve(0, 0.6, 16);
    expect(up[0]).toBe(0);
    expect(up[15]).toBeCloseTo(0.6, 6);
    for (let i = 1; i < up.length; i++) expect(up[i]).toBeGreaterThanOrEqual(up[i - 1]);
    const down = fadeCurve(0.6, 0, 16);
    for (let i = 1; i < down.length; i++) expect(down[i]).toBeLessThanOrEqual(down[i - 1]);
    expect(fadeCurve(1, 0, 1).length).toBe(2);
  });

  it('clamps call options', () => {
    expect(clamp(5, 0, 1)).toBe(1);
    expect(pitchRatio(undefined)).toBe(1);
    expect(pitchRatio(100)).toBe(4);
    expect(pitchRatio(Number.NaN)).toBe(1);
    expect(panValue(-3)).toBe(-1);
    expect(panValue(undefined)).toBe(0);
  });

  it('attenuates crowded mixes but never boosts', () => {
    expect(sfxGain(undefined, 0)).toBe(1);
    expect(sfxGain(0.5, 3)).toBe(0.5);
    expect(sfxGain(1, 24)).toBeCloseTo(0.5, 6);
    expect(sfxGain(9, 0)).toBe(2);
    expect(sfxGain(-1, 0)).toBe(0);
  });
});

describe('envelopes', () => {
  it('produces a clean attack, decay, sustain and release in time order', () => {
    const pts = envelopePoints({ peak: 0.5, attack: 0.01, hold: 0.02, decay: 0.1, sustain: 0.5, sustainTime: 0.2, release: 0.3 }, 1);
    expect(pts[0]).toEqual({ t: 1, v: SILENCE, curve: 'set' });
    expect(pts[1]).toMatchObject({ t: 1.01, v: 0.5, curve: 'linear' });
    for (let i = 1; i < pts.length; i++) expect(pts[i].t).toBeGreaterThan(pts[i - 1].t);
    expect(pts.at(-1)!.v).toBe(SILENCE);
    expect(pts.find(p => p.curve === 'exp')!.v).toBeCloseTo(0.25, 9);
    expect(pts.at(-1)!.t).toBeCloseTo(1 + 0.01 + 0.02 + 0.1 + 0.2 + 0.3, 9);
  });

  it('guards against zero-length segments and non-positive peaks', () => {
    const pts = envelopePoints({ peak: 0, attack: 0, release: 0 }, 0);
    expect(pts.every(p => p.v > 0)).toBe(true);
    expect(pts[1].t).toBeGreaterThan(0);
    expect(envelopeDuration({ peak: 1, attack: 0.002, release: 0.1 })).toBeCloseTo(0.102, 9);
  });
});

describe('spam protection', () => {
  it('throttles identical keys only', () => {
    const th = new Throttle(50);
    expect(th.allow('hit', 0)).toBe(true);
    expect(th.allow('hit', 20)).toBe(false);
    expect(th.allow('step', 20)).toBe(true);
    expect(th.allow('hit', 50)).toBe(true);
    expect(th.allow('hit', 120, 100)).toBe(false);
    expect(th.allow('hit', 150, 100)).toBe(true);
    th.reset();
    expect(th.allow('hit', 151)).toBe(true);
  });

  it('limits overlapping voices, with headroom for important sounds', () => {
    const b = new VoiceBudget(2, 1);
    expect(b.take(0, 1)).toBe(true);
    expect(b.take(0, 1)).toBe(true);
    expect(b.take(0, 1)).toBe(false);
    expect(b.take(0, 1, true)).toBe(true);
    expect(b.take(0, 1, true)).toBe(false);
    expect(b.active(0.5)).toBe(3);
    expect(b.active(1.5)).toBe(0);
    expect(b.take(1.5, 2)).toBe(true);
  });

  it('weights heavy voices and reserves before the end time is known', () => {
    const b = new VoiceBudget(8, 2);
    const big = b.reserve(0, 6);
    expect(big).not.toBeNull();
    expect(b.active(0)).toBe(6);
    expect(b.reserve(0, 3)).toBeNull(); // 9 > 8
    expect(b.reserve(0, 3, true)).not.toBeNull(); // important: 9 <= 10
    big!.end = 4; // real length known after scheduling
    expect(b.active(2)).toBe(6);
    expect(b.active(4.1)).toBe(0);
    // an empty budget always admits one voice, even an oversized one
    expect(new VoiceBudget(2).reserve(0, 6)).not.toBeNull();
  });

  it('throttles per caller key', () => {
    const th = new Throttle(70);
    expect(th.allow(throttleKey('step-grass', 'lia'), 0)).toBe(true);
    expect(th.allow(throttleKey('step-grass', 'kyra'), 5)).toBe(true);
    expect(th.allow(throttleKey('step-grass', 'lia'), 10)).toBe(false);
    expect(throttleKey('hit')).toBe('hit');
    // many unique keys are pruned without forgetting recent ones
    for (let i = 0; i < 400; i++) th.allow(`u${i}`, 0);
    expect(th.allow('recent', 9000)).toBe(true);
    expect(th.allow('recent', 9010)).toBe(false);
  });

  it('is deterministic for a seed', () => {
    const a = mulberry32(42), b = mulberry32(42);
    const xs = Array.from({ length: 5 }, () => a());
    expect(xs).toEqual(Array.from({ length: 5 }, () => b()));
    expect(xs.every(x => x >= 0 && x < 1)).toBe(true);
  });
});

describe('distance and voices', () => {
  it('makes far sounds darker, quieter and wetter', () => {
    expect(distanceParams(0)).toEqual({ cutoff: null, gain: 1, wet: 1 });
    expect(distanceParams(undefined).cutoff).toBeNull();
    const far = distanceParams(1);
    expect(far.cutoff).toBeCloseTo(900, 6);
    expect(gainToDb(far.gain)).toBeCloseTo(-18, 6);
    expect(far.wet).toBe(3);
    const mid = distanceParams(0.5);
    expect(mid.cutoff!).toBeGreaterThan(900);
    expect(mid.cutoff!).toBeLessThan(12000);
    expect(distanceParams(7)).toEqual(far);
    expect(distanceParams(Number.NaN).cutoff).toBeNull();
  });

  it('voices deep blips with an octave so they survive small speakers', () => {
    const deep = blipVoicing(120, 'sine');
    expect(deep.octave).toBeGreaterThan(0);
    expect(deep.lowpass).toBeGreaterThanOrEqual(1600);
    const high = blipVoicing(330, 'triangle');
    expect(high.octave).toBe(0);
    expect(blipVoicing(105, 'square').peak).toBeLessThan(high.peak);
    expect(high.lowpass).toBeLessThanOrEqual(5600);
  });
});

describe('sfx tables', () => {
  it('has sane throttle, trim and duck settings for every effect', () => {
    expect(SFX_NAMES.length).toBe(53);
    for (const name of SFX_NAMES) {
      expect(throttleMs(name)).toBeGreaterThanOrEqual(30);
      expect(sfxWeight(name)).toBeGreaterThanOrEqual(1);
      expect(sfxTrim(name)).toBeGreaterThan(0);
      expect(sfxTrim(name)).toBeLessThan(8);
      const duck = duckFor(name);
      if (duck) { expect(duck.db).toBeLessThan(0); expect(duck.ms).toBeGreaterThan(0); }
    }
    expect(throttleMs('step-grass')).toBeGreaterThan(throttleMs('ui-move'));
    expect(IMPORTANT.has('objective')).toBe(true);
    expect(sfxWeight('urmacht')).toBeGreaterThan(sfxWeight('step-grass'));
  });
});
