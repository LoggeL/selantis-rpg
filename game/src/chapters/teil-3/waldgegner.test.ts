import { describe, expect, it } from 'vitest';
import type { BlockDef } from '../../world';
import { pointInPoly } from '../../world/poly';
import {
  canRub, ESCAPE_ZONE, FERNS, GHUL_BLOCKS, GHUL_GUARDS, GHUL_SPAWNS, GHUL_SPOT, GHUL_WALK, RUBS_NEEDED, WATCH_CYCLE, watcherAt,
} from './waldgegner-lager';

type Pt = readonly [number, number];
const free = (walk: readonly (readonly Pt[])[], blocks: BlockDef[], [x, y]: Pt) =>
  walk.some(p => pointInPoly(x, y, p)) && !blocks.some(b => pointInPoly(x, y, b.poly));
const centre = (poly: readonly Pt[]): Pt => [poly.reduce((s, p) => s + p[0], 0) / poly.length, poly.reduce((s, p) => s + p[1], 0) / poly.length];

describe('the Leichenfresser camp (e3-ghulwald)', () => {
  it('keeps the stake, the fire places, the ferns and the way out on free ground', () => {
    for (const id of ['stake', 'leader', 'long', 'ratze', 'ratzeHalfway', 'escape'] as const) {
      expect(free(GHUL_WALK, GHUL_BLOCKS, GHUL_SPOT[id]), id).toBe(true);
    }
    for (const [id, sp] of Object.entries(GHUL_SPAWNS)) expect(free(GHUL_WALK, GHUL_BLOCKS, sp.at as Pt), id).toBe(true);
    for (const f of FERNS) {
      expect(free(GHUL_WALK, GHUL_BLOCKS, centre(f.poly)), f.id).toBe(true);
      const sp = GHUL_SPAWNS[f.id];
      expect(pointInPoly((sp.at as Pt)[0], (sp.at as Pt)[1], f.poly), f.id).toBe(true);
    }
    expect(pointInPoly(GHUL_SPOT.escape[0], GHUL_SPOT.escape[1], ESCAPE_ZONE)).toBe(true);
  });

  it('keeps every watcher waypoint walkable', () => {
    for (const g of GHUL_GUARDS) for (const wp of g.path) {
      const at = (wp as { at: Pt }).at;
      expect(free(GHUL_WALK, GHUL_BLOCKS, at), `${g.id} ${String(at)}`).toBe(true);
    }
  });

  it('keeps the fire ring out of reach', () => {
    expect(free(GHUL_WALK, GHUL_BLOCKS, [1053, 153])).toBe(false);
  });
});

describe('the rope and the watch cycle', () => {
  it('starts with nobody watching and lets each of the three look over once per round', () => {
    expect(watcherAt(0)).toBeNull();
    const total = WATCH_CYCLE.reduce((s, p) => s + p.ms, 0);
    const seen = new Set<string>();
    for (let t = 0; t < total; t += 100) { const w = watcherAt(t); if (w) seen.add(w); }
    expect([...seen].sort()).toEqual(['ghul-anfuehrer', 'ghul-lang', 'ratze']);
    expect(watcherAt(total + 10)).toBe(watcherAt(10));
  });

  it('allows rubbing only while nobody watches and until the rope parts', () => {
    expect(canRub(null, 0)).toBe(true);
    expect(canRub('ratze', 0)).toBe(false);
    expect(canRub(null, RUBS_NEEDED)).toBe(false);
    expect(RUBS_NEEDED).toBeGreaterThanOrEqual(2);
  });
});
