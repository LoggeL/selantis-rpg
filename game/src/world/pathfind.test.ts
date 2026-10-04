import { describe, expect, it } from 'vitest';
import { parseGround } from './ascii';
import { CollisionGrid } from './grid';
import { findPath, lineFree } from './pathfind';

function gridOf(rows: string[]) { return CollisionGrid.fromTerrain(parseGround(rows).terrain); }
const pathLen = (from: { x: number; y: number }, pts: { x: number; y: number }[]) =>
  pts.reduce((acc, p, i) => acc + Math.hypot(p.x - (i ? pts[i - 1].x : from.x), p.y - (i ? pts[i - 1].y : from.y)), 0);

describe('CollisionGrid', () => {
  it('blocks water and cliffs, sight only by cliffs', () => {
    const g = gridOf(['.~^']);
    expect(g.solidAt(8, 8)).toBe(false);
    expect(g.solidAt(24, 8)).toBe(true);
    expect(g.sightAt(24, 8)).toBe(false);
    expect(g.solidAt(40, 8)).toBe(true);
    expect(g.sightAt(40, 8)).toBe(true);
  });
  it('treats outside as solid and marks tiny rects', () => {
    const g = new CollisionGrid(32, 32);
    expect(g.solidAt(-1, 5)).toBe(true);
    g.blockRect(9, 9, 1, 1);
    expect(g.solidAt(9, 9)).toBe(true);
  });
  it('boxFree respects footprints', () => {
    const g = new CollisionGrid(64, 64);
    g.blockRect(16, 16, 16, 16);
    expect(g.boxFree(8, 8, 3, 2)).toBe(true);
    expect(g.boxFree(18, 18, 3, 2)).toBe(false);
  });
});

describe('findPath', () => {
  it('walks straight in open space (smoothed to one segment)', () => {
    const g = gridOf(['........', '........', '........']);
    const p = findPath(g, { x: 8, y: 8 }, { x: 120, y: 40 })!;
    expect(p).not.toBeNull();
    expect(p.length).toBe(1);
    expect(p[0]).toEqual({ x: 120, y: 40 });
  });
  it('goes around a wall', () => {
    const g = gridOf([
      '........',
      '...^....',
      '...^....',
      '...^....',
      '........',
    ]);
    const from = { x: 24, y: 40 }, to = { x: 104, y: 40 };
    const p = findPath(g, from, to)!;
    expect(p).not.toBeNull();
    expect(p[p.length - 1]).toEqual(to);
    // every segment must be collision free
    let prev = from;
    for (const pt of p) { expect(lineFree(g, prev, pt, 3.5, 2)).toBe(true); prev = pt; }
    expect(pathLen(from, p)).toBeGreaterThan(80);
  });
  it('targets the nearest reachable cell when the goal is blocked', () => {
    const g = gridOf(['....~~~~', '....~~~~']);
    const p = findPath(g, { x: 8, y: 8 }, { x: 100, y: 8 })!;
    expect(p).not.toBeNull();
    const end = p[p.length - 1];
    expect(end.x).toBeLessThan(64);
  });
  it('returns the closest point for an unreachable island', () => {
    const g = gridOf(['..~..', '..~..', '..~..']);
    const p = findPath(g, { x: 8, y: 8 }, { x: 72, y: 24 });
    expect(p).not.toBeNull();
    expect(p![p!.length - 1].x).toBeLessThan(32);
  });
  it('is fast enough on a big map', () => {
    const rows = Array.from({ length: 60 }, (_, y) => Array.from({ length: 80 }, (_, x) => (x % 10 === 5 && y % 20 !== 3 ? '^' : '.')).join(''));
    const g = gridOf(rows);
    const t = performance.now();
    const p = findPath(g, { x: 8, y: 8 }, { x: 79 * 16 + 8, y: 59 * 16 + 8 });
    expect(p).not.toBeNull();
    expect(performance.now() - t).toBeLessThan(400);
  });
  it('still moves when the click lies deep inside a big pond', () => {
    const rows = Array.from({ length: 40 }, (_, y) => Array.from({ length: 40 }, (_, x) => (Math.hypot(x - 25, y - 20) < 12 ? '~' : '.')).join(''));
    const g = gridOf(rows);
    const from = { x: 2 * 16, y: 20 * 16 };
    const p = findPath(g, from, { x: 25 * 16 + 8, y: 20 * 16 + 8 });
    expect(p).not.toBeNull();
    const end = p![p!.length - 1];
    expect(end.x).toBeGreaterThan(from.x + 100); // walked to the shore, not nowhere
  });
  it('gives identical results when buffers are reused', () => {
    const g = gridOf(['........', '...^....', '...^....', '...^....', '........']);
    const a = findPath(g, { x: 24, y: 40 }, { x: 104, y: 40 });
    findPath(g, { x: 8, y: 8 }, { x: 120, y: 72 });
    const b = findPath(g, { x: 24, y: 40 }, { x: 104, y: 40 });
    expect(b).toEqual(a);
  });
});
