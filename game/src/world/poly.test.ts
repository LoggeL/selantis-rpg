import { describe, expect, it } from 'vitest';
import { closestOnPoly, distToPoly, pointInPoly, polyBounds, polyCentroid, rasterizePoly, rectPoly } from './poly';
import { buildPaintedGrid, buildSurfaceGrid } from './navgrid';
import { findPath } from './pathfind';
import type { MapDef } from './api';

const sq = rectPoly(10, 10, 20, 20);

describe('poly', () => {
  it('point in polygon / bounds / centroid', () => {
    expect(pointInPoly(15, 15, sq)).toBe(true);
    expect(pointInPoly(5, 15, sq)).toBe(false);
    expect(polyBounds(sq)).toEqual({ x: 10, y: 10, w: 20, h: 20 });
    expect(polyCentroid(sq)).toEqual({ x: 20, y: 20 });
  });
  it('distance and closest point', () => {
    expect(distToPoly(20, 20, sq)).toBe(0);
    expect(distToPoly(0, 20, sq)).toBeCloseTo(10);
    expect(closestOnPoly(40, 20, sq)).toEqual({ x: 30, y: 20 });
  });
  it('rasterizes cell centres inside', () => {
    const cells: string[] = [];
    rasterizePoly(rectPoly(0, 0, 8, 4), 4, 10, 10, (r, c0, c1) => { for (let c = c0; c <= c1; c++) cells.push(`${c},${r}`); });
    expect(cells).toEqual(['0,0', '1,0']);
  });
});

describe('painted nav grid', () => {
  const def = {
    id: 't', background: 't', spawns: {},
    walk: [{ poly: rectPoly(0, 0, 200, 100), holes: [rectPoly(80, 0, 40, 80)] }],
    block: [{ poly: rectPoly(20, 40, 10, 10), sight: false }],
    surfaces: [{ poly: rectPoly(150, 0, 50, 100), kind: 'wheat' as const }],
  } as MapDef;
  const g = buildPaintedGrid(def, 200, 100);
  it('blocks outside walk, holes and blocks', () => {
    expect(g.solidAt(10, 10)).toBe(false);
    expect(g.solidAt(100, 20)).toBe(true);      // hole
    expect(g.solidAt(25, 45)).toBe(true);       // block
    expect(g.sightAt(25, 45)).toBe(false);      // sight: false
    expect(g.solidAt(199, 99)).toBe(false);
  });
  it('paths around the hole', () => {
    const p = findPath(g, { x: 20, y: 20 }, { x: 180, y: 20 });
    expect(p).not.toBeNull();
    expect(p!.some(q => q.y > 80)).toBe(true);
  });
  it('surfaces', () => {
    const s = buildSurfaceGrid(def, 200, 100);
    expect(s.kindAt(160, 50)).toBe('wheat');
    expect(s.kindAt(10, 50)).toBe('grass');
    expect(s.hideAt(160, 50)).toBe(true);
    expect(s.speedAt(160, 50)).toBeCloseTo(0.82);
  });
});
