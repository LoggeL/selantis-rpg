import { describe, expect, it } from 'vitest';
import { followerSpeed, Trail } from './trail';
import { normalizeInput, stepVelocity } from './motion';

describe('Trail', () => {
  it('returns points along the walked path, not straight lines', () => {
    const t = new Trail(1, 1000);
    // L-shaped walk: right 40, then down 40
    for (let x = 0; x <= 40; x++) t.push(x, 0);
    for (let y = 1; y <= 40; y++) t.push(40, y);
    const p = t.pointBehind(40, 40, 50);
    // 50 px back along the L: 40 up the vertical leg, then 10 left on the horizontal leg
    expect(p.x).toBeCloseTo(30, 0);
    expect(p.y).toBeCloseTo(0, 0);
  });
  it('ignores tiny moves and trims to max length', () => {
    const t = new Trail(4, 50);
    t.push(0, 0); t.push(1, 0); t.push(2, 0);
    expect(t.points.length).toBe(1);
    for (let x = 4; x < 400; x += 4) t.push(x, 0);
    expect(t.length()).toBeLessThanOrEqual(54);
  });
  it('falls back to the oldest point', () => {
    const t = new Trail(1, 100);
    t.reset(10, 10, 0, 1, 20);
    const p = t.pointBehind(10, 10, 500);
    expect(p.y).toBeLessThan(-5);
  });
  it('follower speed catches up and stops near the slot', () => {
    expect(followerSpeed(1, 60, 50)).toBe(0);
    expect(followerSpeed(80, 60, 50)).toBeGreaterThan(60);
  });
});

describe('motion', () => {
  it('accelerates toward max speed and brakes', () => {
    let v = { vx: 0, vy: 0 };
    v = stepVelocity(v.vx, v.vy, 1, 0, 100, 600, 900, 0.05);
    expect(v.vx).toBeCloseTo(30);
    for (let i = 0; i < 20; i++) v = stepVelocity(v.vx, v.vy, 1, 0, 100, 600, 900, 0.05);
    expect(v.vx).toBeCloseTo(100);
    v = stepVelocity(v.vx, v.vy, 0, 0, 100, 600, 900, 0.05);
    expect(v.vx).toBeCloseTo(55);
  });
  it('normalizes diagonals', () => {
    const n = normalizeInput(1, 1);
    expect(Math.hypot(n.x, n.y)).toBeCloseTo(1);
    expect(normalizeInput(0.3, 0)).toEqual({ x: 0.3, y: 0 });
  });
});

describe('formation', () => {
  it('puts a standing follower beside the leader, not behind it', async () => {
    const { formationSlot, sideOf } = await import('./trail');
    const up = { x: 0, y: -1 };
    const s = formationSlot(100, 100, up, 1, 0);
    expect(Math.abs(s.x - 100)).toBeGreaterThanOrEqual(12);
    expect(s.y).toBeGreaterThan(100); // a little behind
    expect(sideOf(100, 100, up, s.x, s.y)).toBe(1);
    const l = formationSlot(100, 100, up, -1, 0);
    expect(sideOf(100, 100, up, l.x, l.y)).toBe(-1);
  });
  it('keeps more spacing for later followers', async () => {
    const { followDistance } = await import('./trail');
    expect(followDistance(0)).toBeGreaterThanOrEqual(24);
    expect(followDistance(1) - followDistance(0)).toBeGreaterThanOrEqual(18);
  });
});
