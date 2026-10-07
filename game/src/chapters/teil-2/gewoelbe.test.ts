import { describe, expect, it } from 'vitest';
import type { BlockDef } from '../../world';
import { pointInPoly } from '../../world/poly';
import {
  chainArea, HALLE_BLOCKS, HALLE_EDGE, HALLE_OBJECT_SPOTS, HALLE_SPAWNS, HALLE_SPOT, HALLE_WALK, KERKER_BLOCKS,
  KERKER_CELLS, KERKER_CORRIDOR, KERKER_EDGE, KERKER_SPAWNS, KERKER_SPOT, kerkerSpawns, kerkerWalk,
} from './gewoelbe';

type Pt = readonly [number, number];
const free = (walk: readonly (readonly Pt[])[], blocks: BlockDef[], [x, y]: Pt) =>
  walk.some(p => pointInPoly(x, y, p)) && !blocks.some(b => pointInPoly(x, y, b.poly));
const centre = (poly: readonly Pt[]): Pt => [poly.reduce((s, p) => s + p[0], 0) / poly.length, poly.reduce((s, p) => s + p[1], 0) / poly.length];

describe('vault hall geometry (e2-halle)', () => {
  it('keeps every standing spot walkable and every object spot off the free floor', () => {
    const objects = new Set<string>(HALLE_OBJECT_SPOTS);
    for (const [id, at] of Object.entries(HALLE_SPOT)) expect(free(HALLE_WALK, HALLE_BLOCKS, at), id).toBe(!objects.has(id));
    for (const [id, sp] of Object.entries(HALLE_SPAWNS)) expect(free(HALLE_WALK, HALLE_BLOCKS, sp.at as Pt), id).toBe(true);
    expect(free(HALLE_WALK, HALLE_BLOCKS, centre(HALLE_EDGE.south))).toBe(true);
  });

  it('keeps the chain area around the ring on free floor', () => {
    for (const p of chainArea()) expect(free(HALLE_WALK, HALLE_BLOCKS, p), String(p)).toBe(true);
    expect(pointInPoly(HALLE_SPOT.chained[0], HALLE_SPOT.chained[1], chainArea())).toBe(true);
  });
});

describe('dungeon geometry (e2-kerker)', () => {
  it('keeps the corridor spots, spawns and exits walkable', () => {
    const walk = kerkerWalk();
    for (const [id, at] of Object.entries(KERKER_SPOT)) expect(free(walk, KERKER_BLOCKS, at), id).toBe(true);
    for (const [id, sp] of Object.entries(KERKER_SPAWNS)) expect(free(walk, KERKER_BLOCKS, sp.at as Pt), id).toBe(true);
    for (const [id, poly] of Object.entries(KERKER_EDGE)) expect(free(walk, KERKER_BLOCKS, centre(poly)), id).toBe(true);
  });

  it('separates the cells from the corridor unless their door is open', () => {
    for (const [i, c] of KERKER_CELLS.entries()) {
      expect(pointInPoly(c.inLeft[0], c.inLeft[1], KERKER_CORRIDOR), c.id).toBe(false);
      const locked = kerkerWalk({ cells: [i] });
      const open = kerkerWalk({ cells: [i], open: [i] });
      expect(free(locked, KERKER_BLOCKS, c.inLeft) && free(locked, KERKER_BLOCKS, c.inRight), c.id).toBe(true);
      expect(free(locked, KERKER_BLOCKS, c.front), c.id).toBe(true);
      // The doorway sits between the bars: only the open door makes it walkable.
      expect(free(kerkerWalk({ corridor: false, cells: [i] }), KERKER_BLOCKS, [c.doorway[0], 140]), c.id).toBe(false);
      expect(free(open, KERKER_BLOCKS, [c.doorway[0], 140]), c.id).toBe(true);
    }
    const spawns = kerkerSpawns({ corridor: false, cells: [1] });
    expect(Object.keys(spawns)).toEqual(['zelle-2']);
  });
});
