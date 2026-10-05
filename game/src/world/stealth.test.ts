import { describe, expect, it, vi } from 'vitest';
import type { Actor } from './actor';
import { Guard, type GuardSense } from './stealth';
import { CollisionGrid } from './grid';
import { setMapUnits, setWorldScale } from './geom';
vi.mock('../core/G', () => ({ G: {} }));
function fixture() {
  setMapUnits('px'); setWorldScale(1);
  const actor = { x: 50, y: 50, dir: 'right', walkSpeed: 0, held: false, moving: false,
    face: vi.fn(), update: vi.fn(), stopPath: vi.fn(), teleport: vi.fn() } as unknown as Actor;
  const guard = new Guard(actor, { id: 'test', preset: 'dog', path: [[50, 50]] });
  const sense: GuardSense = { grid: new CollisionGrid(200, 200), target: undefined, hidden: false, enabled: true, dt: 1 / 60, t: 0 };
  return { guard, actor, sense };
}
describe('guard patrol fairness', () => {
  it('bounds scanning around a fixed heading even without a face waypoint', () => {
    const { guard, sense } = fixture();
    for (let i = 0; i < 3600; i++) { guard.update(sense); expect(Math.abs(guard.facing)).toBeLessThanOrEqual(0.300001); }
  });
  it('uses elapsed time consistently at 30 and 120 fps', () => {
    const slow = fixture(); const fast = fixture();
    for (let i = 0; i < 300; i++) slow.guard.update({ ...slow.sense, dt: 1 / 30 });
    for (let i = 0; i < 1200; i++) fast.guard.update({ ...fast.sense, dt: 1 / 120 });
    expect(slow.guard.facing).toBeCloseTo(fast.guard.facing, 5);
  });
  it('freezes movement, suspicion and scanning during player locks and resumes without a phase jump', () => {
    const current = fixture(); const reference = fixture();
    for (let i = 0; i < 60; i++) { current.guard.update(current.sense); reference.guard.update(reference.sense); }
    const before = current.guard.facing;
    const updates = vi.mocked(current.actor.update).mock.calls.length;
    current.guard.susp.value = 0.4;
    for (let i = 0; i < 600; i++) current.guard.update({ ...current.sense, paused: true, enabled: false, t: i });
    expect(current.guard.facing).toBe(before); expect(current.guard.susp.value).toBe(0.4);
    expect(vi.mocked(current.actor.update).mock.calls.length).toBe(updates);
    current.guard.update(current.sense); reference.guard.update(reference.sense);
    expect(current.guard.facing).toBe(reference.guard.facing);
  });
  it('updates a held scripted actor during player locks without advancing guard behaviour', () => {
    const { guard, actor, sense } = fixture();
    actor.held = true;
    guard.state = 'walk'; guard.susp.value = 0.4;
    const before = guard.facing;
    const scriptedPath = [{ x: 80, y: 50 }];
    actor.path = scriptedPath;
    const result = guard.update({ ...sense, paused: true, enabled: true });
    expect(result).toBeNull();
    expect(actor.update).toHaveBeenCalledExactlyOnceWith(sense.dt);
    expect(actor.stopPath).not.toHaveBeenCalled();
    expect(actor.path).toBe(scriptedPath);
    expect(guard.state).toBe('walk');
    expect(guard.susp.value).toBe(0.4);
    expect(guard.facing).toBe(before);
  });

  it('limits patrol turns to 1.8 radians per second', () => {
    const { guard, actor, sense } = fixture();
    guard.state = 'walk'; Object.assign(actor, { moving: true, vx: -1, vy: 0 });
    guard.update({ ...sense, dt: 0.05 });
    expect(Math.abs(guard.facing)).toBeCloseTo(0.09);
  });
});
