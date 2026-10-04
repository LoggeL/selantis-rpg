import { describe, expect, it } from 'vitest';
import { CollisionGrid } from './grid';
import { angleDiff, canSee, conePolygon, inCone, lineOfSight, raycast, rotateTowards } from './vision';

describe('angles', () => {
  it('wraps differences', () => {
    expect(angleDiff(0.1, -0.1)).toBeCloseTo(-0.2);
    expect(angleDiff(Math.PI - 0.1, -Math.PI + 0.1)).toBeCloseTo(0.2);
    expect(rotateTowards(0, 1, 0.25)).toBeCloseTo(0.25);
    expect(rotateTowards(0, 0.1, 0.25)).toBeCloseTo(0.1);
  });
});

describe('cone math', () => {
  const o = { x: 0, y: 0 };
  it('accepts points in front within range', () => {
    expect(inCone(o, 0, Math.PI / 4, 100, { x: 50, y: 10 })).toBe(true);
    expect(inCone(o, 0, Math.PI / 4, 100, { x: 50, y: 60 })).toBe(false);
    expect(inCone(o, 0, Math.PI / 4, 100, { x: -50, y: 0 })).toBe(false);
    expect(inCone(o, 0, Math.PI / 4, 40, { x: 50, y: 0 })).toBe(false);
  });
});

describe('occlusion', () => {
  const g = new CollisionGrid(200, 100);
  g.blockRect(80, 0, 8, 60, { move: true, sight: true });
  it('raycast stops at blockers', () => {
    expect(raycast(g, 10, 20, 0, 150)).toBeLessThan(75);
    expect(raycast(g, 10, 80, 0, 150)).toBe(150);
  });
  it('line of sight', () => {
    expect(lineOfSight(g, { x: 10, y: 20 }, { x: 150, y: 20 })).toBe(false);
    expect(lineOfSight(g, { x: 10, y: 80 }, { x: 150, y: 80 })).toBe(true);
  });
  it('cone polygon is clipped', () => {
    const poly = conePolygon(g, { x: 10, y: 30 }, 0, 0.3, 150, 10);
    expect(poly.length).toBe(12);
    expect(Math.max(...poly.map(p => p.x))).toBeLessThan(90);
  });
});

describe('canSee', () => {
  const g = new CollisionGrid(300, 300);
  const base = { origin: { x: 50, y: 150 }, facing: 0, halfAngle: Math.PI / 5, range: 90 };
  it('sees a standing target in the cone', () => {
    const r = canSee(g, { ...base, target: { x: 100, y: 150 } });
    expect(r.visible).toBe(true);
    expect(r.closeness).toBeGreaterThan(0.3);
  });
  it('sneaking shortens range', () => {
    expect(canSee(g, { ...base, target: { x: 120, y: 150 } }).visible).toBe(true);
    expect(canSee(g, { ...base, target: { x: 120, y: 150 }, sneaking: true }).visible).toBe(false);
  });
  it('hidden targets are never visible', () => {
    expect(canSee(g, { ...base, target: { x: 70, y: 150 }, hidden: true }).visible).toBe(false);
  });
  it('close sense works behind the guard unless sneaking', () => {
    expect(canSee(g, { ...base, target: { x: 40, y: 150 } }).visible).toBe(true);
    expect(canSee(g, { ...base, target: { x: 40, y: 150 }, sneaking: true }).visible).toBe(false);
  });
});
