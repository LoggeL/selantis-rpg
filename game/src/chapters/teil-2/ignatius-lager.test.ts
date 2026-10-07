import { describe, expect, it } from 'vitest';
import { pointInPoly } from '../../world/poly';
import type { BlockDef } from '../../world';
import { IG_BLOCKS, IG_EDGE, IG_SPAWNS, IG_SPOT, IG_STUMPS, IG_WALK } from './ignatius-lager';

const BLOCKED_SPOTS = new Set(['fire', 'lantern', 'bucket', 'choppingBlock']);
const free = (x: number, y: number) => pointInPoly(x, y, IG_WALK) && !IG_BLOCKS.some((b: BlockDef) => pointInPoly(x, y, b.poly));

describe('hermit camp geometry (e2-ignatius-lager)', () => {
  it('keeps every named standing spot walkable and every object spot blocked or off the floor', () => {
    for (const [id, [x, y]] of Object.entries(IG_SPOT)) {
      if (BLOCKED_SPOTS.has(id)) expect(free(x, y), id).toBe(false);
      else expect(free(x, y), id).toBe(true);
    }
  });

  it('can stand in front of every practice stump, and every spawn is walkable', () => {
    for (const s of IG_STUMPS) expect(free(s.base[0], s.base[1]), s.id).toBe(true);
    for (const [id, sp] of Object.entries(IG_SPAWNS)) {
      const [x, y] = sp.at as readonly [number, number];
      expect(free(x, y), id).toBe(true);
    }
  });

  it('lets both path ends touch the walkable area at the map edge', () => {
    for (const [id, poly] of Object.entries(IG_EDGE)) {
      const cx = poly.reduce((s, p) => s + p[0], 0) / poly.length;
      const cy = poly.reduce((s, p) => s + p[1], 0) / poly.length;
      expect(pointInPoly(cx, cy, IG_WALK), id).toBe(true);
    }
  });
});
