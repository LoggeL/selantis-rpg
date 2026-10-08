import { describe, expect, it } from 'vitest';
import type { BlockDef } from '../../world';
import { pointInPoly } from '../../world/poly';
import {
  ESCAPE_ZONE, FERNS, GHUL_BLOCKS, GHUL_GUARDS, GHUL_SPAWNS, GHUL_SPOT, GHUL_WALK, ployOptions, STEP_ORDER, STEPS,
} from './waldgegner-lager';

type Pt = readonly [number, number];
const free = (walk: readonly (readonly Pt[])[], blocks: BlockDef[], [x, y]: Pt) =>
  walk.some(p => pointInPoly(x, y, p)) && !blocks.some(b => pointInPoly(x, y, b.poly));
const centre = (poly: readonly Pt[]): Pt => [poly.reduce((s, p) => s + p[0], 0) / poly.length, poly.reduce((s, p) => s + p[1], 0) / poly.length];

describe('the goblin camp (e3-ghulwald)', () => {
  it('keeps the stake, the fire places, the ferns and the way out on free ground', () => {
    for (const id of ['stake', 'ratz', 'hotze', 'fips', 'fipsAtOak', 'brawl', 'escape'] as const) {
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

describe('the intrigue', () => {
  it('has exactly one working line per step, in the documented order', () => {
    expect(STEP_ORDER).toEqual(['runter', 'haeuptling', 'knoten', 'zank']);
    for (const step of STEP_ORDER) expect(STEPS[step].filter(p => p.works).length, step).toBe(1);
  });

  it('greys out tried wrong lines but never the working one', () => {
    for (const step of STEP_ORDER) {
      const all = new Set<string>(STEPS[step].map(p => p.id));
      const opts = ployOptions(step, all);
      expect(opts.filter(o => !o.disabled).length, step).toBe(1);
      expect(STEPS[step][opts.findIndex(o => !o.disabled)].works).toBe(true);
    }
  });
});
