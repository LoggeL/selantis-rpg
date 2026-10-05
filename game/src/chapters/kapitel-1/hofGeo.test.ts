import { describe, expect, it } from 'vitest';
import type { MapDef } from '../../world/api';
import { buildPaintedGrid } from '../../world/navgrid';
import { findPath, lineFree } from '../../world/pathfind';
import { clearPigpenGate, HOF_BLOCK, HOF_WALK, PEN_APPROACH, PEN_FENCE, PEN_GATE, PEN_GATE_INSIDE, PEN_GATE_OUTSIDE, PEN_GATE_STAND, PEN_WALK } from './hofGeo';

const map: MapDef = {
  id: 'pen-test', background: 'k1-hof', spawns: {},
  walk: [HOF_WALK, PEN_WALK, PEN_APPROACH], block: [...HOF_BLOCK, ...PEN_FENCE, PEN_GATE],
};
const pigs = [[250, 140], [318, 128], [366, 152]] as const;
const foot = { hw: 6, hh: 3.5 };

describe('farm pig pen', () => {
  it('keeps the pigs behind the closed gate and lets Lia reach the latch', () => {
    const grid = buildPaintedGrid(map, 1280, 720);
    for (const [x, y] of pigs) {
      expect(grid.boxFree(x, y, foot.hw, foot.hh)).toBe(true);
      const path = findPath(grid, { x, y }, { x: PEN_GATE_OUTSIDE[0], y: PEN_GATE_OUTSIDE[1] }, foot);
      expect(path?.at(-1)).not.toEqual({ x: PEN_GATE_OUTSIDE[0], y: PEN_GATE_OUTSIDE[1] });
    }
    const stand = { x: PEN_GATE_STAND[0], y: PEN_GATE_STAND[1] };
    expect(findPath(grid, { x: 430, y: 474 }, stand, foot)?.at(-1)).toEqual(stand);
  });

  it('opens a collision-free route through the gate for each pig while keeping the fence solid', () => {
    const grid = buildPaintedGrid(map, 1280, 720);
    const fence = [[224, 173], [274, 187], [379, 172], [302, 104]] as const;
    for (const [x, y] of fence) expect(grid.solidAt(x, y)).toBe(true);
    clearPigpenGate(grid);
    for (const [x, y] of fence) expect(grid.solidAt(x, y)).toBe(true);
    for (const [x, y] of pigs) {
      let from: { x: number; y: number } = { x, y };
      for (const [tx, ty] of [PEN_GATE_INSIDE, PEN_GATE_OUTSIDE, [446, 236], [700, 300]]) {
        const to = { x: tx, y: ty };
        const path = findPath(grid, from, to, foot);
        expect(path?.at(-1)).toEqual(to);
        for (const point of path!) {
          expect(lineFree(grid, from, point, foot.hw, foot.hh)).toBe(true);
          from = point;
        }
      }
    }
  });
});
