import { describe, expect, it } from 'vitest';
import { RAMPS, color, luminance, makeRamp, mix, parseHex, ramp, shift } from './palette';
import { Rng, fbm, hash2, hashString, mulberry32, valueNoise } from './rng';
import { assetUrl, setManifest } from './manifest';

describe('rng', () => {
  it('is deterministic per seed', () => {
    const a = mulberry32(42), b = mulberry32(42);
    for (let i = 0; i < 20; i++) expect(a()).toBe(b());
    expect(mulberry32(1)()).not.toBe(mulberry32(2)());
  });
  it('stays in [0,1) and is reasonably uniform', () => {
    const r = new Rng('selantis');
    let sum = 0;
    for (let i = 0; i < 5000; i++) { const v = r.float(); expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThan(1); sum += v; }
    expect(sum / 5000).toBeGreaterThan(0.45);
    expect(sum / 5000).toBeLessThan(0.55);
  });
  it('int/pick respect bounds', () => {
    const r = new Rng(7);
    for (let i = 0; i < 500; i++) { const v = r.int(2, 5); expect(v).toBeGreaterThanOrEqual(2); expect(v).toBeLessThanOrEqual(5); }
    expect(['a', 'b']).toContain(r.pick(['a', 'b']));
  });
  it('hashes are stable and noise is smooth', () => {
    expect(hashString('lia')).toBe(hashString('lia'));
    expect(hash2(3, 4, 1)).toBe(hash2(3, 4, 1));
    const a = valueNoise(10, 10, 8), b = valueNoise(10.5, 10, 8);
    expect(Math.abs(a - b)).toBeLessThan(0.15);
    const f = fbm(5, 5, 12, 3);
    expect(f).toBeGreaterThanOrEqual(0);
    expect(f).toBeLessThan(1);
  });
});

describe('palette', () => {
  it('parses hex colours', () => {
    expect(parseHex('#49e0c8')).toBe(0x49e0c8);
    expect(parseHex('fff')).toBe(0xffffff);
    expect(parseHex('nope')).toBeNull();
  });
  it('every ramp runs dark to light', () => {
    for (const [name, r] of Object.entries(RAMPS)) {
      for (let i = 1; i < r.length; i++) expect(luminance(r[i]), `${name}[${i}]`).toBeGreaterThan(luminance(r[i - 1]) - 0.02);
    }
  });
  it('resolves named colours, the urmacht accent and unknown names', () => {
    expect(color('urmacht')).toBe(0x49e0c8);
    expect(color('grass2')).toBe(RAMPS.grass[2]);
    expect(color('#123456')).toBe(0x123456);
  });
  it('builds hue-shifted ramps for custom colours', () => {
    const r = makeRamp(0x7a4a90);
    expect(r).toHaveLength(6);
    for (let i = 1; i < r.length; i++) expect(luminance(r[i])).toBeGreaterThan(luminance(r[i - 1]));
    expect(ramp('#7a4a90')).toEqual(r);
    expect(luminance(shift(0x808080, 0.5))).toBeGreaterThan(luminance(0x808080));
    expect(mix(0x000000, 0xffffff, 0.5)).toBe(0x808080);
  });
});

describe('asset manifest', () => {
  it('normalises missing sections', () => {
    const m = setManifest({ characters: { lia: { walk: { file: 'assets/sprites/lia-walk.png' } } } });
    expect(m.portraits).toEqual({});
    expect(m.icons.cell).toBe(32);
    expect(m.characters.lia.poses).toEqual({});
  });
  it('survives garbage', () => {
    expect(setManifest(null).characters).toEqual({});
    expect(setManifest('x').props).toEqual({});
  });
  it('resolves asset urls against the base', () => {
    expect(assetUrl('assets/bg/hof.png')).toMatch(/assets\/bg\/hof\.png$/);
    expect(assetUrl('data:image/png;base64,x')).toBe('data:image/png;base64,x');
  });
});
