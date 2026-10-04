import { describe, expect, it } from 'vitest';
import { RAMPS, color, luminance, makeRamp, mix, parseHex, ramp, shift } from './palette';
import { Rng, fbm, hash2, hashString, mulberry32, valueNoise } from './rng';
import { E, N, NE, NW, S, SE, SW, W, buildPixelMap, chamferDistance, isBorderTile, nearestOther, neighborMask, reduceCorners, sortedOffsets, TERRAIN_INDEX } from './tiles/terrain';
import type { TerrainId } from './api';
import { ALL_ANIMS, ANIM_DEFS, maxFrames, metrics, pose, weaponKind } from './characters/rig';
import { PRESETS, PORTRAIT_IDS } from './characters/specs';

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

describe('terrain autotiling', () => {
  const g = (rows: string[]): TerrainId[][] => rows.map(r => r.split('').map(ch => (ch === 'p' ? 'path' : ch === '~' ? 'water' : ch === 'w' ? 'wood' : 'grass') as TerrainId));
  it('computes 8-neighbour masks with out-of-bounds as same', () => {
    const grid = g(['...', '.p.', '...']);
    expect(neighborMask(grid, 1, 1, t => t === 'path')).toBe(0);
    expect(neighborMask(grid, 0, 0, t => t === 'grass')).toBe(255 & ~SE);
    const line = g(['...', 'ppp', '...']);
    expect(neighborMask(line, 1, 1, t => t === 'path')).toBe(E | W);
  });
  it('reduces corners to the 47-tile blob set', () => {
    expect(reduceCorners(NE)).toBe(0);
    expect(reduceCorners(N | E | NE)).toBe(N | E | NE);
    expect(reduceCorners(N | NE | NW)).toBe(N);
    const all = new Set<number>();
    for (let m = 0; m < 256; m++) all.add(reduceCorners(m));
    expect(all.size).toBe(47);
    expect(reduceCorners(N | E | S | W | NE | SE | SW | NW)).toBe(255);
  });
  it('detects border tiles', () => {
    const grid = g(['....', '.pp.', '....']);
    expect(isBorderTile(grid, 1, 1)).toBe(true);
    const big = g(['pppp', 'pppp', 'pppp']);
    expect(isBorderTile(big, 1, 1)).toBe(false);
  });
  it('rounds natural borders but keeps floors crisp and is deterministic', () => {
    const grid = g(['....ww', '.pp.ww', '....ww']);
    const a = buildPixelMap(grid, 3, 16), b = buildPixelMap(grid, 3, 16);
    expect(a).toEqual(b);
    const W_ = 6 * 16;
    // tile centres keep their terrain
    expect(a[(16 + 8) * W_ + 16 + 8]).toBe(TERRAIN_INDEX.path);
    expect(a[8 * W_ + 3]).toBe(TERRAIN_INDEX.grass);
    // the wood floor edge stays exactly on the tile boundary
    for (let y = 0; y < 48; y++) { expect(a[y * W_ + 64]).toBe(TERRAIN_INDEX.wood); expect(a[y * W_ + 63]).not.toBe(TERRAIN_INDEX.wood); }
    // the path tile is rounded off (organic border) but keeps most of its pixels
    let inside = 0;
    for (let y = 16; y < 32; y++) for (let x = 16; x < 32; x++) if (a[y * W_ + x] === TERRAIN_INDEX.path) inside++;
    expect(inside).toBeGreaterThan(100);
    expect(inside).toBeLessThan(256);
  });
  it('finds the nearest different terrain and distances', () => {
    const map = new Uint8Array([0, 0, 0, 0, 1, 0, 0, 0, 0]);
    const e = nearestOther(map, 3, 3, 0, 0, sortedOffsets(3));
    expect(e?.other).toBe(1);
    expect(e?.dist).toBeCloseTo(Math.SQRT2);
    const d = chamferDistance(5, 1, i => i !== 0, 10);
    expect(Array.from(d)).toEqual([0, 1, 2, 3, 4]);
  });
});

describe('character rig', () => {
  it('has frame definitions for every animation', () => {
    for (const a of ALL_ANIMS) {
      expect(ANIM_DEFS[a].frames).toBeGreaterThan(0);
      expect(ANIM_DEFS[a].frames).toBeLessThanOrEqual(maxFrames());
    }
    expect(ANIM_DEFS.walk.frames).toBe(6);
  });
  it('walk cycle alternates legs and returns to the start', () => {
    const xs = Array.from({ length: 6 }, (_, f) => pose('walk', f, 'none').footN.x);
    expect(Math.max(...xs)).toBeGreaterThan(0);
    expect(Math.min(...xs)).toBeLessThan(0);
    for (let f = 0; f < 6; f++) { const p = pose('walk', f, 'none'); expect(p.footN.x).toBe(-p.footF.x); }
  });
  it('bound characters keep their hands behind the back', () => {
    expect(pose('walk', 2, 'none', true).behind).toBe(true);
    expect(pose('lie', 0, 'none', true).behind).toBeFalsy();
  });
  it('maps weapons and body metrics', () => {
    expect(weaponKind('knife')).toBe('dagger');
    expect(weaponKind(undefined)).toBe('none');
    expect(metrics('huge').fh).toBe(32);
    expect(metrics('normal').fw).toBe(24);
    expect(metrics('normal', { tall: true }).headTop).toBe(metrics('normal').headTop - 1);
  });
  it('presets follow the design bible', () => {
    expect(PRESETS.valentus.weapon).toBeUndefined(); // no staff: magic from the hand
    expect(PRESETS.baris.body).toBe('huge');
    expect(PRESETS.flick.ears).toBe('elf');
    expect(PRESETS['lia-cloak'].cloak?.color).toBe('green');
    for (const id of PORTRAIT_IDS) expect(PRESETS[id], id).toBeDefined();
  });
});
